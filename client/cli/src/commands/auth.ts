import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CurrentUser } from "@blogus/shared";
import type { Command } from "commander";
import { clearToken, readConfig, writeConfig } from "../lib/config.js";
import { apiRequest } from "../lib/http.js";

async function promptMissingCredentials(options: { email?: string; password?: string }) {
  if (options.email && options.password) {
    return { email: options.email, password: options.password };
  }

  const terminal = createInterface({ input, output });
  try {
    const email = options.email ?? (await terminal.question("Email: "));
    const password =
      options.password ?? process.env.BLOGUS_PASSWORD ?? (await terminal.question("Password: "));

    return { email, password };
  } finally {
    terminal.close();
  }
}

export function registerAuthCommands(program: Command) {
  program
    .command("login")
    .description("Authorize the CLI with an email/password or access token")
    .option("-e, --email <email>", "Admin email")
    .option("-p, --password <password>", "Admin password; can also use BLOGUS_PASSWORD")
    .option("-t, --token <token>", "Existing access token")
    .action(async (options: { email?: string; password?: string; token?: string }) => {
      const config = await readConfig();

      if (options.token) {
        await writeConfig({ ...config, token: options.token });
        console.log("Token saved");
        return;
      }

      const credentials = await promptMissingCredentials(options);
      const result = await apiRequest<{ user: CurrentUser; accessToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      await writeConfig({ ...config, token: result.accessToken });
      console.log(`Logged in as ${result.user.email}`);
    });

  program.command("logout").description("Clear the stored CLI token").action(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // Local logout should still succeed when the server is unavailable or the token is already invalid.
    }
    await clearToken();
    console.log("Logged out");
  });

  program.command("whoami").description("Show the current authenticated user").action(async () => {
    const result = await apiRequest<{ user: unknown }>("/api/auth/whoami");
    console.log(JSON.stringify(result.user, null, 2));
  });
}
