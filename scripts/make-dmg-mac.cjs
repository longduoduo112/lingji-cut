const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createDMG } = require('electron-installer-dmg');

const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

const appName = packageJson.productName || packageJson.name;
const version = packageJson.version;
const releaseDir = path.join(rootDir, 'release');
const iconPath = path.join(rootDir, 'build', 'icon.icns');

const supportedArch = new Set(['arm64', 'x64']);
const arch = process.env.ARCH || process.arch;

if (!supportedArch.has(arch)) {
  console.error(`不支持的 macOS DMG 打包架构：${arch}`);
  console.error('请使用 ARCH=arm64 npm run dmg:mac 或 ARCH=x64 npm run dmg:mac');
  process.exit(1);
}

const appDir = path.join(releaseDir, `${appName}-darwin-${arch}`);
const appPath = path.join(appDir, `${appName}.app`);

if (!fs.existsSync(appPath)) {
  console.error(`未找到已打包的 .app：${path.relative(rootDir, appPath)}`);
  console.error('请先运行 npm run package:mac 或 npm run dist:mac');
  process.exit(1);
}

async function main() {
  const dmgName = `${appName}-${version}-${arch}`;
  const dmgPath = path.join(releaseDir, `${dmgName}.dmg`);

  // electron-installer-dmg 不会覆盖已有 .dmg，先清掉避免报错
  await fsp.rm(dmgPath, { force: true });

  console.log(`开始打包 DMG：${appName} ${version} (${arch})`);

  await createDMG({
    appPath,
    name: dmgName,
    out: releaseDir,
    overwrite: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    // 默认布局：.app 图标 + Applications 快捷方式，用户拖拽安装
  });

  console.log(`DMG 打包完成：${path.relative(rootDir, dmgPath)}`);
}

main().catch((error) => {
  console.error('macOS DMG 打包失败');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
