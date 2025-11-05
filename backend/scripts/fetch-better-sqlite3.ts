import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import nodeAbi from 'node-abi';
import betterSqlite3Package from 'better-sqlite3/package.json';

type TargetSpec = {
  platform: NodeJS.Platform;
  arch: 'x64' | 'arm64';
};

const DEFAULT_NODE_VERSION = '20.11.0';
const backendRoot = path.resolve(__dirname, '..');
const betterSqlitePackageDir = path.dirname(
  require.resolve('better-sqlite3/package.json', { paths: [backendRoot] })
);
const prebuildInstallBin = require.resolve('prebuild-install/bin.js', { paths: [backendRoot] });
const downloadedBinaryPath = path.join(betterSqlitePackageDir, 'build', 'Release', 'better_sqlite3.node');
const nativeOutputDir = path.join(backendRoot, 'native');

const requestedNodeVersion = process.env.BETTER_SQLITE3_NODE_VERSION || DEFAULT_NODE_VERSION;
const targetAbi =
  process.env.BETTER_SQLITE3_NODE_ABI || nodeAbi.getAbi(requestedNodeVersion, 'node').toString();
const forceDownload = process.argv.includes('--force');

const targets: TargetSpec[] = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'win32', arch: 'x64' }
];

function log(message: string) {
  process.stdout.write(`${message}\n`);
}

function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function outputFileName(target: TargetSpec): string {
  return `better-sqlite3-v${betterSqlite3Package.version}-${target.platform}-${target.arch}-node-v${targetAbi}.node`;
}

function fetchTargetBinary(target: TargetSpec) {
  const destinationPath = path.join(nativeOutputDir, outputFileName(target));

  if (!forceDownload && fs.existsSync(destinationPath)) {
    log(`skip  • ${path.relative(backendRoot, destinationPath)} 已存在，跳过下载`);
    return;
  }

  log(`fetch • 下载 ${target.platform}/${target.arch} (Node ${requestedNodeVersion}, ABI ${targetAbi})`);

  const result = spawnSync(
    process.execPath,
    [prebuildInstallBin, `--platform=${target.platform}`, `--arch=${target.arch}`, `--target=${requestedNodeVersion}`],
    {
      cwd: betterSqlitePackageDir,
      stdio: 'inherit'
    }
  );

  if (result.status !== 0) {
    throw new Error(`prebuild-install failed for ${target.platform}/${target.arch}`);
  }

  if (!fs.existsSync(downloadedBinaryPath)) {
    throw new Error(`Downloaded binary not found at ${downloadedBinaryPath}`);
  }

  ensureDirectory(nativeOutputDir);
  fs.copyFileSync(downloadedBinaryPath, destinationPath);
  log(`done  • 已保存 ${path.relative(backendRoot, destinationPath)}`);
}

targets.forEach(fetchTargetBinary);
