# 🧪 Guia de Teste Rápido - Nuvemshop & Smartenvios

## ✅ Pré-Requisitos

- [ ] Servidor de desenvolvimento rodando (`npm run dev`)
- [ ] Supabase configurado (URL e Anon Key em `.env`)
- [ ] Migration aplicada no Supabase Web

---

## 🚀 Teste 1: Verificar UI

### 1.1 Acessar Settings

```
http://localhost:5173/settings
```

### 1.2 Navegar para Integrações

- Clicar no tab **"Integrações"**
- Verificar se há duas novas integrações:

**Marketplaces:**

- ✅ Shopify
- ✅ WooCommerce
- ✅ Mercado Livre
- ✅ **Nuvemshop** (novo - ícone azul "N")

**Transportadoras:**

- ✅ Correios
- ✅ Jadlog
- ✅ Total Express
- ✅ Azul Cargo
- ✅ Loggi
- ✅ Melhor Envio
- ✅ **Smartenvios** (novo - ícone verde "SE")

### 1.3 Verificar Status Inicial

Ambas devem mostrar:

```
Status: Não conectado
Botão: [Conectar]
```

---

## 🔵 Teste 2: Nuvemshop

### 2.1 Abrir Dialog de Configuração

1. Clicar em **"Conectar"** no card Nuvemshop
2. Dialog deve abrir com:
   - Título "Configuração Nuvemshop"
   - Campo "Store ID"
   - Botões e instruções

### 2.2 Verificar Campos

- [ ] Campo "Store ID" aceita apenas números
- [ ] Placeholder mostra exemplo: "1234567"
- [ ] Botão "Iniciar OAuth" está presente

### 2.3 Verificar Mensagens

- [ ] Alert de ajuda mostra onde encontrar Store ID
- [ ] Links para documentação funcionam

### 2.4 Teste com Store ID Inválido

```
Store ID: 123
Resultado: Deve mostrar erro "Store ID inválido"
```

### 2.5 Teste com Store ID Válido (Simulado)

```
Store ID: 1234567
Clicar: "Iniciar OAuth"
Resultado: Deve abrir popup/redirect para Nuvemshop
```

---

## 🟢 Teste 3: Smartenvios

### 3.1 Abrir Dialog de Configuração

1. Clicar em **"Conectar"** no card Smartenvios
2. Dialog deve abrir com:
   - Título "Configuração Smartenvios"
   - Campo "API Key"
   - Botão "Validar e Conectar"

### 3.2 Verificar Campos

- [ ] Campo "API Key" aceita texto
- [ ] Placeholder mostra exemplo de formato
- [ ] Botão "Validar e Conectar" está presente

### 3.3 Verificar Mensagens

- [ ] Alert de ajuda mostra onde obter API Key
- [ ] Link para dashboard Smartenvios funciona

### 3.4 Teste com API Key Inválida

```
API Key: invalid_key_12345
Clicar: "Validar e Conectar"
Resultado: Deve mostrar erro "API Key inválida"
```

### 3.5 Teste com API Key Válida (Quando tiver)

```
API Key: <sua_api_key_real>
Clicar: "Validar e Conectar"
Resultado:
  ✅ Validação bem-sucedida
  ✅ Credenciais salvas no Supabase
  ✅ Card muda para "Conectado"
```

---

## 📊 Teste 4: Verificar Banco de Dados

### 4.1 Verificar Tabelas no Supabase

Acesse: https://supabase.com/dashboard

**Tabela: `marketplace_integrations`**

```sql
SELECT * FROM marketplace_integrations
WHERE marketplace_type = 'nuvemshop';
```

Deve conter (se conectado):

- `user_id`: UUID do usuário
- `marketplace_type`: 'nuvemshop'
- `store_id`: Store ID inserido
- `access_token`: Token OAuth (quando completar OAuth)
- `is_connected`: true
- `settings`: JSON com configurações

**Tabela: `carrier_integrations`**

```sql
SELECT * FROM carrier_integrations
WHERE carrier_name = 'smartenvios';
```

Deve conter (se conectado):

- `user_id`: UUID do usuário
- `carrier_name`: 'smartenvios'
- `api_key`: API Key (encrypted)
- `is_connected`: true
- `settings`: JSON com configurações

---

## 🔄 Teste 5: Sincronização (Nuvemshop)

### 5.1 Após Conectar

Verificar se aparece seção "Sincronização":

- [ ] Botão "Sincronizar Pedidos"
- [ ] Informações de última sincronização
- [ ] Configurações de sincronização automática

### 5.2 Testar Sincronização Manual

```
1. Clicar "Sincronizar Pedidos"
2. Loading deve aparecer
3. Após conclusão: "X pedidos sincronizados"
```

### 5.3 Verificar Pedidos Importados

```sql
SELECT * FROM orders
WHERE integration_type = 'nuvemshop'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📦 Teste 6: Cotações (Smartenvios)

### 6.1 Após Conectar

Verificar se aparece seção "Testar Cotação":

- [ ] Campos para origem/destino
- [ ] Peso e dimensões
- [ ] Botão "Obter Cotações"

### 6.2 Testar Cotação Manual

```
Dados de teste:
- CEP Origem: 01310-100
- CEP Destino: 04547-130
- Peso: 1kg
- Dimensões: 20x15x10 cm

