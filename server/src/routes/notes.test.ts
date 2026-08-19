import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import type { BlogNote, CreateNoteInput, CurrentUser, NoteListResult, NoteVisibility, UpdateNoteInput } from "@blogus/shared";
import Fastify from "fastify";
import { apiErrorHandler, sendApiError } from "../http/errors.js";
import type {
  NoteListOptions,
  NoteRepository,
  NoteSearchOptions
} from "../repositories/notes.js";
import { createNoteRoutes } from "./notes.js";

class InMemoryNoteRepository implements NoteRepository {
  private readonly notes = new Map<string, BlogNote>();

  async listNotes(options: NoteListOptions): Promise<NoteListResult> {
    let list = Array.from(this.notes.values()).filter((note) => this.visible(note, options.userId, options.visibility ?? "published"));

    if (options.isPublic !== undefined && options.userId !== null) {
      list = list.filter((note) => note.userId === options.userId && note.isPublic === options.isPublic);
    }
    if (options.tag) {
      list = list.filter((note) => note.tags.includes(options.tag!));
    }
    if (options.date) {
      list = list.filter((note) => note.date === options.date);
    }

    list = list.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const offset = (options.page - 1) * options.pageSize;
    return {
      notes: list.slice(offset, offset + options.pageSize),
      total: list.length
    };
  }

  async getNoteById(id: string, userId: string | null) {
    const note = this.notes.get(id);
    if (!note || (!note.isPublic && note.userId !== userId)) {
      return null;
    }
    return note;
  }

  async createNote(userId: string, input: CreateNoteInput) {
    const now = new Date().toISOString();
    const note: BlogNote = {
      id: randomUUID(),
      userId,
      date: input.date ?? now.slice(0, 10),
      content: input.content,
      isPublic: input.isPublic ?? false,
      isArchived: false,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now
    };
    this.notes.set(note.id, note);
    return note;
  }

  async updateNote(id: string, userId: string, input: UpdateNoteInput) {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    const updated: BlogNote = {
      ...existing,
      ...(input.date === undefined ? {} : { date: input.date }),
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.isPublic === undefined ? {} : { isPublic: input.isPublic }),
      ...(input.isArchived === undefined ? {} : { isArchived: input.isArchived }),
      ...(input.tags === undefined ? {} : { tags: input.tags }),
      updatedAt: new Date().toISOString()
    };
    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id: string, userId: string) {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }
    return this.notes.delete(id);
  }

  async setArchived(id: string, userId: string, isArchived: boolean) {
    const existing = this.notes.get(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }
    return this.updateNote(id, userId, { isArchived });
  }

  async listCalendarStats(userId: string | null, _year: number, _month: number) {
    const index: Record<string, number> = {};
    for (const note of this.notes.values()) {
      if (note.isArchived) {
        continue;
      }
      if (!note.isPublic && note.userId !== userId) {
        continue;
      }
      index[note.date] = (index[note.date] ?? 0) + 1;
    }
    return index;
  }

  async searchNotes(options: NoteSearchOptions): Promise<NoteListResult> {
    const keyword = options.keyword.toLowerCase();
    let list = Array.from(this.notes.values()).filter((note) => {
      if (options.userId === null && (!note.isPublic || note.isArchived)) {
        return false;
      }
      if (options.userId !== null && !note.isPublic && note.userId !== options.userId) {
        return false;
      }
      return note.content.toLowerCase().includes(keyword) || note.tags.some((t) => t.toLowerCase().includes(keyword));
    });
    const offset = (options.page - 1) * options.pageSize;
    return {
      notes: list.slice(offset, offset + options.pageSize),
      total: list.length
    };
  }

  private visible(note: BlogNote, userId: string | null, visibility: NoteVisibility) {
    if (visibility === "archived") {
      return note.userId === userId && note.isArchived;
    }
    if (visibility === "all") {
      return note.userId === userId;
    }
    return note.isPublic && !note.isArchived;
  }
}

const testUser: CurrentUser = { id: "user-1", email: "a@example.com", role: "admin" };
const otherUser: CurrentUser = { id: "user-2", email: "b@example.com", role: "user" };

async function buildTestApp(options: { user?: CurrentUser | null; repository?: NoteRepository } = {}) {
  const repository = options.repository ?? new InMemoryNoteRepository();
  const app = Fastify({ logger: false });
  app.setErrorHandler(apiErrorHandler);
  app.decorate("authenticate", async (request, reply) => {
    if (options.user === null) {
      return sendApiError(reply, 401, "unauthorized", "Unauthorized");
    }
    request.currentUser = options.user ?? testUser;
  });
  await app.register(createNoteRoutes(() => repository), { prefix: "/api/notes" });
  return { app, repository };
}

test("requires authentication for write and management operations", async (t) => {
  const { app } = await buildTestApp({ user: null });
  t.after(async () => app.close());

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Blocked" }
  });
  assert.equal(createResponse.statusCode, 401);

  const allResponse = await app.inject({ method: "GET", url: "/api/notes?visibility=all" });
  assert.equal(allResponse.statusCode, 401);

  const archivedResponse = await app.inject({ method: "GET", url: "/api/notes?visibility=archived" });
  assert.equal(archivedResponse.statusCode, 401);
});

