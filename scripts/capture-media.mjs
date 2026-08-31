import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'screenshots');
const DELIVERABLES_DIR = path.join(ROOT_DIR, 'deliverables');
const TEMP_DIR = path.join(ROOT_DIR, '.temp_capture');

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(DELIVERABLES_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode === 200) resolve();
          else reject(new Error(`Status: ${res.statusCode}`));
        });
        req.on('error', reject);
      });
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function selectPalette(page, name) {
  const btn = page.locator(`.grid button:has-text("${name}")`);
  if (await btn.count() > 0) {
    await btn.first().click();
  } else {
    await page.locator(`button:has-text("${name}")`).last().click();
  }
}

async function captureHeroScreenshots(page) {
  console.log('\n=== CAPTURING 4 HERO SCREENSHOTS ===');

  // 1. Night Radar Screenshot
  console.log('1/4 Capturing Night Radar hero (screenshots/night-mode.png)...');
  await selectPalette(page, 'Night Radar');
  await page.waitForTimeout(1000);
  const nightHeroPath = path.join(SCREENSHOTS_DIR, 'night-mode.png');
  await page.screenshot({ path: nightHeroPath });
  console.log(`Saved ${nightHeroPath} (${fs.statSync(nightHeroPath).size} bytes)`);

  // 2. Day Satellite Screenshot
  console.log('2/4 Capturing Day Satellite hero (screenshots/day-specular.png)...');
  await selectPalette(page, 'Day Satellite');
  await page.waitForTimeout(1000);
  const dayHeroPath = path.join(SCREENSHOTS_DIR, 'day-specular.png');
  await page.screenshot({ path: dayHeroPath });
  console.log(`Saved ${dayHeroPath} (${fs.statSync(dayHeroPath).size} bytes)`);

  // 3. Target HUD Telemetry Screenshot
  console.log('3/4 Capturing Target Visualizer HUD hero (screenshots/target-hud.png)...');
  await selectPalette(page, 'Cyber Cyan');
  await page.waitForTimeout(600);
  // Drop target pin by clicking on globe
  await page.mouse.click(960, 480);
  await page.waitForTimeout(1500);
  const targetHeroPath = path.join(SCREENSHOTS_DIR, 'target-hud.png');
  await page.screenshot({ path: targetHeroPath });
  console.log(`Saved ${targetHeroPath} (${fs.statSync(targetHeroPath).size} bytes)`);

  // 4. Palette Matrix Composite Screenshot (2x2)
  console.log('4/4 Capturing individual palettes for 2x2 matrix...');
  const pTempDir = path.join(TEMP_DIR, 'palettes');
  fs.mkdirSync(pTempDir, { recursive: true });

  // Clear target pin for clean matrix
  const clearBtn = page.locator('button[title="Clear selected target"]');
  if (await clearBtn.count() > 0) {
    await clearBtn.click();
    await page.waitForTimeout(400);
  }

  // Palette 1: Night Radar
  await selectPalette(page, 'Night Radar');
  await page.waitForTimeout(600);
  const p1 = path.join(pTempDir, 'p1_night.png');
  await page.screenshot({ path: p1 });

  // Palette 2: Day Satellite
  await selectPalette(page, 'Day Satellite');
  await page.waitForTimeout(600);
  const p2 = path.join(pTempDir, 'p2_day.png');
  await page.screenshot({ path: p2 });

  // Palette 3: Cyber Cyan
  await selectPalette(page, 'Cyber Cyan');
  await page.waitForTimeout(600);
  const p3 = path.join(pTempDir, 'p3_cyan.png');
  await page.screenshot({ path: p3 });

  // Palette 4: Holographic Gold
  await selectPalette(page, 'Holographic Gold');
  await page.waitForTimeout(600);
  const p4 = path.join(pTempDir, 'p4_gold.png');
  await page.screenshot({ path: p4 });

  const matrixPath = path.join(SCREENSHOTS_DIR, 'palette-matrix.png');
  console.log('Assembling 2x2 palette matrix via FFmpeg...');
  execSync(
    `ffmpeg -y -i "${p1}" -i "${p2}" -i "${p3}" -i "${p4}" ` +
    `-filter_complex "[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[2:v]scale=960:540[v2];[3:v]scale=960:540[v3];[v0][v1]hstack=inputs=2[top];[v2][v3]hstack=inputs=2[bottom];[top][bottom]vstack=inputs=2[out]" ` +
    `-map "[out]" -frames:v 1 "${matrixPath}"`,
    { stdio: 'inherit' }
  );
  console.log(`Saved ${matrixPath} (${fs.statSync(matrixPath).size} bytes)`);
}

