/**
 * Servidor WPPConnect para gerenciar sessões do WhatsApp
 * Execute este arquivo separadamente: node wppconnect-server.js
 */

import wppconnect from "@wppconnect-team/wppconnect";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Middleware de log para debug
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.WPP_PORT || 21465;
const SECRET_KEY = process.env.WPP_SECRET_KEY || "THISISMYSECURETOKEN";

// Diretório base para salvar tokens/sessions (útil para Docker volumes).
// Se não definido, o comportamento padrão (pasta relativa ao processo) será usado.
const TOKEN_BASE = process.env.WPP_TOKEN_DIR || null;

// Armazenar sessões ativas
const sessions = new Map();

// Armazenar QR Codes temporários
const qrCodes = new Map();

// Middleware de autenticação
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token === SECRET_KEY) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

/**
 * Iniciar uma nova sessão
 * POST /api/:sessionName/start-session
 */
app.post("/api/:sessionName/start-session", authenticate, async (req, res) => {
  const { sessionName } = req.params;

  try {
    // Se já existe uma sessão ativa, retornar QR Code se disponível
    if (sessions.has(sessionName)) {
      const storedQr = qrCodes.get(sessionName);
      if (storedQr) {
        console.log(`✅ Retornando QR Code armazenado para sessão existente ${sessionName}`);
        return res.json({
          status: "QRCODE",
          qrcode: storedQr,
          message: "QR Code disponível",
        });
      }
      
      const existingSession = sessions.get(sessionName);
      try {
        const state = await existingSession.getConnectionState();
        return res.json({
          status: state === "CONNECTED" ? "CONNECTED" : "CONNECTING",
          message: "Sessão já existe",
        });
      } catch (error) {
        console.log(`Removendo sessão inválida ${sessionName}`);
        sessions.delete(sessionName);
        qrCodes.delete(sessionName);
      }
    }

    let qrCodeData = null;
    let isConnected = false;
    let qrResolved = false;

    console.log(`🚀 Iniciando criação de sessão ${sessionName}...`);

    // NÃO USAR AWAIT - deixar criar em background
    // Se TOKEN_BASE estiver definido, criamos uma pasta específica por sessão dentro do diretório base.
    // Ex: /data/session_tokens/<sessionName>
    const folderNameToken = TOKEN_BASE ? `${TOKEN_BASE}/${sessionName}` : sessionName;

    wppconnect.create({
      session: sessionName,
      folderNameToken: folderNameToken,
      catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
        qrCodeData = base64Qr;
        qrCodes.set(sessionName, base64Qr);
        qrResolved = true;
        console.log(`✅ QR Code capturado para sessão ${sessionName} (tentativa ${attempts})`);
        console.log(`📊 QR Code length: ${base64Qr.length} caracteres`);
      },
      statusFind: (statusSession, session) => {
        console.log(`Status da sessão ${session}: ${statusSession}`);
        if (statusSession === "isLogged" || statusSession === "CONNECTED" || statusSession === "qrReadSuccess" || statusSession === "inChat") {
          isConnected = true;
          qrResolved = true;
          // Limpar QR Code quando conectar
          console.log(`🧹 Limpando QR Code armazenado para ${session} (status: ${statusSession})`);
          qrCodes.delete(session);
        }
      },
      headless: "new",
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: false,
      autoClose: 0,
      browserArgs: [
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    }).then((client) => {
      console.log(`✅ Cliente criado para sessão ${sessionName}`);
      sessions.set(sessionName, client);
      
      client.onStateChange((state) => {
        console.log(`Estado da sessão ${sessionName}: ${state}`);
        // Limpar QR Code quando conectar
        if (state === "CONNECTED" || state === "PAIRING") {
          console.log(`🧹 Limpando QR Code para ${sessionName} (estado: ${state})`);
          qrCodes.delete(sessionName);
        }
      });

      client.onIncomingCall(async (call) => {
        try {
          await client.rejectCall(call.id);
        } catch (error) {
          console.error(`Erro ao rejeitar chamada:`, error);
        }
      });
    }).catch((error) => {
      console.error(`❌ Erro ao criar cliente ${sessionName}:`, error.message);
      qrResolved = true; // Resolver para não travar
    });

    console.log(`⏳ Aguardando QR Code para ${sessionName}...`);

    // Aguardar até 30 segundos pelo QR Code
    let attempts = 0;
    const maxAttempts = 60;
    while (!qrResolved && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`⏳ Tentativa ${attempts}/60 - qrCodeData=${!!qrCodeData}, isConnected=${isConnected}`);
      }
    }

    console.log(`🏁 Resposta: qrCodeData=${!!qrCodeData}, isConnected=${isConnected}, attempts=${attempts}`);

    if (isConnected) {
      console.log(`✅ Conectado automaticamente`);
      return res.json({
        status: "CONNECTED",
        message: "Sessão conectada",
      });
    }

    if (qrCodeData) {
      console.log(`✅ Retornando QR Code (${qrCodeData.length} caracteres)`);
      return res.json({
        status: "QRCODE",
        qrcode: qrCodeData,
        message: "Escaneie o QR Code",
      });
    }

    console.error(`❌ Timeout - QR Code não foi gerado`);
    return res.status(408).json({
      status: "TIMEOUT",
      message: "Timeout ao gerar QR Code. Tente novamente.",
    });

  } catch (error) {
    console.error(`❌ Erro ao iniciar sessão ${sessionName}:`, error);
    sessions.delete(sessionName);
    qrCodes.delete(sessionName);
    
    res.status(500).json({
      error: "Erro ao iniciar sessão",
      message: error.message,
    });
  }
});

