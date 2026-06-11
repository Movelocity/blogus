import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Command } from "commander";
import { clearToken, readConfig, writeConfig } from "../lib/config.js";
import { apiRequest } from "../lib/http.js";

function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", url] : [url];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

export function registerAuthCommands(program: Command) {
  program.command("login").description("Authorize the CLI in a browser").action(async () => {
    const config = await readConfig();
    const requestToken = randomUUID();

    const server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      if (requestUrl.pathname !== "/callback") {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const token = requestUrl.searchParams.get("jwt");
      if (!token) {
        response.writeHead(400);
        response.end("Missing jwt parameter");
        return;
      }

      await writeConfig({ ...config, token });
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      response.end("Blogus CLI authorized. You can close this tab.");
      server.close();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const authorizeUrl = `${config.apiBaseUrl}/api/auth/device?port=${port}&token=${requestToken}`;
    console.log(`Opening ${authorizeUrl}`);
    openBrowser(authorizeUrl);
  });

  program.command("logout").description("Clear the stored CLI token").action(async () => {
    await clearToken();
    console.log("Logged out");
  });

  program.command("whoami").description("Show the current authenticated user").action(async () => {
    const result = await apiRequest<{ user: unknown }>("/api/auth/whoami");
    console.log(JSON.stringify(result.user, null, 2));
  });
}
