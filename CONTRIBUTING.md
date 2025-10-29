# 🤝 Guia de Contribuição

Obrigado por considerar contribuir para o Tracky Pro Flow! 🎉

## 📋 Índice

- [Código de Conduta](#-código-de-conduta)
- [Como Posso Contribuir?](#-como-posso-contribuir)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [Processo de Desenvolvimento](#-processo-de-desenvolvimento)
- [Padrões de Código](#-padrões-de-código)
- [Commits e Pull Requests](#-commits-e-pull-requests)
- [Reportando Bugs](#-reportando-bugs)
- [Sugerindo Melhorias](#sugerindo-melhorias)

## 📜 Código de Conduta

Este projeto segue o [Código de Conduta](CODE_OF_CONDUCT.md). Ao participar, espera-se que você o respeite.

## 🎯 Como Posso Contribuir?

### 🐛 Reportar Bugs

Encontrou um bug? Ajude-nos a melhorar:

1. Verifique se o bug já foi reportado nas [Issues](https://github.com/seu-usuario/tracky-pro-flow/issues)
2. Se não encontrar, [abra uma nova issue](https://github.com/seu-usuario/tracky-pro-flow/issues/new?template=bug_report.md)
3. Use o template de bug report
4. Inclua o máximo de detalhes possível

### ✨ Sugerir Melhorias

Tem uma ideia para melhorar o projeto?

1. Verifique se a sugestão já existe nas [Issues](https://github.com/seu-usuario/tracky-pro-flow/issues)
2. [Abra uma feature request](https://github.com/seu-usuario/tracky-pro-flow/issues/new?template=feature_request.md)
3. Explique detalhadamente sua ideia
4. Descreva casos de uso e benefícios

### 💻 Contribuir com Código

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Faça suas alterações
4. Commit suas mudanças (`git commit -m 'feat: adiciona MinhaFeature'`)
5. Push para a branch (`git push origin feature/MinhaFeature`)
6. Abra um Pull Request

### 📚 Melhorar Documentação

Documentação é fundamental! Você pode:

- Corrigir erros de digitação
- Melhorar explicações
- Adicionar exemplos
- Traduzir para outros idiomas
- Criar tutoriais

## 🛠️ Configuração do Ambiente

### Pré-requisitos

- Node.js >= 20.0.0
- npm >= 10.0.0
- Git
- Conta no Supabase

### Setup Inicial

```powershell
# 1. Clone seu fork
git clone https://github.com/seu-usuario/tracky-pro-flow.git
cd tracky-pro-flow

# 2. Adicione o repositório original como upstream
git remote add upstream https://github.com/original/tracky-pro-flow.git

# 3. Instale as dependências
npm install

# 4. Copie o arquivo de ambiente
cp .env.example .env

# 5. Configure suas variáveis de ambiente
# Edite o arquivo .env com suas credenciais

# 6. Execute o projeto
npm run dev
```

### Verificação da Instalação

```powershell
# Execute os testes
npm run test

# Execute o linter
npm run lint

# Execute o type check
npm run type-check
```

## 🔄 Processo de Desenvolvimento

### Workflow Git

```powershell
# 1. Atualize sua branch main
git checkout main
git pull upstream main

# 2. Crie uma nova branch
git checkout -b feature/minha-feature

# 3. Faça suas alterações e commits
git add .
git commit -m "feat: descrição da feature"

# 4. Mantenha sua branch atualizada
git fetch upstream
git rebase upstream/main

# 5. Push para seu fork
git push origin feature/minha-feature

# 6. Abra um Pull Request no GitHub
```

### Sincronizando com Upstream

```powershell
# Buscar mudanças do upstream
git fetch upstream

# Mesclar mudanças na sua main local
git checkout main
git merge upstream/main

# Push para seu fork
git push origin main
```

## 📝 Padrões de Código

### TypeScript

- Use TypeScript para todo código novo
- Defina tipos explícitos sempre que possível
- Evite usar `any`
- Use interfaces para objetos complexos

```typescript
// ✅ Bom
interface Order {
  id: string;
  status: OrderStatus;
  createdAt: Date;
}

// ❌ Evite
const order: any = { ... };
```

### React Components

- Use functional components com hooks
- Componentes pequenos e reutilizáveis
- Props bem tipadas
- Nomeie componentes com PascalCase

```typescript
// ✅ Bom
interface OrderCardProps {
  order: Order;
  onUpdate: (id: string) => void;
}

export function OrderCard({ order, onUpdate }: OrderCardProps) {
  return <div>{/* ... */}</div>;
}
```

### Estilo e Formatação

- Use Prettier para formatação automática
- Use ESLint para linting
- Siga as regras configuradas no projeto

```powershell
# Formatar código
npm run format

# Verificar linting
npm run lint

# Corrigir problemas automaticamente
npm run lint:fix
```

### Naming Conventions

```typescript
// Arquivos
OrderCard.tsx          // Componentes
useOrders.ts           // Hooks
orderService.ts        // Services
order.types.ts         // Types

// Variáveis
const userName = "...";        // camelCase
const MAX_RETRIES = 3;         // UPPER_CASE para constantes
const API_BASE_URL = "...";    // UPPER_CASE para configs

// Funções
function calculateTotal() {}   // camelCase
function handleSubmit() {}     // handle* para event handlers

// Componentes
function OrderList() {}        // PascalCase

// Tipos/Interfaces
interface UserProfile {}       // PascalCase
type OrderStatus = "...";      // PascalCase
```

## 📨 Commits e Pull Requests

### Conventional Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```text
<tipo>[escopo opcional]: <descrição>

[corpo opcional]

[rodapé(s) opcional(is)]
```

#### Tipos de Commit

- `feat`: Nova feature
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação, ponto e vírgula, etc
- `refactor`: Refatoração de código
- `perf`: Melhorias de performance
- `test`: Adição ou correção de testes
- `chore`: Tarefas de build, configs, etc
- `ci`: Mudanças em CI/CD
- `revert`: Reverter commit anterior

#### Exemplos

```bash
# Feature
git commit -m "feat: adiciona integração com Mercado Livre"
git commit -m "feat(api): adiciona endpoint de rastreamento"

# Bug fix
git commit -m "fix: corrige cálculo de frete"
git commit -m "fix(auth): resolve problema de logout"

# Documentação
git commit -m "docs: atualiza guia de instalação"

# Refatoração
git commit -m "refactor: simplifica lógica de notificações"

# Teste
git commit -m "test: adiciona testes para OrderService"

# Breaking change
git commit -m "feat!: remove suporte ao Node 18"
```

### Pull Request Guidelines

#### Checklist do PR

- [ ] Código segue os padrões do projeto
- [ ] Testes adicionados/atualizados
- [ ] Documentação atualizada
- [ ] Commits seguem Conventional Commits
- [ ] Build passa sem erros
- [ ] Lint passa sem warnings
- [ ] Type check passa
- [ ] PR tem descrição clara

#### Template do PR

```markdown
## 📝 Descrição

Breve descrição das mudanças.

## 🎯 Tipo de Mudança

- [ ] 🐛 Bug fix
- [ ] ✨ Nova feature
- [ ] 💥 Breaking change
- [ ] 📝 Documentação
- [ ] 🎨 Refatoração

## 🧪 Como Testar

Passos para testar as mudanças:

1. ...
2. ...

## 📸 Screenshots (se aplicável)

Adicione screenshots mostrando as mudanças visuais.

## ✅ Checklist

- [ ] Código testado localmente
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Sem conflitos com main
```

## 🐛 Reportando Bugs

### Template de Bug Report

```markdown
## 🐛 Descrição do Bug

Descrição clara e concisa do bug.

## 🔄 Passos para Reproduzir

1. Vá para '...'
2. Clique em '...'
3. Role até '...'
4. Veja o erro

## ✅ Comportamento Esperado

O que deveria acontecer.

## ❌ Comportamento Atual

O que está acontecendo.

## 📸 Screenshots

Se aplicável, adicione screenshots.

## 💻 Ambiente

- OS: [ex: Windows 11]
- Browser: [ex: Chrome 118]
- Node Version: [ex: 20.9.0]
- Versão do Tracky: [ex: 2.0.0]

## 📋 Logs/Erros

```text
Cole aqui mensagens de erro ou logs relevantes
```

## 🔍 Contexto Adicional

Qualquer outra informação relevante.
```

## ✨ Sugerindo Melhorias

### Template de Feature Request

```markdown
## 🚀 Feature Request

### 📝 Descrição

Descrição clara da feature sugerida.

### 💡 Motivação

Por que essa feature é útil? Qual problema ela resolve?

### 📋 Proposta de Solução

Como você imagina que essa feature funcionaria?

### 🔄 Alternativas Consideradas

Outras soluções que você considerou?

### 📸 Mockups/Exemplos

Se aplicável, adicione mockups ou exemplos visuais.

### 🎯 Contexto Adicional

Qualquer outra informação relevante.
```

## 🧪 Testes

### Executando Testes

```powershell
# Todos os testes
npm run test

# Testes com coverage
npm run test:coverage

# Testes em modo watch
npm run test:watch

# Testes E2E
npm run test:e2e
```

### Escrevendo Testes

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderCard } from './OrderCard';

describe('OrderCard', () => {
  it('should render order information', () => {
    const order = {
      id: '123',
      status: 'delivered',
      createdAt: new Date()
    };

    render(<OrderCard order={order} />);

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
  });

  it('should call onUpdate when button is clicked', () => {
    const onUpdate = vi.fn();
    const order = { id: '123', status: 'pending' };

    render(<OrderCard order={order} onUpdate={onUpdate} />);

    screen.getByRole('button', { name: /update/i }).click();

    expect(onUpdate).toHaveBeenCalledWith('123');
  });
});
```

## 📚 Recursos Úteis

- [Documentação do React](https://react.dev)
- [Documentação do TypeScript](https://www.typescriptlang.org/docs)
- [Documentação do Supabase](https://supabase.com/docs)
- [Guia do Conventional Commits](https://www.conventionalcommits.org)
- [Como escrever um bom commit](https://chris.beams.io/posts/git-commit/)

## 💬 Comunidade

- **GitHub Discussions**: [Link para Discussions]
- **Discord**: [Link para Discord]
- **Twitter**: [@trackyflow]

## 🏆 Contribuidores

Agradecemos a todos os contribuidores!

[![Contributors](https://contrib.rocks/image?repo=seu-usuario/tracky-pro-flow)](https://github.com/seu-usuario/tracky-pro-flow/graphs/contributors)

## ❓ Dúvidas?

Se tiver dúvidas sobre como contribuir:

1. Verifique a [Documentação](./docs/README.md)
2. Procure em [Issues](https://github.com/seu-usuario/tracky-pro-flow/issues) existentes
3. Pergunte no [Discord](https://discord.gg/tracky) ou [Discussions](https://github.com/seu-usuario/tracky-pro-flow/discussions)

---

## Obrigado por contribuir! Juntos, tornamos o Tracky Pro Flow melhor! 🚀