import storeHash, { pendingHashes } from '../contract.js';
import { logRepository } from '../repos/LogRepository.js';

let retryTimer: NodeJS.Timeout | null = null;

export const blockchainService = {
  /**
   * Fire-and-forget: queues on failure, does not throw to caller.
   * Returns true if immediately stored, false if queued.
   */
  async anchorHash(hash: string, metadata: string): Promise<boolean> {
    try {
      await storeHash(hash, metadata);
      logRepository.push('HASH_STORED', { hash, metadata }, metadata);
      return true;
    } catch (err) {
      pendingHashes.push({ hash, metadata, timestamp: Date.now(), attempts: 1 });
      logRepository.push(
        'HASH_STORE_FAILED',
        { hash, metadata, error: err instanceof Error ? err.message : String(err) },
        metadata,
      );
      return false;
    }
  },

  /** Direct retry entry — used by interval and admin endpoint */
  async retryPending(maxAttempts = 3): Promise<number> {
    let succeeded = 0;
    const remaining: typeof pendingHashes = [];
    for (const entry of [...pendingHashes]) {
      try {
        await storeHash(entry.hash, entry.metadata);
        logRepository.push('HASH_RETRY', { hash: entry.hash, metadata: entry.metadata }, entry.metadata);
        succeeded += 1;
      } catch {
        entry.attempts += 1;
        if (entry.attempts < maxAttempts) remaining.push(entry);
      }
    }
    pendingHashes.length = 0;
    pendingHashes.push(...remaining);
    return succeeded;
  },

  getPendingCount(): number {
    return pendingHashes.length;
  },

  startRetryInterval(intervalMs = 30_000): void {
    if (retryTimer) return;
    retryTimer = setInterval(() => {
      if (pendingHashes.length === 0) return;
      this.retryPending().catch((err) => console.error('[blockchain] retry failed', err));
    }, intervalMs);
    retryTimer.unref?.();
  },

  stopRetryInterval(): void {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  },
};
