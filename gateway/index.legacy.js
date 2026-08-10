'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const os = require('os');

const app = express();

const PORT = Number(process.env.GATEWAY_PORT) || Number(process.env.PORT) || 8824;
const FORWARD_BASE = process.env.FORWARD_BASE || 'http://localhost:3000';
const BLOCK_THRESHOLD_BITS = Number(process.env.BLOCK_THRESHOLD_BITS) || 350;
const NEW_DEVICE_PENALTY = Number(process.env.NEW_DEVICE_PENALTY) || 50;
const FETCH_TIMEOUT_MS = Number(process.env.GATEWAY_FETCH_TIMEOUT_MS) || 5000;
const EXPECTED_SRAM_BYTES = 512;
const EXPECTED_SRAM_HEX_LEN = EXPECTED_SRAM_BYTES * 2;
const STATE_FILE = path.join(__dirname, 'data.json');

app.use(express.json());

let devices = [];
let blockedDevices = [];

const nowIso = () => new Date().toISOString();

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ devices, blockedDevices }, null, 2));
  } catch (err) {
    console.error('Failed to save gateway state:', err.message);
  }
}

async function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      blockedDevices = Array.isArray(parsed.blockedDevices) ? parsed.blockedDevices : [];
      console.log(`State loaded from ${STATE_FILE}: ${devices.length} devices, ${blockedDevices.length} blocked`);
      return;
    }
  } catch (err) {
    console.error('Failed to load gateway state:', err.message);
  }
  devices = [];
  blockedDevices = [];
  console.log('State initialized (no prior file).');
}

function parseSramHex(hexString) {
  if (!hexString || typeof hexString !== 'string') return null;
  const cleaned = hexString.replace(/[^0-9A-Fa-f]/g, '');
  // Enforce exact expected length to prevent truncation attack (2-char payload would otherwise always match)
  if (cleaned.length !== EXPECTED_SRAM_HEX_LEN) return null;
  if (cleaned.length % 2 !== 0) return null;
  return Buffer.from(cleaned, 'hex');
}

function verifySram(storedBytes, newBytes) {
  if (!storedBytes || !newBytes) return { isSame: false, flippedBits: Infinity, totalBits: 0, message: 'Invalid SRAM' };
  if (storedBytes.length !== newBytes.length) {
    return { isSame: false, flippedBits: Infinity, totalBits: Math.max(storedBytes.length, newBytes.length) * 8, message: `Length mismatch (${storedBytes.length} vs ${newBytes.length} bytes)` };
  }
  const len = storedBytes.length;
  let flippedBits = 0;

  for (let i = 0; i < len; i += 1) {
    let xor = storedBytes[i] ^ newBytes[i];
    while (xor) {
      flippedBits += xor & 1;
      xor >>= 1;
    }
  }

  const totalBits = len * 8;
  const isSame = flippedBits < BLOCK_THRESHOLD_BITS;
  const message = isSame
    ? `Same ESP32 (noise: ${flippedBits} bits out of ${totalBits})`
    : `Different ESP32 (difference: ${flippedBits} bits out of ${totalBits})`;

  return { isSame, flippedBits, totalBits, message };
}

function isDeviceBlocked(sramHex) {
  const newSramBytes = parseSramHex(sramHex);
  if (!newSramBytes) return { isBlocked: false };

  for (const blocked of blockedDevices) {
    const blockedSramBytes = parseSramHex(blocked.sram);
    if (!blockedSramBytes) continue;
    const result = verifySram(blockedSramBytes, newSramBytes);
    if (result.isSame) {
      blocked.lastAttempt = nowIso();
      blocked.attemptCount = (blocked.attemptCount || 0) + 1;
      saveState();
      return { isBlocked: true, blockedEntry: blocked, pufResult: result };
    }
  }
  return { isBlocked: false };
}

function matchKnownDevice(mac, sramHex) {
  const newSramBytes = parseSramHex(sramHex);
  if (!newSramBytes) return { found: false };

  for (const device of devices) {
    const storedSramBytes = parseSramHex(device.sram);
    if (!storedSramBytes) continue;
    const result = verifySram(storedSramBytes, newSramBytes);

    if (result.isSame) {
      device.lastSeen = nowIso();
      device.lastSeenMac = mac;
      device.lastFlippedBits = result.flippedBits;
      saveState();
      return {
        found: true,
        deviceObj: device,
        deviceName: device.name,
        flippedBits: result.flippedBits,
        totalBits: result.totalBits,
        matchDetails: result.message,
      };
    }
  }

  return { found: false };
}

