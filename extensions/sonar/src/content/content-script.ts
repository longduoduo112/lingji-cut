/**
 * Content Script（ISOLATED world）。
 *
 * 职责：生成随机会话标识并注入 MAIN world 的 PageBridge；校验来自页面的消息来源、
 * 会话标识与数据结构；把通过校验的捕获响应转交 Service Worker。
 *
 * 注意：这里只转发「页面自身成功返回的响应」，不主动发起抖音请求，也不触碰认证数据。
 */
import bridgeUrl from './page-bridge?script&module';
import { parseCapturedMessage } from './page-capture';
import { mountInjectedUi } from './inject-ui';

function generateSessionId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sonar-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sessionId = generateSessionId();

function injectPageBridge(): void {
  // 通过 documentElement 的 data 属性把会话标识传给 MAIN world 的 bridge（共享 DOM）。
  document.documentElement.dataset.sonarSession = sessionId;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = chrome.runtime.getURL(bridgeUrl);
  script.dataset.sonar = 'page-bridge';
  (document.head || document.documentElement).appendChild(script);
  script.addEventListener('load', () => script.remove());
}

// 接收页面 postMessage：只信任 source 为本窗口、origin 为当前页、且会话标识匹配的消息。
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;
  const captured = parseCapturedMessage(event.data, sessionId);
  if (!captured) return;
  void chrome.runtime
    .sendMessage({
      kind: 'sonar/page-capture',
      category: captured.category,
      url: captured.url,
      payload: captured.payload,
      pageUrl: window.location.href,
    })
    .catch(() => {
      /* Service Worker 未就绪时丢弃单条捕获，下次页面响应会再次捕获 */
    });
});

injectPageBridge();

// 页面注入 UI 需要 DOM 就绪。
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountInjectedUi(), { once: true });
} else {
  mountInjectedUi();
}

export {};
