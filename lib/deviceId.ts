// Browser-side device identity (SPEC "Device identity"). The ID lives in localStorage; the
// cookie is only a fallback for browsers where localStorage is unavailable, so clearing
// localStorage gives a new ID (an accepted limitation). Not tamper-proof by design.
const KEY = "device_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Last resort when neither localStorage nor cookies persist: keep one ID for this page load, so
// an upload and the nomination that uses it come from the same device.
let pageId: string | null = null;

function readLocal(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && UUID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeLocal(id: string): boolean {
  try {
    localStorage.setItem(KEY, id);
    return localStorage.getItem(KEY) === id;
  } catch {
    return false;
  }
}

function readCookie(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)device_id=([^;]+)/);
    return m && UUID_RE.test(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

// True if the cookie stuck.
function writeCookie(id: string): boolean {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${KEY}=${id}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  } catch {
    return false;
  }
  return readCookie() === id;
}

export function getDeviceId(): string {
  const existing = readLocal() ?? readCookie() ?? pageId;
  if (existing) return existing;
  const id = crypto.randomUUID();
  if (!writeLocal(id) && !writeCookie(id)) pageId = id;
  return id;
}

// fetch for guest API routes: sends this device's ID in the X-Device-Id header.
export function guestFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-device-id", getDeviceId());
  return fetch(input, { ...init, headers });
}
