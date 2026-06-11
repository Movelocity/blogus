import { basename } from "node:path";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

export function registerUploadCommands(program: Command) {
  program
    .command("upload")
    .description("Upload an image and print its URL")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      const result = await apiRequest<{ url: string | null; message?: string }>("/api/upload", {
        method: "POST",
        body: JSON.stringify({ filename: basename(path) })
      });
      console.log(result.url ?? result.message ?? "Upload placeholder");
    });
}
