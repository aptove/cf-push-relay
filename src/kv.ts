import type { Env, DeviceRegistration, DeviceStore } from "./types";

const KEY_PREFIX = "devices:";

/**
 * Build KV key for a relay token's device list.
 * Each relay_token maps to a single KV entry containing
 * all registered devices for that bridge instance.
 */
function key(relayToken: string): string {
  return `${KEY_PREFIX}${relayToken}`;
}

/** Read device list for a relay token. Returns empty list if not found. */
export async function getDevices(
  kv: KVNamespace,
  relayToken: string,
): Promise<DeviceRegistration[]> {
  const raw = await kv.get<DeviceStore>(key(relayToken), "json");
  return raw?.devices ?? [];
}

/**
 * Register a device. De-duplicates by device_token.
 * If the same token is re-registered, it updates the entry.
 */
export async function addDevice(
  kv: KVNamespace,
  relayToken: string,
  device: DeviceRegistration,
): Promise<void> {
  const devices = await getDevices(kv, relayToken);
  const idx = devices.findIndex((d) => d.device_token === device.device_token);
  if (idx >= 0) {
    devices[idx] = device; // update existing
  } else {
    devices.push(device);
  }
  await kv.put(key(relayToken), JSON.stringify({ devices } satisfies DeviceStore));
}

/**
 * Remove a device by its token.
 * Returns true if it was found and removed.
 */
export async function removeDevice(
  kv: KVNamespace,
  relayToken: string,
  deviceToken: string,
): Promise<boolean> {
  const devices = await getDevices(kv, relayToken);
  const filtered = devices.filter((d) => d.device_token !== deviceToken);
  if (filtered.length === devices.length) return false;

  if (filtered.length === 0) {
    await kv.delete(key(relayToken));
  } else {
    await kv.put(key(relayToken), JSON.stringify({ devices: filtered } satisfies DeviceStore));
  }
  return true;
}

/**
 * Remove a device across ALL relay tokens (used when APNs/FCM
 * reports the token as invalid). This is a best-effort scan;
 * KV list may be paginated.
 */
export async function removeDeviceGlobally(
  kv: KVNamespace,
  deviceToken: string,
): Promise<number> {
  let removed = 0;
  let cursor: string | undefined;

  do {
    const list = await kv.list({ prefix: KEY_PREFIX, cursor });
    for (const entry of list.keys) {
      const relayToken = entry.name.slice(KEY_PREFIX.length);
      if (await removeDevice(kv, relayToken, deviceToken)) {
        removed++;
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  return removed;
}
