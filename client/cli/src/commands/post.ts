import { readFile } from "node:fs/promises";
import type { BlogPost } from "@blogus/shared";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

export function registerPostCommands(program: Command) {
  const post = program.command("post").description("Manage posts");

  post.command("list").description("List posts").action(async () => {
    const result = await apiRequest<{ posts: BlogPost[] }>("/api/posts");
    for (const item of result.posts) {
      console.log(`${item.id}\t${item.status}\t${item.title}`);
    }
  });

  post
    .command("create")
    .description("Create a draft post")
    .requiredOption("-t, --title <title>", "Post title")
    .option("-f, --file <path>", "Markdown file to use as content")
    .action(async (options: { title: string; file?: string }) => {
      const content = options.file ? await readFile(options.file, "utf8") : "";
      const result = await apiRequest<{ post: BlogPost }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: options.title, content, status: "draft" })
      });
      console.log(result.post.id);
    });

  post
    .command("edit")
    .description("Replace a post body from a Markdown file")
    .argument("<id>", "Post id")
    .requiredOption("-f, --file <path>", "Markdown file to use as content")
    .action(async (id: string, options: { file: string }) => {
      const content = await readFile(options.file, "utf8");
      await apiRequest(`/api/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ content })
      });
      console.log("Updated");
    });

  post.command("publish").description("Publish a post").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "published" })
    });
    console.log("Published");
  });
}
