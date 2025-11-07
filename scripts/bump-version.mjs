#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const newVersion = process.argv[2];
const providedPrevious = process.argv[3];

if (!newVersion) {
  console.error('Usage: npm run bump -- <new-version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version "${newVersion}". Expected format: x.y.z`);
  process.exit(1);
}

const pkgPath = resolve('package.json');
const rootPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const currentVersion = rootPkg.version;
const previousVersion = providedPrevious || currentVersion;

if (previousVersion === newVersion) {
  console.error(
    `Previous version "${previousVersion}" equals new version "${newVersion}". ` +
      'If you already ran "npm version", pass the old version as the second argument.'
  );
  process.exit(1);
}

const filesToUpdate = [
  'package.json',
  'package-lock.json',
  'frontend/package.json',
  'backend/package.json',
  'frontend/src/App.tsx',
  'src-tauri/tauri.conf.json',
  'README.md',
  'TAURI_SETUP.md',
  '使用指南.md'
];

const replaceVersion = (file) => {
  const filePath = resolve(file);
  const text = readFileSync(filePath, 'utf8');
  if (!text.includes(previousVersion)) {
    console.warn(`[bump-version] Skipped ${file} (no "${previousVersion}" found)`);
    return;
  }
  const updated = text.split(previousVersion).join(newVersion);
  writeFileSync(filePath, updated);
  console.log(`[bump-version] Updated ${file}`);
};

filesToUpdate.forEach(replaceVersion);

console.log(`Version files updated from ${previousVersion} to ${newVersion}.`);
