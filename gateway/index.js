'use strict';

const express = require('express');
const os = require('os');

const app = express();

const PORT = Number(process.env.PORT) || 8824;
const FORWARD_BASE = process.env.FORWARD_BASE || 'http://172.25.83.216:6767';
const BLOCK_THRESHOLD_BITS = 700;
const NEW_DEVICE_PENALTY = 50;

app.use(express.json());

let devices = [];
let blockedDevices = [];

const nowIso = () => new Date().toISOString();

async function loadState() {
  devices = [];
  blockedDevices = [];
  console.log('State initialized in memory only (no files).');
}

function parseSramHex(hexString) {
  if (!hexString || typeof hexString !== 'string') return null;
  const cleaned = hexString.replace(/[^0-9A-Fa-f]/g, '');
  if (cleaned.length < 2 || cleaned.length % 2 !== 0) return null;
  return Buffer.from(cleaned, 'hex');
}

function verifySram(storedBytes, newBytes) {
  const len = Math.min(storedBytes.length, newBytes.length);
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
      device.mac = mac;
      device.lastFlippedBits = result.flippedBits;
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

function registerDevice(mac, sramHex) {
  const deviceNumber = devices.length + 1;
  const deviceName = `Device ${deviceNumber}`;
  const newDevice = {
    name: deviceName,
    mac,
    sram: sramHex,
    registeredAt: nowIso(),
    lastSeen: nowIso(),
    lastFlippedBits: 0,
    blockCountdown: NEW_DEVICE_PENALTY,
    whitelisted: false,
  };
  devices.push(newDevice);
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

app.get('/', (_, res) => {
  res.json({
    status: 'active',
    message: 'Send a POST request to /data to log and forward data.',
    registeredDevices: devices.map((d) => ({
      name: d.name,
      mac: d.mac,
      registeredAt: d.registeredAt,
      lastSeen: d.lastSeen,
      lastFlippedBits: d.lastFlippedBits,
    })),
    blockedDevices: blockedDevices.map((b) => ({
      mac: b.mac,
      blockedAt: b.blockedAt,
      lastAttempt: b.lastAttempt,
      attemptCount: b.attemptCount,
    })),
  });
});

app.post('/data', async (req, res) => {
  console.log('--------------------------------------------------');
  console.log('Received POST /data at:', new Date().toLocaleTimeString());

  const mac = req.headers['x-mac-address'] || 'unknown';
  const sramHex = req.headers['x-sram-data'] || '';

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
    console.log('INVALID SRAM HEX - blocking request');
    console.log('--------------------------------------------------');
    return res.status(400).json({
      status: 'error',
      message: 'Invalid SRAM hex payload.',
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
    let isVerifiedOnServer2 = Boolean(device.id);

    if (device.blockCountdown && device.blockCountdown > 0) {
      device.blockCountdown -= 1;
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
      ensureFetchAvailable();
      const metaUrl = `${FORWARD_BASE}/client/metadata`;
      console.log(`Verifying ${match.deviceName} against ${metaUrl}...`);
      const metaRes = await fetch(metaUrl);

      if (metaRes.ok) {
        const rawText = await metaRes.text();
        console.log(`Server 2 Response (/client/metadata): HTTP ${metaRes.status}`);

        let metadata = [];
        try {
          metadata = JSON.parse(rawText);
        } catch (err) {
          console.error('Failed to parse metadata JSON:', err.message);
        }

        const deviceInMeta = Array.isArray(metadata)
          ? metadata.find((m) => m.mac === mac || m.puf === sramHex)
          : null;

        if (deviceInMeta) {
          isVerifiedOnServer2 = true;
          device.id = deviceInMeta.id;
          console.log(
            `VERIFIED: Device found in Server 2 metadata (ID: ${deviceInMeta.id || 'N/A'})`,
          );
        } else {
          device.blockCountdown = NEW_DEVICE_PENALTY;
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
        console.warn(
          `Warning: Server 2 metadata check failed (HTTP ${metaRes.status}). Forwarding anyway...`,
        );
        isVerifiedOnServer2 = Boolean(device.id);
      }
    } catch (err) {
      console.error(
        `Warning: Failed to fetch metadata from target server. Forwarding anyway... (${err.message})`,
      );
      isVerifiedOnServer2 = Boolean(device.id);
    }

    if (isVerifiedOnServer2) {
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
  }

  console.log('NEW UNKNOWN DEVICE DETECTED');
  console.log(`MAC: ${mac}`);
  console.log('Automatically registering and notifying admin...');

  const newDevice = registerDevice(mac, sramHex);
  console.log(`REGISTERED as ${newDevice.name}`);

  try {
    ensureFetchAvailable();
    const adminUrl = `${FORWARD_BASE}/admin/new`;
    console.log(`Sending device registry info to ${adminUrl}...`);
    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        puf: sramHex,
        mac,
        firmwareHash: newDevice.name,
      }),
    });

    const resText = await response.text();
    console.log(`Server 2 Response (/admin/new): HTTP ${response.status}`);
    console.log('Response Body:', resText);

    if (response.ok) {
      try {
        const payload = JSON.parse(resText);
        if (payload && payload.id) {
          newDevice.id = payload.id;
          console.log(`Stored id for ${newDevice.name}: ${payload.id}`);
        }
      } catch (err) {
        console.warn('Admin response was not valid JSON; id not stored.');
      }
      console.log('Device registry info sent to admin endpoint.');
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
      'Device registered. Pending admin approval. Data blocked for the next 50 calls to allow verification.',
    mac,
  });
});

async function forwardRequest(req, res, deviceInfo) {
  try {
    ensureFetchAvailable();
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
    console.log('Payload being sent:', JSON.stringify(forwardBody, null, 2));
    const response = await fetch(messageUrl, {
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
    res.status(502).json({
      status: 'error',
      device: deviceInfo.deviceName,
      message: 'Failed to forward data',
      error: error.message,
    });
  }
  console.log('--------------------------------------------------');
}

loadState().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`Server running on port ${PORT}`);
    console.log('Local Network Access:');
    ips.forEach((ip) => console.log(`  http://${ip}:${PORT}`));
    console.log(`Forwarding Target Base: ${FORWARD_BASE}`);
    console.log(`Registered Devices: ${devices.length}`);
    devices.forEach((d) => console.log(`  OK ${d.name} (MAC: ${d.mac})`));
    console.log(`Blocked Devices: ${blockedDevices.length}`);
    blockedDevices.forEach((b) =>
      console.log(`  BLOCKED MAC: ${b.mac} (blocked: ${b.blockedAt})`),
    );
    console.log('');
  });
});
