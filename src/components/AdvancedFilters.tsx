import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  ChevronDown,
  History,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AdvancedFiltersProps {
  // Filtros
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatuses: string[];
  onStatusToggle: (status: string) => void;
  selectedCarriers: string[];
  onCarrierToggle: (carrier: string) => void;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  onDateRangeChange: (start: Date | null, end: Date | null) => void;
  destination: string;
  onDestinationChange: (value: string) => void;
  
  // Opções disponíveis
  availableStatuses: string[];
  availableCarriers: string[];
  
  // Histórico de buscas
  searchHistory: string[];
  onClearSearchHistory: () => void;
  
  // Estado
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onClearFilters: () => void;
  
  // Estatísticas
  totalOrders: number;
  filteredCount: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Aguardando", color: "bg-gray-500" },
  in_transit: { label: "Em Trânsito", color: "bg-blue-500" },
  out_for_delivery: { label: "Saiu p/ Entrega", color: "bg-indigo-500" },
  delivered: { label: "Entregue", color: "bg-green-500" },
  delayed: { label: "Atrasado", color: "bg-yellow-500" },
  failed: { label: "Falha", color: "bg-red-500" },
  returned: { label: "Devolvido", color: "bg-orange-500" },
};

export function AdvancedFilters({
  searchQuery,
  onSearchChange,
  selectedStatuses,
  onStatusToggle,
  selectedCarriers,
  onCarrierToggle,
  dateRange,
  onDateRangeChange,
  destination,
  onDestinationChange,
  availableStatuses,
  availableCarriers,
  searchHistory,
  onClearSearchHistory,
  hasActiveFilters,
  activeFiltersCount,
  onClearFilters,
  totalOrders,
  filteredCount,
}: AdvancedFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);

  return (
    <div className="space-y-4">
      {/* Barra de Busca Principal */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Campo de Busca com Histórico */}
        <div className="relative flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, cliente, email, transportadora..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setShowSearchHistory(true)}
              onBlur={() => setTimeout(() => setShowSearchHistory(false), 200)}
              className="pl-9 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => onSearchChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Dropdown de Histórico */}
          {showSearchHistory && searchHistory.length > 0 && (
            <Card className="absolute top-full mt-1 w-full z-50 shadow-lg">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Buscas Recentes
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSearchHistory}
                    className="h-6 text-xs"
                  >
                    Limpar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {searchHistory.map((term, index) => (
                    <button
                      key={index}
                      onClick={() => onSearchChange(term)}
                      className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded-md transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={onClearFilters}>
              <X className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Painel de Filtros Avançados */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros Avançados</CardTitle>
            <CardDescription>
              Refine sua busca com múltiplos critérios
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filtro por Status */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Status</label>
              <div className="flex flex-wrap gap-2">
                {availableStatuses.map((status) => {
                  const config = statusConfig[status];
                  const isSelected = selectedStatuses.includes(status);
                  
                  return (
                    <button
                      key={status}
                      onClick={() => onStatusToggle(status)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                        "border flex items-center gap-2",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background hover:bg-muted border-border"
                      )}
                    >
                      <div className={cn("h-2 w-2 rounded-full", config?.color || "bg-gray-400")} />
                      {config?.label || status}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtro por Transportadora */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Transportadora</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {availableCarriers.map((carrier) => {
                  const isSelected = selectedCarriers.includes(carrier);
                  
                  return (
                    <label
                      key={carrier}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted border-border"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onCarrierToggle(carrier)}
                      />
                      <span className="text-sm">{carrier}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Filtro por Data */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Período</label>
              <div className="flex flex-col md:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange.start && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.start ? (
                        format(dateRange.start, "PPP", { locale: ptBR })
                      ) : (
                        "Data inicial"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.start || undefined}
                      onSelect={(date) => onDateRangeChange(date || null, dateRange.end)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateRange.end && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.end ? (
                        format(dateRange.end, "PPP", { locale: ptBR })
                      ) : (
                        "Data final"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.end || undefined}
                      onSelect={(date) => onDateRangeChange(dateRange.start, date || null)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {(dateRange.start || dateRange.end) && (
                  <Button
                    variant="ghost"
                    onClick={() => onDateRangeChange(null, null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filtro por Destino */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Destino</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por cidade ou estado..."
                  value={destination}
                  onChange={(e) => onDestinationChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo dos Filtros */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              {filteredCount} de {totalOrders} pedidos
            </span>
            <span className="text-muted-foreground">
              ({((filteredCount / totalOrders) * 100).toFixed(0)}%)
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Busca: {searchQuery}
                <button onClick={() => onSearchChange('')}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {selectedStatuses.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                {selectedStatuses.length} status
                <button onClick={() => selectedStatuses.forEach(onStatusToggle)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {selectedCarriers.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                {selectedCarriers.length} transportadoras
                <button onClick={() => selectedCarriers.forEach(onCarrierToggle)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            
            {(dateRange.start || dateRange.end) && (
              <Badge variant="secondary" className="gap-1">
                Período definido
                <button onClick={() => onDateRangeChange(null, null)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
