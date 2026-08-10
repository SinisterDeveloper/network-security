import { motion } from "framer-motion";
import { useAdminLogs, useAdminRetry, useGatewayStatus } from "@/hooks/use-api";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PendingDeviceCard } from "@/components/PendingDeviceCard";

export default function Dashboard() {
  const { data, isLoading } = useAdminLogs();
  const { data: retryData } = useAdminRetry();
  const { data: gatewayStatus } = useGatewayStatus();
  const deviceList = Array.isArray(data?.devices) ? data.devices : [];

  const allMessages = deviceList.flatMap((d) =>
    d.messages.map((m) => ({ ...m, deviceName: d.name }))
  );
  allMessages.sort((a, b) => b.timestamp - a.timestamp);
  const recentMessages = allMessages.slice(0, 10);

  const totalDevices = deviceList.length;
  const totalMessages = allMessages.length;
  const now = Date.now();
  const msgs24h = allMessages.filter((m) => now - m.timestamp < 86400000).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Post-quantum device infrastructure overview</p>
      </div>

      <PendingDeviceCard />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Total Devices" value={totalDevices} index={0} />
          <StatCard title="Messages (24h)" value={msgs24h} subtitle={`${totalMessages} total`} index={1} />
          <StatCard
            title="Blockchain"
            value={retryData?.pending != null && retryData.pending > 0 ? `${retryData.pending} pending` : "Amoy"}
            subtitle={
              gatewayStatus
                ? `Gateway ${gatewayStatus.blockedDevices.length} blocked`
                : "Polygon testnet"
            }
            index={2}
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="rounded-lg border bg-card"
      >
        <div className="border-b p-4">
          <h2 className="text-sm font-medium text-foreground">Recent Messages</h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : recentMessages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No messages yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[100px]">Sender</TableHead>
                <TableHead>Payload</TableHead>
                <TableHead className="w-[220px]">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentMessages.map((msg, i) => {
                const hashPreview = msg.hash ? `${msg.hash.slice(0, 16)}…` : "No hash";
                return (
                  <motion.tr
                    key={`${msg.hash ?? msg.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">{msg.sender}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{msg.data}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {hashPreview}
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>
    </div>
  );
}
