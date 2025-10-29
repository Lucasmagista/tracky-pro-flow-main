import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Settings, 
  ArrowLeft, 
  Shield, 
  Activity,
  Crown,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  Bell,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/EmptyState";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PasswordChange } from "@/components/PasswordChange";
import { ActivityHistory } from "@/components/ActivityHistory";
import { AccountSecurity } from "@/components/AccountSecurity";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProfileStats {
  totalOrders: number;
  notificationsSent: number;
  accountAge: number;
  lastActivity: string;
}

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileStats, setProfileStats] = useState<ProfileStats>({
    totalOrders: 0,
    notificationsSent: 0,
    accountAge: 0,
    lastActivity: "",
  });
  const [profile, setProfile] = useState({
    name: "",
    store_name: "",
    avatar_url: "",
    store_email: "",
    store_phone: "",
    store_address: "",
    email: user?.email || "",
    created_at: "",
    is_admin: false,
    admin_role: null as string | null,
  });

  const loadProfile = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile({
          name: data.name || "",
          store_name: data.store_name || "",
          avatar_url: data.avatar_url || "",
          store_email: data.store_email || "",
          store_phone: data.store_phone || "",
          store_address: data.store_address || "",
          email: user!.email || "",
          created_at: data.created_at || "",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          is_admin: (data as any).is_admin || false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          admin_role: (data as any).admin_role || null,
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: "Não foi possível carregar seus dados.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  const loadStats = useCallback(async () => {
    if (!user) return;

    setStatsLoading(true);
    try {
      // Count total orders
      const { count: ordersCount, error: ordersError } = await supabase
        .from("orders")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id);

      if (ordersError) throw ordersError;

      // Count notifications sent
      const { count: notificationsCount, error: notificationsError } = await supabase
        .from("logs")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id)
        .like("action", "%notification%");

      if (notificationsError) throw notificationsError;

      // Get last activity
      const { data: lastLog, error: lastLogError } = await supabase
        .from("logs")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastLogError && lastLogError.code !== 'PGRST116') {
        console.warn("Error fetching last activity:", lastLogError);
      }

      // Calculate account age
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("id", user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.warn("Error fetching profile:", profileError);
      }

      const accountAgeInDays = profileData?.created_at
        ? Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setProfileStats({
        totalOrders: ordersCount || 0,
        notificationsSent: notificationsCount || 0,
        accountAge: accountAgeInDays,
        lastActivity: lastLog?.created_at || "",
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadStats();
    }
  }, [user, loadProfile, loadStats]);

  const handleAvatarUpdate = (avatarUrl: string) => {
    setProfile({ ...profile, avatar_url: avatarUrl });
    // Log avatar update activity
    supabase.from("logs").insert({
      user_id: user!.id,
      action: avatarUrl ? "avatar_uploaded" : "avatar_removed",
      details: { timestamp: new Date().toISOString() }
    });
  };

  const validateForm = () => {
    const errors: string[] = [];

    if (profile.store_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.store_email)) {
      errors.push("Email da loja inválido");
    }

    if (profile.store_phone && !/^[\d\s()+-]+$/.test(profile.store_phone)) {
      errors.push("Telefone da loja inválido");
    }

    if (errors.length > 0) {
      toast({
        title: "Dados inválidos",
        description: errors.join(", "),
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!user || !validateForm()) return;

    setLoading(true);
    setSaveSuccess(false);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          name: profile.name,
          store_name: profile.store_name,
          store_email: profile.store_email,
          store_phone: profile.store_phone,
          store_address: profile.store_address,
          avatar_url: profile.avatar_url,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Log profile update
      await supabase.from("logs").insert({
        user_id: user.id,
        action: "profile_updated",
        details: { 
          timestamp: new Date().toISOString(),
          fields_updated: Object.keys(profile).filter(key => key !== 'email' && key !== 'avatar_url')
        }
      });

      setSaveSuccess(true);
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      });

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = () => {
    const fields = [
      profile.name,
      profile.store_name,
      profile.store_email,
      profile.store_phone,
      profile.store_address,
      profile.avatar_url,
    ];
    const filledFields = fields.filter(field => field && field.trim() !== "").length;
    return Math.round((filledFields / fields.length) * 100);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 pt-20 pb-12 px-4">
          <EmptyState
            variant="info"
            title="Carregando perfil..."
            description="Estamos carregando suas informações pessoais e configurações da conta."
            badge={{ text: "Carregando", variant: "secondary" }}
            tips={[
              "Suas informações são mantidas seguras e privadas",
              "Aguarde enquanto sincronizamos seus dados",
              "Configure notificações e preferências pessoais"
            ]}
          />
        </main>
      </div>
    )
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-6xl space-y-8">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">Meu Perfil</h1>
              <p className="text-muted-foreground">
                Gerencie suas informações pessoais e configurações da conta
              </p>
            </div>
            {saveSuccess && (
              <Alert className="w-auto animate-in fade-in slide-in-from-top-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-500">
                  Alterações salvas!
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Profile Completion Progress */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Completude do Perfil</CardTitle>
                  <CardDescription>
                    Complete seu perfil para aproveitar todos os recursos
                  </CardDescription>
                </div>
                <Badge variant={completionPercentage === 100 ? "default" : "secondary"} className="text-lg px-4 py-2">
                  {completionPercentage}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Progress value={completionPercentage} className="h-2" />
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.name && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Nome</Badge>}
                {profile.store_name && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Loja</Badge>}
                {profile.store_email && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Email</Badge>}
                {profile.store_phone && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Telefone</Badge>}
                {profile.store_address && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Endereço</Badge>}
                {profile.avatar_url && <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Avatar</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Admin Access Card */}
          {profile.is_admin && (
            <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-gradient-to-br from-blue-600 to-purple-600">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        Painel Administrativo
                        <Badge className="bg-gradient-to-r from-blue-600 to-purple-600">
                          {profile.admin_role === 'super_admin' && 'Super Admin'}
                          {profile.admin_role === 'admin' && 'Admin'}
                          {profile.admin_role === 'moderator' && 'Moderador'}
                          {profile.admin_role === 'support' && 'Suporte'}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Você tem acesso ao painel administrativo do sistema
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground mb-2">
                      Gerencie usuários, assinaturas, logs, configurações e muito mais.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-white dark:bg-slate-900">
                        <User className="h-3 w-3 mr-1" />
                        Usuários
                      </Badge>
                      <Badge variant="outline" className="bg-white dark:bg-slate-900">
                        <Crown className="h-3 w-3 mr-1" />
                        Assinaturas
                      </Badge>
                      <Badge variant="outline" className="bg-white dark:bg-slate-900">
                        <Activity className="h-3 w-3 mr-1" />
                        Analytics
                      </Badge>
                      <Badge variant="outline" className="bg-white dark:bg-slate-900">
                        <Settings className="h-3 w-3 mr-1" />
                        Configurações
                      </Badge>
                    </div>
                  </div>
                  <Link to="/admin">
                    <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                      <Shield className="h-4 w-4 mr-2" />
                      Acessar Painel Admin
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="store" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Loja
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Segurança
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Atividades
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Profile Info */}
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Informações Pessoais
                      </CardTitle>
                      <CardDescription>
                        Atualize seus dados pessoais
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Avatar Section */}
                      <div className="flex items-center gap-6">
                        <AvatarUpload
                          currentAvatar={profile.avatar_url}
                          userId={user!.id}
                          userName={profile.name}
                          userEmail={profile.email}
                          onAvatarUpdate={handleAvatarUpdate}
                        />
                        <div>
                          <h3 className="text-lg font-semibold">{profile.name || "Usuário"}</h3>
                          <p className="text-muted-foreground">{user!.email}</p>
                          <Badge variant="secondary" className="mt-1">
                            Conta Ativa
                          </Badge>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome Completo</Label>
                          <Input
                            id="name"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            placeholder="Seu nome completo"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={profile.email}
                            disabled
                            className="bg-muted"
                          />
                          <p className="text-xs text-muted-foreground">
                            O email não pode ser alterado
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Stats Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Estatísticas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {statsLoading ? (
                        <div className="space-y-3">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex justify-between items-center">
                              <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                              <div className="h-4 bg-muted rounded w-12 animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Pedidos</span>
                            </div>
                            <Badge variant="secondary">{profileStats.totalOrders}</Badge>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Bell className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Notificações</span>
                            </div>
                            <Badge variant="secondary">{profileStats.notificationsSent}</Badge>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Dias de Conta</span>
                            </div>
                            <Badge variant="secondary">{profileStats.accountAge}</Badge>
                          </div>
                          {profileStats.lastActivity && (
                            <>
                              <Separator />
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground">Última Atividade</span>
                                <p className="text-xs font-medium">
                                  {format(new Date(profileStats.lastActivity), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Ações Rápidas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Link to="/settings">
                        <Button variant="outline" className="w-full justify-start">
                          <Bell className="mr-2 h-4 w-4" />
                          Configurar Notificações
                        </Button>
                      </Link>
                      <Link to="/whatsapp-config">
                        <Button variant="outline" className="w-full justify-start">
                          <Phone className="mr-2 h-4 w-4" />
                          Configurar WhatsApp
                        </Button>
                      </Link>
                      <Link to="/dashboard">
                        <Button variant="outline" className="w-full justify-start">
                          <MapPin className="mr-2 h-4 w-4" />
                          Gerenciar Pedidos
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  {/* Account Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5" />
                        Status da Conta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Plano</span>
                        <Badge>Grátis</Badge>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Pedidos/Mês</span>
                        <span className="text-sm font-medium">{profileStats.totalOrders}/100</span>
                      </div>
                      <Progress value={(profileStats.totalOrders / 100) * 100} className="h-1" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Notificações</span>
                        <span className="text-sm font-medium">{profileStats.notificationsSent}/50</span>
                      </div>
                      <Progress value={(profileStats.notificationsSent / 50) * 100} className="h-1" />
                      <Link to="/subscription">
                        <Button variant="default" className="w-full mt-4">
                          <Crown className="mr-2 h-4 w-4" />
                          Fazer Upgrade
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Store Tab */}
            <TabsContent value="store" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Informações da Loja
                  </CardTitle>
                  <CardDescription>
                    Configure os dados da sua loja para notificações e comunicações
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="storeName">Nome da Loja</Label>
                      <Input
                        id="storeName"
                        value={profile.store_name}
                        onChange={(e) => setProfile({ ...profile, store_name: e.target.value })}
                        placeholder="Nome da sua loja"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storeEmail">Email da Loja</Label>
                      <Input
                        id="storeEmail"
                        type="email"
                        value={profile.store_email}
                        onChange={(e) => setProfile({ ...profile, store_email: e.target.value })}
                        placeholder="contato@sualoja.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="storePhone">Telefone da Loja</Label>
                      <Input
                        id="storePhone"
                        value={profile.store_phone}
                        onChange={(e) => setProfile({ ...profile, store_phone: e.target.value })}
                        placeholder="(11) 98765-4321"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storeAddress">Endereço da Loja</Label>
                    <Textarea
                      id="storeAddress"
                      value={profile.store_address}
                      onChange={(e) => setProfile({ ...profile, store_address: e.target.value })}
                      placeholder="Rua, número, bairro, cidade - UF, CEP"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        loadProfile();
                        toast({
                          title: "Dados recarregados",
                          description: "Os dados foram atualizados com sucesso.",
                        });
                      }}
                      disabled={loading}
                    >
                      Descartar Alterações
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Alterações"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <PasswordChange userId={user!.id} />
                <AccountSecurity userId={user!.id} userEmail={profile.email} />
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              <ActivityHistory userId={user!.id} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Profile;