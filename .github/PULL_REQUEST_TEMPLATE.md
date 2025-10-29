# 📝 Descrição

<!-- Descrição clara e concisa das mudanças -->

Fixes #(issue)

## 🎯 Tipo de Mudança

<!-- Marque com 'x' as opções aplicáveis -->

- [ ] 🐛 Bug fix (correção que resolve uma issue)
- [ ] ✨ Nova feature (mudança que adiciona funcionalidade)
- [ ] 💥 Breaking change (fix ou feature que quebraria funcionalidades existentes)
- [ ] 📝 Documentação (mudanças apenas na documentação)
- [ ] 🎨 Refatoração (mudanças de código que não corrigem bugs nem adicionam features)
- [ ] ⚡ Performance (mudanças que melhoram performance)
- [ ] 🧪 Testes (adição ou correção de testes)
- [ ] 🔧 Chore (mudanças em build, CI, dependências, etc)

## 🧪 Como Testar

<!-- Passos para testar as mudanças -->

1. ...
2. ...
3. ...

## 📸 Screenshots

<!-- Se aplicável, adicione screenshots mostrando as mudanças visuais -->

### Antes

<!-- Screenshot do estado anterior -->

### Depois

<!-- Screenshot do novo estado -->

## 📋 Checklist

### Geral

- [ ] Meu código segue os padrões do projeto
- [ ] Realizei uma auto-revisão do código
- [ ] Comentei áreas complexas do código
- [ ] Minhas mudanças não geram novos warnings
- [ ] Atualizei a documentação relevante

### Testes

- [ ] Adicionei testes que provam que o fix funciona ou a feature está OK
- [ ] Testes novos e existentes passam localmente
- [ ] O coverage de testes não diminuiu

### Build & Deploy

- [ ] O build passa sem erros (`npm run build`)
- [ ] O lint passa sem warnings (`npm run lint`)
- [ ] O type check passa (`npm run type-check`)
- [ ] Testei em ambiente de desenvolvimento

### Documentação

- [ ] Atualizei o README.md (se necessário)
- [ ] Atualizei a documentação em `/docs` (se necessário)
- [ ] Adicionei comentários JSDoc/TSDoc
- [ ] Atualizei o CHANGELOG.md

### Git

- [ ] Commits seguem o padrão Conventional Commits
- [ ] Branch está atualizada com a `main`
- [ ] Não há conflitos com a branch base

## 🔗 Issues Relacionadas

<!-- Liste as issues relacionadas -->

- Closes #
- Relates to #
- Depends on #

## 🚀 Deploy Notes

<!-- Notas importantes para deploy (migrações, variáveis de ambiente, etc) -->

- [ ] Requer migração de banco de dados
- [ ] Requer novas variáveis de ambiente
- [ ] Requer atualização de dependências
- [ ] Requer limpeza de cache

**Variáveis de ambiente necessárias:**

```bash
NOVA_VAR=valor
```

## 📊 Performance Impact

<!-- Impacto em performance (se aplicável) -->

- **Bundle Size**: [aumentou/diminuiu/sem mudança] por X KB
- **Load Time**: [melhorou/piorou/sem mudança] em X ms
- **Lighthouse Score**: [antes] → [depois]

## 🔒 Security Considerations

<!-- Considerações de segurança (se aplicável) -->

- [ ] Não expõe dados sensíveis
- [ ] Valida inputs do usuário
- [ ] Não introduz vulnerabilidades conhecidas
- [ ] Passou por revisão de segurança

## 💬 Notas Adicionais

<!-- Qualquer informação adicional que os revisores devem saber -->

## 🙏 Revisores

<!-- Mencione revisores específicos se necessário -->

@username1 @username2

---

**Checklist do Revisor:**

- [ ] Código está limpo e bem estruturado
- [ ] Testes cobrem os casos principais
- [ ] Documentação está clara
- [ ] Não há problemas de segurança
- [ ] Performance é aceitável