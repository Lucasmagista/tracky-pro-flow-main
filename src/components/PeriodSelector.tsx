import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";
import { MetricsService } from "@/services/metrics";

interface PeriodSelectorProps {
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  className?: string;
}

const periodOptions = [
  { value: 'today', label: 'Hoje', icon: Clock },
  { value: 'yesterday', label: 'Ontem', icon: Clock },
  { value: 'last7Days', label: '7 dias', icon: Calendar },
  { value: 'last30Days', label: '30 dias', icon: Calendar },
  { value: 'thisMonth', label: 'Este mês', icon: Calendar },
  { value: 'lastMonth', label: 'Mês passado', icon: Calendar },
];

export function PeriodSelector({ selectedPeriod, onPeriodChange, className }: PeriodSelectorProps) {
  const periods = MetricsService.getPeriods();

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {periodOptions.map((option) => {
        const isActive = selectedPeriod === option.value;
        const Icon = option.icon;
        
        return (
          <button
            key={option.value}
            onClick={() => onPeriodChange(option.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              "flex items-center gap-2",
              "border hover:shadow-md",
              isActive 
                ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                : "bg-background text-muted-foreground hover:text-foreground hover:border-primary/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function PeriodInfo({ period }: { period: ReturnType<typeof MetricsService.getPeriods>[keyof ReturnType<typeof MetricsService.getPeriods>] }) {
  return (
    <div className="text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        <span>
          {period.start.toLocaleDateString('pt-BR')} - {period.end.toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  );
}
