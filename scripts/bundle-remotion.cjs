const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { bundle } = require('@remotion/bundler');

const rootDir = path.resolve(__dirname, '..');
const entryPoint = path.join(rootDir, 'src', 'remotion', 'index.ts');
const outDir = path.join(rootDir, 'dist-remotion');

async function main() {
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`Remotion 入口文件不存在：${path.relative(rootDir, entryPoint)}`);
  }

  await fsp.rm(outDir, { recursive: true, force: true });
  await fsp.mkdir(outDir, { recursive: true });

  console.log('[bundle-remotion] 预打包 Remotion composition …');

  let lastReported = -1;
  const serveUrl = await bundle({
    entryPoint,
    outDir,
    onProgress: (progress) => {
      const pct = Math.round(progress);
      if (pct !== lastReported && pct % 10 === 0) {
        lastReported = pct;
        process.stdout.write(`[bundle-remotion] ${pct}%\n`);
      }
    },
  });

  console.log(`[bundle-remotion] 预打包完成：${path.relative(rootDir, serveUrl)}`);
}

main().catch((error) => {
  console.error('[bundle-remotion] 预打包失败');
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
