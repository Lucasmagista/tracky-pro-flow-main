# 💻 Exemplos de Uso - Painel Admin

## Cenários Comuns de Uso

### 1. Visualizar Estatísticas do Sistema

**Objetivo:** Ver métricas gerais do sistema

**Passos:**
1. Acesse `/admin`
2. Visualize os 8 cards de estatísticas:
   - Total de usuários e ativos hoje
   - Receita do mês
   - Total de pedidos
   - Assinaturas ativas
   - Status do sistema
   - Integrações ativas
   - Saúde do banco
   - Erros do dia

**Resultado:** Visão geral completa do sistema em tempo real

---

### 2. Encontrar um Usuário Específico

**Objetivo:** Localizar e visualizar dados de um usuário

**Passos:**
1. Acesse `/admin/users`
2. Use a barra de busca: digite nome, email ou nome da loja
3. Clique no menu `⋯` da linha do usuário
4. Selecione "Ver Detalhes"
5. Navegue pelas abas: Informações, Assinatura, Atividades

**Resultado:** Visualização completa dos dados do usuário

---

### 3. Suspender Conta de Usuário

**Objetivo:** Suspender temporariamente um usuário problemático

**Passos:**
1. Vá em `/admin/users`
2. Encontre o usuário na tabela
3. Clique no menu `⋯` > "Suspender"
4. Confirme a ação

**Resultado:** Usuário suspenso com log registrado

---

### 4. Exportar Lista de Usuários

**Objetivo:** Gerar relatório de todos os usuários em CSV

**Passos:**
1. Acesse `/admin/users`
2. (Opcional) Aplique filtros desejados
3. Clique no botão "Exportar" no canto superior direito
4. Arquivo CSV será baixado automaticamente

**Resultado:** Arquivo `usuarios_YYYY-MM-DD.csv` com todos os dados

---

### 5. Investigar Erro no Sistema

**Objetivo:** Encontrar e analisar erros críticos

**Passos:**
1. Vá em `/admin/logs`
2. Na seção "Filtros Avançados":
   - Selecione Gravidade: "Crítico" ou "Erro"
3. (Opcional) Selecione tipo específico: "Erro"
4. Revise os logs filtrados
5. Clique em uma linha para ver detalhes completos

**Resultado:** Lista de erros para investigação

---

### 6. Monitorar Atividades de Usuário Suspeito

**Objetivo:** Rastrear ações de um usuário específico

**Passos:**
1. Acesse `/admin/users`
2. Encontre o usuário
3. Abra "Ver Detalhes"
4. Vá na aba "Atividades"
5. Analise o histórico completo

**Resultado:** Timeline de todas as ações do usuário

---

### 7. Encontrar Logins Fora de Horário

**Objetivo:** Detectar acessos suspeitos

**Passos:**
1. Vá em `/admin/logs`
2. Filtre por:
   - Tipo de Atividade: "Login"
   - Data Início: dia desejado às 00:00
   - Data Fim: dia desejado às 06:00 (madrugada)
3. Revise os resultados

**Resultado:** Lista de logins na madrugada

---

### 8. Conceder Permissões de Admin

**Objetivo:** Tornar um usuário administrador

**Via Interface (Em Desenvolvimento):**
1. `/admin/users` > Selecionar usuário > "Editar"
2. Marcar "É Admin"
3. Selecionar Role
4. Salvar

**Via SQL (Atual):**
```sql
UPDATE profiles 
SET 
  is_admin = true, 
  admin_role = 'admin', -- ou 'super_admin', 'moderator', 'support'
  admin_since = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'usuario@exemplo.com'
);
```

**Resultado:** Usuário com acesso admin

---

### 9. Revisar Ações Administrativas do Dia

**Objetivo:** Auditoria das ações dos admins

**Passos:**
1. Acesse `/admin/logs`
2. Filtre por:
   - Tipo de Atividade: "Ação Admin"
   - Data Início: Hoje às 00:00
   - Data Fim: Agora
3. Revise todas as ações

**Resultado:** Log completo de ações administrativas

---

### 10. Gerar Relatório de Novos Cadastros

**Objetivo:** Ver quem se cadastrou recentemente

**Passos:**
1. Vá em `/admin/users`
2. Observe o card "Novos (Hoje)"
3. Na tabela, ordene por "Cadastrado" (clique no cabeçalho)
4. Usuários mais recentes aparecerão primeiro

**Resultado:** Lista ordenada por data de cadastro

---

## Atalhos de Teclado (Planejados)

| Atalho | Ação |
|--------|------|
| `Ctrl/Cmd + K` | Busca global |
| `Ctrl/Cmd + U` | Ir para Usuários |
| `Ctrl/Cmd + L` | Ir para Logs |
| `Ctrl/Cmd + H` | Ir para Home (Dashboard) |

---

## Uso via AdminService (Código)

### Exemplo 1: Buscar Estatísticas

