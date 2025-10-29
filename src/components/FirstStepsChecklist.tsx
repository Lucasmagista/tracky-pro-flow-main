import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    CheckCircle,
    Circle,
    Package,
    Settings,
    Bell,
    Users,
    ExternalLink,
    X,
    Trophy
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    completed: boolean;
    category: 'setup' | 'integrations' | 'features' | 'team';
}

interface FirstStepsChecklistProps {
    onComplete?: () => void;
    onDismiss?: () => void;
}

export const FirstStepsChecklist = ({ onComplete, onDismiss }: FirstStepsChecklistProps) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadChecklist = async () => {
            if (!user) return;

            try {
                // Load user data to determine checklist state
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                const { data: orders } = await supabase
                    .from('orders')
                    .select('id')
                    .eq('user_id', user.id)
                    .limit(1);

                const { data: integrations } = await supabase
                    .from('marketplace_integrations')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_connected', true)
                    .limit(1);

                const { data: notifications } = await supabase
                    .from('notification_settings')
                    .select('id')
                    .eq('user_id', user.id)
                    .limit(1);

                const hasOrders = orders && orders.length > 0;
                const hasIntegrations = integrations && integrations.length > 0;
                const hasNotifications = notifications && notifications.length > 0;

                const checklistData: ChecklistItem[] = [
                    {
                        id: 'complete_profile',
                        title: 'Complete seu perfil',
                        description: 'Adicione informações da sua loja e avatar',
                        icon: <Settings className="h-5 w-5" />,
                        action: {
                            label: 'Editar Perfil',
                            href: '/profile'
                        },
                        completed: !!(profile?.store_name && profile?.store_email),
                        category: 'setup'
                    },
                    {
                        id: 'first_order',
                        title: 'Importe seu primeiro pedido',
                        description: 'Adicione ou importe pedidos para começar o rastreamento',
                        icon: <Package className="h-5 w-5" />,
                        action: {
                            label: 'Importar Pedidos',
                            href: '/import-orders'
                        },
                        completed: hasOrders,
                        category: 'setup'
                    },
                    {
                        id: 'setup_notifications',
                        title: 'Configure notificações',
                        description: 'Defina como seus clientes serão notificados',
                        icon: <Bell className="h-5 w-5" />,
                        action: {
                            label: 'Configurar',
                            href: '/notification-settings'
                        },
                        completed: hasNotifications,
                        category: 'features'
                    },
                    {
                        id: 'connect_marketplace',
                        title: 'Conecte um marketplace',
                        description: 'Integre com Shopify, WooCommerce ou Mercado Livre',
                        icon: <ExternalLink className="h-5 w-5" />,
                        action: {
                            label: 'Ver Integrações',
                            href: '/settings'
                        },
                        completed: hasIntegrations,
                        category: 'integrations'
                    },
                    {
                        id: 'invite_team',
                        title: 'Convide sua equipe',
                        description: 'Adicione membros da equipe para colaboração',
                        icon: <Users className="h-5 w-5" />,
                        action: {
                            label: 'Convidar',
                            onClick: () => {
                                toast({
                                    title: "Funcionalidade em breve",
                                    description: "O convite de equipe estará disponível em breve.",
                                });
                            }
                        },
                        completed: false, // TODO: Implement team management
                        category: 'team'
                    }
                ];

                setChecklist(checklistData);
            } catch (error) {
                console.error('Error loading checklist:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadChecklist();
    }, [user, toast]);

    const completedItems = checklist.filter(item => item.completed).length;
    const totalItems = checklist.length;
    const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    const isCompleted = completedItems === totalItems;

    const handleItemToggle = async (itemId: string) => {
        // This would normally update the database, but for now we'll just update local state
        setChecklist(prev =>
            prev.map(item =>
                item.id === itemId ? { ...item, completed: !item.completed } : item
            )
        );
    };

    const handleAction = (item: ChecklistItem) => {
        if (item.action?.href) {
            window.location.href = item.action.href;
        } else if (item.action?.onClick) {
            item.action.onClick();
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        Primeiros Passos
                    </CardTitle>
                    <CardDescription>
                        Carregando sua lista de tarefas...
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 animate-pulse">
                                <div className="h-5 w-5 bg-muted rounded"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-muted rounded w-3/4"></div>
                                    <div className="h-3 bg-muted rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (isCompleted && onComplete) {
        onComplete();
        return null;
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'setup': return 'bg-blue-100 text-blue-800';
            case 'integrations': return 'bg-green-100 text-green-800';
            case 'features': return 'bg-purple-100 text-purple-800';
            case 'team': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className="relative">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5" />
                            Primeiros Passos
                        </CardTitle>
                        <CardDescription>
                            Complete estas tarefas para aproveitar ao máximo a plataforma
                        </CardDescription>
                    </div>
                    {onDismiss && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDismiss}
                            className="h-6 w-6 p-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span>Progresso</span>
                        <span>{completedItems} de {totalItems} concluídos</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            </CardHeader>

            <CardContent>
                <div className="space-y-4">
                    {checklist.map((item) => (
                        <div
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                item.completed
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-muted/30 border-border hover:bg-muted/50'
                            }`}
                        >
                            <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => handleItemToggle(item.id)}
                                className="mt-0.5"
                            />

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`p-1 rounded ${item.completed ? 'text-green-600' : 'text-muted-foreground'}`}>
                                        {item.icon}
                                    </div>
                                    <h4 className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                        {item.title}
                                    </h4>
                                    <Badge variant="outline" className={`text-xs ${getCategoryColor(item.category)}`}>
                                        {item.category === 'setup' ? 'Configuração' :
                                         item.category === 'integrations' ? 'Integrações' :
                                         item.category === 'features' ? 'Recursos' : 'Equipe'}
                                    </Badge>
                                </div>

                                <p className="text-xs text-muted-foreground mb-2">
                                    {item.description}
                                </p>

                                {item.action && !item.completed && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAction(item)}
                                        className="h-7 text-xs"
                                    >
                                        {item.action.label}
                                    </Button>
                                )}

                                {item.completed && (
                                    <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-3 w-3" />
                                        <span className="text-xs font-medium">Concluído</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {isCompleted && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                        <Trophy className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <h3 className="font-semibold text-green-800 mb-1">Parabéns! 🎉</h3>
                        <p className="text-sm text-green-700">
                            Você completou todos os primeiros passos. Sua loja está pronta para operar!
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
