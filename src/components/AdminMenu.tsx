import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Users,
  FileText,
  Settings,
  BarChart3,
  CreditCard,
  AlertCircle,
  ChevronDown,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AdminMenuProps {
  variant?: "navbar" | "mobile";
}

export function AdminMenu({ variant = "navbar" }: AdminMenuProps) {
  const [criticalAlerts, setCriticalAlerts] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    const fetchCriticalAlerts = async () => {
      if (!user) return;

      try {
        // Count critical/error logs from last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from("admin_logs")
          .select("*", { count: "exact", head: true })
          .in("severity", ["critical", "error"])
          .gte("created_at", oneDayAgo.toISOString());

        if (!error && count !== null) {
          setCriticalAlerts(count);
        }
      } catch (error) {
        console.debug("Could not fetch alerts - admin tables may not exist yet");
      }
    };

    fetchCriticalAlerts();

    // Refresh alerts every 2 minutes
    const interval = setInterval(fetchCriticalAlerts, 120000);
    return () => clearInterval(interval);
  }, [user]);

  const menuItems = [
    {
      icon: Activity,
      label: "Dashboard",
      href: "/admin",
      description: "Visão geral do sistema"
    },
    {
      icon: Users,
      label: "Usuários",
      href: "/admin/users",
      description: "Gerenciar usuários"
    },
    {
      icon: CreditCard,
      label: "Assinaturas",
      href: "/admin/subscriptions",
      description: "Gerenciar planos"
    },
    {
      icon: FileText,
      label: "Logs",
      href: "/admin/logs",
      description: "Logs e auditoria"
    },
    {
      icon: BarChart3,
      label: "Analytics",
      href: "/admin/analytics",
      description: "Relatórios e métricas"
    },
    {
      icon: Settings,
      label: "Configurações",
      href: "/admin/settings",
      description: "Configurações do sistema"
    }
  ];

  if (variant === "mobile") {
    return (
      <div className="px-4 py-2">
        <Link to="/admin">
          <Button
            variant="default"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 relative"
          >
            <Shield className="h-4 w-4 mr-2" />
            Painel Admin
            {criticalAlerts > 0 && (
              <Badge
                variant="destructive"
                className="ml-2 px-1.5 py-0.5 text-xs absolute -top-1 -right-1"
              >
                {criticalAlerts}
              </Badge>
            )}
          </Button>
        </Link>
        <div className="mt-2 space-y-1">
          {menuItems.map((item) => (
            <Link key={item.href} to={item.href}>
              <Button variant="ghost" className="w-full justify-start" size="sm">
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 relative"
        >
          <Shield className="h-4 w-4 mr-2" />
          Admin
          {criticalAlerts > 0 && (
            <Badge
              variant="destructive"
              className="ml-2 px-1.5 py-0.5 text-xs"
            >
              {criticalAlerts}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <span>Painel Administrativo</span>
        </DropdownMenuLabel>

        {criticalAlerts > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-red-600 font-medium">
                  {criticalAlerts} alerta{criticalAlerts > 1 ? "s" : ""} crítico
                  {criticalAlerts > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {menuItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                to={item.href}
                className="flex items-start gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
