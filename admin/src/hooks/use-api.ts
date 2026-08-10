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
