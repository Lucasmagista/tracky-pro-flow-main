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

    // Correios - Padrões mais específicos primeiro
    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code) || /^[A-Z]{2}\d{10}[A-Z]{2}$/.test(code)) {
      return 'Correios';
    }

    // Jadlog - Códigos numéricos de 12-14 dígitos ou iniciando com JD/SM
    if (/^JD\d{10,12}$/.test(code) || /^SM\d{10,12}$/.test(code) || /^\d{12,14}$/.test(code)) {
      return 'Jadlog';
    }

    // Loggi - Códigos iniciando com LG
    if (/^LG\d{9,11}[A-Z]{0,2}$/.test(code)) {
      return 'Loggi';
    }

    // Total Express - Códigos iniciando com TE
    if (/^TE\d{9,11}[A-Z]{0,2}$/.test(code)) {
      return 'Total Express';
    }

    // Azul Cargo - Códigos iniciando com AC
    if (/^AC\d{9,11}[A-Z]{0,2}$/.test(code)) {
      return 'Azul Cargo';
    }

    // Buslog - Códigos numéricos longos ou iniciando com BL
    if (/^BL\d{10,14}$/.test(code) || /^\d{15,20}$/.test(code)) {
      return 'Buslog';
    }

    // LATAM Cargo - Códigos iniciando com LC
    if (/^LC\d{8,12}$/.test(code)) {
      return 'LATAM Cargo';
    }

    // TNT Mercúrio - Códigos iniciando com TM
    if (/^TM\d{8,12}$/.test(code)) {
      return 'TNT Mercúrio';
    }

    // DHL - Códigos iniciando com BR ou padrões internacionais
    if (/^BR\d{10,12}$/.test(code) || /^\d{10}$/.test(code)) {
      // Verificar se não é outro carrier primeiro
      if (!code.startsWith('BR') || code.length === 10) {
        return 'DHL';
      }
    }

    // FedEx - Códigos alfanuméricos específicos
    if (/^[0-9]{12,15}$/.test(code) || /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code)) {
      // Verificar se não é Correios
      if (!(/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(code) && code.length === 13)) {
        return 'FedEx';
      }
    }

    // UPS - Códigos alfanuméricos
    if (/^[A-Z0-9]{18}$/.test(code) || /^1Z[A-Z0-9]{15}$/.test(code)) {
      return 'UPS';
    }

    // Transportadoras regionais comuns
    if (/^SEDEX/i.test(code) || /^PAC/i.test(code)) {
      return 'Correios';
    }

    // Padrão genérico - assumir Correios para códigos não identificados
    return 'Correios';
  };

  return { detectCarrier };
};