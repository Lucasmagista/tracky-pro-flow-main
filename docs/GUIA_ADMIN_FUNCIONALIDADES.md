# 🎯 Guia Completo - Funcionalidades Admin Implementadas

## 📋 **ÍNDICE**
1. [Edição de Usuários](#1-edição-de-usuários)
2. [Gestão de Planos e Assinaturas](#2-gestão-de-planos-e-assinaturas)
3. [Gestão de Pedidos](#3-gestão-de-pedidos)
4. [Gestão de Permissões](#4-gestão-de-permissões)
5. [Métricas do Dashboard](#5-métricas-do-dashboard)

---

## 1️⃣ **Edição de Usuários**

### 📍 Localização
`/admin/users` ou clique em "Usuários" no menu lateral

### 🎯 O que você pode fazer:

#### **A) Editar Usuário**
1. Encontre o usuário na lista
2. Clique nos **3 pontinhos (⋮)** na coluna "Ações"
3. Selecione **"Editar"**
4. No dialog que abrir, você pode alterar:
   - ✏️ **Nome** do usuário
   - ✏️ **Nome da loja**
   - ☑️ **Status Admin** (ativar/desativar)
   - 👤 **Role de Admin**:
     - `super_admin` - Acesso total
     - `admin` - Acesso administrativo
     - `moderator` - Acesso moderado
     - `support` - Apenas suporte
5. Clique em **"Salvar Alterações"**

#### **B) Ver Detalhes e Atividades**
1. Clique nos **3 pontinhos (⋮)** 
2. Selecione **"Ver Detalhes"**
3. Você verá:
   - 📊 Informações completas do usuário
   - 📜 **Timeline de atividades** (últimas 50 ações)
   - 🔍 Metadados de cada ação
   - 📍 IPs utilizados

#### **C) Deletar Usuário**
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Deletar"**
3. Confirme a ação

### 🔍 **Filtros Disponíveis:**
- 🔎 **Busca**: Por nome, email ou loja
- 📅 **Data**: Período de cadastro
- ✅ **Status**: Com/sem assinatura
- 👔 **Tipo**: Admin ou usuário regular

---

## 2️⃣ **Gestão de Planos e Assinaturas**

### 📍 Localização
`/admin/subscriptions` ou clique em "Assinaturas" no menu lateral

### 🎯 O que você pode fazer:

#### **A) Migrar Plano do Usuário**
1. Encontre a assinatura na lista
2. Clique nos **3 pontinhos (⋮)**
3. Selecione **"Migrar Plano"**
4. No dialog:
   - 📦 Escolha o **novo plano** no dropdown
   - 📝 Informe o **motivo** da migração
   - Exemplos: "Upgrade solicitado", "Downgrade por inadimplência"
5. Clique em **"Migrar Plano"**

✅ **Resultado**: O usuário será movido para o novo plano e um registro de auditoria será criado.

#### **B) Aplicar Desconto**
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Aplicar Desconto"**
3. Configure:
   - 💰 **Porcentagem** (ex: 20 para 20% de desconto)
   - 📅 **Duração** em meses (ex: 3 = desconto por 3 meses)
4. Clique em **"Aplicar"**

#### **C) Estender Trial**
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Estender Trial"**
3. Informe quantos **dias adicionais** (ex: 7, 15, 30)
4. Clique em **"Estender"**

#### **D) Ver Histórico**
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Ver Histórico"**
3. Você verá todas as mudanças de plano, descontos aplicados, etc.

#### **E) Reativar Assinatura**
Para assinaturas canceladas:
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Reativar"**

### 🔍 **Filtros Disponíveis:**
- ✅ **Status**: Ativa, Cancelada, Trial, Expirada
- 📦 **Plano**: Filtrar por plano específico

---

## 3️⃣ **Gestão de Pedidos**

### 📍 Localização
`/admin/orders` ou clique em "Pedidos" no menu lateral

### 🎯 O que você pode fazer:

#### **A) Editar Status do Pedido**
1. Encontre o pedido na lista
2. Clique nos **3 pontinhos (⋮)**
3. Selecione **"Editar Status"**
4. No dialog:
   - 📦 Escolha o novo status:
     - `pending` - Pendente
     - `in_transit` - Em trânsito
     - `delivered` - Entregue
     - `exception` - Exceção
   - 📝 Adicione **notas internas** (opcional)
5. Clique em **"Salvar"**

#### **B) Adicionar Notas ao Pedido**
1. Clique nos **3 pontinhos (⋮)**
2. Selecione **"Adicionar Notas"**
3. Digite as notas (ex: "Cliente solicitou reentrega")
4. Clique em **"Adicionar"**

✅ **As notas ficam registradas no pedido para referência futura**

#### **C) Ações em Massa (Bulk Actions)**
Para atualizar múltiplos pedidos de uma vez:

1. ☑️ **Marque os checkboxes** dos pedidos que deseja atualizar
2. No topo da tabela, aparecerá um menu com:
   - 🔄 **"Atualizar Status"** - Alterar status de todos selecionados
   - 🔁 **"Reprocessar"** - Reprocessar rastreamento
   - 📝 **"Adicionar Notas"** - Adicionar nota em todos
3. Selecione a ação desejada
4. Preencha os dados no dialog
5. Confirme

### 🔍 **Filtros Disponíveis:**
- ✅ **Status**: Filtrar por status do pedido
- 🚚 **Transportadora**: Filtrar por carrier
- 🔎 **Busca**: Por código de rastreio ou nome do cliente

---

## 4️⃣ **Gestão de Permissões**

### 📍 Localização
`/admin/permissions` ou clique em "Permissões" no menu lateral

### 🎯 O que você pode fazer:

#### **A) Conceder Permissões Admin**
1. Clique no botão **"Conceder Permissões"** (topo direito)
2. Preencha o formulário:
   - 📧 **Email** do usuário
   - 👤 **Role de Admin**:
     - `super_admin` - Acesso total ao sistema
     - `admin` - Acesso administrativo completo
     - `moderator` - Acesso moderado
     - `support` - Apenas visualização e suporte
   - 📝 **Notas** (opcional) - Ex: "Novo membro da equipe"
   - ⏰ **Expira em X dias** (opcional) - Para permissões temporárias
3. Clique em **"Conceder Permissões"**

#### **B) Revogar Permissões**
1. Encontre o admin na lista
2. Clique no botão **"Revogar"** (vermelho)
3. Confirme a ação

#### **C) Ver Detalhes das Permissões**
A lista mostra:
- 👤 Nome e email do admin
- 🏷️ Role atual
- 📅 Data de concessão
- ⏰ Data de expiração (se houver)
- ✅ Status (Ativo/Expirado)

---

## 5️⃣ **Métricas do Dashboard**

### 📍 Localização
`/admin` ou `/admin/dashboard` (página inicial)

### 📊 **Métricas Disponíveis:**

#### **Cards Principais:**
- 👥 **Total de Usuários**
- 💰 **MRR** (Monthly Recurring Revenue)
- 📦 **Pedidos Ativos**
- 📈 **Taxa de Conversão** (Free → Paid)

#### **Gráficos:**
- 📈 **Receita Mensal** (últimos 12 meses)
- 👥 **Novos Usuários** (últimos 30 dias)
- 📊 **Churn Rate** (taxa de cancelamento)
- 💵 **ARPU** (Average Revenue Per User)

#### **Tabela:**
- 🏆 **Top Usuários por Receita** (10 maiores)

---

## 🚀 **Testando Agora**

### **Passo a Passo Rápido:**

1. **Inicie o servidor**:
   ```bash
   npm run dev
   ```

2. **Acesse o admin**: 
   ```
   http://localhost:5173/admin
   ```

3. **Teste cada funcionalidade**:
   - ✅ Edite um usuário
   - ✅ Migre um plano
   - ✅ Adicione notas a um pedido
   - ✅ Conceda permissões admin

---

## 📝 **Logs de Auditoria**

**TODAS as ações são registradas automaticamente:**
- ✅ Quem fez a ação
- ✅ Quando foi feita
- ✅ Qual usuário foi afetado
- ✅ O que foi alterado
- ✅ IP e user agent

**Visualizar logs:**
- Vá em `/admin/logs`
- Ou veja o histórico no detalhe de cada usuário

---

## 🔐 **Controle de Acesso**

### **Hierarquia de Roles:**

1. **Super Admin** 🔴
   - Pode fazer TUDO
   - Gerenciar outros admins
   - Acessar configurações sensíveis

2. **Admin** 🟠
   - Gerenciar usuários e pedidos
   - Ver relatórios
   - Não pode gerenciar outros admins

3. **Moderator** 🟡
   - Ver dados
   - Ações limitadas
   - Sem acesso a finanças

4. **Support** 🟢
   - Apenas visualização
   - Responder tickets
   - Sem poder de edição

---

## ❓ **FAQ**

**P: Como sei se uma ação foi bem-sucedida?**
R: Um toast (notificação) verde aparecerá no canto superior direito.

**P: Posso desfazer uma ação?**
R: Não, mas todas as ações ficam registradas no log de auditoria.

**P: Quantos admins posso ter?**
R: Ilimitado! Use a página de Permissões para gerenciar.

**P: Os filtros salvam automaticamente?**
R: Não, mas você pode exportar os dados filtrados em CSV.

---

## 🆘 **Suporte**

Se encontrar algum problema:
1. Verifique o console do navegador (F12)
2. Verifique os logs do Supabase
3. Todas as ações têm tratamento de erro com mensagens claras

---

**✅ Tudo está pronto e funcionando!**

Aproveite seu painel admin completo! 🚀