async function captureShowcaseVideo(page) {
  console.log('\n=== CAPTURING 60FPS SHOWCASE VIDEO (deliverables/demo.mp4) ===');
  const videoFramesDir = path.join(TEMP_DIR, 'video_frames');
  fs.mkdirSync(videoFramesDir, { recursive: true });

  // Clean old frames
  fs.readdirSync(videoFramesDir).forEach(f => fs.unlinkSync(path.join(videoFramesDir, f)));

  // Clear target pin if selected
  const clearBtn = page.locator('button[title="Clear selected target"]');
  if (await clearBtn.count() > 0) {
    await clearBtn.click();
    await page.waitForTimeout(300);
  }

  console.log('Starting frame capture sequence (480 frames @ 60fps)...');
  await selectPalette(page, 'Cyber Cyan');
  await page.waitForTimeout(300);

  const totalFrames = 480;
  for (let frame = 0; frame < totalFrames; frame++) {
    // Segment 2: Scrub solar angle from frame 120 to 240
    if (frame === 120) {
      console.log('  [Frame 120] Beginning Solar Azimuth Specular Glide...');
    }
    if (frame >= 120 && frame < 240) {
      const progress = (frame - 120) / 120;
      const angle = 45 + progress * 180;
      await page.evaluate((a) => {
        const slider = document.querySelector('#slider-solar-angle');
        if (slider) {
          slider.value = a;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, angle);
    }

    // Segment 3: Palette switches
    if (frame === 240) {
      console.log('  [Frame 240] Palette Switch: Night Radar...');
      await selectPalette(page, 'Night Radar');
    }
    if (frame === 280) {
      console.log('  [Frame 280] Palette Switch: Day Satellite...');
      await selectPalette(page, 'Day Satellite');
    }
    if (frame === 320) {
      console.log('  [Frame 320] Palette Switch: Holographic Gold...');
      await selectPalette(page, 'Holographic Gold');
    }

    // Segment 4: Target Lock Drop
    if (frame === 360) {
      console.log('  [Frame 360] Target Pinning: Dropping Target Reticle...');
      await selectPalette(page, 'Cyber Cyan');
      await page.mouse.click(960, 520);
    }

    const frameFile = path.join(videoFramesDir, `frame_${String(frame).padStart(4, '0')}.png`);
    await page.screenshot({ path: frameFile });

    if (frame % 60 === 0) {
      console.log(`  Captured ${frame}/${totalFrames} frames (${(frame / 60).toFixed(1)}s)...`);
    }

    await page.waitForTimeout(16);
  }

  const mp4Path = path.join(DELIVERABLES_DIR, 'demo.mp4');
  console.log('Encoding 60fps MP4 showcase video with FFmpeg libx264...');
  execSync(
    `ffmpeg -y -framerate 60 -i "${videoFramesDir}/frame_%04d.png" ` +
    `-c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium "${mp4Path}"`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(mp4Path);
  console.log(`Generated ${mp4Path} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
}

async function captureAnimatedWebP(page) {
  console.log('\n=== CAPTURING ANIMATED WEBP (screenshots/demo.webp) ===');
  const webpFramesDir = path.join(TEMP_DIR, 'webp_frames');
  fs.mkdirSync(webpFramesDir, { recursive: true });

  // Clean old frames
  fs.readdirSync(webpFramesDir).forEach(f => fs.unlinkSync(path.join(webpFramesDir, f)));

  // Clear target pin if present
  const clearBtn = page.locator('button[title="Clear selected target"]');
  if (await clearBtn.count() > 0) {
    await clearBtn.click();
    await page.waitForTimeout(300);
  }

  // 120 frames at 16fps = 7.5 second high-impact loop
  const totalFrames = 120;
  console.log(`Capturing ${totalFrames} frames for smooth WebP loop...`);

  await selectPalette(page, 'Cyber Cyan');
  await page.waitForTimeout(300);

  for (let frame = 0; frame < totalFrames; frame++) {
    if (frame === 30) {
      await selectPalette(page, 'Night Radar');
    }
    if (frame === 60) {
      await selectPalette(page, 'Day Satellite');
    }
    if (frame === 90) {
      await selectPalette(page, 'Cyber Cyan');
      await page.mouse.click(960, 490);
    }

    const frameFile = path.join(webpFramesDir, `frame_${String(frame).padStart(4, '0')}.png`);
    await page.screenshot({ path: frameFile });

    if (frame % 30 === 0) {
      console.log(`  WebP Frame ${frame}/${totalFrames}...`);
    }
    await page.waitForTimeout(40);
  }

  const webpPath = path.join(SCREENSHOTS_DIR, 'demo.webp');
  console.log('Encoding Animated WebP with FFmpeg (<5MB constraint)...');
  // Scale to 960px width, 16fps, high quality lossy webp
  execSync(
    `ffmpeg -y -framerate 16 -i "${webpFramesDir}/frame_%04d.png" ` +
    `-vf "scale=960:-1:flags=lanczos" -vcodec libwebp -lossless 0 -q:v 72 -loop 0 -an -vsync 0 "${webpPath}"`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(webpPath);
  console.log(`Generated ${webpPath} (${(stats.size / (1024 * 1024)).toFixed(2)} MB, limit: 5.00 MB)`);
}

async function main() {
  console.log('Building app for production...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('Starting preview server on port 3000...');
  const server = spawn('npx', ['vite', 'preview', '--port', '3000', '--host', '127.0.0.1'], {
    stdio: 'pipe',
    shell: true,
  });

  try {
    await waitForServer('http://127.0.0.1:3000');
    console.log('Preview server ready.');

    console.log('Launching Playwright Chromium with SwiftShader WebGL...');
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    console.log('Navigating to http://127.0.0.1:3000...');
    await page.goto('http://127.0.0.1:3000');

    // Wait for boot sequence and 250k point generation
    console.log('Waiting for boot sequence & WebGL globe initialization...');
    await page.waitForTimeout(7000);

    // 1. Hero Screenshots
    await captureHeroScreenshots(page);

    // 2. Showcase Video (60fps MP4)
    await captureShowcaseVideo(page);

    // 3. Animated WebP (Hero Demo)
    await captureAnimatedWebP(page);

    await browser.close();

    console.log('\n=== CLEANING UP TEMPORARY ASSETS ===');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('Capture pipeline complete!\n');

  } finally {
    server.kill();
  }
}

main().catch(err => {
  console.error('Fatal error during media capture:', err);
  process.exit(1);
});
