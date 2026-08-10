import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminLogsResponse, type RegisterDevicePayload } from "@/lib/api";

export function useDevices() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: api.getDevices,
    refetchInterval: 15000,
  });
}

export function useAdminLogs() {
  return useQuery({
    queryKey: ["admin-logs"],
    queryFn: api.getAdminLogs,
    refetchInterval: 10000,
  });
}

export function useAdminLogsDevices(): { devices: import("@/lib/api").Device[]; isLoading: boolean } {
  const { data, isLoading } = useAdminLogs();
  return { devices: Array.isArray(data?.devices) ? data.devices : [], isLoading };
}

export function usePendingDevice() {
  return useQuery({
    queryKey: ["pending-device"],
    queryFn: api.getPendingDevice,
    refetchInterval: 5000,
  });
}

export function useDeviceMessages(id: string | null) {
  return useQuery({
    queryKey: ["messages", id],
    queryFn: () => api.getMessages(id!),
    enabled: !!id,
  });
}

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterDevicePayload) => api.registerDevice(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
      qc.invalidateQueries({ queryKey: ["pending-device"] });
    },
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDevice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
  });
}

export function useGatewayStatus() {
  return useQuery({
    queryKey: ["gateway-status"],
    queryFn: api.getGatewayStatus,
    refetchInterval: 15000,
  });
}

export function useBlockDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sram: string; mac?: string }) => api.blockDevice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gateway-status"] }),
  });
}

export function useUnblockDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sram?: string; mac?: string }) => api.unblockDevice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gateway-status"] }),
  });
}

export function useAdminRetry() {
  return useQuery({
    queryKey: ["admin-retry"],
    queryFn: api.getAdminRetry,
    refetchInterval: 15000,
  });
}
