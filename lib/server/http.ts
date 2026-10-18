// JSON responses for guest routes. Errors are { error: code, message }; the UI owns the copy.

const STATUS: Record<string, number> = {
  invalid_request: 400,
  invalid_device: 400,
  invalid_category: 400,
  invalid_name: 400,
  invalid_photo: 400,
  closed: 403,
  not_found: 404,
  invalid_nominee: 404,
  already_in_category: 409,
  no_change: 409,
  rate_limited: 429,
};

const MESSAGE: Record<string, string> = {
  invalid_request: "Invalid request",
  invalid_device: "Missing or invalid device ID",
  invalid_category: "Unknown category",
  invalid_name: "Names must be at most 60 characters",
  invalid_photo: "Photo upload not found or already used",
  closed: "Voting is not open",
  not_found: "Nominee not found",
  invalid_nominee: "Nominee is not in this category",
  already_in_category: "Already in this category",
  no_change: "Nothing changed",
  rate_limited: "Too many requests; try again in a few minutes",
};

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// A known business outcome from a database function, or a validation failure.
export function reject(route: string, code: string): Response {
  const status = STATUS[code];
  if (!status) return serverError(route, new Error(`unexpected status ${code}`));
  if (code === "rate_limited" || status === 403) console.warn(`[${route}] rejected: ${code}`);
  return json({ error: code, message: MESSAGE[code] }, status);
}

export function serverError(route: string, err: unknown): Response {
  const e = err as { code?: string; message?: string };
  console.error(`[${route}] ${e?.code ?? ""} ${e?.message ?? String(err)}`);
  return json({ error: "server_error", message: "Something went wrong" }, 500);
}
