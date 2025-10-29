# Configuração do WhatsApp com WPPConnect

Este guia explica como configurar e usar o WhatsApp para enviar notificações automáticas usando WPPConnect.

## 📋 O que é WPPConnect?

WPPConnect é uma biblioteca JavaScript que permite conectar ao WhatsApp Web sem precisar da API oficial do Meta. Você se conecta escaneando um QR Code, exatamente como faz no WhatsApp Web.

### Vantagens
✅ Não precisa de aprovação do Meta  
✅ Não precisa da API oficial  
✅ Conexão via QR Code (simples e rápido)  
✅ Gratuito e open-source  
✅ Suporta todos os recursos do WhatsApp Web  

### Limitações
⚠️ Requer um servidor Node.js rodando  
⚠️ Celular precisa estar com internet  
⚠️ Não é permitido uso comercial massivo (pode resultar em ban)  

## 🚀 Instalação

### 1. Instalar Dependências

As dependências já foram instaladas automaticamente. Caso precise reinstalar:

```bash
npm install @wppconnect-team/wppconnect express cors
```

### 2. Configurar Variáveis de Ambiente

O arquivo `.env` já está configurado com:

```env
# WPPConnect Configuration
VITE_WPP_SERVER_URL="http://localhost:21465"
VITE_WPP_SECRET_KEY="THISISMYSECURETOKEN"
WPP_PORT=21465
WPP_SECRET_KEY="THISISMYSECURETOKEN"
```

**⚠️ IMPORTANTE**: Mude o `WPP_SECRET_KEY` para um token secreto personalizado em produção!

### 3. Executar Migração do Banco de Dados

Execute o SQL no Supabase SQL Editor:

```bash
supabase/migrations/add_wppconnect_columns.sql
```

Ou copie e execute manualmente no Supabase Dashboard:

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_session_name TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT CHECK (whatsapp_status IN ('connected', 'disconnected', 'connecting', 'qr')),
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_last_activity TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS whatsapp_auto_reply BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS whatsapp_business_hours BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_daily_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS whatsapp_templates_enabled BOOLEAN DEFAULT true;
```

## 🎯 Como Usar

### 1. Iniciar o Servidor WPPConnect

Abra um terminal e execute:

```bash
node wppconnect-server.js
```

Você verá algo como:

```
🚀 Servidor WPPConnect rodando na porta 21465
📱 Pronto para receber conexões do WhatsApp
🔑 Secret Key: THISISMYSECURETOKEN

💡 Endpoints disponíveis:
   POST /api/:sessionName/start-session
   GET  /api/:sessionName/check-connection-session
   POST /api/:sessionName/logout-session
   POST /api/:sessionName/send-message
   POST /api/:sessionName/send-image
   GET  /api/:sessionName/show-all-contacts
   GET  /health
```

**Mantenha este terminal aberto!** O servidor precisa estar rodando para o WhatsApp funcionar.

### 2. Conectar seu WhatsApp

1. Acesse a aplicação no navegador
2. Vá em **Perfil** → **Configurar WhatsApp**
3. Digite um nome para sua sessão (ex: `minha-empresa`)
4. Clique em **Conectar WhatsApp**
5. Um QR Code aparecerá na tela
6. Abra o WhatsApp no celular
7. Vá em **Menu** → **Aparelhos conectados** → **Conectar aparelho**
8. Escaneie o QR Code
9. Aguarde a confirmação de conexão ✅

### 3. Configurar Notificações

Após conectar:

1. Ative o switch **"Ativar Notificações"**
2. Configure o limite diário de mensagens (recomendado: 1000)
3. Configure as opções avançadas:
   - Resposta automática
   - Horário comercial
   - Uso de templates
4. Clique em **Salvar Configurações**

### 4. Testar o Envio

1. Clique em **Enviar Teste**
2. Digite um número de telefone (formato: 5511987654321)
3. Escreva uma mensagem de teste
4. Clique em **Enviar Teste**
5. Verifique se recebeu a mensagem no WhatsApp ✅

## 📱 Uso Programático

### Enviar Mensagem

```typescript
import { whatsappService } from '@/services/whatsappService';

// Enviar mensagem de texto
const result = await whatsappService.sendMessage(
  'minha-sessao',  // Nome da sessão
  '5511987654321', // Número (com código do país)
  'Olá! Seu pedido foi enviado.' // Mensagem
);

