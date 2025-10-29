/**
 * Componente de Histórico de Importações com Rollback
 */

import { useEffect, useState, useCallback } from 'react';
import { useImportRollback } from '@/hooks/useImportRollback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  Undo2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Trash2,
  Download,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ImportBatch } from '@/services/importRollback';

export function ImportHistory() {
  const {
    batches,
    currentBatch,
    isLoading,
    isRollingBack,
    loadBatches,
    loadBatchDetails,
    rollbackBatch,
    rollbackRecords,
    getStats,
  } = useImportRollback();

  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [batchToRollback, setBatchToRollback] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [stats, setStats] = useState<{
    total_batches: number;
    total_imports: number;
    total_rollbacks: number;
    success_rate: number;
    by_source: Record<string, number>;
  } | null>(null);

  const loadStats = useCallback(async () => {
    const data = await getStats();
    setStats(data);
  }, [getStats]);

  useEffect(() => {
    loadBatches();
    loadStats();
  }, [loadBatches, loadStats]);

  const handleViewDetails = async (batchId: string) => {
    setSelectedBatch(batchId);
    await loadBatchDetails(batchId);
  };

  const handleRollbackClick = (batchId: string) => {
    setBatchToRollback(batchId);
    setShowConfirmDialog(true);
  };

  const handleConfirmRollback = async () => {
    if (!batchToRollback) return;

    const success = await rollbackBatch(batchToRollback);
    setShowConfirmDialog(false);
    setBatchToRollback(null);

    if (success) {
      setSelectedBatch(null);
    }
  };

  const handlePartialRollback = async () => {
    if (selectedRecords.length === 0) return;

    const success = await rollbackRecords(selectedRecords);
    if (success) {
      setSelectedRecords([]);
    }
  };

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords((prev) =>
      prev.includes(recordId)
        ? prev.filter((id) => id !== recordId)
        : [...prev, recordId]
    );
  };

  const getSourceBadge = (source: ImportBatch['source']) => {
    const configs = {
      csv: { label: 'CSV', color: 'bg-blue-500' },
      shopify: { label: 'Shopify', color: 'bg-green-500' },
      woocommerce: { label: 'WooCommerce', color: 'bg-purple-500' },
      mercadolivre: { label: 'Mercado Livre', color: 'bg-yellow-500' },
      manual: { label: 'Manual', color: 'bg-gray-500' },
    };

    const config = configs[source];
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusBadge = (status: ImportBatch['status']) => {
    const configs = {
      pending: { label: 'Pendente', color: 'bg-yellow-500', icon: AlertTriangle },
      completed: { label: 'Concluído', color: 'bg-green-500', icon: CheckCircle2 },
      rolled_back: { label: 'Revertido', color: 'bg-red-500', icon: Undo2 },
      partially_rolled_back: { label: 'Parcialmente Revertido', color: 'bg-orange-500', icon: AlertTriangle },
    };

    const config = configs[status];
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.color} text-white border-0`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total de Importações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_batches}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Registros Importados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_imports.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Rollbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_rollbacks}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de Batches */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <CardTitle>Histórico de Importações</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBatches()}
              disabled={isLoading}
            >
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <Alert>
              <FileText className="w-4 h-4" />
              <AlertDescription>
                Nenhuma importação realizada ainda.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Sucesso</TableHead>
                    <TableHead>Falhas</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        {format(new Date(batch.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>{getSourceBadge(batch.source)}</TableCell>
                      <TableCell>{getStatusBadge(batch.status)}</TableCell>
                      <TableCell>{batch.total_records}</TableCell>
                      <TableCell className="text-green-600 font-medium">
                        {batch.successful_records}
                      </TableCell>
                      <TableCell className="text-red-600 font-medium">
                        {batch.failed_records}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(batch.id)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                          {batch.status === 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRollbackClick(batch.id)}
                              disabled={isRollingBack}
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detalhes do Batch */}
      {selectedBatch && currentBatch && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detalhes da Importação</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBatch(null)}
              >
                Fechar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Origem</p>
                  <p className="font-medium">{getSourceBadge(currentBatch.batch.source)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">{getStatusBadge(currentBatch.batch.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-medium">{currentBatch.batch.total_records}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="font-medium">
                    {((currentBatch.batch.successful_records / currentBatch.batch.total_records) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <Separator />

              {selectedRecords.length > 0 && (
                <Alert>
                  <AlertDescription className="flex items-center justify-between">
                    <span>{selectedRecords.length} registro(s) selecionado(s)</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handlePartialRollback}
                      disabled={isRollingBack}
                    >
                      <Undo2 className="w-4 h-4 mr-2" />
                      Reverter Selecionados
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentBatch.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {record.status === 'imported' && (
                            <input
                              type="checkbox"
                              checked={selectedRecords.includes(record.id)}
                              onChange={() => toggleRecordSelection(record.id)}
                              className="w-4 h-4"
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.tracking_code}
                        </TableCell>
                        <TableCell>
                          {record.status === 'imported' && (
                            <Badge variant="outline" className="bg-green-500 text-white border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Importado
                            </Badge>
                          )}
                          {record.status === 'failed' && (
                            <Badge variant="outline" className="bg-red-500 text-white border-0">
                              <XCircle className="w-3 h-3 mr-1" />
                              Falha
                            </Badge>
                          )}
                          {record.status === 'rolled_back' && (
                            <Badge variant="outline" className="bg-gray-500 text-white border-0">
                              <Undo2 className="w-3 h-3 mr-1" />
                              Revertido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-red-600">
                          {record.error_message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog de Confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Rollback</DialogTitle>
            <DialogDescription>
              Esta ação irá remover permanentemente todos os registros desta importação.
              Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? 'Revertendo...' : 'Confirmar Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
