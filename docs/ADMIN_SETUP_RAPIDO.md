# 🚀 Guia Rápido - Painel de Administração

## Setup em 3 Passos

### 1️⃣ Executar Migration no Supabase

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Copie e execute o conteúdo do arquivo:
   ```
   supabase/migrations/20250127_admin_system.sql
   ```
4. Aguarde a execução (deve retornar "Admin system migration completed successfully!")

### 2️⃣ Tornar Seu Usuário Admin

Execute no SQL Editor do Supabase:

```sql
-- Substitua 'seu-email@exemplo.com' pelo seu email
UPDATE profiles 
SET 
  is_admin = true, 
  admin_role = 'super_admin',
  admin_since = NOW()
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
);

-- Verificar se funcionou
SELECT p.id, p.name, u.email, p.is_admin, p.admin_role 
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = true;
```

### 3️⃣ Acessar o Painel

1. Faça login na aplicação
2. Acesse: `http://localhost:5173/admin`
3. Pronto! 🎉

---

## 🎯 Navegação Rápida

| Rota | Descrição |
|------|-----------|
| `/admin` | Dashboard principal com estatísticas |
| `/admin/users` | Gerenciar todos os usuários |
| `/admin/logs` | Ver logs e auditoria completa |

---

## 🔐 Roles Disponíveis

- **super_admin** - Acesso total (recomendado para você)
- **admin** - Administrador comum
- **moderator** - Moderador com permissões limitadas
- **support** - Suporte com acesso de leitura

---

## ✅ Checklist de Verificação

- [ ] Migration executada com sucesso
- [ ] Seu usuário está como admin no banco
- [ ] Consegue acessar `/admin` sem redirect
- [ ] Dashboard mostra estatísticas
- [ ] Sidebar aparece com 11 itens
- [ ] Tabela de usuários carrega

---

## 🐛 Troubleshooting

### Não consigo acessar /admin
**Solução:** Verifique se seu usuário está marcado como admin no banco:
```sql
SELECT p.is_admin, p.admin_role 
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'seu-email@exemplo.com';
```

### Tabelas não existem
**Solução:** Execute novamente a migration SQL

### Dados não carregam
**Solução:** 
1. Verifique o console do navegador (F12)
2. Confirme que as RLS policies foram criadas
3. Verifique se está autenticado

---

## 📚 Próximos Passos

1. Explore o **Dashboard** e veja as métricas
2. Vá em **Usuários** e veja todos os cadastrados
3. Acesse **Logs** para ver as atividades
4. Leia `ADMIN_PANEL_COMPLETE.md` para detalhes completos

---

## 💡 Dicas Úteis

### Criar Outro Admin
```sql
UPDATE profiles 
SET is_admin = true, admin_role = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'outro-usuario@exemplo.com'
);
```

### Remover Permissões Admin
```sql
UPDATE profiles 
SET is_admin = false, admin_role = NULL
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'usuario@exemplo.com'
);
```

### Ver Todos os Admins
```sql
SELECT p.id, p.name, u.email, p.admin_role, p.admin_since 
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = true 
ORDER BY p.admin_since DESC;
```

### Limpar Logs Antigos
```sql
-- Cuidado! Remove logs com mais de 90 dias
DELETE FROM admin_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 🎨 Personalização Rápida

### Mudar Cores do Admin Panel
Edite: `src/components/admin/AdminSidebar.tsx`

### Adicionar Item no Menu
Edite array `navigation` em: `src/components/admin/AdminSidebar.tsx`

### Criar Nova Página Admin
1. Crie arquivo em: `src/pages/admin/MinhaPage.tsx`
2. Use `<AdminLayout>` como wrapper
3. Adicione rota em: `src/App.tsx`

---

## 📞 Suporte

Caso encontre problemas, verifique:
1. Console do navegador (F12)
2. Logs do Supabase
3. Arquivo `ADMIN_PANEL_COMPLETE.md` para documentação completa

---

**Aproveite seu painel admin! 🚀**
