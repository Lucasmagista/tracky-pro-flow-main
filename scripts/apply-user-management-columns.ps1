# Script para aplicar migration de colunas de gerenciamento de usuários
# Execute este script para adicionar as novas colunas na tabela profiles

Write-Host "=== Aplicando Migration: User Management Columns ===" -ForegroundColor Cyan
Write-Host ""

$migrationFile = "supabase\migrations\20250128_add_user_management_columns.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Arquivo de migration não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Arquivo de migration encontrado" -ForegroundColor Green
Write-Host "📊 Este script irá adicionar as seguintes colunas à tabela profiles:" -ForegroundColor Yellow
Write-Host "   - is_suspended (BOOLEAN)" -ForegroundColor White
Write-Host "   - suspended_until (TIMESTAMPTZ)" -ForegroundColor White
Write-Host "   - suspension_reason (TEXT)" -ForegroundColor White
Write-Host "   - tags (TEXT[])" -ForegroundColor White
Write-Host "   - internal_notes (TEXT)" -ForegroundColor White
Write-Host ""

# Verificar se está logado no Supabase
Write-Host "🔍 Verificando login no Supabase..." -ForegroundColor Cyan
$loginStatus = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Você não está logado no Supabase CLI" -ForegroundColor Red
    Write-Host "Execute: supabase login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Login verificado" -ForegroundColor Green
Write-Host ""

# Confirmar execução
Write-Host "⚠️  ATENÇÃO: Esta migration irá modificar a tabela profiles" -ForegroundColor Yellow
$confirmation = Read-Host "Deseja continuar? (s/N)"
if ($confirmation -ne "s" -and $confirmation -ne "S") {
    Write-Host "❌ Operação cancelada pelo usuário" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Aplicando migration..." -ForegroundColor Cyan

# Aplicar migration usando Supabase CLI
$output = supabase db push --db-url "postgresql://postgres.swcmlwtyinsdppncxfqe:Lucas2019@@aws-0-us-east-1.pooler.supabase.com:6543/postgres" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migration aplicada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
    Write-Host "   1. Regenerar types: npm run types:generate" -ForegroundColor White
    Write-Host "   2. Verificar se não há erros de TypeScript" -ForegroundColor White
    Write-Host "   3. Testar as novas funcionalidades no painel admin" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Novas funcionalidades disponíveis:" -ForegroundColor Yellow
    Write-Host "   - Suspensão de usuários (permanente ou temporária)" -ForegroundColor White
    Write-Host "   - Sistema de tags para categorização" -ForegroundColor White
    Write-Host "   - Notas internas sobre usuários" -ForegroundColor White
    Write-Host "   - Auto-unsuspend para suspensões temporárias" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Erro ao aplicar migration:" -ForegroundColor Red
    Write-Host $output -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Tente executar manualmente no Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host "   1. Acesse: https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/editor" -ForegroundColor White
    Write-Host "   2. Copie e execute o conteúdo de: $migrationFile" -ForegroundColor White
    exit 1
}
