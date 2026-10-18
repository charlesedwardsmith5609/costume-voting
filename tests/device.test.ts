import { describe, expect, it } from "vitest";
import { readDevice } from "@/lib/server/device";

const ID = "3f2a1c9e-8b7d-4e6f-9a5b-1c2d3e4f5a6b";
const req = (headers: Record<string, string>) => new Request("http://x/api", { headers });

describe("readDevice", () => {
  it("reads the X-Device-Id header and lowercases it", () => {
    expect(readDevice(req({ "x-device-id": ID.toUpperCase() }))).toBe(ID);
  });

  it("falls back to the device_id cookie", () => {
    expect(readDevice(req({ cookie: `theme=dark; device_id=${ID}` }))).toBe(ID);
  });

  it("prefers the header over the cookie", () => {
    const other = "00000000-0000-4000-8000-000000000000";
    expect(readDevice(req({ "x-device-id": ID, cookie: `device_id=${other}` }))).toBe(ID);
  });

  it("rejects missing and malformed IDs", () => {
    expect(readDevice(req({}))).toBeNull();
    expect(readDevice(req({ "x-device-id": "not-a-uuid" }))).toBeNull();
    expect(readDevice(req({ cookie: "device_id=abc" }))).toBeNull();
    expect(readDevice(req({ "x-device-id": `${ID}' or 1=1` }))).toBeNull();
  });
});
