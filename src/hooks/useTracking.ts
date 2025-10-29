import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface TrackingResult {
  codigo: string;
  eventos: Array<{
    data: string;
    hora: string;
    local: string;
    status: string;
    subStatus?: string[];
  }>;
  success: boolean;
  error?: string;
}

export const useTracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const trackOrder = useMutation({
    mutationFn: async (trackingCode: string): Promise<TrackingResult> => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke('track-correios', {
        body: { trackingCode }
      });

      if (error) throw error;
      return data as TrackingResult;
    },
    onSuccess: (data, trackingCode) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["order-metrics"] });

      // Se foi bem-sucedido, podemos atualizar o cache local
      if (data.success && data.eventos.length > 0) {
        queryClient.setQueryData(["tracking", trackingCode], data);
      }
    },
  });

  const getTrackingHistory = useMutation({
    mutationFn: async (trackingCode: string): Promise<TrackingResult> => {
      // Primeiro tentar do cache
      const cached = queryClient.getQueryData(["tracking", trackingCode]);
      if (cached) return cached as TrackingResult;

      // Se não estiver no cache, consultar API
      return trackOrder.mutateAsync(trackingCode);
    },
  });

  return {
    trackOrder,
    getTrackingHistory,
    isTracking: trackOrder.isPending,
    trackingError: trackOrder.error,
  };
};

// Hook para detectar transportadora automaticamente
export const useCarrierDetection = () => {
  const detectCarrier = (trackingCode: string): string => {
    const code = trackingCode.toUpperCase().replace(/\s/g, '');

    // Padrões de códigos de rastreamento brasileiros
    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) {
      return 'Correios';
    }

    if (/^[A-Z]{2}\d{10}[A-Z]{2}$/.test(code)) {
      return 'Correios';
    }

    if (/^\d{12,14}$/.test(code)) {
      return 'Jadlog';
    }

    if (/^[A-Z]{2}\d{8}[A-Z]{2}$/.test(code)) {
      return 'Total Express';
    }

    if (/^\d{10}$/.test(code)) {
      return 'Azul Cargo';
    }

    // Padrão genérico
    return 'Correios';
  };

  return { detectCarrier };
};