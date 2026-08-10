import { useState } from "react";
import { motion } from "framer-motion";
import { useAdminLogs } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function Logs() {
  const { data, isLoading } = useAdminLogs();
  const deviceList = Array.isArray(data?.devices) ? data.devices : [];
  const logEntries = Array.isArray(data?.logs) ? data.logs : [];
  const { toast } = useToast();
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<{ key: string; value: unknown } | null>(null);

  const allMessages = deviceList.flatMap((d) =>
    d.messages.map((m) => ({ ...m, deviceName: d.name }))
  );
  allMessages.sort((a, b) => b.timestamp - a.timestamp);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({ title: "Hash copied" });
  };

  const actionRows = logEntries.map((entry, index) => {
    let timestamp: number | undefined = entry.timestamp;
    const value = entry.value;
    if (timestamp === undefined) {
      timestamp = value?.message?.timestamp ?? value?.timestamp ?? value?.registeredAt;
    }
    const deviceLabel =
      value?.name ||
      value?.device?.name ||
      (value?.deviceId ? `#${value.deviceId}` : undefined) ||
      value?.sender ||
      (value?.device ? String(value.device) : undefined);
    let detail = "—";
    if (entry.key === "DECRYPTION" && value?.message?.data) {
      detail = value.message.data;
    } else if (typeof value === "string") {
      detail = value;
    } else if (value && typeof value === "object") {
      try {
        detail = JSON.stringify(value);
      } catch {
        detail = String(value);
      }
    }
    return {
      entry,
      timestamp,
      deviceLabel,
      detail,
      index,
    };
  });

  const formatValue = (value: unknown) => {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const getMessagePayload = (msg: unknown) => {
    const m = msg as Record<string, unknown>;
    return (m?.data ?? (m?.message as Record<string, unknown>)?.data ?? m?.payload ?? m?.body ?? m?.value ?? null) as unknown;
  };

  const getPreview = (value: unknown, limit = 120) => {
    const formatted = formatValue(value);
    if (formatted.length <= limit) return { text: formatted, truncated: false };
    return { text: `${formatted.slice(0, limit)}…`, truncated: true };
  };

  const buildPolygonscanUrl = (hash: string) =>
    `https://amoy.polygonscan.com/tx/${encodeURIComponent(hash)}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Message Logs</h1>
          <p className="text-sm text-muted-foreground">Blockchain-verified audit trail</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border bg-card"
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : allMessages.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No messages recorded
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[80px]">Sender</TableHead>
                <TableHead className="w-[120px]">Device</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead className="w-[280px]">Hash</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {allMessages.map((msg, i) => {
                const hashPreview = msg.hash ? `${msg.hash.slice(0, 20)}…` : "No hash";
                const rowKey = msg.hash ?? `${msg.timestamp}-${i}`;
                const payloadValue = getMessagePayload(msg);
                const payloadPreview = getPreview(payloadValue ?? "--");
                return (
                  <motion.tr
                    key={rowKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="group border-b transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => msg.hash && setSelectedHash(msg.hash)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(msg.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">{msg.sender}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{msg.deviceName}</TableCell>
                    <TableCell
                      className="max-w-[250px] truncate text-sm text-foreground"
                      title={formatValue(payloadValue)}
                    >
                      {payloadPreview.text || "--"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {hashPreview}
                        {msg.hash && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyHash(msg.hash);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] uppercase tracking-wider"
                          >
                            Copy
                          </button>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {msg.hash ? (
                        <a
                          href={buildPolygonscanUrl(msg.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                        >
                          View on Polygonscan
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50">No hash</span>
                      )}
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border bg-card"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Action Logs</p>
            <p className="text-xs text-muted-foreground">Audit trail entries returned by /admin/logs</p>
          </div>
          <span className="text-xs text-muted-foreground">{actionRows.length} records</span>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : actionRows.length === 0 ? (
          <div className="p-10 text-sm text-muted-foreground text-center">No actions recorded yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead className="w-[150px]">Event</TableHead>
                <TableHead className="w-[120px]">Device</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actionRows.map((row) => (
                <TableRow key={`${row.entry.key}-${row.index}`} className="border-b transition-colors hover:bg-muted/50">
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {row.timestamp ? new Date(row.timestamp).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{row.entry.key}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.deviceLabel ?? "—"}</TableCell>
                  <TableCell className="text-sm text-foreground">
                    <div className="space-y-2">
                      <pre className="rounded-md bg-secondary px-3 py-2 text-xs text-foreground whitespace-pre-wrap break-words">
                        {getPreview(row.entry.value).text}
                      </pre>
                      {getPreview(row.entry.value).truncated && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedLog({ key: row.entry.key, value: row.entry.value })}
                        >
                          Expand
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </motion.div>

      <Dialog open={!!selectedHash} onOpenChange={() => setSelectedHash(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Hash Verification
            </DialogTitle>
            <DialogDescription>SHA-256 digest stored on Polygon Amoy</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-secondary p-4">
              <p className="font-mono text-xs text-foreground break-all leading-relaxed">{selectedHash}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => selectedHash && copyHash(selectedHash)}>
                Copy
              </Button>
              {selectedHash ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={buildPolygonscanUrl(selectedHash)} target="_blank" rel="noopener noreferrer">
                    View on Polygonscan
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  View on Polygonscan
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">{selectedLog?.key ?? "Log Entry"}</DialogTitle>
            <DialogDescription>Full log payload</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-secondary p-4">
            <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-words">
              {selectedLog ? formatValue(selectedLog.value) : ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


