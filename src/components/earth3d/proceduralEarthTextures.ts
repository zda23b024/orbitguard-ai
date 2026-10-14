/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Generates a procedural high-resolution Earth map on HTML5 Canvas.
 * Creates photorealistic continents, major oceans, landmass features,
 * and coordinate reference graticules with zero external assets.
 */
export function createProceduralEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Ocean Base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#1a5d8b');
  oceanGrad.addColorStop(0.5, '#0c3b68');
  oceanGrad.addColorStop(1, '#1a5d8b');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Latitude/Longitude Grid Lines (Graticule)
  ctx.strokeStyle = 'rgba(95, 205, 232, 0.16)';
  ctx.lineWidth = 1;
  // Longitude meridians every 30 degrees (12 lines)
  for (let i = 0; i < width; i += width / 12) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  // Latitude parallels every 30 degrees (6 lines)
  for (let j = 0; j < height; j += height / 6) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(width, j);
    ctx.stroke();
  }

  // Equator highlight
  ctx.strokeStyle = 'rgba(95, 205, 232, 0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // 3. Draw Continental Landmass Shapes
  // Function to convert lon/lat degrees to canvas x/y
  const toX = (lon: number) => ((lon + 180) / 360) * width;
  const toY = (lat: number) => ((90 - lat) / 180) * height;

  const drawLandPoly = (coords: [number, number][], fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    coords.forEach(([lon, lat], idx) => {
      const x = toX(lon);
      const y = toY(lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();

    // Subtle continental shelf outline
    ctx.strokeStyle = 'rgba(55, 201, 232, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const landColor = '#4b8858';
  const desertColor = '#987a4f';
  const tundraColor = '#66858e';

  // Africa (including Zanzibar and East Africa)
  drawLandPoly(
    [
      [-17, 32], [-5, 36], [10, 37], [25, 32], [32, 31],
      [35, 27], [43, 12], [51, 10], [42, 0], [40, -5],
      [39, -6], // Zanzibar ~39.2 E, -6.1 S
      [35, -15], [33, -25], [26, -34], [18, -34], [12, -20],
      [9, 4], [0, 6], [-15, 12], [-17, 21]
    ],
    landColor
  );

  // Sahara / North Africa arid tone
  drawLandPoly(
    [
      [-15, 28], [-5, 35], [15, 33], [30, 31], [34, 25],
      [30, 18], [15, 16], [0, 18], [-12, 20]
    ],
    desertColor
  );

  // Europe
  drawLandPoly(
    [
      [-9, 36], [-9, 43], [-2, 48], [-5, 57], [5, 62],
      [15, 70], [28, 71], [40, 66], [40, 50], [28, 41],
      [22, 38], [14, 37], [2, 42], [-5, 36]
    ],
    landColor
  );

  // Asia
  drawLandPoly(
    [
      [40, 50], [40, 66], [60, 73], [100, 77], [140, 73],
      [170, 66], [180, 60], [140, 50], [130, 32], [120, 22],
      [105, 10], [100, 2], [90, 22], [80, 8], [70, 22],
      [60, 25], [50, 30], [35, 33], [40, 42]
    ],
    landColor
  );

  // Arabian Peninsula
  drawLandPoly(
    [
      [35, 30], [45, 30], [55, 25], [60, 22], [55, 15],
      [45, 12], [43, 14], [35, 28]
    ],
    desertColor
  );

  // North America
  drawLandPoly(
    [
      [-168, 65], [-140, 70], [-100, 70], [-80, 62], [-65, 48],
      [-75, 35], [-81, 25], [-97, 26], [-90, 30], [-105, 20],
      [-115, 32], [-124, 48], [-140, 60], [-165, 60]
    ],
    landColor
  );

  // Greenland
  drawLandPoly(
    [[-55, 60], [-40, 60], [-20, 75], [-30, 83], [-50, 82]],
    tundraColor
  );

  // South America
  drawLandPoly(
    [
      [-77, 8], [-60, 10], [-50, 0], [-35, -5], [-38, -13],
      [-48, -28], [-55, -38], [-65, -55], [-75, -50], [-72, -35],
      [-77, -18], [-81, -5]
    ],
    landColor
  );

  // Australia
  drawLandPoly(
    [
      [114, -22], [125, -15], [136, -12], [142, -11], [150, -22],
      [153, -28], [148, -37], [138, -35], [128, -32], [115, -34]
    ],
    desertColor
  );

  // Antarctica
  drawLandPoly(
    [
      [-180, -75], [-90, -70], [0, -72], [90, -68], [180, -75],
      [180, -90], [-180, -90]
    ],
    tundraColor
  );

  // Mark Zanzibar archipelago prominence
  const zX = toX(39.3);
  const zY = toY(-6.1);
  ctx.fillStyle = '#37C9E8';
  ctx.beginPath();
  ctx.arc(zX, zY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(55, 201, 232, 0.4)';
  ctx.beginPath();
  ctx.arc(zX, zY, 8, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates starry background field of realistic magnitudes
 */
export function createStarfield(): THREE.Points {
  const starsCount = 2000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starsCount * 3);
  const colors = new Float32Array(starsCount * 3);

  const starColors = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#94a3b8'),
    new THREE.Color('#37c9e8'),
    new THREE.Color('#f3b65a'),
  ];

  for (let i = 0; i < starsCount; i++) {
    const r = 2500 + Math.random() * 2000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const c = starColors[Math.floor(Math.random() * starColors.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 2.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: false,
  });

  return new THREE.Points(geometry, material);
}
