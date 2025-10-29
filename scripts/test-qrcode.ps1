# Script para testar o endpoint de QR Code

Write-Host "Testando geracao de QR Code..." -ForegroundColor Cyan

$sessionName = "teste-qr-$(Get-Random -Maximum 9999)"
$url = "http://localhost:21465/api/$sessionName/start-session"
$headers = @{
    "Authorization" = "Bearer THISISMYSECURETOKEN"
    "Content-Type" = "application/json"
}

Write-Host "Fazendo requisicao para: $url" -ForegroundColor Yellow
Write-Host "Aguarde... isso pode levar ate 30 segundos" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -TimeoutSec 60
    
    Write-Host "`nResposta recebida!" -ForegroundColor Green
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Message: $($response.message)" -ForegroundColor White
    
    if ($response.qrcode) {
        $qrLength = $response.qrcode.Length
        Write-Host "`nQR CODE RECEBIDO!" -ForegroundColor Green
        Write-Host "Tamanho: $qrLength caracteres" -ForegroundColor White
        Write-Host "Primeiros 50 caracteres: $($response.qrcode.Substring(0, [Math]::Min(50, $qrLength)))" -ForegroundColor Gray
        
        # Salvar QR Code em arquivo HTML para visualizar
        $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>QR Code WhatsApp</title>
    <style>
        body { 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            background: #f0f0f0;
            font-family: Arial, sans-serif;
        }
        .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        img { 
            max-width: 400px; 
            border: 2px solid #25D366;
            border-radius: 10px;
        }
        h1 { color: #25D366; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Escaneie o QR Code</h1>
        <p>Abra o WhatsApp no seu celular e escaneie este codigo</p>
        <img src="$($response.qrcode)" alt="QR Code">
        <p style="margin-top: 20px; color: #666;">Sessao: $sessionName</p>
    </div>
</body>
</html>
"@
        
        $htmlFile = "qrcode-test.html"
        $html | Out-File -FilePath $htmlFile -Encoding utf8
        Write-Host "`nQR Code salvo em: $htmlFile" -ForegroundColor Cyan
        Write-Host "Abrindo no navegador..." -ForegroundColor Yellow
        Start-Process $htmlFile
        
    } else {
        Write-Host "`nQR Code nao encontrado na resposta" -ForegroundColor Yellow
        Write-Host "Resposta completa:" -ForegroundColor Gray
        $response | ConvertTo-Json -Depth 10
    }
    
} catch {
    Write-Host "`nErro na requisicao!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
}
