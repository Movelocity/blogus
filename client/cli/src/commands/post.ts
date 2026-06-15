import { readFile } from "node:fs/promises";
import type { BlogPost, PostStatus, UpdatePostInput } from "@blogus/shared";
import type { Command } from "commander";
import { apiRequest } from "../lib/http.js";

const allowedStatuses = new Set<PostStatus>(["draft", "published", "archived"]);
const allowedVisibility = new Set<string>(["draft", "published", "archived", "all"]);

function parseStatus(status: string) {
  if (!allowedStatuses.has(status as PostStatus)) {
    throw new Error("Status must be one of: draft, published, archived");
  }

  return status as PostStatus;
}

function parseVisibility(value: string) {
  if (!allowedVisibility.has(value)) {
    throw new Error("Status must be one of: draft, published, archived, all");
  }

  return value;
}

function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export function registerPostCommands(program: Command) {
  const post = program.command("post").description("Manage posts");

  post
    .command("list")
    .description("List posts")
    .option("-s, --status <status>", "Filter by status: draft, published, archived, all (default: all)")
    .action(async (options: { status?: string }) => {
      const visibility = options.status ? parseVisibility(options.status) : "all";
      const result = await apiRequest<{ posts: BlogPost[] }>(`/api/posts?visibility=${visibility}`);
      for (const item of result.posts) {
        console.log(`${item.id}\t${item.status}\t${item.slug}\t${item.title}`);
      }
    });

  post
    .command("create")
    .description("Create a draft post")
    .requiredOption("-t, --title <title>", "Post title")
    .option("-f, --file <path>", "Markdown file to use as content")
    .option("-e, --excerpt <excerpt>", "Post excerpt")
    .option("-c, --cover <url>", "Cover image URL")
    .option("--tags <tags>", "Comma-separated tags")
    .option("-p, --publish", "Create the post as published")
    .action(async (options: { title: string; file?: string; excerpt?: string; cover?: string; tags?: string; publish?: boolean }) => {
      const content = options.file ? await readFile(options.file, "utf8") : "";
      const result = await apiRequest<{ post: BlogPost }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          title: options.title,
          content,
          excerpt: options.excerpt,
          coverImageUrl: options.cover,
          tags: options.tags ? parseTags(options.tags) : undefined,
          status: options.publish ? "published" : "draft"
        })
      });
      console.log(result.post.id);
    });

  post
    .command("edit")
    .description("Replace a post body from a Markdown file")
    .argument("<id>", "Post id")
    .option("-t, --title <title>", "Post title")
    .option("-f, --file <path>", "Markdown file to use as content")
    .option("-e, --excerpt <excerpt>", "Post excerpt")
    .option("-c, --cover <url>", "Cover image URL")
    .option("--tags <tags>", "Comma-separated tags")
    .option("-s, --status <status>", "Post status: draft, published, archived")
    .action(async (id: string, options: { title?: string; file?: string; excerpt?: string; cover?: string; tags?: string; status?: string }) => {
      const input: UpdatePostInput = {};

      if (options.title) {
        input.title = options.title;
      }
      if (options.file) {
        input.content = await readFile(options.file, "utf8");
      }
      if (options.excerpt !== undefined) {
        input.excerpt = options.excerpt;
      }
      if (options.cover !== undefined) {
        input.coverImageUrl = options.cover;
      }
      if (options.tags !== undefined) {
        input.tags = parseTags(options.tags);
      }
      if (options.status) {
        input.status = parseStatus(options.status);
      }
      if (Object.keys(input).length === 0) {
        throw new Error("Provide at least one of --title, --file, --excerpt, --cover, --tags, or --status");
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

  post.command("unpublish").description("Revert a published post to draft").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "draft" })
    });
    console.log("Reverted to draft");
  });

  post.command("archive").description("Archive a published post (hidden from visitors)").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" })
    });
    console.log("Archived");
  });

  post.command("unarchive").description("Restore an archived post to draft").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "draft" })
    });
    console.log("Unarchived (restored to draft)");
  });

  post.command("delete").description("Delete a post").argument("<id>", "Post id").action(async (id) => {
    await apiRequest(`/api/posts/${id}`, {
      method: "DELETE"
    });
    console.log("Deleted");
  });
}
