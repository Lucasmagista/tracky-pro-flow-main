# Fix Subscription-Profile Relationship
# This script helps you apply the database fix for the subscription-profile relationship error

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "Fix Subscription-Profile Relationship" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is available
$supabaseCLI = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCLI) {
    Write-Host "⚠️  Supabase CLI not found. Install it from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can still apply the fixes manually in the Supabase Dashboard." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "This script will guide you through fixing the database relationship error." -ForegroundColor Green
Write-Host ""
Write-Host "Steps:" -ForegroundColor White
Write-Host "1. Check for data integrity issues" -ForegroundColor Gray
Write-Host "2. Clean up orphaned records (if needed)" -ForegroundColor Gray
Write-Host "3. Apply the foreign key relationship fix" -ForegroundColor Gray
Write-Host ""

$proceed = Read-Host "Do you want to continue? (y/n)"
if ($proceed -ne "y" -and $proceed -ne "Y") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "STEP 1: Pre-Migration Check" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Opening pre-migration check script..." -ForegroundColor Yellow
Write-Host ""
Write-Host "File: supabase/migrations/20250127_pre_migration_check.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "Instructions:" -ForegroundColor White
Write-Host "1. Go to your Supabase Dashboard (https://supabase.com/dashboard)" -ForegroundColor Gray
Write-Host "2. Navigate to: SQL Editor" -ForegroundColor Gray
Write-Host "3. Create a new query" -ForegroundColor Gray
Write-Host "4. Copy and paste the contents of the pre-migration check script" -ForegroundColor Gray
Write-Host "5. Click 'Run' to execute" -ForegroundColor Gray
Write-Host "6. Review the results" -ForegroundColor Gray
Write-Host ""

# Open the file in default editor
$preMigrationFile = Join-Path $PSScriptRoot "supabase\migrations\20250127_pre_migration_check.sql"
if (Test-Path $preMigrationFile) {
    Start-Process $preMigrationFile
    Write-Host "✅ File opened in default editor" -ForegroundColor Green
} else {
    Write-Host "❌ File not found: $preMigrationFile" -ForegroundColor Red
}

Write-Host ""
$checkResult = Read-Host "Did the check find any orphaned subscriptions or users without profiles? (y/n)"

if ($checkResult -eq "y" -or $checkResult -eq "Y") {
    Write-Host ""
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host "STEP 2: Data Cleanup" -ForegroundColor Cyan
    Write-Host "==================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "📋 Opening data cleanup script..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "File: supabase/migrations/20250127_data_cleanup.sql" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  WARNING: This will create missing profiles and optionally delete orphaned subscriptions" -ForegroundColor Yellow
    Write-Host ""
    
    $cleanup = Read-Host "Do you want to apply the data cleanup? (y/n)"
    if ($cleanup -eq "y" -or $cleanup -eq "Y") {
        $cleanupFile = Join-Path $PSScriptRoot "supabase\migrations\20250127_data_cleanup.sql"
        if (Test-Path $cleanupFile) {
            Start-Process $cleanupFile
            Write-Host "✅ File opened in default editor" -ForegroundColor Green
            Write-Host ""
            Write-Host "Apply this script in Supabase SQL Editor, then press Enter to continue..." -ForegroundColor Yellow
            Read-Host
        } else {
            Write-Host "❌ File not found: $cleanupFile" -ForegroundColor Red
        }
    }
} else {
    Write-Host ""
    Write-Host "✅ No data cleanup needed. Proceeding to fix..." -ForegroundColor Green
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "STEP 3: Apply Foreign Key Fix" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Opening fix migration script..." -ForegroundColor Yellow
Write-Host ""
Write-Host "File: supabase/migrations/20250127_fix_subscriptions_profiles_relationship.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "This is the main fix that will:" -ForegroundColor White
Write-Host "- Change the foreign key from subscriptions.user_id → auth.users(id)" -ForegroundColor Gray
Write-Host "- To: subscriptions.user_id → profiles(id)" -ForegroundColor Gray
Write-Host "- Add an index for better performance" -ForegroundColor Gray
Write-Host "- Reload the PostgREST schema cache" -ForegroundColor Gray
Write-Host ""

$applyFix = Read-Host "Ready to apply the fix? (y/n)"
if ($applyFix -eq "y" -or $applyFix -eq "Y") {
    $fixFile = Join-Path $PSScriptRoot "supabase\migrations\20250127_fix_subscriptions_profiles_relationship.sql"
    if (Test-Path $fixFile) {
        Start-Process $fixFile
        Write-Host "✅ File opened in default editor" -ForegroundColor Green
        Write-Host ""
        Write-Host "Apply this script in Supabase SQL Editor..." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "❌ File not found: $fixFile" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "VERIFICATION" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "After applying the fix, test the following:" -ForegroundColor White
Write-Host ""
Write-Host "1. In Supabase SQL Editor, run:" -ForegroundColor Gray
Write-Host "   SELECT p.*, s.* FROM profiles p LEFT JOIN subscriptions s ON s.user_id = p.id LIMIT 5;" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Or test the API endpoint:" -ForegroundColor Gray
Write-Host "   GET /rest/v1/profiles?select=*,subscriptions(id,status)" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Check the Admin Users page in your application" -ForegroundColor Gray
Write-Host "   It should now load without the 'PGRST200' error" -ForegroundColor Gray
Write-Host ""

Write-Host "==================================================================" -ForegroundColor Green
Write-Host "✅ Process Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "If you encounter any issues, check the documentation:" -ForegroundColor Yellow
Write-Host "docs/FIX_SUBSCRIPTION_PROFILE_RELATIONSHIP.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
