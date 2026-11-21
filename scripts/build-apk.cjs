#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';
const androidDir = path.resolve(__dirname, '..', 'android');

if (!fs.existsSync(androidDir)) {
  console.error('Error: android directory not found at', androidDir);
  process.exit(1);
}

console.log(`[SiteSaathi] Building Android APK using ${gradlewCmd} in ${androidDir}...`);

const result = spawnSync(gradlewCmd, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error('[SiteSaathi] Build failed:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
