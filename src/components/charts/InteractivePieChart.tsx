import { useState, useRef } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Sector,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Maximize2, Minimize2, Filter } from 'lucide-react';
import { AdvancedExportService } from '@/services/advancedExport';

interface StatusDistribution {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

interface InteractivePieChartProps {
  data: StatusDistribution[];
  title?: string;
  onSegmentClick?: (data: StatusDistribution) => void;
}

const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
        {payload.name}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        fill="#333"
        className="font-semibold"
      >{`${value} pedidos`}</text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        fill="#999"
      >
        {`(${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

export function InteractivePieChart({
  data,
  title = 'Distribuição por Status',
  onSegmentClick,
}: InteractivePieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieClick = (data: any, index: number) => {
    setSelectedFilter(data.name);
    if (onSegmentClick) {
      onSegmentClick(data);
    }
  };

  const handleExport = async () => {
    if (chartRef.current) {
      try {
        await AdvancedExportService.exportChartAsImage(chartRef.current, 'grafico-status');
      } catch (error) {
        console.error('Erro ao exportar gráfico:', error);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
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
          {selectedFilter && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFilter(null)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Limpar Filtro
            </Button>
          )}
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
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
              onMouseEnter={onPieEnter}
              onClick={onPieClick}
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={selectedFilter && selectedFilter !== entry.name ? 0.3 : 1}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
                      <p className="font-semibold text-sm">{data.name}</p>
                      <p className="text-lg font-bold" style={{ color: data.color }}>
                        {data.value} pedidos
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {data.percentage}% do total
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry: any) => (
                <span
                  className={`cursor-pointer ${
                    selectedFilter && selectedFilter !== value ? 'opacity-30' : ''
                  }`}
                  onClick={() => {
                    setSelectedFilter(selectedFilter === value ? null : value);
                    if (onSegmentClick) {
                      onSegmentClick(entry.payload);
                    }
                  }}
                >
                  {value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
