# Sistema de Importação Inteligente CSV

## Visão Geral

O Tracky Pro Flow agora conta com um sistema de importação inteligente que analisa automaticamente os arquivos CSV enviados pelos usuários, identificando campos como nome do cliente, email, código de rastreio, etc., sem necessidade de mapeamento manual em muitos casos.

## Como Funciona

### 1. Análise de Nomes de Colunas
O sistema identifica campos através de padrões nos nomes das colunas, suportando variações em português e inglês:

- **Código de Rastreio**: `codigo_rastreio`, `codigo de rastreio`, `tracking_code`, `rastreio`, etc.
- **Nome do Cliente**: `nome_cliente`, `cliente`, `customer_name`, `nome`, etc.
- **Email**: `email`, `e-mail`, `customer_email`, etc.
- **Telefone**: `telefone`, `phone`, `whatsapp`, `customer_phone`, etc.
- E muitos outros campos...

### 2. Análise de Conteúdo dos Dados
Quando os nomes das colunas não são suficientes, o sistema analisa o conteúdo dos dados:

- **Emails**: Padrões como `usuario@dominio.com`
- **Telefones**: Formatos brasileiros como `(11) 98765-4321`
- **Códigos de Rastreio**: Padrões como `BR123456789BR`, `JD123456789012`, etc.
- **Valores Monetários**: Formatos como `299.90`
- **Datas**: Formatos `DD/MM/YYYY` ou `YYYY-MM-DD`
- **Nomes**: Textos longos sem números que parecem nomes completos

### 3. Validação Cruzada
O sistema resolve conflitos quando múltiplas colunas parecem corresponder ao mesmo campo, escolhendo a detecção com maior confiança.

### 4. Correção Manual
Usuários podem ajustar qualquer mapeamento automático que não esteja correto.

## Campos Suportados

| Campo | Descrição | Obrigatório | Exemplos de Detecção |
|-------|-----------|-------------|---------------------|
| `tracking_code` | Código de rastreio | Sim | `BR123456789BR`, `JD123456789012` |
| `customer_name` | Nome do cliente | Sim | `João Silva`, `Maria Oliveira` |
| `customer_email` | Email do cliente | Sim | `cliente@email.com` |
| `customer_phone` | Telefone | Não | `(11) 98765-4321` |
| `carrier` | Transportadora | Não | `Correios`, `Jadlog` |
| `order_value` | Valor do pedido | Não | `299.90` |
| `destination` | Destino | Não | `São Paulo/SP` |
| `order_date` | Data do pedido | Não | `15/10/2024` |
| `estimated_delivery` | Previsão de entrega | Não | `20/10/2024` |
| `product_name` | Nome do produto | Não | `Smartphone Samsung` |
| `quantity` | Quantidade | Não | `1`, `2` |
| `order_number` | Número do pedido | Não | `PED-2024-001` |
| `notes` | Observações | Não | `Cliente solicitou entrega urgente` |

## Exemplo de Uso

1. **Upload do CSV**: Usuário faz upload de qualquer arquivo CSV
2. **Análise Automática**: Sistema analisa nomes de colunas e conteúdo
3. **Preview Inteligente**: Mostra mapeamentos detectados com níveis de confiança
4. **Correção Manual**: Usuário pode ajustar mapeamentos incorretos
5. **Importação**: Sistema importa apenas dados válidos

## Arquivo de Exemplo

Veja o arquivo `exemplo_csv_inteligente.csv` na raiz do projeto para um exemplo completo de como estruturar seu CSV.

## Benefícios

- **Velocidade**: Reduz drasticamente o tempo de mapeamento manual
- **Precisão**: Algoritmos inteligentes identificam campos com alta acurácia
- **Flexibilidade**: Funciona com qualquer estrutura de CSV
- **Correção**: Interface permite ajustes manuais quando necessário
- **Validação**: Detecta e reporta problemas nos dados automaticamente

## Níveis de Confiança

- **Alta (80-100%)**: Detecção muito confiável, baseada em padrões claros
- **Média (60-79%)**: Detecção razoável, pode precisar de verificação
- **Baixa (0-59%)**: Detecção incerta, requer mapeamento manual

## Suporte a Variações

O sistema reconhece automaticamente variações comuns:

### Códigos de Rastreio
- Correios: `BR123456789BR`, `BR123456789BR`
- Jadlog: `JD123456789012`, `JD1234567890123`
- Total Express: `TE123456789BR`
- Azul Cargo: `AC123456789BR`
- Loggi: `LG123456789BR`

### Formatos de Data
- `15/10/2024` (DD/MM/YYYY)
- `2024-10-15` (YYYY-MM-DD)

### Valores Monetários
- `299.90` (ponto como decimal)
- `R$ 299,90` (formato brasileiro)

## Tratamento de Erros

O sistema identifica e reporta automaticamente:
- Campos obrigatórios faltando
- Formatos inválidos (emails, telefones, datas)
- Códigos de rastreio mal formatados
- Conflitos de mapeamento
- Dados inconsistentes

## Próximos Passos

Futuras melhorias incluem:
- Aprendizado de máquina para detecções ainda mais precisas
- Suporte a mais formatos de data e moeda
- Detecção de transportadoras por código de rastreio
- Sugestões automáticas de correção para dados inválidos