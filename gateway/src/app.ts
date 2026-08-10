import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import { loadConfig } from './config.js';
import { parseSramHex } from './pufVerifier.js';
import { getBlockedDevices, isDeviceBlocked, addBlocked, loadBlockedState, saveBlockedState, __setBlockedDevices } from './blockedStore.js';
import { fetchWithTimeout } from './fetchUtil.js';
import { shouldNotifyAdmin } from './pendingStore.js';
import { EXPECTED_SRAM_HEX_LEN, FIRMWARE_HASH_REGEX } from './shared.js';

const config = loadConfig();

function gatewayAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!config.adminKey) { next(); return; }
  const provided = req.headers['x-admin-key'] as string | undefined;
  if (provided !== config.adminKey) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing X-Admin-Key' });
    return;
  }
  next();
}

export function createGatewayApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50kb' }));

  // Health + blocked list
  app.get('/', (_req, res) => {
    res.json({
      status: 'active',
      message: 'Send POST /data to forward. Gateway is stateless — devices resolved via server metadata.',
      blockedDevices: getBlockedDevices().map((b) => ({
        mac: b.mac,
        sram: b.sram ? b.sram.slice(0, 16) + '...' : undefined,
        blockedAt: b.blockedAt,
        lastAttempt: b.lastAttempt,
        attemptCount: b.attemptCount,
      })),
    });
  });

  // Shim for ESP encrypt: proxy to server's /client/encrypt
  app.post('/encrypt', async (req, res) => {
    try {
      const response = await fetchWithTimeout(`${config.forwardBase}/client/encrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      }, config.fetchTimeoutMs);
      const text = await response.text();
      res.status(response.status).type('application/json').send(text);
    } catch (err) {
      res.status(502).json({ error: 'Encrypt proxy failed', message: (err as Error).message });
    }
  });

  // Operator: permanently block a device by SRAM
  app.post('/admin/block', gatewayAdminAuth, (req, res) => {
    const { sram, mac } = req.body || {};
    if (!sram || typeof sram !== 'string' || !parseSramHex(sram)) {
      return res.status(400).json({ error: 'Valid sram hex (1024 chars) required' });
    }
    const entry = addBlocked(sram, mac, config.stateFile);
    res.status(201).json({ blocked: true, entry: { mac: entry.mac, blockedAt: entry.blockedAt } });
  });

  // Unblock helper for MVP
  app.delete('/admin/block', gatewayAdminAuth, (req, res) => {
    const { sram, mac } = req.body || {};
    const list = getBlockedDevices();
    const before = list.length;
    const filtered = list.filter((b) => {
      if (sram && b.sram === sram) return false;
      if (mac && b.mac === mac) return false;
      return true;
    });
    if (filtered.length === before) return res.status(404).json({ error: 'No matching blocked entry' });
    __setBlockedDevices(filtered);
    try { fs.writeFileSync(config.stateFile, JSON.stringify({ blockedDevices: filtered }, null, 2)); } catch {}
    res.json({ unblocked: before - filtered.length });
  });

  app.post('/data', async (req, res) => {
    console.log('--------------------------------------------------');
    console.log('Received POST /data at:', new Date().toLocaleTimeString());

    const mac = (req.headers['x-mac-address'] as string) || 'unknown';
    const sramHex = (req.headers['x-sram-data'] as string) || '';
    const firmwareHashHeader = req.headers['x-firmware-hash'] as string | undefined;

    console.log('MAC Address:', mac);
    console.log('SRAM Data Length:', sramHex.length, 'hex chars');

    if (!sramHex || !req.headers['x-mac-address']) {
      console.log('MISSING SRAM OR MAC - blocking');
      console.log('--------------------------------------------------');
      return res.status(403).json({ status: 'blocked', message: 'Access denied. SRAM/MAC missing. Device Spoofing Detected', mac });
    }

    if (!parseSramHex(sramHex)) {
      console.log(`INVALID SRAM HEX - expected ${EXPECTED_SRAM_HEX_LEN} hex chars. Got ${sramHex.replace(/[^0-9A-Fa-f]/g, '').length}`);
      console.log('--------------------------------------------------');
      return res.status(400).json({ status: 'error', message: `Invalid SRAM hex payload. Expected ${EXPECTED_SRAM_HEX_LEN} hex chars (512 bytes).`, mac });
    }

    // Permanent block check (Hamming-aware)
    const blockCheck = isDeviceBlocked(sramHex, config.blockThresholdBits);
    if (blockCheck.isBlocked) {
      console.log(`BLOCKED DEVICE (MAC: ${mac}) attempt #${blockCheck.blockedEntry!.attemptCount}`);
      // persist attempt count
      saveBlockedState(config.stateFile);
      console.log('--------------------------------------------------');
      return res.status(403).json({ status: 'blocked', message: 'This device has been permanently blocked by the operator.', mac });
    }

    // Stateless verification: consult server metadata as source of truth
    let metadata: unknown;
    try {
      const metaUrl = `${config.forwardBase}/client/metadata`;
      console.log(`Verifying against ${metaUrl}...`);
      const metaRes = await fetchWithTimeout(metaUrl, {}, config.fetchTimeoutMs);
      if (!metaRes.ok) {
        console.warn(`Metadata check failed HTTP ${metaRes.status} - fail-closed`);
        return res.status(502).json({ status: 'error', message: 'Metadata verification failed', mac });
      }
      const rawText = await metaRes.text();
      try { metadata = JSON.parse(rawText); } catch (e) { return res.status(502).json({ status: 'error', message: 'Invalid metadata response from server', mac }); }
    } catch (err) {
      const isTimeout = (err as Error).name === 'AbortError';
      console.error(`Metadata fetch failed (${isTimeout ? 'timeout' : (err as Error).message}) - fail-closed.`);
      return res.status(502).json({ status: 'error', message: `Metadata verification failed: ${(err as Error).message}`, mac });
    }

    const deviceInMeta = Array.isArray(metadata)
      ? (metadata as Array<{ mac?: string; puf?: string; id?: string; firmwareHash?: string }>).find((m) => m.mac === mac || m.puf === sramHex)
      : null;

    if (deviceInMeta?.id) {
      console.log(`VERIFIED: Device found in server metadata (ID: ${deviceInMeta.id})`);
      // Forward — stateless, no local registration, no countdown
      return forwardRequest(req, res, { id: deviceInMeta.id, deviceName: deviceInMeta.id });
    }

    // Unknown device — notify admin (rate-limited) and return pending_approval
    console.log('NEW UNKNOWN DEVICE DETECTED — not in server metadata');
    console.log(`MAC: ${mac}`);

    const bodyFirmwareHash = req.body && typeof req.body.firmwareHash === 'string' ? req.body.firmwareHash : undefined;
    const resolvedFirmwareHash = (bodyFirmwareHash && FIRMWARE_HASH_REGEX.test(bodyFirmwareHash))
      ? bodyFirmwareHash
      : (typeof firmwareHashHeader === 'string' && FIRMWARE_HASH_REGEX.test(firmwareHashHeader))
        ? firmwareHashHeader
        : crypto.createHash('sha256').update(sramHex).digest('hex');

    if (shouldNotifyAdmin(sramHex, mac)) {
      try {
        const adminUrl = `${config.forwardBase}/admin/new`;
        console.log(`Notifying admin at ${adminUrl}...`);
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (config.adminKey) headers['X-Admin-Key'] = config.adminKey;
        const response = await fetchWithTimeout(adminUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ puf: sramHex, mac, firmwareHash: resolvedFirmwareHash }),
        }, config.fetchTimeoutMs);
        const resText = await response.text();
        console.log(`Admin response: HTTP ${response.status} ${resText.slice(0, 200)}`);
      } catch (err) {
        console.error('Failed to notify admin:', (err as Error).message);
      }
    } else {
      console.log('Admin already notified recently — cooldown, skip duplicate POST /admin/new');
    }

    console.log('--------------------------------------------------');
    return res.status(403).json({
      status: 'pending_approval',
      message: 'Device not registered. Pending admin approval. Admin has been notified.',
      mac,
    });
  });

  return app;
}