if (result.success) {
  console.log('Mensagem enviada!', result.messageId);
} else {
  console.error('Erro:', result.error);
}
```

### Enviar Imagem

```typescript
// Enviar imagem com legenda
const result = await whatsappService.sendImage(
  'minha-sessao',
  '5511987654321',
  'https://example.com/imagem.jpg', // URL da imagem
  'Confira a foto do seu pedido!' // Legenda (opcional)
);
```

### Verificar Status da Sessão

```typescript
const session = await whatsappService.checkSession('minha-sessao');

if (session?.status === 'connected') {
  console.log('WhatsApp conectado como:', session.phone);
} else {
  console.log('WhatsApp desconectado');
}
```

## 🔧 API do Servidor

### POST /api/:sessionName/start-session
Inicia uma nova sessão e gera QR Code

**Headers:**
```
Authorization: Bearer THISISMYSECURETOKEN
```

**Response:**
```json
{
  "status": "QRCODE",
  "qrcode": "data:image/png;base64,...",
  "message": "Escaneie o QR Code"
}
```

### POST /api/:sessionName/send-message
Envia mensagem de texto

**Body:**
```json
{
  "phone": "5511987654321",
  "message": "Olá! Sua mensagem aqui."
}
```

**Response:**
```json
{
  "status": "success",
  "messageId": "true_5511987654321@c.us_3EB...",
  "message": "Message sent successfully"
}
```

### POST /api/:sessionName/logout-session
Desconecta a sessão

**Response:**
```json
{
  "status": true,
  "message": "Successfully closed session"
}
```

## 🎨 Templates de Mensagens

Você pode criar templates personalizados em **Configurações** → **Notificações** → **Templates**.

Exemplo de template:

```
Olá {{cliente}}!

Seu pedido #{{pedido}} foi {{status}}.

Transportadora: {{transportadora}}
Código de rastreamento: {{codigo}}

Acompanhe em: {{link}}

Qualquer dúvida, estamos à disposição!
```

Variáveis disponíveis:
- `{{cliente}}` - Nome do cliente
- `{{pedido}}` - Número do pedido
- `{{status}}` - Status atual
- `{{transportadora}}` - Nome da transportadora
- `{{codigo}}` - Código de rastreamento
- `{{link}}` - Link de rastreamento

## 🔄 Automações

Configure notificações automáticas para:

- ✅ Pedido criado
- 📦 Pedido em trânsito
- 🚚 Pedido saiu para entrega
- ✨ Pedido entregue
- ⚠️ Atraso detectado
- ❌ Falha na entrega

As mensagens serão enviadas automaticamente quando o status mudar.

## ⚠️ Importante

### Limitações do WhatsApp

1. **Limite de mensagens**: Recomendamos máximo 1000 mensagens/dia
2. **Spam**: Evite enviar mensagens não solicitadas
3. **Ban**: O WhatsApp pode banir números que violarem os termos
4. **Business**: Para uso comercial massivo, use a API oficial

### Boas Práticas

✅ Sempre peça permissão antes de enviar mensagens  
✅ Respeite horários comerciais  
✅ Forneça opção de opt-out (cancelar recebimento)  
✅ Não envie propaganda não solicitada  
✅ Mantenha mensagens relevantes e úteis  

### Segurança

🔒 **Nunca compartilhe seu token secreto**  
🔒 **Use HTTPS em produção**  
🔒 **Implemente rate limiting**  
🔒 **Monitore uso suspeito**  

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se o servidor está rodando (`node wppconnect-server.js`)
- Confirme que a porta 21465 está disponível
- Verifique o console do navegador por erros

### Conexão não completa
- Certifique-se de escanear o QR Code rapidamente (expira em 2 minutos)
- Verifique se seu celular está com internet
- Tente fechar e reabrir o WhatsApp no celular

### Mensagens não enviam
- Confirme que a sessão está conectada (status "Conectado")
- Verifique o formato do número: 5511987654321 (sem espaços ou caracteres especiais)
- Confira se não atingiu o limite diário
- Veja os logs do servidor no terminal

### Desconexão frequente
- Mantenha o servidor sempre rodando
- Certifique-se de que o celular está com internet estável
- Evite usar o mesmo número em múltiplos lugares

## 📚 Recursos Adicionais

- [Documentação WPPConnect](https://wppconnect.io/)
- [GitHub WPPConnect](https://github.com/wppconnect-team/wppconnect)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

## 🆘 Suporte

Se precisar de ajuda:

1. Verifique os logs do servidor no terminal
2. Confira o console do navegador (F12)
3. Revise este documento
4. Consulte a documentação oficial do WPPConnect

---

**Desenvolvido para Tracky Pro Flow** 🚀
