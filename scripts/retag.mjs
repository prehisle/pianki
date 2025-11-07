#!/usr/bin/env node
import { execSync } from 'child_process';

const tag = process.argv[2];
if (!tag) {
  console.error('Usage: npm run retag -- <tag>');
  process.exit(1);
}

const run = (cmd, ignoreError = false) => {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    if (!ignoreError) throw err;
  }
};

run(`git push origin :refs/tags/${tag}`, true);
run(`git tag -d ${tag}`, true);
run(`git tag ${tag}`);
run(`git push origin ${tag}`);
