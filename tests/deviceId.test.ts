import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("SecurityError");
  },
};

function stubBrowser(storage: unknown, cookie = "") {
  const doc = { cookie };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("location", { protocol: "https:" });
  return doc;
}

// getDeviceId keeps a per-page fallback ID in module state; give each test a fresh module.
let getDeviceId: typeof import("@/lib/deviceId").getDeviceId;
let guestFetch: typeof import("@/lib/deviceId").guestFetch;
beforeEach(async () => {
  vi.resetModules();
  ({ getDeviceId, guestFetch } = await import("@/lib/deviceId"));
});

afterEach(() => vi.unstubAllGlobals());

describe("getDeviceId", () => {
  it("creates a UUID once and keeps it in localStorage, without a cookie", () => {
    const doc = stubBrowser(memoryStorage());
    const id = getDeviceId();
    expect(id).toMatch(UUID_RE);
    expect(getDeviceId()).toBe(id);
    expect(localStorage.getItem("device_id")).toBe(id);
    expect(doc.cookie).toBe("");
  });

  it("gives a new ID after localStorage is cleared", () => {
    stubBrowser(memoryStorage());
    const first = getDeviceId();
    localStorage.clear();
    expect(getDeviceId()).not.toBe(first);
  });

  it("falls back to a cookie when localStorage is unavailable", () => {
    const doc = stubBrowser(brokenStorage);
    const id = getDeviceId();
    expect(doc.cookie).toContain(`device_id=${id}`);
    expect(doc.cookie).toContain("SameSite=Lax");
    // A real document.cookie returns only name=value pairs.
    doc.cookie = `device_id=${id}`;
    expect(getDeviceId()).toBe(id);
  });

  it("keeps one ID for the page when neither localStorage nor cookies persist", () => {
    stubBrowser(brokenStorage);
    // A document whose cookie setter discards every write.
    vi.stubGlobal("document", {
      get cookie() {
        return "";
      },
      set cookie(_v: string) {},
    });
    const id = getDeviceId();
    expect(id).toMatch(UUID_RE);
    expect(getDeviceId()).toBe(id);
  });

  it("ignores a malformed stored value", () => {
    const storage = memoryStorage();
    storage.setItem("device_id", "garbage");
    stubBrowser(storage);
    expect(getDeviceId()).toMatch(UUID_RE);
  });
});

describe("guestFetch", () => {
  it("sends the device ID header", async () => {
    stubBrowser(memoryStorage());
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await guestFetch("/api/my-votes");
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("x-device-id")).toBe(getDeviceId());
  });
});
