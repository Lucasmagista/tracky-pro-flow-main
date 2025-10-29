# 🚀 GUIA DE EXECUÇÃO - PRÓXIMOS PASSOS

**Status Atual:** 96% Completo ✅  
**Última Atualização:** 26 de Outubro de 2025

---

## 📋 CHECKLIST DE EXECUÇÃO

### ✅ JÁ CONCLUÍDO (96%)

- [x] **26 arquivos criados** (~7,710 linhas)
- [x] **9 Fases completadas** (Planejamento → Dashboard)
- [x] **Zero erros TypeScript**
- [x] **7 documentos técnicos**
- [x] **Webhooks implementados** (Nuvemshop + Smartenvios)
- [x] **OAuth callback criado**
- [x] **Migration SQL preparada**

---

## 🎯 FALTA FAZER (4%)

### **FASE 10: TESTES E DEPLOY**

---

## 📝 PASSO A PASSO

### **ETAPA 1: VALIDAÇÃO PRÉ-MIGRATION** (5 minutos)

Execute o script de validação para verificar se tudo está pronto:

```powershell
# Navegar até a raiz do projeto
cd c:\Users\Lucas Magista\Desktop\tracky-pro-flow-main

# Executar validação
.\scripts\pre-migration-check.ps1
```

**Resultado Esperado:**

```
✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!
🎉 Sistema 100% pronto para migration e testes!
```

**Se houver erros:**

- Corrija os arquivos ausentes
- Configure variáveis de ambiente
- Execute novamente

---

### **ETAPA 2: INICIAR SUPABASE LOCAL** (2 minutos)

Se o Supabase não estiver rodando:

```powershell
# Iniciar Supabase local
npx supabase start

# Aguardar até ver:
# ✅ Started supabase local development setup.
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
```

**Importante:** Anote as URLs e credenciais exibidas!

---

### **ETAPA 3: APLICAR MIGRATION** (3 minutos)

Execute o script para aplicar a migration com segurança:

```powershell
# Aplicar migration (com backup automático)
.\scripts\apply-migration.ps1

# O script irá:
# 1. Verificar Supabase
# 2. Criar backup automático
# 3. Mostrar preview das mudanças
# 4. Pedir confirmação
# 5. Aplicar migration
# 6. Regenerar TypeScript types
# 7. Verificar tabelas criadas
```

**Quando pedir confirmação, digite:** `S`

**Resultado Esperado:**

```
✅ MIGRATION CONCLUÍDA COM SUCESSO!
🎉 Sistema pronto para testes!
```

**Se der erro:**

- Verifique os logs
- Restaure o backup se necessário: `npx supabase db reset`
- Corrija o problema e tente novamente

---

### **ETAPA 4: CONFIGURAR VARIÁVEIS DE AMBIENTE** (5 minutos)

Crie ou atualize o arquivo `.env.local`:

```bash
# Supabase (obrigatório)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui

# Nuvemshop (obter em https://www.nuvemshop.com.br/parceiros)
VITE_NUVEMSHOP_APP_ID=seu_app_id_aqui
VITE_NUVEMSHOP_APP_SECRET=seu_app_secret_aqui

# URL da aplicação (para webhooks)
VITE_API_URL=http://localhost:5173

# Smartenvios (obter com suporte Smartenvios)
# VITE_SMARTENVIOS_API_KEY=sua_api_key_aqui
```

**Como obter credenciais:**

**Nuvemshop:**

1. Acesse https://www.nuvemshop.com.br/parceiros
2. Crie uma conta de desenvolvedor
3. Crie um novo app
4. Copie App ID e App Secret
5. Configure Redirect URI: `http://localhost:5173/api/integrations/nuvemshop/callback`

**Smartenvios:**

1. Contate suporte: suporte@smartenvios.com
2. Solicite API Key de desenvolvimento
3. Configure webhook URL: `http://localhost:5173/api/webhooks/smartenvios`

---

### **ETAPA 5: INICIAR APLICAÇÃO** (1 minuto)

```powershell
# Instalar dependências (se necessário)
npm install

# Iniciar dev server
npm run dev

# Aguardar:
# ➜  Local:   http://localhost:5173/
```

Abra o navegador em: http://localhost:5173

