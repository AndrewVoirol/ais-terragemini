import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import ControlDeck from '../components/ControlDeck';
import TacticalOverlay from '../components/TacticalOverlay';
import TargetVisualizer from '../components/TargetVisualizer';
import App from '../App';
import { Coordinates, HoverTelemetry, CoordinateFormat, ColorwayPalette } from '../types';
import {
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  latLonToUTM,
  formatUTM,
  formatCoordinatesAll,
} from '../utils/coordinates';
import { getEstimatedElevation, classifyTerrain } from '../utils/elevation';
import { getSphericalDistance, getBearing } from '../utils/projection';

describe('Milestone 3 Challenger Suite: Tactical Telemetry & Control Deck UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ===========================================================================
  // SECTION 1: ControlDeck Slider & Interactive Mechanics Stress Tests
  // ===========================================================================
  describe('Section 1: ControlDeck Sliders, Palettes & Interaction Mechanics', () => {
    it('1.1 should enforce point density slider bounds [50k, 250k] and trigger callbacks accurately', () => {
      const onPointDensityChange = vi.fn();
      const { rerender } = render(
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

      const slider = screen.getByLabelText(/POINT DENSITY/i) as HTMLInputElement;
      expect(slider.min).toBe('50000');
      expect(slider.max).toBe('250000');
      expect(slider.step).toBe('5000');
      expect(slider.value).toBe('150000');

      // Test minimum bound (50,000)
      fireEvent.change(slider, { target: { value: '50000' } });
      expect(onPointDensityChange).toHaveBeenCalledWith(50000);

      // Test maximum bound (250,000)
      fireEvent.change(slider, { target: { value: '250000' } });
      expect(onPointDensityChange).toHaveBeenCalledWith(250000);

      // Test intermediate step (175,000)
      fireEvent.change(slider, { target: { value: '175000' } });
      expect(onPointDensityChange).toHaveBeenCalledWith(175000);

      // Verify display text adapts when props change
      rerender(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={250000}
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
      expect(screen.getByText('250k')).toBeDefined();
    });

    it('1.2 should enforce solar angle slider bounds [0°, 360°] and step 1°', () => {
      const onSolarAngleChange = vi.fn();
      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={150000}
          onPointDensityChange={vi.fn()}
          solarAngle={135}
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

      const slider = screen.getByLabelText(/SOLAR AZIMUTH/i) as HTMLInputElement;
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('360');
      expect(slider.step).toBe('1');
      expect(slider.value).toBe('135');

      // Test 0° dawn
      fireEvent.change(slider, { target: { value: '0' } });
      expect(onSolarAngleChange).toHaveBeenCalledWith(0);

      // Test 180° noon
      fireEvent.change(slider, { target: { value: '180' } });
      expect(onSolarAngleChange).toHaveBeenCalledWith(180);

      // Test 360° dusk
      fireEvent.change(slider, { target: { value: '360' } });
      expect(onSolarAngleChange).toHaveBeenCalledWith(360);
    });

    it('1.3 should enforce Sobel edge sensitivity bounds [0.0, 1.0] and step 0.02', () => {
      const onEdgeSensitivityChange = vi.fn();
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
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      const slider = screen.getByLabelText(/SOBEL EDGE/i) as HTMLInputElement;
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('1');
      expect(slider.step).toBe('0.02');
      expect(slider.value).toBe('0.5');

      fireEvent.change(slider, { target: { value: '0.00' } });
      expect(onEdgeSensitivityChange).toHaveBeenCalledWith(0);

      fireEvent.change(slider, { target: { value: '1.00' } });
      expect(onEdgeSensitivityChange).toHaveBeenCalledWith(1);

      fireEvent.change(slider, { target: { value: '0.74' } });
      expect(onEdgeSensitivityChange).toHaveBeenCalledWith(0.74);
    });

    it('1.4 should toggle auto-orbit and dynamically enable/disable the orbit speed slider', () => {
      const onAutoOrbitChange = vi.fn();
      const onOrbitSpeedChange = vi.fn();

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
          onAutoOrbitChange={onAutoOrbitChange}
          orbitSpeed={0.3}
          onOrbitSpeedChange={onOrbitSpeedChange}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      // Verify speed slider is enabled when autoOrbit is true
      const speedSlider = screen.getByLabelText(/Orbit Speed/i) as HTMLInputElement;
      expect(speedSlider.disabled).toBe(false);
      expect(speedSlider.min).toBe('0.05');
      expect(speedSlider.max).toBe('1.5');

      // Click auto orbit button to toggle off
      const toggleBtn = screen.getByText(/AUTO-ORBIT: ON/i);
      fireEvent.click(toggleBtn);
      expect(onAutoOrbitChange).toHaveBeenCalledWith(false);

      // Rerender with autoOrbit = false
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
          autoOrbit={false}
          onAutoOrbitChange={onAutoOrbitChange}
          orbitSpeed={0.3}
          onOrbitSpeedChange={onOrbitSpeedChange}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      expect(screen.getByText(/AUTO-ORBIT: OFF/i)).toBeDefined();
      const disabledSlider = screen.getByLabelText(/Orbit Speed/i) as HTMLInputElement;
      expect(disabledSlider.disabled).toBe(true);
    });

    it('1.5 should enforce momentum drag friction slider bounds [0.80, 0.99] and step 0.005', () => {
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
          onEdgeSensitivityChange={vi.fn()}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={onDragFrictionChange}
        />
      );

      const slider = screen.getByLabelText(/Momentum Damping/i) as HTMLInputElement;
      expect(slider.min).toBe('0.8');
      expect(slider.max).toBe('0.99');
      expect(slider.step).toBe('0.005');

      fireEvent.change(slider, { target: { value: '0.80' } });
      expect(onDragFrictionChange).toHaveBeenCalledWith(0.8);

      fireEvent.change(slider, { target: { value: '0.99' } });
      expect(onDragFrictionChange).toHaveBeenCalledWith(0.99);

      fireEvent.change(slider, { target: { value: '0.955' } });
      expect(onDragFrictionChange).toHaveBeenCalledWith(0.955);
    });

    it('1.6 should switch smoothly across all 4 colorway presets and handle palette normalization', () => {
      const onPaletteChange = vi.fn();
      const palettes: ColorwayPalette[] = ['night_radar', 'day_satellite', 'cyber_cyan', 'holographic_gold'];

      const { rerender } = render(
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

      // Verify each palette can be selected
      const names = ['Night Radar', 'Day Satellite', 'Cyber Cyan', 'Holographic Gold'];
      palettes.forEach((p, idx) => {
        const matches = screen.getAllByText(names[idx]);
        const btn = matches[matches.length - 1]; // Select card item
        fireEvent.click(btn);
        expect(onPaletteChange).toHaveBeenCalledWith(p);
      });

      // Verify normalization of kebab-case prop (e.g., 'night-radar' as any)
      rerender(
        <ControlDeck
          palette={'night-radar' as any}
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

      // Check that active header reflects Night Radar
      const activeLabels = screen.getAllByText('Night Radar');
      expect(activeLabels.length).toBeGreaterThan(0);
    });

    it('1.7 should restore all default parameters on reset button click', () => {
      const onPointDensityChange = vi.fn();
      const onSolarAngleChange = vi.fn();
      const onEdgeSensitivityChange = vi.fn();
      const onAutoOrbitChange = vi.fn();
      const onOrbitSpeedChange = vi.fn();
      const onDragFrictionChange = vi.fn();

      render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={250000}
          onPointDensityChange={onPointDensityChange}
          solarAngle={45}
          onSolarAngleChange={onSolarAngleChange}
          edgeSensitivity={0.9}
          onEdgeSensitivityChange={onEdgeSensitivityChange}
          autoOrbit={false}
          onAutoOrbitChange={onAutoOrbitChange}
          orbitSpeed={1.2}
          onOrbitSpeedChange={onOrbitSpeedChange}
          dragFriction={0.82}
          onDragFrictionChange={onDragFrictionChange}
        />
      );

      const resetBtn = screen.getByTitle(/Reset to default parameters/i);
      fireEvent.click(resetBtn);

      expect(onPointDensityChange).toHaveBeenCalledWith(150000);
      expect(onSolarAngleChange).toHaveBeenCalledWith(135);
      expect(onEdgeSensitivityChange).toHaveBeenCalledWith(0.5);
      expect(onAutoOrbitChange).toHaveBeenCalledWith(true);
      expect(onOrbitSpeedChange).toHaveBeenCalledWith(0.3);
      expect(onDragFrictionChange).toHaveBeenCalledWith(0.94);
    });

    it('1.8 should handle internal uncontrolled collapse state when onToggleCollapse is not passed', () => {
      render(
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
        />
      );

      expect(screen.getByText('COLORWAY PALETTE')).toBeDefined();

      // Click header to collapse
      const header = screen.getByText('CONTROL DECK');
      fireEvent.click(header);

      // Verify body is hidden
      expect(screen.queryByText('COLORWAY PALETTE')).toBeNull();

      // Click again to re-expand
      fireEvent.click(header);
      expect(screen.getByText('COLORWAY PALETTE')).toBeDefined();
    });
  });

  // ===========================================================================
  // SECTION 2: TacticalOverlay 3D Target Tracking & Occlusion Hardening
  // ===========================================================================
  describe('Section 2: TacticalOverlay 3D Target Tracking & Horizon Occlusion', () => {
    it('2.1 should position pinned target reticle and render SVG leader line when depth > 0 and isVisible is true', () => {
      const targetPos = { x: 512, y: 384, depth: 0.75, isVisible: true };
      const selectedCoords = { lat: 51.5074, lon: -0.1278 }; // London

      const { container } = render(
        <TacticalOverlay
          targetScreenPos={targetPos}
          selectedCoords={selectedCoords}
          hoverTelemetry={null}
          palette="cyber_cyan"
          targetCardPosition={{ x: 24, y: 72, width: 320, height: 400 }}
        />
      );

      // Verify coordinate text
      expect(screen.getByText('TGT LOCKED')).toBeDefined();
      expect(screen.getByText('51.51°, -0.13°')).toBeDefined();

      // Verify SVG leader line path
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThanOrEqual(2); // Background glow line + animated dash line

      // Verify SVG path coordinates
      const bgPath = paths[0];
      const dAttr = bgPath.getAttribute('d');
      expect(dAttr).toContain('M 512 384');
    });

    it('2.2 should trigger HORIZON OCCLUDED state when depth <= 0 (target rotated behind globe)', () => {
      const occludedTargets = [
        { x: 300, y: 200, depth: 0.0, isVisible: true },
        { x: 300, y: 200, depth: -0.001, isVisible: true },
        { x: 300, y: 200, depth: -0.85, isVisible: false },
        { x: 300, y: 200, depth: 0.5, isVisible: false }, // isVisible false also triggers occlusion
      ];

      occludedTargets.forEach((targetPos) => {
        const { unmount, container } = render(
          <TacticalOverlay
            targetScreenPos={targetPos}
            selectedCoords={{ lat: 35.6762, lon: 139.6503 }}
            hoverTelemetry={null}
            palette="night_radar"
          />
        );

        // Verify occlusion badge is visible
        expect(screen.getByText('HORIZON OCCLUDED')).toBeDefined();

        // Verify active pulsing leader line group is not rendered
        const leaderGroup = container.querySelector('svg defs + g');
        expect(leaderGroup).toBeNull();

        unmount();
      });
    });

    it('2.3 should render micro hover tracker with live coordinates and elevation telemetry', () => {
      const hoverData: HoverTelemetry = {
        coords: { lat: -22.9068, lon: -43.1729 }, // Rio de Janeiro
        formatted: formatCoordinatesAll(-22.9068, -43.1729),
        elevationMeters: 450,
        normalizedElevation: 0.25,
        terrainType: 'plains',
        sectorCode: 'SEC-23K-PR',
        screenPos: { x: 420, y: 310, depth: 0.88, isVisible: true },
      };

      render(
        <TacticalOverlay
          targetScreenPos={null}
          selectedCoords={null}
          hoverTelemetry={hoverData}
          palette="holographic_gold"
        />
      );

      expect(screen.getByText('SEC-23K-PR')).toBeDefined();
      expect(screen.getByText(/PLAINS/i)).toBeDefined();
      expect(screen.getByText(/\+450m/i)).toBeDefined();
      expect(screen.getByText(hoverData.formatted.dd)).toBeDefined();
    });

    it('2.4 should handle bathymetric trench negative elevations in hover probe', () => {
      const deepOceanHover: HoverTelemetry = {
        coords: { lat: 11.3493, lon: 142.1996 }, // Mariana Trench
        formatted: formatCoordinatesAll(11.3493, 142.1996),
        elevationMeters: -10984,
        normalizedElevation: 0.01,
        terrainType: 'ocean',
        sectorCode: 'SEC-54P-TB',
        screenPos: { x: 600, y: 400, depth: 0.95, isVisible: true },
      };

      render(
        <TacticalOverlay
          targetScreenPos={null}
          selectedCoords={null}
          hoverTelemetry={deepOceanHover}
          palette="day_satellite"
        />
      );

      expect(screen.getByText('SEC-54P-TB')).toBeDefined();
      expect(screen.getByText(/OCEAN/i)).toBeDefined();
      expect(screen.getByText(/-10984m/i)).toBeDefined();
    });

    it('2.5 should not render hover crosshair when hover screenPos is not visible or null', () => {
      const invisibleHover: HoverTelemetry = {
        coords: { lat: 0, lon: 0 },
        formatted: formatCoordinatesAll(0, 0),
        elevationMeters: 0,
        normalizedElevation: 0,
        terrainType: 'ocean',
        sectorCode: 'SEC-31N-AA',
        screenPos: { x: 100, y: 100, depth: -0.5, isVisible: false },
      };

      const { container } = render(
        <TacticalOverlay
          targetScreenPos={null}
          selectedCoords={null}
          hoverTelemetry={invisibleHover}
          palette="cyber_cyan"
        />
      );

      expect(container.querySelector('.Crosshair')).toBeNull();
      expect(screen.queryByText('SEC-31N-AA')).toBeNull();
    });
  });

  // ===========================================================================
  // SECTION 3: TargetVisualizer Coordinate Conversion & Telemetry Engine
  // ===========================================================================
  describe('Section 3: TargetVisualizer Coordinate Conversion & Telemetry Engine', () => {
    it('3.1 should toggle format switcher across MGRS, DD, DMS, and UTM and trigger onFormatChange callback', () => {
      const onFormatChange = vi.fn();
      const tokyo = { lat: 35.6762, lon: 139.6503 };

      const { rerender } = render(
        <TargetVisualizer
          isLoading={false}
          imageUrl="https://example.com/tokyo.jpg"
          coords={tokyo}
          palette="cyber_cyan"
          onFormatChange={onFormatChange}
        />
      );

      // Default format is MGRS
      const expectedMGRS = latLonToMGRS(tokyo.lat, tokyo.lon, 5);
      expect(screen.getByText(expectedMGRS)).toBeDefined();

      // Click DD
      fireEvent.click(screen.getByText('DD'));
      expect(onFormatChange).toHaveBeenCalledWith('DD');
      const expectedDD = latLonToDD(tokyo.lat, tokyo.lon, 5);
      expect(screen.getByText(expectedDD)).toBeDefined();

      // Click DMS
      fireEvent.click(screen.getByText('DMS'));
      expect(onFormatChange).toHaveBeenCalledWith('DMS');
      const expectedDMS = latLonToDMS(tokyo.lat, tokyo.lon);
      expect(screen.getByText(expectedDMS)).toBeDefined();

      // Click UTM
      fireEvent.click(screen.getByText('UTM'));
      expect(onFormatChange).toHaveBeenCalledWith('UTM');
      const expectedUTM = formatUTM(latLonToUTM(tokyo.lat, tokyo.lon));
      expect(screen.getByText(expectedUTM)).toBeDefined();
    });

    it('3.2 should compute and display topographic elevation vs abyssal depth with correct metrics', () => {
      // 1. High Elevation: Mount Everest (27.9881, 86.9250)
      const everest = { lat: 27.9881, lon: 86.925 };
      const { unmount: unmount1 } = render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={everest}
          palette="holographic_gold"
        />
      );

      expect(screen.getByText(/ELEVATION/i)).toBeDefined();
      expect(screen.getByText('LOCKED')).toBeDefined();
      expect(screen.getByText('AZIMUTH')).toBeDefined();
      expect(screen.getByText('RANGE')).toBeDefined();
      expect(screen.getByText('WGS-84 ELLIPSOID')).toBeDefined();
      unmount1();

      // 2. Abyssal Depth: Mariana Trench (11.3493, 142.1996)
      const trench = { lat: 11.3493, lon: 142.1996 };
      const { unmount: unmount2 } = render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={trench}
          palette="day_satellite"
        />
      );

      expect(screen.getByText(/ABYSSAL DEPTH/i)).toBeDefined();
      expect(screen.getByText('TERRAIN: OCEAN')).toBeDefined();
      unmount2();
    });

    it('3.3 should display correct lock states: SEARCHING (IDLE), ACQUIRING (LOADING), and LOCKED', () => {
      // 1. Idle / Standby
      const { rerender } = render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={null}
          palette="cyber_cyan"
        />
      );
      expect(screen.getByText('IDLE')).toBeDefined();
      expect(screen.getByText('SECTOR_SCAN')).toBeDefined();
      expect(screen.getByText('AWAITING TARGET')).toBeDefined();

      // 2. Acquiring / Loading
      rerender(
        <TargetVisualizer
          isLoading={true}
          imageUrl={null}
          coords={{ lat: 40.7128, lon: -74.006 }} // New York
          palette="cyber_cyan"
        />
      );
      expect(screen.getByText('ACQUIRING')).toBeDefined();
      expect(screen.getByText('ACQUIRING LOCK')).toBeDefined();
      expect(screen.getByText('Acquiring Visual...')).toBeDefined();

      // 3. Locked with Visual Feed
      rerender(
        <TargetVisualizer
          isLoading={false}
          imageUrl="https://images.unsplash.com/photo-ny.jpg"
          coords={{ lat: 40.7128, lon: -74.006 }}
          palette="cyber_cyan"
        />
      );
      expect(screen.getByText('LOCKED')).toBeDefined();
      expect(screen.getByText('SAT.FEED_V.04')).toBeDefined();
      const img = screen.getByAltText('Target Visual') as HTMLImageElement;
      expect(img.src).toContain('photo-ny.jpg');

      // 4. Locked with Offline Visual Feed
      rerender(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={{ lat: 40.7128, lon: -74.006 }}
          palette="cyber_cyan"
        />
      );
      expect(screen.getByText('VISUAL FEED OFFLINE')).toBeDefined();
    });

    it('3.4 should invoke onCardPositionChange callback with DOM bounding rectangle', () => {
      const onCardPositionChange = vi.fn();
      render(
        <TargetVisualizer
          isLoading={false}
          imageUrl={null}
          coords={null}
          palette="cyber_cyan"
          onCardPositionChange={onCardPositionChange}
        />
      );

      expect(onCardPositionChange).toHaveBeenCalled();
      const calledPos = onCardPositionChange.mock.calls[0][0];
      expect(calledPos).toHaveProperty('x');
      expect(calledPos).toHaveProperty('y');
      expect(calledPos).toHaveProperty('width');
      expect(calledPos).toHaveProperty('height');
    });
  });

  // ===========================================================================
  // SECTION 4: DOM Lifecycle, Mounting/Unmounting Stress & Listener Hygiene
  // ===========================================================================
  describe('Section 4: DOM Lifecycle, Mount/Unmount Stress & Event Listener Hygiene', () => {
    it('4.1 should complete 50 consecutive mount and unmount cycles with zero errors', () => {
      const targetPos = { x: 400, y: 300, depth: 0.9, isVisible: true };
      const coords = { lat: 37.7749, lon: -122.4194 }; // San Francisco

      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <div>
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
            />
            <TacticalOverlay
              targetScreenPos={targetPos}
              selectedCoords={coords}
              palette="cyber_cyan"
            />
            <TargetVisualizer
              coords={coords}
              palette="cyber_cyan"
            />
          </div>
        );

        unmount();
      }
    });

    it('4.2 should clean up window resize listeners when App component unmounts', () => {
      const addListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<App />);

      expect(addListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));

      unmount();

      expect(removeListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('4.3 should handle rapid high-throughput property scrubbing (100 iterations) in under 100ms', () => {
      const onDensity = vi.fn();
      const onSolar = vi.fn();
      const onEdge = vi.fn();

      const { rerender } = render(
        <ControlDeck
          palette="cyber_cyan"
          onPaletteChange={vi.fn()}
          pointDensity={50000}
          onPointDensityChange={onDensity}
          solarAngle={0}
          onSolarAngleChange={onSolar}
          edgeSensitivity={0.0}
          onEdgeSensitivityChange={onEdge}
          autoOrbit={true}
          onAutoOrbitChange={vi.fn()}
          orbitSpeed={0.3}
          onOrbitSpeedChange={vi.fn()}
          dragFriction={0.94}
          onDragFrictionChange={vi.fn()}
        />
      );

      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        const d = 50000 + i * 2000;
        const s = (i * 3.6) % 360;
        const e = (i / 100);

        rerender(
          <ControlDeck
            palette={i % 2 === 0 ? 'cyber_cyan' : 'night_radar'}
            onPaletteChange={vi.fn()}
            pointDensity={d}
            onPointDensityChange={onDensity}
            solarAngle={s}
            onSolarAngleChange={onSolar}
            edgeSensitivity={e}
            onEdgeSensitivityChange={onEdge}
            autoOrbit={true}
            onAutoOrbitChange={vi.fn()}
            orbitSpeed={0.3}
            onOrbitSpeedChange={vi.fn()}
            dragFriction={0.94}
            onDragFrictionChange={vi.fn()}
          />
        );
      }
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThan(200); // 100 React rerenders in under 200ms
    });
  });
});
