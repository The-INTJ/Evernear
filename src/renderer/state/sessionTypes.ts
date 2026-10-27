// Renderer-only session types: short-lived UI state that doesn't live in
// the persisted workspace and isn't part of the IPC contract. Colocated
// here so hooks and feature components share one source.

export type NoticeTone = "info" | "success" | "warn";

export type Notice = {
  id: number;
  message: string;
  tone: NoticeTone;
};

export type HoverPreview = {
  entityId: string;
  x: number;
  y: number;
};
