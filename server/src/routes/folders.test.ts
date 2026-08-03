import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { BlogFolder, CurrentUser } from "@blogus/shared";
import Fastify from "fastify";
import { apiErrorHandler, sendApiError } from "../http/errors.js";
import type { FolderRepository } from "../repositories/folders.js";
import { createFolderRoutes } from "./folders.js";

class InMemoryFolderRepository implements FolderRepository {
  private readonly folders = new Map<string, BlogFolder & { userId: string }>();

  async listFolders(userId: string) {
    return Array.from(this.folders.values())
      .filter((folder) => folder.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ userId: _userId, ...folder }) => folder);
  }

  async createFolder(userId: string, name: string) {
    const now = new Date().toISOString();
    const folder = { id: randomUUID(), userId, name, createdAt: now, updatedAt: now };
    this.folders.set(folder.id, folder);
    const { userId: _userId, ...rest } = folder;
    return rest;
  }

  async renameFolder(id: string, userId: string, name: string) {
    const existing = this.folders.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    const updated = { ...existing, name, updatedAt: new Date().toISOString() };
    this.folders.set(id, updated);
    const { userId: _userId, ...rest } = updated;
    return rest;
  }

  async deleteFolder(id: string, userId: string) {
    const existing = this.folders.get(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    return this.folders.delete(id);
  }
}

const testUser: CurrentUser = { id: "user-1", email: "a@example.com", role: "admin" };
const otherUser: CurrentUser = { id: "user-2", email: "b@example.com", role: "user" };

async function buildTestApp(options: { user?: CurrentUser | null; repository?: FolderRepository } = {}) {
  const repository = options.repository ?? new InMemoryFolderRepository();
  const app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  app.decorate("authenticate", async (request, reply) => {
    if (options.user === null) {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
    request.currentUser = options.user ?? testUser;
  });
  await app.register(createFolderRoutes(() => repository), { prefix: "/api/folders" });

  return { app, repository };
}

test("requires authentication for folder operations", async (t) => {
  const { app } = await buildTestApp({ user: null });
  t.after(async () => app.close());

  const listResponse = await app.inject({ method: "GET", url: "/api/folders" });
  assert.equal(listResponse.statusCode, 401);

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/folders",
    payload: { name: "Blocked" }
  });
  assert.equal(createResponse.statusCode, 401);
});

test("creates, lists, renames, and deletes folders", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/folders",
    payload: { name: "项目札记" }
  });
  assert.equal(createResponse.statusCode, 201);
  const created = createResponse.json<{ folder: BlogFolder }>().folder;
  assert.equal(created.name, "项目札记");

  const listResponse = await app.inject({ method: "GET", url: "/api/folders" });
  assert.deepEqual(
    listResponse.json<{ folders: BlogFolder[] }>().folders.map((f) => f.name),
    ["项目札记"]
  );

  const renameResponse = await app.inject({
    method: "PATCH",
    url: `/api/folders/${created.id}`,
    payload: { name: "归档笔记" }
  });
  assert.equal(renameResponse.json<{ folder: BlogFolder }>().folder.name, "归档笔记");

  const deleteResponse = await app.inject({ method: "DELETE", url: `/api/folders/${created.id}` });
  assert.deepEqual(deleteResponse.json(), { ok: true });

  const emptyList = await app.inject({ method: "GET", url: "/api/folders" });
  assert.equal(emptyList.json<{ folders: BlogFolder[] }>().folders.length, 0);
});

test("scopes folders to the current user", async (t) => {
  const repository = new InMemoryFolderRepository();
  const { app } = await buildTestApp({ repository });
  t.after(async () => app.close());

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/folders",
    payload: { name: "私有目录" }
  });
  const created = createResponse.json<{ folder: BlogFolder }>().folder;

  const otherApp = (await buildTestApp({ user: otherUser, repository })).app;
  t.after(async () => otherApp.close());

  const otherList = await otherApp.inject({ method: "GET", url: "/api/folders" });
  assert.equal(otherList.json<{ folders: BlogFolder[] }>().folders.length, 0);

  const otherRename = await otherApp.inject({
    method: "PATCH",
    url: `/api/folders/${created.id}`,
    payload: { name: "越权改名" }
  });
  assert.equal(otherRename.statusCode, 404);

  const otherDelete = await otherApp.inject({ method: "DELETE", url: `/api/folders/${created.id}` });
  assert.equal(otherDelete.statusCode, 404);
});
