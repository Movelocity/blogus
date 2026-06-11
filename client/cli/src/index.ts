#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPostCommands } from "./commands/post.js";
import { registerUploadCommands } from "./commands/upload.js";

const program = new Command();

program
  .name("blogus-cli")
  .description("Command line interface for Blogus")
  .version("0.1.0");

registerAuthCommands(program);
registerPostCommands(program);
registerUploadCommands(program);

await program.parseAsync();
