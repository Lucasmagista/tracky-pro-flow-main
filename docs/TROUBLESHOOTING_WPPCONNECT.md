# 🔧 Troubleshooting - WPPConnect

## ❌ Problema: "The browser is already running"

**Erro completo:**
```
The browser is already running for C:\Users\...\tokens\session_xxx. 
Use a different `userDataDir` or stop the running browser first.
```

### Causa
Uma sessão anterior não foi fechada corretamente e o navegador Chrome ainda está em execução.

### Soluções

#### Solução 1: Fechar processos Chrome (Recomendado)
1. Pare o servidor WPPConnect (Ctrl+C)
2. Abra o Gerenciador de Tarefas (Ctrl+Shift+Esc)
3. Procure por processos "Chrome" ou "chrome.exe"
4. Finalize todos os processos do Chrome
5. Reinicie o servidor: `node wppconnect-server.js`

#### Solução 2: Limpar pasta de tokens
1. Pare o servidor WPPConnect (Ctrl+C)
2. Delete a pasta `tokens/` na raiz do projeto
3. Reinicie o servidor: `node wppconnect-server.js`

#### Solução 3: PowerShell (Rápido)
```powershell
# Parar servidor (Ctrl+C)
# Depois execute:
Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\tokens" -Recurse -Force -ErrorAction SilentlyContinue
node wppconnect-server.js
```

---

## ❌ Problema: QR Code não aparece no frontend

**Sintoma:** O servidor gera QR Code (vejo no log) mas não aparece na interface.

### Causa
O QR Code foi gerado mas a resposta HTTP não retornou o código base64.

### Solução
✅ **JÁ CORRIGIDO** na última atualização do `wppconnect-server.js`

Reinicie o servidor:
```bash
# Parar servidor atual (Ctrl+C)
node wppconnect-server.js
```

---

## ❌ Problema: "Auto Close Called"

**Sintoma:** Servidor fecha a sessão automaticamente após 60 segundos.

### Causa
O auto-close estava configurado para 60 segundos por padrão.

### Solução
✅ **JÁ CORRIGIDO** - `autoClose: 0` (desabilitado)

O QR Code agora permanece válido até você escanear ou fechar manualmente.

---

## ❌ Problema: Sessão não conecta após escanear QR Code

**Sintoma:** Escaneio o QR Code mas o status continua "Desconectado".

### Verificações

1. **Celular com internet?**
   - Confirme que seu celular está conectado à internet
   - WhatsApp deve estar aberto

2. **QR Code válido?**
   - QR Codes expiram após alguns minutos
   - Clique em "Conectar WhatsApp" novamente para gerar novo QR Code

3. **Servidor rodando?**
   - Verifique se `node wppconnect-server.js` está executando
   - Não deve ter erros no terminal

4. **Polling ativo?**
   - O frontend verifica status a cada 3 segundos
   - Aguarde até 10 segundos após escanear

---

## ❌ Problema: Erro ao enviar mensagem

**Sintoma:** Mensagem de teste não envia.

### Verificações

1. **Status conectado?**
   - Badge deve estar verde: "Conectado"
   - Botão "Verificar Status" confirma conexão

2. **Formato do número?**
   ```
   ✅ Correto: 5511987654321 (DDI + DDD + número)
   ❌ Errado: +55 (11) 98765-4321
   ❌ Errado: 11987654321 (sem DDI)
   ```

3. **Número existe?**
   - Número deve estar ativo no WhatsApp
   - Teste com seu próprio número primeiro

4. **Limite diário?**
   - Verifique se não atingiu o limite configurado
   - Padrão: 1000 mensagens/dia

---

## ❌ Problema: Servidor não inicia

### Erro: "Cannot find module '@wppconnect-team/wppconnect'"

**Solução:**
```bash
npm install @wppconnect-team/wppconnect express cors
```

### Erro: "Port 21465 is already in use"

**Solução:**
```powershell
# Parar processo na porta 21465
Get-Process -Id (Get-NetTCPConnection -LocalPort 21465).OwningProcess | Stop-Process -Force
```

Ou mude a porta no `.env`:
```env
WPP_PORT=21466
```

### Erro: "require is not defined"

**Solução:**
✅ **JÁ CORRIGIDO** - Convertido para ES Modules (import)

Se ainda ocorrer, verifique que `wppconnect-server.js` usa `import` e não `require`.

---

## ✅ Comandos Úteis

### Limpar tudo e recomeçar
```powershell
# Parar servidor (Ctrl+C)
Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\tokens" -Recurse -Force -ErrorAction SilentlyContinue
npm install
node wppconnect-server.js
```

