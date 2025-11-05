import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { baseDataDir } from './paths';
import betterSqlite3Package from 'better-sqlite3/package.json';

const isPackaged = Boolean((process as any).pkg);
let cachedNativeBindingPath: string | null = null;
const moduleVersion = process.versions.modules ?? 'unknown';
// In packaged mode, native assets are in the snapshot at /snapshot/pianki/backend/native
const nativeAssetsDir = path.resolve(__dirname, '..', '..', 'native');

export function resolveBetterSqliteNativeBinding(): string | undefined {
  if (!isPackaged) {
    return undefined;
  }

  if (cachedNativeBindingPath) {
    return cachedNativeBindingPath;
  }

  // Extract the native addon to a real filesystem location so pkg can load it.
  const buffer = readBundledBinding();
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

function readBundledBinding(): Buffer {
  const prebuiltBuffer = tryReadFromPrebuiltAssets();
  if (prebuiltBuffer) {
    return prebuiltBuffer;
  }

  const fallbackBuffer = tryReadFromBundledPackage();
  if (fallbackBuffer) {
    return fallbackBuffer;
  }

  const expectedName = buildPrebuiltFileName(process.platform, process.arch);
  throw new Error(
    `Unable to locate the better-sqlite3 native binding inside the packaged bundle. Checked native asset ${expectedName} and bundled package files.`
  );
}

function tryReadFromPrebuiltAssets(): Buffer | null {
  const exactName = buildPrebuiltFileName(process.platform, process.arch);
  const prebuiltFile = path.join(nativeAssetsDir, exactName);

  if (isPackaged) {
    console.log(`[native-binding] Looking for native binding at: ${prebuiltFile}`);
    console.log(`[native-binding] nativeAssetsDir exists: ${fs.existsSync(nativeAssetsDir)}`);
    if (fs.existsSync(nativeAssetsDir)) {
      try {
        const files = fs.readdirSync(nativeAssetsDir);
        console.log(`[native-binding] Files in nativeAssetsDir: ${files.join(', ')}`);
      } catch (e) {
        console.log(`[native-binding] Error reading nativeAssetsDir: ${e}`);
      }
    }
  }

  try {
    const buffer = fs.readFileSync(prebuiltFile);
    return buffer.length > 0 ? buffer : null;
  } catch (error) {
    if (isPackaged) {
      console.log(`[native-binding] Failed to read ${prebuiltFile}: ${error}`);
    }
    const fallback = findFirstPrebuiltWithPrefix(process.platform, process.arch);
    if (!fallback) {
      return null;
    }
    try {
      const buffer = fs.readFileSync(fallback);
      return buffer.length > 0 ? buffer : null;
    } catch {
      return null;
    }
  }
}

function tryReadFromBundledPackage(): Buffer | null {
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
        return buffer;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function buildPrebuiltFileName(platform: NodeJS.Platform, arch: string): string {
  return `better-sqlite3-v${betterSqlite3Package.version}-${platform}-${arch}-node-v${moduleVersion}.node`;
}

function findFirstPrebuiltWithPrefix(platform: NodeJS.Platform, arch: string): string | null {
  try {
    const files = fs.readdirSync(nativeAssetsDir);
    const prefix = `better-sqlite3-v${betterSqlite3Package.version}-${platform}-${arch}-node-v`;
    const candidate = files.find((file) => file.startsWith(prefix) && file.endsWith('.node'));
    if (candidate) {
      return path.join(nativeAssetsDir, candidate);
    }
  } catch {
    // ignore
  }
  return null;
}
