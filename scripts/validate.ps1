Write-Host "Validacao Pre-Migration - Smartenvios + Nuvemshop" -ForegroundColor Cyan
Write-Host "============================================================"

$rootPath = Split-Path -Parent $PSScriptRoot
$errors = @()
$warnings = @()

# Verificar arquivos de código
Write-Host "`nVerificando arquivos de código..." -ForegroundColor Yellow

$requiredFiles = @(
    "src\types\nuvemshop.ts",
    "src\types\smartenvios.ts",
    "src\services\nuvemshop.ts",
    "src\services\smartenvios.ts",
    "src\hooks\useNuvemshopIntegration.ts",
    "src\hooks\useSmartenviosIntegration.ts",
    "src\components\NuvemshopConfig.tsx",
    "src\components\SmartenviosConfig.tsx",
    "src\pages\api\webhooks\nuvemshop.ts",
    "src\pages\api\webhooks\smartenvios.ts",
    "src\pages\api\integrations\nuvemshop\callback.ts",
    "supabase\migrations\005_smartenvios_nuvemshop.sql"
)

foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $rootPath $file
    if (Test-Path $fullPath) {
        Write-Host "  OK $file" -ForegroundColor Green
    } else {
        Write-Host "  ERRO $file" -ForegroundColor Red
        $errors += "Arquivo ausente: $file"
    }
}

# Verificar documentação
Write-Host "`nVerificando documentacao..." -ForegroundColor Yellow

$docFiles = @(
    "docs\INTEGRACAO_SMARTENVIOS_NUVEMSHOP.md",
    "docs\PLANO_DE_TESTES.md",
    "docs\DEPLOY_CHECKLIST.md",
    "docs\GUIA_RAPIDO.md",
    "docs\WEBHOOKS_COMPLETOS.md"
)

foreach ($file in $docFiles) {
    $fullPath = Join-Path $rootPath $file
    if (Test-Path $fullPath) {
        Write-Host "  OK $file" -ForegroundColor Green
    } else {
        Write-Host "  AVISO $file" -ForegroundColor Yellow
        $warnings += "Documentacao ausente: $file"
    }
}

# Resumo
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "RESUMO DA VALIDACAO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$totalChecks = $requiredFiles.Count + $docFiles.Count
$successCount = $totalChecks - $errors.Count - $warnings.Count

Write-Host "`nVerificacoes bem-sucedidas: $successCount/$totalChecks" -ForegroundColor Green

if ($warnings.Count -gt 0) {
    Write-Host "`nAVISOS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`nERROS ($($errors.Count)):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    Write-Host "`nVALIDACAO FALHOU - Corrija os erros antes de prosseguir" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nValidacao CONCLUIDA COM SUCESSO!" -ForegroundColor Green
    
    if ($warnings.Count -eq 0) {
        Write-Host "Sistema 100% pronto para migration e testes!" -ForegroundColor Green
    } else {
        Write-Host "Sistema pronto, mas alguns avisos precisam de atencao" -ForegroundColor Yellow
    }
    
    Write-Host "`nPROXIMOS PASSOS:" -ForegroundColor Cyan
    Write-Host "  1. Execute: npx supabase start" -ForegroundColor White
    Write-Host "  2. Execute: .\scripts\apply-migration.ps1" -ForegroundColor White
    Write-Host "  3. Execute: npm run dev" -ForegroundColor White
    Write-Host "  4. Siga docs\EXECUTAR_PROXIMOS_PASSOS.md" -ForegroundColor White
    
    exit 0
}
