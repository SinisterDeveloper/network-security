import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDevices, useDeleteDevice, useDeviceMessages } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AddDeviceDialog } from "@/components/AddDeviceDialog";
import { PendingDeviceCard } from "@/components/PendingDeviceCard";

function DeviceMessages({ deviceId }: { deviceId: string }) {
  const { data: messages, isLoading } = useDeviceMessages(deviceId);

  if (isLoading) return <div className="p-4"><Skeleton className="h-20" /></div>;
  if (!messages?.length) return <div className="p-4 text-sm text-muted-foreground">No messages</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Payload</TableHead>
          <TableHead>Hash</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {messages.map((m, i) => (
          <TableRow key={i}>
            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
              {new Date(m.timestamp).toLocaleString()}
            </TableCell>
            <TableCell className="text-sm max-w-[200px] truncate">{m.data}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{m.hash.slice(0, 16)}…</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Devices() {
  const { data: devices, isLoading } = useDevices();
  const deleteMutation = useDeleteDevice();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: `Device ${id} deleted` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Devices</h1>
          <p className="text-sm text-muted-foreground">ML-KEM-768 secured device registry</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>Add device</Button>
      </div>

      <PendingDeviceCard />
      <AddDeviceDialog open={addOpen} onOpenChange={setAddOpen} />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : !devices?.length ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No devices registered</div>
      ) : (
        <div className="space-y-3">
          {devices.map((device, i) => {
            const isExpanded = expandedId === device.id;
            return (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-lg border bg-card overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : device.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{device.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">#{device.id}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{device.mac}</span>
                        <span>·</span>
                        <span>{device.messages.length} msgs</span>
                        <span>·</span>
                        <span>{new Date(device.registeredAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(device.id); }}
                      >
                        Delete
                      </Button>
                      <span className="uppercase tracking-wide">
                        {isExpanded ? "Hide details" : "Show details"}
                      </span>
                    </div>
                  </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t"
                    >
                      <div className="grid gap-3 p-4 text-xs md:grid-cols-2">
                        <div>
                          <span className="text-muted-foreground">PUF:</span>{" "}
                          <span className="font-mono text-foreground">{device.puf}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Firmware:</span>{" "}
                          <span className="font-mono text-foreground">{device.firmwareHash.slice(0, 24)}…</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-muted-foreground">Public Key:</span>{" "}
                          <span className="font-mono text-foreground break-all">{device.publicKey.slice(0, 64)}…</span>
                        </div>
                      </div>
                      <div className="border-t">
                        <DeviceMessages deviceId={device.id} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
