# ============================================================================
# SCRIPT: Fix Missing Profiles - Usuários não aparecem no Admin
# ============================================================================
# Este script corrige o problema de usuários criados mas sem profile

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "FIX: Usuários Faltando no Admin" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. Executar diagnóstico primeiro
Write-Host "1. Executando diagnóstico..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Execute o diagnóstico no SQL Editor do Supabase:" -ForegroundColor White
Write-Host "https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cole e execute o conteúdo do arquivo:" -ForegroundColor White
Write-Host "diagnose-user-registration.sql" -ForegroundColor Green
Write-Host ""

$continuar = Read-Host "Pressione ENTER após executar o diagnóstico..."

# 2. Aplicar correção
Write-Host ""
Write-Host "2. Aplicando correção..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Agora execute a correção no SQL Editor:" -ForegroundColor White
Write-Host "https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new" -ForegroundColor Cyan
Write-Host ""
Write-Host "Cole e execute o conteúdo do arquivo:" -ForegroundColor White
Write-Host "supabase\migrations\20250128_fix_missing_profiles.sql" -ForegroundColor Green
Write-Host ""

$continuar = Read-Host "Pressione ENTER após executar a correção..."

# 3. Verificar se funcionou
Write-Host ""
Write-Host "3. Verificação..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Execute esta query no SQL Editor para confirmar:" -ForegroundColor White
Write-Host ""
Write-Host "SELECT " -ForegroundColor Gray
Write-Host "  (SELECT COUNT(*) FROM auth.users) as total_users," -ForegroundColor Gray
Write-Host "  (SELECT COUNT(*) FROM profiles) as total_profiles," -ForegroundColor Gray
Write-Host "  (SELECT COUNT(*) FROM auth.users au LEFT JOIN profiles p ON au.id = p.id WHERE p.id IS NULL) as missing_profiles;" -ForegroundColor Gray
Write-Host ""

$continuar = Read-Host "Pressione ENTER após verificar..."

# 4. Instruções finais
Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "PRÓXIMOS PASSOS:" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Acesse o painel Admin:" -ForegroundColor White
Write-Host "   http://localhost:5173/admin/users" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Clique em 'Atualizar' para recarregar a lista" -ForegroundColor White
Write-Host ""
Write-Host "3. Verifique se os usuários agora aparecem" -ForegroundColor White
Write-Host ""
Write-Host "4. Teste criando um novo usuário:" -ForegroundColor White
Write-Host "   http://localhost:5173/cadastro" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Verifique se o novo usuário aparece imediatamente no admin" -ForegroundColor White
Write-Host ""

# 5. Verificações adicionais
Write-Host "==================================" -ForegroundColor Yellow
Write-Host "VERIFICAÇÕES ADICIONAIS:" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se os usuários ainda não aparecerem, verifique:" -ForegroundColor White
Write-Host ""
Write-Host "1. RLS (Row Level Security) - Execute:" -ForegroundColor White
Write-Host "   SELECT * FROM pg_policies WHERE tablename = 'profiles';" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Permissões do usuário admin - Execute:" -ForegroundColor White
Write-Host "   SELECT * FROM profiles WHERE is_admin = true;" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Console do navegador (F12) - Procure por erros" -ForegroundColor White
Write-Host ""
Write-Host "4. Network tab - Verifique se a requisição para profiles retorna 200" -ForegroundColor White
Write-Host ""

# 6. Informações de suporte
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "CAUSA DO PROBLEMA:" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "O problema ocorre quando:" -ForegroundColor White
Write-Host "- O trigger 'on_auth_user_created' falha ou não existe" -ForegroundColor Gray
Write-Host "- A função 'handle_new_user()' tem um erro" -ForegroundColor Gray
Write-Host "- Há constraints de foreign key que impedem a criação" -ForegroundColor Gray
Write-Host "- O plano 'free' não existe na tabela plans" -ForegroundColor Gray
Write-Host ""
Write-Host "A correção:" -ForegroundColor White
Write-Host "- Cria profiles para usuários existentes sem profile" -ForegroundColor Gray
Write-Host "- Cria subscriptions 'free' para todos os profiles" -ForegroundColor Gray
Write-Host "- Recria o trigger com tratamento de erros melhorado" -ForegroundColor Gray
Write-Host "- Garante que o plano 'free' existe" -ForegroundColor Gray
Write-Host ""

Write-Host "==================================" -ForegroundColor Green
Write-Host "Correção concluída!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
