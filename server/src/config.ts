function readNumber(name: string, fallback: number) {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function readBoolean(name: string, fallback: boolean) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function readStorageDriver() {
  const value = process.env.STORAGE_DRIVER ?? "local";
  if (value !== "local" && value !== "minio") {
    throw new Error("STORAGE_DRIVER must be either 'local' or 'minio'");
  }
  return value;
}

function readOptionalPair(firstName: string, secondName: string) {
  const first = process.env[firstName];
  const second = process.env[secondName];
  if ((first && !second) || (!first && second)) {
    throw new Error(`${firstName} and ${secondName} must be provided together`);
  }

  return { first, second };
}

function readJwtSecret() {
  const value = process.env.JWT_SECRET ?? "dev-secret";
  if (process.env.NODE_ENV === "production" && value === "dev-secret") {
    throw new Error("JWT_SECRET must be set to a secure value in production");
  }

  return value;
}

export function parseDurationSeconds(value: string) {
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s") as "s" | "m" | "h" | "d";
  const multiplier = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60
  }[unit];

  return amount * multiplier;
}

const adminCredentials = readOptionalPair("BLOGUS_ADMIN_EMAIL", "BLOGUS_ADMIN_PASSWORD");

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  server: {
    host: process.env.HOST ?? "127.0.0.1",
    port: readNumber("PORT", 3009),
    clientOrigin: process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173"
  },
  database: {
    url:
      process.env.DATABASE_URL ??
      "postgres://vault:vault_dev@localhost:5633/vault_page?sslmode=disable"
  },
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379"
  },
  jwt: {
    secret: readJwtSecret(),
    expiry: process.env.JWT_EXPIRY ?? "2h",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "720h"
  },
  auth: {
    adminEmail: adminCredentials.first,
    adminPassword: adminCredentials.second,
    adminName: process.env.BLOGUS_ADMIN_NAME ?? "Blogus Admin",
    enableDevLogin: readBoolean("BLOGUS_ENABLE_DEV_LOGIN", process.env.NODE_ENV !== "production")
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? "localhost:9010",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    bucket: process.env.MINIO_BUCKET ?? "vault-files",
    useSsl: readBoolean("MINIO_USE_SSL", false)
  },
  storage: {
    driver: readStorageDriver(),
    uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
    publicPath: process.env.UPLOAD_PUBLIC_PATH ?? "/uploads"
  },
  upload: {
    maxSizeMb: readNumber("UPLOAD_MAX_SIZE_MB", 512),
    chunkSizeMb: readNumber("UPLOAD_CHUNK_SIZE_MB", 5)
  }
};

export function getMinioEndpointUrl() {
  const protocol = config.minio.useSsl ? "https" : "http";
  return `${protocol}://${config.minio.endpoint}`;
}