test("creates notes, lists public by default, and all for management", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const privateResponse = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Private note", date: "2026-08-19" }
  });
  assert.equal(privateResponse.statusCode, 201);

  const publicResponse = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Public note", date: "2026-08-18", isPublic: true, tags: ["release"] }
  });
  assert.equal(publicResponse.statusCode, 201);

  const publicList = await app.inject({ method: "GET", url: "/api/notes" });
  assert.equal(publicList.statusCode, 200);
  assert.deepEqual(
    publicList.json<{ notes: BlogNote[] }>().notes.map((note) => note.content),
    ["Public note"]
  );

  const allList = await app.inject({ method: "GET", url: "/api/notes?visibility=all" });
  assert.equal(allList.statusCode, 200);
  assert.equal(allList.json<{ notes: BlogNote[] }>().notes.length, 2);
});

test("filters notes by date and tag", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Work", date: "2026-08-19", isPublic: true, tags: ["work"] }
  });
  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Life", date: "2026-08-18", isPublic: true, tags: ["life"] }
  });

  const byDate = await app.inject({ method: "GET", url: "/api/notes?date=2026-08-19" });
  assert.deepEqual(
    byDate.json<{ notes: BlogNote[] }>().notes.map((note) => note.content),
    ["Work"]
  );

  const byTag = await app.inject({ method: "GET", url: "/api/notes?tag=life" });
  assert.deepEqual(
    byTag.json<{ notes: BlogNote[] }>().notes.map((note) => note.content),
    ["Life"]
  );
});

test("reads public notes anonymously but hides private notes from others", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const publicCreate = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Public", isPublic: true, date: "2026-08-19" }
  });
  const privateCreate = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Secret", date: "2026-08-19" }
  });
  const publicNote = publicCreate.json<{ note: BlogNote }>().note;
  const privateNote = privateCreate.json<{ note: BlogNote }>().note;

  const publicRead = await app.inject({ method: "GET", url: `/api/notes/${publicNote.id}` });
  assert.equal(publicRead.statusCode, 200);
  assert.equal(publicRead.json<{ note: BlogNote }>().note.content, "Public");

  const privateRead = await app.inject({ method: "GET", url: `/api/notes/${privateNote.id}` });
  assert.equal(privateRead.statusCode, 404);
});

test("updates, archives, and deletes notes scoped to the owner", async (t) => {
  const repository = new InMemoryNoteRepository();
  const { app } = await buildTestApp({ repository });
  t.after(async () => app.close());

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Original", date: "2026-08-19" }
  });
  const created = createResponse.json<{ note: BlogNote }>().note;

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/notes/${created.id}`,
    payload: { content: "Updated", isPublic: true, tags: ["edited"] }
  });
  assert.equal(updateResponse.statusCode, 200);
  const updated = updateResponse.json<{ note: BlogNote }>().note;
  assert.equal(updated.content, "Updated");
  assert.equal(updated.isPublic, true);
  assert.deepEqual(updated.tags, ["edited"]);

  const archiveResponse = await app.inject({
    method: "PUT",
    url: `/api/notes/${created.id}/archive`,
    payload: { isArchived: true }
  });
  assert.equal(archiveResponse.statusCode, 200);
  assert.equal(archiveResponse.json<{ note: BlogNote }>().note.isArchived, true);

  const otherApp = (await buildTestApp({ user: otherUser, repository })).app;
  t.after(async () => otherApp.close());

  const otherUpdate = await otherApp.inject({
    method: "PATCH",
    url: `/api/notes/${created.id}`,
    payload: { content: "Hijack" }
  });
  assert.equal(otherUpdate.statusCode, 404);

  const otherDelete = await otherApp.inject({ method: "DELETE", url: `/api/notes/${created.id}` });
  assert.equal(otherDelete.statusCode, 404);

  const deleteResponse = await app.inject({ method: "DELETE", url: `/api/notes/${created.id}` });
  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json(), { ok: true });
});

test("returns calendar density for visible notes", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "A", date: "2026-08-19", isPublic: true }
  });
  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "B", date: "2026-08-19", isPublic: true }
  });
  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "C", date: "2026-08-18", isPublic: true }
  });

  const calendar = await app.inject({ method: "GET", url: "/api/notes/calendar?year=2026&month=8" });
  assert.equal(calendar.statusCode, 200);
  assert.deepEqual(calendar.json<{ index: Record<string, number> }>().index, {
    "2026-08-18": 1,
    "2026-08-19": 2
  });
});

test("searches note content and tags", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Meeting summary", isPublic: true, tags: ["work"] }
  });
  await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "Grocery list", isPublic: true, tags: ["life"] }
  });

  const byContent = await app.inject({ method: "GET", url: "/api/notes/search?keyword=meeting" });
  assert.equal(byContent.statusCode, 200);
  assert.equal(byContent.json<{ notes: BlogNote[] }>().notes.length, 1);

  const byTag = await app.inject({ method: "GET", url: "/api/notes/search?keyword=life" });
  assert.equal(byTag.json<{ notes: BlogNote[] }>().notes.length, 1);

  const empty = await app.inject({ method: "GET", url: "/api/notes/search?keyword=missing" });
  assert.equal(empty.json<{ notes: BlogNote[] }>().notes.length, 0);
});

test("returns clear 400 and 404 errors", async (t) => {
  const { app } = await buildTestApp();
  t.after(async () => app.close());

  const invalidResponse = await app.inject({
    method: "POST",
    url: "/api/notes",
    payload: { content: "" }
  });
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(invalidResponse.json<{ error: { code: string } }>().error.code, "validation_failed");

  const missingResponse = await app.inject({
    method: "PATCH",
    url: "/api/notes/missing-id",
    payload: { content: "Nope" }
  });
  assert.equal(missingResponse.statusCode, 404);
  assert.equal(missingResponse.json<{ error: { code: string } }>().error.code, "note_not_found");
});
