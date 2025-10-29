# Script para testar o status da conexão do WhatsApp
# Execute: .\test-connection-status.ps1

$sessionName = "session_1535eed9"
$url = "http://localhost:21465/api/$sessionName/check-connection-session"
$headers = @{
    "Authorization" = "Bearer THISISMYSECURETOKEN"
}

Write-Host "🔍 Verificando status da sessão: $sessionName" -ForegroundColor Cyan
Write-Host "📡 URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -Headers $headers
    
    Write-Host "✅ Resposta recebida:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
    
    Write-Host ""
    if ($response.status -eq "CONNECTED" -or $response.state -eq "CONNECTED") {
        Write-Host "🎉 WhatsApp está CONECTADO!" -ForegroundColor Green
        if ($response.phone) {
            Write-Host "📱 Telefone: $($response.phone)" -ForegroundColor Cyan
        }
        if ($response.name) {
            Write-Host "👤 Nome: $($response.name)" -ForegroundColor Cyan
        }
    } elseif ($response.status -eq "QRCODE") {
        Write-Host "⏳ Aguardando scan do QR Code" -ForegroundColor Yellow
        if ($response.qrcode) {
            Write-Host "📊 QR Code length: $($response.qrcode.Length) caracteres" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ Status: $($response.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro ao verificar status:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
