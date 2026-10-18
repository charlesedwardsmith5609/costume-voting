import { BUCKET } from "../db/helpers";

const BASE = "http://localhost:3000";

type Opts = { device?: string | null; body?: unknown; rawBody?: string; cookie?: string };

export function get(path: string, opts: Opts = {}): Request {
  return new Request(BASE + path, { headers: headers(opts) });
}

export function post(path: string, opts: Opts = {}): Request {
  const body = opts.rawBody ?? JSON.stringify(opts.body ?? {});
  return new Request(BASE + path, { method: "POST", headers: headers(opts), body });
}

function headers(opts: Opts): Headers {
  const h = new Headers({ "content-type": "application/json" });
  if (opts.device) h.set("x-device-id", opts.device);
  if (opts.cookie) h.set("cookie", opts.cookie);
  return h;
}

export async function call(res: Response | Promise<Response>): Promise<{ status: number; body: any }> {
  const r = await res;
  return { status: r.status, body: await r.json() };
}

// Uploads a placeholder JPEG through a signed URL the way the browser does: a plain PUT, no key.
export async function putSigned(signedUrl: string): Promise<void> {
  const r = await fetch(signedUrl, {
    method: "PUT",
    body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    headers: { "content-type": "image/jpeg" },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`signed upload to ${BUCKET}: ${r.status} ${await r.text()}`);
}
