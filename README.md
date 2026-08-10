# Embedded System Network Security

A secure embedded telemetry platform that combines post-quantum cryptography, device identity based on SRAM PUF, a stateless gateway firewall, and blockchain-anchored integrity. 

The system is designed for ESP32 and ESP8266 devices that report sensor data through an untrusted network to a backend that verifies device identity, decrypts payloads, and anchors message hashes on the Polygon Amoy testnet.

The repository is a monorepo with six packages: backend server, gateway proxy, on-chain hash storage, ESP firmware, admin console, and client registry. After the recent refactoring the architecture uses explicit service and repository layers in the server, a stateless gateway, HKDF-based key derivation, modular PlatformIO firmware for both ESP targets, and two Next/Vite frontends that share the same server API through env-driven rewrites.

### Team

**[@Ayush Anand](https://github.com/iayushanand)**
**[@Krishay](https://github.com/SinisterDeveloper)**
**[@Geetha Pai](https://www.linkedin.com/in/geetha-pai-18666a35b/)**
**[@Krish Kavin](https://www.linkedin.com/in/krin58/)**

## Architecture Overview

```
ESP32 / ESP8266 Firmware (PlatformIO)
  |  PUF 512B (1024 hex) + MAC
  |  POST /encrypt { mac, plaintext } or { publicKey, plaintext }
  |  POST /data  X-MAC-Address + X-SRAM-Data + { kyber, iv, payload }
  v
Gateway :8824 (TypeScript, stateless)
  |  parseSramHex (1024 hex exact) + verifySram (Hamming < 350 bits)
  |  isDeviceBlocked → 403
  |  GET /client/metadata (fail-closed) → find by mac or puf
  |  known → POST /client/message  |  unknown → POST /admin/new (rate-limited)
  v
Server :3000 (TypeScript, Express)
  |  DeviceService (ML-KEM-768 keypair per device)
  |  MessageService (Kyber decap → HKDF-SHA256 → AES-256-GCM → SHA-256 hash)
  |  BlockchainService (fire-and-forget anchor + retry interval)
  |  LogRepository (bounded 10k) + KeyVault (secret isolation)
  v
Polygon Amoy HashStorage.sol
  Record { sender, timestamp, hash, metadata } + HashStored event
```

Data flow is end to end encrypted. The gateway never decrypts. It only validates the PUF header and delegates device lookup to the server, which is the single source of truth for devices. The server decrypts, hashes, stores the message in memory, and queues the hash for on-chain storage without blocking the HTTP response.

## Repository Structure

```
EmbSecServer/
  .env.example                # single env template for server + gateway (root)
  package.json                # workspaces: server, blockchain, gateway, admin, client (React 19 pinned at root)
  server/                     # backend (Node 22, TypeScript, Express 5)
    src/
      index.ts                # dotenv loading, config validation, retry interval
      server.ts               # createApp(), CORS, body limits, adminAuth
      config.ts               # loadConfig(), getConfig(), ADMIN_KEY, CORS_ORIGINS
      shared.ts               # EXPECTED_SRAM_HEX_LEN, FIRMWARE_HASH_REGEX
      deviceStore.ts          # in-memory Maps + bounded Logs (canonical storage)
      crypto/kyber.ts         # MlKem768 + HKDF-SHA256 → AES-256-GCM
      repos/                  # DeviceRepository, KeyVault, LogRepository, NewDeviceStore
      services/               # DeviceService, MessageService, BlockchainService
      middleware/adminAuth.ts # X-Admin-Key gate for /admin/*
      routeHandler.ts         # file-system router (Next.js style)
      routers/
        client/               # device, message, encrypt, metadata, publicKey
        admin/                # logs, new, retry
      types.ts                # Device, Message, LogEntry
    package.json
    tsconfig.json
  gateway/                    # stateless firewall (TypeScript, Express 5)
    src/
      index.ts                # dotenv, initGateway(), listen
      app.ts                  # createGatewayApp(), /data, /encrypt, /admin/block
      config.ts               # forwardBase, blockThresholdBits, fetchTimeoutMs
      pufVerifier.ts          # parseSramHex, verifySram
      blockedStore.ts         # blockedDevices persisted to data.json only
      pendingStore.ts         # rate-limited pending approvals (30s cooldown, 5m TTL)
      fetchUtil.ts            # fetchWithTimeout
      shared.ts               # mirrors server shared constants
    package.json
    tsconfig.json
    data.json                 # generated at runtime, gitignored (blockedDevices only)
    index.legacy.js           # pre-refactor 509-line JS kept for reference
  blockchain/
    contracts/HashStorage.sol # Solidity 0.8.20
    scripts/deploy.js         # hardhat deploy
    hardhat.config.js         # amoy network
  admin/                      # operator console (Vite + React 19, :8080)
    src/
      lib/api.ts              # API_BASE=VITE_API_BASE, X-Admin-Key, gatewayFetch
      hooks/use-api.ts        # useDevices, usePendingDevice, useBlockDevice, useGatewayStatus
      components/             # PendingDeviceCard, AddDeviceDialog (zod 1024/64 hex), masked PUF
      pages/                  # Dashboard, Devices, Logs (pagination, Polygonscan tx links)
    .env.example              # VITE_API_BASE, VITE_GATEWAY_BASE, VITE_ADMIN_KEY
  client/                     # self-service registry (Next 15 + React 19, :9002)
    src/
      lib/api.ts              # NEXT_PUBLIC_API_BASE, ApiError, admin:true flag
      hooks/                  # use-pagination, use-gateway (read-only)
      app/                    # Home (poll /admin/new, enroll, paginated cards), devices/[id]
      components/devices/     # DeviceCard, MacInput
    .env.example              # NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_GATEWAY_BASE, NEXT_PUBLIC_ADMIN_KEY
    next.config.ts            # rewrites /client/* and /admin/* to API_BASE, outputFileTracingRoot
  esp/                        # firmware (PlatformIO, Arduino)
    platformio.ini            # env:esp8266, env:esp32, env:esp32c3
    include/
      config.h.example        # copy to config.h (gitignored)
      config.h                # local WiFi + hosts (not committed)
      puf.h
      wifi_utils.h
      gateway_client.h
    src/
      main.cpp                # setup/loop, publicKey resolution, encrypt→data
      puf.cpp                 # 512B PUF generation, hex encoding
      wifi_utils.cpp          # WiFi connect, MAC/IP helpers
      gateway_client.cpp      # /encrypt, /publicKey, /data HTTP clients
    main.c                    # legacy single-file 243 lines (reference)
```

## Components

### Server

The server is the authoritative store. It does not use a database in the MVP. All routers delegate to services and repositories.

*   `repos/DeviceRepository.ts` and `repos/KeyVault.ts` isolate `deviceStore` and `secretKeys`. `repos/LogRepository.ts` bounds `Logs` to 10,000 entries. `repos/NewDeviceStore.ts` holds the last `POST /admin/new` payload.
*   `services/DeviceService.ts` creates devices with `generateKyberKeyPair()` (1184B publicKey) and `crypto.randomInt` IDs. `services/MessageService.ts` decrypts with `decapKyberCiphertext` + `HKDF-SHA256` derived `AES-256-GCM`, hashes `{ data, timestamp, deviceId }` with SHA-256, and calls `services/BlockchainService.ts`.
*   `services/BlockchainService.ts` provides `anchorHash()` (fire-and-forget, queues to `pendingHashes` on failure) and `retryPending()` invoked every 30 seconds at startup and via `POST /admin/retry`. Previously `retryPendingHashes` was never scheduled.
*   `crypto/kyber.ts` derives the AES key with `hkdfSync('sha256', sharedSecret, salt=empty, info='EmbSec-AES256GCM', 32)` instead of raw `SHA-256`. `encryptKyberAesGcmToBase64` and `decryptKyberAesGcmToString` validate IV 12B and payload length.
*   `server.ts` applies `CORS` (restricted when `CORS_ORIGINS` is set), `express.json` limit 50kb, and `adminAuth` on `/admin/*` when `ADMIN_KEY` is configured. `config.ts` validates ports and thresholds. `routeHandler.ts` maps `src/routers/**/*.ts` to Express routes.

See `server/README.md` for full API reference.

### Gateway

The gateway is a thin TypeScript proxy with no device registry. It keeps only the operator blocklist.

*   Validates `X-MAC-Address` and `X-SRAM-Data` (exact 1024 hex chars) and blocks with Hamming distance on `blockedDevices`.
*   On `POST /data` it fetches `GET /client/metadata` from `FORWARD_BASE` (fail-closed 502 on error or timeout 5s), looks up `mac` or `puf === sramHex`, forwards to `POST /client/message` if found, otherwise notifies `POST /admin/new` with `{ puf: sramHex, mac, firmwareHash }` (derived as `SHA-256(sramHex)` if not supplied) and returns 403 `pending_approval`. Notifications are rate-limited to one per 30 seconds per PUF with 5 minute TTL.
*   `POST /encrypt` is a shim that proxies to `FORWARD_BASE/client/encrypt` so ESP hard-coded encrypt URLs work regardless of host.
*   `POST /admin/block` and `DELETE /admin/block` manage the persistent blocklist in `gateway/data.json` (migrates legacy files that contained a `devices` array).

### ESP Firmware

PlatformIO project building for both ESP8266 and ESP32 from one codebase.

*   `platformio.ini` defines `env:esp8266` (espressif8266, board nodemcuv2), `env:esp32` (espressif32, board esp32dev), `env:esp32c3`, with `bblanchon/ArduinoJson@6.21.3`. `default_envs = esp32`.
*   `include/config.h` (gitignored) holds `WIFI_SSID`, `WIFI_PASSWORD`, `GATEWAY_HOST`, `GATEWAY_PORT`, `SERVER_HOST`, `SERVER_PORT`, `HARDCODED_PUBLIC_KEY`, timeouts. Copy `config.h.example` to create it.
*   `puf.cpp` generates 512B once at boot (`esp_random()` on ESP32, `analogRead(A0) ^ os_random()` on ESP8266) and exposes `puf_toHex()` for the 1024-char header.
*   `wifi_utils.cpp` handles STA connect with `WIFI_CONNECT_TIMEOUT_MS` 15s.
*   `gateway_client.cpp` implements `gateway_encrypt`, `gateway_encryptViaMac`, `gateway_fetchPublicKey`, and `gateway_sendData` with `HTTPClient` differences abstracted for ESP8266 (`WiFiClient` + `begin(client, url)`) and ESP32 (`begin(url)`).
*   `src/main.cpp` resolves the public key in order hardcoded → cached → `POST /client/publicKey {mac}` via `SERVER_HOST`, falls back to `gateway_encryptViaMac` (server resolves by mac), then loops every `LOOP_INTERVAL_MS` 5s: `wifi_isConnected` → `puf_toHex` → `plaintext {mac, sram}` → encrypt → `POST /data` with `X-MAC-Address` and `X-SRAM-Data`.

### Admin Console

Operator UI on Vite `:8080` with React 19, `admin/src/lib/api.ts:1` (`VITE_API_BASE` default `3000`, `VITE_GATEWAY_BASE` default `8824`) and `X-Admin-Key` header. Polls `GET /admin/new` every 5s (like gateway `shouldNotifyAdmin` 30s cooldown), surfaces `PendingDeviceCard` with Approve flow pre-filling `AddDeviceDialog` validated by `zod` `MAC_REGEX` / `HEX_1024` / `HEX_64`. Masks `PUF` and `publicKey` with `Reveal/Hide`, confirms `DELETE /client/device?id=` via `AlertDialog`, and drives gateway `POST /admin/block` / `DELETE /admin/block?mac=` (+ `GET /` blockedDevices) with `gatewayFetch` and `CORS` (`gateway/src/app.ts:14`). `Dashboard` shows `pending` from `GET /admin/retry` and `blockedDevices.length`.

### Client Registry

Self-service UI on Next 15 `:9002` with `client/src/lib/api.ts:1` (`NEXT_PUBLIC_API_BASE` default `3000`). Same server API via `next.config.ts:4` `rewrites` (`/client/*` and `/admin/*` → `API_BASE`) so `9002` never hardcodes `6767`. Polls `GET /admin/new` with `admin:true` every 5s, enrolls via `POST /client/device`, deletes via `DELETE /client/device?id=` (proxy-safe, `server/src/routers/client/device.ts:26` supports `?id=`), paginates device cards with `usePagination` (8/page, `client/src/hooks/use-pagination.ts:1`). Shows gateway `GET /` blocked count read-only with note `Client is read-only for blocks — use admin (8080)`. Masks `PUF` in lastRegistered payload and validates `deviceName` (1–64 chars) before enroll.

### Blockchain

`blockchain/contracts/HashStorage.sol` stores `Record { sender, timestamp, hash, metadata }` in `records` with `storeHash(string hash, string metadata)` and event `HashStored`. Deployment targets Polygon Amoy. The server loads the ABI from `blockchain/artifacts/contracts/HashStorage.sol/HashStorage.json` and uses `ethers.JsonRpcProvider` and `Wallet`.

## Security Properties

*   Post-quantum confidentiality with ML-KEM-768 encapsulation plus HKDF-derived AES-256-GCM. Shared secret never used directly.
*   Device identity via SRAM PUF with exact length enforcement (prevents truncation to 2-char match) and Hamming threshold 350 bits out of 4096 for noise tolerance.
*   Fail-closed gateway: metadata fetch failure or timeout yields 502 and does not forward.
*   No secrets in repository: WiFi credentials and hosts live in `esp/include/config.h` and root `.env`. `ADMIN_KEY` gates `server /admin/*` via `X-Admin-Key` and `gateway` forwards with the same header when set. `CORS_ORIGINS` restricts browser origins.
*   Bounded logs, body limit 50kb, fire-and-forget chain anchoring so Polygon latency does not block device responses.

## Configuration

Server and gateway share a single `.env` at the repository root. UIs have their own `client/.env` and `admin/.env` (both gitignored, see `.env.example`). Copy each and fill values.

```bash
cp .env.example .env
cp admin/.env.example admin/.env
cp client/.env.example client/.env
```

| Variable | Default | Used by | Description |
| --- | --- | --- | --- |
| `SERVER_PORT` | 3000 | server | Express listen port |
| `CORS_ORIGINS` | `http://localhost:8080,http://localhost:9002` | server | Comma list of allowed origins, empty means permissive |
| `ADMIN_KEY` | empty (open) | server, gateway | When set, `X-Admin-Key` required for `/admin/*` and gateway uses it for `/admin/new` |
| `GATEWAY_PORT` | 8824 | gateway | Gateway listen port |
| `FORWARD_BASE` | http://localhost:3000 | gateway | Server base URL the gateway forwards to |
| `BLOCK_THRESHOLD_BITS` | 350 | gateway, server shared | Hamming distance to treat two SRAM readings as same device |
| `GATEWAY_FETCH_TIMEOUT_MS` | 5000 | gateway | Timeout for gateway to server fetches |
| `AMOY_RPC_URL` | https://rpc-amoy.polygon.technology | server, blockchain | Polygon Amoy RPC |
| `PRIVATE_KEY` | empty | server, blockchain | EOA for `HashStorage.storeHash`; also `AMOY_PRIVATE_KEY` alias |
| `CONTRACT_ADDRESS` | empty | server | Deployed `HashStorage` address; server queues hashes while unset |
| `VITE_API_BASE` | `http://localhost:3000` | admin | Server base URL, injected into fetch; admin polls `/admin/new` every 5s |
| `VITE_GATEWAY_BASE` | `http://localhost:8824` | admin | Gateway base for `GET /` and `/admin/block` (CORS enabled in gateway) |
| `VITE_ADMIN_KEY` | empty | admin | Sent as `X-Admin-Key` for `/admin/*` and gateway block; must match root `ADMIN_KEY` |
| `NEXT_PUBLIC_API_BASE` | `http://localhost:3000` | client | Server base URL, used by `lib/api.ts` and `next.config.ts` rewrites |
| `NEXT_PUBLIC_GATEWAY_BASE` | `http://localhost:8824` | client | Read-only `GET /` blocked count display |
| `NEXT_PUBLIC_ADMIN_KEY` | empty | client | Sent as `X-Admin-Key` for `GET /admin/new` poll when set |

ESP firmware uses `esp/include/config.h` instead of `.env`:

| Define | Example | Description |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASSWORD` | AYULAPTOP | WiFi credentials |
| `GATEWAY_HOST` / `GATEWAY_PORT` | 10.10.11.3:8824 | Gateway host for `/data` and `/encrypt` |
| `GATEWAY_DATA_PATH` / `GATEWAY_ENCRYPT_PATH` | /data, /encrypt | Paths appended to gateway host |
| `SERVER_HOST` / `SERVER_PORT` | 10.10.11.3:3000 | Server host for `POST /client/publicKey` fetch |
| `HARDCODED_PUBLIC_KEY` | "" | If non-empty, firmware uses it directly. Leave empty to fetch by mac at runtime (recommended) |
| `WIFI_CONNECT_TIMEOUT_MS` | 15000 | WiFi connect deadline |
| `HTTP_TIMEOUT_MS` | 5000 | HTTPClient timeout |
| `LOOP_INTERVAL_MS` | 5000 | Delay between telemetry loops |

## Installation

Requirements: Node.js 20 or newer, npm 10+, PlatformIO Core for ESP, and for blockchain an Amoy RPC and funded private key. React 19 is pinned at the monorepo root (`overrides`) so `admin`, `client`, and `Next 15` dedupe correctly.

```bash
# 1. Install all Node workspaces from root
npm install

# 2. Configure environment
cp .env.example .env
cp admin/.env.example admin/.env
cp client/.env.example client/.env
# edit .env: set PRIVATE_KEY, CONTRACT_ADDRESS after deploy, ADMIN_KEY, etc.
# edit admin/.env and client/.env: set VITE_* / NEXT_PUBLIC_* to http://localhost:3000 and ADMIN_KEY if set

# 3. Configure ESP
cp esp/include/config.h.example esp/include/config.h
# edit esp/include/config.h: set WIFI_SSID, GATEWAY_HOST, etc.
```

## Running

### Server

```bash
# Development with auto-reload
npm run server:dev
# Build and start compiled output
npm run build -w server && npm start -w server
# Direct
npm run dev -w server    # nodemon + ts-node src/index.ts
npm start -w server      # node dist/index.js
```

Server starts on `SERVER_PORT`, registers file-system routes under `src/routers`, and starts the blockchain retry interval (30s). Logs warn if `PRIVATE_KEY` or `CONTRACT_ADDRESS` are unset.

### Gateway

```bash
npm run build -w gateway && npm start -w gateway
# or dev
npm run dev -w gateway   # ts-node/esm src/index.ts
# or monorepo helper
npm run gateway:start
```

Gateway listens on `GATEWAY_PORT`, loads `data.json` (blockedDevices only, migrates old files), proxies to `FORWARD_BASE`, and enables `CORS` for admin/client.

### Admin Console

```bash
# Development :8080 with proxy for /client and /admin to VITE_API_BASE
npm run admin:dev        # or npm run dev -w admin
# Production bundle (chunked: vendor/query/ui)
npm run admin:build      # vite build -> dist/
npm run preview -w admin # serve dist on 4173
```

Admin polls `GET /admin/new` every 5s, approves via `PendingDeviceCard` → `AddDeviceDialog` → `POST /client/device`, blocks via `POST /admin/block` (1024 hex `sram`) on `VITE_GATEWAY_BASE`, paginates `Logs` and `Devices`, and shows masked `PUF`/`publicKey` with `Reveal/Hide`. Set `VITE_ADMIN_KEY` to match root `ADMIN_KEY` or `401 Unauthorized` is shown.

### Client Registry

```bash
# Development :9002 with Turbopack and rewrites /client/* /admin/* → NEXT_PUBLIC_API_BASE
npm run client:dev       # or npm run dev -w client
# Production (strict types, no ignoreBuildErrors)
npm run client:build     # next build
npm run start -w client  # next start on 3000 (or 9002 via -p)
```

Client is self-service: polls `GET /admin/new` (`admin:true` header) every 5s, enrolls `POST /client/device`, lists `GET /client/metadata` (paginated 8/page), views `devices/[id]` (`GET /client/message?id=`), shows `GATEWAY BLOCKED: n` read-only and validates `deviceName` 1–64 chars. No gateway block privileges (use admin).

Run all three UIs together:

```bash
npm run server:dev & npm run gateway:start & npm run admin:dev & npm run client:dev
# server 3000, gateway 8824, admin 8080, client 9002
```

### Blockchain

```bash
cd blockchain
npm run compile   # hardhat compile → artifacts/
npm run deploy    # hardhat run scripts/deploy.js --network amoy
# copy printed address into CONTRACT_ADDRESS in root .env and restart server
```

### ESP Firmware

```bash
cd esp

# ESP32 (default environment)
pio run -e esp32
pio run -e esp32 -t upload --upload-port /dev/cu.usbserial-0001
pio device monitor -b 115200

# ESP8266
pio run -e esp8266
pio run -e esp8266 -t upload --upload-port /dev/cu.wchusbserial-*
```

The firmware prints PUF hex length, connect status, encrypt result, and data POST response. On first boot for an unknown device the gateway returns 403 `pending_approval` and notifies `POST /admin/new`. Register the device via the server, then the next loop will be verified and forwarded:

```bash
curl -s http://localhost:3000/admin/new | jq
curl -s -X POST http://localhost:3000/client/device \
  -H 'Content-Type: application/json' \
  -d '{"name":"sensor-01","puf":"<1024 hex from logs>","mac":"AA:BB:CC:DD:EE:FF","firmwareHash":"<64 hex sha256>"}' | jq
```

Alternatively let the gateway auto-derive `firmwareHash` as `SHA-256(sramHex)` when not supplied by the ESP header.

## API Reference

Full request and response shapes are in `server/README.md`. Summary:

*   `POST /client/device` `{ name, puf, mac, firmwareHash }` → 201 `Device` with `publicKey`
*   `DELETE /client/device?id=10001` → 200 (query, proxy-safe; body `{id}` still supported)
*   `POST /client/encrypt` `{ publicKey or mac or id, plaintext }` → 200 `{ kyberCiphertextBase64, ivBase64, payloadCiphertextBase64 }`
*   `POST /client/message` `{ id, data or payloadCiphertextBase64, kyberCiphertextBase64, ivBase64 }` → 201 `Message { data, timestamp, hash, sender, hashStored }`
*   `GET /client/message?id=10001` → 200 `Message[]`
*   `GET /client/metadata` → 200 `Device[]`
*   `POST /client/publicKey` `{ mac }` → 200 `{ publicKey }`
*   `GET /admin/logs` → 200 `{ devices, logs }` (admin auth when `ADMIN_KEY` set)
*   `GET /admin/new` → 200 `NewDeviceRecord | null`
*   `POST /admin/new` `{ mac, puf, firmwareHash: 64 hex }` → 200 `{ newDeviceDetected }`
*   `GET /admin/retry` → 200 `{ pending }`
*   `POST /admin/retry` → 200 `{ retried, pending }`

Gateway proxies:

*   `POST /encrypt` → `FORWARD_BASE/client/encrypt`
*   `POST /data` → validates PUF then `FORWARD_BASE/client/message` (headers `X-MAC-Address`, `X-SRAM-Data`, optional `X-Firmware-Hash`)
*   `POST /admin/block` `{ sram: 1024 hex, mac }` → 201 (Hamming-aware block, `X-Admin-Key` when set)
*   `DELETE /admin/block?mac=&sram=` → removes block entry (query, proxy-safe)
*   `GET /` → `{ status, blockedDevices }` (CORS enabled, read by admin `useGatewayStatus` and client read-only)

## Operational Notes

*   Server retry interval runs every 30 seconds for `pendingHashes`. `POST /admin/retry` can be called manually to drain the queue and inspect `pending` count. `GET /admin/logs` shows `HASH_STORED`, `HASH_STORE_FAILED`, `HASH_RETRY` events.
*   Gateway pending approvals are rate-limited. Repeated `POST /data` from the same unknown PUF within 30 seconds reuses the first `POST /admin/new` notification and still returns 403 until the device is created on the server.
*   Logs are in-memory bounded to 10,000 entries. Restarting server or gateway clears devices and logs; gateway additionally clears `data.json` only for `blockedDevices`. Persisting devices requires moving `repos/DeviceRepository` to a real store (interface already exists for that swap).

## Troubleshooting

*   `HashStorage artifact not found` → run `npm run compile -w blockchain`.
*   `Missing AMOY_PRIVATE_KEY or PRIVATE_KEY` → set `PRIVATE_KEY` in root `.env`.
*   Gateway `502 Metadata verification failed` → check `FORWARD_BASE` points to a running server and `SERVER_PORT` matches. Gateway is fail-closed by design.
*   `Invalid SRAM hex payload. Expected 1024 hex chars` → ESP `puf_toHex()` must produce uppercase hex without separators. Check Serial PUF dump length.
*   ESP `Encrypt failed` or `404 Device not found` → device not yet created via `POST /client/device`. Check `GET /admin/new` for the pending PUF and register it.