function registerDevice(mac, sramHex, firmwareHash) {
  const deviceNumber = devices.length + 1;
  const deviceName = `Device ${deviceNumber}`;
  // Derive a deterministic placeholder hash from SRAM if caller didn't supply one; avoid poisoning with "Device N"
  const resolvedFirmwareHash = (typeof firmwareHash === 'string' && /^[a-fA-F0-9]{64}$/.test(firmwareHash))
    ? firmwareHash
    : crypto.createHash('sha256').update(sramHex).digest('hex');
  const newDevice = {
    name: deviceName,
    mac,
    sram: sramHex,
    firmwareHash: resolvedFirmwareHash,
    registeredAt: nowIso(),
    lastSeen: nowIso(),
    lastSeenMac: mac,
    lastFlippedBits: 0,
    blockCountdown: NEW_DEVICE_PENALTY,
    whitelisted: false,
  };
  devices.push(newDevice);
  saveState();
  return newDevice;
}

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function ensureFetchAvailable() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available. Use Node 18+ or provide a fetch polyfill.');
  }
}

async function fetchWithTimeout(url, options = {}) {
  ensureFetchAvailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

app.get('/', (_, res) => {
  res.json({
    status: 'active',
    message: 'Send a POST request to /data to log and forward data.',
    registeredDevices: devices.map((d) => ({
      name: d.name,
      mac: d.mac,
      lastSeenMac: d.lastSeenMac,
      registeredAt: d.registeredAt,
      lastSeen: d.lastSeen,
      lastFlippedBits: d.lastFlippedBits,
      id: d.id || null,
      firmwareHash: d.firmwareHash,
    })),
    blockedDevices: blockedDevices.map((b) => ({
      mac: b.mac,
      sram: b.sram ? b.sram.slice(0, 16) + '...' : undefined,
      blockedAt: b.blockedAt,
      lastAttempt: b.lastAttempt,
      attemptCount: b.attemptCount,
    })),
  });
});

// Shim for ESP encrypt: proxy to server's /client/encrypt so ESP hard-coded :3001/encrypt works if gateway runs on 3001 or via this route
app.post('/encrypt', async (req, res) => {
  try {
    const response = await fetchWithTimeout(`${FORWARD_BASE}/client/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).type('application/json').send(text);
  } catch (err) {
    res.status(502).json({ error: 'Encrypt proxy failed', message: err.message });
  }
});

// Operator: permanently block a device by SRAM (adds to blockedDevices)
app.post('/admin/block', (req, res) => {
  const { sram, mac } = req.body || {};
  if (!sram || typeof sram !== 'string' || !parseSramHex(sram)) {
    return res.status(400).json({ error: 'Valid sram hex (1024 chars) required' });
  }
  const entry = {
    sram,
    mac: mac || 'unknown',
    blockedAt: nowIso(),
    lastAttempt: nowIso(),
    attemptCount: 0,
  };
  blockedDevices.push(entry);
  saveState();
  res.status(201).json({ blocked: true, entry: { mac: entry.mac, blockedAt: entry.blockedAt } });
});

app.post('/data', async (req, res) => {
  console.log('--------------------------------------------------');
  console.log('Received POST /data at:', new Date().toLocaleTimeString());

  const mac = req.headers['x-mac-address'] || 'unknown';
  const sramHex = req.headers['x-sram-data'] || '';
  const firmwareHashHeader = req.headers['x-firmware-hash'];

  console.log('MAC Address:', mac);
  console.log('SRAM Data Length:', sramHex.length, 'hex chars');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  if (!sramHex || !req.headers['x-mac-address']) {
    console.log('MISSING SRAM OR MAC - blocking request');
    console.log('--------------------------------------------------');
    return res.status(403).json({
      status: 'blocked',
      message: 'Access denied. SRAM do not match. Device Spoofing Detected',
      mac,
    });
  }

  if (!parseSramHex(sramHex)) {
    console.log(`INVALID SRAM HEX - expected ${EXPECTED_SRAM_HEX_LEN} hex chars (512 bytes). Got ${sramHex.replace(/[^0-9A-Fa-f]/g,'').length}`);
    console.log('--------------------------------------------------');
    return res.status(400).json({
      status: 'error',
      message: `Invalid SRAM hex payload. Expected ${EXPECTED_SRAM_HEX_LEN} hex chars (512 bytes).`,
      mac,
    });
  }

  const blockCheck = isDeviceBlocked(sramHex);
  if (blockCheck.isBlocked) {
    console.log(`BLOCKED DEVICE detected (MAC: ${mac})`);
    console.log(`Blocked since: ${blockCheck.blockedEntry.blockedAt}`);
    console.log(`Attempt #${blockCheck.blockedEntry.attemptCount}`);
    console.log('--------------------------------------------------');
    return res.status(403).json({
      status: 'blocked',
      message: 'This device has been permanently blocked by the operator.',
      mac,
    });
  }

  const match = matchKnownDevice(mac, sramHex);
  if (match.found) {
    const device = match.deviceObj;

    if (device.blockCountdown && device.blockCountdown > 0) {
      device.blockCountdown -= 1;
      saveState();
      console.log(`BLOCKED: ${match.deviceName} is serving a penalty for missing metadata.`);
      console.log(`Calls remaining in penalty: ${device.blockCountdown}`);
      console.log('--------------------------------------------------');
      return res.status(403).json({
        status: 'blocked',
        message: `Device missing from target server metadata. Try again after ${device.blockCountdown} calls.`,
        mac,
      });
    }

    try {
      const metaUrl = `${FORWARD_BASE}/client/metadata`;
      console.log(`Verifying ${match.deviceName} against ${metaUrl}...`);
      const metaRes = await fetchWithTimeout(metaUrl);

      if (metaRes.ok) {
        const rawText = await metaRes.text();
        console.log(`Server 2 Response (/client/metadata): HTTP ${metaRes.status}`);

        let metadata = [];
        try {
          metadata = JSON.parse(rawText);
        } catch (err) {
          console.error('Failed to parse metadata JSON:', err.message);
          return res.status(502).json({ status: 'error', message: 'Invalid metadata response from server', mac });
        }

        const deviceInMeta = Array.isArray(metadata)
          ? metadata.find((m) => m.mac === mac || m.puf === sramHex)
          : null;

        if (deviceInMeta) {
          device.id = deviceInMeta.id;
          saveState();
          console.log(
            `VERIFIED: Device found in Server 2 metadata (ID: ${deviceInMeta.id || 'N/A'})`,
          );
        } else {
          device.blockCountdown = NEW_DEVICE_PENALTY;
          saveState();
          console.log(
            `BLOCKED: ${match.deviceName} missing from Server 2 metadata. Starting ${NEW_DEVICE_PENALTY}-call penalty.`,
          );
          console.log('--------------------------------------------------');
          return res.status(403).json({
            status: 'blocked',
            message:
              'Device is registered locally but missing from target server metadata. Starting penalty block.',
            mac,
          });
        }
      } else {
        console.warn(`Metadata check failed (HTTP ${metaRes.status}) - fail-closed.`);
        return res.status(502).json({ status: 'error', message: 'Metadata verification failed', mac });
      }
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      console.error(`Metadata fetch failed (${isTimeout ? 'timeout' : err.message}) - fail-closed.`);
      return res.status(502).json({ status: 'error', message: `Metadata verification failed: ${err.message}`, mac });
    }

    if (!device.id) {
      console.log('BLOCKED: Device is missing server id; cannot forward message.');
      console.log('--------------------------------------------------');
      return res.status(403).json({
        status: 'blocked',
        message: 'Device is missing server id; cannot forward message.',
        mac,
      });
    }
    const deviceInfo = {
      deviceName: match.deviceName,
      id: device.id,
      flippedBits: match.flippedBits,
      totalBits: match.totalBits,
      matchDetails: match.matchDetails,
    };

    console.log(
      `KNOWN DEVICE: ${match.deviceName} (ID: ${device.id || 'Unknown'})`,
    );
    console.log(`Flipped Bits: ${match.flippedBits} / ${match.totalBits}`);
    console.log(`Result: ${match.matchDetails}`);
    return forwardRequest(req, res, deviceInfo);
  }

  console.log('NEW UNKNOWN DEVICE DETECTED');
  console.log(`MAC: ${mac}`);
  console.log('Automatically registering and notifying admin...');

  const bodyFirmwareHash = req.body && typeof req.body.firmwareHash === 'string' ? req.body.firmwareHash : undefined;
  const resolvedFirmwareHash = bodyFirmwareHash || (typeof firmwareHashHeader === 'string' ? firmwareHashHeader : undefined);
  const newDevice = registerDevice(mac, sramHex, resolvedFirmwareHash);
  console.log(`REGISTERED as ${newDevice.name}`);

  try {
    const adminUrl = `${FORWARD_BASE}/admin/new`;
    console.log(`Sending device registry info to ${adminUrl}...`);
    const response = await fetchWithTimeout(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puf: sramHex,
        mac,
        firmwareHash: newDevice.firmwareHash,
      }),
    });

    const resText = await response.text();
    console.log(`Server 2 Response (/admin/new): HTTP ${response.status}`);
    console.log('Response Body:', resText);

    if (response.ok) {
      try {
        const payload = JSON.parse(resText);
        // Server returns { newDeviceDetected: {mac,puf,firmwareHash} } - no id; device.id stays pending until metadata verifies
        if (payload && payload.newDeviceDetected) {
          console.log('Admin notified of new device.');
        }
        if (payload && payload.id) {
          newDevice.id = payload.id;
          saveState();
          console.log(`Stored id for ${newDevice.name}: ${payload.id}`);
        }
      } catch (err) {
        console.warn('Admin response was not valid JSON; id not stored.');
      }
    } else {
      console.log(`Admin endpoint returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.error('Failed to notify admin:', err.message);
  }

  console.log(
    `PAUSING DEVICE: ${newDevice.name} placed on ${NEW_DEVICE_PENALTY}-call hold pending admin approval.`,
  );
  console.log('--------------------------------------------------');
  return res.status(403).json({
    status: 'pending_approval',
    message:
      `Device registered. Pending admin approval. Data blocked for the next ${NEW_DEVICE_PENALTY} calls to allow verification.`,
    mac,
  });
});

async function forwardRequest(req, res, deviceInfo) {
  try {
    const forwardBody = {
      id: deviceInfo.id,
      data: req.body.data ?? req.body.payloadCiphertextBase64,
      kyberCiphertextBase64: req.body.kyberCiphertextBase64,
      ivBase64: req.body.ivBase64,
    };

    if (!forwardBody.id || !forwardBody.data || !forwardBody.kyberCiphertextBase64 || !forwardBody.ivBase64) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required message fields for forwarding.',
      });
    }

    const messageUrl = `${FORWARD_BASE}/client/message`;

    console.log('Forwarding to:', messageUrl);
    const response = await fetchWithTimeout(messageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(forwardBody),
    });

    const status = response.status;
    const responseText = await response.text();
    console.log(`Server 2 Response (/client/message): HTTP ${status}`);
    console.log('Response Body:', responseText);

    res.status(status);
    res.type('application/json');
    return res.send(responseText);
  } catch (error) {
    console.error('Forwarding Failed:', error.message);
    return res.status(502).json({
      status: 'error',
      device: deviceInfo.deviceName,
      message: 'Failed to forward data',
      error: error.message,
    });
  }
}

loadState().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`Server running on port ${PORT}`);
    console.log('Local Network Access:');
    ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
    console.log(`Forwarding Target Base: ${FORWARD_BASE}`);
    console.log(`BLOCK_THRESHOLD_BITS: ${BLOCK_THRESHOLD_BITS} (expected SRAM ${EXPECTED_SRAM_BYTES}B)`);
    console.log(`Registered Devices: ${devices.length}`);
    devices.forEach((d) => console.log(`  OK ${d.name} (MAC: ${d.mac})`));
    console.log(`Blocked Devices: ${blockedDevices.length}`);
    blockedDevices.forEach((b) =>
      console.log(`  BLOCKED MAC: ${b.mac} (blocked: ${b.blockedAt})`),
    );
    console.log('');
  });
});

module.exports = { app, parseSramHex, verifySram, devices, blockedDevices };
