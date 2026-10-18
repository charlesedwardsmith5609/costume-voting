// Request body validation for guest routes. The database functions validate again; these
// checks give a 400 before any database call.
import { type CategorySlug, isCategory } from "@/lib/categories";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Matches Postgres [[:cntrl:]] for UTF-8: C0, DEL, and C1.
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;

export const INVALID = Symbol("invalid");
export type Invalid = typeof INVALID;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

// Reads a JSON object body, or null if the body is not a JSON object.
export async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// A name is a string or null. Trimmed; blank becomes null; at most 60 characters.
export function parseName(v: unknown): string | null | Invalid {
  if (v === null) return null;
  if (typeof v !== "string") return INVALID;
  const name = v.trim();
  if (name === "") return null;
  return [...name].length <= 60 && !CONTROL_RE.test(name) ? name : INVALID;
}

// A list of known category slugs, de-duplicated. Empty is allowed; callers that need one check.
export function parseCategories(v: unknown): CategorySlug[] | Invalid {
  if (!Array.isArray(v) || !v.every(isCategory)) return INVALID;
  return [...new Set(v)];
}

// Photo paths are checked fully by the database (photo_is_fresh); this only bounds the input.
export function parsePhotoPath(v: unknown): string | Invalid {
  return typeof v === "string" && v.length > 0 && v.length <= 100 ? v : INVALID;
}
