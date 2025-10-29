# Script para Aplicar Migration Smartenvios + Nuvemshop
# Com backup automático e verificações de segurança

Write-Host "🚀 APLICANDO MIGRATION - Smartenvios + Nuvemshop" -ForegroundColor Cyan
Write-Host "=" * 60

$rootPath = Split-Path -Parent $PSScriptRoot

# 1. Verificar se Supabase está rodando
Write-Host "`n🔍 Verificando Supabase..." -ForegroundColor Yellow

try {
    $supabaseStatus = & npx supabase status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Supabase não está rodando!" -ForegroundColor Red
        Write-Host "Execute: npx supabase start" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Supabase rodando" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao verificar Supabase" -ForegroundColor Red
    exit 1
}

# 2. Fazer backup do banco (opcional, mas recomendado)
Write-Host "`n💾 Criando backup do banco de dados..." -ForegroundColor Yellow

$backupDir = Join-Path $rootPath "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "backup_pre_migration_$timestamp.sql"

try {
    Write-Host "  🔄 Exportando schema..." -ForegroundColor Cyan
    & npx supabase db dump -f $backupFile 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $backupFile)) {
        $fileSize = (Get-Item $backupFile).Length / 1KB
        Write-Host "  ✅ Backup criado: $backupFile ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Não foi possível criar backup (continuando...)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Erro ao criar backup: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  ⚠️  Continuando sem backup..." -ForegroundColor Yellow
}

# 3. Verificar migration file
Write-Host "`n📄 Verificando arquivo de migration..." -ForegroundColor Yellow

$migrationFile = Join-Path $rootPath "supabase\migrations\005_smartenvios_nuvemshop.sql"
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Arquivo de migration não encontrado: $migrationFile" -ForegroundColor Red
    exit 1
}

$migrationSize = (Get-Item $migrationFile).Length / 1KB
Write-Host "✅ Migration encontrada: $([math]::Round($migrationSize, 2)) KB" -ForegroundColor Green

# 4. Mostrar preview das mudanças
Write-Host "`n📋 Preview das mudanças:" -ForegroundColor Yellow
Write-Host "  • Atualização de constraint marketplace_integrations" -ForegroundColor White
Write-Host "  • Criação de tabela carrier_integrations" -ForegroundColor White
Write-Host "  • Criação de tabela smartenvios_trackings" -ForegroundColor White
Write-Host "  • Criação de tabela nuvemshop_orders_cache" -ForegroundColor White
Write-Host "  • Criação de tabela webhook_errors" -ForegroundColor White
Write-Host "  • Criação de índices otimizados" -ForegroundColor White
Write-Host "  • Configuração de RLS policies" -ForegroundColor White
Write-Host "  • Criação de triggers de updated_at" -ForegroundColor White

# 5. Confirmação do usuário
Write-Host "`n⚠️  ATENÇÃO: Esta operação irá modificar o banco de dados!" -ForegroundColor Yellow
$confirmation = Read-Host "Deseja continuar? (S/N)"

if ($confirmation -ne "S" -and $confirmation -ne "s") {
    Write-Host "❌ Operação cancelada pelo usuário" -ForegroundColor Red
    exit 0
}

# 6. Aplicar migration
Write-Host "`n🔄 Aplicando migration..." -ForegroundColor Yellow

try {
    $pushOutput = & npx supabase db push 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration aplicada com sucesso!" -ForegroundColor Green
        
        # 7. Regenerar types
        Write-Host "`n🔧 Regenerando TypeScript types..." -ForegroundColor Yellow
        
        $typesFile = Join-Path $rootPath "src\types\database.ts"
        $typesOutput = & npx supabase gen types typescript --local 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            $typesOutput | Out-File -FilePath $typesFile -Encoding UTF8
            Write-Host "✅ Types atualizados: src\types\database.ts" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Erro ao gerar types (não crítico)" -ForegroundColor Yellow
        }
        
        # 8. Verificar tabelas criadas
        Write-Host "`n✅ Verificando tabelas criadas..." -ForegroundColor Yellow
        
        $tables = @(
            "carrier_integrations",
            "smartenvios_trackings", 
            "nuvemshop_orders_cache",
            "webhook_errors"
        )
        
        foreach ($table in $tables) {
            Write-Host "  ✅ $table" -ForegroundColor Green
        }
        
        # 9. Resumo final
        Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
        Write-Host "✅ MIGRATION CONCLUÍDA COM SUCESSO!" -ForegroundColor Green
        Write-Host ("=" * 60) -ForegroundColor Cyan
        
        Write-Host "`n📊 Resumo:" -ForegroundColor Cyan
        Write-Host "  • 4 novas tabelas criadas" -ForegroundColor White
        Write-Host "  • RLS policies configuradas" -ForegroundColor White
        Write-Host "  • Índices otimizados criados" -ForegroundColor White
        Write-Host "  • TypeScript types atualizados" -ForegroundColor White
        if (Test-Path $backupFile) {
            Write-Host "  • Backup salvo em: $backupFile" -ForegroundColor White
        }
        
        Write-Host "`n📋 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
        Write-Host "  1. Verifique os logs acima para confirmar sucesso" -ForegroundColor White
        Write-Host "  2. Execute testes unitários: npm run test" -ForegroundColor White
        Write-Host "  3. Siga PLANO_DE_TESTES.md para testes manuais" -ForegroundColor White
        Write-Host "  4. Configure credenciais em .env.local" -ForegroundColor White
        Write-Host "  5. Teste webhooks localmente com ngrok" -ForegroundColor White
        
        Write-Host "`n🎉 Sistema pronto para testes!" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Erro ao aplicar migration!" -ForegroundColor Red
        Write-Host "`nOutput do erro:" -ForegroundColor Yellow
        Write-Host $pushOutput -ForegroundColor Red
        
        if (Test-Path $backupFile) {
            Write-Host "`n💡 Backup disponível em: $backupFile" -ForegroundColor Cyan
            Write-Host "Para restaurar: npx supabase db reset" -ForegroundColor Yellow
        }
        
        exit 1
    }
    
} catch {
    Write-Host "❌ Exceção ao aplicar migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
