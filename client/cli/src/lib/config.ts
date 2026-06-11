import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface CliConfig {
  apiBaseUrl: string;
  token?: string;
}

const configPath = join(homedir(), ".blogus-cli", "config.json");

export async function readConfig(): Promise<CliConfig> {
  try {
    const content = await readFile(configPath, "utf8");
    return JSON.parse(content) as CliConfig;
  } catch {
    return {
      apiBaseUrl: process.env.BLOGUS_API_URL ?? "http://127.0.0.1:3001"
    };
  }
}

export async function writeConfig(config: CliConfig) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function clearToken() {
  const config = await readConfig();
  delete config.token;
  await writeConfig(config);
}

export async function removeConfig() {
  await rm(configPath, { force: true });
}
