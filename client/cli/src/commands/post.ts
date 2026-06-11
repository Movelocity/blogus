import { readFile } from "node:fs/promises";
import type { BlogPost, PostStatus, UpdatePostInput } from "@blogus/shared";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

const allowedStatuses = new Set<PostStatus>(["draft", "published", "archived"]);

function parseStatus(status: string) {
  if (!allowedStatuses.has(status as PostStatus)) {
    throw new Error("Status must be one of: draft, published, archived");
  }

  return status as PostStatus;
}

export function registerPostCommands(program: Command) {
  const post = program.command("post").description("Manage posts");

  post.command("list").description("List posts").action(async () => {
    const result = await apiRequest<{ posts: BlogPost[] }>("/api/posts?visibility=all");
    for (const item of result.posts) {
      console.log(`${item.id}\t${item.status}\t${item.slug}\t${item.title}`);
    }
  });

  post
    .command("create")
    .description("Create a draft post")
    .requiredOption("-t, --title <title>", "Post title")
    .option("-f, --file <path>", "Markdown file to use as content")
    .option("-p, --publish", "Create the post as published")
    .action(async (options: { title: string; file?: string; publish?: boolean }) => {
      const content = options.file ? await readFile(options.file, "utf8") : "";
      const result = await apiRequest<{ post: BlogPost }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ title: options.title, content, status: options.publish ? "published" : "draft" })
      });
      console.log(result.post.id);
    });

  post
    .command("edit")
    .description("Replace a post body from a Markdown file")
    .argument("<id>", "Post id")
    .option("-t, --title <title>", "Post title")
    .option("-f, --file <path>", "Markdown file to use as content")
    .option("-s, --status <status>", "Post status: draft, published, archived")
    .action(async (id: string, options: { title?: string; file?: string; status?: string }) => {
      const input: UpdatePostInput = {};

      if (options.title) {
        input.title = options.title;
      }
      if (options.file) {
        input.content = await readFile(options.file, "utf8");
      }
      if (options.status) {
        input.status = parseStatus(options.status);
      }
      if (Object.keys(input).length === 0) {
        throw new Error("Provide at least one of --title, --file, or --status");
      }

      await apiRequest(`/api/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input)
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

  post.command("delete").description("Delete a post").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "DELETE"
    });
    console.log("Deleted");
  });
}
