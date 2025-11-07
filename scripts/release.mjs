#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: npm run release -- <new-version>');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error(`Invalid version "${newVersion}". Expected format: x.y.z`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const previousVersion = pkg.version;

if (previousVersion === newVersion) {
  console.error(`Current version is already ${newVersion}. Choose a higher number.`);
  process.exit(1);
}

const gitStatus = execSync('git status --porcelain').toString().trim();
if (gitStatus) {
  console.error('Working tree is not clean. Please commit or stash changes before releasing.');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run(`npm version ${newVersion} --no-git-tag-version`);
run(`node scripts/bump-version.mjs ${newVersion} ${previousVersion}`);
run('git add -A');
run(`git commit -m "chore: release v${newVersion}"`);
run('git push');
run(`node scripts/retag.mjs v${newVersion}`);

console.log(`Release ${newVersion} complete.`);
