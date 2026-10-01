import type { BrowPlacement } from "@/types/brow";

type Handoff = { id: string; original: string; softened: string; placement: BrowPlacement };
// Tab-memory only: no photo upload, localStorage quota or persistent face data.
let current: Handoff | null = null;
export function stageBrowDesign(data: Omit<Handoff, "id">) {
  current = { ...data, id: crypto.randomUUID() };
  return current.id;
}
export function readBrowDesign(id: string) { return current?.id === id ? current : null; }
