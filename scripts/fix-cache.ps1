# Script para limpar cache e reiniciar desenvolvimento

Write-Host "🧹 Limpando cache do Vite..." -ForegroundColor Cyan
Remove-Item -Path "node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✅ Cache limpo!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Recarregue a página com Ctrl+Shift+R (hard reload)" -ForegroundColor White
Write-Host "2. Se o erro persistir, feche e reabra o navegador" -ForegroundColor White
Write-Host "3. Verifique se o dev server está rodando: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "✨ Pronto! O erro de 'smartenviosDialogOpen is not defined' deve estar resolvido." -ForegroundColor Green
