import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OrderData {
  tracking_code?: string;
  customer_email?: string;
  order_number?: string;
  customer_name?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface ExistingOrderData {
  id: string;
  tracking_code?: string;
  customer_name?: string;
  customer_email?: string;
  order_number?: string;
}

export interface DuplicateDetection {
  isDuplicate: boolean;
  duplicateType: 'tracking_code' | 'email' | 'order_number' | 'none';
  existingOrderId?: string;
  existingOrderData?: ExistingOrderData;
  confidence: number; // 0-1, quanto maior mais provável ser duplicata
}

export interface DuplicateAnalysis {
  duplicates: DuplicateDetection[];
  summary: {
    totalDuplicates: number;
    byType: Record<string, number>;
    highConfidenceDuplicates: number;
  };
}

export const useDuplicateDetection = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Detectar duplicatas em uma lista de pedidos
  const detectDuplicates = useCallback(async (
    orders: OrderData[]
  ): Promise<DuplicateAnalysis> => {
    setIsAnalyzing(true);

    try {
      const duplicates: DuplicateDetection[] = [];
      const summary = {
        totalDuplicates: 0,
        byType: {} as Record<string, number>,
        highConfidenceDuplicates: 0
      };

      // Verificar duplicatas entre os próprios dados de importação
      const internalDuplicates = findInternalDuplicates(orders);
      duplicates.push(...internalDuplicates);

      // Verificar duplicatas com dados existentes no banco
      const externalDuplicates = await findExternalDuplicates(orders);
      duplicates.push(...externalDuplicates);

      // Calcular estatísticas
      summary.totalDuplicates = duplicates.filter(d => d.isDuplicate).length;
      summary.byType = duplicates.reduce((acc, dup) => {
        if (dup.isDuplicate) {
          acc[dup.duplicateType] = (acc[dup.duplicateType] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      summary.highConfidenceDuplicates = duplicates.filter(d => d.isDuplicate && d.confidence >= 0.8).length;

      return {
        duplicates,
        summary
      };
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Encontrar duplicatas dentro dos dados de importação
  const findInternalDuplicates = (orders: OrderData[]): DuplicateDetection[] => {
    const duplicates: DuplicateDetection[] = [];
    const seen = new Map<string, number>();

    orders.forEach((order, index) => {
      const keys = [
        { key: 'tracking_code', value: order.tracking_code, type: 'tracking_code' as const },
        { key: 'customer_email', value: order.customer_email, type: 'email' as const },
        { key: 'order_number', value: order.order_number, type: 'order_number' as const }
      ];

      keys.forEach(({ key, value, type }) => {
        if (value && value.trim()) {
          const normalizedValue = value.trim().toLowerCase();
          const existingIndex = seen.get(`${type}:${normalizedValue}`);

          if (existingIndex !== undefined) {
            // Já existe uma duplicata
            duplicates.push({
              isDuplicate: true,
              duplicateType: type,
              confidence: 0.9, // Alta confiança para duplicatas internas
              existingOrderId: `import_${existingIndex}`,
              existingOrderData: {
                id: `import_${existingIndex}`,
                tracking_code: orders[existingIndex].tracking_code,
                customer_name: orders[existingIndex].customer_name,
                customer_email: orders[existingIndex].customer_email,
                order_number: orders[existingIndex].order_number
              }
            });
          } else {
            seen.set(`${type}:${normalizedValue}`, index);
          }
        }
      });
    });

    return duplicates;
  };

  // Encontrar duplicatas com dados existentes no banco
  const findExternalDuplicates = async (orders: OrderData[]): Promise<DuplicateDetection[]> => {
    const duplicates: DuplicateDetection[] = [];

    // Coletar todos os valores únicos para cada tipo
    const trackingCodes = orders.map(o => o.tracking_code).filter(Boolean);
    const emails = orders.map(o => o.customer_email).filter(Boolean);
    const orderNumbers = orders.map(o => o.order_number).filter(Boolean);

    // Buscar códigos de rastreio existentes
    if (trackingCodes.length > 0) {
      const { data: existingTracking, error: trackingError } = await supabase
        .from('orders')
        .select('id, tracking_code, customer_name, customer_email')
        .in('tracking_code', trackingCodes);

      if (!trackingError && existingTracking) {
        orders.forEach((order, index) => {
          if (order.tracking_code) {
            const existing = existingTracking.find(e => e.tracking_code === order.tracking_code);
            if (existing) {
              duplicates.push({
                isDuplicate: true,
                duplicateType: 'tracking_code',
                existingOrderId: existing.id,
                existingOrderData: existing,
                confidence: 1.0 // Confiança máxima para códigos de rastreio idênticos
              });
            }
          }
        });
      }
    }

    // Buscar emails existentes
    if (emails.length > 0) {
      const { data: existingEmails, error: emailError } = await supabase
        .from('orders')
        .select('id, tracking_code, customer_name, customer_email')
        .in('customer_email', emails);

      if (!emailError && existingEmails) {
        orders.forEach((order, index) => {
          if (order.customer_email) {
            const existing = existingEmails.find(e => e.customer_email === order.customer_email);
            if (existing) {
              // Verificar se é o mesmo pedido (mesmo código de rastreio)
              const isSameOrder = existing.tracking_code === order.tracking_code;
              duplicates.push({
                isDuplicate: true,
                duplicateType: 'email',
                existingOrderId: existing.id,
                existingOrderData: existing,
                confidence: isSameOrder ? 0.95 : 0.7 // Menos confiança se não for o mesmo pedido
              });
            }
          }
        });
      }
    }

    // Buscar números de pedido existentes
    if (orderNumbers.length > 0) {
      const { data: existingOrders, error: orderError } = await supabase
        .from('orders')
        .select('id, tracking_code, customer_name, order_number')
        .in('order_number', orderNumbers);

      if (!orderError && existingOrders) {
        orders.forEach((order, index) => {
          if (order.order_number) {
            const existing = existingOrders.find(e => e.order_number === order.order_number);
            if (existing) {
              duplicates.push({
                isDuplicate: true,
                duplicateType: 'order_number',
                existingOrderId: existing.id,
                existingOrderData: existing,
                confidence: 0.9 // Alta confiança para números de pedido idênticos
              });
            }
          }
        });
      }
    }

    return duplicates;
  };

  // Resolver duplicatas (decidir como lidar com elas)
  const resolveDuplicates = useCallback((
    orders: OrderData[],
    duplicateDecisions: Array<{
      index: number;
      action: 'skip' | 'update' | 'create_new';
      reason?: string;
    }>
  ): OrderData[] => {
    return orders.filter((order, index) => {
      const decision = duplicateDecisions.find(d => d.index === index);
      return !decision || decision.action !== 'skip';
    });
  }, []);

  return {
    detectDuplicates,
    resolveDuplicates,
    isAnalyzing
  };
};