/**
 * Verificar status da sessão
 * GET /api/:sessionName/check-connection-session
 */
app.get("/api/:sessionName/check-connection-session", authenticate, async (req, res) => {
  const { sessionName } = req.params;

  try {
    if (!sessions.has(sessionName)) {
      return res.json({
        status: "DISCONNECTED",
        message: "Session not found",
      });
    }

    const client = sessions.get(sessionName);
    
    // PRIMEIRO verificar o estado da conexão
    const state = await client.getConnectionState();
    console.log(`🔍 Estado da conexão para ${sessionName}:`, state);

    if (state === "CONNECTED") {
      // Limpar QR Code armazenado quando conectar
      qrCodes.delete(sessionName);
      
      const phoneInfo = await client.getHostDevice();
      console.log(`✅ Sessão ${sessionName} CONECTADA`);
      
      return res.json({
        status: "CONNECTED",
        state: "CONNECTED",
        phone: phoneInfo.wid?.user,
        name: phoneInfo.pushname,
        message: "Connected"
      });
    }
    
    // Se não está conectado, verificar se há QR Code armazenado
    const storedQrCode = qrCodes.get(sessionName);
    if (storedQrCode) {
      console.log(`📱 QR Code disponível para ${sessionName}`);
      return res.json({
        status: "QRCODE",
        qrcode: storedQrCode,
        message: "QR Code disponível",
      });
    }
    
    // Retornar estado atual
    console.log(`⏳ Estado atual de ${sessionName}:`, state);
    return res.json({
      status: state,
      state: state,
    });
  } catch (error) {
    console.error(`❌ Erro ao verificar sessão ${sessionName}:`, error);
    res.json({
      status: "DISCONNECTED",
      message: error.message,
    });
  }
});

/**
 * Desconectar sessão
 * POST /api/:sessionName/logout-session
 */
app.post("/api/:sessionName/logout-session", authenticate, async (req, res) => {
  const { sessionName } = req.params;

  try {
    if (!sessions.has(sessionName)) {
      return res.json({
        status: true,
        message: "Session not found or already closed",
      });
    }

    const client = sessions.get(sessionName);
    
    try {
      await client.logout();
    } catch (logoutError) {
      console.error(`Erro no logout:`, logoutError);
    }
    
    try {
      await client.close();
    } catch (closeError) {
      console.error(`Erro ao fechar cliente:`, closeError);
    }
    
    sessions.delete(sessionName);

    // Limpar pasta de tokens (opcional, mas recomendado)
    console.log(`Sessão ${sessionName} desconectada e removida`);

    res.json({
      status: true,
      message: "Successfully closed session",
    });
  } catch (error) {
    console.error(`Erro ao desconectar sessão ${sessionName}:`, error);
    
    // Mesmo com erro, remover da lista
    sessions.delete(sessionName);
    
    res.json({
      status: true,
      message: "Session closed with errors",
      error: error.message,
    });
  }
});

