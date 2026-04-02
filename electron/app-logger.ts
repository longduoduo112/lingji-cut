import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { AppLogEntry, AppLogLevel } from '../src/lib/app-log';

const MAX_LOG_ENTRIES = 200;
const entries: AppLogEntry[] = [];

function getLogDirectory(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export function getAppLogFilePath(): string {
  return path.join(getLogDirectory(), 'video-web-master.log');
}

function persistLog(entry: AppLogEntry): void {
  try {
    mkdirSync(getLogDirectory(), { recursive: true });
    appendFileSync(
      getAppLogFilePath(),
      `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}${entry.details ? `\n${entry.details}` : ''}\n`,
      'utf-8',
    );
  } catch {
    // 日志写盘失败不应阻断主流程。
  }
}

export function addAppLog(
  level: AppLogLevel,
  scope: string,
  message: string,
  details?: string,
): AppLogEntry {
  const entry: AppLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    details,
  };

  entries.push(entry);
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.shift();
  }

  persistLog(entry);
  return entry;
}

export function getAppLogs(): AppLogEntry[] {
  return [...entries];
}
