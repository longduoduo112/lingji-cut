import path from 'node:path';

export interface EnsureRemotionDownloadsCwdOptions {
  userDataPath: string;
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
  writeFileSync: (path: string, data: string) => void;
  chdir: (path: string) => void;
}

// Remotion 的 getDownloadsCacheDir 会从 process.cwd() 向上找 package.json，
// 找不到时 fallback 到 `path.resolve(cwd, '.remotion')`。macOS 从 Finder/Dock
// 启动 .app 时 cwd=`/`，结果拿到 `/.remotion` 并在首次下载 chrome-headless-shell
// 时因只读系统卷失败。把 cwd 切到 userData 下的受控目录并放 stub package.json，
// 让 Remotion 把浏览器下载到 `<userData>/remotion-downloads/node_modules/.remotion/`。
export function ensureRemotionDownloadsCwd(
  options: EnsureRemotionDownloadsCwdOptions,
): string {
  const cacheRoot = path.join(options.userDataPath, 'remotion-downloads');

  if (!options.existsSync(cacheRoot)) {
    options.mkdirSync(cacheRoot, { recursive: true });
  }

  const packageJsonPath = path.join(cacheRoot, 'package.json');
  if (!options.existsSync(packageJsonPath)) {
    const manifest = {
      name: 'lingji-remotion-cache',
      version: '0.0.0',
      private: true,
    };
    options.writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const nodeModulesDir = path.join(cacheRoot, 'node_modules');
  if (!options.existsSync(nodeModulesDir)) {
    options.mkdirSync(nodeModulesDir, { recursive: true });
  }

  options.chdir(cacheRoot);
  return cacheRoot;
}

export interface ResolveRemotionBinariesDirectoryOptions {
  appPath: string;
  cwd: string;
  moduleDir: string;
  platform: NodeJS.Platform;
  arch: string;
  existsSync: (path: string) => boolean;
}

export function getRemotionPackageCandidates(
  platform: NodeJS.Platform,
  arch: string,
): string[] {
  switch (platform) {
    case 'darwin':
      if (arch === 'arm64') {
        return ['@remotion/compositor-darwin-arm64'];
      }

      if (arch === 'x64') {
        return ['@remotion/compositor-darwin-x64'];
      }

      return [];
    case 'win32':
      if (arch === 'x64') {
        return ['@remotion/compositor-win32-x64-msvc'];
      }

      return [];
    case 'linux':
      if (arch === 'arm64') {
        return [
          '@remotion/compositor-linux-arm64-gnu',
          '@remotion/compositor-linux-arm64-musl',
        ];
      }

      if (arch === 'x64') {
        return [
          '@remotion/compositor-linux-x64-gnu',
          '@remotion/compositor-linux-x64-musl',
        ];
      }

      return [];
    default:
      return [];
  }
}

function getRemotionExecutableName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'remotion.exe' : 'remotion';
}

export function resolveRemotionBinariesDirectory({
  appPath,
  cwd,
  moduleDir,
  platform,
  arch,
  existsSync,
}: ResolveRemotionBinariesDirectoryOptions): string | null {
  const packageNames = getRemotionPackageCandidates(platform, arch);
  if (packageNames.length === 0) {
    return null;
  }

  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const executableName = getRemotionExecutableName(platform);
  const asarUnpackedPath = appPath.endsWith('.asar') ? `${appPath}.unpacked` : null;
  const rootCandidates = [
    asarUnpackedPath,
    appPath,
    pathApi.resolve(moduleDir, '..'),
    cwd,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  const uniqueRootCandidates = [...new Set(rootCandidates)];

  for (const rootCandidate of uniqueRootCandidates) {
    for (const packageName of packageNames) {
      const packageDir = pathApi.resolve(rootCandidate, 'node_modules', packageName);
      const executablePath = pathApi.join(packageDir, executableName);
      if (existsSync(executablePath)) {
        return packageDir;
      }
    }
  }

  return null;
}
