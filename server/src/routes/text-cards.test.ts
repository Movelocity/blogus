import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type {
  CurrentUser,
  ImportTextCardPaneInput,
  TextCardPane,
  TextCardWorkspace,
  TextCardWorkspaceWithCount,
  UpdateTextCardPaneInput
} from "@blogus/shared";
import Fastify from "fastify";
import { apiErrorHandler, sendApiError } from "../http/errors.js";
import { normalizePane, type TextCardRepository } from "../repositories/text-cards.js";
import { createTextCardRoutes } from "./text-cards.js";

class InMemoryTextCardRepository implements TextCardRepository {
  private readonly workspaces = new Map<string, TextCardWorkspace & { userId: string }>();
  private readonly panes = new Map<string, TextCardPane>();

  async listWorkspaces(userId: string): Promise<TextCardWorkspaceWithCount[]> {
    return Array.from(this.workspaces.values())
      .filter((workspace) => workspace.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ userId: _userId, ...workspace }) => ({
        ...workspace,
        paneCount: Array.from(this.panes.values()).filter((pane) => pane.workspaceId === workspace.id).length
      }));
  }

  async findOwnedWorkspace(id: string, userId: string) {
    const workspace = this.workspaces.get(id);
    if (!workspace || workspace.userId !== userId) return null;
    const { userId: _userId, ...rest } = workspace;
    return rest;
  }

  async createWorkspace(userId: string) {
    const existing = await this.listWorkspaces(userId);
    const usedNumbers = existing
      .map((workspace) => {
        const match = workspace.name.match(/^工作区 (\d+)$/);
        return match ? Number.parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    const next = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
    const now = new Date().toISOString();
    const workspace = { id: randomUUID(), userId, name: `工作区 ${next}`, createdAt: now, updatedAt: now };
    this.workspaces.set(workspace.id, workspace);
    const { userId: _userId, ...rest } = workspace;
    return rest;
  }

  async updateWorkspace(id: string, userId: string, name: string) {
    const workspace = this.workspaces.get(id);
    if (!workspace || workspace.userId !== userId) return null;
    const updated = { ...workspace, name, updatedAt: new Date().toISOString() };
    this.workspaces.set(id, updated);
    const { userId: _userId, ...rest } = updated;
    return rest;
  }

  async deleteWorkspace(id: string, userId: string) {
    const workspace = this.workspaces.get(id);
    if (!workspace || workspace.userId !== userId) return "not_found";
    const count = Array.from(this.workspaces.values()).filter((item) => item.userId === userId).length;
    if (count <= 1) return "last_workspace";
    this.workspaces.delete(id);
    for (const [paneId, pane] of this.panes) {
      if (pane.workspaceId === id) this.panes.delete(paneId);
    }
    return "deleted";
  }

  async listPanes(workspaceId: string, userId: string) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.userId !== userId) return null;
    return Array.from(this.panes.values())
      .filter((pane) => pane.workspaceId === workspaceId)
      .sort((a, b) => a.zIndex - b.zIndex || a.createdAt.localeCompare(b.createdAt));
  }

  async createPane(workspaceId: string, userId: string) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.userId !== userId) return null;
    const maxZ = Math.max(0, ...Array.from(this.panes.values()).filter((p) => p.workspaceId === workspaceId).map((p) => p.zIndex));
    const now = new Date().toISOString();
    const pane: TextCardPane = {
      id: randomUUID(),
      workspaceId,
      title: "",
      content: "",
      x: 0,
      y: 0,
      width: 560,
      height: 280,
      zIndex: maxZ + 1,
      hlMode: "",
      minimized: false,
      wordWrap: true,
      createdAt: now,
      updatedAt: now
    };
    this.panes.set(pane.id, pane);
    return pane;
  }

  async updatePane(id: string, userId: string, input: UpdateTextCardPaneInput) {
    const pane = this.panes.get(id);
    if (!pane) return null;
    const workspace = this.workspaces.get(pane.workspaceId);
    if (!workspace || workspace.userId !== userId) return null;
    const updated: TextCardPane = {
      ...pane,
      ...input,
      updatedAt: new Date().toISOString()
    };
    this.panes.set(id, updated);
    return updated;
  }

  async deletePane(id: string, userId: string) {
    const pane = this.panes.get(id);
    if (!pane) return false;
    const workspace = this.workspaces.get(pane.workspaceId);
    if (!workspace || workspace.userId !== userId) return false;
    return this.panes.delete(id);
  }

  async importPanes(workspaceId: string, userId: string, inputs: ImportTextCardPaneInput[]) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || workspace.userId !== userId) return null;
    for (const [paneId, pane] of this.panes) {
      if (pane.workspaceId === workspaceId) this.panes.delete(paneId);
    }
    const now = new Date().toISOString();
    return inputs.map((input) => {
      const normalized = normalizePane(input);
      const pane: TextCardPane = {
        id: randomUUID(),
        workspaceId,
        ...normalized,
        hlMode: normalized.hlMode as TextCardPane["hlMode"],
        createdAt: now,
        updatedAt: now
      };
      this.panes.set(pane.id, pane);
      return pane;
    });
  }
}

const testUser: CurrentUser = { id: "user-1", email: "a@example.com", role: "admin" };
const otherUser: CurrentUser = { id: "user-2", email: "b@example.com", role: "user" };

