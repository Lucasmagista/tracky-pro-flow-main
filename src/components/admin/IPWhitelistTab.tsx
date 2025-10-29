import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { DataTable, type Column, type Action } from '@/components/admin/DataTable'
import { IPWhitelistService, type AllowedIP, type BlockedIP } from '@/services/ip-whitelist'
import { Plus, Trash2, Ban, CheckCircle, XCircle, Globe, Shield, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function IPWhitelistTab() {
  const { toast } = useToast()
  const [allowedIPs, setAllowedIPs] = useState<AllowedIP[]>([])
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addIPDialogOpen, setAddIPDialogOpen] = useState(false)
  const [blockIPDialogOpen, setBlockIPDialogOpen] = useState(false)
  const [currentIP, setCurrentIP] = useState<string>('')
  
  // Form states
  const [newIP, setNewIP] = useState('')
  const [newIPDescription, setNewIPDescription] = useState('')
  const [ipType, setIPType] = useState<'single' | 'range'>('single')
  const [expiresInDays, setExpiresInDays] = useState<string>('never')
  
  // Block IP form
  const [blockIPAddress, setBlockIPAddress] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockType, setBlockType] = useState<'temporary' | 'permanent'>('temporary')
  const [blockDuration, setBlockDuration] = useState('24')

  useEffect(() => {
    loadData()
    loadCurrentIP()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [allowed, blocked] = await Promise.all([
        IPWhitelistService.getAllowedIPs(),
        IPWhitelistService.getBlockedIPs(),
      ])
      setAllowedIPs(allowed)
      setBlockedIPs(blocked)
    } catch (error) {
      console.error('Error loading IP data:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados de IPs',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadCurrentIP = async () => {
    const ip = await IPWhitelistService.getCurrentIP()
    setCurrentIP(ip)
  }

  const handleAddIP = async () => {
    if (!newIP || !newIPDescription) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Preencha o IP/Range e a descrição',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)

      const expiresAt = expiresInDays !== 'never' 
        ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000)
        : undefined

      if (ipType === 'range') {
        await IPWhitelistService.addAllowedIPRange(newIP, newIPDescription, expiresAt)
      } else {
        await IPWhitelistService.addAllowedIP(newIP, newIPDescription, expiresAt)
      }

      toast({
        title: 'IP Adicionado',
        description: `${ipType === 'range' ? 'Range' : 'IP'} adicionado à whitelist com sucesso`,
      })

      setAddIPDialogOpen(false)
      resetAddIPForm()
      await loadData()
    } catch (error) {
      console.error('Error adding IP:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o IP à whitelist',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleIP = async (ipId: string, currentStatus: boolean) => {
    try {
      await IPWhitelistService.toggleIPStatus(ipId, !currentStatus)
      
      toast({
        title: currentStatus ? 'IP Desativado' : 'IP Ativado',
        description: `O IP foi ${currentStatus ? 'desativado' : 'ativado'} com sucesso`,
      })

      await loadData()
    } catch (error) {
      console.error('Error toggling IP:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar o status do IP',
        variant: 'destructive',
      })
    }
  }

  const handleRemoveIP = async (ipId: string) => {
    try {
      await IPWhitelistService.removeAllowedIP(ipId)
      
      toast({
        title: 'IP Removido',
        description: 'O IP foi removido da whitelist',
      })

      await loadData()
    } catch (error) {
      console.error('Error removing IP:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o IP',
        variant: 'destructive',
      })
    }
  }

  const handleBlockIP = async () => {
    if (!blockIPAddress || !blockReason) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Preencha o IP e o motivo do bloqueio',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)

      const isPermanent = blockType === 'permanent'
      const duration = isPermanent ? undefined : parseInt(blockDuration)

      await IPWhitelistService.blockIP(blockIPAddress, blockReason, isPermanent, duration)

      toast({
        title: 'IP Bloqueado',
        description: `IP bloqueado ${isPermanent ? 'permanentemente' : `por ${duration}h`}`,
      })

      setBlockIPDialogOpen(false)
      resetBlockIPForm()
      await loadData()
    } catch (error) {
      console.error('Error blocking IP:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível bloquear o IP',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnblockIP = async (ipId: string) => {
    try {
      await IPWhitelistService.unblockIP(ipId)
      
      toast({
        title: 'IP Desbloqueado',
        description: 'O IP foi desbloqueado com sucesso',
      })

      await loadData()
    } catch (error) {
      console.error('Error unblocking IP:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível desbloquear o IP',
        variant: 'destructive',
      })
    }
  }

  const resetAddIPForm = () => {
    setNewIP('')
    setNewIPDescription('')
    setIPType('single')
    setExpiresInDays('never')
  }

  const resetBlockIPForm = () => {
    setBlockIPAddress('')
    setBlockReason('')
    setBlockType('temporary')
    setBlockDuration('24')
  }

  // Columns for Allowed IPs table
  const allowedIPColumns: Column<AllowedIP>[] = [
    {
      key: 'ip_address',
      label: 'IP / Range',
      render: (ip) => (
        <div className="font-mono">
          {ip.ip_address || ip.ip_range || 'N/A'}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Descrição',
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (ip) => (
        <Badge variant={ip.is_active ? 'default' : 'secondary'}>
          {ip.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expira',
      render: (ip) => (
        ip.expires_at ? (
          <span className="text-sm">
            {format(new Date(ip.expires_at), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Nunca</span>
        )
      ),
    },
    {
      key: 'created_at',
      label: 'Adicionado',
      render: (ip) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(ip.created_at), 'dd/MM/yyyy', { locale: ptBR })}
        </span>
      ),
    },
  ]

  const allowedIPActions: Action<AllowedIP>[] = [
    {
      label: (ip) => (ip.is_active ? 'Desativar' : 'Ativar'),
      onClick: (ip) => handleToggleIP(ip.id, ip.is_active),
      icon: (ip) => (ip.is_active ? XCircle : CheckCircle),
    },
    {
      label: 'Remover',
      onClick: (ip) => handleRemoveIP(ip.id),
      icon: Trash2,
      variant: 'destructive',
    },
  ]

  // Columns for Blocked IPs table
  const blockedIPColumns: Column<BlockedIP>[] = [
    {
      key: 'ip_address',
      label: 'Endereço IP',
      render: (ip) => (
        <div className="font-mono">{ip.ip_address}</div>
      ),
    },
    {
      key: 'block_reason',
      label: 'Motivo',
    },
    {
      key: 'failed_attempts',
      label: 'Tentativas',
      render: (ip) => (
        <Badge variant="secondary">{ip.failed_attempts}</Badge>
      ),
    },
    {
      key: 'is_permanent',
      label: 'Tipo',
      render: (ip) => (
        <Badge variant={ip.is_permanent ? 'destructive' : 'default'}>
          {ip.is_permanent ? 'Permanente' : 'Temporário'}
        </Badge>
      ),
    },
    {
      key: 'blocked_until',
      label: 'Bloqueado Até',
      render: (ip) => (
        ip.blocked_until ? (
          <span className="text-sm">
            {format(new Date(ip.blocked_until), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Indefinido</span>
        )
      ),
    },
  ]

  const blockedIPActions: Action<BlockedIP>[] = [
    {
      label: 'Desbloquear',
      onClick: (ip) => handleUnblockIP(ip.id),
      icon: CheckCircle,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Current IP Alert */}
      <Alert>
        <Globe className="h-4 w-4" />
        <AlertTitle>Seu IP Atual</AlertTitle>
        <AlertDescription>
          <div className="flex items-center justify-between mt-2">
            <span className="font-mono font-semibold">{currentIP}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewIP(currentIP)
                setAddIPDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar à Whitelist
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IPs Permitidos</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allowedIPs.length}</div>
            <p className="text-xs text-muted-foreground">
              {allowedIPs.filter(ip => ip.is_active).length} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IPs Bloqueados</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{blockedIPs.length}</div>
            <p className="text-xs text-muted-foreground">
              {blockedIPs.filter(ip => ip.is_permanent).length} permanentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Allowed IPs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IPs Permitidos (Whitelist)</CardTitle>
              <CardDescription>
                Apenas estes IPs podem acessar o painel admin
              </CardDescription>
            </div>
            <Button onClick={() => setAddIPDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar IP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allowedIPs.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atenção: Whitelist Vazia</AlertTitle>
              <AlertDescription>
                Nenhum IP está na whitelist. Configure IPs permitidos para ativar o controle de acesso.
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              data={allowedIPs}
              columns={allowedIPColumns}
              actions={allowedIPActions}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Blocked IPs Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IPs Bloqueados</CardTitle>
              <CardDescription>
                IPs bloqueados por segurança ou manualmente
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setBlockIPDialogOpen(true)}>
              <Ban className="mr-2 h-4 w-4" />
              Bloquear IP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {blockedIPs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ban className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum IP bloqueado</p>
            </div>
          ) : (
            <DataTable
              data={blockedIPs}
              columns={blockedIPColumns}
              actions={blockedIPActions}
              isLoading={isLoading}
            />
          )}
        </CardContent>
      </Card>

      {/* Add IP Dialog */}
      <Dialog open={addIPDialogOpen} onOpenChange={setAddIPDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar IP à Whitelist</DialogTitle>
            <DialogDescription>
              Configure um IP ou range de IPs permitidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={ipType} onValueChange={(v: 'single' | 'range') => setIPType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">IP Único</SelectItem>
                  <SelectItem value="range">Range (CIDR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-ip">
                {ipType === 'range' ? 'IP Range (CIDR)' : 'Endereço IP'}
              </Label>
              <Input
                id="new-ip"
                placeholder={ipType === 'range' ? '192.168.1.0/24' : '192.168.1.1'}
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {ipType === 'range' 
                  ? 'Use notação CIDR para ranges (ex: 192.168.1.0/24)'
                  : 'Digite o endereço IP completo (ex: 192.168.1.1)'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-description">Descrição</Label>
              <Input
                id="ip-description"
                placeholder="Ex: Escritório principal, VPN da empresa..."
                value={newIPDescription}
                onChange={(e) => setNewIPDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Expira em</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Nunca</SelectItem>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddIPDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddIP} disabled={isLoading}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block IP Dialog */}
      <Dialog open={blockIPDialogOpen} onOpenChange={setBlockIPDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bloquear Endereço IP</DialogTitle>
            <DialogDescription>
              Bloqueie um IP suspeito ou malicioso
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="block-ip">Endereço IP</Label>
              <Input
                id="block-ip"
                placeholder="192.168.1.1"
                value={blockIPAddress}
                onChange={(e) => setBlockIPAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="block-reason">Motivo do Bloqueio</Label>
              <Input
                id="block-reason"
                placeholder="Ex: Múltiplas tentativas de login falhadas..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Bloqueio</Label>
              <Select value={blockType} onValueChange={(v: 'temporary' | 'permanent') => setBlockType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">Temporário</SelectItem>
                  <SelectItem value="permanent">Permanente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {blockType === 'temporary' && (
              <div className="space-y-2">
                <Label>Duração (horas)</Label>
                <Select value={blockDuration} onValueChange={setBlockDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hora</SelectItem>
                    <SelectItem value="6">6 horas</SelectItem>
                    <SelectItem value="24">24 horas</SelectItem>
                    <SelectItem value="72">3 dias</SelectItem>
                    <SelectItem value="168">7 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                O IP bloqueado não poderá acessar o painel admin até ser desbloqueado.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockIPDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBlockIP} disabled={isLoading}>
              <Ban className="mr-2 h-4 w-4" />
              Bloquear IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
