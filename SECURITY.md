# 🔒 Política de Segurança

## 🛡️ Versões Suportadas

Atualmente, as seguintes versões do Tracky Pro Flow recebem atualizações de segurança:

| Versão | Suportada          |
| ------ | ------------------ |
| 2.0.x  | ✅ Sim             |
| 1.9.x  | ✅ Sim             |
| 1.8.x  | ⚠️ Até 31/12/2024 |
| < 1.8  | ❌ Não             |

## 🚨 Reportando uma Vulnerabilidade

A segurança do Tracky Pro Flow é levada muito a sério. Agradecemos seus esforços para divulgar suas descobertas de forma responsável.

### 📧 Como Reportar

**NÃO** abra uma issue pública no GitHub para vulnerabilidades de segurança.

Em vez disso, envie um relatório para:

- **Email**: [security@tracky.app](mailto:security@tracky.app)
- **Subject**: `[SECURITY] Descrição breve da vulnerabilidade`

### 📋 Informações a Incluir

Por favor, inclua o máximo de informações possível:

```text
1. Tipo de vulnerabilidade (ex: XSS, SQL injection, CSRF)
2. Caminho completo dos arquivos relacionados
3. Localização do código afetado (tag/branch/commit)
4. Configuração especial necessária para reproduzir
5. Instruções passo a passo para reproduzir o problema
6. Proof-of-concept ou código de exploração (se possível)
7. Impacto potencial da vulnerabilidade
8. Possíveis mitigações ou correções
```

### ⏱️ Tempo de Resposta

- **Confirmação inicial**: 48 horas
- **Avaliação detalhada**: 7 dias
- **Correção e patch**: 30 dias (dependendo da gravidade)

## 🎯 Processo de Divulgação Responsável

1. **Você reporta** a vulnerabilidade via email
2. **Confirmamos** o recebimento em até 48h
3. **Avaliamos** a severidade e impacto
4. **Desenvolvemos** uma correção
5. **Testamos** a correção
6. **Lançamos** um patch de segurança
7. **Publicamos** um advisory de segurança
8. **Creditamos** você (se desejar)

## 🏆 Programa de Reconhecimento

Reconhecemos pesquisadores de segurança que reportam vulnerabilidades de forma responsável:

- 🥇 Menção no [SECURITY_HALL_OF_FAME.md](./SECURITY_HALL_OF_FAME.md)
- 🎖️ Badge de contribuidor de segurança
- 📢 Anúncio em nossas redes sociais (com sua permissão)

## ⚠️ Severidade de Vulnerabilidades

Classificamos vulnerabilidades usando o CVSS 3.1:

| Severidade | Score CVSS | Tempo de Correção |
|------------|------------|-------------------|
| 🔴 Crítica | 9.0 - 10.0 | 7 dias           |
| 🟠 Alta    | 7.0 - 8.9  | 14 dias          |
| 🟡 Média   | 4.0 - 6.9  | 30 dias          |
| 🟢 Baixa   | 0.1 - 3.9  | 90 dias          |

## 🔐 Melhores Práticas de Segurança

### Para Desenvolvedores

- ✅ Use variáveis de ambiente para segredos (nunca comite `.env`)
- ✅ Mantenha dependências atualizadas (`npm audit`)
- ✅ Valide e sanitize todas as entradas do usuário
- ✅ Use HTTPS em produção
- ✅ Implemente Rate Limiting
- ✅ Use Content Security Policy (CSP)
- ✅ Habilite CORS apenas para origens confiáveis

### Para Usuários

- ✅ Use senhas fortes e únicas
- ✅ Habilite autenticação de dois fatores (2FA)
- ✅ Mantenha o sistema atualizado
- ✅ Revise permissões de integrações regularmente
- ✅ Use HTTPS para acessar a aplicação
- ✅ Não compartilhe tokens de API

## 🔧 Configurações de Segurança Recomendadas

### Supabase (Database)

```sql
-- Habilitar Row Level Security em todas as tabelas
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso restritivas
CREATE POLICY "Users can only view own orders" 
  ON orders FOR SELECT 
  USING (auth.uid() = user_id);
```

### Headers de Segurança (Vercel/Netlify)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### Variáveis de Ambiente

```bash
# ❌ NUNCA faça isso
DATABASE_URL=postgresql://user:password@localhost:5432/db

# ✅ Use secrets management
DATABASE_URL=${SUPABASE_DB_URL}
```

## 📚 Recursos de Segurança

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

## 🔍 Auditoria de Segurança

Realizamos auditorias de segurança regulares:

- **Automática**: Dependabot + Snyk (semanal)
- **Manual**: Code review de segurança (mensal)
- **Externa**: Penetration testing (anual)

## 📞 Contato de Segurança

- **Email**: [security@tracky.app](mailto:security@tracky.app)
- **PGP Key**: [Link para chave pública PGP]
- **Bug Bounty**: Em breve

## 📜 Política de Divulgação

Seguimos a política de **Coordinated Disclosure**:

1. Vulnerabilidade reportada de forma privada
2. Confirmação e investigação pela equipe
3. Desenvolvimento e teste de correção
4. Lançamento de patch de segurança
5. Divulgação pública após 90 dias ou correção (o que vier primeiro)

## ⚖️ Legal

Não tomaremos ações legais contra pesquisadores que:

- ✅ Sigam esta política de divulgação responsável
- ✅ Não acessem ou modifiquem dados de outros usuários
- ✅ Não executem DoS ou degradação de serviço
- ✅ Não explorem vulnerabilidades além do necessário para demonstração

---

**Última atualização**: Outubro 2024

Obrigado por ajudar a manter o Tracky Pro Flow seguro! 🛡️