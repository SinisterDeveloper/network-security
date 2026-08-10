import { useState } from "react";
import { usePendingDevice } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddDeviceDialog } from "@/components/AddDeviceDialog";

export function PendingDeviceCard() {
  const { data: pending, isLoading } = usePendingDevice();
  const [approveOpen, setApproveOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-28 rounded-lg" />;
  if (!pending) return null;

  return (
    <>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Pending approval</p>
            <p className="text-xs text-muted-foreground">
              Gateway reported an unknown device. Approve to create it via{" "}
              <span className="font-mono">POST /client/device</span>.
            </p>
            <div className="pt-2 space-y-1 text-xs font-mono break-all">
              <div>
                <span className="text-muted-foreground">MAC:</span> <span className="text-foreground">{pending.mac}</span>
              </div>
              <div>
                <span className="text-muted-foreground">PUF:</span>{" "}
                <span className="text-foreground">{pending.puf.slice(0, 32)}…{pending.puf.slice(-8)}</span>
                <span className="text-muted-foreground"> ({pending.puf.length} hex)</span>
              </div>
              <div>
                <span className="text-muted-foreground">firmwareHash:</span>{" "}
                <span className="text-foreground">{pending.firmwareHash}</span>
              </div>
            </div>
          </div>
          <Button size="sm" onClick={() => setApproveOpen(true)}>
            Approve
          </Button>
        </div>
      </div>

      <AddDeviceDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        defaults={{
          mac: pending.mac,
          puf: pending.puf,
          firmwareHash: pending.firmwareHash,
        }}
      />
    </>
  );
}
