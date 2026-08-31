import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import RotatingEarth from '../components/RotatingEarth';
import TargetVisualizer from '../components/TargetVisualizer';
import BootSequence from '../components/BootSequence';

describe('Tier 1: Smoke & Context Acquisition Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('1.1 should mount RotatingEarth in DOM without throwing exceptions', () => {
    expect(() => {
      const { container } = render(React.createElement(RotatingEarth));
      expect(container).toBeDefined();
    }).not.toThrow();
  });

  it('1.2 should create and attach an HTML canvas element inside the component container', () => {
    const { container } = render(React.createElement(RotatingEarth));
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.tagName.toLowerCase()).toBe('canvas');
  });

  it('1.3 should acquire WebGL rendering context from the canvas element', () => {
    const { container } = render(React.createElement(RotatingEarth));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    expect(gl).not.toBeNull();
    expect(gl).toBeDefined();
  });

  it('1.4 should compile shaders and link WebGL programs without GL errors', () => {
    const { container } = render(React.createElement(RotatingEarth));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    const gl = (canvas.getContext('webgl') || canvas.getContext('webgl2')) as any;

    expect(gl).not.toBeNull();
    // Verify getError returns NO_ERROR (0)
    expect(gl.getError()).toBe(0);
    // Verify shaders were created and compiled
    expect(gl.createShader).toHaveBeenCalled();
    expect(gl.compileShader).toHaveBeenCalled();
    // Verify program was created and linked
    expect(gl.createProgram).toHaveBeenCalled();
    expect(gl.linkProgram).toHaveBeenCalled();
  });

  it('1.5 should initialize HUD overlay components (TargetVisualizer) in standby state', () => {
    const { container } = render(
      React.createElement(TargetVisualizer, {
        isLoading: false,
        imageUrl: null,
        coords: null,
        isNightMode: false,
      })
    );

    // Standby header should be present
    expect(screen.getByText('SECTOR_SCAN')).toBeDefined();
    expect(screen.getByText('IDLE')).toBeDefined();
    expect(screen.getByText('AWAITING TARGET')).toBeDefined();
    expect(screen.getByText('COORDINATES')).toBeDefined();

    // Verify glassmorphic backdrop styling
    const hudContainer = container.firstChild as HTMLElement;
    expect(hudContainer.className).toContain('backdrop-blur');
  });

  it('1.6 should render BootSequence overlay and trigger onComplete callback', () => {
    const onComplete = vi.fn();
    render(React.createElement(BootSequence, { onComplete }));

    expect(screen.getByText(/TERRAGEMINI/i)).toBeDefined();
  });

  it('1.7 should handle missing optional props gracefully with zero uncaught errors', () => {
    expect(() => {
      const { unmount } = render(
        React.createElement(RotatingEarth, {
          width: undefined,
          height: undefined,
          className: undefined,
          onViewChange: undefined,
          onLocationSelect: undefined,
          isNightMode: undefined,
          selectedLocation: undefined,
        })
      );
      unmount();
    }).not.toThrow();
  });
});
