/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  EncounterAnalysisResult,
  formatObjectIdentifier,
  OrbitalObject,
  PropagatedState,
} from '../../types/orbital';
import {
  calculateSeparationKm,
  generateOrbitalTrajectory,
  propagateObject,
  temeToEcef,
} from '../../services/orbitalEngine';
import {
  createProceduralEarthTexture,
  createStarfield,
} from './proceduralEarthTextures';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Crosshair,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface EarthViewerProps {
  objects: OrbitalObject[];
  selectedObject: OrbitalObject | null;
  onSelectObject: (obj: OrbitalObject | null) => void;
  encounterResult: EncounterAnalysisResult | null;
  simTime: Date;
  onSimTimeChange: (newDate: Date) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  simSpeedMultiplier: number;
  onSpeedMultiplierChange: (multiplier: number) => void;
  activeModule: 'monitor' | 'analyzer' | 'explain';
}

const EARTH_RADIUS_UNITS = 100;
const KM_TO_UNITS = EARTH_RADIUS_UNITS / 6378.137;

export const EarthViewer: React.FC<EarthViewerProps> = ({
  objects,
  selectedObject,
  onSelectObject,
  encounterResult,
  simTime,
  onSimTimeChange,
  isPlaying,
  onTogglePlay,
  simSpeedMultiplier,
  onSpeedMultiplierChange,
  activeModule,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredObject, setHoveredObject] = useState<{
    obj: OrbitalObject;
    screenX: number;
    screenY: number;
    prop: PropagatedState;
  } | null>(null);

  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [cameraMode, setCameraMode] = useState<'free' | 'follow'>('free');
  const [rendererError, setRendererError] = useState<string | null>(null);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);

  // Markers and dynamic visualization objects
  const markerMeshesRef = useRef<
    Map<
      string,
      {
        mesh: THREE.Mesh;
        halo: THREE.Mesh;
        obj: OrbitalObject;
      }
    >
  >(new Map());

  const orbitPathLinesRef = useRef<Map<string, THREE.Line>>(new Map());
  const encounterLineRef = useRef<THREE.Line | null>(null);
  const encounterBubbleRef = useRef<THREE.Mesh | null>(null);

  // Reusable vectors for zero GC in render loop
  const _vec3 = useMemo(() => new THREE.Vector3(), []);
  const _targetCamPos = useMemo(() => new THREE.Vector3(), []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#081322');

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      1,
      8000
    );
    camera.position.set(0, 160, 320);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      setRendererError(null);
    } catch (error) {
      console.error('WebGL globe initialization failed', error);
      setRendererError('3D Earth is unavailable because WebGL could not be initialized. Use a browser with WebGL enabled.');
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 115;
    controls.maxDistance = 1400;
    controlsRef.current = controls;

    // 5. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    // Directional Sun Light
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(400, 200, 300);
    scene.add(sunLight);

    // Soft Rim Light
    const rimLight = new THREE.DirectionalLight(0x37c9e8, 0.7);
    rimLight.position.set(-300, -100, -200);
    scene.add(rimLight);

    // 6. Deep Space Starfield
    const starfield = createStarfield();
    scene.add(starfield);

    // 7. Earth Sphere with Procedural High-Fidelity Texture
    const earthGeometry = new THREE.SphereGeometry(
      EARTH_RADIUS_UNITS,
      64,
      64
    );
    const earthTexture = createProceduralEarthTexture();
    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.15,
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);
    earthMeshRef.current = earthMesh;

    // 8. Atmospheric Rayleigh Glow Rim Shell
    const atmosphereGeometry = new THREE.SphereGeometry(
      EARTH_RADIUS_UNITS * 1.025,
      48,
      48
    );
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.215, 0.788, 0.910, 1.0) * intensity * 0.9;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphereMesh);

    // 9. Equatorial Reference Ring
    const equatorGeo = new THREE.BufferGeometry();
    const eqPoints = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      eqPoints.push(
        Math.cos(theta) * (EARTH_RADIUS_UNITS + 0.5),
        0,
        Math.sin(theta) * (EARTH_RADIUS_UNITS + 0.5)
      );
    }
    equatorGeo.setAttribute('position', new THREE.Float32BufferAttribute(eqPoints, 3));
    const equatorMat = new THREE.LineBasicMaterial({
      color: 0x37c9e8,
      transparent: true,
      opacity: 0.25,
    });
    const equatorLine = new THREE.Line(equatorGeo, equatorMat);
    scene.add(equatorLine);

    // 10. Encounter Line and Bubble
    const encounterLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const encounterLineMat = new THREE.LineDashedMaterial({
      color: 0xef6464,
      dashSize: 3,
      gapSize: 2,
      linewidth: 2,
    });
    const encLine = new THREE.Line(encounterLineGeo, encounterLineMat);
    encLine.visible = false;
    scene.add(encLine);
    encounterLineRef.current = encLine;

    const encBubbleGeo = new THREE.SphereGeometry(4, 16, 16);
    const encBubbleMat = new THREE.MeshBasicMaterial({
      color: 0xef6464,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const encBubble = new THREE.Mesh(encBubbleGeo, encBubbleMat);
    encBubble.visible = false;
    scene.add(encBubble);
    encounterBubbleRef.current = encBubble;

    // Resize Handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Render Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse((node) => {
        const renderable = node as THREE.Mesh;
        renderable.geometry?.dispose();
        const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
        materials.forEach((material) => {
          const mapped = material as THREE.Material & { map?: THREE.Texture };
          mapped.map?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync / Create Object Markers
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean up removed objects
    const currentIds = new Set(objects.map((o) => o.id));
    markerMeshesRef.current.forEach((val, id) => {
      if (!currentIds.has(id)) {
        scene.remove(val.mesh);
        scene.remove(val.halo);
        val.mesh.geometry.dispose();
        (val.mesh.material as THREE.Material).dispose();
        val.halo.geometry.dispose();
        (val.halo.material as THREE.Material).dispose();
        markerMeshesRef.current.delete(id);
      }
    });

    // Create markers for objects
    objects.forEach((obj) => {
      if (!markerMeshesRef.current.has(obj.id)) {
        const isPayload = obj.classification === 'PAYLOAD';
        const color = isPayload ? 0x6da8ff : obj.classification === 'UNKNOWN' ? 0x9eb1c5 : 0xf3b65a;

        // Core marker sphere
        const markerGeo = new THREE.SphereGeometry(1.6, 12, 12);
        const markerMat = new THREE.MeshBasicMaterial({
          color,
          depthTest: true,
        });
        const mesh = new THREE.Mesh(markerGeo, markerMat);
        mesh.userData = { noradId: obj.id, object: obj };

        // Outer glow halo
        const haloGeo = new THREE.SphereGeometry(2.8, 12, 12);
        const haloMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.35,
          wireframe: true,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.visible = false;

        scene.add(mesh);
        scene.add(halo);

        markerMeshesRef.current.set(obj.id, { mesh, halo, obj });
      } else {
        const marker = markerMeshesRef.current.get(obj.id)!;
        marker.obj = obj;
        marker.mesh.userData = { noradId: obj.id, object: obj };
      }
    });
  }, [objects]);

  // Update object positions and encounter visualization according to simTime
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let selectedMeshPos: THREE.Vector3 | null = null;

    // Propagate each object
    markerMeshesRef.current.forEach(({ mesh, halo, obj }) => {
      const prop = propagateObject(obj, simTime);
      if (prop.valid) {
        mesh.visible = true;
        // SGP4 gives TEME; rotate it to Earth-fixed coordinates at this same UTC simulation time.
        const ecef = temeToEcef(prop.positionEci, simTime);
        const x = ecef.x * KM_TO_UNITS;
        const y = ecef.z * KM_TO_UNITS;
        const z = -ecef.y * KM_TO_UNITS;

        mesh.position.set(x, y, z);
        halo.position.set(x, y, z);

        const isSelected = selectedObject?.id === obj.id;
        const isEncounterObj =
          encounterResult &&
          (encounterResult.satellite.id === obj.id ||
            encounterResult.debris.id === obj.id);

        halo.visible = Boolean(isSelected || isEncounterObj);

        if (isSelected) {
          selectedMeshPos = mesh.position.clone();
          (halo.material as THREE.MeshBasicMaterial).color.setHex(0x37c9e8);
          halo.scale.set(1.8, 1.8, 1.8);
        } else if (isEncounterObj) {
          (halo.material as THREE.MeshBasicMaterial).color.setHex(0xef6464);
          halo.scale.set(1.5, 1.5, 1.5);
        }
      } else {
        mesh.visible = false;
        halo.visible = false;
      }
    });

    // Update encounter distance line & proximity bubble
    if (encounterResult && encounterLineRef.current && encounterBubbleRef.current) {
      const satMarker = markerMeshesRef.current.get(encounterResult.satellite.id);
      const debMarker = markerMeshesRef.current.get(encounterResult.debris.id);

      if (satMarker && debMarker && satMarker.mesh.visible && debMarker.mesh.visible) {
        const p1 = satMarker.mesh.position;
        const p2 = debMarker.mesh.position;

        const positions = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
        encounterLineRef.current.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        encounterLineRef.current.geometry.computeBoundingSphere();
        encounterLineRef.current.computeLineDistances();
        encounterLineRef.current.visible = true;

        // Position encounter bubble midway
        encounterBubbleRef.current.position.set(
          (p1.x + p2.x) / 2,
          (p1.y + p2.y) / 2,
          (p1.z + p2.z) / 2
        );
        encounterBubbleRef.current.visible = true;
      } else {
        encounterLineRef.current.visible = false;
        encounterBubbleRef.current.visible = false;
      }
    } else {
      if (encounterLineRef.current) encounterLineRef.current.visible = false;
      if (encounterBubbleRef.current) encounterBubbleRef.current.visible = false;
    }

    // Camera follow mode for selected object
    if (
      cameraMode === 'follow' &&
      selectedMeshPos &&
      controlsRef.current &&
      cameraRef.current
    ) {
      controlsRef.current.target.lerp(selectedMeshPos, 0.08);
    }
  }, [simTime, selectedObject, encounterResult, cameraMode]);

  // Render orbital trajectory ribbon for selected object
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing orbit lines
    orbitPathLinesRef.current.forEach((line) => {
      scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
    orbitPathLinesRef.current.clear();

    const objectsToDrawOrbits: OrbitalObject[] = [];
    if (selectedObject) objectsToDrawOrbits.push(selectedObject);
    if (encounterResult) {
      if (
        encounterResult.satellite.id !== selectedObject?.id &&
        !objectsToDrawOrbits.some((o) => o.id === encounterResult.satellite.id)
      ) {
        objectsToDrawOrbits.push(encounterResult.satellite);
      }
      if (
        encounterResult.debris.id !== selectedObject?.id &&
        !objectsToDrawOrbits.some((o) => o.id === encounterResult.debris.id)
      ) {
        objectsToDrawOrbits.push(encounterResult.debris);
      }
    }

    objectsToDrawOrbits.forEach((obj) => {
      const trajPoints = generateOrbitalTrajectory(obj, simTime, 140);
      if (trajPoints.length > 5) {
        const threePoints = trajPoints.map((p, i) => {
          const sampleDate = new Date(simTime.getTime() + (i / (trajPoints.length - 1)) * obj.periodMinutes * 60_000);
          const ecef = temeToEcef(p, sampleDate);
          return new THREE.Vector3(
            ecef.x * KM_TO_UNITS,
            ecef.z * KM_TO_UNITS,
            -ecef.y * KM_TO_UNITS
          );
        });

        const geo = new THREE.BufferGeometry().setFromPoints(threePoints);
        const isPayload = obj.classification === 'PAYLOAD';
        const color = isPayload ? 0x37c9e8 : obj.classification === 'UNKNOWN' ? 0x9eb1c5 : 0xf3b65a;

        const mat = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
          linewidth: 1.5,
        });

        const line = new THREE.Line(geo, mat);
        scene.add(line);
        orbitPathLinesRef.current.set(obj.id, line);
      }
    });
  }, [selectedObject, encounterResult, simTime]);

  // Raycasting for interactive marker selection and hover
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 4 };
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const meshes = Array.from(markerMeshesRef.current.values()).map((v) => v.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const obj = hit.userData.object as OrbitalObject;
      const prop = propagateObject(obj, simTime);
      setHoveredObject({
        obj,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
        prop,
      });
      container.style.cursor = 'pointer';
    } else {
      setHoveredObject(null);
      container.style.cursor = 'default';
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;

    const rect = container.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

    const meshes = Array.from(markerMeshesRef.current.values()).map((v) => v.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const obj = hit.userData.object as OrbitalObject;
      onSelectObject(obj);

      // Smooth focus on object
      if (controlsRef.current) {
        controlsRef.current.target.copy(hit.position);
      }
    }
  };

  // Simulation time tick driver
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // 100ms real tick * simSpeedMultiplier seconds
      const deltaSimMs = (100 * simSpeedMultiplier);
      onSimTimeChange(new Date(simTime.getTime() + deltaSimMs));
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, simTime, simSpeedMultiplier, onSimTimeChange]);

  // Jump camera to encounter
  const handleJumpToEncounter = () => {
    if (!encounterResult) return;
    const tCaDate = new Date(encounterResult.tCaTimestampMs);
    onSimTimeChange(tCaDate);
    if (isPlaying) onTogglePlay();

    // Position camera near encounter
    const satPos = temeToEcef(encounterResult.satellitePositionEci, tCaDate);
    const x = satPos.x * KM_TO_UNITS;
    const y = satPos.z * KM_TO_UNITS;
    const z = -satPos.y * KM_TO_UNITS;

    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(x, y, z);
      cameraRef.current.position.set(x * 1.35, y * 1.35 + 30, z * 1.35 + 30);
    }
  };

  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      cameraRef.current.position.set(0, 160, 320);
      setCameraMode('free');
    }
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#081322]">
      {/* 3D Canvas Mount Point */}
      <div
        ref={mountRef}
        className="w-full h-full"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      />
      {rendererError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-[#081322] text-center">
          <div className="max-w-md rounded-xl border border-amber-500/40 bg-[#11243A] p-5 text-sm text-slate-200">
            <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-amber-300" />
            {rendererError}
          </div>
        </div>
      )}

      {/* Top Overlay Badges */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#11243A]/90 border border-[#24364B] shadow-lg backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-[#6DA8FF]" />
          <span className="text-xs font-medium text-slate-300">
            Satellites: {objects.filter((o) => o.classification === 'PAYLOAD').length}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#11243A]/90 border border-[#24364B] shadow-lg backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F3B65A]" />
          <span className="text-xs font-medium text-slate-300">
            Tracked Debris: {objects.filter((o) => o.classification === 'DEBRIS' || o.classification === 'ROCKET BODY').length}
          </span>
        </div>
        {objects.some((o) => o.classification === 'UNKNOWN') && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#11243A]/90 border border-[#24364B] shadow-lg backdrop-blur-md">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span className="text-xs font-medium text-slate-300">Unknown: {objects.filter((o) => o.classification === 'UNKNOWN').length}</span>
          </div>
        )}

        {encounterResult && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#11243A]/95 border border-[#EF6464]/60 shadow-lg backdrop-blur-md">
            <AlertTriangle className="w-3.5 h-3.5 text-[#EF6464]" />
            <span className="text-xs font-semibold text-slate-100">
              Encounter: {encounterResult.minSeparationKm.toFixed(1)} km
            </span>
          </div>
        )}
      </div>

      {/* Floating View Controls (Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          onClick={handleResetCamera}
          title="Reset Earth View"
          className="p-2 rounded-lg bg-[#11243A]/90 hover:bg-[#1a3454] border border-[#24364B] text-slate-300 hover:text-cyan-400 transition cursor-pointer backdrop-blur-md"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        {selectedObject && (
          <button
            onClick={() => setCameraMode((m) => (m === 'follow' ? 'free' : 'follow'))}
            title={cameraMode === 'follow' ? 'Exit Follow Mode' : 'Follow Selected Object'}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-medium transition cursor-pointer backdrop-blur-md ${
              cameraMode === 'follow'
                ? 'bg-[#37C9E8]/20 border-[#37C9E8] text-[#37C9E8]'
                : 'bg-[#11243A]/90 border-[#24364B] text-slate-300 hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{cameraMode === 'follow' ? 'Following' : 'Follow'}</span>
          </button>
        )}
      </div>

      {/* Hover Object Tooltip */}
      {hoveredObject && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${hoveredObject.screenX}px`,
            top: `${hoveredObject.screenY}px`,
          }}
        >
          <div className="bg-[#11243A]/95 border border-[#37C9E8]/50 rounded-lg p-2.5 shadow-2xl backdrop-blur-md text-xs min-w-[180px]">
            <div className="flex items-center justify-between gap-2 border-b border-[#24364B] pb-1.5 mb-1.5">
              <span className="font-bold text-white truncate">
                {hoveredObject.obj.name}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  hoveredObject.obj.classification === 'PAYLOAD'
                    ? 'bg-blue-900/60 text-blue-300'
                    : 'bg-amber-900/60 text-amber-300'
                }`}
              >
                {hoveredObject.obj.classification}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 text-[11px]">
              <span className="text-slate-400">Object ID:</span>
              <span className="font-mono text-cyan-400">{formatObjectIdentifier(hoveredObject.obj)}</span>
              <span className="text-slate-400">Altitude:</span>
              <span className="font-mono text-white">
                {hoveredObject.prop.geodetic.altitudeKm.toFixed(1)} km
              </span>
              <span className="text-slate-400">Orbital Speed:</span>
              <span className="font-mono text-white">
                {hoveredObject.prop.speedKmS.toFixed(2)} km/s
              </span>
            </div>
            <div className="mt-1 text-[10px] text-cyan-300/80 italic text-center">
              Click to select and view orbit
            </div>
          </div>
        </div>
      )}

      {/* Ergonomic Collapsible Bottom Control Dock (Per Three.js Constitution) */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 w-[94%] max-w-3xl">
        {/* Toggle Drawer Button */}
        <div className="flex justify-center -mb-2">
          <button
            onClick={() => setControlsCollapsed(!controlsCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#11243A] hover:bg-[#193352] border border-[#24364B] rounded-t-lg text-slate-300 hover:text-cyan-400 text-xs font-medium cursor-pointer shadow-md backdrop-blur-md transition"
          >
            {controlsCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Mission Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {!controlsCollapsed && (
          <div className="bg-[#11243A]/95 border border-[#24364B] rounded-xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2.5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 3rem)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Play / Pause & Time readout */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePlay}
                  className={`p-2 rounded-lg cursor-pointer transition flex items-center justify-center ${
                    isPlaying
                      ? 'bg-[#37C9E8] text-slate-900 font-bold hover:bg-[#52d2ed]'
                      : 'bg-[#193352] text-slate-200 hover:bg-[#23456c]'
                  }`}
                  title={isPlaying ? 'Pause Simulation' : 'Run SGP4 Simulation'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{simTime.toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    SGP4 Propagation Clock
                  </span>
                </div>
              </div>

              {/* Speed Multipliers */}
              <div className="flex items-center gap-1 bg-[#081322] p-1 rounded-lg border border-[#24364B]">
                {[1, 10, 60, 300, 1000].map((multiplier) => (
                  <button
                    key={multiplier}
                    onClick={() => onSpeedMultiplierChange(multiplier)}
                    className={`px-2 py-1 text-xs font-mono rounded cursor-pointer transition ${
                      simSpeedMultiplier === multiplier
                        ? 'bg-[#37C9E8] text-slate-900 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {multiplier}x
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSimTimeChange(new Date())}
                  className="px-2.5 py-1.5 rounded-lg bg-[#193352] hover:bg-[#23456c] text-xs text-slate-300 hover:text-white border border-[#24364B] transition cursor-pointer"
                >
                  Now (UTC)
                </button>

                {encounterResult && (
                  <button
                    onClick={handleJumpToEncounter}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EF6464]/20 hover:bg-[#EF6464]/30 text-[#EF6464] border border-[#EF6464]/40 text-xs font-medium transition cursor-pointer"
                    title="Jump simulation time to estimated closest approach"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Jump to t_CA</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Selected Object Strip */}
            {selectedObject && (
              <div className="flex items-center justify-between border-t border-[#24364B] pt-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Focused Object:</span>
                  <span className="font-semibold text-white">
                    {selectedObject.name}
                  </span>
                  <span className="font-mono text-cyan-400">
                    {formatObjectIdentifier(selectedObject)}
                  </span>
                  <span className="text-slate-400">
                    ({selectedObject.classification})
                  </span>
                </div>
                <button
                  onClick={() => onSelectObject(null)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
