# 🔍 Configuração do Sentry - Error Tracking

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Usar](#como-usar)
- [Recursos Implementados](#recursos-implementados)
- [Boas Práticas](#boas-práticas)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

O Sentry está integrado no Tracky Pro Flow para:

- **Error Tracking**: Captura e rastreia erros em produção
- **Performance Monitoring**: Monitora performance da aplicação
- **Session Replay**: Grava sessões de usuários (quando ocorre erro)
- **Release Tracking**: Acompanha erros por versão
- **User Context**: Associa erros a usuários específicos

---

## 📦 Instalação

O Sentry já está instalado no projeto:

```bash
# Já incluído no package.json
@sentry/react: ^10.22.0
```

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione ao arquivo `.env`:

```bash
# Sentry DSN (obtenha em sentry.io)
VITE_SENTRY_DSN=https://seu-dsn@o123456.ingest.sentry.io/987654

# Ambiente (development, staging, production)
VITE_SENTRY_ENVIRONMENT=production

# Versão da aplicação (opcional)
VITE_APP_VERSION=1.0.0
```

### 2. Obter DSN do Sentry

1. Acesse [sentry.io](https://sentry.io/)
2. Crie uma conta ou faça login
3. Crie um novo projeto (React)
4. Copie o DSN fornecido
5. Cole no `.env`

### 3. Inicialização

O Sentry é inicializado automaticamente em `src/main.tsx`:

```typescript
import { initSentry } from '@/lib/sentry';

// Inicializar antes do React
initSentry();

// Resto da inicialização...
```

---

## 🚀 Como Usar

### 1. Error Boundary

Envolva componentes críticos com ErrorBoundary:

```tsx
import { SentryErrorBoundary } from '@/lib/sentry';

function App() {
  return (
    <SentryErrorBoundary
      fallback={({ error }) => (
        <div>
          <h1>Ops! Algo deu errado</h1>
          <p>{error.message}</p>
        </div>
      )}
    >
      <YourComponent />
    </SentryErrorBoundary>
  );
}
```

### 2. Capturar Exceções Manualmente

```typescript
import { captureException } from '@/lib/sentry';

try {
  // Código que pode falhar
  await riskyOperation();
} catch (error) {
  captureException(error as Error, {
    operation: 'riskyOperation',
    userId: user.id,
  });
}
```

### 3. Capturar Mensagens

```typescript
import { captureMessage } from '@/lib/sentry';

// Mensagem informativa
captureMessage('Operação concluída com sucesso', 'info');

// Aviso
captureMessage('Cache expirado, renovando...', 'warning');

// Erro
captureMessage('Falha na sincronização', 'error');
```

### 4. Contexto de Usuário

```typescript
import { setUser, clearUser } from '@/lib/sentry';

// Ao fazer login
function handleLogin(user) {
  setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
}

// Ao fazer logout
function handleLogout() {
  clearUser();
}
```

### 5. Breadcrumbs (Rastro de Eventos)

```typescript
import { addBreadcrumb } from '@/lib/sentry';

// Adicionar evento importante
addBreadcrumb(
  'Pedido criado',
  'order',
  'info',
  { orderId: '12345', value: 100.50 }
);
```

### 6. Tags Customizadas

```typescript
import { setTag } from '@/lib/sentry';

// Adicionar tags para filtrar erros
setTag('feature', 'checkout');
setTag('plan', 'premium');
setTag('region', 'BR');
```

### 7. Contexto Adicional

```typescript
import { setContext } from '@/lib/sentry';

// Adicionar contexto rico
setContext('order', {
  id: '12345',
  total: 100.50,
  items: 3,
  status: 'pending',
});
```

### 8. Performance Monitoring

```typescript
import { startTransaction } from '@/lib/sentry';

async function loadDashboard() {
  const transaction = startTransaction('load-dashboard', 'http');
  
  try {
    await fetchData();
  } finally {
    transaction?.finish();
  }
}
```

### 9. Profiler para Componentes React

```tsx
import { SentryProfiler } from '@/lib/sentry';

function Dashboard() {
  return (
    <SentryProfiler name="Dashboard">
      <YourComponent />
    </SentryProfiler>
  );
}
```

### 10. HOC com Profiler

```tsx
import { withSentryProfiler } from '@/lib/sentry';

const MyComponent = () => {
  return <div>Conteúdo</div>;
};

export default withSentryProfiler(MyComponent);
```

---

## 🎁 Recursos Implementados

### ✅ Filtros Inteligentes

O Sentry está configurado para **não** enviar:

- ❌ Erros de extensões do navegador
- ❌ Erros de rede comuns (NetworkError, Failed to fetch)
- ❌ Console.logs normais
- ❌ Erros de scripts de terceiros

### ✅ Privacidade

- **URLs mascaradas**: Tokens e códigos sensíveis são ocultados
- **Texto mascarado**: Session Replay oculta todo texto
- **Mídia bloqueada**: Imagens e vídeos não são gravados

### ✅ Performance

- **Sample Rate**: 10% em produção, 100% em desenvolvimento
- **Replay Rate**: 1% em produção, 10% em desenvolvimento
- **Replay em Erro**: 100% (sempre grava quando há erro)

### ✅ Integrações

- **React Router**: Rastreia navegação automática
- **React Error Boundary**: Captura erros de renderização
- **Performance API**: Monitora tempo de carregamento

---

## 📚 Boas Práticas

### 1. Use ErrorBoundary em Componentes Críticos

```tsx
// ✅ Bom
<SentryErrorBoundary fallback={<ErrorPage />}>
  <CriticalFeature />
</SentryErrorBoundary>

// ❌ Evite
<CriticalFeature /> // Sem proteção
```

### 2. Adicione Contexto aos Erros

```typescript
// ✅ Bom
captureException(error, {
  operation: 'createOrder',
  orderId: order.id,
  userId: user.id,
});

// ❌ Evite
captureException(error); // Sem contexto
```

### 3. Use Breadcrumbs para Rastrear Fluxo

```typescript
// ✅ Bom
addBreadcrumb('Iniciando checkout', 'flow', 'info');
addBreadcrumb('Validando cartão', 'flow', 'info');
addBreadcrumb('Processando pagamento', 'flow', 'info');
// Se der erro, você verá todo o fluxo

// ❌ Evite
// Sem breadcrumbs, difícil entender o que aconteceu
```

### 4. Configure Usuário Sempre

```typescript
// ✅ Bom
useEffect(() => {
  if (user) {
    setUser({ id: user.id, email: user.email });
  }
}, [user]);

// ❌ Evite
// Sem usuário, difícil identificar quem teve o erro
```

### 5. Use Tags para Organizar

```typescript
// ✅ Bom
setTag('feature', 'analytics');
setTag('component', 'Dashboard');

// Facilita filtrar erros no Sentry
```

### 6. Trate Erros Assíncronos

```typescript
// ✅ Bom
async function loadData() {
  try {
    await fetchData();
  } catch (error) {
    captureException(error as Error);
    throw error; // Re-throw se necessário
  }
}

// ❌ Evite
async function loadData() {
  await fetchData(); // Erro não capturado
}
```

---

## 🔧 Troubleshooting

### Sentry não está capturando erros

**Problema**: Erros não aparecem no dashboard do Sentry

**Soluções**:

1. Verifique se o DSN está configurado:
   ```bash
   echo $VITE_SENTRY_DSN
   ```

2. Verifique se o Sentry foi inicializado:
   ```typescript
   // Deve aparecer no console
   "✅ Sentry inicializado (production)"
   ```

3. Verifique se está em produção:
   ```typescript
   // Sentry só envia erros se DSN estiver configurado
   // Em dev sem DSN, os erros aparecem apenas no console
   ```

### Muitos erros sendo enviados

**Problema**: Sentry está enviando muitos erros e consumindo quota

**Soluções**:

1. Ajuste o sample rate em `src/lib/sentry.ts`:
   ```typescript
   tracesSampleRate: 0.05, // 5%
   ```

2. Adicione mais filtros em `ignoreErrors`:
   ```typescript
   ignoreErrors: [
     'Seu erro específico',
     /Padrão de erro/,
   ],
   ```

### Session Replay não funciona

**Problema**: Replays não aparecem no Sentry

**Soluções**:

1. Verifique se está habilitado:
   ```typescript
   replaysSessionSampleRate: 0.1, // 10%
   replaysOnErrorSampleRate: 1.0, // 100% em erros
   ```

2. Force um erro para testar (sempre grava em erros)

### Dados sensíveis nos erros

**Problema**: Tokens ou senhas aparecem nos erros

**Soluções**:

1. Use o filtro `beforeSend`:
   ```typescript
   beforeSend(event) {
     // Remover dados sensíveis
     if (event.request?.headers) {
       delete event.request.headers.Authorization;
     }
     return event;
   }
   ```

2. Use `maskSensitiveUrl` (já implementado)

---

## 📊 Métricas Recomendadas

### Alertas Importantes

Configure alertas no Sentry para:

1. **Error Rate**: > 5 erros/minuto
2. **New Issues**: Novo tipo de erro detectado
3. **Regression**: Erro que voltou a acontecer
4. **Performance**: LCP > 2.5s ou FID > 100ms

### Dashboards

Crie dashboards para monitorar:

1. **Error Rate por Feature**: Identificar áreas problemáticas
2. **Error Rate por Usuário**: Identificar usuários afetados
3. **Performance por Rota**: Otimizar páginas lentas
4. **Session Replay**: Ver comportamento real dos usuários

---

## 🎓 Recursos Adicionais

- [Documentação Oficial](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Best Practices](https://docs.sentry.io/platforms/javascript/guides/react/best-practices/)
- [Performance Monitoring](https://docs.sentry.io/platforms/javascript/guides/react/performance/)
- [Session Replay](https://docs.sentry.io/platforms/javascript/guides/react/session-replay/)

---

## ✅ Checklist de Implementação

- [x] Sentry instalado e configurado
- [x] DSN configurado em `.env`
- [x] Inicialização em `main.tsx`
- [x] Error Boundaries implementados
- [x] Filtros de privacidade configurados
- [x] React Router integration
- [x] Performance monitoring
- [x] Session Replay (opcional)
- [ ] Alertas configurados no Sentry.io
- [ ] Dashboard customizado criado

---

**Última atualização**: 27 de outubro de 2025
**Versão**: 1.0.0
