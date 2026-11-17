// Shared headless-Chromium launcher for the test/screenshot scripts.
// Uses the machine's GPU through ANGLE/EGL when there is one; SWIFT=1 forces software rendering.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';

export async function launch({ width = +(process.env.W || 1600), height = +(process.env.H || 900) } = {}) {
  const dir = homedir() + '/.cache/ms-playwright/';
  const ver = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const gpu = process.env.SWIFT ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-gl=angle', '--use-angle=gl-egl', '--enable-gpu'];
  const browser = await chromium.launch({ executablePath: `${dir}${ver}/chrome-linux64/chrome`, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--mute-audio', '--autoplay-policy=no-user-gesture-required', ...gpu] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.setDefaultTimeout(240000);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); console.log('[error]', m.text().slice(0, 400)); } });
  page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message.slice(0, 600), (e.stack || '').split('\n').slice(1, 4).join(' | ')); });
  return { browser, page, errors };
}
