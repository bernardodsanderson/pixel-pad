import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { config } from "../netlify/functions/drawings";

type StoredDrawing = {
  id: string;
  title: string;
  gridSize: number;
  pixels: number[];
  updatedAt: string;
};

const h = vi.hoisted(() => {
  const data = new Map<string, unknown>();
  const calls = {
    list: [] as Array<{ prefix: string }>,
    get: [] as string[],
    setJSON: [] as string[],
    delete: [] as string[],
  };
  const state = {
    user: { id: "user-1" } as { id: string } | null,
    failNext: null as "list" | "get" | "setJSON" | "delete" | null,
  };
  return { data, calls, state };
});

vi.mock("@netlify/blobs", () => ({
  getStore: () => ({
    list: async (options: { prefix: string }) => {
      h.calls.list.push(options);
      if (h.state.failNext === "list") {
        h.state.failNext = null;
        throw new Error("list failed");
      }
      return {
        blobs: [...h.data.keys()]
          .filter((key) => key.startsWith(options.prefix))
          .map((key) => ({ key })),
      };
    },
    get: async (key: string) => {
      h.calls.get.push(key);
      if (h.state.failNext === "get") {
        h.state.failNext = null;
        throw new Error("get failed");
      }
      return h.data.get(key) ?? null;
    },
    setJSON: async (key: string, value: unknown) => {
      h.calls.setJSON.push(key);
      if (h.state.failNext === "setJSON") {
        h.state.failNext = null;
        throw new Error("set failed");
      }
      h.data.set(key, JSON.parse(JSON.stringify(value)));
    },
    delete: async (key: string) => {
      h.calls.delete.push(key);
      if (h.state.failNext === "delete") {
        h.state.failNext = null;
        throw new Error("delete failed");
      }
      h.data.delete(key);
    },
  }),
}));

vi.mock("@netlify/identity", () => ({
  getUser: async () => h.state.user,
}));

const ID = "123e4567-e89b-12d3-a456-426614174000";
const OTHER_ID = "9c8b7a65-e4d3-4c2b-8a19-0f1e2d3c4b5a";
const MAX_BODY_BYTES_FOR_TEST = 64 * 1024;

function validPixels(size = 8): number[] {
  return new Array(size * size).fill(-1);
}

function body(overrides: Record<string, unknown> = {}) {
  return {
    title: "Sprite",
    gridSize: 8,
    pixels: validPixels(8),
    ...overrides,
  };
}

function request(method: string, payload?: unknown, url = "http://localhost/api/drawings") {
  const init: RequestInit = { method };
  if (payload !== undefined) {
    init.body = typeof payload === "string" ? payload : JSON.stringify(payload);
    init.headers = { "content-type": "application/json" };
  }
  return new Request(url, init);
}

