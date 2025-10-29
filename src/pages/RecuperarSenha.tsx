import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, ArrowLeft, AlertCircle, CheckCircle2, Loader2, Mail, Send, Check } from "lucide-react";
import { EmailService } from "@/services/email";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const RecuperarSenha = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [touched, setTouched] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { toast } = useToast();

  // Validação de email com useCallback
  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) return "Email é obrigatório";
    if (!emailRegex.test(email)) return "Email inválido";
    return "";
  }, []);

  // Timer para reenvio
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Validação em tempo real
  useEffect(() => {
    if (touched) {
      setEmailError(validateEmail(email));
    }
  }, [email, touched, validateEmail]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError(""); // Limpar erro geral quando usuário digita
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();

    // Marcar como tocado para mostrar validações
    setTouched(true);

    // Validar email
    const emailValidation = validateEmail(email);
    setEmailError(emailValidation);

    if (emailValidation) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        let errorMessage = "Erro ao enviar email";

        if (error.message.includes('rate limit')) {
          errorMessage = "Muitos pedidos de recuperação. Aguarde alguns minutos antes de tentar novamente.";
          setResendTimer(60); // 1 minuto de espera
        } else if (error.message.includes('not found') || error.message.includes('User not found')) {
          // Não revelar se email existe ou não por segurança
          errorMessage = "Se este email estiver cadastrado, você receberá instruções de recuperação.";
          setSuccess(true); // Mostrar sucesso mesmo assim
          return;
        } else if (error.message.includes('Invalid email')) {
          errorMessage = "Email inválido";
        } else {
          errorMessage = error.message;
        }

        setError(errorMessage);
      } else {
        setSuccess(true);
        setResendTimer(60); // 1 minuto para reenvio
        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada e pasta de spam.",
        });
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    // Criar um evento fake para reaproveitar a lógica
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleRecuperar(fakeEvent);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="backdrop-blur-sm bg-card/95 shadow-xl border-0">
            <CardHeader className="text-center">
              <motion.div
                className="flex justify-center mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="p-3 rounded-xl bg-green-100 ring-1 ring-green-200">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
              </motion.div>
              <CardTitle className="text-2xl font-bold text-green-700">
                Email enviado!
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Enviamos instruções para redefinir sua senha para <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <motion.div
                className="bg-muted/50 p-6 rounded-lg border border-green-200/50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h4 className="font-semibold mb-3 flex items-center justify-center gap-2 text-green-700">
                  <Mail className="h-4 w-4" />
                  Verifique seu email
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2 text-left">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Abra o email que enviamos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Clique no link "Redefinir senha"
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Digite sua nova senha
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    O link expira em 1 hora
                  </li>
                </ul>
              </motion.div>

              <motion.div
                className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <strong>Dica:</strong> Não recebeu o email? Verifique sua pasta de spam ou lixo eletrônico.
              </motion.div>

              <div className="space-y-3">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={handleResend}
                    disabled={resendTimer > 0}
                    variant="outline"
                    className="w-full"
                  >
                    {resendTimer > 0 ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Reenviar em {resendTimer}s
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Reenviar email
                      </>
                    )}
                  </Button>
                </motion.div>

                <Link to="/login">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar ao login
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="backdrop-blur-sm bg-card/95 shadow-xl border-0">
          <CardHeader className="text-center">
            <motion.div
              className="flex justify-center mb-4"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <Package className="h-8 w-8 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Recuperar senha
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Digite seu email para receber instruções de recuperação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRecuperar} className="space-y-5">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Alert variant="destructive" className="border-destructive/50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={handleBlur}
                    className={`pl-10 transition-colors ${
                      emailError && touched
                        ? "border-destructive focus:border-destructive"
                        : email && !emailError && touched
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  {email && touched && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3"
                    >
                      {emailError ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                <AnimatePresence>
                  {emailError && touched && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {emailError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || !!emailError}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar instruções
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            <div className="mt-6 text-center space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Ou
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Lembrou sua senha?
                </p>
                <Link to="/login">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Voltar ao login
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default RecuperarSenha;