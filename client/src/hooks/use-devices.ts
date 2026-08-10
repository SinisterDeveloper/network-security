"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";
import type { Device, DeviceListItem } from "@/app/lib/types";

export function useDevices() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      const data = await apiFetch<DeviceListItem[]>("/client/metadata", { signal });
      const mapped: Device[] = data.map((item) => ({
        id: item.id,
        name: item.name || item.mac,
        mac: item.mac,
        macAddress: item.mac,
        puf: item.puf,
        firmwareHash: item.firmwareHash,
        registeredAt: item.registeredAt,
        status: "online" as const,
        addedAt: new Date(item.registeredAt),
      }));
      setDevices(mapped);
      setError(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const c = new AbortController();
    refresh(c.signal);
    return () => c.abort();
  }, [refresh]);

  return { devices, setDevices, isLoading, error, refresh };
}

export function usePendingDevice(pollMs = 5000) {
  const [pending, setPending] = React.useState<import("@/app/lib/types").PendingDevicePayload | null>(null);
  const [pollStatus, setPollStatus] = React.useState("Waiting for device discovery...");
  const [pollError, setPollError] = React.useState<string | null>(null);
  const ref = React.useRef<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const data = await apiFetch<import("@/app/lib/types").PendingDevicePayload | null>("/admin/new", {
          signal: controller.signal,
          admin: true,
        });
        if (!mounted || controller.signal.aborted) return;
        setPollError(null);
        if (data == null) {
          ref.current = null;
          setPending(null);
          setPollStatus("No new devices detected");
          return;
        }
        setPollStatus(`Discovered device ${data.mac}`);
        if (ref.current !== data.mac) {
          ref.current = data.mac;
          setPending(data);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPollError((e as Error).message);
        setPollStatus("Poll error");
      }
    };
    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(id);
    };
  }, [pollMs]);

  const clear = React.useCallback(() => {
    ref.current = null;
    setPending(null);
  }, []);

  return { pending, pollStatus, pollError, clear, ref };
}
