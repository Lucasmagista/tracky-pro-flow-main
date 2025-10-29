# Script para limpar sessões WPPConnect travadas
Write-Host "🧹 Limpando sessões WPPConnect..." -ForegroundColor Cyan

# 1. Parar processos do Chrome relacionados ao WPPConnect
Write-Host "`n1️⃣ Encerrando processos do Chrome..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*chrome*" -or $_.ProcessName -like "*chromium*" } | ForEach-Object {
    try {
        $_ | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Processo encerrado: $($_.Id) - $($_.ProcessName)" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️ Não foi possível encerrar: $($_.ProcessName)" -ForegroundColor Yellow
    }
}

# 2. Remover pasta tokens
Write-Host "`n2️⃣ Removendo pasta tokens..." -ForegroundColor Yellow
$tokensPath = ".\tokens"
if (Test-Path $tokensPath) {
    try {
        Remove-Item -Path $tokensPath -Recurse -Force -ErrorAction Stop
        Write-Host "   ✅ Pasta tokens removida com sucesso" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Erro ao remover pasta tokens: $_" -ForegroundColor Red
        Write-Host "   💡 Tente fechar todos os programas e executar novamente" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "   ℹ️ Pasta tokens não encontrada (já está limpo)" -ForegroundColor Gray
}

# 3. Verificar se a porta 21465 está livre
Write-Host "`n3️⃣ Verificando porta 21465..." -ForegroundColor Yellow
$port = 21465
$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($connection) {
    $processId = $connection.OwningProcess
    Write-Host "   ⚠️ Porta $port está em uso pelo processo $processId" -ForegroundColor Yellow
    Write-Host "   🔄 Encerrando processo..." -ForegroundColor Yellow
    try {
        Stop-Process -Id $processId -Force
        Write-Host "   ✅ Processo encerrado" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Erro ao encerrar processo: $_" -ForegroundColor Red
    }
} else {
    Write-Host "   ✅ Porta $port está livre" -ForegroundColor Green
}

# 4. Instruções finais
Write-Host "`n✅ LIMPEZA CONCLUÍDA!" -ForegroundColor Green
Write-Host "`n📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Execute: node wppconnect-server.js" -ForegroundColor White
Write-Host "   2. Acesse o sistema e clique em 'Conectar WhatsApp'" -ForegroundColor White
Write-Host "   3. O QR Code deve aparecer em até 10 segundos" -ForegroundColor White
Write-Host "   4. Escaneie com o WhatsApp do seu celular" -ForegroundColor White
Write-Host "`n💡 Dica: Use um nome de sessão diferente se o problema persistir" -ForegroundColor Yellow
Write-Host "   Exemplo: minha-sessao-2 ao invés de session_1535eed9" -ForegroundColor Gray
