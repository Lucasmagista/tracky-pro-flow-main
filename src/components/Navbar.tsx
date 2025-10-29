import { Button } from "@/components/ui/button";
import { Package, Menu, X, Moon, Sun, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminMenu } from "@/components/AdminMenu";
import { UserAvatar } from "@/components/UserAvatar";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname.includes('/dashboard');
  const { toggleTheme, isDark } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setIsAdmin((data as any).is_admin || false);
        }
      } catch (error) {
        // Silently fail if column doesn't exist (migration not run yet)
        console.debug("Admin check skipped - migration may not be applied yet");
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-smooth">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              RastreioInteligente
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {!isDashboard ? (
              <>
                <a href="#funcionalidades" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
                  Funcionalidades
                </a>
                <a href="#planos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth">
                  Planos
                </a>
                <Button variant="ghost" size="icon" onClick={toggleTheme}>
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {user ? (
                  <Link to="/dashboard">
                    <Button variant="hero">Dashboard</Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="ghost">Entrar</Button>
                    </Link>
                    <Link to="/cadastro">
                      <Button variant="hero">Começar Grátis</Button>
                    </Link>
                  </>
                )}
              </>
            ) : (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost">Pedidos</Button>
                </Link>
                <Link to="/dashboard/importar">
                  <Button variant="ghost">Importar</Button>
                </Link>
                <Link to="/dashboard/analytics">
                  <Button variant="ghost">Analytics</Button>
                </Link>
                <Link to="/dashboard/notificacoes">
                  <Button variant="ghost">
                    <Bell className="h-4 w-4 mr-2" />
                    Notificações
                  </Button>
                </Link>
                <Link to="/dashboard/assinatura">
                  <Button variant="ghost">Assinatura</Button>
                </Link>
                {isAdmin && <AdminMenu variant="navbar" />}
                <Button variant="ghost" size="icon" onClick={toggleTheme}>
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <UserAvatar />
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-smooth"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-2">
              {!isDashboard ? (
                <>
                  <a href="#funcionalidades" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-smooth">
                    Funcionalidades
                  </a>
                  <a href="#planos" className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-smooth">
                    Planos
                  </a>
                  <div className="px-4 py-2">
                    <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-full justify-center">
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </div>
                  {user ? (
                    <Link to="/dashboard" className="px-4 py-2">
                      <Button variant="hero" className="w-full">Dashboard</Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" className="px-4 py-2">
                        <Button variant="ghost" className="w-full">Entrar</Button>
                      </Link>
                      <Link to="/cadastro" className="px-4 py-2">
                        <Button variant="hero" className="w-full">Começar Grátis</Button>
                      </Link>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Link to="/dashboard" className="px-4 py-2">
                    <Button variant="ghost" className="w-full">Pedidos</Button>
                  </Link>
                  <Link to="/dashboard/importar" className="px-4 py-2">
                    <Button variant="ghost" className="w-full">Importar</Button>
                  </Link>
                  <Link to="/dashboard/analytics" className="px-4 py-2">
                    <Button variant="ghost" className="w-full">Analytics</Button>
                  </Link>
                  <Link to="/dashboard/notificacoes" className="px-4 py-2">
                    <Button variant="ghost" className="w-full">
                      <Bell className="h-4 w-4 mr-2" />
                      Notificações
                    </Button>
                  </Link>
                  <Link to="/dashboard/assinatura" className="px-4 py-2">
                    <Button variant="ghost" className="w-full">Assinatura</Button>
                  </Link>
                  {isAdmin && <AdminMenu variant="mobile" />}
                  <div className="px-4 py-2">
                    <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-full justify-center">
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
