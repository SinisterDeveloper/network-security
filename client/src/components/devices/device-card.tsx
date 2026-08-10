"use client"

import * as React from "react"
import { Device } from "@/app/lib/types"

interface DeviceCardProps {
  device: Device
  onRemove: (device: Device) => void
  onSelect?: (device: Device) => void
}

export function DeviceCard({ device, onRemove, onSelect }: DeviceCardProps) {
  return (
    <div className="py-3 border-b border-border flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={() => onSelect?.(device)}
        className="flex-1 text-left"
      >
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-tight">{device.name}</div>
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
            {device.macAddress}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-8">
        <div className="text-[9px] text-muted-foreground uppercase tracking-tighter">
          {device.status}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRemove(device)
          }}
          className="text-[10px] font-bold hover:bg-foreground hover:text-background px-1 transition-colors uppercase"
        >
          [DEL]
        </button>
      </div>
    </div>
  )
}
