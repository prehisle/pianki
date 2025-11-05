import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { baseDataDir } from './paths';
import betterSqlite3Package from 'better-sqlite3/package.json';

const isPackaged = Boolean((process as any).pkg);
let cachedNativeBindingPath: string | null = null;
const moduleVersion = process.versions.modules ?? 'unknown';

export function resolveBetterSqliteNativeBinding(): string | undefined {
  if (!isPackaged) {
    return undefined;
  }

  if (cachedNativeBindingPath) {
    return cachedNativeBindingPath;
  }

  // Extract the native addon to a real filesystem location so pkg can load it.
  const { buffer } = readBundledBinding();
  const bindingHash = crypto.createHash('sha1').update(buffer).digest('hex');
  const bindingFileName = [
    'better-sqlite3',
    betterSqlite3Package.version,
    process.platform,
    process.arch,
    `node-v${moduleVersion}`,
    bindingHash.slice(0, 8)
  ].join('-');

  const nativeDir = path.join(baseDataDir, 'native');
  if (!fs.existsSync(nativeDir)) {
    fs.mkdirSync(nativeDir, { recursive: true });
  }

  const targetPath = path.join(nativeDir, `${bindingFileName}.node`);
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).size !== buffer.length) {
    fs.writeFileSync(targetPath, buffer);
  }

  cachedNativeBindingPath = targetPath;
  return cachedNativeBindingPath;
}

function readBundledBinding(): { buffer: Buffer } {
  const packageDir = path.dirname(require.resolve('better-sqlite3/package.json'));
  const candidatePaths = [
    path.join(packageDir, 'build', 'Release', 'better_sqlite3.node'),
    path.join(packageDir, 'build', 'better_sqlite3.node'),
    path.join(packageDir, 'compiled', moduleVersion, process.platform, process.arch, 'better_sqlite3.node')
  ];

  for (const candidate of candidatePaths) {
    try {
      const buffer = fs.readFileSync(candidate);
      if (buffer.length > 0) {
        return { buffer };
      }
    } catch {
      continue;
    }
  }

  throw new Error('Unable to locate the better-sqlite3 native binding inside the packaged bundle.');
}
