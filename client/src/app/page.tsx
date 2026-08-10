"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Device } from "@/app/lib/types"
import { DeviceCard } from "@/components/devices/device-card"
import { apiFetch, ApiError } from "@/lib/api"

const POLL_INTERVAL_MS = 5000

const INITIAL_DEVICES: Device[] = []

type DiscoveryPayload = {
  mac: string
  puf: string
  firmwareHash: string
}

type RegistrationResponse = {
  id: string
  mac: string
  puf: string
  firmwareHash: string
  name: string
  publicKey?: string
  messages?: unknown[]
  registeredAt?: number
}

type DeviceListItem = {
  id: string
  name: string
  mac: string
  puf: string
  publicKey?: string
  messages?: unknown[]
  registeredAt: number
  firmwareHash: string
}

export default function Home() {
  const [devices, setDevices] = React.useState<Device[]>(INITIAL_DEVICES)
  const [pendingDevice, setPendingDevice] = React.useState<DiscoveryPayload | null>(null)
  const [deviceName, setDeviceName] = React.useState("")
  const [pollStatus, setPollStatus] = React.useState("Waiting for device discovery...")
  const [pollError, setPollError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [confirmationMessage, setConfirmationMessage] = React.useState<string | null>(null)
  const [lastRegistered, setLastRegistered] = React.useState<RegistrationResponse | null>(null)
  const [deviceToDelete, setDeviceToDelete] = React.useState<Device | null>(null)
  const [isDeletingDevice, setIsDeletingDevice] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deletionMessage, setDeletionMessage] = React.useState<string | null>(null)
  const pendingDeviceRef = React.useRef<string | null>(null)
  const router = useRouter()
  const handleSelectDevice = (device: Device) => {
    router.push(`/devices/${device.id}`)
  }

  React.useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const loadDevices = async () => {
      try {
        const data = await apiFetch<DeviceListItem[]>("/client/metadata", { signal: controller.signal })
        if (!isMounted) return
        const mapped = data.map((item) => ({
          id: item.id,
          name: item.name || item.mac,
          macAddress: item.mac,
          status: "online" as const,
          addedAt: new Date(item.registeredAt)
        }))
        setDevices(mapped)
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        const msg = error instanceof ApiError && error.status === 401
          ? "Unauthorized: set NEXT_PUBLIC_ADMIN_KEY to match server ADMIN_KEY"
          : (error as Error).message
        setPollError(msg)
      }
    }

    loadDevices()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  const handleAddDevice = (newDeviceData: Omit<Device, "status" | "addedAt">) => {
    const newDevice: Device = {
      ...newDeviceData,
      id: newDeviceData.id,
      status: "online",
      addedAt: new Date()
    }
    setDevices((prev) => [newDevice, ...prev])
  }

  const queueDeviceDeletion = (device: Device) => {
    setDeviceToDelete(device)
    setDeleteError(null)
  }

  const cancelDeviceDeletion = () => {
    setDeviceToDelete(null)
    setDeleteError(null)
  }

  React.useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    const pollServer = async () => {
      try {
        const data = await apiFetch<DiscoveryPayload | null>("/admin/new", { signal: controller.signal, admin: true })
        if (!isMounted || controller.signal.aborted) return
        setPollError(null)
        if (data == null) {
          pendingDeviceRef.current = null
          setPendingDevice(null)
          setPollStatus("No new devices detected")
          return
        }
        setPollStatus(`Discovered device ${data.mac}`)
        if (pendingDeviceRef.current !== data.mac) {
          pendingDeviceRef.current = data.mac
          setDeviceName(data.mac ?? "")
          setConfirmationMessage(null)
          setPendingDevice(data)
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        const msg = error instanceof ApiError && error.status === 401
          ? "Unauthorized: set NEXT_PUBLIC_ADMIN_KEY"
          : (error as Error).message
        setPollError(msg)
        setPollStatus("Poll error")
      }
    }

    pollServer()
    const interval = setInterval(pollServer, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  const handleDecline = () => {
    pendingDeviceRef.current = null
    setPendingDevice(null)
    setDeviceName("")
  }

  const safeDeviceName = deviceName ?? ""

  const handleConfirm = async () => {
    if (!pendingDevice) {
      return
    }

    setDeletionMessage(null)
    setIsSubmitting(true)
    setPollError(null)

    try {
      const registered = await apiFetch<RegistrationResponse>("/client/device", {
        method: "POST",
        body: JSON.stringify({
          name: safeDeviceName,
          mac: pendingDevice.mac,
          puf: pendingDevice.puf,
          firmwareHash: pendingDevice.firmwareHash
        })
      })
      

      const confirmationId = registered.id ?? registered.mac ?? "unknown"
      setConfirmationMessage(`Device ${confirmationId} registered successfully.`)
      setLastRegistered(registered)
      handleAddDevice({
        id: registered.id,
        name: registered.name || safeDeviceName,
        macAddress: registered.mac
      })
      pendingDeviceRef.current = null
      setPendingDevice(null)
      setDeviceName("")
    } catch (error) {
      setPollError((error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeviceDeletion = async () => {
    const deleting = deviceToDelete
    if (!deleting) {
      return
    }

    setIsDeletingDevice(true)
    setDeleteError(null)

    try {
      await apiFetch<{ deleted: boolean; id: string }>(`/client/device?id=${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
      })

      setDevices((prev) => prev.filter((device) => device.id !== deleting.id))
      const label = deleting.name || deleting.macAddress || deleting.id
      setDeletionMessage(`Device ${label} deleted successfully.`)
      setDeviceToDelete(null)
    } catch (error) {
      setDeleteError((error as Error).message)
    } finally {
      setIsDeletingDevice(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <header className="space-y-2 border-b border-foreground pb-4">
          <h1 className="text-sm font-bold tracking-tighter uppercase">
            Zero Trust Gateway for Silicon-Based IoT Security
          </h1>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
            STATUS: ACTIVE | COUNT: {devices.length}
          </div>
        </header>

        <main className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-bold uppercase tracking-widest">
              Device Registry
            </h2>
          </div>

          <div className="border-t border-foreground pt-4">
            {devices.length > 0 ? (
              devices.map((device) => (
              <DeviceCard
                  key={device.id}
                  device={device}
                  onRemove={queueDeviceDeletion}
                  onSelect={handleSelectDevice}
                />
              ))
            ) : (
              <div className="py-8 text-[10px] text-muted-foreground uppercase">
                NO_RECORDS_FOUND
              </div>
            )}
          </div>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-300">
              Polling status
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{pollStatus}</span>
              {pollError && (
                <span className="rounded-full border border-red-400/70 px-3 py-0.5 text-xs text-red-200">
                  {pollError}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Checking for new devices...
            </p>
          </section>

            {confirmationMessage && (
              <section className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                {confirmationMessage}
              </section>
            )}

            {deletionMessage && (
              <section className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                {deletionMessage}
              </section>
            )}

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Last registered payload
            </p>
            {lastRegistered ? (
              <div className="mt-2 space-y-1 text-xs">
              <p>
                <span className="text-slate-400">Device ID:</span>{" "}
                {lastRegistered.id ?? lastRegistered.mac ?? "unknown"}
              </p>
                <p>
                  <span className="text-slate-400">MAC:</span> {lastRegistered.mac}
                </p>
                <p>
                  <span className="text-slate-400">PUF:</span> {lastRegistered.puf}
                </p>
                <p>
                  <span className="text-slate-400">Firmware Hash:</span>{" "}
                  {lastRegistered.firmwareHash}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">Awaiting first enrollment...</p>
            )}
          </section>
        </main>
      </div>

      {pendingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/20 bg-slate-950 p-6 shadow-2xl shadow-black/80">
            <h2 className="text-xl font-semibold text-white">
              Are u sure u want to enter this new device with MAC: {pendingDevice.mac}
            </h2>
            <p className="text-sm text-slate-300">
              Confirm the identity details below before sending the enrollment request.
            </p>
            <label className="flex flex-col space-y-2 text-sm">
              <span className="text-slate-400">Device Name</span>
                <input
                  className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-white outline-none transition hover:border-white/40 focus:border-white/70"
                  value={safeDeviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white transition hover:border-white/70"
                onClick={handleDecline}
                disabled={isSubmitting}
              >
                cancel
              </button>
              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                onClick={handleConfirm}
                disabled={isSubmitting || safeDeviceName.trim() === ""}
              >
                {isSubmitting ? "sending..." : "yes, enroll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/20 bg-slate-950 p-6 shadow-2xl shadow-black/80">
            <h2 className="text-xl font-semibold text-white">
              Confirm deletion of {deviceToDelete.name || deviceToDelete.macAddress}
            </h2>
            <p className="text-sm text-slate-300">
              This will remove the device and notify the server via DELETE /client/device?id={deviceToDelete.id}.
            </p>
            {deleteError && (
              <div className="rounded-xl border border-red-400/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {deleteError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-white transition hover:border-white/70"
                onClick={cancelDeviceDeletion}
                disabled={isDeletingDevice}
              >
                cancel
              </button>
              <button
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 transition hover:bg-rose-400 disabled:opacity-50"
                onClick={confirmDeviceDeletion}
                disabled={isDeletingDevice}
              >
                {isDeletingDevice ? "deleting..." : "yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
