import type { GridSize } from "@/lib/palette";

/** How many sprites an account can keep. Mirrors the Netlify function's cap. */
export const MAX_DRAWINGS = 40;

export type DrawingRecord = {
  id: string;
  title: string;
  gridSize: GridSize;
  pixels: number[];
  updatedAt: string;
};

export type SaveDrawingInput = {
  id?: string;
  title: string;
  gridSize: number;
  pixels: number[];
};

const ENDPOINT = "/api/drawings";

/** Error with the HTTP status attached so callers can react to 401 / 409. */
export class DrawingApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "DrawingApiError";
    this.status = status;
  }
}

async function request<T>(init: RequestInit & { url?: string }): Promise<T> {
  const { url = ENDPOINT, ...options } = init;
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new DrawingApiError("Can’t reach the sprite library. Check your connection.", 0);
  }

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    drawings?: DrawingRecord[];
  } | null;

  if (response.status === 401) {
    throw new DrawingApiError("Unauthorized", 401);
  }
  if (!response.ok) {
    throw new DrawingApiError(
      body?.error ?? `The library request failed (${response.status}).`,
      response.status,
    );
  }
  if (!body) {
    throw new DrawingApiError("The library returned an unexpected response.", response.status);
  }
  return body as T;
}

/** All saved sprites for the signed-in account, newest first. */
export async function listDrawings(): Promise<DrawingRecord[]> {
  const body = await request<{ drawings?: unknown }>({ method: "GET" });
  return Array.isArray(body.drawings) ? (body.drawings as DrawingRecord[]) : [];
}

/** Create a new sprite, or overwrite one owned by this account. */
export async function saveDrawing({ data }: { data: SaveDrawingInput }): Promise<DrawingRecord> {
  return request<DrawingRecord>({
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Remove one sprite. Safe to call twice. */
export async function deleteDrawing({ data: id }: { data: string }): Promise<{ ok: true }> {
  return request<{ ok: true }>({
    method: "DELETE",
    url: `${ENDPOINT}?id=${encodeURIComponent(id)}`,
  });
}
