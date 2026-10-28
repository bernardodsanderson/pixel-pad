import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteDrawing,
  DrawingApiError,
  listDrawings,
  saveDrawing,
  type DrawingRecord,
} from "./drawings";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): FetchMock {
  const mock = vi.fn(handler);
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("listDrawings", () => {
  it("returns the saved sprites", async () => {
    const rows: DrawingRecord[] = [
      {
        id: "a",
        title: "One",
        gridSize: 8,
        pixels: [-1],
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const fetchMock = installFetch(async () => jsonResponse({ drawings: rows }));

    await expect(listDrawings()).resolves.toEqual(rows);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/drawings");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Record<string, string>).accept).toBe("application/json");
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });

  it("falls back to an empty list when the response omits drawings", async () => {
    installFetch(async () => jsonResponse({}));
    await expect(listDrawings()).resolves.toEqual([]);
  });

  it("falls back to an empty list for a non-array drawings field", async () => {
    installFetch(async () => jsonResponse({ drawings: "nope" }));
    await expect(listDrawings()).resolves.toEqual([]);
  });
});

describe("saveDrawing", () => {
  it("posts the sprite as JSON", async () => {
    const saved: DrawingRecord = {
      id: "b",
      title: "Two",
      gridSize: 16,
      pixels: [-1],
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    const fetchMock = installFetch(async () => jsonResponse(saved));
    const input = { title: "Two", gridSize: 16, pixels: [-1] };

    await expect(saveDrawing({ data: input })).resolves.toEqual(saved);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/drawings");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual(input);
  });
});

describe("deleteDrawing", () => {
  it("encodes the id in the query string", async () => {
    const fetchMock = installFetch(async () => jsonResponse({ ok: true }));
    await expect(deleteDrawing({ data: "a b/c?d" })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/drawings?id=a%20b%2Fc%3Fd");
    expect(init.method).toBe("DELETE");
  });
});

describe("errors", () => {
  it("maps 401 to Unauthorized so callers can redirect", async () => {
    installFetch(async () => jsonResponse({ error: "nope" }, 401));

    const error = await listDrawings().catch((cause) => cause);
    expect(error).toBeInstanceOf(DrawingApiError);
    expect(error).toMatchObject({ status: 401 });
    expect((error as Error).message).toBe("Unauthorized");
  });

  it("surfaces the server error message", async () => {
    installFetch(async () => jsonResponse({ error: "Sprite library is full (40)." }, 409));

    const error = await listDrawings().catch((cause) => cause);
    expect(error).toMatchObject({ status: 409 });
    expect((error as Error).message).toBe("Sprite library is full (40).");
  });

  it("falls back to a status message when the body is not JSON", async () => {
    installFetch(async () => new Response("nope", { status: 500 }));

    const error = await listDrawings().catch((cause) => cause);
    expect(error).toMatchObject({ status: 500 });
    expect((error as Error).message).toBe("The library request failed (500).");
  });

  it("maps network failures to status 0", async () => {
    installFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await listDrawings().catch((cause) => cause);
    expect(error).toBeInstanceOf(DrawingApiError);
    expect(error).toMatchObject({ status: 0 });
    expect((error as Error).message).toBe("Can’t reach the sprite library. Check your connection.");
  });

  it("rejects a successful response with no body", async () => {
    installFetch(async () => new Response("", { status: 200 }));

    const error = await listDrawings().catch((cause) => cause);
    expect(error).toBeInstanceOf(DrawingApiError);
    expect((error as DrawingApiError).status).toBe(200);
    expect((error as Error).message).toBe("The library returned an unexpected response.");
  });
});
