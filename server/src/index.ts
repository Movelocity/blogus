import { buildApp } from "./app.js";
import { config } from "./config.js";

const { host, port } = config.server;

const app = await buildApp();

try {
  await app.listen({ host, port });
  app.log.info(`Blogus API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
