# EmbSecServer Monorepo

This project is a secure server implementation for embedded systems, integrating blockchain for data integrity and post-quantum cryptography for secure communication.

## Repository Structure

- `server/`: The main backend server (Node.js/TypeScript).
- `blockchain/`: Smart contracts and deployment scripts (Hardhat/Solidity).
- `gateway/`: A lightweight gateway for device management and traffic filtering.
- `esp/`: Firmware code for ESP32 devices.

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

Install dependencies for all packages from the root:

```bash
npm install
```

### Components

#### Server
The server handles device registration, message storage, and uses ML-KEM-768 for secure key exchange.
See [server/README.md](server/README.md) for API details.

#### Blockchain
Stores transaction hashes on-chain to ensure data immutability.
```bash
cd blockchain
npm run compile
npm run deploy
```

#### Gateway
Acts as a proxy/firewall for devices.
```bash
cd gateway
npm start
```

#### ESP
Firmware implementation in C for ESP32 devices.
