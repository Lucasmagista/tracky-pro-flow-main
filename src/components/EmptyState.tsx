import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, Package, BarChart3, Upload, Bell, Settings, FileText, TrendingUp, Zap, Users, Database, Mail, Smartphone, Globe, Shield, Clock, CheckCircle2, AlertTriangle, Info, Star, Heart, Target, Lightbulb, Rocket, Search, Filter, Plus, Download, RefreshCw, ExternalLink, Brain, TrendingDown, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive" | "hero" | "success";
  icon?: LucideIcon;
  external?: boolean;
}

interface EmptyStateProps {
  variant?: "default" | "dashboard" | "analytics" | "import" | "notifications" | "settings" | "orders" | "reports" | "integrations" | "data" | "search" | "error" | "success" | "warning" | "info" | "ai" | "advanced";
  icon?: LucideIcon;
  title: string;
  description: string;
  illustration?: React.ReactNode;
  actions?: EmptyStateAction[];
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
  };
  metrics?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: {
      value: string;
      isPositive: boolean;
    };
  }>;
  tips?: string[];
  className?: string;
}

// Ilustrações customizadas para diferentes estados vazios
const EmptyStateIllustrations = {
  dashboard: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full flex items-center justify-center">
        <Package className="w-16 h-16 text-primary/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
        <Plus className="w-4 h-4 text-accent-foreground" />
      </div>
    </div>
  ),

  analytics: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full flex items-center justify-center">
        <BarChart3 className="w-16 h-16 text-blue-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <TrendingUp className="w-3 h-3 text-white" />
      </div>
      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
        <Target className="w-3 h-3 text-white" />
      </div>
    </div>
  ),

  import: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full flex items-center justify-center">
        <Upload className="w-16 h-16 text-green-500/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
        <FileText className="w-4 h-4 text-white" />
      </div>
      <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
        <Database className="w-4 h-4 text-white" />
      </div>
    </div>
  ),

  notifications: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-full flex items-center justify-center">
        <Bell className="w-16 h-16 text-orange-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">!</span>
      </div>
    </div>
  ),

  settings: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-gray-500/10 to-slate-500/10 rounded-full flex items-center justify-center">
        <Settings className="w-16 h-16 text-gray-500/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
        <Shield className="w-4 h-4 text-white" />
      </div>
    </div>
  ),

  orders: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full flex items-center justify-center">
        <Package className="w-16 h-16 text-indigo-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    </div>
  ),

  reports: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 rounded-full flex items-center justify-center">
        <FileText className="w-16 h-16 text-cyan-500/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
        <Download className="w-4 h-4 text-white" />
      </div>
    </div>
  ),

  integrations: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-full flex items-center justify-center">
        <Globe className="w-16 h-16 text-violet-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <Zap className="w-3 h-3 text-white" />
      </div>
      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <LinkIcon className="w-3 h-3 text-white" />
      </div>
    </div>
  ),

  data: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-slate-500/10 to-gray-500/10 rounded-full flex items-center justify-center">
        <Database className="w-16 h-16 text-slate-500/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
        <BarChart3 className="w-4 h-4 text-white" />
      </div>
    </div>
  ),

  search: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-full flex items-center justify-center">
        <Search className="w-16 h-16 text-yellow-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">0</span>
      </div>
    </div>
  ),

  error: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-16 h-16 text-red-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">!</span>
      </div>
    </div>
  ),

  success: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-16 h-16 text-green-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    </div>
  ),

  warning: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">!</span>
      </div>
    </div>
  ),

  info: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full flex items-center justify-center">
        <Info className="w-16 h-16 text-blue-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <span className="text-xs font-bold text-white">i</span>
      </div>
    </div>
  ),

  ai: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full flex items-center justify-center">
        <Zap className="w-16 h-16 text-purple-500/60" />
      </div>
      <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
        <Brain className="w-3 h-3 text-white" />
      </div>
      <div className="absolute -bottom-1 -left-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
        <Lightbulb className="w-3 h-3 text-white" />
      </div>
    </div>
  ),

  advanced: (
    <div className="relative">
      <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full flex items-center justify-center">
        <Rocket className="w-16 h-16 text-emerald-500/60" />
      </div>
      <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
        <BarChart3 className="w-4 h-4 text-white" />
      </div>
      <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
        <FileText className="w-4 h-4 text-white" />
      </div>
    </div>
  ),

  default: (
    <div className="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-full flex items-center justify-center">
      <Package className="w-16 h-16 text-muted-foreground/60" />
    </div>
  )
};

const EmptyState = ({
  variant = "default",
  icon,
  title,
  description,
  illustration,
  actions = [],
  badge,
  metrics,
  tips,
  className
}: EmptyStateProps) => {
  const defaultIcon = {
    dashboard: Package,
    analytics: BarChart3,
    import: Upload,
    notifications: Bell,
    settings: Settings,
    orders: Package,
    reports: FileText,
    integrations: Globe,
    data: Database,
    search: Search,
    error: AlertTriangle,
    success: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
    ai: Zap,
    advanced: Rocket,
    default: Package
  }[variant];

  const IconComponent = icon || defaultIcon;
  const illustrationComponent = illustration || EmptyStateIllustrations[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className={`border-dashed border-2 ${className}`}>
        <CardContent className="flex flex-col items-center justify-center py-12 px-8 text-center">
          {illustrationComponent}

          {badge && (
            <Badge
              variant={badge.variant || "secondary"}
              className="mb-4"
            >
              {badge.text}
            </Badge>
          )}

          <h3 className="text-xl font-semibold mb-3">{title}</h3>
          <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">{description}</p>

          {metrics && metrics.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 w-full max-w-lg">
              {metrics.map((metric, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.3 }}
                  className="bg-muted/30 rounded-lg p-4 text-center"
                >
                  <div className="flex items-center justify-center mb-2">
                    {metric.icon && <metric.icon className="w-4 h-4 text-muted-foreground mr-2" />}
                    <span className="text-2xl font-bold">{metric.value}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{metric.label}</p>
                  {metric.trend && (
                    <div className={`text-xs flex items-center justify-center gap-1 ${
                      metric.trend.isPositive ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.trend.isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {metric.trend.value}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {actions && actions.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              {actions.map((action, index) => {
                const buttonProps = {
                  variant: action.variant || (index === 0 ? "default" : "outline"),
                  onClick: action.onClick,
                  className: "min-w-[140px]"
                };

                const buttonContent = (
                  <>
                    {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                    {action.label}
                    {action.external && <ExternalLink className="w-3 h-3 ml-2" />}
                  </>
                );

                if (action.href) {
                  return (
                    <Link key={index} to={action.href}>
                      <Button {...buttonProps}>
                        {buttonContent}
                      </Button>
                    </Link>
                  );
                }

                return (
                  <Button key={index} {...buttonProps}>
                    {buttonContent}
                  </Button>
                );
              })}
            </div>
          )}

          {tips && tips.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Dicas</span>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                {tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EmptyState;