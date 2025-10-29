import { useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Maximize2, Minimize2, TrendingUp, TrendingDown } from 'lucide-react';
import { AdvancedExportService } from '@/services/advancedExport';

interface CarrierMetric {
  carrier: string;
  total: number;
  delivered: number;
  inTransit: number;
  delayed: number;
  successRate: number;
}

interface InteractiveBarChartProps {
  data: CarrierMetric[];
  title?: string;
  onBarClick?: (data: CarrierMetric) => void;
}

const COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export function InteractiveBarChart({
  data,
  title = 'Performance por Transportadora',
  onBarClick,
}: InteractiveBarChartProps) {
  const [selectedCarrier, setSelectedCarrier] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState<'total' | 'successRate'>('total');
  const chartRef = useRef<HTMLDivElement>(null);

  const sortedData = [...data].sort((a, b) => {
    if (sortBy === 'total') {
      return b.total - a.total;
    }
    return b.successRate - a.successRate;
  });

  const handleBarClick = (data: CarrierMetric) => {
    setSelectedCarrier(data.carrier === selectedCarrier ? null : data.carrier);
    if (onBarClick) {
      onBarClick(data);
    }
  };

  const handleExport = async () => {
    if (chartRef.current) {
      try {
        await AdvancedExportService.exportChartAsImage(
          chartRef.current,
          'grafico-transportadoras'
        );
      } catch (error) {
        console.error('Erro ao exportar gráfico:', error);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-4 border rounded-lg shadow-lg">
          <p className="font-bold text-lg mb-2">{data.carrier}</p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Total:</span>
              <span className="font-semibold">{data.total} pedidos</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Entregues:</span>
              <span className="font-semibold text-green-600">{data.delivered}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Em Trânsito:</span>
              <span className="font-semibold text-blue-600">{data.inTransit}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Atrasados:</span>
              <span className="font-semibold text-red-600">{data.delayed}</span>
            </p>
            <div className="pt-2 mt-2 border-t">
              <p className="flex justify-between gap-4">
                <span className="text-gray-600 dark:text-gray-400">Taxa de Sucesso:</span>
                <span className="font-bold text-indigo-600">{data.successRate}%</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card
      className={`transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'relative'
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'total' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('total')}
            className="gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            Volume
          </Button>
          <Button
            variant={sortBy === 'successRate' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy('successRate')}
            className="gap-2"
          >
            <TrendingDown className="h-4 w-4" />
            Taxa
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-2">
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}>
        <ResponsiveContainer width="100%" height={isFullscreen ? 600 : 350}>
          <BarChart
            data={sortedData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="carrier"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke="#6366f1"
              label={{ value: 'Pedidos', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#10b981"
              label={{ value: 'Taxa (%)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="total"
              name="Total de Pedidos"
              fill="#6366f1"
              radius={[8, 8, 0, 0]}
              onClick={(data: any) => handleBarClick(data)}
              className="cursor-pointer"
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  opacity={
                    selectedCarrier && selectedCarrier !== entry.carrier ? 0.3 : 1
                  }
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
              <LabelList dataKey="total" position="top" fontSize={12} />
            </Bar>
            <Bar
              yAxisId="right"
              dataKey="successRate"
              name="Taxa de Sucesso (%)"
              fill="#10b981"
              radius={[8, 8, 0, 0]}
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-rate-${index}`}
                  fill="#10b981"
                  opacity={
                    selectedCarrier && selectedCarrier !== entry.carrier ? 0.3 : 0.7
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {selectedCarrier && (
          <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              Filtro Ativo: {selectedCarrier}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCarrier(null)}
              className="mt-2"
            >
              Remover Filtro
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
