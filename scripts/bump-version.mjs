#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const newVersion = process.argv[2];

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

if (currentVersion === newVersion) {
  console.log(`Version is already ${newVersion}, nothing to change.`);
  process.exit(0);
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
  if (!text.includes(currentVersion)) {
    console.warn(`[bump-version] Skipped ${file} (no "${currentVersion}" found)`);
    return;
  }
  const updated = text.split(currentVersion).join(newVersion);
  writeFileSync(filePath, updated);
  console.log(`[bump-version] Updated ${file}`);
};

filesToUpdate.forEach(replaceVersion);

console.log(`Version files updated from ${currentVersion} to ${newVersion}. Now run "npm version ${newVersion} --no-git-tag-version".`);
