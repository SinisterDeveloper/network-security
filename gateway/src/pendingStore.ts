/**
 * In-memory rate-limit for pending approvals — avoids spamming POST /admin/new
 * for the same unknown PUF every second. Stateless gateway alternative to
 * the old devices[] + blockCountdown.
 */
export interface PendingEntry {
  sram: string;
  mac: string;
  firstSeen: number;
  lastNotified: number;
  notifyCount: number;
}

const pending = new Map<string, PendingEntry>(); // key = sramHex
const PENDING_TTL_MS = 5 * 60 * 1000; // 5 min — after this we re-notify
const NOTIFY_COOLDOWN_MS = 30 * 1000; // 30s between admin notifications

function keyFor(sramHex: string): string {
  return sramHex;
}

export function shouldNotifyAdmin(sramHex: string, mac: string): boolean {
  const now = Date.now();
  const entry = pending.get(keyFor(sramHex));
  if (!entry) {
    pending.set(keyFor(sramHex), { sram: sramHex, mac, firstSeen: now, lastNotified: now, notifyCount: 1 });
    return true;
  }
  if (now - entry.lastNotified < NOTIFY_COOLDOWN_MS) return false;
  entry.lastNotified = now;
  entry.notifyCount += 1;
  entry.mac = mac;
  return true;
}

export function isPending(sramHex: string): boolean {
  const entry = pending.get(keyFor(sramHex));
  if (!entry) return false;
  if (Date.now() - entry.firstSeen > PENDING_TTL_MS) {
    pending.delete(keyFor(sramHex));
    return false;
  }
  return true;
}

export function getPendingCount(): number {
  // prune expired
  const now = Date.now();
  for (const [k, v] of pending) if (now - v.firstSeen > PENDING_TTL_MS) pending.delete(k);
  return pending.size;
}

export function clearPending(): void {
  pending.clear();
}
