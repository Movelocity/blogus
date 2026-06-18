import { buildApp } from "./app.js";
import { config } from "./config.js";
const { host, port } = config.server;

const app = await buildApp();

try {
  await app.listen({ host, port });
  const mode = config.server.serveClient ? " (serving client)" : " (API only)";
  console.log(config)
  app.log.info(`Blogus API listening on http://${host}:${port}${mode}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
