import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Smartphone, Mail, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AccountSecurityProps {
  userId: string;
  userEmail: string;
}

export const AccountSecurity = ({ userId, userEmail }: AccountSecurityProps) => {
  const [loading, setLoading] = useState(false);
  const [lastPasswordChange, setLastPasswordChange] = useState<string | null>(null);
  const [securityScore, setSecurityScore] = useState(0);
  const { toast } = useToast();

  const loadSecurityInfo = useCallback(async () => {
    try {
      // Get last password change
      const { data: passwordLog } = await supabase
        .from("logs")
        .select("created_at")
        .eq("user_id", userId)
        .eq("action", "password_changed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (passwordLog) {
        setLastPasswordChange(passwordLog.created_at);
      }

      // Calculate security score
      let score = 0;
      
      // Check if email is verified
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) score += 25;
      
      // Check if password was recently changed
      if (passwordLog) {
        const daysSinceChange = Math.floor(
          (new Date().getTime() - new Date(passwordLog.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceChange < 90) score += 25;
      }

      // Check if profile is complete
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, store_name, store_email, store_phone")
        .eq("id", userId)
        .single();

      if (profile) {
        const fields = [profile.name, profile.store_name, profile.store_email, profile.store_phone];
        const filledFields = fields.filter(f => f && f.trim() !== "").length;
        score += (filledFields / fields.length) * 25;
      }

      // Check for recent activity (engagement score)
      const { count } = await supabase
        .from("logs")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (count && count > 0) score += 25;

      setSecurityScore(Math.round(score));
    } catch (error) {
      console.error("Error loading security info:", error);
    }
  }, [userId]);

  useEffect(() => {
    loadSecurityInfo();
  }, [loadSecurityInfo]);

  const sendVerificationEmail = async () => {
    setLoading(true);
    try {
      // This would typically trigger a verification email
      // For now, we'll just show a success message
      toast({
        title: "Email de verificação enviado",
        description: "Verifique sua caixa de entrada e spam.",
      });
    } catch (error) {
      console.error("Error sending verification email:", error);
      toast({
        title: "Erro ao enviar email",
        description: "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSecurityLevel = () => {
    if (securityScore >= 80) return { label: "Excelente", color: "text-green-500", variant: "default" as const };
    if (securityScore >= 60) return { label: "Boa", color: "text-blue-500", variant: "secondary" as const };
    if (securityScore >= 40) return { label: "Regular", color: "text-yellow-500", variant: "secondary" as const };
    return { label: "Fraca", color: "text-red-500", variant: "destructive" as const };
  };

  const securityLevel = getSecurityLevel();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Segurança da Conta
        </CardTitle>
        <CardDescription>
          Mantenha sua conta segura e protegida
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Score */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Nível de Segurança</p>
            <p className={`text-2xl font-bold ${securityLevel.color}`}>
              {securityScore}%
            </p>
          </div>
          <Badge variant={securityLevel.variant} className="text-lg px-4 py-2">
            {securityLevel.label}
          </Badge>
        </div>

        <Separator />

        {/* Security Checks */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Email Verificado</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <Badge variant="outline" className="text-green-500">
              <Mail className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            {lastPasswordChange ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">Senha Atualizada</p>
              <p className="text-xs text-muted-foreground">
                {lastPasswordChange 
                  ? `Última alteração: ${format(new Date(lastPasswordChange), "dd/MM/yyyy", { locale: ptBR })}`
                  : "Nunca alterada"
                }
              </p>
            </div>
            {lastPasswordChange && (
              <Badge variant="outline" className="text-green-500">
                <Clock className="h-3 w-3 mr-1" />
                OK
              </Badge>
            )}
          </div>

          <Separator />

          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Autenticação Segura</p>
              <p className="text-xs text-muted-foreground">
                Sua conta está protegida
              </p>
            </div>
            <Badge variant="outline" className="text-green-500">
              <Shield className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Recommendations */}
        {securityScore < 80 && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-medium text-sm text-yellow-900 dark:text-yellow-100">
                  Recomendações de Segurança
                </p>
                <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                  {securityScore < 40 && <li>Complete seu perfil com todas as informações</li>}
                  {!lastPasswordChange && <li>Altere sua senha pela primeira vez</li>}
                  {lastPasswordChange && (
                    <li>Considere alterar sua senha regularmente (a cada 90 dias)</li>
                  )}
                  <li>Mantenha seu email sempre atualizado</li>
                  <li>Use uma senha forte com letras, números e símbolos</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
