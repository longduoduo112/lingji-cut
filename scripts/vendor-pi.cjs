#!/usr/bin/env node
'use strict';

/**
 * vendor-pi.cjs
 *
 * 将固定版本的 pi agent CLI（@earendil-works/pi-coding-agent）vendoring 到
 * resources/pi/，使应用可以用 Electron 自带 Node（ELECTRON_RUN_AS_NODE=1）
 * 直接跑 resources/pi/dist/cli.js，无需用户本机安装。
 *
 * 产物布局（self-contained，hoisted）：
 *   resources/pi/dist/cli.js          <- pi 入口
 *   resources/pi/package.json         <- pi 包元数据（含 version）
 *   resources/pi/node_modules/...     <- 完整 hoisted 依赖树
 *
 * 幂等：若 resources/pi/dist/cli.js 存在且 resources/pi/package.json 的 version
 * 等于 PI_VERSION，则直接跳过（可安全作为 dev/build 前置）。传 --force 强制重做。
 *
 * 注意：vendoring 出来的字节不入 git（见 .gitignore），由本脚本在需要时生成。
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const PI_VERSION = '0.79.1';
const PI_PACKAGE = '@earendil-works/pi-coding-agent';

const rootDir = path.resolve(__dirname, '..');
const resourcesDir = path.join(rootDir, 'resources');
const targetDir = path.join(resourcesDir, 'pi');
const cliEntry = path.join(targetDir, 'dist', 'cli.js');
const targetPackageJson = path.join(targetDir, 'package.json');

const force = process.argv.includes('--force');

function readVendoredVersion() {
  try {
    const raw = fs.readFileSync(targetPackageJson, 'utf8');
    return JSON.parse(raw).version;
  } catch {
    return undefined;
  }
}

function alreadyVendored() {
  if (!fs.existsSync(cliEntry)) return false;
  return readVendoredVersion() === PI_VERSION;
}

function npmCommand() {
  // Windows 上 spawn 必须用 npm.cmd，否则 ENOENT。
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function installToTemp(tmpDir) {
  console.log(`[vendor-pi] installing ${PI_PACKAGE}@${PI_VERSION} into ${tmpDir} ...`);
  const result = spawnSync(
    npmCommand(),
    [
      'install',
      `${PI_PACKAGE}@${PI_VERSION}`,
      '--prefix',
      tmpDir,
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
    ],
    { cwd: rootDir, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    throw new Error(`npm install failed with exit code ${result.status ?? 'unknown'}`);
  }
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: false });
}

function pruneSourceMaps(dir) {
  let removed = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.map')) {
        try {
          fs.rmSync(full);
          removed += 1;
        } catch {
          /* ignore */
        }
      }
    }
  }
  return removed;
}

function duSize(dir) {
  try {
    if (process.platform === 'win32') return '(skip du on win32)';
    return execFileSync('du', ['-sh', dir], { encoding: 'utf8' }).trim();
  } catch {
    return '(du unavailable)';
  }
}

function main() {
  if (!force && alreadyVendored()) {
    console.log(`pi already vendored (${PI_VERSION})`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vendor-pi-'));
  try {
    installToTemp(tmpDir);

    const tmpNodeModules = path.join(tmpDir, 'node_modules');
    const tmpPackage = path.join(tmpNodeModules, PI_PACKAGE);
    if (!fs.existsSync(path.join(tmpPackage, 'dist', 'cli.js'))) {
      throw new Error(`installed package missing dist/cli.js at ${tmpPackage}`);
    }

    // 重新生成 resources/pi。
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    // 1) pi 包自身的文件（dist/package.json/docs/...）落到 resources/pi 根。
    //    其自带的 nested node_modules（若有，无法被 hoist 的部分）一并带过来。
    for (const entry of fs.readdirSync(tmpPackage, { withFileTypes: true })) {
      copyDir(path.join(tmpPackage, entry.name), path.join(targetDir, entry.name));
    }

    // 2) hoisted 依赖树整体落到 resources/pi/node_modules，与第 1 步的
    //    nested node_modules 合并；冲突时以已存在的 nested 为准（不覆盖）。
    const targetNodeModules = path.join(targetDir, 'node_modules');
    fs.mkdirSync(targetNodeModules, { recursive: true });
    for (const entry of fs.readdirSync(tmpNodeModules, { withFileTypes: true })) {
      const dest = path.join(targetNodeModules, entry.name);
      const src = path.join(tmpNodeModules, entry.name);
      if (entry.name.startsWith('@')) {
        // scope 目录：逐包合并，避免覆盖已存在的 nested 包（含 pi 自身）。
        fs.mkdirSync(dest, { recursive: true });
        for (const scoped of fs.readdirSync(src, { withFileTypes: true })) {
          const scopedDest = path.join(dest, scoped.name);
          if (fs.existsSync(scopedDest)) continue;
          copyDir(path.join(src, scoped.name), scopedDest);
        }
      } else {
        if (fs.existsSync(dest)) continue;
        copyDir(src, dest);
      }
    }

    const removedMaps = pruneSourceMaps(targetDir);
    console.log(`[vendor-pi] pruned ${removedMaps} .map file(s)`);

    if (!fs.existsSync(cliEntry)) {
      throw new Error(`vendoring produced no ${cliEntry}`);
    }
    if (readVendoredVersion() !== PI_VERSION) {
      throw new Error(
        `vendored version mismatch: expected ${PI_VERSION}, got ${readVendoredVersion()}`
      );
    }

    const size = duSize(targetDir);
    console.log(`[vendor-pi] done: ${PI_PACKAGE}@${PI_VERSION} -> ${targetDir}`);
    console.log(`[vendor-pi] size: ${size}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error('[vendor-pi] FAILED:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
