import fs from 'fs';
import { parseSramHex, verifySram } from './pufVerifier.js';

export interface BlockedEntry {
  sram: string;
  mac: string;
  blockedAt: string;
  lastAttempt: string;
  attemptCount: number;
}

let blockedDevices: BlockedEntry[] = [];

export function getBlockedDevices(): BlockedEntry[] {
  return blockedDevices;
}

export function loadBlockedState(stateFile: string): void {
  try {
    if (fs.existsSync(stateFile)) {
      const raw = fs.readFileSync(stateFile, 'utf-8');
      const parsed = JSON.parse(raw);
      // Migrate legacy { devices, blockedDevices } -> only blockedDevices
      if (Array.isArray(parsed.blockedDevices)) {
        blockedDevices = parsed.blockedDevices;
      } else if (Array.isArray(parsed)) {
        blockedDevices = parsed;
      }
      console.log(`Blocked state loaded: ${blockedDevices.length} blocked`);
      // If legacy file had devices key, we drop it on next save
      return;
    }
  } catch (err) {
    console.error('Failed to load blocked state:', (err as Error).message);
  }
  blockedDevices = [];
  console.log('Blocked state initialized (no prior file).');
}

export function saveBlockedState(stateFile: string): void {
  try {
    fs.writeFileSync(stateFile, JSON.stringify({ blockedDevices }, null, 2));
  } catch (err) {
    console.error('Failed to save blocked state:', (err as Error).message);
  }
}

export function addBlocked(sram: string, mac: string, stateFile: string): BlockedEntry {
  const entry: BlockedEntry = {
    sram,
    mac: mac || 'unknown',
    blockedAt: new Date().toISOString(),
    lastAttempt: new Date().toISOString(),
    attemptCount: 0,
  };
  blockedDevices.push(entry);
  saveBlockedState(stateFile);
  return entry;
}

export function isDeviceBlocked(sramHex: string, thresholdBits: number): { isBlocked: boolean; blockedEntry?: BlockedEntry } {
  const newBytes = parseSramHex(sramHex);
  if (!newBytes) return { isBlocked: false };
  for (const blocked of blockedDevices) {
    const blockedBytes = parseSramHex(blocked.sram);
    if (!blockedBytes) continue;
    const result = verifySram(blockedBytes, newBytes, thresholdBits);
    if (result.isSame) {
      blocked.lastAttempt = new Date().toISOString();
      blocked.attemptCount = (blocked.attemptCount || 0) + 1;
      return { isBlocked: true, blockedEntry: blocked };
    }
  }
  return { isBlocked: false };
}

// For tests / direct mutation save hooks
export function __setBlockedDevices(list: BlockedEntry[]): void {
  blockedDevices = list;
}
