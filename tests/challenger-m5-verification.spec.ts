import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Milestone 5 Challenger Verification: Portfolio Documentation & Ingestion Package', () => {
  const rootDir = path.resolve(__dirname, '..');

  describe('1. README.md Portfolio Standards & Integrity', () => {
    const readmePath = path.join(rootDir, 'README.md');
    const content = fs.readFileSync(readmePath, 'utf-8');
    const rawLines = content.split('\n');

    it('1.1 should start strictly on Line 1 with hero embed ![TerraGemini referencing screenshots/demo.webp', () => {
      expect(rawLines[0]).toMatch(/^!\[TerraGemini.*\]\(screenshots\/demo\.webp\)$/);
      expect(rawLines[0].startsWith('![TerraGemini')).toBe(true);
      expect(rawLines[0].includes('screenshots/demo.webp')).toBe(true);
    });

    it('1.2 should have Quick Start with <= 4 commands: git clone, cd, npm install, npm run dev', () => {
      const quickstartRegex = /```bash\s+git clone\s+[^\n]+\s+cd\s+[^\n]+\s+npm install\s+npm run dev\s+```/m;
      expect(content).toMatch(quickstartRegex);

      // Verify command count strictly <= 4
      const quickstartMatch = content.match(/## Quick Start\s+```bash([\s\S]*?)```/);
      expect(quickstartMatch).toBeTruthy();
      if (quickstartMatch) {
        const commands = quickstartMatch[1]
          .split('\n')
          .map((c) => c.trim())
          .filter((c) => c.length > 0 && !c.startsWith('#'));
        expect(commands.length).toBeLessThanOrEqual(4);
        expect(commands[0]).toMatch(/^git clone/);
        expect(commands[1]).toMatch(/^cd/);
        expect(commands[2]).toBe('npm install');
        expect(commands[3]).toBe('npm run dev');
      }
    });

    it('1.3 should verify that every image referenced in README.md exists and is valid', () => {
      const imgRegex = /!\[.*?\]\((screenshots\/[^)]+)\)/g;
      let match: RegExpExecArray | null;
      const referencedImages: string[] = [];

      while ((match = imgRegex.exec(content)) !== null) {
        referencedImages.push(match[1]);
      }

      expect(referencedImages.length).toBeGreaterThanOrEqual(5);

      for (const relPath of referencedImages) {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const stats = fs.statSync(fullPath);
        expect(stats.size).toBeGreaterThan(1000);
      }
    });

    it('1.4 should include Tech Stack table and Deep WebGL Shader Pipeline architecture sections', () => {
      expect(content).toMatch(/## Tech Stack/);
      expect(content).toMatch(/## Deep WebGL Shader Pipeline Architecture/);
      expect(content).toMatch(/Cosine Rejection/);
      expect(content).toMatch(/Blinn-Phong/);
      expect(content).toMatch(/Sobel/);
      expect(content).toMatch(/Forward Projection/);
      expect(content).toMatch(/Inverse Raycasting/);
    });
  });

  describe('2. DELIVERABLES.md Site Ingestion Package & Atomic Dossier', () => {
    const deliverablesPath = path.join(rootDir, 'DELIVERABLES.md');
    const content = fs.readFileSync(deliverablesPath, 'utf-8');

    it('2.1 should have valid YAML frontmatter targeting andrewvoirol.com with integrity demo', () => {
      expect(content.startsWith('---')).toBe(true);
      expect(content).toMatch(/slug:\s*"terragemini-holographic-cartography"/);
      expect(content).toMatch(/target_repo:\s*"andrewvoirol\.com"/);
      expect(content).toMatch(/integrity:\s*"demo"/);
      expect(content).toMatch(/hero_webp:\s*"screenshots\/demo\.webp"/);
      expect(content).toMatch(/showcase_mp4:\s*"deliverables\/demo\.mp4"/);
    });

    it('2.2 should verify that all media files referenced in DELIVERABLES.md exist on disk', () => {
      const mediaFiles = [
        'screenshots/demo.webp',
        'deliverables/demo.mp4',
        'screenshots/night-mode.png',
        'screenshots/day-specular.png',
        'screenshots/target-hud.png',
        'screenshots/palette-matrix.png',
      ];

      for (const file of mediaFiles) {
        const fullPath = path.join(rootDir, file);
        expect(fs.existsSync(fullPath)).toBe(true);
        const stats = fs.statSync(fullPath);
        expect(stats.size).toBeGreaterThan(1000);
      }
    });

    it('2.3 should contain all 4 Atomic Build Logs with mathematical vector formulations', () => {
      expect(content).toMatch(/## 2\. Atomic Build Log 1: WebGL Shader Pipeline & Uniform Control Deck/);
      expect(content).toMatch(/## 3\. Atomic Build Log 2: Blinn-Phong Specular Reflection Math & Solar Lighting/);
      expect(content).toMatch(/## 4\. Atomic Build Log 3: Sobel Edge Convolution & Normal Gradient Filter/);
      expect(content).toMatch(/## 5\. Atomic Build Log 4: 3D Spherical Unprojection & Tactical Telemetry Engine/);

      // Verify specific math formulas
      expect(content).toContain('\\mathbf{N} \\cdot \\mathbf{H}');
      expect(content).toMatch(/G_x =/);
      expect(content).toMatch(/G_y =/);
      expect(content).toMatch(/latLonToMGRS/);
    });

    it('2.4 should verify drop-in integration Next.js wrapper and component manifest', () => {
      expect(content).toMatch(/## 6\. Drop-in Integration Guide for `andrewvoirol\.com`/);
      expect(content).toMatch(/RotatingEarth\.tsx/);
      expect(content).toMatch(/ControlDeck\.tsx/);
      expect(content).toMatch(/TacticalOverlay\.tsx/);
      expect(content).toMatch(/TargetVisualizer\.tsx/);
      expect(content).toMatch(/BootSequence\.tsx/);
      expect(content).toMatch(/coordinates\.ts/);
      expect(content).toMatch(/projection\.ts/);
      expect(content).toMatch(/elevation\.ts/);

      // Check that the actual components exist in the repository
      const manifest = [
        'components/RotatingEarth.tsx',
        'components/ControlDeck.tsx',
        'components/TacticalOverlay.tsx',
        'components/TargetVisualizer.tsx',
        'components/BootSequence.tsx',
        'utils/coordinates.ts',
        'utils/projection.ts',
        'utils/elevation.ts',
        'types.ts',
      ];

      for (const item of manifest) {
        expect(fs.existsSync(path.join(rootDir, item))).toBe(true);
      }
    });

    it('2.5 should verify Quality Certification Matrix lists 10 test suites and 137 tests', () => {
      expect(content).toMatch(/## 7\. Quality Certification & Test Verification Matrix/);
      expect(content).toMatch(/10 Test Suites/);
      expect(content).toMatch(/137/);
      expect(content).toMatch(/100% PASS/);
    });
  });
});
