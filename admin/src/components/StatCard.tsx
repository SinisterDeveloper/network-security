import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  index?: number;
}

export function StatCard({ title, value, subtitle, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
      className="rounded-lg border bg-card p-5"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </motion.div>
  );
}
