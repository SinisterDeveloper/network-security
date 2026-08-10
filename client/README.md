# @embsec/client

Self-service device registry for EmbSecServer. Polls `GET /admin/new` for unknown devices reported by the gateway and creates them via `POST /client/device`. Complements `@embsec/admin` which is the operator console.

## Setup

```bash
cp .env.example .env
# set NEXT_PUBLIC_API_BASE to http://localhost:3000 and NEXT_PUBLIC_ADMIN_KEY if server has ADMIN_KEY
npm install
npm run dev      # next dev on :9002 with rewrites to API
npm run build    # next build
```

Root monorepo wires `client` via `workspaces`. Use `npm run client:dev` or `client:build` from repo root.

## Stack

Next 15, React 19, TypeScript strict, Tailwind, shadcn-ui.