### Verificar se servidor está rodando
```powershell
curl http://localhost:21465/health
```

### Ver logs detalhados
O servidor já exibe logs detalhados. Para mais debug, edite `wppconnect-server.js`:
```javascript
debug: true,  // Mudar de false para true
logQR: true,  // Mostrar QR Code no terminal
```

---

## 📞 Passo a Passo Completo

### 1. Limpar ambiente
```powershell
# Fechar Chrome
Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue

# Limpar tokens antigos
Remove-Item -Path ".\tokens" -Recurse -Force -ErrorAction SilentlyContinue
```

### 2. Iniciar servidor
```bash
node wppconnect-server.js
```

Aguarde até ver:
```
🚀 Servidor WPPConnect rodando na porta 21465
📱 Pronto para receber conexões do WhatsApp
```

### 3. Conectar WhatsApp
1. Abra a aplicação web
2. Vá em **Perfil** → **Configurar WhatsApp**
3. Digite nome da sessão (ex: `minha-empresa`)
4. Clique **"Conectar WhatsApp"**
5. Aguarde o QR Code aparecer (até 10 segundos)
6. Escaneie com seu celular
7. Aguarde status mudar para "Conectado" (até 10 segundos)

### 4. Testar envio
1. Clique em **"Enviar Teste"**
2. Digite seu número: `5511987654321`
3. Digite mensagem de teste
4. Clique **"Enviar Teste"**
5. Verifique se recebeu no WhatsApp

---

## 🐛 Logs Importantes

### Log de sucesso:
```
QR Code gerado para sessão xxx (tentativa 1)
Estado da sessão xxx mudou para: CONNECTED
```

### Log de erro - Browser travado:
```
The browser is already running for ...
```
**Solução:** Matar processos Chrome

### Log de erro - Auto close:
```
Auto Close Called
```
**Solução:** ✅ Já corrigido (autoClose: 0)

### Log de erro - Timeout:
```
Failed to authenticate
qrReadError
```
**Solução:** Gerar novo QR Code

---

## 🔍 Debug Avançado

### Ver sessões ativas
```bash
curl http://localhost:21465/health
```

Resposta:
```json
{
  "status": "ok",
  "activeSessions": ["session_xxx"],
  "timestamp": "2025-10-24T..."
}
```

### Forçar fechamento de sessão travada
```bash
curl -X DELETE http://localhost:21465/api/session_xxx/force-close \
  -H "Authorization: Bearer THISISMYSECURETOKEN"
```

### Verificar status de sessão
```bash
curl http://localhost:21465/api/session_xxx/check-connection-session \
  -H "Authorization: Bearer THISISMYSECURETOKEN"
```

---

## 📝 Checklist de Troubleshooting

Quando algo não funcionar, siga esta ordem:

- [ ] Servidor rodando? (`node wppconnect-server.js`)
- [ ] Sem erros no terminal do servidor?
- [ ] Processos Chrome fechados? (Gerenciador de Tarefas)
- [ ] Pasta `tokens/` limpa? (se necessário)
- [ ] URL correta? (`http://localhost:21465`)
- [ ] Token correto? (`THISISMYSECURETOKEN`)
- [ ] Frontend rodando? (`npm run dev`)
- [ ] Console do navegador sem erros? (F12)
- [ ] Internet funcionando? (celular e computador)
- [ ] WhatsApp instalado no celular?
- [ ] Celular com internet?

---

## 🆘 Última Tentativa (Reset Completo)

Se nada funcionar:

```powershell
# 1. Parar TUDO
Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# 2. Limpar TUDO
Remove-Item -Path ".\tokens" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".\node_modules" -Recurse -Force -ErrorAction SilentlyContinue

# 3. Reinstalar
npm install

# 4. Verificar migração SQL
# Execute no Supabase se ainda não fez!

# 5. Reiniciar servidor
node wppconnect-server.js

# 6. Em outro terminal, reiniciar app
npm run dev
```

Depois tente conectar novamente seguindo o passo a passo.

---

## 📚 Links Úteis

- [Documentação WPPConnect](https://wppconnect.io/)
- [Issues GitHub](https://github.com/wppconnect-team/wppconnect/issues)
- Documentação local: `WPPCONNECT_SETUP.md`
- Guia rápido: `WPPCONNECT_QUICKSTART.md`

---

**Última atualização:** 24 de outubro de 2025  
**Versão:** 1.1 (corrigido autoClose e QR Code)
