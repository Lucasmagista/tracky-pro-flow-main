# 🤝 Guia de Contribuição - Tracky Pro Flow

Obrigado por considerar contribuir para o Tracky Pro Flow! Este guia fornece informações sobre como contribuir efetivamente para o projeto.

## 📋 Índice

- [Código de Conduta](#-código-de-conduta)
- [Como Posso Contribuir?](#-como-posso-contribuir)
- [Seu Primeiro Código](#-seu-primeiro-código)
- [Processo de Pull Request](#-processo-de-pull-request)
- [Padrões de Código](#-padrões-de-código)
- [Commits Semânticos](#-commits-semânticos)
- [Testes](#-testes)
- [Documentação](#-documentação)

---

## 📜 Código de Conduta

Este projeto adota um Código de Conduta que esperamos que todos os participantes sigam. Por favor, leia [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) para entender que ações serão e não serão toleradas.

### Resumo

- Seja respeitoso e inclusivo
- Aceite críticas construtivas
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros

---

## 🚀 Como Posso Contribuir?

### Reportando Bugs

Antes de criar um relatório de bug, verifique se o problema já não foi reportado. Se encontrar um issue existente, adicione comentários adicionais se tiver mais informações.

**Ao criar um bug report, inclua:**

- Título claro e descritivo
- Passos detalhados para reproduzir
- Comportamento esperado vs atual
- Screenshots (se aplicável)
- Ambiente (OS, Browser, Node version)
- Logs de erro (se disponível)

**Template de Bug Report:**

```markdown
**Descrição**
Uma descrição clara do bug.

**Para Reproduzir**
1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

**Comportamento Esperado**
O que você esperava que acontecesse.

**Screenshots**
Se aplicável, adicione screenshots.

**Ambiente:**
- OS: [e.g., Windows 11]
- Browser: [e.g., Chrome 120]
- Node: [e.g., 20.10.0]
- Version: [e.g., 2.0.0]

**Informações Adicionais**
Qualquer outro contexto sobre o problema.
```

### Sugerindo Melhorias

Sugestões de melhorias são bem-vindas! Siga este formato:

**Template de Feature Request:**

```markdown
**A feature resolve um problema? Descreva.**
Ex: Sempre me frustro quando [...]

**Descreva a solução que você gostaria**
Uma descrição clara do que você quer que aconteça.

**Descreva alternativas consideradas**
Outras soluções ou features que você considerou.

**Contexto Adicional**
Screenshots, mockups, ou exemplos.
```

### Sua Primeira Contribuição de Código

Não sabe por onde começar? Procure por issues com estas labels:

- `good-first-issue` - Issues simples para começar
- `help-wanted` - Issues que precisam de ajuda
- `documentation` - Melhorias na documentação
- `bug` - Correções de bugs

---

## 💻 Seu Primeiro Código

### 1. Fork e Clone

```bash
# Fork no GitHub primeiro, depois:
git clone https://github.com/seu-usuario/tracky-pro-flow.git
cd tracky-pro-flow
```

### 2. Configure o Upstream

```bash
git remote add upstream https://github.com/original/tracky-pro-flow.git
git fetch upstream
```

### 3. Crie uma Branch

```bash
# Para features
git checkout -b feature/nome-da-feature

# Para correções
git checkout -b fix/nome-do-bug

# Para documentação
git checkout -b docs/descricao
```

### 4. Instale Dependências

```bash
npm install
```

### 5. Configure Ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 6. Faça Suas Alterações

Siga os [Padrões de Código](#-padrões-de-código) abaixo.

### 7. Execute Testes

```bash
npm run test
npm run lint
npm run type-check
```

### 8. Commit

Siga os padrões de [Commits Semânticos](#-commits-semânticos).

### 9. Push

```bash
git push origin feature/nome-da-feature
```

### 10. Abra Pull Request

No GitHub, abra um PR para o branch `develop`.

---

## 🔄 Processo de Pull Request

### Antes de Submeter

- [ ] Código segue os padrões do projeto
- [ ] Comentários adicionados em código complexo
- [ ] Documentação atualizada (README, JSDoc)
- [ ] Testes adicionados/atualizados
- [ ] Todos os testes passam
- [ ] Lint passa sem erros
- [ ] Type check passa
- [ ] Build funciona corretamente

### Template de Pull Request

```markdown
## Descrição
Breve descrição das mudanças.

## Tipo de Mudança
- [ ] Bug fix (mudança que corrige um issue)
- [ ] Nova feature (mudança que adiciona funcionalidade)
- [ ] Breaking change (mudança que quebra compatibilidade)
- [ ] Documentação
- [ ] Refatoração
- [ ] Performance
- [ ] Testes

## Como Testar?
Passos para testar suas mudanças:
1. ...
2. ...

## Screenshots (se aplicável)

## Checklist
- [ ] Meu código segue os padrões do projeto
- [ ] Revisei meu próprio código
- [ ] Comentei código complexo
- [ ] Atualizei a documentação
- [ ] Não há novos warnings
- [ ] Adicionei testes
- [ ] Testes passam localmente
- [ ] Mudanças dependentes foram mergeadas

## Issues Relacionados
Closes #123
Related to #456
```

### Processo de Revisão

1. **Automatic Checks** - CI/CD roda automaticamente
2. **Code Review** - Pelo menos 1 aprovação necessária
3. **Changes Requested** - Faça as mudanças solicitadas
4. **Approved** - PR é mergeado para `develop`

### Dicas para Revisão Rápida

- Mantenha PRs pequenos e focados
- Uma feature/bug por PR
- Responda comentários rapidamente
- Seja receptivo a feedback

---

## 📏 Padrões de Código

### TypeScript

```typescript
// ✅ BOM
interface User {
  id: string;
  name: string;
  email: string;
}

function getUserById(id: string): Promise<User | null> {
  // ...
}

// ❌ RUIM
function getUser(id: any): any {
  // ...
}
```

### Nomenclatura

**Arquivos:**

- Componentes: `PascalCase.tsx` (ex: `OrderTable.tsx`)
- Hooks: `camelCase.ts` (ex: `useOrders.ts`)
- Utils: `camelCase.ts` (ex: `formatDate.ts`)
- Types: `camelCase.types.ts` (ex: `order.types.ts`)

**Código:**

```typescript
// Componentes - PascalCase
const OrderTable: React.FC = () => {};

// Hooks - camelCase com 'use'
const useOrders = () => {};

// Functions - camelCase
const formatDate = (date: Date) => {};

// Constants - UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';

// Types/Interfaces - PascalCase
interface OrderType {}
type OrderStatus = 'pending' | 'shipped';
```

### Estrutura de Componentes

```typescript
// 1. Imports
import React from 'react';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';

// 2. Types
interface OrderTableProps {
  userId: string;
  onOrderClick?: (orderId: string) => void;
}

// 3. Componente
export const OrderTable: React.FC<OrderTableProps> = ({ 
  userId, 
  onOrderClick 
}) => {
  // 3.1 Hooks
  const { orders, isLoading } = useOrders(userId);
  
  // 3.2 Handlers
  const handleOrderClick = (orderId: string) => {
    onOrderClick?.(orderId);
  };
  
  // 3.3 Early returns
  if (isLoading) {
    return <div>Carregando...</div>;
  }
  
  // 3.4 Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
};
```

### ESLint

Siga as regras configuradas. Para verificar:

```bash
npm run lint
npm run lint:fix  # Para corrigir automaticamente
```

### Prettier

Código é formatado automaticamente:

```bash
npm run format
```

### Imports

Organize imports nesta ordem:

```typescript
// 1. React
import React, { useState, useEffect } from 'react';

// 2. Bibliotecas externas
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Componentes internos
import { Button } from '@/components/ui/button';
import { useOrders } from '@/hooks/useOrders';

// 4. Utils e services
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/utils/date';

// 5. Types
import type { Order } from '@/types/order';

// 6. Estilos (se houver)
import styles from './OrderTable.module.css';
```

---

## 📝 Commits Semânticos

Use [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<tipo>(<escopo>): <descrição>

[corpo opcional]

[rodapé opcional]
```

### Tipos

- `feat`: Nova feature
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (não afeta lógica)
- `refactor`: Refatoração
- `perf`: Performance
- `test`: Testes
- `chore`: Tarefas gerais
- `ci`: CI/CD
- `build`: Build system

### Exemplos

```bash
# Feature
git commit -m "feat(orders): adiciona filtro por data"

# Bug fix
git commit -m "fix(tracking): corrige detecção de transportadora"

# Documentação
git commit -m "docs(readme): atualiza guia de instalação"

# Refatoração
git commit -m "refactor(services): simplifica lógica de rastreamento"

# Performance
git commit -m "perf(dashboard): otimiza queries de métricas"

# Breaking change
git commit -m "feat(auth)!: migra para novo sistema de autenticação

BREAKING CHANGE: API de autenticação mudou completamente"
```

### Escopo

Use escopos para indicar a área afetada:

- `orders` - Pedidos
- `tracking` - Rastreamento
- `integrations` - Integrações
- `notifications` - Notificações
- `dashboard` - Dashboard
- `auth` - Autenticação
- `ui` - Interface
- `api` - API

---

## 🧪 Testes

### Estrutura

```
src/
├── components/
│   ├── OrderTable.tsx
│   └── __tests__/
│       └── OrderTable.test.tsx
├── hooks/
│   ├── useOrders.ts
│   └── __tests__/
│       └── useOrders.test.ts
└── services/
    ├── tracking.service.ts
    └── __tests__/
        └── tracking.service.test.ts
```

### Executar Testes

```bash
# Todos os testes
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# UI interativa
npm run test:ui
```

### Escrevendo Testes

**Componente:**

```typescript
import { render, screen } from '@testing-library/react';
import { OrderTable } from '../OrderTable';

describe('OrderTable', () => {
  it('deve renderizar lista de pedidos', () => {
    render(<OrderTable userId="123" />);
    expect(screen.getByText('Pedidos')).toBeInTheDocument();
  });
  
  it('deve mostrar loading inicial', () => {
    render(<OrderTable userId="123" />);
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
  });
});
```

**Service:**

```typescript
import { trackingService } from '../tracking.service';

describe('trackingService', () => {
  it('deve detectar correios pelo código', () => {
    const carrier = trackingService.detectCarrier('BR123456789BR');
    expect(carrier).toBe('correios');
  });
});
```

### Cobertura Mínima

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

---

## 📚 Documentação

### JSDoc

Documente funções públicas:

```typescript
/**
 * Busca pedido por ID
 * 
 * @param orderId - ID do pedido
 * @returns Promise com dados do pedido ou null se não encontrado
 * @throws {Error} Se houver erro na requisição
 * 
 * @example
 * ```typescript
 * const order = await getOrderById('123');
 * if (order) {
 *   console.log(order.number);
 * }
 * ```
 */
export async function getOrderById(
  orderId: string
): Promise<Order | null> {
  // ...
}
```

### README

Ao adicionar features, atualize:

- Seção de características
- Documentação de uso
- Exemplos

### Changelog

Mudanças são automaticamente geradas dos commits semânticos.

---

## 🎯 Diretrizes Finais

### DO

- ✅ Escreva código limpo e legível
- ✅ Adicione testes para novas features
- ✅ Documente código complexo
- ✅ Mantenha PRs focados e pequenos
- ✅ Responda a code reviews rapidamente
- ✅ Atualize documentação
- ✅ Siga convenções do projeto

### DON'T

- ❌ Commite código não testado
- ❌ Ignore warnings do linter
- ❌ Faça commits direto na main
- ❌ PRs gigantes com muitas mudanças
- ❌ Código sem documentação
- ❌ Quebre a build
- ❌ Ignore feedback de revisão

---

## 💬 Precisa de Ajuda?

- **Dúvidas?** Abra uma [Discussion](https://github.com/usuario/tracky-pro-flow/discussions)
- **Bug?** Abra um [Issue](https://github.com/usuario/tracky-pro-flow/issues)
- **Chat?** Entre no nosso [Discord](https://discord.gg/tracky)

---

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma [MIT License](LICENSE) do projeto.

---

**Obrigado por contribuir! 🎉**

Sua ajuda torna o Tracky Pro Flow melhor para todos!
