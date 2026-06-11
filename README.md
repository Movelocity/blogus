# Blogus

Blogus is a self-hosted Node.js blog stack based on React, Vite, Fastify, PostgreSQL, Drizzle ORM, and a command-line agent interface.

## Project Layout

```text
client/       React + Vite SPA
client/cli/   blogus-cli agent/developer command line
server/       Fastify API server
shared/       Shared TypeScript types
```

## Development

```bash
pnpm install
cp .env.example .env
docker-compose up -d
pnpm dev
```

The development command starts the Vite client and Fastify server together.

## Scripts

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm --filter @blogus/cli dev -- --help
```

## Notes

- The API server expects PostgreSQL at `DATABASE_URL`.
- The development defaults use PostgreSQL on `localhost:5633`, Redis on `localhost:6379`, and MinIO on `localhost:9010`.
- Uploads are stored in the MinIO `vault-files` bucket through the S3-compatible API.
- Admin/browser auth uses an access token cookie plus a refresh token cookie; `/api/auth/refresh` rotates both tokens.
- The CLI stores its token in `~/.blogus-cli/config.json`.
- Authentication and CRUD routes are scaffolded with development-friendly behavior and should be hardened before production use.
