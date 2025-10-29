# 📋 COMO APLICAR MIGRATION NO SUPABASE WEB

**Para quem usa Supabase na nuvem (não local)**

---

## 🎯 PASSO A PASSO

### **1. Acessar o Supabase Dashboard** (1 min)

1. Abra seu navegador
2. Vá para: https://supabase.com/dashboard
3. Faça login com sua conta
4. Selecione seu projeto (Tracky Pro Flow)

---

### **2. Abrir o SQL Editor** (30 seg)

1. No menu lateral esquerdo, clique em **"SQL Editor"**
2. Você verá um editor de código SQL
3. Clique em **"New Query"** se necessário

---

### **3. Copiar a Migration** (1 min)

No VS Code, abra o arquivo da migration:

```powershell
code supabase\migrations\005_smartenvios_nuvemshop.sql
```

**Selecione TODO o conteúdo** (Ctrl+A) e copie (Ctrl+C)

---

### **4. Colar e Executar** (2 min)

1. **Cole** o conteúdo no SQL Editor do Supabase (Ctrl+V)
2. **Revise** rapidamente o SQL (deve ter ~180 linhas)
3. Clique no botão **"Run"** (ou pressione Ctrl+Enter)
4. **Aguarde** a execução (pode levar 10-30 segundos)

---

### **5. Verificar Sucesso** (2 min)

Após executar, você deve ver:

✅ **Mensagem de sucesso:**

```
Success. No rows returned
```

Ou algo similar indicando que não houve erros.

**Se houver erro:** Veja a seção "Troubleshooting" abaixo.

---

### **6. Verificar Tabelas Criadas** (3 min)

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver **4 novas tabelas**:

   ✅ **carrier_integrations**

   - Armazena configurações de transportadoras (Smartenvios)
   - Campos: id, user_id, carrier, api_key, is_active, etc.

   ✅ **smartenvios_trackings**

   - Armazena rastreamentos do Smartenvios
   - Campos: id, tracking_code, status, events, etc.

   ✅ **nuvemshop_orders_cache**

   - Cache de pedidos do Nuvemshop
   - Campos: id, nuvemshop_order_id, order_data, etc.

   ✅ **webhook_errors**

   - Logs de erros dos webhooks
   - Campos: id, provider, event, error, payload, etc.

3. **Clique em cada tabela** para verificar se foram criadas corretamente

---

### **7. Verificar Policies (RLS)** (2 min)

1. Clique em qualquer uma das novas tabelas
2. Vá na aba **"Policies"** (ou "RLS")
3. Você deve ver políticas como:
   - "Users can view own carrier integrations"
   - "Users can insert own carrier integrations"
   - Etc.

Se as policies estiverem lá, está tudo certo! ✅

---

## ✅ PRONTO!

A migration foi aplicada com sucesso!

**Próximos passos:**

1. ✅ Migration aplicada no banco
2. 📋 Configurar `.env.local` com credenciais
3. 📋 Executar `npm run dev`
4. 📋 Testar as integrações

Continue em: `COMECE_AQUI.md` (Passo 3)

---

## 🔧 TROUBLESHOOTING

### **Erro: "relation already exists"**

**Causa:** Tabelas já existem no banco.

**Solução:**

Opção 1 - Dropar tabelas antigas:

```sql
-- Execute isso no SQL Editor ANTES da migration
DROP TABLE IF EXISTS webhook_errors CASCADE;
DROP TABLE IF EXISTS nuvemshop_orders_cache CASCADE;
DROP TABLE IF EXISTS smartenvios_trackings CASCADE;
DROP TABLE IF EXISTS carrier_integrations CASCADE;
```

Opção 2 - Ignorar erro:

- Se as tabelas já existem com a estrutura correta, pode ignorar
- Verifique se têm todas as colunas necessárias

---

### **Erro: "column already exists"**

**Causa:** A migration tenta adicionar uma coluna que já existe.

**Solução:**

- A migration já tem `DO $$ ... IF NOT EXISTS` blocks
- Se ainda assim dá erro, a coluna já existe
- Verifique se a estrutura está correta
- Pode ignorar esse erro específico

---

### **Erro: "policy already exists"**

**Causa:** Policies já foram criadas anteriormente.

**Solução:**

Execute isso ANTES da migration:

