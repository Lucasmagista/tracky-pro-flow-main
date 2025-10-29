# 🚀 GUIA RÁPIDO - Corrigir Usuários Faltando

## ⚡ Execução Rápida (3 minutos)

### PASSO 1: Diagnóstico
Abra o SQL Editor: https://supabase.com/dashboard/project/swcmlwtyinsdppncxfqe/sql/new

Cole e execute o conteúdo de:
```
diagnose-user-registration.sql
```

### PASSO 2: Aplicar Correção
No mesmo SQL Editor, cole e execute:
```
supabase/migrations/20250128_fix_missing_profiles.sql
```

### PASSO 3: Verificar
Execute esta query no SQL Editor:
```sql
SELECT 
  (SELECT COUNT(*) FROM auth.users) as usuarios,
  (SELECT COUNT(*) FROM profiles) as profiles,
  (SELECT COUNT(*) FROM auth.users au 
   LEFT JOIN profiles p ON au.id = p.id 
   WHERE p.id IS NULL) as faltando;
```

**Resultado esperado:** faltando = 0

### PASSO 4: Testar no Admin
1. Acesse: http://localhost:5173/admin/users
2. Clique em "Atualizar"
3. Os usuários devem aparecer agora!

### PASSO 5: Testar Novo Cadastro
1. Acesse: http://localhost:5173/cadastro
2. Crie uma conta de teste
3. Verifique se aparece imediatamente no admin

---

## ✅ Checklist Final

- [ ] Query de verificação retorna "faltando = 0"
- [ ] Usuários aparecem em /admin/users
- [ ] Novo cadastro funciona sem erro 500
- [ ] Novo usuário aparece automaticamente no admin

---

## 🆘 Se não funcionar

Execute o script PowerShell para diagnóstico interativo:
```powershell
.\fix-missing-profiles.ps1
```

Ou leia o guia completo:
```
SOLUCAO_USUARIOS_NAO_APARECEM.md
```
