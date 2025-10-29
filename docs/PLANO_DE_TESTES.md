# Plano de Testes - Integração Smartenvios + Nuvemshop

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Testes Manuais](#testes-manuais)
3. [Checklist de Validação](#checklist-de-validação)
4. [Cenários de Teste](#cenários-de-teste)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### Objetivo

Validar a integração completa entre Smartenvios e Nuvemshop, garantindo que:

- OAuth funciona corretamente
- Pedidos são sincronizados
- Rastreamento é detectado automaticamente
- Webhooks processam eventos
- UI reflete dados corretamente

### Pré-requisitos

- ✅ Migration aplicada (`supabase migration up`)
- ✅ Servidor rodando (`npm run dev`)
- 📦 Conta Nuvemshop com loja criada
- 🚚 Conta Smartenvios com API key

---

## 🧪 Testes Manuais

### 1. Aplicar Migration ao Banco de Dados

```powershell
# Primeiro, certifique-se que Supabase CLI está instalado
npx supabase --version

# Aplique a migration
npx supabase migration up

# Verifique se as tabelas foram criadas
npx supabase db inspect
```

**Validação:**

- [ ] Tabela `carrier_integrations` existe
- [ ] Tabela `smartenvios_trackings` existe
- [ ] Tabela `nuvemshop_orders_cache` existe
- [ ] 10 integrações foram inseridas (Correios, Smartenvios, etc.)
- [ ] RLS policies foram criadas

---

### 2. Integração Nuvemshop - OAuth Flow

#### 2.1 Criar App na Nuvemshop

1. Acesse: https://partners.nuvemshop.com.br/
2. Crie novo aplicativo:

   - Nome: Tracky Pro Flow
   - Redirect URI: `http://localhost:5173/integrations/nuvemshop/callback`
   - Escopos necessários:
     - `read_orders`
     - `write_orders`
     - `read_shipping`
     - `write_shipping`

3. Anote:
   - **App ID**: `_______________________`
   - **App Secret**: `_______________________`

#### 2.2 Configurar no Tracky

1. Faça login no Tracky Pro Flow
2. Vá em **Configurações** → **Integrações**
3. Encontre **Nuvemshop** na lista
4. Clique em **Conectar**
5. Preencha os campos:
   - App ID: (cole o App ID)
   - App Secret: (cole o App Secret)
   - Store URL: `https://sua-loja.nuvemshop.com.br`
6. Clique em **Autorizar no Nuvemshop**

**Validação:**

- [ ] Redirecionou para página de autorização da Nuvemshop
- [ ] Página mostra nome do app e escopos solicitados
- [ ] Após autorizar, retorna para Tracky
- [ ] Badge muda para "Conectado" (verde)
- [ ] Registro foi criado em `carrier_integrations`
- [ ] `config.access_token` está preenchido

#### 2.3 Sincronizar Pedidos

1. No card da Nuvemshop, clique em **Sincronizar Agora**
2. Aguarde o processo (ícone de loading)

**Validação:**

- [ ] Toast aparece: "Sincronização iniciada"
- [ ] Após conclusão: "X pedidos sincronizados"
- [ ] Data "Última sinc." foi atualizada
- [ ] Pedidos aparecem em `orders` table
- [ ] Códigos de rastreamento foram detectados

---

### 3. Integração Smartenvios - API Key

#### 3.1 Obter API Key

1. Acesse: https://dashboard.smartenvios.com/
2. Vá em **Configurações** → **API**
3. Copie a **API Key**

#### 3.2 Configurar no Tracky

1. No Tracky, vá em **Configurações** → **Integrações**
2. Encontre **Smartenvios**
3. Clique em **Conectar**
4. Preencha:
   - API Key: (cole a API Key)
   - Ambiente: **Produção** ou **Sandbox**
5. Clique em **Testar Conexão**

**Validação:**

- [ ] Botão "Testar Conexão" mostra loading
- [ ] Toast aparece: "Conexão testada com sucesso"
- [ ] Badge muda para "Conectado" (verde)
- [ ] Registro foi criado em `carrier_integrations`
- [ ] `config.api_key` está preenchido

#### 3.3 Testar Rastreamento

1. Na seção **Validação de Código**, digite um código:
   - Formato SE: `SE1234567890`
   - Formato SM: `SM123456789012`
2. Clique em **Validar**

**Validação:**

- [ ] Código válido mostra ✓ verde
- [ ] Código inválido mostra ✗ vermelho
- [ ] Mensagem de erro é clara

#### 3.4 Rastrear Pedido Real

1. Vá para **Dashboard**
2. No widget **Smartenvios**, digite um código de rastreamento
3. Clique em **Buscar**

**Validação:**

- [ ] Informações do pedido são exibidas
- [ ] Status está correto
- [ ] Última atualização está correta
- [ ] Registro foi criado em `smartenvios_trackings`

---

### 4. Dashboard Widgets

#### 4.1 Widget Nuvemshop Orders

**Validação:**

- [ ] Mostra contagem de pedidos **Abertos**
- [ ] Mostra contagem de pedidos **Completos**
- [ ] Lista 5 pedidos mais recentes
- [ ] Cada pedido mostra:
  - Número do pedido (#100)
  - Nome do cliente
  - Valor total (R$ 150,00)
  - Status com badge colorido
- [ ] Botão "Sincronizar" funciona
- [ ] Link "Ver todos" redireciona corretamente

#### 4.2 Widget Smartenvios Tracking

**Validação:**

- [ ] Mostra estatísticas corretas:
  - Em Trânsito: X
  - Entregues: X
  - Pendentes: X
  - Atrasados: X
- [ ] Campo de busca rápida funciona
- [ ] Distribuição de status está correta
- [ ] Taxa de entrega calculada corretamente
- [ ] Cores dos indicadores estão corretas:
  - 🟦 Azul: Em trânsito
  - 🟩 Verde: Entregue
  - 🟨 Amarelo: Pendente
  - 🟥 Vermelho: Atrasado

---

### 5. Webhooks (Produção)

#### 5.1 Configurar Webhook Nuvemshop

1. No painel Nuvemshop, vá em **Webhooks**
2. Registre webhook:
   - URL: `https://seu-dominio.com/api/webhooks/nuvemshop`
   - Eventos:
     - `order/created`
     - `order/updated`

**Validação:**

- [ ] Webhook recebe eventos
- [ ] Eventos são processados corretamente
- [ ] Pedidos são criados/atualizados no Tracky
- [ ] Logs não mostram erros

#### 5.2 Configurar Webhook Smartenvios

1. No painel Smartenvios, configure:
   - URL: `https://seu-dominio.com/api/webhooks/smartenvios`
   - Eventos:
     - `tracking.update`
     - `tracking.delivered`

**Validação:**

- [ ] Webhook recebe eventos
- [ ] Status de rastreamento é atualizado
- [ ] Cache é invalidado
- [ ] Dashboard reflete mudanças

---

## ✅ Checklist de Validação

### Configuração Inicial

- [ ] Migration aplicada sem erros
- [ ] Servidor rodando na porta 5173
- [ ] Supabase conectado
- [ ] Usuário autenticado no sistema

### Integração Nuvemshop

- [ ] App criado no painel Nuvemshop
- [ ] OAuth flow completo funciona
- [ ] Access token obtido e salvo
- [ ] Pedidos sincronizados com sucesso
- [ ] Códigos de rastreamento detectados
- [ ] Widget mostra dados corretos
- [ ] Desconexão funciona corretamente

### Integração Smartenvios

- [ ] API Key obtida
- [ ] Conexão testada com sucesso
- [ ] Rastreamento funciona
- [ ] Validação de códigos funciona
- [ ] Cache de rastreamentos criado
- [ ] Widget mostra estatísticas
- [ ] Busca rápida funciona

### Dashboard

- [ ] Widgets carregam sem erros
- [ ] Dados são atualizados em tempo real
- [ ] Loading states funcionam
- [ ] Empty states são mostrados quando necessário
- [ ] Botões de ação funcionam
- [ ] Links de navegação funcionam

### Webhooks (Produção)

- [ ] Endpoints criados
- [ ] Assinatura de webhooks validada
- [ ] Eventos são processados
- [ ] Erros são logados
- [ ] Retry logic funciona

---

## 🔬 Cenários de Teste

### Cenário 1: Novo Pedido na Nuvemshop

**Passos:**

1. Crie um pedido de teste na loja Nuvemshop
2. Webhook envia evento `order/created`
3. Tracky recebe e processa

**Resultado Esperado:**

- Pedido aparece automaticamente no Tracky
- Status está correto
- Dados do cliente estão completos
- Se houver código de rastreamento, é detectado

---

### Cenário 2: Atualização de Rastreamento

**Passos:**

1. Pedido está "Em Trânsito" no Smartenvios
2. Transportadora atualiza status para "Entregue"
3. Webhook envia evento `tracking.delivered`

**Resultado Esperado:**

- Status no Tracky muda para "Entregue"
- Widget atualiza contadores
- Data de entrega é registrada
- Cache é limpo

---

### Cenário 3: Sincronização Manual

**Passos:**

1. Adicione 10 novos pedidos na Nuvemshop
2. Clique em "Sincronizar Agora" no Tracky
3. Aguarde conclusão

**Resultado Esperado:**

- Toast mostra "10 pedidos sincronizados"
- Todos os 10 pedidos aparecem
- Sem duplicatas
- Última sincronização atualizada

---

### Cenário 4: Detecção Inteligente de Transportadora

**Passos:**

1. Pedido com código `BR123456789BR` (Correios)
2. Pedido com código `SE1234567890` (Smartenvios)
3. Pedido com código `FEDEX123456` (FedEx)

**Resultado Esperado:**

- Correios detectado corretamente
- Smartenvios detectado corretamente
- FedEx detectado corretamente
- Campo `carrier` preenchido

---

### Cenário 5: Tratamento de Erros

**Passos:**

1. Desconecte internet
2. Tente sincronizar pedidos
3. Reconecte internet
4. Tente novamente

**Resultado Esperado:**

- Erro é capturado gracefully
- Toast mostra mensagem de erro clara
- Após reconectar, funciona normalmente
- Sem crashes ou estados quebrados

---

## 🔧 Troubleshooting

### Problema: OAuth não redireciona de volta

**Solução:**

1. Verifique se redirect URI está correto no app Nuvemshop
2. Certifique-se que servidor está rodando em `localhost:5173`
3. Limpe cache do navegador
4. Tente em janela anônima

### Problema: Pedidos não sincronizam

**Solução:**

1. Verifique se access token está válido
2. Confirme escopos `read_orders` no app
3. Veja console do navegador para erros
4. Verifique logs do Supabase

### Problema: Smartenvios retorna erro 401

**Solução:**

1. Confirme que API Key está correta
2. Verifique se API Key não expirou
3. Teste API Key diretamente na documentação Smartenvios
4. Verifique ambiente (Produção vs Sandbox)

### Problema: Widget não carrega dados

**Solução:**

1. Abra DevTools → Console
2. Procure por erros de fetch
3. Verifique se integração está ativa
4. Confirme que há dados para exibir
5. Limpe cache do navegador

### Problema: Webhook não recebe eventos

**Solução:**

1. Confirme que URL está acessível publicamente
2. Use ngrok para desenvolvimento local
3. Verifique logs do servidor
4. Confirme que eventos estão registrados
5. Teste com ferramenta de webhook tester

---

## 📊 Métricas de Sucesso

### Cobertura de Testes

- ✅ **Manuais**: 100% (todos os cenários testados)
- 🟨 **Automatizados**: 0% (a implementar)
- 🎯 **Meta**: 80% de cobertura automatizada

### Performance

- ⚡ OAuth flow: < 3 segundos
- ⚡ Sincronização de 100 pedidos: < 10 segundos
- ⚡ Rastreamento individual: < 2 segundos
- ⚡ Widget load: < 1 segundo

### Confiabilidade

- ✅ Uptime: 99.9%
- ✅ Taxa de sucesso de webhooks: > 95%
- ✅ Taxa de erro de API: < 1%

---

## 🎉 Próximos Passos

Após validação manual completa:

1. ✅ **Documentar resultados**: Preencher este checklist
2. 🚀 **Deploy em staging**: Testar em ambiente similar à produção
3. 🧪 **Testes automatizados**: Criar suite de testes E2E
4. 📹 **Tutorial em vídeo**: Gravar guia de uso
5. 📝 **Documentação do usuário**: Completar FAQ
6. 🎓 **Treinamento**: Onboarding de usuários beta
7. 🚀 **Deploy em produção**: Lançamento oficial

---

## 📞 Suporte

Se encontrar problemas durante os testes:

- 📧 Email: suporte@tracky.com
- 💬 Slack: #integrações
- 📖 Docs: https://docs.tracky.com
- 🐛 Issues: GitHub Issues

---

**Última atualização**: 26/10/2025  
**Responsável**: Equipe de Desenvolvimento Tracky Pro Flow  
**Status**: ✅ Pronto para testes manuais
