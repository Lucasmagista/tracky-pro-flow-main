#!/usr/bin/env pwsh
# ============================================================================
# Apply Complete Admin Features Migration
# ============================================================================

Write-Host "🚀 Aplicando migration completa de funcionalidades admin..." -ForegroundColor Cyan
Write-Host ""

$migrationFile = "supabase/migrations/20250128_complete_admin_features.sql"

# Check if file exists
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Arquivo de migration não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Esta migration irá adicionar:" -ForegroundColor Yellow
Write-Host "   ✓ Coluna trial_ends_at na tabela subscriptions" -ForegroundColor Green
Write-Host "   ✓ Coluna metadata na tabela orders" -ForegroundColor Green
Write-Host "   ✓ Tabela notification_queue (fila de notificações)" -ForegroundColor Green
Write-Host "   ✓ Tabela user_notifications (notificações in-app)" -ForegroundColor Green
Write-Host "   ✓ Tabela notification_templates (templates de notificação)" -ForegroundColor Green
Write-Host "   ✓ Tabela scheduled_reports (relatórios agendados)" -ForegroundColor Green
Write-Host "   ✓ Tabela report_history (histórico de relatórios)" -ForegroundColor Green
Write-Host "   ✓ Tabela custom_queries (query builder)" -ForegroundColor Green
Write-Host "   ✓ Tabela integration_monitoring (monitoramento de integrações)" -ForegroundColor Green
Write-Host "   ✓ Tabela integration_logs (logs de integrações)" -ForegroundColor Green
Write-Host "   ✓ Tabela api_usage (uso de API)" -ForegroundColor Green
Write-Host "   ✓ Tabela cohort_analysis (análise de coorte)" -ForegroundColor Green
Write-Host "   ✓ Tabela export_jobs (jobs de exportação)" -ForegroundColor Green
Write-Host ""

Write-Host "📝 Instruções:" -ForegroundColor Cyan
Write-Host "1. Copie todo o conteúdo do arquivo: $migrationFile" -ForegroundColor White
Write-Host "2. Acesse: https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new" -ForegroundColor White
Write-Host "3. Cole o SQL no editor" -ForegroundColor White
Write-Host "4. Clique em 'Run' para executar" -ForegroundColor White
Write-Host ""

# Ask if user wants to open the file
$response = Read-Host "Deseja abrir o arquivo de migration agora? (s/n)"
if ($response -eq "s" -or $response -eq "S") {
    Start-Process notepad $migrationFile
    Write-Host "✓ Arquivo aberto no Notepad" -ForegroundColor Green
}

Write-Host ""
Write-Host "⚠️  IMPORTANTE: Após executar a migration no Supabase, execute:" -ForegroundColor Yellow
Write-Host "   npx supabase gen types typescript --project-id swcmlwtyinsdppncxfqe --schema public | Out-File -FilePath 'src/integrations/supabase/types.ts' -Encoding utf8" -ForegroundColor Cyan
Write-Host ""

$openBrowser = Read-Host "Deseja abrir o Supabase SQL Editor no navegador? (s/n)"
if ($openBrowser -eq "s" -or $openBrowser -eq "S") {
    Start-Process "https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new"
    Write-Host "✓ Navegador aberto" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ Pronto! Siga os passos acima para completar a migration." -ForegroundColor Green
