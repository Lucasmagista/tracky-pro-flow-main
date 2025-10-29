# 📝 Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não Lançado]

### 🚀 Adicionado - 2.0.0

- Integração com Mercado Livre API
- Suporte para rastreamento de múltiplas transportadoras
- Dashboard de analytics avançado

### 🔄 Modificado

- Interface do usuário modernizada
- Performance otimizada em 40%

### 🐛 Corrigido

- Bug no cálculo de frete
- Problema de sincronização com Nuvemshop

## [2.0.0] - 2024-10-29

### 🚀 Adicionado

- **Nova UI**: Interface completamente redesenhada com shadcn/ui
- **Dashboard Analítico**: Métricas em tempo real e KPIs personalizados
- **Integração Smartenvios**: Cotação automática de frete
- **Notificações WhatsApp**: Via WPPConnect para mensagens automáticas
- **Importação em Massa**: Upload de pedidos via CSV/Excel
- **PWA Support**: Aplicativo instalável com suporte offline
- **Multi-idioma**: Suporte inicial para PT-BR e EN
- **Webhooks**: Sistema de webhooks para integrações
- **Rate Limiting**: Proteção contra abuso de API
- **Sentry Integration**: Monitoramento de erros em produção

### 🔄 Modificado

- **Stack Atualizada**: Migração para React 18 e TypeScript 5
- **Build Tool**: Migrado de Webpack para Vite 5
- **Database**: Migrado para Supabase PostgreSQL
- **Autenticação**: Sistema de auth redesenhado com JWT
- **Performance**: Lazy loading e code splitting implementados
- **UI Components**: Migrados para componentes Radix UI
- **Estado Global**: Implementado TanStack Query para cache

### 🐛 Corrigido

- Problema de timeout em requisições longas
- Bug de sincronização com marketplaces
- Erro de validação em formulários
- Memory leak no componente de notificações
- Problema de CORS em produção

### 🔒 Segurança

- Implementado Content Security Policy (CSP)
- Rate limiting em endpoints críticos
- Sanitização de inputs do usuário
- Atualização de dependências com vulnerabilidades
- Row Level Security (RLS) no Supabase

### 💥 Breaking Changes

- **Node.js**: Versão mínima agora é 20.x
- **API**: Endpoints de v1 descontinuados
- **Database**: Schema completamente redesenhado
- **Auth**: Tokens antigos não são mais válidos

### 🗑️ Removido

- Suporte para Node.js < 20
- API v1 (descontinuada)
- Bootstrap (substituído por Tailwind CSS)

## [1.9.0] - 2024-08-15

### 🚀 Adicionado

- Integração com Correios API
- Filtros avançados no dashboard
- Exportação de relatórios em PDF

### 🔄 Modificado

- Melhorias na UX do formulário de pedidos
- Otimização de queries no banco de dados

### 🐛 Corrigido

- Bug no cálculo de prazo de entrega
- Problema de paginação na listagem

## [1.8.0] - 2024-06-20

### 🚀 Adicionado

- Sistema de notificações por email
- Rastreamento de eventos customizados
- API pública para integrações

### 🔄 Modificado

- Interface de configurações redesenhada
- Performance melhorada em 25%

### 🐛 Corrigido

- Bug na edição de pedidos
- Problema de cache em desenvolvimento

## [1.7.0] - 2024-04-10

### 🚀 Adicionado

- Integração com Nuvemshop
- Dashboard básico de métricas
- Sistema de templates de notificações

### 🔄 Modificado

- Migração para TypeScript
- Atualização do React para v18

## [1.0.0] - 2024-01-15

### 🚀 Lançamento Inicial - 1.0.0

- Sistema básico de rastreamento
- Cadastro e gestão de pedidos
- Integração com WooCommerce
- Notificações por email
- Dashboard simples

---

## 🔗 Links de Comparação

- [Não Lançado](https://github.com/seu-usuario/tracky-pro-flow/compare/v2.0.0...HEAD)
- [2.0.0](https://github.com/seu-usuario/tracky-pro-flow/compare/v1.9.0...v2.0.0)
- [1.9.0](https://github.com/seu-usuario/tracky-pro-flow/compare/v1.8.0...v1.9.0)
- [1.8.0](https://github.com/seu-usuario/tracky-pro-flow/compare/v1.7.0...v1.8.0)
- [1.7.0](https://github.com/seu-usuario/tracky-pro-flow/compare/v1.0.0...v1.7.0)
- [1.0.0](https://github.com/seu-usuario/tracky-pro-flow/releases/tag/v1.0.0)

## 📋 Tipos de Mudanças

- `🚀 Adicionado` para novas funcionalidades
- `🔄 Modificado` para mudanças em funcionalidades existentes
- `🗑️ Removido` para funcionalidades removidas
- `🐛 Corrigido` para correções de bugs
- `🔒 Segurança` para correções de vulnerabilidades
- `💥 Breaking Changes` para mudanças que quebram compatibilidade

---

**Nota**: Este projeto segue [Versionamento Semântico](https://semver.org/lang/pt-BR/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): Novas funcionalidades (backward compatible)
- **PATCH** (0.0.X): Bug fixes e pequenas melhorias