```typescript
import { AdminService } from '@/services/admin'

const stats = await AdminService.getSystemStats()
console.log(`Total de usuários: ${stats.total_users}`)
console.log(`Receita do mês: R$ ${stats.revenue_this_month}`)
```

### Exemplo 2: Listar Usuários com Filtro

```typescript
const { users, total } = await AdminService.getAllUsers(
  1, // página
  25, // itens por página
  'João', // busca
  {
    has_subscription: true,
    created_after: '2025-01-01'
  }
)
```

### Exemplo 3: Suspender Usuário

```typescript
await AdminService.suspendUser(
  'user-id-aqui',
  'Violação dos termos de uso'
)
```

### Exemplo 4: Buscar Logs com Filtros

```typescript
const { logs } = await AdminService.getAdminLogs(
  1, // página
  50, // limite
  {
    activity_type: 'error',
    severity: 'critical',
    date_from: '2025-01-01T00:00:00Z',
    date_to: '2025-01-27T23:59:59Z'
  }
)
```

### Exemplo 5: Verificar Feature Flag

```typescript
const isEnabled = await AdminService.isFeatureEnabled(
  'new_dashboard',
  'user-id'
)

if (isEnabled) {
  // Mostrar novo dashboard
}
```

### Exemplo 6: Atualizar Configuração

```typescript
await AdminService.updateSetting(
  'maintenance.enabled',
  true
)

// Ou múltiplas de uma vez
await AdminService.updateSettings({
  'maintenance.enabled': true,
  'maintenance.message': 'Manutenção programada'
})
```

---

## Boas Práticas

### ✅ Faça

- **Sempre** verifique os logs após uma ação crítica
- **Use filtros** para encontrar informações específicas
- **Exporte dados** regularmente para backup
- **Revise** atividades suspeitas diariamente
- **Documente** ações importantes no campo de notas

### ❌ Evite

- Remover usuários sem verificar histórico
- Ignorar erros críticos nos logs
- Dar permissões de super_admin sem necessidade
- Modificar configurações sem entender o impacto
- Suspender usuários sem motivo documentado

---

## Fluxos Completos

### Fluxo: Investigar Reclamação de Cliente

1. **Identificar usuário**
   - `/admin/users` > Buscar por email/nome
   - Ver detalhes completos

2. **Verificar assinatura**
   - Aba "Assinatura"
   - Conferir status e pagamentos

3. **Revisar atividades**
   - Aba "Atividades"
   - Buscar ações relacionadas ao problema

4. **Verificar logs do sistema**
   - `/admin/logs`
   - Filtrar por user_id e período

5. **Tomar ação**
   - Ajustar dados se necessário
   - Registrar no sistema
   - Responder cliente

### Fluxo: Onboarding de Novo Admin

1. **Criar conta normal** (ou usar existente)
2. **Conceder permissões** via SQL ou interface
3. **Verificar acesso** em `/admin`
4. **Treinar** nas funcionalidades:
   - Dashboard: visão geral
   - Usuários: gerenciamento
   - Logs: auditoria
5. **Documentar** no campo de notas as permissões

### Fluxo: Análise de Segurança Semanal

1. **Revisar erros críticos**
   - `/admin/logs`
   - Filtro: Severidade = Crítico
   - Período: Última semana

2. **Verificar tentativas de login**
   - Filtro: Tipo = Login
   - Analisar IPs suspeitos

3. **Auditar ações de admins**
   - Filtro: Tipo = Ação Admin
   - Revisar todas as ações

4. **Exportar relatório**
   - Botão Exportar
   - Arquivar CSV

5. **Documentar findings**
   - Criar notificação se necessário
   - Ajustar configurações de segurança

---

## Perguntas Frequentes (FAQ)

**P: Como sei se um usuário está ativo?**
R: Veja o card "Ativos Hoje" no dashboard ou o campo "Último Login" nos detalhes do usuário.

**P: Posso reverter uma suspensão?**
R: Sim, a funcionalidade de reativar será adicionada. Por enquanto, via SQL: `UPDATE profiles SET suspended = false WHERE id = 'user-id'`

**P: Como exporto logs de um período específico?**
R: Use os filtros de data e depois clique em Exportar. O CSV conterá apenas os logs filtrados.

**P: Posso criar relatórios customizados?**
R: A funcionalidade de relatórios personalizados está planejada para o módulo de Analytics.

**P: Como adiciono novas métricas no dashboard?**
R: Edite `src/pages/admin/AdminDashboard.tsx` e adicione novos `StatCard` components.

---

## Recursos Adicionais

- 📖 **Documentação Completa:** `ADMIN_PANEL_COMPLETE.md`
- 🚀 **Setup Rápido:** `ADMIN_SETUP_RAPIDO.md`
- 🗄️ **Schema do Banco:** `supabase/migrations/20250127_admin_system.sql`
- 💻 **Service Layer:** `src/services/admin.ts`

---

**Precisa de mais exemplos? Consulte o código-fonte ou crie um novo caso de uso!** 🎯
