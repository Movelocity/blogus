import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CurrentUser, InviteCode } from "@blogus/shared";
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

async function promptMissingRegistration(options: {
  email?: string;
  password?: string;
  name?: string;
  inviteCode?: string;
}) {
  if (options.email && options.password) {
    return {
      ...options,
      inviteCode: options.inviteCode ?? process.env.BLOGUS_INVITE_CODE
    };
  }

  const terminal = createInterface({ input, output });
  try {
    const email = options.email ?? (await terminal.question("Email: "));
    const password =
      options.password ?? process.env.BLOGUS_PASSWORD ?? (await terminal.question("Password: "));

    return {
      email,
      password,
      name: options.name,
      inviteCode: options.inviteCode ?? process.env.BLOGUS_INVITE_CODE
    };
  } finally {
    terminal.close();
  }
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer");
  }

  return parsed;
}

export function registerAuthCommands(program: Command) {
  program
    .command("login")
    .description("Authorize the CLI with an email/password or access token")
    .option("-e, --email <email>", "User email")
    .option("-p, --password <password>", "User password; can also use BLOGUS_PASSWORD")
    .option("-t, --token <token>", "Existing access token")
    .action(async (options: { email?: string; password?: string; token?: string }) => {
      const config = await readConfig();

      if (options.token) {
        await writeConfig({ ...config, token: options.token });
        console.log("Token saved");
        return;
      }

      const credentials = await promptMissingCredentials(options);
      const result = await apiRequest<{ user: CurrentUser; accessToken: string; refreshToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      await writeConfig({ ...config, token: result.accessToken, refreshToken: result.refreshToken });
      console.log(`Logged in as ${result.user.email} (${result.user.role})`);
    });

  program
    .command("register")
    .description("Register a user. The first registered user becomes admin.")
    .option("-e, --email <email>", "User email")
    .option("-p, --password <password>", "User password; can also use BLOGUS_PASSWORD")
    .option("-n, --name <name>", "Display name")
    .option("-i, --invite-code <code>", "Invite code; can also use BLOGUS_INVITE_CODE")
    .action(
      async (options: { email?: string; password?: string; name?: string; inviteCode?: string }) => {
        const config = await readConfig();
        const input = await promptMissingRegistration(options);
        const result = await apiRequest<{ user: CurrentUser; accessToken: string; refreshToken: string }>("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(input)
        });

        await writeConfig({ ...config, token: result.accessToken, refreshToken: result.refreshToken });
        console.log(`Registered ${result.user.email} (${result.user.role})`);
      }
    );

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

  const invite = program.command("invite").description("Manage invite codes; requires admin");

  invite.command("list").description("List invite codes").action(async () => {
    const result = await apiRequest<{ invites: InviteCode[] }>("/api/auth/invites");
    console.log(JSON.stringify(result.invites, null, 2));
  });

  invite
    .command("create")
    .description("Create an invite code")
    .option("-c, --code <code>", "Custom invite code")
    .option("--max-uses <count>", "Maximum number of uses", parsePositiveInteger)
    .option("--expires-at <iso>", "ISO datetime after which the code expires")
    .action(async (options: { code?: string; maxUses?: number; expiresAt?: string }) => {
      const result = await apiRequest<{ invite: InviteCode }>("/api/auth/invites", {
        method: "POST",
        body: JSON.stringify(options)
      });
      console.log(JSON.stringify(result.invite, null, 2));
    });

  invite
    .command("disable <id>")
    .description("Disable an invite code by id")
    .action(async (id: string) => {
      const result = await apiRequest<{ invite: InviteCode }>(`/api/auth/invites/${id}/disable`, {
        method: "POST"
      });
      console.log(JSON.stringify(result.invite, null, 2));
    });
}
