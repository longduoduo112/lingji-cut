import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { AssetItem, AssetType, OverlayItem, SrtEntry, TimelineData } from '../types';
import { DEFAULT_VISUAL_TRACK_ID, createDefaultTimeline } from '../types';
import type { AICardOverlayData } from '../types/ai';
import { getFileNameFromPath } from '../lib/utils';
import { getNextVisualTrack, normalizeTimelineData } from '../lib/timeline-tracks';

type OverlayDraft = Omit<OverlayItem, 'id'>;
type TimelineSnapshot = TimelineData;

export interface RecentProject {
  path: string;
  name: string;
  lastOpenedAt: number;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface TimelineStore {
  timeline: TimelineData;
  srtEntries: SrtEntry[];
  assets: AssetItem[];
  canUndo: boolean;
  canRedo: boolean;
  setTimeline: (timeline: TimelineData) => void;
  setSrtEntries: (entries: SrtEntry[]) => void;
  setPodcast: (audioPath: string, srtPath: string, durationMs: number) => void;
  addAsset: (path: string, type: 'video' | 'image', durationMs?: number) => void;
  removeAsset: (path: string) => void;
  addTrack: () => string;
  addOverlay: (overlay: OverlayDraft) => string;
  addAICardsToTimeline: (cards: Array<{
    sourceCardId: string;
    startMs: number;
    durationMs: number;
    aiCardData: AICardOverlayData;
  }>) => void;
  updateOverlay: (id: string, updates: Partial<OverlayItem>) => void;
  removeOverlay: (id: string) => void;
  undo: () => void;
  redo: () => void;
  historyPast: TimelineSnapshot[];
  historyFuture: TimelineSnapshot[];
}

const PROJECT_DIR_KEY = 'podcast-editor-project-dir';
const RECENT_PROJECTS_KEY = 'podcast-editor-recent-projects';
const MAX_TIMELINE_HISTORY = 40;
let currentSaveStatus: SaveStatus = 'idle';
const saveStatusListeners = new Set<(status: SaveStatus) => void>();

const buildAsset = (
  path: string,
  type: AssetType,
  durationMs = type === 'image' ? 5000 : 10000,
  locked = false,
): AssetItem => ({
  path,
  type,
  name: getFileNameFromPath(path),
  durationMs,
  ...(locked ? { locked: true } : {}),
});

const dedupeAssets = (assets: AssetItem[]): AssetItem[] => {
  const assetMap = new Map<string, AssetItem>();

  for (const asset of assets) {
    assetMap.set(asset.path, asset);
  }

  return [...assetMap.values()];
};

function isMediaOverlay(overlay: OverlayItem): boolean {
  return overlay.overlayType !== 'ai-card' && Boolean(overlay.assetPath);
}

const buildPodcastAssets = (timeline: TimelineData): AssetItem[] => {
  const assets: AssetItem[] = [];

  if (timeline.podcast.audioPath) {
    assets.push(buildAsset(timeline.podcast.audioPath, 'audio', timeline.podcast.durationMs, true));
  }

  if (timeline.podcast.srtPath) {
    assets.push(buildAsset(timeline.podcast.srtPath, 'srt', timeline.podcast.durationMs, true));
  }

  return assets;
};

const deriveAssetsFromTimeline = (timeline: TimelineData): AssetItem[] => {
  return dedupeAssets(
    [
      ...buildPodcastAssets(timeline),
      ...timeline.overlays.filter(isMediaOverlay).map((overlay) =>
        buildAsset(overlay.assetPath, overlay.type, overlay.durationMs),
      ),
    ],
  );
};

const syncAssetsWithTimeline = (assets: AssetItem[], timeline: TimelineData): AssetItem[] => {
  const persistentAssets = assets.filter(
    (asset) =>
      !asset.locked &&
      asset.path !== timeline.podcast.audioPath &&
      asset.path !== timeline.podcast.srtPath &&
      !timeline.overlays.some((overlay) => isMediaOverlay(overlay) && overlay.assetPath === asset.path),
  );

  return dedupeAssets([...persistentAssets, ...deriveAssetsFromTimeline(timeline)]);
};

const cloneTimeline = (timeline: TimelineData): TimelineData =>
  JSON.parse(JSON.stringify(timeline)) as TimelineData;

const normalizeTimeline = (timeline: TimelineData): TimelineData =>
  normalizeTimelineData(cloneTimeline(timeline));

const pushHistorySnapshot = (
  past: TimelineSnapshot[],
  timeline: TimelineData,
): TimelineSnapshot[] => [...past.slice(-(MAX_TIMELINE_HISTORY - 1)), cloneTimeline(timeline)];

function emitSaveStatus(status: SaveStatus): void {
  currentSaveStatus = status;
  for (const listener of saveStatusListeners) {
    listener(status);
  }
}

function getStorageItem(key: string): string {
  if (!hasBrowserStorage()) {
    return '';
  }

  return window.localStorage.getItem(key) || '';
}

function setStorageItem(key: string, value: string): void {
  if (!hasBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(key, value);
}

function removeStorageItem(key: string): void {
  if (!hasBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(key);
}

function persistRecentProjects(projects: RecentProject[]): void {
  setStorageItem(RECENT_PROJECTS_KEY, JSON.stringify(projects));
}

export function getCurrentSaveStatus(): SaveStatus {
  return currentSaveStatus;
}

export function subscribeToSaveStatus(listener: (status: SaveStatus) => void): () => void {
  saveStatusListeners.add(listener);
  listener(currentSaveStatus);
  return () => {
    saveStatusListeners.delete(listener);
  };
}

export const useTimelineStore = create<TimelineStore>((set) => ({
  timeline: createDefaultTimeline(),
  srtEntries: [],
  assets: [],
  canUndo: false,
  canRedo: false,
  historyPast: [],
  historyFuture: [],
  setTimeline: (timeline) =>
    set(() => {
      const normalizedTimeline = normalizeTimeline(timeline);

      return {
        timeline: normalizedTimeline,
        assets: syncAssetsWithTimeline([], normalizedTimeline),
        historyPast: [],
        historyFuture: [],
        canUndo: false,
        canRedo: false,
      };
    }),
  setSrtEntries: (entries) => set({ srtEntries: entries }),
  setPodcast: (audioPath, srtPath, durationMs) =>
    set((state) => {
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        podcast: {
          audioPath,
          srtPath,
          durationMs,
        },
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    }),
  addAsset: (path, type, durationMs) =>
    set((state) => ({
      assets: dedupeAssets([...state.assets, buildAsset(path, type, durationMs)]),
    })),
  removeAsset: (path) =>
    set((state) => {
      const targetAsset = state.assets.find((asset) => asset.path === path);
      if (!targetAsset || targetAsset.locked) {
        return {};
      }

      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        overlays: state.timeline.overlays.filter((overlay) => overlay.assetPath !== path),
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(
          state.assets.filter((asset) => asset.path !== path),
          nextTimeline,
        ),
      };
    }),
  addTrack: () => {
    const track = getNextVisualTrack(useTimelineStore.getState().timeline.tracks);

    set((state) => {
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        tracks: [...state.timeline.tracks, track],
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    });

    return track.id;
  },
  addOverlay: (overlay) => {
    const id = uuid();
    set((state) => {
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        overlays: [...state.timeline.overlays, { ...overlay, id }],
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    });

    return id;
  },
  addAICardsToTimeline: (cards) =>
    set((state) => {
      const trackId =
        state.timeline.tracks.find((track) => track.kind === 'visual')?.id ?? DEFAULT_VISUAL_TRACK_ID;
      const overlays = [...state.timeline.overlays];

      for (const card of cards) {
        const existingOverlayIndex = overlays.findIndex(
          (overlay) =>
            overlay.overlayType === 'ai-card' &&
            overlay.aiCardData?.sourceCardId === card.sourceCardId,
        );

        if (existingOverlayIndex >= 0) {
          const existingOverlay = overlays[existingOverlayIndex];
          overlays[existingOverlayIndex] = {
            ...existingOverlay,
            type: 'image',
            assetPath: '',
            startMs: card.startMs,
            durationMs: card.durationMs,
            overlayType: 'ai-card',
            aiCardData: {
              ...card.aiCardData,
              sourceCardId: card.sourceCardId,
            },
          };
          continue;
        }

        overlays.push({
          id: `${card.sourceCardId}-${uuid()}`,
          type: 'image',
          assetPath: '',
          trackId,
          startMs: card.startMs,
          durationMs: card.durationMs,
          position: {
            x: 0,
            y: 0,
            width: state.timeline.width,
            height: state.timeline.height,
          },
          overlayType: 'ai-card',
          aiCardData: {
            ...card.aiCardData,
            sourceCardId: card.sourceCardId,
          },
        });
      }
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        overlays,
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    }),
  updateOverlay: (id, updates) =>
    set((state) => {
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        overlays: state.timeline.overlays.map((overlay) =>
          overlay.id === id ? { ...overlay, ...updates, id } : overlay,
        ),
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    }),
  removeOverlay: (id) =>
    set((state) => {
      const nextTimeline = normalizeTimeline({
        ...state.timeline,
        overlays: state.timeline.overlays.filter((overlay) => overlay.id !== id),
      });

      return {
        historyPast: pushHistorySnapshot(state.historyPast, state.timeline),
        historyFuture: [],
        canUndo: true,
        canRedo: false,
        timeline: nextTimeline,
        assets: syncAssetsWithTimeline(state.assets, nextTimeline),
      };
    }),
  undo: () =>
    set((state) => {
      if (state.historyPast.length === 0) {
        return {};
      }

      const previousTimeline = state.historyPast[state.historyPast.length - 1];
      const nextPast = state.historyPast.slice(0, -1);
      const nextFuture = [cloneTimeline(state.timeline), ...state.historyFuture].slice(
        0,
        MAX_TIMELINE_HISTORY,
      );
      const normalizedTimeline = normalizeTimeline(previousTimeline);

      return {
        timeline: normalizedTimeline,
        assets: syncAssetsWithTimeline(state.assets, normalizedTimeline),
        historyPast: nextPast,
        historyFuture: nextFuture,
        canUndo: nextPast.length > 0,
        canRedo: nextFuture.length > 0,
      };
    }),
  redo: () =>
    set((state) => {
      if (state.historyFuture.length === 0) {
        return {};
      }

      const [nextTimeline, ...remainingFuture] = state.historyFuture;
      const nextPast = pushHistorySnapshot(state.historyPast, state.timeline);
      const normalizedTimeline = normalizeTimeline(nextTimeline);

      return {
        timeline: normalizedTimeline,
        assets: syncAssetsWithTimeline(state.assets, normalizedTimeline),
        historyPast: nextPast,
        historyFuture: remainingFuture,
        canUndo: nextPast.length > 0,
        canRedo: remainingFuture.length > 0,
      };
    }),
}));

function hasBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getCurrentProjectDir(): string {
  return getStorageItem(PROJECT_DIR_KEY);
}

export function getProjectDir(): string {
  return getCurrentProjectDir();
}

export function getRecentProjects(): RecentProject[] {
  const raw = getStorageItem(RECENT_PROJECTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RecentProject[];
    return parsed.filter((project) => Boolean(project?.path));
  } catch {
    return [];
  }
}

export function rememberRecentProject(projectDir: string): RecentProject[] {
  const now = Date.now();
  const nextProjects = [
    {
      path: projectDir,
      name: getFileNameFromPath(projectDir),
      lastOpenedAt: now,
    },
    ...getRecentProjects().filter((project) => project.path !== projectDir),
  ].slice(0, 5);

  persistRecentProjects(nextProjects);
  return nextProjects;
}

export function removeRecentProject(projectDir: string): RecentProject[] {
  const nextProjects = getRecentProjects().filter((project) => project.path !== projectDir);
  persistRecentProjects(nextProjects);
  return nextProjects;
}

export function setCurrentProjectDir(projectDir: string): void {
  setStorageItem(PROJECT_DIR_KEY, projectDir);
}

export function setProjectDir(projectDir: string): void {
  setCurrentProjectDir(projectDir);
  rememberRecentProject(projectDir);
}

export function clearCurrentProject(): void {
  removeStorageItem(PROJECT_DIR_KEY);
  emitSaveStatus('idle');
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  useTimelineStore.subscribe((state, previousState) => {
    if (state.timeline === previousState.timeline) {
      return;
    }

    const projectDir = getProjectDir();
    if (!projectDir || !window.electronAPI?.saveTimeline) {
      return;
    }

    emitSaveStatus('saving');
    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      void window.electronAPI
        .saveTimeline(projectDir, JSON.stringify(state.timeline, null, 2))
        .then(() => {
          emitSaveStatus('saved');
        })
        .catch((error) => {
          console.error('保存 timeline 失败:', error);
          emitSaveStatus('error');
        });
    }, 300);
  });
}
