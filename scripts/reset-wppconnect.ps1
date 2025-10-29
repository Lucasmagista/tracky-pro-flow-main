# Script de limpeza e reinício do WPPConnect
# Execute: .\reset-wppconnect.ps1

Write-Host "🔧 Limpando ambiente WPPConnect..." -ForegroundColor Cyan
Write-Host ""

# 1. Parar processos Chrome
Write-Host "1️⃣ Fechando processos Chrome..." -ForegroundColor Yellow
try {
    Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
    Write-Host "✅ Processos Chrome fechados" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Nenhum processo Chrome encontrado" -ForegroundColor DarkYellow
}

Start-Sleep -Seconds 1

# 2. Limpar pasta tokens
Write-Host ""
Write-Host "2️⃣ Limpando pasta tokens..." -ForegroundColor Yellow
if (Test-Path ".\tokens") {
    try {
        Remove-Item -Path ".\tokens" -Recurse -Force -ErrorAction Stop
        Write-Host "✅ Pasta tokens removida" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erro ao remover pasta tokens: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Pasta tokens não existe" -ForegroundColor DarkYellow
}

Start-Sleep -Seconds 1

# 3. Verificar servidor
Write-Host ""
Write-Host "3️⃣ Verificando servidor..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:21465/health" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "⚠️ Servidor ainda está rodando!" -ForegroundColor Yellow
    Write-Host "   Por favor, pare o servidor (Ctrl+C) e execute este script novamente" -ForegroundColor Yellow
    exit 1
} catch {
    Write-Host "✅ Porta 21465 livre" -ForegroundColor Green
}

# 4. Sucesso
Write-Host ""
Write-Host "✅ Ambiente limpo com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Execute: node wppconnect-server.js" -ForegroundColor White
Write-Host "   2. Aguarde o servidor iniciar" -ForegroundColor White
Write-Host "   3. Acesse a aplicação e conecte seu WhatsApp" -ForegroundColor White
Write-Host ""
