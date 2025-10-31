import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  FileText,
  Users,
  Package,
  Timer
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportMetrics {
  totalOrders: number;
  processedOrders: number;
  successfulImports: number;
  failedImports: number;
  warningImports: number;
  startTime: Date;
  estimatedEndTime?: Date;
  currentChunk: number;
  totalChunks: number;
  averageProcessingTime: number;
  memoryUsage?: number;
  networkRequests: number;
  errors: Array<{
    code: string;
    message: string;
    count: number;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    count: number;
  }>;
}

interface ImportMetricsDashboardProps {
  metrics: ImportMetrics | null;
  isImporting: boolean;
  onExportReport?: () => void;
  onViewDetails?: () => void;
}

export const ImportMetricsDashboard: React.FC<ImportMetricsDashboardProps> = ({
  metrics,
  isImporting,
  onExportReport,
  onViewDetails
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!metrics && !isImporting) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dashboard de Métricas de Importação
          </CardTitle>
          <CardDescription>
            Monitore o progresso e métricas das suas importações CSV/Excel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma importação em andamento</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = metrics ? (metrics.processedOrders / metrics.totalOrders) * 100 : 0;
  const successRate = metrics ? (metrics.successfulImports / metrics.processedOrders) * 100 : 0;
  const errorRate = metrics ? (metrics.failedImports / metrics.processedOrders) * 100 : 0;
  const warningRate = metrics ? (metrics.warningImports / metrics.processedOrders) * 100 : 0;

  const elapsedTime = metrics ? (currentTime.getTime() - metrics.startTime.getTime()) / 1000 : 0;
  const estimatedTotalTime = metrics && metrics.averageProcessingTime > 0
    ? (metrics.totalOrders * metrics.averageProcessingTime) / 1000
    : 0;
  const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Dashboard de Métricas de Importação
            </CardTitle>
            <CardDescription>
              {isImporting ? 'Importação em andamento...' : 'Importação concluída'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {onViewDetails && (
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-2" />
                Detalhes
              </Button>
            )}
            {onExportReport && (
              <Button variant="outline" size="sm" onClick={onExportReport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Progresso Geral</span>
            <span className="text-muted-foreground">
              {metrics?.processedOrders || 0} / {metrics?.totalOrders || 0} pedidos
            </span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(1)}% concluído</span>
            {isImporting && remainingTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ETA: {formatTime(remainingTime)}
              </span>
            )}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-600">{metrics?.successfulImports || 0}</div>
            <div className="text-sm text-green-700 font-medium">Sucessos</div>
            <div className="text-xs text-green-600 mt-1">
              {successRate.toFixed(1)}% do total
            </div>
          </div>

          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-600">{metrics?.failedImports || 0}</div>
            <div className="text-sm text-red-700 font-medium">Falhas</div>
            <div className="text-xs text-red-600 mt-1">
              {errorRate.toFixed(1)}% do total
            </div>
          </div>

          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-yellow-600">{metrics?.warningImports || 0}</div>
            <div className="text-sm text-yellow-700 font-medium">Avisos</div>
            <div className="text-xs text-yellow-600 mt-1">
              {warningRate.toFixed(1)}% do total
            </div>
          </div>

          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Timer className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-blue-600">{formatTime(elapsedTime)}</div>
            <div className="text-sm text-blue-700 font-medium">Tempo Decorrido</div>
            <div className="text-xs text-blue-600 mt-1">
              {metrics?.averageProcessingTime ? `${metrics.averageProcessingTime.toFixed(0)}ms/pedido` : '-'}
            </div>
          </div>
        </div>

        {/* Chunk Progress */}
        {metrics && metrics.totalChunks > 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Processamento em Chunks</span>
              <span className="text-muted-foreground">
                Chunk {metrics.currentChunk} / {metrics.totalChunks}
              </span>
            </div>
            <Progress value={(metrics.currentChunk / metrics.totalChunks) * 100} className="h-2" />
          </div>
        )}

        {/* Performance Metrics */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Pedidos/segundo:</span>
                <span className="font-medium">
                  {elapsedTime > 0 ? ((metrics?.processedOrders || 0) / elapsedTime).toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de sucesso:</span>
                <Badge variant={successRate >= 90 ? "default" : successRate >= 70 ? "secondary" : "destructive"}>
                  {successRate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Requests de rede:</span>
                <span className="font-medium">{metrics?.networkRequests || 0}</span>
              </div>
              {metrics?.memoryUsage && (
                <div className="flex justify-between">
                  <span>Uso de memória:</span>
                  <span className="font-medium">{formatBytes(metrics.memoryUsage)}</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Estatísticas
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total de pedidos:</span>
                <span className="font-medium">{metrics?.totalOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Processados:</span>
                <span className="font-medium">{metrics?.processedOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Restantes:</span>
                <span className="font-medium">
                  {(metrics?.totalOrders || 0) - (metrics?.processedOrders || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tempo médio:</span>
                <span className="font-medium">
                  {metrics?.averageProcessingTime ? `${metrics.averageProcessingTime.toFixed(0)}ms` : '-'}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Errors and Warnings */}
        {(metrics?.errors.length || metrics?.warnings.length) && (
          <div className="space-y-4">
            {metrics.errors.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-medium mb-2">Principais Erros:</div>
                  <div className="space-y-1">
                    {metrics.errors.slice(0, 3).map((error, index) => (
                      <div key={index} className="text-sm">
                        <Badge variant="destructive" className="mr-2">{error.count}x</Badge>
                        {error.message}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {metrics.warnings.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  <div className="font-medium mb-2">Principais Avisos:</div>
                  <div className="space-y-1">
                    {metrics.warnings.slice(0, 3).map((warning, index) => (
                      <div key={index} className="text-sm">
                        <Badge variant="secondary" className="mr-2">{warning.count}x</Badge>
                        {warning.message}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Real-time Updates */}
        {isImporting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Atualizando métricas em tempo real...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};