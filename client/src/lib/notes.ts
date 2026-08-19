import type {
  BlogNote,
  CreateNoteInput,
  NoteCalendarIndex,
  NoteListResult,
  NoteVisibility,
  UpdateNoteInput,
} from "@blogus/shared";
import { request } from "./api";

export interface ListNotesOptions {
  visibility?: NoteVisibility;
  date?: string;
  tag?: string;
  isPublic?: boolean;
  page?: number;
  pageSize?: number;
}

export function listNotes(options: ListNotesOptions = {}) {
  const params = new URLSearchParams();
  if (options.visibility) params.set("visibility", options.visibility);
  if (options.date) params.set("date", options.date);
  if (options.tag) params.set("tag", options.tag);
  if (options.isPublic !== undefined) params.set("isPublic", String(options.isPublic));
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  const qs = params.size ? `?${params.toString()}` : "";
  return request<NoteListResult>(`/notes${qs}`);
}

export function getNote(id: string) {
  return request<{ note: BlogNote }>(`/notes/${encodeURIComponent(id)}`);
}

export function createNote(input: CreateNoteInput) {
  return request<{ note: BlogNote }>("/notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNote(id: string, input: UpdateNoteInput) {
  return request<{ note: BlogNote }>(`/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function archiveNote(id: string, isArchived: boolean) {
  return request<{ note: BlogNote }>(`/notes/${encodeURIComponent(id)}/archive`, {
    method: "PUT",
    body: JSON.stringify({ isArchived }),
  });
}

export function deleteNote(id: string) {
  return request<{ ok: boolean }>(`/notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getNotesCalendar(year: number, month: number) {
  return request<NoteCalendarIndex>(`/notes/calendar?year=${year}&month=${month}`);
}

export function searchNotes(keyword: string, options: { page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams({ keyword });
  if (options.page) params.set("page", String(options.page));
  if (options.pageSize) params.set("pageSize", String(options.pageSize));
  return request<NoteListResult>(`/notes/search?${params.toString()}`);
}
