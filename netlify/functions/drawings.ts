import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

/**
 * Per-account sprite library /api/drawings
 *
 *   GET     list the signed-in user's sprites
 *   POST    create (no id) or update (id) one sprite
 *   DELETE  remove one sprite by id
 *
 * Identity is the only source of the user id — a client-supplied owner is
 * ignored. Blobs are keyed under `u/<userId>/`, so one account cannot read or
 * delete another account's sprites even if it guesses an id.
 */

const STORE_NAME = "pixel-pad-drawings";
const MAX_DRAWINGS = 40;
const MAX_TITLE = 48;
const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_METHODS = "GET, POST, DELETE";
const GRID_SIZES = [8, 16, 24, 32, 48, 64] as const;

type GridSize = (typeof GRID_SIZES)[number];

type Drawing = {
  id: string;
  title: string;
  gridSize: GridSize;
  pixels: number[];
  updatedAt: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENCODER = new TextEncoder();

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

function store() {
  // Strong consistency means a save is visible to the next list immediately.
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function keyFor(userId: string, id: string): string {
  return `u/${userId}/${id}.json`;
}

function isGridSize(value: unknown): value is GridSize {
  return GRID_SIZES.includes(value as GridSize);
}

/** A stored sprite must be fully valid before it is shown to the client. */
function isPixel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -1 && value <= 15;
}

function parseDrawing(value: unknown): Drawing | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Drawing>;
  if (
    typeof row.id !== "string" ||
    !UUID_PATTERN.test(row.id) ||
    typeof row.title !== "string" ||
    !isGridSize(row.gridSize) ||
    !Array.isArray(row.pixels) ||
    row.pixels.length !== row.gridSize * row.gridSize ||
    !row.pixels.every(isPixel) ||
    typeof row.updatedAt !== "string" ||
    Number.isNaN(Date.parse(row.updatedAt))
  ) {
    return null;
  }

  const title = row.title.trim();
  if (!title || title.length > MAX_TITLE) return null;

  return {
    id: row.id.toLowerCase(),
    title,
    gridSize: row.gridSize,
    pixels: row.pixels,
    updatedAt: row.updatedAt,
  };
}

function readId(input: unknown): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "string" || !UUID_PATTERN.test(input)) {
    throw new HttpError(400, "That sprite id is not valid.");
  }
  return input.toLowerCase();
}

function parseSave(body: unknown): {
  id?: string;
  title: string;
  gridSize: GridSize;
  pixels: number[];
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Send a JSON object with the sprite.");
  }
  const row = body as Record<string, unknown>;
  const id = readId(row.id);
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    throw new HttpError(400, `Give the sprite a name (1–${MAX_TITLE} characters).`);
  }
  if (!isGridSize(row.gridSize)) {
    throw new HttpError(400, "Unsupported grid size.");
  }
  const gridSize = row.gridSize;
  if (!Array.isArray(row.pixels) || row.pixels.length !== gridSize * gridSize) {
    throw new HttpError(400, "The sprite data does not match its grid size.");
  }
  if (!row.pixels.every(isPixel)) {
    throw new HttpError(400, "The sprite contains an invalid colour index.");
  }
  return { id, title, gridSize, pixels: row.pixels };
}

/** Read a bounded JSON body, rejecting oversized or malformed payloads. */
async function readJsonBody(request: Request, invalidMessage: string): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isFinite(length) || length < 0) {
      throw new HttpError(400, invalidMessage);
    }
    if (length > MAX_BODY_BYTES) {
      throw new HttpError(413, "The request body is too large.");
    }
  }

  const text = await request.text();
  if (ENCODER.encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "The request body is too large.");
  }
  if (!text.trim()) throw new HttpError(400, invalidMessage);

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, invalidMessage);
  }
}

/**
 * Defence in depth on top of Netlify Identity's SameSite cookies: reject
 * state-changing requests that a browser explicitly labels as cross-site.
 * Non-browser clients (curl, server-side fetch) omit the header and still work.
 */
function assertTrustedFetchSite(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new HttpError(403, "Cross-site requests are not allowed.");
  }
}

async function listDrawings(userId: string): Promise<Drawing[]> {
  const s = store();
  const { blobs } = await s.list({ prefix: `u/${userId}/` });
  if (blobs.length === 0) return [];

  const rows = await Promise.all(
    blobs.map(async (blob) => {
      const value = await s.get(blob.key, { type: "json" });
      return parseDrawing(value);
    }),
  );

  return rows
    .filter((row): row is Drawing => row !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DRAWINGS);
}

async function saveDrawing(userId: string, input: ReturnType<typeof parseSave>): Promise<Drawing> {
  const now = new Date().toISOString();
  const s = store();

  if (input.id) {
    const key = keyFor(userId, input.id);
    const existing = parseDrawing(await s.get(key, { type: "json" }));
    if (!existing) throw new HttpError(404, "That sprite no longer exists.");
    const updated: Drawing = {
      id: input.id,
      title: input.title,
      gridSize: input.gridSize,
      pixels: input.pixels,
      updatedAt: now,
    };
    await s.setJSON(key, updated);
    return updated;
  }

  const { blobs } = await s.list({ prefix: `u/${userId}/` });
  if (blobs.length >= MAX_DRAWINGS) {
    throw new HttpError(
      409,
      `Sprite library is full (${MAX_DRAWINGS}). Delete one to save another.`,
    );
  }

  const created: Drawing = {
    id: crypto.randomUUID(),
    title: input.title,
    gridSize: input.gridSize,
    pixels: input.pixels,
    updatedAt: now,
  };
  await s.setJSON(keyFor(userId, created.id), created);
  return created;
}

async function deleteDrawing(userId: string, id: string): Promise<void> {
  await store().delete(keyFor(userId, id));
}

export default async (request: Request): Promise<Response> => {
  try {
    assertTrustedFetchSite(request);

    const user = await getUser();
    if (!user) throw new HttpError(401, "Unauthorized");

    if (request.method === "GET") {
      return json({ drawings: await listDrawings(user.id) });
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request, "The request body is not valid JSON.");
      const saved = await saveDrawing(user.id, parseSave(body));
      return json(saved);
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      let id = readId(url.searchParams.get("id") ?? undefined);
      if (!id) {
        const body = await readJsonBody(request, "Send the sprite id as JSON.");
        id = readId((body as { id?: unknown } | null)?.id);
      }
      if (!id) throw new HttpError(400, "Send the sprite id as JSON.");
      await deleteDrawing(user.id, id);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed." }, 405, {
      allow: ALLOWED_METHODS,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status);
    }
    console.error("[drawings] unexpected failure", error);
    return json({ error: "The sprite library hit an unexpected error." }, 500);
  }
};

export const config = { path: "/api/drawings" };
