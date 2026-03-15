# API Reference

All request and response bodies use `Content-Type: application/json`.

### Data Models

#### Device

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique 5-digit device identifier (10000–99999) |
| `name` | `string` | Human-readable device name |
| `puf` | `string` | Physically Unclonable Function identifier |
| `mac` | `string` | Device MAC address |
| `publicKey` | `string` | Base64-encoded ML-KEM-768 public key |
| `messages` | `Message[]` | Array of messages stored for this device |
| `registeredAt` | `number` | Unix timestamp in milliseconds of registration |
| `firmwareHash` | `string` | Hash of the device firmware for integrity verification |

#### Message

| Field | Type | Description |
|---|---|---|
| `data` | `string` | Decrypted message payload |
| `timestamp` | `number` | Unix timestamp in milliseconds when the message was stored |
| `hash` | `string` | SHA-256 hex digest of `{ data, timestamp, deviceId }` — also stored on-chain |
| `sender` | `string` | Device ID of the sender |

#### LogEntry

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Event name such as `DEVICE_CONNECT`, `DEVICE_DISCONNECT`, `DECRYPTION`, `MESSAGE_RETRIEVAL`, `METADATA_LIST`, `NEW_DEVICE_DETECTED`, or `NEW_DEVICE_FETCH` |
| `value` | `any` | Event payload (e.g., the device object when a device connects, message metadata after decryption, logs snapshots, etc.) |
| `timestamp` | `number` | Unix timestamp (ms) when the log entry was recorded |
| `id` | `string` \| `null` | Device ID associated with the event (`null` when no specific device applies) |

---

### Client Endpoints

#### POST /client/device

Registers a new device. Generates a unique 5-digit ID and an ML-KEM-768 key pair for the device.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Device name |
| `puf` | `string` | Yes | PUF identifier |
| `mac` | `string` | Yes | MAC address |
| `firmwareHash` | `string` | Yes | Firmware hash |

**Responses**

| Status | Description |
|---|---|
| `201 Created` | Device registered successfully — returns the new `Device` object |
| `400 Bad Request` | A required field is missing or has the wrong type |
| `500 Internal Server Error` | Unable to allocate a unique device ID |

**Example Request**

```json
POST /client/device
Content-Type: application/json

{
  "name": "sensor-01",
  "puf": "a3f1c2d4e5...",
  "mac": "AA:BB:CC:DD:EE:FF",
  "firmwareHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

**Example Response**

```json
HTTP/1.1 201 Created

