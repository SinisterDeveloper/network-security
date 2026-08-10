export function ensureFetchAvailable(): void {
  if (typeof fetch !== 'function') throw new Error('Global fetch not available. Use Node 18+');
}

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number): Promise<Response> {
  ensureFetchAvailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
