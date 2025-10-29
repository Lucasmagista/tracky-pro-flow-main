import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { AdminService } from '@/services/admin'
import {
  Database,
  HardDrive,
  Activity,
  Table,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface TableInfo {
  name: string
  rows: number
  size: string
  last_vacuum?: string
}

interface DatabaseStats {
  total_size: string
  total_tables: number
  total_rows: number
  cache_hit_ratio: number
  active_connections: number
  max_connections: number
}

export default function AdminDatabase() {
  const [stats, setStats] = useState<DatabaseStats>({
    total_size: '0 MB',
    total_tables: 0,
    total_rows: 0,
    cache_hit_ratio: 0,
    active_connections: 0,
    max_connections: 100
  })
  const [tables, setTables] = useState<TableInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [backupDialogOpen, setBackupDialogOpen] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadDatabaseInfo()
  }, [])

  const loadDatabaseInfo = async () => {
    try {
      setIsLoading(true)
      const [statsData, tablesData] = await Promise.all([
        AdminService.getDatabaseStats(),
        AdminService.getTableInfo()
      ])
      
      setStats(statsData)
      setTables(tablesData)
    } catch (error) {
      console.error('Error loading database info:', error)
      toast({
        title: 'Erro ao carregar informações',
        description: 'Não foi possível carregar as informações do banco de dados.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackup = async () => {
    try {
      toast({
        title: 'Backup iniciado',
        description: 'O backup do banco de dados foi iniciado...'
      })
      
      const result = await AdminService.createBackup()
      
      if (result.success) {
        toast({
          title: 'Backup concluído',
          description: `Backup realizado com sucesso. ID: ${result.backup_id}`
        })
        setBackupDialogOpen(false)
      } else {
        throw new Error('Backup failed')
      }
    } catch (error) {
      toast({
        title: 'Erro no backup',
        description: 'Não foi possível realizar o backup.',
        variant: 'destructive'
      })
    }
  }

  const handleOptimize = async (tableName: string) => {
    try {
      toast({
        title: 'Otimização iniciada',
        description: `Otimizando tabela ${tableName}...`
      })
      
      const success = await AdminService.optimizeTable(tableName)
      
      if (success) {
        toast({
          title: 'Tabela otimizada',
          description: `Tabela ${tableName} otimizada com sucesso.`
        })
        loadDatabaseInfo()
      } else {
        throw new Error('Optimization failed')
      }
    } catch (error) {
      toast({
        title: 'Erro na otimização',
        description: 'Não foi possível otimizar a tabela.',
        variant: 'destructive'
      })
    }
  }

  const connectionPercentage = (stats.active_connections / stats.max_connections) * 100

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Banco de Dados</h1>
            <p className="text-muted-foreground">
              Monitore e gerencie o banco de dados do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadDatabaseInfo}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Button onClick={() => setBackupDialogOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Backup
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tamanho Total
              </CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_size}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Espaço utilizado
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Tabelas
              </CardTitle>
              <Table className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_tables}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Tabelas no banco
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cache Hit Ratio
              </CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cache_hit_ratio}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Performance do cache
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Conexões Ativas
              </CardTitle>
              <Database className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.active_connections}/{stats.max_connections}
              </div>
              <Progress value={connectionPercentage} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tables" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tables">Tabelas</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
          </TabsList>

          <TabsContent value="tables" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tabelas do Banco de Dados</CardTitle>
                <CardDescription>
                  Informações sobre as tabelas e seu uso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Table className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{table.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {table.rows.toLocaleString()} linhas • {table.size}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Último vacuum: {table.last_vacuum}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOptimize(table.name)}
                        >
                          Otimizar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Performance</CardTitle>
                <CardDescription>
                  Indicadores de performance do banco de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Cache Hit Ratio</Label>
                      <span className="text-sm font-medium">{stats.cache_hit_ratio}%</span>
                    </div>
                    <Progress value={stats.cache_hit_ratio} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.cache_hit_ratio > 95 ? (
                        <span className="text-green-500 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Excelente performance
                        </span>
                      ) : (
                        <span className="text-yellow-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Performance pode ser melhorada
                        </span>
                      )}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Uso de Conexões</Label>
                      <span className="text-sm font-medium">
                        {stats.active_connections}/{stats.max_connections}
                      </span>
                    </div>
                    <Progress value={connectionPercentage} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {connectionPercentage < 70 ? (
                        <span className="text-green-500 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Utilização normal
                        </span>
                      ) : (
                        <span className="text-yellow-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Considere aumentar o limite de conexões
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Queries/segundo
                      </div>
                      <div className="text-2xl font-bold">234</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground mb-1">
                        Tempo médio de resposta
                      </div>
                      <div className="text-2xl font-bold">45ms</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Operações de Manutenção</CardTitle>
                <CardDescription>
                  Execute tarefas de manutenção do banco de dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <Download className="h-8 w-8 text-blue-500 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Backup do Banco de Dados</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Crie um backup completo do banco de dados. Recomendado realizar
                        backups regulares.
                      </p>
                      <Button onClick={() => setBackupDialogOpen(true)}>
                        Criar Backup
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <RefreshCw className="h-8 w-8 text-green-500 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Otimizar Todas as Tabelas</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Execute VACUUM e ANALYZE em todas as tabelas para melhorar a
                        performance.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: 'Otimização iniciada',
                            description: 'Otimizando todas as tabelas...'
                          })
                        }}
                      >
                        Otimizar Tudo
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <Trash2 className="h-8 w-8 text-red-500 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Limpar Dados Antigos</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Remove logs e dados temporários com mais de 90 dias.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja limpar dados antigos?')) {
                            toast({
                              title: 'Limpeza iniciada',
                              description: 'Removendo dados antigos...'
                            })
                          }
                        }}
                      >
                        Limpar Dados
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <BarChart3 className="h-8 w-8 text-purple-500 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Atualizar Estatísticas</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Atualiza as estatísticas do banco para otimização de queries.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: 'Atualizando estatísticas',
                            description: 'Atualizando estatísticas do banco...'
                          })
                        }}
                      >
                        Atualizar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Backup Dialog */}
        <Dialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Backup do Banco de Dados</DialogTitle>
              <DialogDescription>
                Um backup completo será criado. Este processo pode levar alguns minutos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-blue-500" />
                <div className="text-sm">
                  <p className="font-medium">Importante</p>
                  <p className="text-muted-foreground">
                    O backup será armazenado com segurança e pode ser restaurado a
                    qualquer momento.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tamanho estimado:</span>
                  <span className="font-medium">{stats.total_size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tempo estimado:</span>
                  <span className="font-medium">2-5 minutos</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBackupDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleBackup}>
                <Download className="mr-2 h-4 w-4" />
                Criar Backup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm font-medium ${className}`}>{children}</div>
}