```sql
-- Dropar policies antigas
DROP POLICY IF EXISTS "Users can view own carrier integrations" ON carrier_integrations;
DROP POLICY IF EXISTS "Users can insert own carrier integrations" ON carrier_integrations;
DROP POLICY IF EXISTS "Users can update own carrier integrations" ON carrier_integrations;
DROP POLICY IF EXISTS "Users can delete own carrier integrations" ON carrier_integrations;

DROP POLICY IF EXISTS "Users can view own smartenvios trackings" ON smartenvios_trackings;
DROP POLICY IF EXISTS "Users can insert own smartenvios trackings" ON smartenvios_trackings;
DROP POLICY IF EXISTS "Users can update own smartenvios trackings" ON smartenvios_trackings;

DROP POLICY IF EXISTS "Users can view own nuvemshop orders cache" ON nuvemshop_orders_cache;
DROP POLICY IF EXISTS "Users can insert own nuvemshop orders cache" ON nuvemshop_orders_cache;
DROP POLICY IF EXISTS "Users can update own nuvemshop orders cache" ON nuvemshop_orders_cache;

DROP POLICY IF EXISTS "Users can view own webhook errors" ON webhook_errors;
DROP POLICY IF EXISTS "Users can insert own webhook errors" ON webhook_errors;
```

Depois execute a migration novamente.

---

### **Erro: "constraint already exists"**

**Causa:** Constraint (como CHECK ou UNIQUE) já existe.

**Solução:**

Execute isso ANTES da migration:

```sql
-- Dropar constraints antigas
ALTER TABLE IF EXISTS marketplace_integrations
  DROP CONSTRAINT IF EXISTS marketplace_integrations_marketplace_check;

ALTER TABLE IF EXISTS carrier_integrations
  DROP CONSTRAINT IF EXISTS carrier_integrations_carrier_check;
```

---

### **Erro: "permission denied"**

**Causa:** Você não tem permissões de admin no banco.

**Solução:**

1. Verifique se está logado com o usuário correto
2. Verifique se o projeto é realmente seu
3. Tente fazer logout/login no Supabase dashboard
4. Se persistir, contate suporte do Supabase

---

### **Erro genérico / Não sei o que fazer**

**Passos:**

1. **Copie o erro completo** da mensagem
2. **Procure no erro** qual linha está falhando
3. **Execute só aquela parte** do SQL para isolar o problema
4. **Consulte a documentação** do Supabase: https://supabase.com/docs

**Ou:**

Me envie o erro completo e eu te ajudo a resolver!

---

## 📝 NOTAS IMPORTANTES

### **Sobre Rollback**

Se algo der errado, você pode fazer rollback manual:

```sql
-- CUIDADO: Isso apaga as tabelas e dados!
DROP TABLE IF EXISTS webhook_errors CASCADE;
DROP TABLE IF EXISTS nuvemshop_orders_cache CASCADE;
DROP TABLE IF EXISTS smartenvios_trackings CASCADE;
DROP TABLE IF EXISTS carrier_integrations CASCADE;

-- Restaurar constraint antiga (se mudou)
ALTER TABLE marketplace_integrations
  DROP CONSTRAINT IF EXISTS marketplace_integrations_marketplace_check;

ALTER TABLE marketplace_integrations
  ADD CONSTRAINT marketplace_integrations_marketplace_check
  CHECK (marketplace IN ('shopify', 'woocommerce', 'mercadolivre'));
```

### **Sobre Modificações Futuras**

Como você usa Supabase web:

✅ **Faça mudanças direto no SQL Editor**
✅ **Teste em staging/desenvolvimento primeiro**
✅ **Documente mudanças em arquivos .sql no projeto**
✅ **Faça backup antes de grandes mudanças**

❌ **NÃO use** `npx supabase db push` (é para local)
❌ **NÃO use** migrations automáticas (você controla manual)

---

## 🎯 CHECKLIST FINAL

Antes de continuar, confirme:

- [ ] SQL executado sem erros
- [ ] 4 novas tabelas visíveis no Table Editor
- [ ] Policies (RLS) criadas corretamente
- [ ] Nenhum erro de "permission denied"
- [ ] Consegue ver estrutura das tabelas

Se tudo OK, continue para o próximo passo! ✅

---

**Última Atualização:** 26 de Outubro de 2025