async function forwardRequest(req: express.Request, res: express.Response, deviceInfo: { id: string; deviceName: string }) {
  try {
    const forwardBody = {
      id: deviceInfo.id,
      data: (req.body as Record<string, unknown>).data ?? (req.body as Record<string, unknown>).payloadCiphertextBase64,
      kyberCiphertextBase64: (req.body as Record<string, unknown>).kyberCiphertextBase64,
      ivBase64: (req.body as Record<string, unknown>).ivBase64,
    };
    if (!forwardBody.id || !forwardBody.data || !forwardBody.kyberCiphertextBase64 || !forwardBody.ivBase64) {
      return res.status(400).json({ status: 'error', message: 'Missing required message fields for forwarding.' });
    }
    const messageUrl = `${config.forwardBase}/client/message`;
    console.log('Forwarding to:', messageUrl);
    const response = await fetchWithTimeout(messageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(forwardBody),
    }, config.fetchTimeoutMs);
    const status = response.status;
    const responseText = await response.text();
    console.log(`Server Response (/client/message): HTTP ${status}`);
    res.status(status).type('application/json').send(responseText);
  } catch (error) {
    console.error('Forwarding Failed:', (error as Error).message);
    return res.status(502).json({ status: 'error', device: deviceInfo.deviceName, message: 'Failed to forward data', error: (error as Error).message });
  }
}

export function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
    }
  }
  return addresses;
}

export function initGateway(): void {
  loadBlockedState(loadConfig().stateFile);
}
