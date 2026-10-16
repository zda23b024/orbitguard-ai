import React from 'react';

export class ViewerBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="viewer-loading" role="alert">The 3D view could not load. Calculations and explanations remain available. Refresh the page to retry the viewer.</div>;
    return this.props.children;
  }
}
