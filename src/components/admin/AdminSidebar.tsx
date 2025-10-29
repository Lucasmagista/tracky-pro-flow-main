import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Settings,
  BarChart3,
  Shield,
  Database,
  Bell,
  Flag,
  ChevronLeft,
  Package,
  Key,
  User,
  DollarSign,
  ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface AdminSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true
  },
  {
    name: 'Usuários',
    href: '/admin/users',
    icon: Users
  },
  {
    name: 'Assinaturas',
    href: '/admin/subscriptions',
    icon: CreditCard
  },
  {
    name: 'Pedidos',
    href: '/admin/orders',
    icon: Package
  },
  {
    name: 'Logs & Auditoria',
    href: '/admin/logs',
    icon: FileText
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3
  },
  {
    name: 'Banco de Dados',
    href: '/admin/database',
    icon: Database
  },
  {
    name: 'Feature Flags',
    href: '/admin/features',
    icon: Flag
  },
  {
    name: 'Notificações',
    href: '/admin/notifications',
    icon: Bell
  },
  {
    name: 'Segurança',
    href: '/admin/security',
    icon: Shield
  },
  {
    name: 'MFA (2FA)',
    href: '/admin/mfa',
    icon: ShieldCheck
  },
  {
    name: 'Permissões',
    href: '/admin/permissions',
    icon: Key
  },
  {
    name: 'Stripe',
    href: '/admin/stripe',
    icon: DollarSign
  },
  {
    name: 'Perfil',
    href: '/admin/profile',
    icon: User
  },
  {
    name: 'Configurações',
    href: '/admin/settings',
    icon: Settings
  }
]

export function AdminSidebar({ isOpen, onToggle }: AdminSidebarProps) {
  const location = useLocation()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300",
          isOpen ? "w-64" : "w-20 lg:w-20",
          !isOpen && "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
            {isOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Admin Panel
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tracky Pro
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggle}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 mx-auto"
              >
                <Shield className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = item.exact 
                  ? location.pathname === item.href
                  : location.pathname.startsWith(item.href)

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    )}
                    title={!isOpen ? item.name : undefined}
                  >
                    <item.icon className={cn("h-5 w-5 flex-shrink-0")} />
                    {isOpen && <span>{item.name}</span>}
                  </Link>
                )
              })}
            </nav>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4">
            {isOpen && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <p className="font-medium">Versão 1.0.0</p>
                <p className="mt-1">© 2025 Tracky Pro</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
