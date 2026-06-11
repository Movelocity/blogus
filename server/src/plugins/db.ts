import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../auth/password.js";
import { config } from "../config.js";
import * as schema from "../db/schema.js";

async function ensureDatabaseSchema(client: postgres.Sql) {
  await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await client`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(320) NOT NULL UNIQUE,
      name varchar(120),
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refresh_token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id)
  `;
  await client`
    CREATE TABLE IF NOT EXISTS posts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title varchar(240) NOT NULL,
      slug varchar(260) NOT NULL UNIQUE,
      content text NOT NULL DEFAULT '',
      excerpt text,
      status varchar(24) NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz
    )
  `;
}

async function seedAdminUser(client: postgres.Sql) {
  if (!config.auth.adminEmail || !config.auth.adminPassword) {
    return;
  }

  const passwordHash = await hashPassword(config.auth.adminPassword);
  await client`
    INSERT INTO users (email, name, password_hash)
    VALUES (${config.auth.adminEmail.toLowerCase()}, ${config.auth.adminName}, ${passwordHash})
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      password_hash = EXCLUDED.password_hash
  `;
}

export const dbPlugin = fp(async (app) => {
  const client = postgres(config.database.url, {
    max: 10,
    idle_timeout: 20
  });

  await ensureDatabaseSchema(client);
  await seedAdminUser(client);

  app.decorate("db", drizzle(client, { schema }));
  app.addHook("onClose", async () => {
    await client.end();
  });
});
