import { describe, it, expect } from "vitest";
import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";

/** Helper to call the worker's fetch handler. */
async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const ctx = createExecutionContext();
  const res = await worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);

  return {
    status: res.status,
    json: (await res.json()) as Record<string, unknown>,
  };
}

const VALID_TOKEN = "x".repeat(32);
const SHORT_TOKEN = "short";

describe("GET /health", () => {
  it("returns healthy status", async () => {
    const { status, json } = await call("GET", "/health");
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe("healthy");
    expect(json.timestamp).toBeDefined();
  });
});

describe("POST /register", () => {
  it("registers an iOS device", async () => {
    const { status, json } = await call("POST", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "apns-device-token-123",
      platform: "ios",
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("registers an Android device", async () => {
    const { status, json } = await call("POST", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "fcm-device-token-456",
      platform: "android",
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("rejects missing relay_token", async () => {
    const { status, json } = await call("POST", "/register", {
      device_token: "abc",
      platform: "ios",
    });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toContain("relay_token");
  });

  it("rejects short relay_token", async () => {
    const { status, json } = await call("POST", "/register", {
      relay_token: SHORT_TOKEN,
      device_token: "abc",
      platform: "ios",
    });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toContain("32 characters");
  });

  it("rejects invalid platform", async () => {
    const { status, json } = await call("POST", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "abc",
      platform: "windows",
    });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
  });

  it("rejects invalid JSON", async () => {
    const ctx = createExecutionContext();
    const res = await worker.fetch(
      new Request("http://localhost/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not json",
      }),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /register", () => {
  it("unregisters a device", async () => {
    // First register
    await call("POST", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "to-remove",
      platform: "ios",
    });

    // Then unregister
    const { status, json } = await call("DELETE", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "to-remove",
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toBe("Device removed");
  });

  it("returns 'not found' for unknown device", async () => {
    const { status, json } = await call("DELETE", "/register", {
      relay_token: VALID_TOKEN,
      device_token: "nonexistent",
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toBe("Device not found");
  });
});

describe("POST /push", () => {
  it("returns empty results when no devices registered", async () => {
    const uniqueToken = "u".repeat(32);
    const { status, json } = await call("POST", "/push", {
      relay_token: uniqueToken,
      title: "Test",
      body: "Hello",
    });
    expect(status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.results).toEqual([]);
    expect(json.message).toBe("No devices registered");
  });

  it("rejects missing title", async () => {
    const { status, json } = await call("POST", "/push", {
      relay_token: VALID_TOKEN,
      body: "Hello",
    });
    expect(status).toBe(400);
    expect(json.ok).toBe(false);
  });
});

describe("Unknown routes", () => {
  it("returns 404 for unknown path", async () => {
    const { status, json } = await call("GET", "/unknown");
    expect(status).toBe(404);
    expect(json.ok).toBe(false);
  });

  it("returns 404 for wrong method on known path", async () => {
    const { status, json } = await call("PUT", "/register");
    expect(status).toBe(404);
    expect(json.ok).toBe(false);
  });
});
