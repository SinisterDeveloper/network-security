export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:3000";

export const GATEWAY_BASE =
  (import.meta.env.VITE_GATEWAY_BASE as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8824";

const ADMIN_KEY = (import.meta.env.VITE_ADMIN_KEY as string | undefined) || "";

export interface Message {
  data: string;
  timestamp: number;
  hash: string;
  sender: string;
}

export interface LogEntry {
  key: string;
  value: unknown;
  timestamp?: number;
  id?: string | null;
}

export interface Device {
  id: string;
  name: string;
  puf: string;
  mac: string;
  publicKey: string;
  messages: Message[];
  registeredAt: number;
  firmwareHash: string;
}

export interface AdminLogsResponse {
  devices: Device[];
  logs: LogEntry[];
}

export interface RegisterDevicePayload {
  name: string;
  puf: string;
  mac: string;
  firmwareHash: string;
}

export interface PendingDevice {
  mac: string;
  puf: string;
  firmwareHash: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isAdmin = path.startsWith("/admin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (isAdmin && ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg =
      (body as { error?: string }).error ||
      (body as { message?: string }).message ||
      `API error ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  // 204 or empty
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;
  const res = await fetch(`${GATEWAY_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg =
      (body as { error?: string }).error ||
      (body as { message?: string }).message ||
      `Gateway error ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export interface BlockedEntry {
  mac?: string;
  sram?: string;
  blockedAt: number;
  lastAttempt?: number;
  attemptCount?: number;
}

export const api = {
  getDevices: () => apiFetch<Device[]>("/client/metadata"),
  getAdminLogs: () => apiFetch<AdminLogsResponse>("/admin/logs"),
  getPendingDevice: () => apiFetch<PendingDevice | null>("/admin/new"),
  getMessages: (id: string) => apiFetch<Message[]>(`/client/message?id=${id}`),
  registerDevice: (payload: RegisterDevicePayload) =>
    apiFetch<Device>("/client/device", { method: "POST", body: JSON.stringify(payload) }),
  deleteDevice: (id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/client/device?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getAdminRetry: () => apiFetch<{ pending: number }>("/admin/retry"),
  getGatewayStatus: () => gatewayFetch<{ status: string; blockedDevices: BlockedEntry[] }>("/"),
  blockDevice: (payload: { sram: string; mac?: string }) =>
    gatewayFetch<{ blocked: boolean; entry: BlockedEntry }>("/admin/block", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  unblockDevice: (payload: { sram?: string; mac?: string }) => {
    const qs = new URLSearchParams();
    if (payload.sram) qs.set("sram", payload.sram);
    if (payload.mac) qs.set("mac", payload.mac);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return gatewayFetch<{ unblocked: number }>(`/admin/block${suffix}`, {
      method: "DELETE",
    });
  },
};
