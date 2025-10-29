# Guia Rápido - Primeiros Passos

## 🚀 Start Rápido (5 minutos)

### 1. Aplicar Migration

```powershell
# No diretório do projeto
npx supabase migration up
```

### 2. Iniciar Servidor

```powershell
npm run dev
```

### 3. Acessar Aplicação

Abra: http://localhost:5173

---

## 🔑 Configurar Nuvemshop

### Passo 1: Criar App

1. Acesse: https://partners.nuvemshop.com.br/
2. **Criar novo app**:
   - Nome: `Tracky Pro Flow`
   - Redirect URI: `http://localhost:5173/integrations/nuvemshop/callback`
   - Escopos: `read_orders, write_orders, read_shipping, write_shipping`

### Passo 2: Conectar no Tracky

1. Login → **Configurações** → **Integrações**
2. Encontre **Nuvemshop** → **Conectar**
3. Cole **App ID** e **App Secret**
4. Digite URL da loja: `https://sua-loja.nuvemshop.com.br`
5. **Autorizar no Nuvemshop** → Permitir acesso

### Passo 3: Sincronizar Pedidos

1. Clique em **Sincronizar Agora**
2. Aguarde conclusão
3. Vá para **Dashboard** → Veja pedidos no widget

---

## 📦 Configurar Smartenvios

### Passo 1: Obter API Key

1. Acesse: https://dashboard.smartenvios.com/
2. **Configurações** → **API**
3. Copie a **API Key**

### Passo 2: Conectar no Tracky

1. **Configurações** → **Integrações**
2. Encontre **Smartenvios** → **Conectar**
3. Cole a **API Key**
4. Selecione ambiente: **Produção**
5. **Testar Conexão**

### Passo 3: Testar Rastreamento

1. Vá para **Dashboard**
2. Widget **Smartenvios** → Digite código: `SE1234567890`
3. Clique em **Buscar**
4. Veja informações de rastreamento

---

## 📊 Usar Dashboard

### Widget Nuvemshop Orders

- **Estatísticas**: Pedidos abertos vs completos
- **Lista**: 5 pedidos mais recentes
- **Ações**:
  - 🔄 **Sincronizar**: Buscar novos pedidos
  - 👁️ **Ver todos**: Ir para lista completa

### Widget Smartenvios Tracking

- **Estatísticas**: Em trânsito, Entregues, Pendentes, Atrasados
- **Busca Rápida**: Digite código → Enter
- **Distribuição**: Veja % de cada status
- **Taxa de Entrega**: Calculada automaticamente

---

## 🎯 Casos de Uso Comuns

### Cenário 1: Novo pedido na loja

1. Cliente faz pedido na Nuvemshop
2. Webhook notifica Tracky automaticamente
3. Pedido aparece no Dashboard
4. Código de rastreamento é detectado

### Cenário 2: Rastrear envio

1. Copie código de rastreamento
2. Dashboard → Widget Smartenvios → Cole código
3. Veja status atual e histórico
4. Atualizações automáticas via webhook

### Cenário 3: Sincronização manual

1. Dashboard → Widget Nuvemshop
2. Clique em "Sincronizar"
3. Aguarde toast de confirmação
4. Novos pedidos aparecem na lista

---

## ❓ FAQ Rápido

### P: OAuth não está funcionando

**R**: Verifique se:

- Redirect URI está correto no app Nuvemshop
- Servidor está rodando em `localhost:5173`
- Navegador permite redirects

### P: Pedidos não aparecem

**R**: Confirme que:

- Access token está válido (badge "Conectado")
- App tem permissão `read_orders`
- Loja tem pedidos para sincronizar

### P: Smartenvios retorna erro

**R**: Verifique:

- API Key está correta e não expirou
- Ambiente selecionado está correto (Prod/Sandbox)
- Código de rastreamento tem formato válido

### P: Como forço re-sincronização?

**R**:

1. Desconecte a integração
2. Reconecte com as mesmas credenciais
3. Clique em "Sincronizar Agora"

---

## 🔧 Comandos Úteis

### Desenvolvimento

```powershell
npm run dev              # Iniciar servidor
npm run build            # Build produção
npm run test             # Rodar testes
npm run test:ui          # Interface de testes
```

### Supabase

```powershell
npx supabase status      # Ver status
npx supabase migration list  # Listar migrations
npx supabase db reset    # Resetar banco (DEV ONLY!)
```

### Debug

```powershell
# Ver logs em tempo real
npm run dev

# Console do navegador: F12
# Network tab: Ver requests
# Application tab: Ver localStorage
```

---

## 📚 Documentação Completa

- **Planejamento**: `docs/INTEGRACAO_SMARTENVIOS_NUVEMSHOP.md`
- **Testes**: `docs/PLANO_DE_TESTES.md`
- **Implementação**: `docs/FINAL_IMPLEMENTATION_SUMMARY.md`
- **README**: `docs/INTEGRACAO_README.md`

---

## 🆘 Precisa de Ajuda?

1. 📖 Leia a documentação completa
2. 🔍 Busque no FAQ
3. 🐛 Verifique GitHub Issues
4. 💬 Entre em contato no Slack
5. 📧 Email: suporte@tracky.com

---

**Tempo estimado de setup**: 5-10 minutos  
**Dificuldade**: ⭐⭐ (Fácil)  
**Suporte**: ✅ Disponível 24/7
