# Script: Apply Orders-Profiles Relationship Fix
# Description: Applies migration to fix PGRST200 error on admin orders page
# Usage: .\apply-orders-fix.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Orders-Profiles Relationship" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will fix the relationship between orders and profiles tables." -ForegroundColor Yellow
Write-Host "Error: PGRST200 - Could not find a relationship between 'orders' and 'profiles'" -ForegroundColor Red
Write-Host ""

Write-Host "What this migration does:" -ForegroundColor White
Write-Host "  1. Changes orders.user_id foreign key from auth.users → profiles" -ForegroundColor Gray
Write-Host "  2. Changes billing_history.user_id foreign key from auth.users → profiles" -ForegroundColor Gray
Write-Host "  3. Creates indexes for better performance" -ForegroundColor Gray
Write-Host "  4. Updates RLS policies" -ForegroundColor Gray
Write-Host ""

$migrationFile = "supabase\migrations\20250127_fix_orders_profiles_relationship.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📄 Migration file found: $migrationFile" -ForegroundColor Green
Write-Host ""

# Read migration content
$migrationContent = Get-Content $migrationFile -Raw

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: Apply this migration manually" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Steps to apply:" -ForegroundColor White
Write-Host "  1. Go to Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "  2. Select your project" -ForegroundColor Gray
Write-Host "  3. Navigate to SQL Editor" -ForegroundColor Gray
Write-Host "  4. Create a new query" -ForegroundColor Gray
Write-Host "  5. Copy the migration content below" -ForegroundColor Gray
Write-Host "  6. Paste it into the SQL Editor" -ForegroundColor Gray
Write-Host "  7. Click 'Run' to execute" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration SQL (Copy this):" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host $migrationContent -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
$copyToClipboard = Read-Host "Would you like to copy the SQL to clipboard? (Y/N)"

if ($copyToClipboard -eq "Y" -or $copyToClipboard -eq "y") {
    Set-Clipboard -Value $migrationContent
    Write-Host "✅ SQL copied to clipboard!" -ForegroundColor Green
    Write-Host "   Now paste it in Supabase SQL Editor and run it." -ForegroundColor Gray
} else {
    Write-Host "ℹ️  You can manually copy the SQL from above." -ForegroundColor Blue
}

Write-Host ""
Write-Host "After applying the migration:" -ForegroundColor Yellow
Write-Host "  1. Refresh your browser" -ForegroundColor Gray
Write-Host "  2. Test the Admin Orders page" -ForegroundColor Gray
Write-Host "  3. The PGRST200 error should be resolved" -ForegroundColor Gray
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