---

### **ETAPA 6: TESTES MANUAIS BÁSICOS** (15 minutos)

Siga a ordem exata:

#### **6.1 Testar Interface**

1. **Login no sistema**

   - [ ] Faça login com suas credenciais
   - [ ] Verifique se dashboard carrega

2. **Acessar Settings**
   - [ ] Navegue para Settings → Integrations
   - [ ] Verifique se aparecem opções Nuvemshop e Smartenvios

#### **6.2 Testar Nuvemshop (se tiver credenciais)**

1. **Conectar Nuvemshop**

   - [ ] Clique em "Conectar Nuvemshop"
   - [ ] Insira App ID e App Secret
   - [ ] Clique em "Autorizar"
   - [ ] Deve redirecionar para Nuvemshop
   - [ ] Autorize o app
   - [ ] Deve voltar para Settings com "✅ Conectado"

2. **Sincronizar Pedidos**
   - [ ] Clique em "Sincronizar Pedidos"
   - [ ] Verifique se pedidos aparecem no dashboard
   - [ ] Verifique se dados estão corretos

#### **6.3 Testar Smartenvios (se tiver API Key)**

1. **Conectar Smartenvios**

   - [ ] Clique em "Conectar Smartenvios"
   - [ ] Insira API Key
   - [ ] Clique em "Testar Conexão"
   - [ ] Deve mostrar "✅ Conexão bem-sucedida"
   - [ ] Clique em "Salvar"

2. **Rastrear Pedido**
   - [ ] Insira código de rastreamento válido
   - [ ] Clique em "Rastrear"
   - [ ] Verifique se status aparece
   - [ ] Verifique histórico de eventos

---

### **ETAPA 7: TESTAR WEBHOOKS COM NGROK** (20 minutos)

#### **7.1 Instalar ngrok**

```powershell
# Instalar ngrok globalmente
npm install -g ngrok

# OU baixar de https://ngrok.com/download
```

#### **7.2 Expor aplicação**

```powershell
# Em um novo terminal
ngrok http 5173

# Vai mostrar algo como:
# Forwarding: https://abc123.ngrok.io -> http://localhost:5173
```

**⚠️ IMPORTANTE:** Copie a URL `https://abc123.ngrok.io`

#### **7.3 Configurar Webhooks**

**No Painel Nuvemshop:**

1. Acesse https://www.nuvemshop.com.br/admin
2. Vá em Apps → Seu App → Webhooks
3. Adicione webhook:
   - URL: `https://abc123.ngrok.io/api/webhooks/nuvemshop`
   - Eventos: `order/created`, `order/updated`, `order/paid`
4. Salve

**No Painel Smartenvios:**

1. Acesse dashboard Smartenvios
2. Vá em Configurações → Webhooks
3. Adicione webhook:
   - URL: `https://abc123.ngrok.io/api/webhooks/smartenvios`
   - Eventos: `tracking.update`, `tracking.delivered`
4. Salve

#### **7.4 Testar Fluxo Completo**

1. **Criar pedido de teste no Nuvemshop**

   - [ ] Crie um pedido na sua loja
   - [ ] Verifique logs do ngrok (deve aparecer POST)
   - [ ] Verifique se pedido aparece no Tracky
   - [ ] Verifique se foi salvo no banco

2. **Atualizar rastreamento no Smartenvios**

   - [ ] Simule atualização de rastreamento
   - [ ] Verifique logs do ngrok
   - [ ] Verifique se status atualizou no Tracky
   - [ ] Verifique se sincronizou com Nuvemshop

3. **Verificar Logs**
   ```powershell
   # Terminal do ngrok mostra todas as requisições
   # Terminal do npm run dev mostra logs do servidor
   ```

---

### **ETAPA 8: EXECUTAR TESTES UNITÁRIOS** (10 minutos)

```powershell
# Executar todos os testes
npm run test

# Ver cobertura
npm run test:coverage

# Rodar em modo watch
npm run test:watch

# Rodar UI de testes
npm run test:ui
```

**Meta:** > 80% de cobertura

---

### **ETAPA 9: REVISÃO FINAL** (10 minutos)

#### **9.1 Verificar Checklist**

Revise a documentação:

