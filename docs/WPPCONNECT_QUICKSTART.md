# 🚀 Guia Rápido - WhatsApp com WPPConnect

## ⚡ Setup Rápido (5 minutos)

### 1️⃣ Executar Migração SQL
Abra o Supabase SQL Editor e execute:

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

### 2️⃣ Iniciar Servidor WPPConnect
Em um terminal, execute:

```bash
node wppconnect-server.js
```

**NÃO FECHE ESTE TERMINAL!** Deixe rodando em segundo plano.

### 3️⃣ Conectar WhatsApp
1. Abra a aplicação no navegador
2. Vá em **Perfil** → **Configurar WhatsApp**
3. Digite um nome de sessão (ex: `minha-empresa`)
4. Clique em **"Conectar WhatsApp"**
5. Escaneie o QR Code com seu celular
6. Aguarde a confirmação ✅

### 4️⃣ Testar
1. Ative as notificações
2. Clique em **"Enviar Teste"**
3. Digite seu número (ex: 5511987654321)
4. Envie uma mensagem de teste
5. Verifique se recebeu no WhatsApp ✅

## 📦 Arquivos Criados

```
tracky-pro-flow-main/
├── wppconnect-server.js           # Servidor WPPConnect
├── src/
│   ├── pages/
│   │   └── WhatsAppConfig.tsx     # Página de configuração (1118 linhas)
│   └── services/
│       └── whatsappService.ts     # Serviço de integração (328 linhas)
├── supabase/
│   └── migrations/
│       └── add_wppconnect_columns.sql  # Migração do banco
├── WPPCONNECT_SETUP.md            # Documentação completa
└── WPPCONNECT_QUICKSTART.md       # Este guia rápido
```

## 🎯 Funcionalidades Implementadas

### Interface Visual
✅ Status da conexão em tempo real (Conectado/Desconectado)  
✅ Indicador visual com ícones (Wifi/WifiOff)  
✅ Badge de status colorido  
✅ QR Code em dialog modal  
✅ Estatísticas de mensagens  
✅ Progresso de entrega e leitura  
✅ Tabs organizadas (Configuração, Templates, Automação)  

### Funcionalidades Core
✅ Conexão via QR Code  
✅ Verificação de status automática  
✅ Desconexão segura  
✅ Envio de mensagens de texto  
✅ Envio de imagens  
✅ Templates personalizados  
✅ Automações configuráveis  
✅ Limite diário de mensagens  
✅ Horário comercial  
✅ Resposta automática  
✅ Logging de ações  
✅ Persistência no banco de dados  

### Servidor WPPConnect
✅ API REST completa  
✅ Autenticação com token  
✅ Gerenciamento de sessões  
✅ Múltiplas sessões simultâneas  
✅ Eventos em tempo real  
✅ Health check endpoint  
✅ Encerramento gracioso  

## 🔧 Comandos Úteis

### Iniciar servidor
```bash
node wppconnect-server.js
```

### Iniciar aplicação
```bash
npm run dev
```

### Build para produção
```bash
npm run build
```

## 📝 Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/:session/start-session` | Iniciar sessão e gerar QR Code |
| GET | `/api/:session/check-connection-session` | Verificar status |
| POST | `/api/:session/logout-session` | Desconectar |
| POST | `/api/:session/send-message` | Enviar mensagem |
| POST | `/api/:session/send-image` | Enviar imagem |
| GET | `/api/:session/show-all-contacts` | Listar contatos |
| GET | `/health` | Health check |

**Autenticação**: Todas as rotas requerem header:
```
Authorization: Bearer THISISMYSECURETOKEN
```

## 💡 Uso Programático

### Enviar notificação ao cliente
```typescript
import { whatsappService } from '@/services/whatsappService';

// Quando um pedido for atualizado
const notifyCustomer = async (order) => {
  const message = `
Olá ${order.customer_name}!

Seu pedido #${order.code} foi atualizado.

Status: ${order.status}
Transportadora: ${order.carrier}
Código: ${order.tracking_code}

Acompanhe: ${order.tracking_url}
  `.trim();

  const result = await whatsappService.sendMessage(
    'minha-sessao',
    order.customer_phone,
    message
  );

  if (result.success) {
    console.log('Notificação enviada!');
  }
};
```

## ⚠️ Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| QR Code não aparece | Verifique se o servidor está rodando |
| Não conecta | Escaneie rapidamente (QR expira em 2min) |
| Mensagem não envia | Confirme status "Conectado" |
| Servidor não inicia | Instale dependências: `npm install` |

## 🔐 Segurança

⚠️ **IMPORTANTE**: Em produção:

1. Mude o `WPP_SECRET_KEY` para um token forte
2. Use HTTPS
3. Implemente rate limiting
4. Monitore uso
5. Backup das sessões

## 📚 Documentação Completa

Leia `WPPCONNECT_SETUP.md` para documentação detalhada.

## ✅ Checklist de Implementação

- [x] Instalar WPPConnect
- [x] Criar servidor Node.js
- [x] Criar serviço de integração
- [x] Criar página de configuração
- [x] Implementar QR Code
- [x] Implementar envio de mensagens
- [x] Implementar templates
- [x] Implementar automações
- [x] Adicionar colunas no banco
- [x] Criar documentação
- [ ] Executar migração SQL (VOCÊ)
- [ ] Testar conexão (VOCÊ)
- [ ] Testar envio (VOCÊ)

## 🎉 Pronto!

Agora você tem um sistema completo de notificações via WhatsApp sem precisar da API oficial!

**Próximos passos**:
1. Execute a migração SQL
2. Inicie o servidor
3. Conecte seu WhatsApp
4. Envie uma mensagem de teste
5. Configure as automações

---

**Dúvidas?** Consulte `WPPCONNECT_SETUP.md` para mais detalhes.