function seed(userId: string, overrides: Partial<StoredDrawing> & { id: string }) {
  const record: StoredDrawing = {
    title: "Saved",
    gridSize: 8,
    pixels: validPixels(8),
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  h.data.set(`u/${userId}/${record.id}.json`, record);
  return record;
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-02T03:04:05.000Z"));
  h.data.clear();
  h.calls.list.length = 0;
  h.calls.get.length = 0;
  h.calls.setJSON.length = 0;
  h.calls.delete.length = 0;
  h.state.user = { id: "user-1" };
  h.state.failNext = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("routing", () => {
  it("serves /api/drawings", () => {
    expect(config).toEqual({ path: "/api/drawings" });
  });

  it("rejects unsupported methods", async () => {
    const response = await handler(request("PUT", body()));
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST, DELETE");
    await expect(json(response)).resolves.toEqual({ error: "Method not allowed." });
  });

  it("rejects browser-labelled cross-site requests", async () => {
    const response = await handler(
      new Request("http://localhost/api/drawings", {
        method: "GET",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    );
    expect(response.status).toBe(403);
    await expect(json(response)).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
    });
  });
});

describe("authentication", () => {
  it("returns 401 without a session", async () => {
    h.state.user = null;
    const response = await handler(request("GET"));
    expect(response.status).toBe(401);
    await expect(json(response)).resolves.toEqual({ error: "Unauthorized" });
    expect(h.calls.list).toEqual([]);
  });

  it("never trusts a client-supplied user id", async () => {
    const response = await handler(
      request("POST", body({ userId: "attacker", owner: "attacker" })),
    );
    expect(response.status).toBe(200);
    expect(h.calls.setJSON[0]).toMatch(/^u\/user-1\//);
  });
});

describe("GET", () => {
  it("returns an empty list", async () => {
    const response = await handler(request("GET"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(json(response)).resolves.toEqual({ drawings: [] });
    expect(h.calls.list).toEqual([{ prefix: "u/user-1/" }]);
  });

  it("returns only the signed-in user's sprites, newest first", async () => {
    seed("user-1", { id: ID, title: "Older", updatedAt: "2026-01-01T00:00:00.000Z" });
    seed("user-1", { id: OTHER_ID, title: "Newer", updatedAt: "2026-01-03T00:00:00.000Z" });
    seed("user-2", { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Theirs" });

    const response = await handler(request("GET"));
    const data = await json(response);
    const drawings = data.drawings as StoredDrawing[];

    expect(drawings.map((drawing) => drawing.title)).toEqual(["Newer", "Older"]);
    expect(drawings.some((drawing) => drawing.title === "Theirs")).toBe(false);
  });

  it("drops malformed stored records", async () => {
    const valid = seed("user-1", { id: ID });
    h.data.set("u/user-1/bad-null.json", null);
    h.data.set("u/user-1/bad-text.json", "nope");
    h.data.set("u/user-1/bad-grid.json", { ...valid, id: OTHER_ID, gridSize: 10 });
    h.data.set("u/user-1/bad-pixels.json", { ...valid, id: OTHER_ID, pixels: "nope" });
    h.data.set("u/user-1/bad-length.json", {
      ...valid,
      id: OTHER_ID,
      pixels: validPixels(4),
    });
    const invalidPixels = validPixels(8);
    invalidPixels[0] = 16;
    h.data.set("u/user-1/bad-value.json", {
      ...valid,
      id: OTHER_ID,
      pixels: invalidPixels,
    });
    h.data.set("u/user-1/bad-date.json", {
      ...valid,
      id: OTHER_ID,
      updatedAt: "not a date",
    });
    h.data.set("u/user-1/bad-id.json", { ...valid, id: "not-a-uuid" });
    h.data.set("u/user-1/bad-title.json", { ...valid, id: OTHER_ID, title: "   " });

    const data = await json(await handler(request("GET")));
    const drawings = data.drawings as StoredDrawing[];
    expect(drawings).toHaveLength(1);
    expect(drawings[0]?.id).toBe(ID);
  });

  it("caps the list at 40 sprites", async () => {
    for (let i = 0; i < 45; i++) {
      seed("user-1", {
        id: `${i}`.padStart(8, "0") + "-0000-4000-8000-000000000000",
        title: `Sprite ${i}`,
        updatedAt: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
    }

    const data = await json(await handler(request("GET")));
    expect(data.drawings).toHaveLength(40);
  });
});

describe("POST create", () => {
  it("creates a sprite with a server id and timestamp", async () => {
    const response = await handler(request("POST", body({ title: "  My sprite  " })));
    expect(response.status).toBe(200);

    const saved = (await json(response)) as StoredDrawing;
    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(saved.title).toBe("My sprite");
    expect(saved.gridSize).toBe(8);
    expect(saved.pixels).toHaveLength(64);
    expect(saved.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(h.calls.setJSON).toEqual([`u/user-1/${saved.id}.json`]);
    expect(h.data.get(`u/user-1/${saved.id}.json`)).toEqual(saved);
  });

  it("accepts every supported grid size", async () => {
    for (const size of [8, 16, 24, 32, 48, 64]) {
      h.data.clear();
      const response = await handler(
        request("POST", body({ gridSize: size, pixels: validPixels(size) })),
      );
      expect(response.status).toBe(200);
      expect(((await json(response)) as StoredDrawing).pixels).toHaveLength(size * size);
    }
  });

  it("refuses a 41st sprite", async () => {
    for (let i = 0; i < 40; i++) {
      seed("user-1", {
        id: `${i}`.padStart(8, "0") + "-0000-4000-8000-000000000000",
      });
    }

    const response = await handler(request("POST", body()));
    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({
      error: "Sprite library is full (40). Delete one to save another.",
    });
    expect(h.calls.setJSON).toEqual([]);
  });
});

describe("POST update", () => {
  it("updates a sprite owned by the signed-in user", async () => {
    seed("user-1", { id: ID, title: "Old", updatedAt: "2020-01-01T00:00:00.000Z" });

    const response = await handler(
      request("POST", body({ id: ID, title: "New name", gridSize: 16, pixels: validPixels(16) })),
    );
    expect(response.status).toBe(200);

    const saved = (await json(response)) as StoredDrawing;
    expect(saved.id).toBe(ID);
    expect(saved.title).toBe("New name");
    expect(saved.gridSize).toBe(16);
    expect(saved.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(h.data.get(`u/user-1/${ID}.json`)).toEqual(saved);
  });

  it("accepts uppercase ids and stores them lowercased", async () => {
    seed("user-1", { id: ID, title: "Old" });

    const response = await handler(
      request("POST", body({ id: ID.toUpperCase(), title: "Updated" })),
    );
    expect(response.status).toBe(200);
    expect(h.calls.setJSON).toEqual([`u/user-1/${ID}.json`]);
    expect((h.data.get(`u/user-1/${ID}.json`) as StoredDrawing).title).toBe("Updated");
  });

  it("returns 404 for a missing sprite", async () => {
    const response = await handler(request("POST", body({ id: ID })));
    expect(response.status).toBe(404);
    expect(await json(response)).toEqual({ error: "That sprite no longer exists." });
    expect(h.calls.setJSON).toEqual([]);
  });

  it("cannot update another account's sprite", async () => {
    seed("user-2", { id: ID, title: "Theirs" });

    const response = await handler(request("POST", body({ id: ID, title: "Mine now" })));
    expect(response.status).toBe(404);
    expect((h.data.get(`u/user-2/${ID}.json`) as StoredDrawing).title).toBe("Theirs");
  });

  it("still allows updates when the library is full", async () => {
    for (let i = 0; i < 40; i++) {
      seed("user-1", {
        id: `${i}`.padStart(8, "0") + "-0000-4000-8000-000000000000",
      });
    }

    const response = await handler(request("POST", body({ id: ID })));
    expect(response.status).toBe(404);
    seed("user-1", { id: ID });
    const updated = await handler(request("POST", body({ id: ID, title: "Updated" })));
    expect(updated.status).toBe(200);
  });
});

describe("POST validation", () => {
  it("rejects a non-JSON body", async () => {
    const response = await handler(request("POST", "{not json"));
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error: "The request body is not valid JSON.",
    });
  });

  it("rejects a non-object body", async () => {
    for (const payload of ["null", "[]", "42", '"a string"']) {
      const response = await handler(request("POST", payload));
      expect(response.status, payload).toBe(400);
      expect(await json(response)).toEqual({
        error: "Send a JSON object with the sprite.",
      });
    }
  });

  it("rejects an empty body", async () => {
    const response = await handler(request("POST", ""));
    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      error: "The request body is not valid JSON.",
    });
  });

  it("rejects oversized JSON bodies", async () => {
    const payload = JSON.stringify(body({ title: "x".repeat(70 * 1024) }));
    const response = await handler(request("POST", payload));
    expect(response.status).toBe(413);
    expect(await json(response)).toEqual({
      error: "The request body is too large.",
    });
    expect(h.calls.setJSON).toEqual([]);
  });

  it("rejects a declared oversized content length before reading", async () => {
    const response = await handler(
      new Request("http://localhost/api/drawings", {
        method: "POST",
        body: "{}",
        headers: {
          "content-length": String(MAX_BODY_BYTES_FOR_TEST + 1),
          "content-type": "application/json",
        },
      }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects an empty title", async () => {
    for (const title of ["", "   "]) {
      const response = await handler(request("POST", body({ title })));
      expect(response.status).toBe(400);
      expect((await json(response)).error).toBe("Give the sprite a name (1–48 characters).");
    }
  });

  it("rejects a title over 48 characters", async () => {
    const response = await handler(request("POST", body({ title: "x".repeat(49) })));
    expect(response.status).toBe(400);
    expect((await json(response)).error).toBe("Give the sprite a name (1–48 characters).");
  });

  it("accepts a 48-character title", async () => {
    const response = await handler(request("POST", body({ title: "x".repeat(48) })));
    expect(response.status).toBe(200);
  });

  it("rejects an unsupported grid size", async () => {
    for (const gridSize of [0, 10, 33, 128, "8"]) {
      const response = await handler(request("POST", body({ gridSize })));
      expect(response.status, `gridSize=${String(gridSize)}`).toBe(400);
      expect((await json(response)).error).toBe("Unsupported grid size.");
    }
  });

  it("rejects pixels that do not match the grid", async () => {
    for (const pixels of [undefined, [], validPixels(16), "nope"]) {
      const response = await handler(request("POST", body({ pixels })));
      expect(response.status).toBe(400);
      expect((await json(response)).error).toBe("The sprite data does not match its grid size.");
    }
  });

  it("rejects invalid colour indexes", async () => {
    for (const invalid of [-2, 16, 1.5, Number.NaN, "3", true, null, {}]) {
      const pixels = validPixels(8);
      pixels[0] = invalid as number;
      const response = await handler(request("POST", body({ pixels })));
      expect(response.status, `pixel=${String(invalid)}`).toBe(400);
      expect((await json(response)).error).toBe("The sprite contains an invalid colour index.");
    }
  });

  it("accepts the full colour range", async () => {
    const pixels = validPixels(8);
    pixels[0] = -1;
    pixels[1] = 0;
    pixels[2] = 15;
    const response = await handler(request("POST", body({ pixels })));
    expect(response.status).toBe(200);
  });

  it("rejects an invalid sprite id", async () => {
    for (const id of ["x", "1-2-3", `${ID}-extra`]) {
      const response = await handler(request("POST", body({ id })));
      expect(response.status).toBe(400);
      expect((await json(response)).error).toBe("That sprite id is not valid.");
    }
  });
});

describe("DELETE", () => {
  it("deletes by query-string id", async () => {
    seed("user-1", { id: ID });
    const response = await handler(
      request("DELETE", undefined, `http://localhost/api/drawings?id=${ID}`),
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
    expect(h.calls.delete).toEqual([`u/user-1/${ID}.json`]);
    expect(h.data.has(`u/user-1/${ID}.json`)).toBe(false);
  });

  it("deletes by JSON body id", async () => {
    seed("user-1", { id: ID });
    const response = await handler(request("DELETE", { id: ID }));
    expect(response.status).toBe(200);
    expect(h.data.has(`u/user-1/${ID}.json`)).toBe(false);
  });

  it("is idempotent for a missing sprite", async () => {
    const response = await handler(
      request("DELETE", undefined, `http://localhost/api/drawings?id=${ID}`),
    );
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true });
  });

  it("rejects a missing id", async () => {
    const response = await handler(request("DELETE"));
    expect(response.status).toBe(400);
    expect((await json(response)).error).toBe("Send the sprite id as JSON.");
  });

  it("rejects malformed JSON when no query id is given", async () => {
    const response = await handler(request("DELETE", "{not json"));
    expect(response.status).toBe(400);
    expect((await json(response)).error).toBe("Send the sprite id as JSON.");
  });

  it("rejects an invalid id", async () => {
    const response = await handler(
      request("DELETE", undefined, "http://localhost/api/drawings?id=nope"),
    );
    expect(response.status).toBe(400);
    expect((await json(response)).error).toBe("That sprite id is not valid.");
  });

  it("cannot delete another account's sprite", async () => {
    seed("user-2", { id: ID });
    const response = await handler(
      request("DELETE", undefined, `http://localhost/api/drawings?id=${ID}`),
    );
    expect(response.status).toBe(200);
    expect(h.data.has(`u/user-2/${ID}.json`)).toBe(true);
  });
});

describe("unexpected failures", () => {
  it("returns a generic 500 without leaking internals", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    h.state.failNext = "setJSON";

    const response = await handler(request("POST", body()));
    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({
      error: "The sprite library hit an unexpected error.",
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
