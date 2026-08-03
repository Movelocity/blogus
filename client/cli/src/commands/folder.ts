import type { BlogFolder } from "@blogus/shared";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

export async function fetchFolders() {
  const result = await apiRequest<{ folders: BlogFolder[] }>("/api/folders");
  return result.folders;
}

export async function resolveFolderId(name: string) {
  const folders = await fetchFolders();
  const match = folders.find((f) => f.name === name);
  if (!match) {
    throw new Error(`Folder not found: ${name}. Create it first: blogus-cli folder create "${name}"`);
  }
  return match.id;
}

export function registerFolderCommands(program: Command) {
  const folder = program.command("folder").description("Manage folders");

  folder
    .command("list")
    .description("List folders")
    .action(async () => {
      const folders = await fetchFolders();
      for (const item of folders) {
        console.log(`${item.id}\t${item.name}`);
      }
    });

  folder
    .command("create")
    .description("Create a folder")
    .argument("<name>", "Folder name")
    .action(async (name: string) => {
      const result = await apiRequest<{ folder: BlogFolder }>("/api/folders", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      console.log(result.folder.id);
    });

  folder
    .command("rename")
    .description("Rename a folder")
    .argument("<id>", "Folder id")
    .argument("<name>", "New folder name")
    .action(async (id: string, name: string) => {
      await apiRequest(`/api/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      console.log("Renamed");
    });

  folder
    .command("delete")
    .description("Delete a folder (posts inside return to the root)")
    .argument("<id>", "Folder id")
    .action(async (id: string) => {
      await apiRequest(`/api/folders/${id}`, { method: "DELETE" });
      console.log("Deleted");
    });
}