Clicar: "Obter Cotações"
Resultado: Lista de serviços disponíveis com preços
```

---

## 🔐 Teste 7: Webhooks

### 7.1 Verificar Endpoints Disponíveis

Os seguintes endpoints devem estar ativos:

**Nuvemshop:**

```
POST /api/webhooks/nuvemshop
```

**Smartenvios:**

```
POST /api/webhooks/smartenvios
```

**OAuth Callback:**

```
GET /api/webhooks/callback?marketplace=nuvemshop
```

### 7.2 Testar Webhooks (Manual)

Use o teste de webhooks do próprio Settings:

1. Ir em Settings → Webhooks
2. Enviar teste para Nuvemshop/Smartenvios
3. Verificar logs

---

## 🎯 Checklist Completo de Teste

### Visual/UI

- [ ] Cards aparecem em Settings → Integrações
- [ ] Ícones e cores corretos (Nuvemshop azul, Smartenvios verde)
- [ ] Status mostra "Não conectado" inicialmente
- [ ] Botão "Conectar" abre dialog
- [ ] Dialog tem scroll quando necessário
- [ ] Formulários bem formatados

### Funcional - Nuvemshop

- [ ] Validação de Store ID funciona
- [ ] OAuth redirect funciona
- [ ] Callback OAuth funciona
- [ ] Salvamento de credenciais funciona
- [ ] Sincronização de pedidos funciona
- [ ] Webhooks recebem eventos
- [ ] Status muda para "Conectado"

### Funcional - Smartenvios

- [ ] Validação de API Key funciona
- [ ] Salvamento de credenciais funciona
- [ ] Cotações funcionam
- [ ] Criação de etiquetas funciona
- [ ] Rastreamento funciona
- [ ] Status muda para "Conectado"

### Banco de Dados

- [ ] Dados salvos em `marketplace_integrations`
- [ ] Dados salvos em `carrier_integrations`
- [ ] Pedidos importados em `orders`
- [ ] Rastreamentos salvos em `tracking_events`
- [ ] Webhooks registrados em `webhook_events`

### Segurança

- [ ] API Keys são encrypted
- [ ] Tokens OAuth são encrypted
- [ ] Permissões RLS funcionam
- [ ] Apenas usuário owner vê suas integrações

---

## 🐛 Troubleshooting Comum

### Problema: Cards não aparecem

**Solução:**

1. Verificar console do browser (F12)
2. Checar erros de import
3. Verificar se migration foi aplicada

### Problema: Erro ao conectar

**Solução:**

1. Verificar se Supabase está configurado
2. Verificar URL e Anon Key em `.env`
3. Verificar network tab do browser

### Problema: OAuth não funciona

**Solução:**

1. Verificar se redirect URL está correto
2. Verificar credenciais OAuth no Nuvemshop Partner
3. Verificar se webhook callback está registrado

### Problema: API Key inválida (Smartenvios)

**Solução:**

1. Verificar se API Key foi copiada corretamente
2. Testar API Key direto no Postman
3. Verificar se conta Smartenvios está ativa

---

## 📝 Logs Úteis

### Console do Browser

```javascript
// Verificar se componentes carregaram
console.log("NuvemshopConfig:", NuvemshopConfig);
console.log("SmartenviosConfig:", SmartenviosConfig);

// Verificar hooks
console.log("useNuvemshopIntegration:", useNuvemshopIntegration());
console.log("useSmartenviosIntegration:", useSmartenviosIntegration());
```

### Supabase Logs

```sql
-- Ver integrações do usuário
SELECT * FROM marketplace_integrations
WHERE user_id = '<user_id>';

SELECT * FROM carrier_integrations
WHERE user_id = '<user_id>';

-- Ver últimos webhooks
SELECT * FROM webhook_events
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✅ Critérios de Sucesso

### Mínimo Viável

- [x] Cards aparecem na UI
- [x] Dialogs abrem corretamente
- [x] Formulários funcionam
- [x] Dados são salvos no Supabase

### Completamente Funcional

- [ ] OAuth da Nuvemshop completo (depende de app aprovado)
- [ ] Sincronização automática de pedidos
- [ ] Cotações Smartenvios funcionando
- [ ] Webhooks recebendo eventos
- [ ] Rastreamento em tempo real

---

## 📞 Suporte

Se encontrar problemas:

1. **Verificar Documentação:**

   - `INTEGRACAO_UI_COMPLETA.md`
   - `OAUTH_NUVEMSHOP_SETUP.md`
   - `SMARTENVIOS_API_GUIDE.md`

2. **Verificar Logs:**

   - Console do browser (F12)
   - Network tab
   - Supabase Dashboard → Logs

3. **Verificar Configuração:**
   - `.env` com variáveis corretas
   - Migration aplicada
   - Credenciais OAuth configuradas

---

## 🎉 Parabéns!

Se todos os testes passaram, as integrações estão **100% funcionais**! 🚀

Próximo passo: Começar a usar em produção e receber pedidos reais.
