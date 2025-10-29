/**
 * Empty State Components
 * 
 * Componentes para estados vazios com CTAs
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Package,
  FileText,
  Search,
  Filter,
  Link2,
  Bell,
  Settings,
  TrendingUp,
  LucideIcon,
} from 'lucide-react';

export interface EmptyStateProps {
  /**
   * Ícone a ser exibido
   */
  icon?: LucideIcon;
  
  /**
   * Título do empty state
   */
  title: string;
  
  /**
   * Descrição opcional
   */
  description?: string;
  
  /**
   * Texto do botão de ação principal
   */
  actionLabel?: string;
  
  /**
   * Callback do botão de ação
   */
  onAction?: () => void;
  
  /**
   * Texto do botão secundário
   */
  secondaryActionLabel?: string;
  
  /**
   * Callback do botão secundário
   */
  onSecondaryAction?: () => void;
  
  /**
   * Classes CSS adicionais
   */
  className?: string;
}

/**
 * Componente base de Empty State
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Package}
 *   title="Nenhum pedido encontrado"
 *   description="Comece importando pedidos de suas integrações"
 *   actionLabel="Importar Pedidos"
 *   onAction={() => navigate('/import')}
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Package,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center',
        className
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Actions */}
        {(actionLabel || secondaryActionLabel) && (
          <div className="flex flex-wrap gap-2 justify-center">
            {actionLabel && onAction && (
              <Button onClick={onAction}>
                {actionLabel}
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <Button variant="outline" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Empty state para tabela de pedidos
 */
export const EmptyOrders: React.FC<{
  onImport?: () => void;
  className?: string;
}> = ({ onImport, className }) => {
  return (
    <EmptyState
      icon={Package}
      title="Nenhum pedido encontrado"
      description="Comece importando pedidos de suas integrações configuradas ou crie um pedido manualmente."
      actionLabel="Importar Pedidos"
      onAction={onImport}
      secondaryActionLabel="Criar Pedido"
      className={className}
    />
  );
};

/**
 * Empty state para resultados de busca
 */
export const EmptySearch: React.FC<{
  searchTerm?: string;
  onClearSearch?: () => void;
  className?: string;
}> = ({ searchTerm, onClearSearch, className }) => {
  return (
    <EmptyState
      icon={Search}
      title="Nenhum resultado encontrado"
      description={
        searchTerm
          ? `Não encontramos resultados para "${searchTerm}". Tente ajustar sua busca.`
          : 'Tente usar outros termos de busca.'
      }
      actionLabel={onClearSearch ? 'Limpar Busca' : undefined}
      onAction={onClearSearch}
      className={className}
    />
  );
};

/**
 * Empty state para filtros sem resultados
 */
export const EmptyFilters: React.FC<{
  onClearFilters?: () => void;
  className?: string;
}> = ({ onClearFilters, className }) => {
  return (
    <EmptyState
      icon={Filter}
      title="Nenhum item corresponde aos filtros"
      description="Tente ajustar ou remover alguns filtros para ver mais resultados."
      actionLabel="Limpar Filtros"
      onAction={onClearFilters}
      className={className}
    />
  );
};

/**
 * Empty state para integrações não configuradas
 */
export const EmptyIntegrations: React.FC<{
  onConnect?: () => void;
  className?: string;
}> = ({ onConnect, className }) => {
  return (
    <EmptyState
      icon={Link2}
      title="Nenhuma integração configurada"
      description="Conecte suas lojas e marketplaces para começar a importar pedidos automaticamente."
      actionLabel="Conectar Integração"
      onAction={onConnect}
      secondaryActionLabel="Ver Documentação"
      className={className}
    />
  );
};

/**
 * Empty state para notificações
 */
export const EmptyNotifications: React.FC<{
  onSetup?: () => void;
  className?: string;
}> = ({ onSetup, className }) => {
  return (
    <EmptyState
      icon={Bell}
      title="Nenhuma notificação"
      description="Configure notificações automáticas para manter seus clientes informados sobre o status dos pedidos."
      actionLabel="Configurar Notificações"
      onAction={onSetup}
      className={className}
    />
  );
};

/**
 * Empty state para dashboard sem dados
 */
export const EmptyDashboard: React.FC<{
  onSetup?: () => void;
  className?: string;
}> = ({ onSetup, className }) => {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Bem-vindo ao Tracky!"
      description="Configure suas integrações e comece a importar pedidos para ver suas métricas e análises aqui."
      actionLabel="Começar Configuração"
      onAction={onSetup}
      secondaryActionLabel="Ver Tutorial"
      className={className}
    />
  );
};

/**
 * Empty state para relatórios sem dados
 */
export const EmptyReports: React.FC<{
  onGenerate?: () => void;
  className?: string;
}> = ({ onGenerate, className }) => {
  return (
    <EmptyState
      icon={FileText}
      title="Nenhum relatório disponível"
      description="Gere relatórios personalizados com dados de seus pedidos e rastreamentos."
      actionLabel="Gerar Relatório"
      onAction={onGenerate}
      className={className}
    />
  );
};

/**
 * Empty state genérico para listas vazias
 */
export const EmptyList: React.FC<{
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}> = ({
  title = 'Lista vazia',
  description = 'Não há itens para exibir no momento.',
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <EmptyState
      icon={FileText}
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      className={className}
    />
  );
};

/**
 * Empty state para configurações incompletas
 */
export const EmptySettings: React.FC<{
  onConfigure?: () => void;
  className?: string;
}> = ({ onConfigure, className }) => {
  return (
    <EmptyState
      icon={Settings}
      title="Configuração pendente"
      description="Complete as configurações necessárias para começar a usar este recurso."
      actionLabel="Configurar Agora"
      onAction={onConfigure}
      className={className}
    />
  );
};

/**
 * Empty state inline (versão compacta)
 */
export const EmptyStateInline: React.FC<{
  message: string;
  icon?: LucideIcon;
  className?: string;
}> = ({ message, icon: Icon = Package, className }) => {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center',
        className
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

export default EmptyState;