{
  "id": "42731",
  "name": "sensor-01",
  "puf": "a3f1c2d4e5...",
  "mac": "AA:BB:CC:DD:EE:FF",
  "publicKey": "<base64-encoded ML-KEM-768 public key>",
  "messages": [],
  "registeredAt": 1710000000000,
  "firmwareHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

#### DELETE /client/device

Removes a registered device and its associated secret key.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` \| `number` | Yes | 5-digit device ID |

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Device deleted — returns `{ "deleted": true, "id": "<id>" }` |
| `400 Bad Request` | `id` is not a valid 5-digit numeric value |
| `404 Not Found` | No device exists with the given ID |

**Example Request**

```json
DELETE /client/device
Content-Type: application/json

{
  "id": "42731"
}
```

**Example Response**

```json
HTTP/1.1 200 OK

{
  "deleted": true,
  "id": "42731"
}
```

---

#### POST /admin/new

Registers the next “new device detected” payload so other components can react before the device is formally persisted. The payload must match the `NewDeviceRecord` shape stored in the log tracking system.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `mac` | `string` | Yes | Device MAC address |
| `puf` | `string` | Yes | PUF identifier |
| `firmwareHash` | `string` | Yes | Firmware hash |

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Returns `{ "newDeviceDetected": NewDeviceRecord }` when the payload is accepted |
| `400 Bad Request` | Missing/invalid fields |

**Example Request**

```json
POST /admin/new
Content-Type: application/json

{
  "mac": "AA:BB:CC:DD:EE:FF",
  "puf": "puf-identifier",
  "firmwareHash": "deadbeef..."
}
```

**Example Response**

```json
HTTP/1.1 200 OK

{
  "newDeviceDetected": {
    "mac": "AA:BB:CC:DD:EE:FF",
    "puf": "puf-identifier",
    "firmwareHash": "deadbeef..."
  }
}
```

#### GET /admin/new

Returns the last registered `newDeviceDetected` payload so callers can inspect it before acting; if no payload has been set, the response is `null`.

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Returns the current `newDeviceDetected` value (or `null`) |

**Example Request**

```
GET /admin/new
```

**Example Response**

```json
HTTP/1.1 200 OK

{
  "mac": "AA:BB:CC:DD:EE:FF",
  "puf": "puf-identifier",
  "firmwareHash": "deadbeef..."
}
```

---

#### POST /client/message

Sends an encrypted message to a registered device. The server decrypts the payload using the device's ML-KEM-768 secret key and AES-256-GCM, then stores a SHA-256 hash of the message on the Polygon Amoy blockchain for an immutable audit trail.

The client must encrypt the message using the device's `publicKey` (returned at registration) with the following hybrid scheme:
1. Encapsulate a shared secret using ML-KEM-768 with the device's public key → produces `kyberCiphertextBase64` and a shared secret.
2. Derive an AES-256-GCM key from the shared secret.
3. Encrypt the plaintext payload with AES-256-GCM → produces `data` (base64 of `ciphertext ‖ tag`) and `ivBase64`.

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` \| `number` | Yes | 5-digit device ID |
| `data` | `string` | Yes | Base64-encoded AES-256-GCM ciphertext concatenated with the 16-byte authentication tag (`ciphertext ‖ tag`) |
| `kyberCiphertextBase64` | `string` | Yes | Base64-encoded ML-KEM-768 encapsulation ciphertext |
| `ivBase64` | `string` | Yes | Base64-encoded 12-byte AES-GCM initialization vector (IV/nonce) |

**Responses**

| Status | Description |
|---|---|
| `201 Created` | Message stored — returns the `Message` object |
| `400 Bad Request` | Missing/invalid fields, or decryption failed |
| `404 Not Found` | No device exists with the given ID |
| `500 Internal Server Error` | Device secret key not found or blockchain error |

**Example Request**

```json
POST /client/message
Content-Type: application/json

{
  "id": "42731",
  "data": "<base64(ciphertext || tag)>",
  "kyberCiphertextBase64": "<base64 ML-KEM-768 ciphertext>",
  "ivBase64": "<base64 IV>"
}
```

**Example Response**

```json
HTTP/1.1 201 Created

{
  "data": "hello from sensor",
  "timestamp": 1710001000000,
  "hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "sender": "42731"
}
```

---

#### GET /client/message

Retrieves all messages stored for a specific device.

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | 5-digit device ID |

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Returns an array of `Message` objects (may be empty) |
| `400 Bad Request` | `id` is not a valid 5-digit numeric value |
| `404 Not Found` | No device exists with the given ID |

**Example Request**

```
GET /client/message?id=42731
```

**Example Response**

```json
HTTP/1.1 200 OK

[
  {
    "data": "hello from sensor",
    "timestamp": 1710001000000,
    "hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "sender": "42731"
  }
]
```

---

#### GET /client/metadata

Returns a list of all registered devices.

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Returns an array of all `Device` objects (may be empty) |

**Example Request**

```
GET /client/metadata
```

**Example Response**

```json
HTTP/1.1 200 OK

[
  {
    "id": "42731",
    "name": "sensor-01",
    "puf": "a3f1c2d4e5...",
    "mac": "AA:BB:CC:DD:EE:FF",
    "publicKey": "<base64-encoded ML-KEM-768 public key>",
    "messages": [],
    "registeredAt": 1710000000000,
    "firmwareHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
]
```

---

### Admin Endpoints

#### GET /admin/logs

Returns both the current device catalog and the chronological `Logs` array. Each `LogEntry` pairs an event `key` with a `value` payload describing the action (e.g. device metadata on `DEVICE_CONNECT` or message details after `DECRYPTION`) and includes `timestamp`/`id` fields for auditability.

**Responses**

| Status | Description |
|---|---|
| `200 OK` | Returns `{ devices: Device[], logs: LogEntry[] }` (each array may be empty) |

**Example Request**

```
GET /admin/logs
```

**Example Response**

```json
HTTP/1.1 200 OK

{
  "devices": [
    {
      "id": "42731",
      "name": "sensor-01",
      "puf": "a3f1c2d4e5...",
      "mac": "AA:BB:CC:DD:EE:FF",
      "publicKey": "<base64-encoded ML-KEM-768 public key>",
      "messages": [
        {
          "data": "hello from sensor",
          "timestamp": 1710001000000,
          "hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          "sender": "42731"
        }
      ],
      "registeredAt": 1710000000000,
      "firmwareHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }
  ],
  "logs": [
    {
      "key": "DEVICE_CONNECT",
      "value": {
        "id": "42731",
        "name": "sensor-01",
        "puf": "a3f1c2d4e5...",
        "mac": "AA:BB:CC:DD:EE:FF",
        "publicKey": "<base64-encoded ML-KEM-768 public key>",
        "messages": [],
        "registeredAt": 1710000000000,
        "firmwareHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      },
      "timestamp": 1710000001000,
      "id": "42731"
    },
    {
      "key": "DECRYPTION",
      "value": {
        "deviceId": "42731",
        "message": {
          "data": "hello from sensor",
          "timestamp": 1710001000000,
          "hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          "sender": "42731"
        }
      },
      "timestamp": 1710001002000,
      "id": "42731"
    }
  ]
}
```

---

## Error Responses

All error responses share a consistent JSON shape:

```json
{
  "error": "<human-readable error message>"
}
```

| Status | Meaning |
|---|---|
| `400 Bad Request` | Invalid or missing input in the request body or query parameters |
| `404 Not Found` | The requested resource (device or route) does not exist |
| `500 Internal Server Error` | An unexpected server-side error occurred |