async function buildTestApp(options: { user?: CurrentUser | null; repository?: TextCardRepository } = {}) {
  const repository = options.repository ?? new InMemoryTextCardRepository();
  const app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  app.decorate("authenticate", async (request, reply) => {
    if (options.user === null) {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
    request.currentUser = options.user ?? testUser;
  });
  await app.register(createTextCardRoutes(() => repository), { prefix: "/api/text-cards" });
  return { app, repository };
}

test("requires authentication", async (t) => {
  const { app } = await buildTestApp({ user: null });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/text-cards/workspaces" });
  assert.equal(response.statusCode, 401);
});

test("GET workspaces is read-only for new users", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const first = await app.inject({ method: "GET", url: "/api/text-cards/workspaces" });
  assert.deepEqual(first.json(), { workspaces: [] });

  const second = await app.inject({ method: "GET", url: "/api/text-cards/workspaces" });
  assert.deepEqual(second.json(), { workspaces: [] });
});

test("creates workspace and pane lifecycle", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const createWorkspace = await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  assert.equal(createWorkspace.statusCode, 201);
  const workspace = createWorkspace.json<{ workspace: TextCardWorkspace }>().workspace;
  assert.equal(workspace.name, "工作区 1");

  const createPane = await app.inject({ method: "POST", url: `/api/text-cards/workspaces/${workspace.id}/panes` });
  assert.equal(createPane.statusCode, 201);
  const pane = createPane.json<{ pane: TextCardPane }>().pane;

  const patch = await app.inject({
    method: "PATCH",
    url: `/api/text-cards/panes/${pane.id}`,
    payload: { title: "标题", content: "正文" }
  });
  assert.equal(patch.json<{ pane: TextCardPane }>().pane.content, "正文");

  const list = await app.inject({ method: "GET", url: "/api/text-cards/workspaces" });
  assert.equal(list.json<{ workspaces: TextCardWorkspaceWithCount[] }>().workspaces[0].paneCount, 1);

  const deletePane = await app.inject({ method: "DELETE", url: `/api/text-cards/panes/${pane.id}` });
  assert.deepEqual(deletePane.json(), { ok: true });

  const emptyList = await app.inject({ method: "GET", url: `/api/text-cards/workspaces/${workspace.id}/panes` });
  assert.deepEqual(emptyList.json(), { panes: [] });
});

test("rejects deleting the last workspace", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const created = await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  const workspace = created.json<{ workspace: TextCardWorkspace }>().workspace;

  const response = await app.inject({ method: "DELETE", url: `/api/text-cards/workspaces/${workspace.id}` });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json<{ error: { code: string } }>().error.code, "last_workspace");
});

test("allows deleting workspace when multiple exist", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const first = await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  const workspace = first.json<{ workspace: TextCardWorkspace }>().workspace;

  const response = await app.inject({ method: "DELETE", url: `/api/text-cards/workspaces/${workspace.id}` });
  assert.deepEqual(response.json(), { ok: true });
});

test("scopes resources to the current user", async (t) => {
  const repository = new InMemoryTextCardRepository();
  const { app } = await buildTestApp({ repository });
  t.after(async () => app.close());

  const created = await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  const workspace = created.json<{ workspace: TextCardWorkspace }>().workspace;
  const paneCreated = await app.inject({ method: "POST", url: `/api/text-cards/workspaces/${workspace.id}/panes` });
  const pane = paneCreated.json<{ pane: TextCardPane }>().pane;

  const otherApp = (await buildTestApp({ user: otherUser, repository })).app;
  t.after(async () => otherApp.close());

  const otherPatch = await otherApp.inject({
    method: "PATCH",
    url: `/api/text-cards/panes/${pane.id}`,
    payload: { content: "越权" }
  });
  assert.equal(otherPatch.statusCode, 404);

  const otherDelete = await otherApp.inject({ method: "DELETE", url: `/api/text-cards/panes/${pane.id}` });
  assert.equal(otherDelete.statusCode, 404);
});

test("import overwrites workspace panes including empty array", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const created = await app.inject({ method: "POST", url: "/api/text-cards/workspaces" });
  const workspace = created.json<{ workspace: TextCardWorkspace }>().workspace;
  await app.inject({ method: "POST", url: `/api/text-cards/workspaces/${workspace.id}/panes` });

  const imported = await app.inject({
    method: "POST",
    url: `/api/text-cards/workspaces/${workspace.id}/import`,
    payload: {
      panes: [{ title: "A", content: "one", highlightOn: true }, { title: "B", content: "two", hlMode: "js" }]
    }
  });
  const panes = imported.json<{ panes: TextCardPane[] }>().panes;
  assert.equal(panes.length, 2);
  assert.equal(panes[0].hlMode, "json");
  assert.equal(panes[1].hlMode, "js");

  const cleared = await app.inject({
    method: "POST",
    url: `/api/text-cards/workspaces/${workspace.id}/import`,
    payload: { panes: [] }
  });
  assert.deepEqual(cleared.json(), { panes: [] });
});

test("normalizePane falls back invalid geometry", () => {
  const normalized = normalizePane({ title: "x", width: -1, height: 999_999, x: 1.5, y: null as unknown as number });
  assert.equal(normalized.width, 560);
  assert.equal(normalized.height, 280);
  assert.equal(normalized.x, 0);
  assert.equal(normalized.y, 0);
});