/**
 * Enviar mensagem de texto
 * POST /api/:sessionName/send-message
 */
app.post("/api/:sessionName/send-message", authenticate, async (req, res) => {
  const { sessionName } = req.params;
  const { phone, message } = req.body;

  try {
    if (!sessions.has(sessionName)) {
      return res.status(404).json({
        status: "error",
        message: "Session not found. Please start session first.",
      });
    }

    const client = sessions.get(sessionName);
    const result = await client.sendText(phone, message);

    res.json({
      status: "success",
      result: "success",
      messageId: result.id,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error(`Erro ao enviar mensagem na sessão ${sessionName}:`, error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

/**
 * Enviar imagem
 * POST /api/:sessionName/send-image
 */
app.post("/api/:sessionName/send-image", authenticate, async (req, res) => {
  const { sessionName } = req.params;
  const { phone, path, caption } = req.body;

  try {
    if (!sessions.has(sessionName)) {
      return res.status(404).json({
        status: "error",
        message: "Session not found",
      });
    }

    const client = sessions.get(sessionName);
    const result = await client.sendImage(phone, path, "image", caption || "");

    res.json({
      status: "success",
      result: "success",
      messageId: result.id,
    });
  } catch (error) {
    console.error(`Erro ao enviar imagem na sessão ${sessionName}:`, error);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

/**
 * Obter todos os contatos
 * GET /api/:sessionName/show-all-contacts
 */
app.get("/api/:sessionName/show-all-contacts", authenticate, async (req, res) => {
  const { sessionName } = req.params;

  try {
    if (!sessions.has(sessionName)) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    const client = sessions.get(sessionName);
    const contacts = await client.getAllContacts();
    const me = await client.getHostDevice();

    res.json({
      contacts: contacts,
      me: me,
    });
  } catch (error) {
    console.error(`Erro ao obter contatos da sessão ${sessionName}:`, error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * Health check
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    activeSessions: Array.from(sessions.keys()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Limpar sessão travada (força remoção)
 * DELETE /api/:sessionName/force-close
 */
app.delete("/api/:sessionName/force-close", authenticate, async (req, res) => {
  const { sessionName } = req.params;

  try {
    if (sessions.has(sessionName)) {
      const client = sessions.get(sessionName);
      try {
        await client.close();
      } catch (error) {
        console.error(`Erro ao fechar (ignorado):`, error);
      }
      sessions.delete(sessionName);
    }

    res.json({
      status: true,
      message: "Session force closed",
    });
  } catch (error) {
    console.error(`Erro ao forçar fechamento:`, error);
    res.json({
      status: true,
      message: "Session removed from memory",
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor WPPConnect rodando na porta ${PORT}`);
  console.log(`📱 Pronto para receber conexões do WhatsApp`);
  console.log(`🔑 Secret Key: ${SECRET_KEY}`);
  console.log(`\n💡 Endpoints disponíveis:`);
  console.log(`   POST /api/:sessionName/start-session`);
  console.log(`   GET  /api/:sessionName/check-connection-session`);
  console.log(`   POST /api/:sessionName/logout-session`);
  console.log(`   POST /api/:sessionName/send-message`);
  console.log(`   POST /api/:sessionName/send-image`);
  console.log(`   GET  /api/:sessionName/show-all-contacts`);
  console.log(`   GET  /health\n`);
});

// Lidar com encerramento gracioso
process.on("SIGINT", async () => {
  console.log("\n🛑 Encerrando servidor...");
  
  for (const [sessionName, client] of sessions.entries()) {
    console.log(`   Desconectando sessão ${sessionName}...`);
    try {
      await client.close();
    } catch (error) {
      console.error(`   Erro ao fechar sessão ${sessionName}:`, error.message);
    }
  }
  
  console.log("✅ Servidor encerrado com sucesso");
  process.exit(0);
});