```powershell
# Abrir documentos
code docs/INTEGRACAO_SMARTENVIOS_NUVEMSHOP.md
code docs/PLANO_DE_TESTES.md
code docs/DEPLOY_CHECKLIST.md
```

Marque o que foi feito:

- [ ] Migration aplicada
- [ ] Variáveis configuradas
- [ ] Testes manuais OK
- [ ] Webhooks testados
- [ ] Testes unitários passando
- [ ] Zero erros TypeScript
- [ ] Zero erros no console
- [ ] Performance OK

#### **9.2 Limpar e Organizar**

```powershell
# Commit das mudanças
git add .
git commit -m "feat: Integração completa Nuvemshop + Smartenvios

- 26 arquivos criados (7,710 linhas)
- Webhooks + OAuth implementados
- Migration aplicada com sucesso
- Testes manuais concluídos
- Documentação completa

Closes #[número-da-issue]"

# Criar tag de versão
git tag -a v1.5.0 -m "Release: Integrações Nuvemshop + Smartenvios"
```

---

## 🚀 DEPLOY PARA STAGING (OPCIONAL)

Se quiser fazer deploy em staging antes de produção:

```powershell
# Seguir docs/DEPLOY_CHECKLIST.md

# 1. Build de produção
npm run build

# 2. Testar build localmente
npm run preview

# 3. Deploy (depende da sua infraestrutura)
# Vercel: vercel --prod
# Netlify: netlify deploy --prod
# Outros: seguir documentação
```

---

## ❓ TROUBLESHOOTING

### **Migration Falhou**

```powershell
# Resetar banco para estado anterior
npx supabase db reset

# Verificar migration
code supabase/migrations/005_smartenvios_nuvemshop.sql

# Tentar novamente
.\scripts\apply-migration.ps1
```

### **Webhooks Não Chegam**

1. **Verificar ngrok está rodando**

   ```powershell
   # Deve estar mostrando logs em tempo real
   ```

2. **Verificar URL está correta**

   - Copie URL HTTPS do ngrok
   - Cole EXATAMENTE no painel (sem espaços)

3. **Verificar logs**
   ```powershell
   # Terminal do npm run dev deve mostrar logs
   # Procure por: [Webhook] ou [Nuvemshop] ou [Smartenvios]
   ```

### **OAuth Falhou**

1. **Verificar Redirect URI**

   - Deve ser: `http://localhost:5173/api/integrations/nuvemshop/callback`
   - Conferir no painel Nuvemshop
   - Conferir se está idêntico (http vs https, trailing slash, etc)

2. **Verificar credenciais**
   - App ID correto?
   - App Secret correto?
   - .env.local carregado? (reinicie servidor se mudou)

### **TypeScript Errors**

```powershell
# Regenerar types
npx supabase gen types typescript --local > src/types/database.ts

# Reiniciar TypeScript Server no VSCode
# Ctrl+Shift+P → "TypeScript: Restart TS Server"

# Verificar
npx tsc --noEmit
```

---

## 📚 DOCUMENTAÇÃO DE REFERÊNCIA

- **Planejamento Completo:** `docs/INTEGRACAO_SMARTENVIOS_NUVEMSHOP.md`
- **Plano de Testes:** `docs/PLANO_DE_TESTES.md`
- **Deploy Checklist:** `docs/DEPLOY_CHECKLIST.md`
- **Guia Rápido:** `docs/GUIA_RAPIDO.md`
- **Webhooks:** `docs/WEBHOOKS_COMPLETOS.md`

---

## 🎉 CONCLUSÃO

Seguindo este guia, você irá:

1. ✅ Validar que tudo está pronto
2. ✅ Aplicar migration com segurança
3. ✅ Configurar credenciais
4. ✅ Testar localmente
5. ✅ Testar webhooks com ngrok
6. ✅ Executar testes unitários
7. ✅ Fazer deploy (opcional)

**Tempo Total Estimado:** 1-2 horas

**Dificuldade:** Média

**Resultado Final:** Sistema 100% funcional com Nuvemshop + Smartenvios! 🚀

---

**Precisa de ajuda?**

- Consulte a documentação técnica
- Verifique os logs detalhadamente
- Use o troubleshooting acima

**Última atualização:** 26 de Outubro de 2025
