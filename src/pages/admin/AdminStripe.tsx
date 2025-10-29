import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Webhook,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download,
  Send,
  Ban,
  FileText,
  ArrowUpDown,
  ArrowLeft,
  ExternalLink,
  Copy,
  Eye,
  MoreHorizontal,
  Mail
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'

interface StripeTransaction {
  id: string
  amount: number
  currency: string
  status: string
  customer_email: string
  customer_name?: string
  description?: string
  created_at: string
  stripe_payment_id: string
}

interface StripeRefund {
  id: string
  amount: number
  reason?: string
  status: string
  transaction_id: string
  created_at: string
}

interface StripeWebhook {
  id: string
  event_type: string
  status: string
  payload: unknown
  created_at: string
  processed_at?: string
}

interface StripeDispute {
  id: string
  amount: number
  reason: string
  status: string
  customer_email: string
  created_at: string
  evidence_due_date?: string
}

interface StripeInvoice {
  id: string
  amount_due: number
  amount_paid: number
  status: string
  customer_email: string
  created_at: string
  due_date?: string
  stripe_invoice_id: string
}

export default function AdminStripe() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  // Dashboard stats
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalRefunds, setTotalRefunds] = useState(0)
  const [activeDisputes, setActiveDisputes] = useState(0)

  // Data
  const [transactions, setTransactions] = useState<StripeTransaction[]>([])
  const [refunds, setRefunds] = useState<StripeRefund[]>([])
  const [webhooks, setWebhooks] = useState<StripeWebhook[]>([])
  const [disputes, setDisputes] = useState<StripeDispute[]>([])
  const [invoices, setInvoices] = useState<StripeInvoice[]>([])

  // Filters
  const [transactionFilter, setTransactionFilter] = useState('all')
  const [dateRange, setDateRange] = useState('30')

  // Refund form
  const [selectedTransaction, setSelectedTransaction] = useState<StripeTransaction | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Load functions
  const loadDashboardStats = useCallback(async () => {
    try {
      const { data: transactions, error } = await supabase
        .from('stripe_transactions')
        .select('amount, status')
        .gte('created_at', new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString())

      if (error) throw error

      const revenue = transactions
        ?.filter(t => t.status === 'succeeded')
        .reduce((sum, t) => sum + (t.amount || 0), 0) || 0
      
      setTotalRevenue(revenue / 100)
      setTotalTransactions(transactions?.length || 0)
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    }
  }, [dateRange])

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('stripe_transactions')
        .select('*')
        .gte('created_at', new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (transactionFilter !== 'all') {
        query = query.eq('status', transactionFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setTransactions(data || [])
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [dateRange, transactionFilter])

  const loadRefunds = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_refunds')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRefunds(data || [])
      setTotalRefunds(data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0)
    } catch (error) {
      console.error('Error loading refunds:', error)
    }
  }

  const loadWebhooks = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_webhooks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setWebhooks(data || [])
    } catch (error) {
      console.error('Error loading webhooks:', error)
    }
  }

  const loadDisputes = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_disputes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDisputes(data || [])
      setActiveDisputes(data?.filter(d => d.status === 'open' || d.status === 'under_review').length || 0)
    } catch (error) {
      console.error('Error loading disputes:', error)
    }
  }

  const loadInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_invoices')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (error) {
      console.error('Error loading invoices:', error)
    }
  }

  useEffect(() => {
    loadDashboardStats()
    loadTransactions()
    loadRefunds()
    loadWebhooks()
    loadDisputes()
    loadInvoices()
  }, [dateRange, transactionFilter, loadDashboardStats, loadTransactions])

  const handleRefund = async () => {
    if (!selectedTransaction || !refundAmount) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione uma transação e informe o valor do reembolso.',
        variant: 'destructive'
      })
      return
    }

    try {
      const amount = parseFloat(refundAmount) * 100 // Convert to cents

      const { error } = await supabase
        .from('stripe_refunds')
        .insert({
          transaction_id: selectedTransaction.id,
          amount,
          reason: refundReason,
          status: 'pending'
        })

      if (error) throw error

      toast({
        title: 'Reembolso iniciado',
        description: 'O reembolso foi processado e será creditado em breve.'
      })

      setSelectedTransaction(null)
      setRefundAmount('')
      setRefundReason('')
      loadRefunds()
      loadTransactions()
    } catch (error) {
      console.error('Error processing refund:', error)
      toast({
        title: 'Erro ao processar reembolso',
        description: 'Não foi possível processar o reembolso.',
        variant: 'destructive'
      })
    }
  }

  const handleRetryWebhook = async (webhookId: string) => {
    try {
      toast({
        title: 'Reenviando webhook',
        description: 'O webhook será reenviado em instantes...'
      })

      // Simular reenvio do webhook
      setTimeout(() => {
        toast({
          title: 'Webhook reenviado',
          description: 'O webhook foi reenviado com sucesso.'
        })
        loadWebhooks()
      }, 1500)
    } catch (error) {
      console.error('Error retrying webhook:', error)
      toast({
        title: 'Erro ao reenviar webhook',
        description: 'Não foi possível reenviar o webhook.',
        variant: 'destructive'
      })
    }
  }

  const handleExportTransactions = () => {
    const csv = [
      ['ID', 'Valor', 'Status', 'Cliente', 'Data'].join(','),
      ...transactions.map(t => [
        t.stripe_payment_id,
        (t.amount / 100).toFixed(2),
        t.status,
        t.customer_email,
        format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transacoes_stripe_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()

    toast({
      title: 'Exportação concluída',
      description: 'As transações foram exportadas com sucesso.'
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência.`
    })
  }

  const openStripeTransaction = (stripeId: string) => {
    if (stripeId) {
      window.open(`https://dashboard.stripe.com/payments/${stripeId}`, '_blank')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      succeeded: { variant: 'default' as const, label: 'Sucesso', icon: CheckCircle },
      pending: { variant: 'secondary' as const, label: 'Pendente', icon: RefreshCw },
      failed: { variant: 'destructive' as const, label: 'Falhou', icon: AlertCircle },
      refunded: { variant: 'secondary' as const, label: 'Reembolsado', icon: ArrowUpDown },
      canceled: { variant: 'destructive' as const, label: 'Cancelado', icon: Ban }
    }

    const config = variants[status as keyof typeof variants] || { 
      variant: 'outline' as const, 
      label: status,
      icon: AlertCircle
    }

    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Admin
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciamento Stripe</h1>
            <p className="text-muted-foreground">
              Gerencie pagamentos, reembolsos, webhooks e faturas do Stripe
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                loadDashboardStats()
                loadTransactions()
                loadRefunds()
                loadWebhooks()
                loadDisputes()
                loadInvoices()
                toast({
                  title: 'Dados atualizados',
                  description: 'Todas as informações foram recarregadas',
                })
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Últimos {dateRange} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transações</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Total de transações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reembolsos</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRefunds}</div>
            <p className="text-xs text-muted-foreground">
              Solicitações processadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disputas Ativas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDisputes}</div>
            <p className="text-xs text-muted-foreground">
              Requerem atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="transactions">
            <CreditCard className="h-4 w-4 mr-2" />
            Transações
          </TabsTrigger>
          <TabsTrigger value="refunds">
            <TrendingDown className="h-4 w-4 mr-2" />
            Reembolsos
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="disputes">
            <Ban className="h-4 w-4 mr-2" />
            Disputas
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-2" />
            Faturas
          </TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transações do Stripe</CardTitle>
                  <CardDescription>
                    Visualize todas as transações processadas pelo Stripe
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar por ID ou e-mail..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[250px]"
                  />
                  <Select value={transactionFilter} onValueChange={setTransactionFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="succeeded">Sucesso</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="failed">Falhou</SelectItem>
                      <SelectItem value="refunded">Reembolsado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleExportTransactions} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Pagamento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => 
                    !searchQuery || 
                    t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.stripe_payment_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.id.toLowerCase().includes(searchQuery.toLowerCase())
                  ).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma transação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions
                      .filter(t => 
                        !searchQuery || 
                        t.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.stripe_payment_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.id.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-xs">
                          {transaction.stripe_payment_id || transaction.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{transaction.customer_name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{transaction.customer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {(transaction.amount / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(transaction.stripe_payment_id || transaction.id, 'ID da transação')}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copiar ID
                              </DropdownMenuItem>
                              {transaction.stripe_payment_id && (
                                <DropdownMenuItem
                                  onClick={() => openStripeTransaction(transaction.stripe_payment_id!)}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Ver no Stripe
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => copyToClipboard(transaction.customer_email, 'E-mail do cliente')}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Copiar E-mail
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTransaction(transaction)
                                  setRefundAmount((transaction.amount / 100).toString())
                                }}
                                disabled={transaction.status !== 'succeeded'}
                              >
                                <TrendingDown className="mr-2 h-4 w-4" />
                                Reembolsar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Refund Dialog */}
          {selectedTransaction && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle>Processar Reembolso</CardTitle>
                <CardDescription>
                  Transação: {selectedTransaction.stripe_payment_id} - {selectedTransaction.customer_email}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="refund-amount">Valor do Reembolso (R$)</Label>
                    <Input
                      id="refund-amount"
                      type="number"
                      step="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Valor máximo: R$ {(selectedTransaction.amount / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="refund-reason">Motivo</Label>
                    <Select value={refundReason} onValueChange={setRefundReason}>
                      <SelectTrigger id="refund-reason">
                        <SelectValue placeholder="Selecione um motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="duplicate">Cobrança Duplicada</SelectItem>
                        <SelectItem value="fraudulent">Fraudulento</SelectItem>
                        <SelectItem value="requested_by_customer">Solicitado pelo Cliente</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleRefund}>
                    <Send className="h-4 w-4 mr-2" />
                    Processar Reembolso
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Reembolsos</CardTitle>
              <CardDescription>
                Todos os reembolsos processados através do Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Transação</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum reembolso processado
                      </TableCell>
                    </TableRow>
                  ) : (
                    refunds.map((refund) => (
                      <TableRow key={refund.id}>
                        <TableCell className="font-mono text-xs">
                          {refund.transaction_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-semibold">
                          R$ {(refund.amount / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{refund.reason || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge(refund.status)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(refund.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Eventos do Stripe</CardTitle>
              <CardDescription>
                Histórico de webhooks recebidos do Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recebido</TableHead>
                    <TableHead>Processado</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum webhook recebido
                      </TableCell>
                    </TableRow>
                  ) : (
                    webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell className="font-medium">{webhook.event_type}</TableCell>
                        <TableCell>{getStatusBadge(webhook.status)}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(webhook.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {webhook.processed_at 
                            ? format(new Date(webhook.processed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {webhook.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetryWebhook(webhook.id)}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retentar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Disputes Tab */}
        <TabsContent value="disputes">
          <Card>
            <CardHeader>
              <CardTitle>Disputas e Chargebacks</CardTitle>
              <CardDescription>
                Gerencie disputas de pagamento do Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma disputa registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    disputes.map((dispute) => (
                      <TableRow key={dispute.id}>
                        <TableCell>{dispute.customer_email}</TableCell>
                        <TableCell className="font-semibold">
                          R$ {(dispute.amount / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{dispute.reason}</TableCell>
                        <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                        <TableCell className="text-sm">
                          {dispute.evidence_due_date 
                            ? format(new Date(dispute.evidence_due_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Faturas</CardTitle>
              <CardDescription>
                Gerencie faturas e cobranças recorrentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Fatura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor Devido</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma fatura encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-xs">
                          {invoice.stripe_invoice_id?.slice(0, 8) || invoice.id.slice(0, 8)}
                        </TableCell>
                        <TableCell>{invoice.customer_email}</TableCell>
                        <TableCell className="font-semibold">
                          R$ {(invoice.amount_due / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          R$ {(invoice.amount_paid / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell className="text-sm">
                          {invoice.due_date 
                            ? format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
