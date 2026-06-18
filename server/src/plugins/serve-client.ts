import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const serveClientPlugin = fp(async (app) => {
  const clientDist = resolve(import.meta.dirname, "../../../client/dist");

  if (!existsSync(clientDist)) {
    app.log.warn(`client dist not found at ${clientDist}, skipping static serving`);
    return;
  }

  const indexHtml = await readFile(resolve(clientDist, "index.html"));

  await app.register(fastifyStatic, {
    root: clientDist,
    decorateReply: false
  });

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.type("text/html").send(indexHtml);
  });
});
