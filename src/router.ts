import type {
  Env,
  ApiResponse,
  RegisterRequest,
  UnregisterRequest,
  PushRequest,
  PushResult,
  DeviceRegistration,
} from "./types";
import { addDevice, removeDevice, getDevices } from "./kv";
import { sendApns } from "./apns";
import { sendFcm } from "./fcm";

// ───────────────────────────────
// Request routing
// ───────────────────────────────

export async function handleRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  // Health check
  if (method === "GET" && pathname === "/health") {
    return json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
  }

  // Register device
  if (method === "POST" && pathname === "/register") {
    return handleRegister(request, env);
  }

  // Unregister device
  if (method === "DELETE" && pathname === "/register") {
    return handleUnregister(request, env);
  }

  // Send push
  if (method === "POST" && pathname === "/push") {
    return handlePush(request, env);
  }

  return json({ ok: false, error: "Not found" }, 404);
}

// ───────────────────────────────
// Route handlers
// ───────────────────────────────

async function handleRegister(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseBody<RegisterRequest>(request);
  if (!body) return json({ ok: false, error: "Invalid JSON body" }, 400);

  // Validate required fields
  if (!body.relay_token || !body.device_token || !body.platform) {
    return json(
      { ok: false, error: "Missing required fields: relay_token, device_token, platform" },
      400,
    );
  }

  if (!validateRelayToken(body.relay_token)) {
    return json({ ok: false, error: "Invalid relay_token (minimum 32 characters)" }, 400);
  }

  if (body.platform !== "ios" && body.platform !== "android") {
    return json({ ok: false, error: 'platform must be "ios" or "android"' }, 400);
  }

  const device: DeviceRegistration = {
    platform: body.platform,
    device_token: body.device_token,
    bundle_id: body.bundle_id,
    registered_at: new Date().toISOString(),
  };

  await addDevice(env.DEVICE_TOKENS, body.relay_token, device);

  return json({ ok: true, message: "Device registered" });
}

async function handleUnregister(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseBody<UnregisterRequest>(request);
  if (!body) return json({ ok: false, error: "Invalid JSON body" }, 400);

  if (!body.relay_token || !body.device_token) {
    return json(
      { ok: false, error: "Missing required fields: relay_token, device_token" },
      400,
    );
  }

  if (!validateRelayToken(body.relay_token)) {
    return json({ ok: false, error: "Invalid relay_token (minimum 32 characters)" }, 400);
  }

  const removed = await removeDevice(env.DEVICE_TOKENS, body.relay_token, body.device_token);

  return json({
    ok: true,
    message: removed ? "Device removed" : "Device not found",
  });
}

async function handlePush(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await parseBody<PushRequest>(request);
  if (!body) return json({ ok: false, error: "Invalid JSON body" }, 400);

  if (!body.relay_token || !body.title || !body.body) {
    return json(
      { ok: false, error: "Missing required fields: relay_token, title, body" },
      400,
    );
  }

  if (!validateRelayToken(body.relay_token)) {
    return json({ ok: false, error: "Invalid relay_token (minimum 32 characters)" }, 400);
  }

  const devices = await getDevices(env.DEVICE_TOKENS, body.relay_token);

  if (devices.length === 0) {
    return json({ ok: true, results: [], message: "No devices registered" });
  }

  // Send to all devices in parallel
  const results: PushResult[] = await Promise.all(
    devices.map((d) => {
      switch (d.platform) {
        case "ios":
          return sendApns(env, d.device_token, body.title, body.body);
        case "android":
          return sendFcm(env, d.device_token, body.title, body.body);
      }
    }),
  );

  return json({ ok: true, results });
}

// ───────────────────────────────
// Helpers
// ───────────────────────────────

/** Relay token must be at least 32 characters (matches bridge auth_token). */
function validateRelayToken(token: string): boolean {
  return typeof token === "string" && token.length >= 32;
}

async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function json(data: ApiResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
