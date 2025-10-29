import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  User,
  Settings,
  CreditCard,
  LogOut,
  Shield,
  Crown,
  Bell
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  name?: string;
  avatar_url?: string;
  is_admin?: boolean;
  admin_role?: string;
}

export function UserAvatar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("name, avatar_url, is_admin, admin_role")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile({
            name: data.name,
            avatar_url: data.avatar_url,
            is_admin: data.is_admin || false,
            admin_role: data.admin_role,
          });
        }
      } catch (error) {
        console.debug("Profile load error:", error);
      }
    };

    const loadNotifications = async () => {
      if (!user) return;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from("proactive_alerts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (!error && count !== null) {
          setUnreadNotifications(count);
        }
      } catch (error) {
        console.debug("Notifications not available yet");
      }
    };

    loadProfile();
    loadNotifications();

    // Refresh notifications every minute
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const getInitials = () => {
    if (profile?.name) {
      return profile.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "U";
  };

  const getRoleBadgeText = () => {
    if (!profile?.admin_role) return null;
    
    const roleMap: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      moderator: "Moderador",
      support: "Suporte"
    };

    return roleMap[profile.admin_role] || profile.admin_role;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative focus:outline-none focus:ring-2 focus:ring-primary rounded-full">
          <Avatar className="h-9 w-9 cursor-pointer border-2 border-transparent hover:border-primary transition-colors">
            <AvatarImage src={profile?.avatar_url} alt={profile?.name} />
            <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          
          {/* Admin Badge on Avatar */}
          {profile?.is_admin && (
            <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full p-1 border-2 border-white dark:border-slate-900">
              <Shield className="h-2.5 w-2.5 text-white" />
            </div>
          )}

          {/* Notification Badge */}
          {unreadNotifications > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white dark:border-slate-900">
              <span className="text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile?.avatar_url} alt={profile?.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-purple-600 text-white font-semibold text-lg">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {profile?.name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
              {profile?.is_admin && (
                <Badge
                  variant="outline"
                  className="mt-1 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {getRoleBadgeText()}
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/dashboard/perfil" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Meu Perfil</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/dashboard/assinatura" className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Assinatura</span>
              <Crown className="ml-auto h-4 w-4 text-yellow-500" />
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/dashboard/notificacoes" className="cursor-pointer">
              <Bell className="mr-2 h-4 w-4" />
              <span>Notificações</span>
              {unreadNotifications > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {unreadNotifications}
                </Badge>
              )}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link to="/dashboard/configuracoes" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {profile?.is_admin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Administração
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link
                  to="/admin"
                  className="cursor-pointer bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950"
                >
                  <Shield className="mr-2 h-4 w-4 text-blue-600" />
                  <span className="font-medium">Painel Admin</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
