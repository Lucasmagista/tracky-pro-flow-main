# ============================================================================
# Script para aplicar correção do erro 500 no signup
# ============================================================================

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Aplicando correção para erro 500 no signup" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se o arquivo SQL existe
$migrationFile = ".\supabase\migrations\20250128_fix_signup_error.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "ERRO: Arquivo de migração não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "1. Executando script de diagnóstico..." -ForegroundColor Yellow
Write-Host ""

# Primeiro executar diagnóstico (se existir)
$diagFile = ".\diagnose-signup.sql"
if (Test-Path $diagFile) {
    Write-Host "Executando diagnóstico..." -ForegroundColor Gray
    # Nota: Seria necessário executar via Supabase CLI ou web
    Write-Host "Execute manualmente o arquivo 'diagnose-signup.sql' no SQL Editor do Supabase para ver o diagnóstico completo" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "2. Aplicando correção no banco de dados..." -ForegroundColor Yellow
Write-Host ""

# Executar a migração
Write-Host "Execute o seguinte comando ou cole o conteúdo do arquivo no SQL Editor do Supabase:" -ForegroundColor Cyan
Write-Host ""
Write-Host "npx supabase db push --linked" -ForegroundColor Green
Write-Host ""
Write-Host "OU acesse: https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new" -ForegroundColor Green
Write-Host "e cole o conteúdo do arquivo:" -ForegroundColor Green
Write-Host "$migrationFile" -ForegroundColor White
Write-Host ""

# Mostrar resumo das mudanças
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  RESUMO DAS MUDANÇAS" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✓ Remove triggers conflitantes" -ForegroundColor Green
Write-Host "✓ Consolida criação de profile e subscription em um único trigger" -ForegroundColor Green
Write-Host "✓ Adiciona tratamento de erros para não bloquear signup" -ForegroundColor Green
Write-Host "✓ Garante que o plano FREE existe" -ForegroundColor Green
Write-Host "✓ Corrige policies de RLS" -ForegroundColor Green
Write-Host "✓ Cria profiles/subscriptions para usuários existentes" -ForegroundColor Green
Write-Host ""

# Aguardar confirmação
Write-Host "Pressione qualquer tecla para abrir o SQL Editor do Supabase..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Abrir navegador com SQL Editor
$url = "https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new"
Start-Process $url

Write-Host ""
Write-Host "Após executar o SQL, teste o cadastro novamente!" -ForegroundColor Cyan
Write-Host ""
