export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000").replace(/\/$/, "");

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type FetchOpts = RequestInit & { admin?: boolean };

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { admin, ...init } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (admin && ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;
  // admin/new and admin/logs need auth when ADMIN_KEY set
  const needsAdmin = admin || path.startsWith("/admin");
  if (needsAdmin && ADMIN_KEY && !headers["X-Admin-Key"]) headers["X-Admin-Key"] = ADMIN_KEY;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg =
      (body as { error?: string }).error ||
      (body as { message?: string }).message ||
      `API error ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
