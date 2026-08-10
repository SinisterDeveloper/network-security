# @embsec/admin

Operator console for EmbSecServer. Talks to `server` at `VITE_API_BASE` (default `http://localhost:3000`) and surfaces gateway-relevant state via server.

## Setup

```bash
cp .env.example .env
# set VITE_API_BASE and VITE_ADMIN_KEY to match server ADMIN_KEY
npm install
npm run dev   # vite on :8080 with proxy for /client and /admin
npm run build # production bundle
```

Monorepo is wired via root `workspaces` (`server`, `blockchain`, `gateway`, `admin`). Use `npm run admin:dev` or `admin:build` from repo root.

## Stack

Vite, React 18, TypeScript, shadcn-ui, Tailwind, TanStack Query, react-hook-form + zod.
