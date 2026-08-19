import fp from "fastify-plugin";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as schema from "../db/schema.js";

async function ensureDatabaseSchema(client: postgres.Sql) {
  await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await client`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(320) NOT NULL UNIQUE,
      name varchar(120),
      role varchar(24) NOT NULL DEFAULT 'user',
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(24) NOT NULL DEFAULT 'user'
  `;
  await client`
    UPDATE users
    SET role = 'admin'
    WHERE id = (
      SELECT id FROM users ORDER BY created_at ASC LIMIT 1
    )
    AND NOT EXISTS (
      SELECT 1 FROM users WHERE role = 'admin'
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(120) NOT NULL UNIQUE,
      created_by uuid REFERENCES users(id) ON DELETE SET NULL,
      used_count integer NOT NULL DEFAULT 0,
      max_uses integer,
      expires_at timestamptz,
      disabled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS invite_codes_created_by_idx ON invite_codes(created_by)
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
      cover_image_url text,
      tags text[],
      status varchar(24) NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      published_at timestamptz
    )
  `;
  await client`
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS cover_image_url text
  `;
  await client`
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags text[]
  `;
  await client`
    CREATE TABLE IF NOT EXISTS folders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES folders(id) ON DELETE CASCADE,
      name varchar(120) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS folders_user_name_idx ON folders(user_id, name)
  `;
  await client`
    ALTER TABLE posts ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL
  `;
  await client`
    CREATE TABLE IF NOT EXISTS post_date_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      event_date date NOT NULL,
      title varchar(240) NOT NULL,
      slug varchar(260) NOT NULL,
      published_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS post_date_events_event_date_idx ON post_date_events(event_date)
  `;
  await client`
    CREATE INDEX IF NOT EXISTS post_date_events_post_id_idx ON post_date_events(post_id)
  `;
  await client`
    CREATE TABLE IF NOT EXISTS notes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date date NOT NULL,
      content text NOT NULL DEFAULT '',
      is_public boolean NOT NULL DEFAULT false,
      is_archived boolean NOT NULL DEFAULT false,
      tags text[],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await client`
    CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id)
  `;
  await client`
    CREATE INDEX IF NOT EXISTS notes_date_idx ON notes(date)
  `;
}

async function seedDefaultInviteCode(client: postgres.Sql) {
  if (!config.auth.defaultInviteCode) {
    return;
  }

  await client`
    INSERT INTO invite_codes (code)
    VALUES (${config.auth.defaultInviteCode})
    ON CONFLICT (code) DO NOTHING
  `;
}

export const dbPlugin = fp(async (app) => {
  const client = postgres(config.database.url, {
    max: 10,
    idle_timeout: 20,
    onnotice: () => {}
  });

  await ensureDatabaseSchema(client);
  await seedDefaultInviteCode(client);

  app.decorate("db", drizzle(client, { schema }));
  app.addHook("onClose", async () => {
    await client.end();
  });
});
