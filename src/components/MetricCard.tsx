import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { cardHover, cardTap, fadeInUp, defaultTransition } from "@/components/animations";
import { memo } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
  loading?: boolean;
  delay?: number;
}

const MetricCard = memo(({ title, value, icon: Icon, trend, className, loading = false, delay = 0 }: MetricCardProps) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={fadeInUp}
      transition={{ ...defaultTransition, delay }}
      whileHover={cardHover}
      whileTap={cardTap}
    >
      <Card className={cn("transition-smooth hover:shadow-md cursor-pointer", className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {loading ? <Skeleton className="h-4 w-20" /> : title}
          </CardTitle>
          <div className="p-2 rounded-lg bg-primary/10">
            {loading ? <Skeleton className="h-4 w-4" /> : <Icon className="h-4 w-4 text-primary" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? <Skeleton className="h-8 w-16" /> : value}
          </div>
          {trend && (
            <p className={cn(
              "text-xs mt-1",
              trend.isPositive ? "text-accent" : "text-destructive"
            )}>
              {loading ? <Skeleton className="h-3 w-24" /> : `${trend.isPositive ? "↑" : "↓"} ${trend.value}`}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

MetricCard.displayName = 'MetricCard';

export default MetricCard;
