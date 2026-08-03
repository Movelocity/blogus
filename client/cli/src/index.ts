#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerFolderCommands } from "./commands/folder.js";
import { registerPostCommands } from "./commands/post.js";
import { registerUploadCommands } from "./commands/upload.js";
import { SessionExpiredError } from "./lib/http.js";

const program = new Command();

program
  .name("blogus-cli")
  .description("Command line interface for Blogus")
  .version("0.1.0");

registerAuthCommands(program);
registerFolderCommands(program);
registerPostCommands(program);
registerUploadCommands(program);

try {
  await program.parseAsync();
} catch (err) {
  if (err instanceof SessionExpiredError) {
    console.error("Session expired. Please log in again: blogus-cli login");
  } else if (err instanceof TypeError && err.message.includes("fetch")) {
    console.error("Cannot connect to server. Is it running?");
  } else if (err instanceof Error) {
    console.error(`Error: ${err.message}`);
  } else {
    console.error("An unexpected error occurred.");
  }
  process.exit(1);
}
