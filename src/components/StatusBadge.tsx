import { Badge } from "@/components/ui/badge";
import { memo } from "react";

type OrderStatus = 
  | "pending"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "delayed"
  | "failed"
  | "returned";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" | "info" | "success" | "warning" }> = {
  pending: {
    label: "Aguardando",
    variant: "info",
  },
  in_transit: {
    label: "Em Trânsito",
    variant: "default",
  },
  out_for_delivery: {
    label: "Saiu p/ Entrega",
    variant: "info",
  },
  delivered: {
    label: "Entregue",
    variant: "success",
  },
  delayed: {
    label: "Atrasado",
    variant: "warning",
  },
  failed: {
    label: "Falha na Entrega",
    variant: "destructive",
  },
  returned: {
    label: "Devolvido",
    variant: "destructive",
  },
};

const StatusBadge = memo(({ status }: StatusBadgeProps) => {
  const config = statusConfig[status] || {
    label: status,
    variant: "outline" as const,
  };
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

export default StatusBadge;
