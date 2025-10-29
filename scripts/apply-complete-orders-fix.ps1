# Script: Apply Complete Orders Fix
# Description: Applies both migrations to fix Admin Orders page
# Usage: .\apply-complete-orders-fix.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Complete Fix for Admin Orders" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will apply 2 migrations to fix Admin Orders:" -ForegroundColor Yellow
Write-Host "  1. Fix foreign key relationship (PGRST200 error)" -ForegroundColor Gray
Write-Host "  2. Add email column to profiles (42703 error)" -ForegroundColor Gray
Write-Host ""

# Migration files
$migration1 = "supabase\migrations\20250127_fix_orders_profiles_relationship.sql"
$migration2 = "supabase\migrations\20250127_add_email_to_profiles.sql"

# Check files exist
$filesOk = $true
if (-not (Test-Path $migration1)) {
    Write-Host "❌ Migration 1 not found: $migration1" -ForegroundColor Red
    $filesOk = $false
}
if (-not (Test-Path $migration2)) {
    Write-Host "❌ Migration 2 not found: $migration2" -ForegroundColor Red
    $filesOk = $false
}

if (-not $filesOk) {
    exit 1
}

Write-Host "✅ Both migration files found!" -ForegroundColor Green
Write-Host ""

# Read migrations
$content1 = Get-Content $migration1 -Raw
$content2 = Get-Content $migration2 -Raw

# Combine migrations
$combinedSQL = @"
-- ============================================================================
-- MIGRATION 1: Fix Foreign Key Relationships
-- ============================================================================

$content1

-- ============================================================================
-- MIGRATION 2: Add Email and Other Columns to Profiles
-- ============================================================================

$content2
"@

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "INSTRUCTIONS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Steps to apply:" -ForegroundColor White
Write-Host "  1. Go to Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor Gray
Write-Host "  2. Select your project" -ForegroundColor Gray
Write-Host "  3. Navigate to SQL Editor" -ForegroundColor Gray
Write-Host "  4. Create a new query" -ForegroundColor Gray
Write-Host "  5. Paste the combined SQL (see below or clipboard)" -ForegroundColor Gray
Write-Host "  6. Click 'Run' to execute both migrations" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Combined Migration SQL:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host $combinedSQL -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
$copyToClipboard = Read-Host "Copy SQL to clipboard? (Y/N)"

if ($copyToClipboard -eq "Y" -or $copyToClipboard -eq "y") {
    Set-Clipboard -Value $combinedSQL
    Write-Host "✅ SQL copied to clipboard!" -ForegroundColor Green
    Write-Host "   Now paste it in Supabase SQL Editor and run it." -ForegroundColor Gray
} else {
    Write-Host "ℹ️  You can manually copy the SQL from above." -ForegroundColor Blue
}

Write-Host ""
Write-Host "After applying both migrations:" -ForegroundColor Yellow
Write-Host "  1. Refresh your browser" -ForegroundColor Gray
Write-Host "  2. Test the Admin Orders page" -ForegroundColor Gray
Write-Host "  3. Both errors should be resolved:" -ForegroundColor Gray
Write-Host "     - PGRST200 (relationship not found) ✅" -ForegroundColor Gray
Write-Host "     - 42703 (email column not found) ✅" -ForegroundColor Gray
Write-Host ""

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
