export async function fetchDownloadBlob(
  url: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Blob> {
  const response = await fetchImpl(url, {
    headers: { Range: 'bytes=0-' },
    redirect: 'follow',
    credentials: 'omit',
  });
  if (!response.ok) throw new Error(`视频源不可用（HTTP ${response.status}）`);

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('text/html') || contentType.includes('application/json')) {
    throw new Error('视频源返回的不是媒体文件');
  }
  return response.blob();
}
