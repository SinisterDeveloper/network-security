"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";

export interface GatewayStatus {
  status: string;
  blockedDevices: { mac?: string; sram?: string; blockedAt: number }[];
}

export function useGatewayStatus(pollMs = 15000) {
  const [data, setData] = React.useState<GatewayStatus | null>(null);
  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const fetchStatus = async () => {
      const gatewayBase = process.env.NEXT_PUBLIC_GATEWAY_BASE || "http://localhost:8824";
      try {
        const res = await fetch(`${gatewayBase}/`, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as GatewayStatus;
        if (mounted) setData(json);
      } catch {
        // gateway may be down in dev, ignore
      }
    };
    fetchStatus();
    const id = setInterval(fetchStatus, pollMs);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(id);
    };
  }, [pollMs]);
  return data;
}
