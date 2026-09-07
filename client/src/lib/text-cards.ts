import type {
  CreateTextCardPaneInput,
  ImportTextCardPaneInput,
  ImportTextCardPanesInput,
  TextCardPane,
  TextCardWorkspace,
  TextCardWorkspaceWithCount,
  UpdateTextCardPaneInput,
  UpdateTextCardWorkspaceInput
} from "@blogus/shared";
import { request } from "./api";

export function listWorkspaces() {
  return request<{ workspaces: TextCardWorkspaceWithCount[] }>("/text-cards/workspaces");
}

export function createWorkspace() {
  return request<{ workspace: TextCardWorkspace }>("/text-cards/workspaces", { method: "POST" });
}

export function updateWorkspace(id: string, input: UpdateTextCardWorkspaceInput) {
  return request<{ workspace: TextCardWorkspace }>(`/text-cards/workspaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteWorkspace(id: string) {
  return request<{ ok: boolean }>(`/text-cards/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listPanes(workspaceId: string) {
  return request<{ panes: TextCardPane[] }>(`/text-cards/workspaces/${encodeURIComponent(workspaceId)}/panes`);
}

export function createPane(workspaceId: string, input?: CreateTextCardPaneInput) {
  return request<{ pane: TextCardPane }>(`/text-cards/workspaces/${encodeURIComponent(workspaceId)}/panes`, {
    method: "POST",
    body: JSON.stringify(input ?? {})
  });
}

export function updatePane(id: string, input: UpdateTextCardPaneInput) {
  return request<{ pane: TextCardPane }>(`/text-cards/panes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deletePane(id: string) {
  return request<{ ok: boolean }>(`/text-cards/panes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function importPanes(workspaceId: string, input: ImportTextCardPanesInput) {
  return request<{ panes: TextCardPane[] }>(`/text-cards/workspaces/${encodeURIComponent(workspaceId)}/import`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}
