# EmbSecServer Monorepo

This project is a secure server implementation for embedded systems, integrating blockchain for data integrity and post-quantum cryptography for secure communication.

## Repository Structure

- `server/`: The main backend server (Node.js/TypeScript).
- `blockchain/`: Smart contracts and deployment scripts (Hardhat/Solidity).
- `gateway/`: A lightweight gateway for device management and traffic filtering.
- `esp/`: Firmware code for ESP32 devices.

## Environment Configuration

This monorepo uses a **single `.env` file** at the root of the project to manage configuration for all packages (`server`, `blockchain`, `gateway`).

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Fill in the values in `.env`.

### Variables

- `SERVER_PORT`: Port for the main backend server (default: 3000).
- `GATEWAY_PORT`: Port for the gateway server (default: 8824).
- `FORWARD_BASE`: The URL where the gateway forwards requests (usually your server URL).
- `AMOY_RPC_URL`: Polygon Amoy testnet RPC URL.
- `PRIVATE_KEY`: Private key for blockchain transactions.
- `CONTRACT_ADDRESS`: Address of the deployed `HashStorage` contract.

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
