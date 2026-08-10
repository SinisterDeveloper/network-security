# ESP Firmware (Phase 3)

Refactored from monolithic `main.c` to modular PlatformIO project supporting **ESP8266 and ESP32**.

## Structure

```
esp/
  platformio.ini        # env:esp8266, env:esp32, env:esp32c3
  include/
    config.h.example    # copy to config.h (gitignored)
    config.h            # local credentials — not committed
    puf.h
    wifi_utils.h
    gateway_client.h
  src/
    main.cpp            # setup/loop, URL building, encrypt→data flow
    puf.cpp             # 512B pseudo-SRAM, hex encoding
    wifi_utils.cpp      # WiFi connect, MAC/IP helpers
    gateway_client.cpp  # HTTP /encrypt, /publicKey, /data
  main.c                # legacy single-file (kept for reference)
```

## Build

```bash
cd esp
cp include/config.h.example include/config.h  # edit WIFI_SSID, GATEWAY_HOST, etc.

# ESP32 (default)
pio run -e esp32
pio run -e esp32 -t upload --upload-port /dev/cu.usbserial-*

# ESP8266
pio run -e esp8266
pio run -e esp8266 -t upload --upload-port /dev/cu.wchusbserial*
```

Monitor: `pio device monitor -b 115200`

## Config

`include/config.h` holds:
- `WIFI_SSID` / `WIFI_PASSWORD`
- `GATEWAY_HOST` / `GATEWAY_PORT` / paths
- `SERVER_HOST` / `SERVER_PORT` (for `POST /client/publicKey` fetch)
- `HARDCODED_PUBLIC_KEY` — leave empty to fetch at runtime via `POST /client/publicKey {mac}`. Recommended empty for MVP (avoids stale keys after `POST /client/device` re-registration).

Urls are built at runtime, not hardcoded in `main.cpp:14-23`.

## Flow (per loop)

1. `wifi_isConnected()` else `wifi_connect()` (15s timeout, `wifi_utils.cpp:7`)
2. `puf_toHex()` (512B → 1024 hex, stable per boot, `puf.cpp:23`)
3. `plaintext = {mac, sram}` JSON → `resolvePublicKey()` (hardcoded → cached → fetch via `gateway_fetchPublicKey`, `main.cpp:28`)
4. `gateway_encrypt()` or `gateway_encryptViaMac()` → `{kyber, iv, payload}` (`gateway_client.cpp:14`)
5. `gateway_sendData()` → `POST /data` with `X-MAC-Address` + `X-SRAM-Data` + encrypted body (`gateway_client.cpp:71`)

Gateway (Phase 2) is stateless — it verifies PUF via `GET /client/metadata` and forwards to `POST /client/message`.

## Legacy

`esp/main.c` (243 lines, ESP8266WiFi + hardcoded `AYULAPTOP/10.10.11.3` + `publicKey` 1184B) is kept as `main.c` reference. PlatformIO builds `src/*.cpp` only (`src_dir = src`), so legacy file is not compiled.
