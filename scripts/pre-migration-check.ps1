# Script de Validação Pré-Migration
# Verifica se todos os arquivos necessários existem e estão prontos

Write-Host "🔍 VALIDAÇÃO PRÉ-MIGRATION - Smartenvios + Nuvemshop" -ForegroundColor Cyan
Write-Host "=" * 60

# Variáveis
$rootPath = Split-Path -Parent $PSScriptRoot
$errors = @()
$warnings = @()

# 1. Verificar arquivos de código
Write-Host "`n📁 Verificando arquivos de código..." -ForegroundColor Yellow

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
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $errors += "Arquivo ausente: $file"
    }
}

# 2. Verificar documentação
Write-Host "`n📚 Verificando documentação..." -ForegroundColor Yellow

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
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file" -ForegroundColor Yellow
        $warnings += "Documentação ausente: $file"
    }
}

# 3. Verificar variáveis de ambiente necessárias
Write-Host "`n🔐 Verificando variáveis de ambiente..." -ForegroundColor Yellow

$envFile = Join-Path $rootPath ".env.local"
if (Test-Path $envFile) {
    Write-Host "  ✅ .env.local existe" -ForegroundColor Green
    
    $envContent = Get-Content $envFile -Raw
    
    $requiredVars = @(
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY"
    )
    
    $optionalVars = @(
        "VITE_NUVEMSHOP_APP_ID",
        "VITE_NUVEMSHOP_APP_SECRET",
        "VITE_API_URL"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match $var) {
            Write-Host "  ✅ $var configurado" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var ausente" -ForegroundColor Red
            $errors += "Variável de ambiente obrigatória ausente: $var"
        }
    }
    
    foreach ($var in $optionalVars) {
        if ($envContent -match $var) {
            Write-Host "  ✅ $var configurado" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $var ausente (opcional)" -ForegroundColor Yellow
            $warnings += "Variável opcional ausente: $var (necessária para produção)"
        }
    }
} else {
    Write-Host "  ⚠️  .env.local não encontrado" -ForegroundColor Yellow
    $warnings += "Arquivo .env.local ausente - necessário para produção"
}

# 4. Verificar se Supabase está rodando
Write-Host "`n🗄️  Verificando Supabase..." -ForegroundColor Yellow

try {
    $supabaseStatus = & npx supabase status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Supabase rodando localmente" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Supabase não está rodando" -ForegroundColor Yellow
        $warnings += "Supabase local não detectado - execute 'npx supabase start'"
    }
} catch {
    Write-Host "  ⚠️  Não foi possível verificar status do Supabase" -ForegroundColor Yellow
    $warnings += "Verifique se Supabase CLI está instalado"
}

# 5. Verificar TypeScript
Write-Host "`n🔧 Verificando TypeScript..." -ForegroundColor Yellow

try {
    Write-Host "  🔄 Executando type check..." -ForegroundColor Cyan
    $tscOutput = & npx tsc --noEmit 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Sem erros TypeScript" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Existem erros TypeScript" -ForegroundColor Red
        $errors += "Erros de TypeScript encontrados. Execute 'npx tsc --noEmit' para detalhes"
    }
} catch {
    Write-Host "  ⚠️  Não foi possível executar type check" -ForegroundColor Yellow
}

# 6. Verificar testes
Write-Host "`n🧪 Verificando infraestrutura de testes..." -ForegroundColor Yellow

$testFiles = @(
    "vitest.config.ts",
    "src\test\setup.ts"
)

foreach ($file in $testFiles) {
    $fullPath = Join-Path $rootPath $file
    if (Test-Path $fullPath) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  $file" -ForegroundColor Yellow
        $warnings += "Arquivo de teste ausente: $file"
    }
}

# 7. Resumo Final
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
Write-Host "📊 RESUMO DA VALIDAÇÃO" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Cyan

$totalChecks = $requiredFiles.Count + $docFiles.Count + 5
$successCount = $totalChecks - $errors.Count - $warnings.Count

Write-Host "`n✅ Verificações bem-sucedidas: $successCount/$totalChecks" -ForegroundColor Green

if ($warnings.Count -gt 0) {
    Write-Host "`n⚠️  AVISOS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
}

if ($errors.Count -gt 0) {
    Write-Host "`n❌ ERROS ($($errors.Count)):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
    Write-Host "`n❌ VALIDAÇÃO FALHOU - Corrija os erros antes de prosseguir" -ForegroundColor Red
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
    Write-Host "  2. Execute: npx supabase db push" -ForegroundColor White
    Write-Host "  3. Execute: npx supabase gen types typescript --local > src/types/database.ts" -ForegroundColor White
    Write-Host "  4. Execute: npm run test" -ForegroundColor White
    Write-Host "  5. Siga o PLANO_DE_TESTES.md para testes manuais" -ForegroundColor White
    
    exit 0
}
