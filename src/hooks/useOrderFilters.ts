import { useState, useMemo, useCallback, useEffect } from 'react';

interface Order {
  id: string;
  tracking_code: string;
  customer_name: string;
  customer_email: string;
  carrier: string;
  status: string;
  destination: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface OrderFilters {
  search: string;
  status: string[];
  carriers: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  destination: string;
}

export interface FilterOptions {
  statuses: string[];
  carriers: string[];
}

const STORAGE_KEY = 'tracky-order-filters';
const SEARCH_HISTORY_KEY = 'tracky-search-history';
const MAX_SEARCH_HISTORY = 10;

/**
 * Hook avançado para gerenciar filtros e busca de pedidos
 */
export function useOrderFilters(orders: Order[] = []) {
  // Estado dos filtros
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: [],
    carriers: [],
    dateRange: {
      start: null,
      end: null,
    },
    destination: '',
  });

  // Histórico de buscas
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Carregar filtros salvos do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFilters({
          ...parsed,
          dateRange: {
            start: parsed.dateRange.start ? new Date(parsed.dateRange.start) : null,
            end: parsed.dateRange.end ? new Date(parsed.dateRange.end) : null,
          },
        });
      }
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  }, []);

  // Salvar filtros no localStorage quando mudarem
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  }, [filters]);

  // Salvar histórico de buscas
  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, [searchHistory]);

  // Extrair opções únicas de filtros dos pedidos
  const filterOptions = useMemo<FilterOptions>(() => {
    const statuses = new Set<string>();
    const carriers = new Set<string>();

    orders.forEach((order) => {
      if (order.status) statuses.add(order.status);
      if (order.carrier) carriers.add(order.carrier);
    });

    return {
      statuses: Array.from(statuses).sort(),
      carriers: Array.from(carriers).sort(),
    };
  }, [orders]);

  // Atualizar busca
  const setSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search }));
    
    // Adicionar ao histórico se não estiver vazio e for diferente do último
    if (search.trim() && search !== searchHistory[0]) {
      setSearchHistory((prev) => {
        const newHistory = [search, ...prev.filter((s) => s !== search)];
        return newHistory.slice(0, MAX_SEARCH_HISTORY);
      });
    }
  }, [searchHistory]);

  // Atualizar status
  const setStatus = useCallback((status: string[]) => {
    setFilters((prev) => ({ ...prev, status }));
  }, []);

  // Toggle status individual
  const toggleStatus = useCallback((status: string) => {
    setFilters((prev) => {
      const newStatus = prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status];
      return { ...prev, status: newStatus };
    });
  }, []);

  // Atualizar transportadoras
  const setCarriers = useCallback((carriers: string[]) => {
    setFilters((prev) => ({ ...prev, carriers }));
  }, []);

  // Toggle transportadora individual
  const toggleCarrier = useCallback((carrier: string) => {
    setFilters((prev) => {
      const newCarriers = prev.carriers.includes(carrier)
        ? prev.carriers.filter((c) => c !== carrier)
        : [...prev.carriers, carrier];
      return { ...prev, carriers: newCarriers };
    });
  }, []);

  // Atualizar range de datas
  const setDateRange = useCallback((start: Date | null, end: Date | null) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { start, end },
    }));
  }, []);

  // Atualizar destino
  const setDestination = useCallback((destination: string) => {
    setFilters((prev) => ({ ...prev, destination }));
  }, []);

  // Limpar todos os filtros
  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: [],
      carriers: [],
      dateRange: { start: null, end: null },
      destination: '',
    });
  }, []);

  // Limpar histórico de buscas
  const clearSearchHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return (
      filters.search !== '' ||
      filters.status.length > 0 ||
      filters.carriers.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.destination !== ''
    );
  }, [filters]);

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.carriers.length > 0) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.destination) count++;
    return count;
  }, [filters]);

  // Função de filtragem principal
  const filterOrders = useCallback(
    (ordersToFilter: Order[]) => {
      return ordersToFilter.filter((order) => {
        // Busca em múltiplos campos
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch =
            order.tracking_code?.toLowerCase().includes(searchLower) ||
            order.customer_name?.toLowerCase().includes(searchLower) ||
            order.customer_email?.toLowerCase().includes(searchLower) ||
            order.carrier?.toLowerCase().includes(searchLower) ||
            order.destination?.toLowerCase().includes(searchLower);

          if (!matchesSearch) return false;
        }

        // Filtro de status (multi-seleção)
        if (filters.status.length > 0) {
          if (!filters.status.includes(order.status)) return false;
        }

        // Filtro de transportadoras (multi-seleção)
        if (filters.carriers.length > 0) {
          if (!filters.carriers.includes(order.carrier)) return false;
        }

        // Filtro de destino
        if (filters.destination) {
          const destinationLower = filters.destination.toLowerCase();
          if (!order.destination?.toLowerCase().includes(destinationLower)) {
            return false;
          }
        }

        // Filtro de data
        if (filters.dateRange.start || filters.dateRange.end) {
          const orderDate = new Date(order.created_at);

          if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            startDate.setHours(0, 0, 0, 0);
            if (orderDate < startDate) return false;
          }

          if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            endDate.setHours(23, 59, 59, 999);
            if (orderDate > endDate) return false;
          }
        }

        return true;
      });
    },
    [filters]
  );

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    return filterOrders(orders);
  }, [orders, filterOrders]);

  // Estatísticas dos resultados filtrados
  const filterStats = useMemo(() => {
    const total = filteredOrders.length;
    const byStatus = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCarrier = filteredOrders.reduce((acc, order) => {
      acc[order.carrier] = (acc[order.carrier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byStatus,
      byCarrier,
      percentage: orders.length > 0 ? (total / orders.length) * 100 : 0,
    };
  }, [filteredOrders, orders]);

  // Buscar termos destacados para highlighting
  const getHighlightedText = useCallback(
    (text: string) => {
      if (!filters.search || !text) return text;

      const searchLower = filters.search.toLowerCase();
      const textLower = text.toLowerCase();
      const index = textLower.indexOf(searchLower);

      if (index === -1) return text;

      return {
        before: text.substring(0, index),
        match: text.substring(index, index + filters.search.length),
        after: text.substring(index + filters.search.length),
      };
    },
    [filters.search]
  );

  return {
    // Estado
    filters,
    searchHistory,
    filterOptions,
    filteredOrders,
    filterStats,
    hasActiveFilters,
    activeFiltersCount,

    // Setters
    setSearch,
    setStatus,
    toggleStatus,
    setCarriers,
    toggleCarrier,
    setDateRange,
    setDestination,
    clearFilters,
    clearSearchHistory,

    // Utilidades
    getHighlightedText,
    filterOrders,
  };
}
