import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Eye, EyeOff, Package, ArrowLeft, AlertCircle, CheckCircle2, Loader2, User, Mail, Lock, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const Cadastro = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    storeName: "",
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    storeName: "",
  });
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    storeName: false,
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  // Validações avançadas com useCallback
  const validateName = useCallback((name: string) => {
    if (!name.trim()) return "Nome é obrigatório";
    if (name.trim().length < 2) return "Nome deve ter pelo menos 2 caracteres";
    if (name.trim().length > 100) return "Nome deve ter no máximo 100 caracteres";
    if (!/^[a-zA-ZÀ-ÿ\s]+$/.test(name.trim())) return "Nome deve conter apenas letras e espaços";
    return "";
  }, []);

  const validateEmail = useCallback((email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email é obrigatório";
    if (!emailRegex.test(email)) return "Email inválido";
    return "";
  }, []);

  const validateStoreName = useCallback((storeName: string) => {
    if (!storeName.trim()) return "Nome da loja é obrigatório";
    if (storeName.trim().length < 2) return "Nome da loja deve ter pelo menos 2 caracteres";
    if (storeName.trim().length > 100) return "Nome da loja deve ter no máximo 100 caracteres";
    return "";
  }, []);

  const validatePassword = useCallback((password: string) => {
    if (!password) return "Senha é obrigatória";
    if (password.length < 8) return "Senha deve ter pelo menos 8 caracteres";
    if (!/(?=.*[a-z])/.test(password)) return "Senha deve conter pelo menos uma letra minúscula";
    if (!/(?=.*[A-Z])/.test(password)) return "Senha deve conter pelo menos uma letra maiúscula";
    if (!/(?=.*\d)/.test(password)) return "Senha deve conter pelo menos um número";
    if (!/(?=.*[@$!%*?&])/.test(password)) return "Senha deve conter pelo menos um caractere especial (@$!%*?&)";
    return "";
  }, []);

  const validateConfirmPassword = useCallback((confirmPassword: string) => {
    if (!confirmPassword) return "Confirmação de senha é obrigatória";
    if (confirmPassword !== formData.password) return "Senhas não coincidem";
    return "";
  }, [formData.password]);

  // Calcular força da senha
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/(?=.*[a-z])/.test(password)) strength += 25;
    if (/(?=.*[A-Z])/.test(password)) strength += 25;
    if (/(?=.*\d)/.test(password)) strength += 12.5;
    if (/(?=.*[@$!%*?&])/.test(password)) strength += 12.5;
    return strength;
  };

  const getPasswordStrengthLabel = (strength: number) => {
    if (strength < 25) return { label: "Muito fraca", color: "bg-red-500" };
    if (strength < 50) return { label: "Fraca", color: "bg-orange-500" };
    if (strength < 75) return { label: "Boa", color: "bg-yellow-500" };
    if (strength < 100) return { label: "Forte", color: "bg-green-500" };
    return { label: "Muito forte", color: "bg-green-600" };
  };

  // Atualizar validações quando campos mudam
  useEffect(() => {
    if (touched.name) {
      setFieldErrors(prev => ({ ...prev, name: validateName(formData.name) }));
    }
    if (touched.email) {
      setFieldErrors(prev => ({ ...prev, email: validateEmail(formData.email) }));
    }
    if (touched.storeName) {
      setFieldErrors(prev => ({ ...prev, storeName: validateStoreName(formData.storeName) }));
    }
    if (touched.password) {
      setFieldErrors(prev => ({ ...prev, password: validatePassword(formData.password) }));
    }
    if (touched.confirmPassword) {
      setFieldErrors(prev => ({ ...prev, confirmPassword: validateConfirmPassword(formData.confirmPassword) }));
    }
  }, [formData, touched, validateName, validateEmail, validateStoreName, validatePassword, validateConfirmPassword]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(""); // Limpar erro geral quando usuário digita
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();

    // Marcar todos os campos como tocados para mostrar validações
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      storeName: true,
    });

    // Validar todos os campos
    const errors = {
      name: validateName(formData.name),
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      confirmPassword: validateConfirmPassword(formData.confirmPassword),
      storeName: validateStoreName(formData.storeName),
    };

    setFieldErrors(errors);

    // Verificar se há erros
    const hasErrors = Object.values(errors).some(error => error !== "");
    if (hasErrors) {
      setError("Por favor, corrija os erros no formulário");
      return;
    }

    if (!formData.acceptTerms) {
      setError("Você deve aceitar os termos de uso");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name.trim(),
            store_name: formData.storeName.trim(),
          }
        }
      });

      if (error) {
        let errorMessage = "Erro ao criar conta";

        if (error.message.includes('User already registered')) {
          errorMessage = "Este email já está cadastrado";
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = "Senha muito fraca. Use pelo menos 8 caracteres";
        } else if (error.message.includes('Invalid email')) {
          errorMessage = "Email inválido";
        } else {
          errorMessage = error.message;
        }

        setError(errorMessage);
      } else {
        toast({
          title: "Conta criada com sucesso!",
          description: "Verifique seu email para confirmar a conta e começar a usar.",
        });
        navigate("/login");
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="backdrop-blur-sm bg-card/95 shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-start mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 hover:bg-muted/50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Login
              </Button>
            </div>
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
              Criar sua conta
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Comece a gerenciar seus pedidos com o Tracky Pro Flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCadastro} className="space-y-5">
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
                <Label htmlFor="name" className="text-sm font-medium">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    className={`pl-10 transition-colors ${
                      fieldErrors.name && touched.name
                        ? "border-destructive focus:border-destructive"
                        : formData.name && !fieldErrors.name && touched.name
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  {formData.name && touched.name && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3"
                    >
                      {fieldErrors.name ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                <AnimatePresence>
                  {fieldErrors.name && touched.name && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.name}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storeName" className="text-sm font-medium">
                  Nome da loja
                </Label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="storeName"
                    type="text"
                    placeholder="Nome da sua loja"
                    value={formData.storeName}
                    onChange={(e) => handleInputChange("storeName", e.target.value)}
                    onBlur={() => handleBlur("storeName")}
                    className={`pl-10 transition-colors ${
                      fieldErrors.storeName && touched.storeName
                        ? "border-destructive focus:border-destructive"
                        : formData.storeName && !fieldErrors.storeName && touched.storeName
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  {formData.storeName && touched.storeName && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3"
                    >
                      {fieldErrors.storeName ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                <AnimatePresence>
                  {fieldErrors.storeName && touched.storeName && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.storeName}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

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
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    className={`pl-10 transition-colors ${
                      fieldErrors.email && touched.email
                        ? "border-destructive focus:border-destructive"
                        : formData.email && !fieldErrors.email && touched.email
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  {formData.email && touched.email && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-3"
                    >
                      {fieldErrors.email ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                <AnimatePresence>
                  {fieldErrors.email && touched.email && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    className={`pl-10 pr-10 transition-colors ${
                      fieldErrors.password && touched.password
                        ? "border-destructive focus:border-destructive"
                        : formData.password && !fieldErrors.password && touched.password
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  {formData.password && touched.password && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-10 top-3"
                    >
                      {fieldErrors.password ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                {/* Barra de força da senha */}
                <AnimatePresence>
                  {formData.password && touched.password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">Força da senha</span>
                        <span className={`text-xs font-medium ${getPasswordStrengthLabel(getPasswordStrength(formData.password)).color.replace('bg-', 'text-')}`}>
                          {getPasswordStrengthLabel(getPasswordStrength(formData.password)).label}
                        </span>
                      </div>
                      <Progress
                        value={getPasswordStrength(formData.password)}
                        className="h-1"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence>
                  {fieldErrors.password && touched.password && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirmar senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    onBlur={() => handleBlur("confirmPassword")}
                    className={`pl-10 pr-10 transition-colors ${
                      fieldErrors.confirmPassword && touched.confirmPassword
                        ? "border-destructive focus:border-destructive"
                        : formData.confirmPassword && !fieldErrors.confirmPassword && touched.confirmPassword
                        ? "border-green-500 focus:border-green-500"
                        : ""
                    }`}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  {formData.confirmPassword && touched.confirmPassword && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-10 top-3"
                    >
                      {fieldErrors.confirmPassword ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                    </motion.div>
                  )}
                </div>
                <AnimatePresence>
                  {fieldErrors.confirmPassword && touched.confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-destructive flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.confirmPassword}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <Checkbox
                  id="terms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => handleInputChange("acceptTerms", checked as boolean)}
                  className="mt-0.5"
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  Aceito os{" "}
                  <Link to="/termos" className="text-primary hover:text-primary/80 transition-colors underline">
                    termos de uso
                  </Link>{" "}
                  e{" "}
                  <Link to="/privacidade" className="text-primary hover:text-primary/80 transition-colors underline">
                    política de privacidade
                  </Link>
                </Label>
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loading || Object.values(fieldErrors).some(error => error !== "") || !formData.acceptTerms}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Criar conta gratuita"
                  )}
                </Button>
              </motion.div>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  Fazer login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Cadastro;