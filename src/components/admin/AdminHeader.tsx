import { Bell, Menu, Search, User, LogOut, Settings as SettingsIcon, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface AdminHeaderProps {
  onMenuClick: () => void
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleBack = () => {
    try {
      // If there is a previous entry in history, go back. Otherwise, fallback to /admin
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/admin')
      }
    } catch (e) {
      navigate('/admin')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast({
      title: 'Logout realizado',
      description: 'Você foi desconectado com sucesso.'
    })
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-slate-800 dark:bg-slate-900/95 px-4 md:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Back button - mais à esquerda, mostra texto em md+ */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="hidden md:inline-flex items-center gap-2"
        aria-label="Voltar para painel"
        title="Voltar para painel"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Voltar para painel</span>
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Buscar usuários, pedidos..."
            className="pl-10 bg-slate-50 dark:bg-slate-800 border-0"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Back button (go to previous page) - placed on the right side of header actions */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label="Voltar"
          title="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="space-y-2 p-2">
              <div className="flex flex-col gap-1 rounded-lg border p-3">
                <p className="text-sm font-medium">Novo usuário cadastrado</p>
                <p className="text-xs text-muted-foreground">João Silva acabou de se registrar</p>
                <p className="text-xs text-muted-foreground">Há 5 minutos</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-3">
                <p className="text-sm font-medium">Pagamento recebido</p>
                <p className="text-xs text-muted-foreground">R$ 149,90 - Plano Professional</p>
                <p className="text-xs text-muted-foreground">Há 15 minutos</p>
              </div>
              <div className="flex flex-col gap-1 rounded-lg border p-3">
                <p className="text-sm font-medium">Erro no sistema</p>
                <p className="text-xs text-muted-foreground">Falha na integração com Nuvemshop</p>
                <p className="text-xs text-muted-foreground">Há 1 hora</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center">
              Ver todas as notificações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-muted-foreground">Super Admin</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
