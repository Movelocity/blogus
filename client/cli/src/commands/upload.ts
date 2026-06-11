import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

export function registerUploadCommands(program: Command) {
  program
    .command("upload")
    .description("Upload an image and print its URL")
    .argument("<path>", "File path")
    .action(async (path: string) => {
      const form = new FormData();
      const buffer = await readFile(path);
      form.append("file", new Blob([new Uint8Array(buffer)]), basename(path));

      const result = await apiRequest<{ file: { url: string } }>("/api/upload", {
        method: "POST",
        body: form
      });
      console.log(result.file.url);
    });
}
