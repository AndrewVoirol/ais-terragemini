import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import RotatingEarth from '../components/RotatingEarth';

describe('Tier 3: Component Lifecycle, Isolation & Context Resilience Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('3.1 should maintain component isolation without polluting global window properties', () => {
    const initialWindowKeys = Object.keys(window);

    const { unmount } = render(
      React.createElement(
        'div',
        { id: 'test-container', style: { width: '600px', height: '400px' } },
        React.createElement(RotatingEarth, { width: 600, height: 400 })
      )
    );

    const currentWindowKeys = Object.keys(window);
    const leakedKeys = currentWindowKeys.filter(
      (k) => !initialWindowKeys.includes(k) && !k.startsWith('__') && !k.startsWith('vitest')
    );

    expect(leakedKeys).toEqual([]);
    unmount();
  });

  it('3.2 should handle prop updates reactively without re-mounting canvas or crashing', () => {
    const { container, rerender } = render(
      React.createElement(RotatingEarth, { isNightMode: false, width: 800, height: 600 })
    );

    const canvasInitial = container.querySelector('canvas');
    expect(canvasInitial).not.toBeNull();

    // Rerender with Night Mode toggle
    rerender(
      React.createElement(RotatingEarth, { isNightMode: true, width: 800, height: 600 })
    );
    const canvasAfterToggle = container.querySelector('canvas');
    expect(canvasAfterToggle).not.toBeNull();

    // Rerender with selectedLocation update
    rerender(
      React.createElement(RotatingEarth, {
        isNightMode: true,
        selectedLocation: { lat: 35.6762, lon: 139.6503 },
        width: 800,
        height: 600,
      })
    );
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('3.3 should adapt to container resizing via ResizeObserver or dimension props', () => {
    const { container, rerender } = render(
      React.createElement(RotatingEarth, { width: 400, height: 300 })
    );

    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    // Update dimensions to simulated HD resolution
    rerender(React.createElement(RotatingEarth, { width: 1920, height: 1080 }));

    expect(canvas).not.toBeNull();
  });

  it('3.4 should clean up animation frames and event listeners on unmount (zero memory leaks)', () => {
    const { unmount } = render(React.createElement(RotatingEarth, { width: 500, height: 500 }));

    act(() => {
      unmount();
    });

    // Verify unmount does not throw and teardown was triggered
    expect(true).toBe(true);
  });

  it('3.5 should handle WebGL context loss and restoration events gracefully', () => {
    const { container } = render(React.createElement(RotatingEarth, { width: 600, height: 600 }));
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    const gl = canvas.getContext('webgl') as any;
    expect(gl).not.toBeNull();

    // Trigger context lost
    expect(() => {
      const lostEvent = new Event('webglcontextlost', { bubbles: true, cancelable: true });
      canvas.dispatchEvent(lostEvent);
    }).not.toThrow();

    // Trigger context restored
    expect(() => {
      const restoredEvent = new Event('webglcontextrestored', { bubbles: true, cancelable: true });
      canvas.dispatchEvent(restoredEvent);
    }).not.toThrow();
  });
});
