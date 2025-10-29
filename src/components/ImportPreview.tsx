import { useState, useMemo } from 'react';
import { Check, X, AlertTriangle, Edit2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { CSVParseResult, CSVError, CSVWarning } from '@/services/csvParser';
import { TrackingValidationService } from '@/services/trackingValidation';

interface ImportPreviewProps {
  parseResult: CSVParseResult;
  onConfirm: (data: Record<string, unknown>[]) => Promise<void>;
  onCancel: () => void;
  onEdit?: (rowIndex: number, field: string, value: unknown) => void;
}

interface EditingCell {
  row: number;
  field: string;
}

export function ImportPreview({
  parseResult,
  onConfirm,
  onCancel,
  onEdit,
}: ImportPreviewProps) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(
    new Set(Array.from({ length: parseResult.data.length }, (_, i) => i))
  );
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [localData, setLocalData] = useState(parseResult.data);

  // Filtra erros e avisos
  const errorsByRow = useMemo(() => {
    const map = new Map<number, CSVError[]>();
    parseResult.errors.forEach((error) => {
      if (!map.has(error.row)) {
        map.set(error.row, []);
      }
      map.get(error.row)!.push(error);
    });
    return map;
  }, [parseResult.errors]);

  const warningsByRow = useMemo(() => {
    const map = new Map<number, CSVWarning[]>();
    parseResult.warnings.forEach((warning) => {
      if (!map.has(warning.row)) {
        map.set(warning.row, []);
      }
      map.get(warning.row)!.push(warning);
    });
    return map;
  }, [parseResult.warnings]);

  // Estatísticas
  const stats = useMemo(() => {
    const selected = Array.from(selectedRows);
    const validSelected = selected.filter((i) => !errorsByRow.has(i + 2));

    return {
      total: parseResult.totalRows,
      selected: selected.length,
      valid: validSelected.length,
      invalid: selected.length - validSelected.length,
      errors: parseResult.errors.length,
      warnings: parseResult.warnings.length,
    };
  }, [selectedRows, errorsByRow, parseResult]);

  // Toggle seleção de linha
  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  // Selecionar/deselecionar todos
  const toggleAll = () => {
    if (selectedRows.size === parseResult.data.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(Array.from({ length: parseResult.data.length }, (_, i) => i)));
    }
  };

  // Selecionar apenas válidos
  const selectOnlyValid = () => {
    const validIndices = localData
      .map((_, i) => i)
      .filter((i) => !errorsByRow.has(i + 2));
    setSelectedRows(new Set(validIndices));
  };

  // Inicia edição de célula
  const startEdit = (row: number, field: string, currentValue: unknown) => {
    setEditingCell({ row, field });
    setEditValue(String(currentValue || ''));
  };

  // Salva edição
  const saveEdit = () => {
    if (!editingCell) return;

    const newData = [...localData];
    newData[editingCell.row] = {
      ...newData[editingCell.row],
      [editingCell.field]: editValue,
    };
    setLocalData(newData);

    if (onEdit) {
      onEdit(editingCell.row, editingCell.field, editValue);
    }

    setEditingCell(null);
  };

  // Cancela edição
  const cancelEdit = () => {
    setEditingCell(null);
  };

  // Aplica correção automática
  const autoFix = (row: number, field: string) => {
    const value = String(localData[row][field] || '');

    if (field === 'tracking_code') {
      const corrected = TrackingValidationService.autoCorrect(value);
      if (corrected !== value) {
        const newData = [...localData];
        newData[row] = {
          ...newData[row],
          [field]: corrected,
        };
        setLocalData(newData);
      }
    }
  };

  // Confirma importação
  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const selectedData = localData.filter((_, i) => selectedRows.has(i));
      await onConfirm(selectedData);
    } finally {
      setIsConfirming(false);
    }
  };

  // Renderiza célula
  const renderCell = (row: Record<string, unknown>, field: string, rowIndex: number) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === field;
    const value = row[field];
    const displayValue = value === null || value === undefined ? '' : String(value);

    const rowErrors = errorsByRow.get(rowIndex + 2) || [];
    const rowWarnings = warningsByRow.get(rowIndex + 2) || [];

    const fieldErrors = rowErrors.filter((e) => {
      const column = parseResult.columns.find((c) => c.mappedTo === field);
      return column && e.column === column.name;
    });

    const fieldWarnings = rowWarnings.filter((w) => {
      const column = parseResult.columns.find((c) => c.mappedTo === field);
      return column && w.column === column.name;
    });

    const hasError = fieldErrors.length > 0;
    const hasWarning = fieldWarnings.length > 0;

    if (isEditing) {
      return (
        <div className="flex gap-2 items-center">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="h-8"
            autoFocus
          />
          <Button size="sm" variant="ghost" onClick={saveEdit}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={cancelEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div
        className={`flex items-center gap-2 group ${
          hasError ? 'text-red-600' : hasWarning ? 'text-yellow-600' : ''
        }`}
      >
        <span className="flex-1 truncate" title={displayValue}>
          {displayValue}
        </span>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => startEdit(rowIndex, field, value)}
          >
            <Edit2 className="h-3 w-3" />
          </Button>

          {field === 'tracking_code' && hasWarning && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => autoFix(rowIndex, field)}
              title="Corrigir automaticamente"
            >
              <Check className="h-3 w-3" />
            </Button>
          )}
        </div>

        {hasError && (
          <AlertTriangle className="h-4 w-4 text-red-500" title={fieldErrors[0].message} />
        )}
        {hasWarning && !hasError && (
          <AlertTriangle
            className="h-4 w-4 text-yellow-500"
            title={fieldWarnings[0].message}
          />
        )}
      </div>
    );
  };

  const mappedColumns = parseResult.columns.filter((c) => c.mappedTo);

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Linhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Selecionadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.selected}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Válidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Com Problemas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {stats.errors > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-red-900 dark:text-red-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              {stats.errors} {stats.errors === 1 ? 'Erro Encontrado' : 'Erros Encontrados'}
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              Revise as linhas marcadas antes de continuar. Você pode editar os valores ou
              desmarcar as linhas com erro.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={toggleAll}>
          <Checkbox checked={selectedRows.size === parseResult.data.length} className="mr-2" />
          {selectedRows.size === parseResult.data.length ? 'Desmarcar Todos' : 'Marcar Todos'}
        </Button>

        <Button variant="outline" onClick={selectOnlyValid}>
          <Check className="mr-2 h-4 w-4" />
          Selecionar Apenas Válidos
        </Button>

        <div className="flex-1" />

        <Button variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancelar
        </Button>

        <Button
          onClick={handleConfirm}
          disabled={stats.selected === 0 || isConfirming}
          className="min-w-[200px]"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isConfirming
            ? 'Importando...'
            : `Importar ${stats.selected} ${stats.selected === 1 ? 'Pedido' : 'Pedidos'}`}
        </Button>
      </div>

      {/* Tabela de Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview dos Dados</CardTitle>
          <CardDescription>
            Revise os dados antes de importar. Clique no ícone de lápis para editar qualquer
            valor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedRows.size === parseResult.data.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="w-12"></TableHead>
                  {mappedColumns.map((column) => (
                    <TableHead key={column.index}>
                      <div className="flex flex-col">
                        <span className="font-semibold">{column.name}</span>
                        {column.mappedTo && (
                          <Badge variant="secondary" className="text-xs w-fit mt-1">
                            {column.mappedTo}
                          </Badge>
                        )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {localData.map((row, index) => {
                  const rowNum = index + 2;
                  const hasErrors = errorsByRow.has(rowNum);
                  const hasWarnings = warningsByRow.has(rowNum) && !hasErrors;

                  return (
                    <TableRow
                      key={index}
                      className={
                        hasErrors
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : hasWarnings
                          ? 'bg-yellow-50 dark:bg-yellow-900/10'
                          : ''
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedRows.has(index)}
                          onCheckedChange={() => toggleRow(index)}
                        />
                      </TableCell>
                      <TableCell className="text-gray-500">{rowNum}</TableCell>
                      <TableCell>
                        {hasErrors ? (
                          <X className="h-4 w-4 text-red-500" />
                        ) : hasWarnings ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                      {mappedColumns.map((column) => (
                        <TableCell key={column.index}>
                          {renderCell(row, column.mappedTo!, index)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>Linha válida</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Avisos (pode importar)</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-500" />
              <span>Erros (corrija antes de importar)</span>
            </div>
            <div className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              <span>Editar valor</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
