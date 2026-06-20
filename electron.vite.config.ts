import { defineConfig } from 'electron-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      lib: {
        entry: resolve('electron/main.ts'),
        formats: ['cjs'],
        fileName: () => 'main.js',
      },
      rollupOptions: {
        // @earendil-works/pi-coding-agent 是 ESM-only，且运行时会读取自身包目录下的
        // docs/skills 等资源，必须保持 external（由 dynamic import() 在运行时从
        // node_modules 解析），不能打包进 main.js。
        external: ['zod', /^@earendil-works\//],
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      lib: {
        entry: resolve('electron/preload.ts'),
        formats: ['cjs'],
        fileName: () => 'preload.js',
      },
    },
  },
  renderer: {
    root: '.',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: resolve('index.html'),
      },
    },
  },
});
