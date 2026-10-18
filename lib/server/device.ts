import { isUuid } from "./validate";

// The client sends its device ID in X-Device-Id; the device_id cookie is the fallback for
// browsers without localStorage. Returns the lowercased UUID, or null if missing or malformed.
// Client-chosen and not trusted beyond "one vote per device per category".
export function readDevice(req: Request): string | null {
  const raw = req.headers.get("x-device-id") ?? cookie(req, "device_id");
  return isUuid(raw) ? raw.toLowerCase() : null;
}

function cookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}
