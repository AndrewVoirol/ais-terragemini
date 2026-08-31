import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import ControlDeck from '../components/ControlDeck';
import TacticalOverlay from '../components/TacticalOverlay';
import TargetVisualizer from '../components/TargetVisualizer';
import App from '../App';
import { Coordinates, HoverTelemetry, FormattedCoordinates } from '../types';
import { formatCoordinatesAll } from '../utils/coordinates';
import { getEstimatedElevation, classifyTerrain } from '../utils/elevation';

describe('Milestone 3: Tactical Telemetry & Control Deck UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // 1. ControlDeck.tsx Test Suite (Requirement R1)
  // =========================================================================
  describe('1. ControlDeck HUD Component', () => {
    it('1.1 should render all 4 colorway presets and trigger onPaletteChange when clicked', () => {
      const onPaletteChange = vi.fn();
      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={onPaletteChange}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={135}
          onSolarAngleChange={vi.fn()}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      // Verify header and 4 presets exist
      expect(screen.getByText('CONTROL DECK')).toBeDefined();
      expect(screen.getByText('Night Radar')).toBeDefined();
      expect(screen.getByText('Day Satellite')).toBeDefined();
      expect(screen.getAllByText('Cyber Cyan').length).toBeGreaterThan(0);
      expect(screen.getByText('Holographic Gold')).toBeDefined();

      // Click on Night Radar
      fireEvent.click(screen.getByText('Night Radar'));
      expect(onPaletteChange).toHaveBeenCalledWith('night_radar');

      // Click on Day Satellite
      fireEvent.click(screen.getByText('Day Satellite'));
      expect(onPaletteChange).toHaveBeenCalledWith('day_satellite');

      // Click on Holographic Gold
      fireEvent.click(screen.getByText('Holographic Gold'));
      expect(onPaletteChange).toHaveBeenCalledWith('holographic_gold');
    });

    it('1.2 should trigger point density change within [50k, 250k] range', () => {
      const onPointDensityChange = vi.fn();
      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={onPointDensityChange}
          solarAngle={135}
          onSolarAngleChange={vi.fn()}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      expect(screen.getByText('150k')).toBeDefined();

      const slider = screen.getByLabelText(/POINT DENSITY/i);
      fireEvent.change(slider, { target: { value: '200000' } });
      expect(onPointDensityChange).toHaveBeenCalledWith(200000);
    });

    it('1.3 should trigger solar angle change within [0, 360] degrees', () => {
      const onSolarAngleChange = vi.fn();
      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={180}
          onSolarAngleChange={onSolarAngleChange}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      expect(screen.getByText('180°')).toBeDefined();

      const slider = screen.getByLabelText(/SOLAR AZIMUTH/i);
      fireEvent.change(slider, { target: { value: '270' } });
      expect(onSolarAngleChange).toHaveBeenCalledWith(270);
    });

    it('1.4 should trigger edge sensitivity, auto-orbit, speed, and friction updates', () => {
      const onEdgeSensitivityChange = vi.fn();
      const onAutoOrbitChange = vi.fn();
      const onOrbitSpeedChange = vi.fn();
      const onDragFrictionChange = vi.fn();

      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={135}
          onSolarAngleChange={vi.fn()}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={onEdgeSensitivityChange}
          autoOrbit={true}
          onAutoOrbitChange={onAutoOrbitChange}
          orbitSpeed={0.3}
          onOrbitSpeedChange={onOrbitSpeedChange}
          dragFriction={0.94}
          onDragFrictionChange={onDragFrictionChange}
        />
      );

      // Edge sensitivity slider
      const edgeSlider = screen.getByLabelText(/SOBEL EDGE/i);
      fireEvent.change(edgeSlider, { target: { value: '0.85' } });
      expect(onEdgeSensitivityChange).toHaveBeenCalledWith(0.85);

      // Auto-orbit button toggle
      const autoOrbitBtn = screen.getByText(/AUTO-ORBIT: ON/i);
      fireEvent.click(autoOrbitBtn);
      expect(onAutoOrbitChange).toHaveBeenCalledWith(false);

      // Orbit speed slider
      const speedSlider = screen.getByLabelText(/Orbit Speed/i);
      fireEvent.change(speedSlider, { target: { value: '0.75' } });
      expect(onOrbitSpeedChange).toHaveBeenCalledWith(0.75);

      // Drag friction slider
      const frictionSlider = screen.getByLabelText(/Momentum Damping/i);
      fireEvent.change(frictionSlider, { target: { value: '0.98' } });
      expect(onDragFrictionChange).toHaveBeenCalledWith(0.98);
    });

    it('1.5 should support collapsing and expanding the HUD deck', () => {
      const onToggleCollapse = vi.fn();
      const { rerender } = render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={135}
          onSolarAngleChange={vi.fn()}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
          isCollapsed={false}
          onToggleCollapse={onToggleCollapse}
        />
      );

      expect(screen.getByText('COLORWAY PALETTE')).toBeDefined();

      // Click collapse
      fireEvent.click(screen.getByLabelText('Collapse Control Deck'));
      expect(onToggleCollapse).toHaveBeenCalled();

      // Re-render collapsed
      rerender(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={135}
          onSolarAngleChange={vi.fn()}
          edgeSensitivity={0.5}
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
          isCollapsed={true}
          onToggleCollapse={onToggleCollapse}
        />
      );

      expect(screen.queryByText('COLORWAY PALETTE')).toBeNull();
    });
  });

  // =========================================================================
  // 2. TacticalOverlay.tsx Test Suite (Requirement R2)
  // =========================================================================
  describe('2. TacticalOverlay Component', () => {
    it('2.1 should render 3D pinned target reticle and dynamic SVG leader line when target is visible', () => {
      const targetPos = { x: 450, y: 320, depth: 0.85, isVisible: true };
      const selectedCoords = { lat: 35.6762, lon: 139.6503 };

      const { container } = render(
        <TacticalOverlay
          targetScreenPos={targetPos}
          selectedCoords={selectedCoords}
          hoverTelemetry={null}
          palette="cyber_cyan"
          targetCardPosition={{ x: 20, y: 80, width: 300, height: 250 }}
        />
      );

      // Verify target lock label
      expect(screen.getByText('TGT LOCKED')).toBeDefined();
      expect(screen.getByText('35.68°, 139.65°')).toBeDefined();

      // Verify SVG leader line path exists
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('2.2 should handle target occlusion on far hemisphere (depth <= 0)', () => {
      const targetPos = { x: 450, y: 320, depth: -0.5, isVisible: false };
      const selectedCoords = { lat: 35.6762, lon: 139.6503 };

      render(
        <TacticalOverlay
          targetScreenPos={targetPos}
          selectedCoords={selectedCoords}
          hoverTelemetry={null}
          palette="cyber_cyan"
        />
      );

      // Verify horizon occluded indicator is displayed
      expect(screen.getByText('HORIZON OCCLUDED')).toBeDefined();
    });

    it('2.3 should render micro hover crosshair and live cursor tooltip when hovering', () => {
      const hoverData: HoverTelemetry = {
        coords: { lat: 48.8584, lon: 2.2945 },
        formatted: formatCoordinatesAll(48.8584, 2.2945),
        elevationMeters: 1842,
        normalizedElevation: 0.62,
        terrainType: 'mountains',
        sectorCode: 'SEC-31U-DQ',
        screenPos: { x: 500, y: 250, depth: 0.9, isVisible: true },
      };

      render(
        <TacticalOverlay
          targetScreenPos={null}
          selectedCoords={null}
          hoverTelemetry={hoverData}
          palette="cyber_cyan"
        />
      );

      expect(screen.getByText('SEC-31U-DQ')).toBeDefined();
      expect(screen.getByText(/MOUNTAINS/i)).toBeDefined();
      expect(screen.getByText(/\+1842m/i)).toBeDefined();
    });
  });

  // =========================================================================
  // 3. TargetVisualizer.tsx Test Suite (Requirement R2)
  // =========================================================================
  describe('3. TargetVisualizer Component', () => {
    it('3.1 should render standby scanning state when no target is locked', () => {
      render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={null}
          palette="cyber_cyan"
        />
      );

      expect(screen.getByText('SECTOR_SCAN')).toBeDefined();
      expect(screen.getByText('IDLE')).toBeDefined();
      expect(screen.getByText('AWAITING TARGET')).toBeDefined();
      expect(screen.getByText('COORDINATES')).toBeDefined();
      expect(screen.getByText('FORMAT')).toBeDefined();
    });

    it('3.2 should switch coordinate format between MGRS, DD, DMS, and UTM instantly', () => {
      const onFormatChange = vi.fn();
      const testCoords = { lat: 48.8584, lon: 2.2945 };

      render(
        <TargetVisualizer
          isLoading={false}
          imageUrl="https://example.com/sat.jpg"
          coords={testCoords}
          palette="cyber_cyan"
          onFormatChange={onFormatChange}
        />
      );

      // Verify default MGRS format is rendered
      expect(screen.getByText('MGRS')).toBeDefined();

      // Click DD
      fireEvent.click(screen.getByText('DD'));
      expect(onFormatChange).toHaveBeenCalledWith('DD');

      // Click DMS
      fireEvent.click(screen.getByText('DMS'));
      expect(onFormatChange).toHaveBeenCalledWith('DMS');

      // Click UTM
      fireEvent.click(screen.getByText('UTM'));
      expect(onFormatChange).toHaveBeenCalledWith('UTM');
    });

    it('3.3 should display elevation, terrain classification, and tactical metrics for locked target', () => {
      const testCoords = { lat: 27.9881, lon: 86.925 }; // Mount Everest area

      render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={testCoords}
          palette="cyber_cyan"
        />
      );

      expect(screen.getByText('LOCKED')).toBeDefined();
      expect(screen.getByText('AZIMUTH')).toBeDefined();
      expect(screen.getByText('RANGE')).toBeDefined();
      expect(screen.getByText('CIPHER')).toBeDefined();
      expect(screen.getByText('WGS-84 ELLIPSOID')).toBeDefined();
    });
  });

  // =========================================================================
  // 4. App.tsx Integration Test Suite
  // =========================================================================
  describe('4. Full App Integration', () => {
    it('4.1 should render App container and header branding cleanly', () => {
      render(<App />);

      expect(screen.getByText('TERRAGEMINI')).toBeDefined();
      expect(screen.getByText('V3.0')).toBeDefined();
      expect(screen.getByText('CONTROL DECK')).toBeDefined();
    });
  });
});
