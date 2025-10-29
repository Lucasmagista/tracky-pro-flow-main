import { useEffect, useState, useCallback } from 'react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminService } from '@/services/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Shield, UserPlus, Ban, Clock, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'

interface AdminPermission {
  id: string
  user_id: string
  role: 'super_admin' | 'admin' | 'moderator' | 'support'
  permissions: string[]
  granted_by?: string
  granted_at: string
  expires_at?: string
  is_active: boolean
  notes?: string
  user?: {
    name?: string
    email: string
  }
}

const ROLE_DESCRIPTIONS = {
  super_admin: {
    label: 'Super Admin',
    description: 'Acesso total ao sistema',
    color: 'bg-purple-500',
    permissions: ['*']
  },
  admin: {
    label: 'Admin',
    description: 'Gerenciar usuários e configurações',
    color: 'bg-blue-500',
    permissions: ['users:*', 'subscriptions:*', 'settings:read']
  },
  moderator: {
    label: 'Moderador',
    description: 'Moderar conteúdo e usuários',
    color: 'bg-green-500',
    permissions: ['users:read', 'users:suspend', 'orders:read']
  },
  support: {
    label: 'Suporte',
    description: 'Acesso de leitura e suporte',
    color: 'bg-yellow-500',
    permissions: ['users:read', 'orders:read', 'logs:read']
  }
}

export default function AdminPermissions() {
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [grantDialogOpen, setGrantDialogOpen] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<AdminPermission | null>(null)
  const [grantFormData, setGrantFormData] = useState({
    email: '',
    role: '' as 'super_admin' | 'admin' | 'moderator' | 'support' | '',
    notes: '',
    expiresInDays: ''
  })
  const { toast } = useToast()

  const loadPermissions = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await AdminService.getAdminPermissions()
      setPermissions(data as AdminPermission[])
    } catch (error) {
      console.error('Error loading permissions:', error)
      toast({
        title: 'Erro ao carregar permissões',
        description: 'Não foi possível carregar as permissões.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const handleGrantPermission = async () => {
    if (!grantFormData.email || !grantFormData.role) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Email e role são obrigatórios.',
        variant: 'destructive'
      })
      return
    }

    try {
      // Get user by email first
      const { users } = await AdminService.getAllUsers(1, 1, grantFormData.email)
      if (users.length === 0) {
        toast({
          title: 'Usuário não encontrado',
          description: 'Não foi possível encontrar um usuário com este email.',
          variant: 'destructive'
        })
        return
      }

      const user = users[0]
      await AdminService.grantAdminPermissions(
        user.id,
        grantFormData.role,
        ROLE_DESCRIPTIONS[grantFormData.role].permissions,
        grantFormData.notes
      )

      toast({
        title: 'Permissões concedidas',
        description: `Permissões de ${ROLE_DESCRIPTIONS[grantFormData.role].label} concedidas com sucesso.`
      })

      setGrantDialogOpen(false)
      setGrantFormData({ email: '', role: '', notes: '', expiresInDays: '' })
      loadPermissions()
    } catch (error) {
      console.error('Error granting permissions:', error)
      toast({
        title: 'Erro ao conceder permissões',
        description: 'Não foi possível conceder as permissões.',
        variant: 'destructive'
      })
    }
  }

  const handleRevokePermission = async () => {
    if (!selectedPermission) return

    try {
      await AdminService.revokeAdminPermissions(selectedPermission.user_id)

      toast({
        title: 'Permissões revogadas',
        description: 'As permissões foram revogadas com sucesso.'
      })

      setRevokeDialogOpen(false)
      setSelectedPermission(null)
      loadPermissions()
    } catch (error) {
      console.error('Error revoking permissions:', error)
      toast({
        title: 'Erro ao revogar permissões',
        description: 'Não foi possível revogar as permissões.',
        variant: 'destructive'
      })
    }
  }

  const getRoleBadge = (role: string) => {
    const roleInfo = ROLE_DESCRIPTIONS[role as keyof typeof ROLE_DESCRIPTIONS]
    if (!roleInfo) return null

    return (
      <Badge className={roleInfo.color}>
        {roleInfo.label}
      </Badge>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Permissões</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie roles e permissões administrativas
            </p>
          </div>
          <Button onClick={() => setGrantDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Conceder Permissões
          </Button>
        </div>

        {/* Role Matrix */}
        <div className="grid gap-4 md:grid-cols-4">
          {Object.entries(ROLE_DESCRIPTIONS).map(([key, value]) => (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Shield className="h-5 w-5" />
                  <Badge className={value.color}>{value.label}</Badge>
                </div>
                <CardTitle className="text-lg">{value.label}</CardTitle>
                <CardDescription>{value.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Permissões:</p>
                  <div className="space-y-1">
                    {value.permissions.map((perm, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-mono">{perm}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>Administradores Ativos</CardTitle>
            <CardDescription>
              Lista de todos os usuários com permissões administrativas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : permissions.length > 0 ? (
              <div className="space-y-4">
                {permissions.map((permission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <p className="font-medium">
                          {permission.user?.name || permission.user?.email}
                        </p>
                        {getRoleBadge(permission.role)}
                        {!permission.is_active && (
                          <Badge variant="destructive">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {permission.user?.email}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Concedido {formatDistanceToNow(new Date(permission.granted_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </span>
                        {permission.expires_at && (
                          <span>
                            Expira em {new Date(permission.expires_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                      {permission.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          {permission.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedPermission(permission)
                        setRevokeDialogOpen(true)
                      }}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Revogar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhum administrador cadastrado
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant Permissions Dialog */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Permissões Administrativas</DialogTitle>
            <DialogDescription>
              Transforme um usuário em administrador
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grant-email">Email do Usuário</Label>
              <Input
                id="grant-email"
                type="email"
                value={grantFormData.email}
                onChange={(e) => setGrantFormData({ ...grantFormData, email: e.target.value })}
                placeholder="usuario@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-role">Role Administrativo</Label>
              <Select
                value={grantFormData.role}
                onValueChange={(value: 'super_admin' | 'admin' | 'moderator' | 'support') =>
                  setGrantFormData({ ...grantFormData, role: value })
                }
              >
                <SelectTrigger id="grant-role">
                  <SelectValue placeholder="Selecione um role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_DESCRIPTIONS).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span className="font-medium">{value.label}</span>
                        <span className="text-xs text-muted-foreground">{value.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-notes">Notas (Opcional)</Label>
              <Textarea
                id="grant-notes"
                value={grantFormData.notes}
                onChange={(e) => setGrantFormData({ ...grantFormData, notes: e.target.value })}
                placeholder="Motivo da concessão..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-expires">Expira em (dias) - Opcional</Label>
              <Input
                id="grant-expires"
                type="number"
                min="1"
                value={grantFormData.expiresInDays}
                onChange={(e) => setGrantFormData({ ...grantFormData, expiresInDays: e.target.value })}
                placeholder="Deixe vazio para duração ilimitada"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGrantPermission} disabled={!grantFormData.email || !grantFormData.role}>
              Conceder Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Permissions Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar Permissões</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja revogar as permissões de {selectedPermission?.user?.name || selectedPermission?.user?.email}?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">
              Esta ação removerá todas as permissões administrativas do usuário.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRevokePermission}>
              Revogar Permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
