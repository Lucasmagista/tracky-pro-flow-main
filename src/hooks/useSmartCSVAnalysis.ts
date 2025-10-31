import { useState, useCallback } from 'react';

// Tipos para detecção de campos
export interface DetectedField {
  csvColumn: string;
  detectedField: string;
  confidence: number; // 0-1
  reasoning: string;
  sampleValues: string[];
  validationErrors: string[];
}

export interface FieldDetectionResult {
  detectedFields: DetectedField[];
  unmappedColumns: string[];
  confidence: number;
  suggestions: string[];
}

// Padrões de detecção baseados em nomes de colunas
const COLUMN_NAME_PATTERNS = {
  tracking_code: [
    /codigo[_ ]?rastreio/i,
    /codigo[_ ]?de[_ ]?rastreio/i,
    /tracking[_ ]?code/i,
    /tracking[_ ]?number/i,
    /numero[_ ]?rastreio/i,
    /rastreio/i,
    /tracking/i,
    /^codigo$/i,
    /^tracking$/i,
    // NuvemShop patterns
    /codigo[_ ]?de[_ ]?rastreio[_ ]?do[_ ]?envio/i,
    /codigo[_ ]?rastreio[_ ]?envio/i,
    /rastreio[_ ]?envio/i,
    // Padrões específicos da planilha exemplo
    /^codigo_rastreio$/i,
    /codigo[_ ]?rastreio$/i
  ],
  customer_name: [
    /nome[_ ]?cliente/i,
    /nome[_ ]?do[_ ]?cliente/i,
    /cliente/i,
    /customer[_ ]?name/i,
    /customer/i,
    /nome/i,
    /name/i,
    /comprador/i,
    /buyer/i,
    // NuvemShop patterns
    /nome[_ ]?do[_ ]?comprador/i,
    /nome[_ ]?comprador/i,
    /comprador/i,
    // Padrões específicos da planilha exemplo
    /^nome_cliente$/i,
    /nome[_ ]?cliente$/i
  ],
  customer_email: [
    /email[_ ]?cliente/i,
    /email[_ ]?do[_ ]?cliente/i,
    /e[_ ]?mail/i,
    /customer[_ ]?email/i,
    /email/i,
    /^email$/i,
    // NuvemShop patterns
    /^e[_ ]?mail$/i,
    // Padrões específicos da planilha exemplo
    /^email_cliente$/i,
    /email[_ ]?cliente$/i
  ],
  customer_phone: [
    /telefone[_ ]?cliente/i,
    /telefone/i,
    /phone/i,
    /celular/i,
    /whatsapp/i,
    /customer[_ ]?phone/i,
    /fone/i,
    /contact/i,
    /contato/i,
    // NuvemShop patterns
    /^telefone$/i,
    /telefone[_ ]?para[_ ]?a[_ ]?entrega/i,
    // Padrões específicos da planilha exemplo
    /^telefone$/i
  ],
  carrier: [
    /transportadora/i,
    /carrier/i,
    /correios/i,
    /jadlog/i,
    /loggi/i,
    /total[_ ]?express/i,
    /azul[_ ]?cargo/i,
    /entrega/i,
    /shipping/i,
    /frete/i,
    // NuvemShop patterns
    /forma[_ ]?de[_ ]?entrega/i,
    /entrega/i,
    // Padrões específicos da planilha exemplo
    /^transportadora$/i
  ],
  order_value: [
    /valor[_ ]?pedido/i,
    /valor/i,
    /preco/i,
    /preço/i,
    /price/i,
    /total/i,
    /amount/i,
    /order[_ ]?value/i,
    /valor[_ ]?total/i,
    // NuvemShop patterns
    /^total$/i,
    /valor[_ ]?total/i,
    /subtotal/i,
    // Padrões específicos da planilha exemplo
    /^valor_pedido$/i,
    /valor[_ ]?pedido$/i
  ],
  destination: [
    /destino/i,
    /cidade/i,
    /estado/i,
    /uf/i,
    /local/i,
    /endereco/i,
    /address/i,
    /location/i,
    /destination/i,
    // NuvemShop patterns
    /^cidade$/i,
    /^estado$/i,
    /cidade[_ ]?estado/i,
    /endereco[_ ]?completo/i,
    // Padrões específicos da planilha exemplo
    /^destino$/i
  ],
  order_date: [
    /data[_ ]?pedido/i,
    /data/i,
    /date/i,
    /created[_ ]?at/i,
    /order[_ ]?date/i,
    /data[_ ]?compra/i,
    /data[_ ]?criacao/i,
    // NuvemShop patterns
    /^data$/i,
    /data[_ ]?pedido/i,
    /data[_ ]?pagamento/i,
    // Padrões específicos da planilha exemplo
    /^data_pedido$/i,
    /data[_ ]?pedido$/i
  ],
  estimated_delivery: [
    /previsao[_ ]?entrega/i,
    /data[_ ]?entrega/i,
    /estimated[_ ]?delivery/i,
    /prazo/i,
    /deadline/i,
    /entrega/i,
    /delivery[_ ]?date/i,
    // NuvemShop patterns
    /data[_ ]?envio/i,
    /data[_ ]?de[_ ]?envio/i,
    // Padrões específicos da planilha exemplo
    /^previsao_entrega$/i,
    /previsao[_ ]?entrega$/i,
    /previsao[_ ]?de[_ ]?entrega$/i
  ],
  product_name: [
    /produto/i,
    /product[_ ]?name/i,
    /nome[_ ]?produto/i,
    /item/i,
    /product/i,
    /descricao/i,
    /description/i,
    // NuvemShop patterns
    /nome[_ ]?do[_ ]?produto/i,
    /^produto$/i,
    // Padrões específicos da planilha exemplo
    /^produto$/i
  ],
  quantity: [
    /quantidade/i,
    /quantity/i,
    /qtd/i,
    /qty/i,
    /amount/i,
    /numero/i,
    /number/i,
    // NuvemShop patterns
    /quantidade[_ ]?comprada/i,
    /^quantidade$/i,
    // Padrões específicos da planilha exemplo
    /^quantidade$/i
  ],
  order_number: [
    /numero[_ ]?pedido/i,
    /numero[_ ]?order/i,
    /order[_ ]?number/i,
    /pedido/i,
    /order/i,
    /id[_ ]?pedido/i,
    /order[_ ]?id/i,
    // NuvemShop patterns
    /numero[_ ]?do[_ ]?pedido/i,
    /^numero[_ ]?pedido$/i,
    /identificador[_ ]?pedido/i,
    // Padrões específicos da planilha exemplo
    /^numero_pedido$/i,
    /numero[_ ]?pedido$/i
  ],
  notes: [
    /observacoes/i,
    /anotacoes/i,
    /notes/i,
    /comentarios/i,
    /comments/i,
    // NuvemShop patterns
    /anotacoes[_ ]?comprador/i,
    /anotacoes[_ ]?vendedor/i,
    /observacoes/i,
    /anotacoes[_ ]?do[_ ]?comprador/i,
    /anotacoes[_ ]?do[_ ]?vendedor/i,
    /^anotacoes[_ ]?do[_ ]?comprador$/i,
    /^anotacoes[_ ]?do[_ ]?vendedor$/i,
    // Padrões específicos da planilha exemplo
    /^observacoes$/i,
    /^anotacoes[_ ]?do[_ ]?comprador$/i,
    /^anotacoes[_ ]?do[_ ]?vendedor$/i
  ],
  // Novos campos da NuvemShop
  cpf_cnpj: [
    /cpf[_ ]?cnpj/i,
    /cpf/i,
    /cnpj/i,
    /documento/i,
    /cpf[_ ]?\/[_ ]?cnpj/i,
    /^cpf[_ ]?\/[_ ]?cnpj$/i,
    // Padrões específicos da planilha exemplo
    /^cpf[_ ]?\/[_ ]?cnpj$/i
  ],
  payment_method: [
    /forma[_ ]?pagamento/i,
    /pagamento/i,
    /payment[_ ]?method/i,
    /metodo[_ ]?pagamento/i,
    /^forma[_ ]?de[_ ]?pagamento$/i,
    // Padrões específicos da planilha exemplo
    /^forma[_ ]?de[_ ]?pagamento$/i
  ],
  payment_status: [
    /status[_ ]?pagamento/i,
    /status[_ ]?do[_ ]?pagamento/i,
    /payment[_ ]?status/i,
    /^status[_ ]?do[_ ]?pagamento$/i,
    // Padrões específicos da planilha exemplo
    /^status[_ ]?do[_ ]?pagamento$/i
  ],
  order_status: [
    /status[_ ]?pedido/i,
    /status[_ ]?do[_ ]?pedido/i,
    /order[_ ]?status/i,
    /^status[_ ]?do[_ ]?pedido$/i,
    // Padrões específicos da planilha exemplo
    /^status[_ ]?do[_ ]?pedido$/i
  ],
  shipping_status: [
    /status[_ ]?envio/i,
    /status[_ ]?do[_ ]?envio/i,
    /shipping[_ ]?status/i,
    /^status[_ ]?do[_ ]?envio$/i,
    // Padrões específicos da planilha exemplo
    /^status[_ ]?do[_ ]?envio$/i
  ],
  subtotal: [
    /subtotal/i,
    /sub[_ ]?total/i,
    /^subtotal$/i,
    // Padrões específicos da planilha exemplo
    /^subtotal$/i
  ],
  discount: [
    /desconto/i,
    /discount/i,
    /cupom[_ ]?desconto/i,
    /^desconto$/i,
    /^cupom[_ ]?de[_ ]?desconto$/i,
    // Padrões específicos da planilha exemplo
    /^desconto$/i,
    /^cupom[_ ]?de[_ ]?desconto$/i
  ],
  shipping_cost: [
    /valor[_ ]?frete/i,
    /frete/i,
    /shipping[_ ]?cost/i,
    /custo[_ ]?envio/i,
    /^valor[_ ]?do[_ ]?frete$/i,
    // Padrões específicos da planilha exemplo
    /^valor[_ ]?do[_ ]?frete$/i
  ],
  product_value: [
    /valor[_ ]?produto/i,
    /valor[_ ]?do[_ ]?produto/i,
    /product[_ ]?value/i,
    /^valor[_ ]?do[_ ]?produto$/i,
    // Padrões específicos da planilha exemplo
    /^valor[_ ]?do[_ ]?produto$/i
  ],
  sku: [
    /sku/i,
    /^sku$/i,
    // Padrões específicos da planilha exemplo
    /^sku$/i
  ],
  channel: [
    /canal/i,
    /channel/i,
    /^canal$/i,
    // Padrões específicos da planilha exemplo
    /^canal$/i
  ],
  seller: [
    /vendedor/i,
    /seller/i,
    /pessoa[_ ]?registrou[_ ]?venda/i,
    /local[_ ]?venda/i,
    /^vendedor$/i,
    /^pessoa[_ ]?que[_ ]?registrou[_ ]?a[_ ]?venda$/i,
    /^local[_ ]?de[_ ]?venda$/i,
    // Padrões específicos da planilha exemplo
    /^vendedor$/i,
    /^pessoa[_ ]?que[_ ]?registrou[_ ]?a[_ ]?venda$/i,
    /^local[_ ]?de[_ ]?venda$/i
  ],
  payment_date: [
    /data[_ ]?pagamento/i,
    /data[_ ]?de[_ ]?pagamento/i,
    /payment[_ ]?date/i,
    /^data[_ ]?de[_ ]?pagamento$/i,
    // Padrões específicos da planilha exemplo
    /^data[_ ]?de[_ ]?pagamento$/i
  ],
  shipping_date: [
    /data[_ ]?envio/i,
    /data[_ ]?de[_ ]?envio/i,
    /shipping[_ ]?date/i,
    /^data[_ ]?de[_ ]?envio$/i,
    // Padrões específicos da planilha exemplo
    /^data[_ ]?de[_ ]?envio$/i
  ],
  transaction_id: [
    /identificador[_ ]?transacao/i,
    /identificador[_ ]?da[_ ]?transacao/i,
    /transaction[_ ]?id/i,
    /id[_ ]?transacao/i,
    /identificador[_ ]?da[_ ]?transacao[_ ]?no[_ ]?meio[_ ]?pagamento/i,
    /^identificador[_ ]?da[_ ]?transacao[_ ]?no[_ ]?meio[_ ]?de[_ ]?pagamento$/i,
    // Padrões específicos da planilha exemplo
    /^identificador[_ ]?da[_ ]?transacao[_ ]?no[_ ]?meio[_ ]?de[_ ]?pagamento$/i
  ],
  physical_product: [
    /produto[_ ]?fisico/i,
    /physical[_ ]?product/i,
    /^produto[_ ]?fisico$/i,
    // Padrões específicos da planilha exemplo
    /^produto[_ ]?fisico$/i
  ],
  cancellation_date: [
    /data[_ ]?cancelamento/i,
    /data[_ ]?hora[_ ]?cancelamento/i,
    /cancellation[_ ]?date/i,
    /data[_ ]?e[_ ]?hora[_ ]?do[_ ]?cancelamento/i,
    /^data[_ ]?e[_ ]?hora[_ ]?do[_ ]?cancelamento$/i,
    // Padrões específicos da planilha exemplo
    /^data[_ ]?e[_ ]?hora[_ ]?do[_ ]?cancelamento$/i
  ],
  cancellation_reason: [
    /motivo[_ ]?cancelamento/i,
    /cancellation[_ ]?reason/i,
    /motivo[_ ]?do[_ ]?cancelamento/i,
    /^motivo[_ ]?do[_ ]?cancelamento$/i,
    // Padrões específicos da planilha exemplo
    /^motivo[_ ]?do[_ ]?cancelamento$/i
  ],
  // Campos de endereço da NuvemShop
  delivery_address: [
    /endereco/i,
    /endereço/i,
    /address/i,
    /rua/i,
    /street/i,
    /^endereco$/i,
    /^endereço$/i,
    // Padrões específicos da planilha exemplo
    /^endereco$/i,
    /^endereço$/i
  ],
  delivery_number: [
    /numero/i,
    /número/i,
    /number/i,
    /^numero$/i,
    /^número$/i,
    // Padrões específicos da planilha exemplo
    /^numero$/i,
    /^número$/i
  ],
  delivery_complement: [
    /complemento/i,
    /complement/i,
    /^complemento$/i,
    // Padrões específicos da planilha exemplo
    /^complemento$/i
  ],
  delivery_neighborhood: [
    /bairro/i,
    /neighborhood/i,
    /district/i,
    /^bairro$/i,
    // Padrões específicos da planilha exemplo
    /^bairro$/i
  ],
  delivery_city: [
    /cidade/i,
    /city/i,
    /^cidade$/i,
    // Padrões específicos da planilha exemplo
    /^cidade$/i
  ],
  delivery_state: [
    /estado/i,
    /state/i,
    /uf/i,
    /^estado$/i,
    // Padrões específicos da planilha exemplo
    /^estado$/i
  ],
  delivery_zipcode: [
    /codigo[_ ]?postal/i,
    /cep/i,
    /zipcode/i,
    /codigo[_ ]?postal/i,
    /^codigo[_ ]?postal$/i,
    /^código[_ ]?postal$/i,
    // Padrões específicos da planilha exemplo
    /^codigo[_ ]?postal$/i,
    /^código[_ ]?postal$/i
  ],
  delivery_country: [
    /pais/i,
    /país/i,
    /country/i,
    /^pais$/i,
    /^país$/i,
    // Padrões específicos da planilha exemplo
    /^pais$/i,
    /^país$/i
  ]
};

// Padrões de validação de conteúdo
const CONTENT_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /(\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/,
  phone_br: /\(\d{2}\)\s?\d{4,5}-?\d{4}/, // Telefone brasileiro com DDD
  tracking_correios: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]{2}\d{10}[A-Z]{2}$/,
  tracking_jadlog: /^\d{12,14}$/,
  tracking_loggi: /^LG\d{9}BR$/,
  tracking_total_express: /^TE\d{9}BR$/,
  tracking_azul_cargo: /^AC\d{9}BR$/,
  currency: /^\d+(\.\d{1,2})?$/,
  currency_br: /^\d+([,.]\d{1,2})?$/, // Valores brasileiros com vírgula ou ponto
  currency_br_full: /^R\$\s*\d+([,.]\d{1,2})?$/, // R$ 123,45 ou R$123.45
  date_br: /^\d{2}\/\d{2}\/\d{4}$/,
  date_iso: /^\d{4}-\d{2}-\d{2}$/,
  zipcode: /^\d{5}-?\d{3}$/,
  cpf: /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, // CPF com ou sem formatação
  cnpj: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, // CNPJ com ou sem formatação
  order_number: /^PED-\d{4}-\d{3,4}$/, // Padrão PED-2024-001 da planilha exemplo
  order_number_alt: /^\d{4}-\d{3,4}$/, // Apenas números do pedido
  tracking_generic: /^[A-Z0-9]{8,20}$/ // Códigos de rastreio genéricos
};

export const useSmartCSVAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Função para detectar campo baseado no nome da coluna
  const detectFieldByName = useCallback((columnName: string): { field: string; confidence: number; reasoning: string } | null => {
    const cleanName = columnName.toLowerCase().trim();

    for (const [field, patterns] of Object.entries(COLUMN_NAME_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(cleanName)) {
          const confidence = pattern.source.includes(cleanName) ? 0.9 : 0.7;
          return {
            field,
            confidence,
            reasoning: `Nome da coluna "${columnName}" corresponde ao padrão de ${field}`
          };
        }
      }
    }

    return null;
  }, []);

  // Função para detectar campo baseado no conteúdo
  const detectFieldByContent = useCallback((values: string[], columnName: string): { field: string; confidence: number; reasoning: string } | null => {
    if (values.length === 0) return null;

    // Analisar TODOS os valores da coluna, não apenas uma amostra
    const allValues = values.filter(v => v && v.trim());

    if (allValues.length === 0) return null;

    // Para colunas muito grandes, usar uma amostra representativa mas maior
    const sampleValues = allValues.length > 1000
      ? allValues.filter((_, index) => index % Math.ceil(allValues.length / 500) === 0).slice(0, 500)
      : allValues;

    const validValues = sampleValues;

    // Calcular percentual de valores que correspondem a cada padrão
    const matches = {
      email: validValues.filter(v => CONTENT_PATTERNS.email.test(v)).length / validValues.length,
      phone: validValues.filter(v => CONTENT_PATTERNS.phone.test(v) || CONTENT_PATTERNS.phone_br.test(v)).length / validValues.length,
      tracking_correios: validValues.filter(v => CONTENT_PATTERNS.tracking_correios.test(v)).length / validValues.length,
      tracking_jadlog: validValues.filter(v => CONTENT_PATTERNS.tracking_jadlog.test(v)).length / validValues.length,
      tracking_loggi: validValues.filter(v => CONTENT_PATTERNS.tracking_loggi.test(v)).length / validValues.length,
      tracking_total_express: validValues.filter(v => CONTENT_PATTERNS.tracking_total_express.test(v)).length / validValues.length,
      tracking_azul_cargo: validValues.filter(v => CONTENT_PATTERNS.tracking_azul_cargo.test(v)).length / validValues.length,
      tracking_generic: validValues.filter(v => CONTENT_PATTERNS.tracking_generic.test(v)).length / validValues.length,
      currency: validValues.filter(v => CONTENT_PATTERNS.currency.test(v) || CONTENT_PATTERNS.currency_br.test(v) || CONTENT_PATTERNS.currency_br_full.test(v)).length / validValues.length,
      date_br: validValues.filter(v => CONTENT_PATTERNS.date_br.test(v)).length / validValues.length,
      date_iso: validValues.filter(v => CONTENT_PATTERNS.date_iso.test(v)).length / validValues.length,
      zipcode: validValues.filter(v => CONTENT_PATTERNS.zipcode.test(v)).length / validValues.length,
      cpf: validValues.filter(v => CONTENT_PATTERNS.cpf.test(v)).length / validValues.length,
      cnpj: validValues.filter(v => CONTENT_PATTERNS.cnpj.test(v)).length / validValues.length,
      order_number: validValues.filter(v => CONTENT_PATTERNS.order_number.test(v) || CONTENT_PATTERNS.order_number_alt.test(v)).length / validValues.length
    };

    // Mapeamento de padrões para campos
    const contentMapping = {
      email: 'customer_email',
      phone: 'customer_phone',
      tracking_correios: 'tracking_code',
      tracking_jadlog: 'tracking_code',
      tracking_loggi: 'tracking_code',
      tracking_total_express: 'tracking_code',
      tracking_azul_cargo: 'tracking_code',
      tracking_generic: 'tracking_code',
      currency: 'order_value',
      date_br: 'order_date',
      date_iso: 'order_date',
      zipcode: 'delivery_zipcode',
      cpf: 'cpf_cnpj',
      cnpj: 'cpf_cnpj',
      order_number: 'order_number'
    };

    // Encontrar o padrão com maior correspondência
    let bestMatch = '';
    let bestConfidence = 0;
    let reasoning = '';

    for (const [pattern, percentage] of Object.entries(matches)) {
      if (percentage > 0.6 && percentage > bestConfidence) { // Pelo menos 60% dos valores devem corresponder (mais permissivo)
        bestMatch = contentMapping[pattern as keyof typeof contentMapping] || '';
        bestConfidence = percentage;
        reasoning = `${Math.round(percentage * 100)}% dos valores em "${columnName}" correspondem ao padrão de ${bestMatch}`;
      }
    }

    // Detecção especial para nomes (valores textuais longos sem números)
    if (!bestMatch && validValues.every(v => v.length > 3 && !/\d/.test(v) && v.split(' ').length >= 2)) {
      const nameLike = validValues.filter(v => /^[a-zA-ZÀ-ÿ\s]+$/.test(v.trim())).length / validValues.length;
      if (nameLike > 0.7) { // Reduzido de 0.8 para 0.7 para ser mais permissivo
        bestMatch = 'customer_name';
        bestConfidence = nameLike;
        reasoning = `${Math.round(nameLike * 100)}% dos valores parecem ser nomes completos`;
      }
    }

    // Detecção especial para códigos de rastreio por prefixo
    if (!bestMatch) {
      const prefixes = validValues.map(v => v.substring(0, 2).toUpperCase());
      const commonPrefix = prefixes.find(p => prefixes.filter(pref => pref === p).length > validValues.length * 0.5); // Reduzido de 0.6 para 0.5

      if (commonPrefix) {
        if (['BR', 'JD', 'TE', 'AC', 'LG', 'SM'].includes(commonPrefix)) {
          bestMatch = 'tracking_code';
          bestConfidence = 0.8;
          reasoning = `Prefixo "${commonPrefix}" comum em códigos de rastreio`;
        } else if (commonPrefix === 'PE' || /^\d{2}/.test(commonPrefix)) {
          bestMatch = 'order_number';
          bestConfidence = 0.7;
          reasoning = `Padrão sugere número de pedido`;
        }
      }
    }

    // Detecção específica para NuvemShop - transportadoras por nome
    if (!bestMatch && columnName.toLowerCase().includes('entrega') || columnName.toLowerCase().includes('transportadora')) {
      const deliveryValues = validValues.map(v => v.toLowerCase());
      const hasCorreios = deliveryValues.some(v => v.includes('correios'));
      const hasJadlog = deliveryValues.some(v => v.includes('jadlog'));
      const hasLoggi = deliveryValues.some(v => v.includes('loggi'));
      const hasTotalExpress = deliveryValues.some(v => v.includes('total') && v.includes('express'));
      const hasAzulCargo = deliveryValues.some(v => v.includes('azul') && v.includes('cargo'));

      if (hasCorreios || hasJadlog || hasLoggi || hasTotalExpress || hasAzulCargo) {
        bestMatch = 'carrier';
        bestConfidence = 0.9;
        reasoning = 'Coluna contém nomes de transportadoras brasileiras';
      }
    }

    // Detecção específica para transportadoras por conteúdo (mesmo sem nome específico na coluna)
    if (!bestMatch) {
      const deliveryValues = validValues.map(v => v.toLowerCase());
      const carrierNames = ['correios', 'jadlog', 'loggi', 'total express', 'azul cargo', 'sedex', 'pac'];
      const hasAnyCarrier = deliveryValues.some(v =>
        carrierNames.some(carrier => v.includes(carrier))
      );

      if (hasAnyCarrier) {
        bestMatch = 'carrier';
        bestConfidence = 0.8;
        reasoning = 'Conteúdo contém nomes de transportadoras';
      }
    }

    // Detecção específica para campos de endereço da NuvemShop
    if (!bestMatch) {
      // Detectar bairros (geralmente nomes sem números, curtos)
      if (validValues.every(v => v.length < 30 && !/\d/.test(v) && v.split(' ').length <= 3)) {
        const neighborhoodLike = validValues.filter(v => /^[a-zA-ZÀ-ÿ\s.-]+$/.test(v.trim())).length / validValues.length;
        if (neighborhoodLike > 0.8) {
          bestMatch = 'delivery_neighborhood';
          bestConfidence = neighborhoodLike;
          reasoning = 'Conteúdo parece ser nomes de bairros';
        }
      }

      // Detectar cidades (nomes maiores, sem números)
      if (validValues.every(v => v.length > 3 && v.length < 50 && !/\d/.test(v))) {
        const cityLike = validValues.filter(v => /^[a-zA-ZÀ-ÿ\s.-]+$/.test(v.trim())).length / validValues.length;
        if (cityLike > 0.7) {
          bestMatch = 'delivery_city';
          bestConfidence = cityLike;
          reasoning = 'Conteúdo parece ser nomes de cidades';
        }
      }

      // Detectar estados (siglas de 2 letras ou nomes completos)
      const statePatterns = validValues.filter(v =>
        /^[A-Z]{2}$/.test(v.trim()) || // Siglas como SP, RJ
        ['são paulo', 'rio de janeiro', 'minas gerais', 'bahia', 'paraná', 'santa catarina', 'rio grande do sul'].includes(v.toLowerCase())
      ).length / validValues.length;
      if (statePatterns > 0.8) {
        bestMatch = 'delivery_state';
        bestConfidence = statePatterns;
        reasoning = 'Conteúdo parece ser estados brasileiros';
      }

      // Detectar países
      const countryPatterns = validValues.filter(v =>
        v.toLowerCase().includes('brasil') || v.toLowerCase() === 'br'
      ).length / validValues.length;
      if (countryPatterns > 0.7) {
        bestMatch = 'delivery_country';
        bestConfidence = countryPatterns;
        reasoning = 'Conteúdo parece ser países';
      }
    }

    return bestMatch ? { field: bestMatch, confidence: bestConfidence, reasoning } : null;
  }, []);

  // Função para validar detecções e resolver conflitos
  const validateAndResolveConflicts = useCallback((detections: DetectedField[]): DetectedField[] => {
    const fieldCounts: Record<string, number> = {};
    const validDetections: DetectedField[] = [];

    // Contar ocorrências de cada campo detectado
    detections.forEach(detection => {
      if (detection.detectedField) {
        fieldCounts[detection.detectedField] = (fieldCounts[detection.detectedField] || 0) + 1;
      }
    });

    // Resolver conflitos (múltiplas colunas mapeadas para o mesmo campo)
    detections.forEach(detection => {
      if (!detection.detectedField) {
        validDetections.push(detection);
        return;
      }

      const count = fieldCounts[detection.detectedField];
      if (count === 1) {
        // Sem conflito
        validDetections.push(detection);
      } else {
        // Conflito: estratégia inteligente de resolução
        const conflicting = detections.filter(d =>
          d.detectedField === detection.detectedField &&
          d.csvColumn !== detection.csvColumn
        );

        const allConflicting = [detection, ...conflicting];

        // Estratégia 1: Preferir detecção por nome de coluna sobre detecção por conteúdo
        const nameBased = allConflicting.filter(d => d.reasoning.includes('Nome da coluna'));
        if (nameBased.length === 1) {
          if (detection === nameBased[0]) {
            validDetections.push({
              ...detection,
              reasoning: `${detection.reasoning} (conflito resolvido - prioridade para nome da coluna)`
            });
          } else {
            validDetections.push({
              ...detection,
              detectedField: '',
              confidence: 0,
              reasoning: `Conflito com coluna de nome específico - não mapeada automaticamente`,
              validationErrors: [`Conflito com coluna "${nameBased[0].csvColumn}" que tem nome mais específico`]
            });
          }
          return;
        }

        // Estratégia 2: Se ambas são detecções por conteúdo, escolher a com maior confiança
        const best = allConflicting.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        if (detection === best) {
          validDetections.push({
            ...detection,
            reasoning: `${detection.reasoning} (conflito resolvido - maior confiança entre ${allConflicting.length} opções)`
          });
        } else {
          // Esta detecção perdeu o conflito
          validDetections.push({
            ...detection,
            detectedField: '',
            confidence: 0,
            reasoning: `Conflito resolvido em favor de coluna com maior confiança`,
            validationErrors: [`Conflito resolvido em favor de "${best.csvColumn}" (confiança: ${Math.round(best.confidence * 100)}%)`]
          });
        }
      }
    });

    return validDetections;
  }, []);

  // Função principal de análise inteligente
  const analyzeCSV = useCallback(async (
    csvHeaders: string[],
    csvData: Record<string, string>[]
  ): Promise<FieldDetectionResult> => {
    setIsAnalyzing(true);

    try {
      const detections: DetectedField[] = [];
      const suggestions: string[] = [];

      // Para cada coluna, tentar detectar o campo
      for (const header of csvHeaders) {
        const columnValues = csvData.map(row => row[header] || '').filter(v => v.trim());

        let detectedField = '';
        let confidence = 0;
        let reasoning = '';
        const validationErrors: string[] = [];

        // 1. Primeiro tentar detectar pelo nome da coluna
        const nameDetection = detectFieldByName(header);
        if (nameDetection) {
          detectedField = nameDetection.field;
          confidence = nameDetection.confidence;
          reasoning = nameDetection.reasoning;
        }

        // 2. Se não conseguiu pelo nome, tentar pelo conteúdo
        if (!detectedField && columnValues.length > 0) {
          const contentDetection = detectFieldByContent(columnValues, header);
          if (contentDetection && contentDetection.confidence > confidence) {
            detectedField = contentDetection.field;
            confidence = contentDetection.confidence;
            reasoning = contentDetection.reasoning;
          }
        }

        // 3. Detecção específica para datas de entrega (previsao_entrega)
        if (!detectedField && header.toLowerCase().includes('previsao') && header.toLowerCase().includes('entrega')) {
          const dateMatches = columnValues.filter(v => CONTENT_PATTERNS.date_br.test(v)).length / columnValues.length;
          if (dateMatches > 0.7) {
            detectedField = 'estimated_delivery';
            confidence = 0.85;
            reasoning = `Coluna "${header}" contém datas no formato brasileiro (DD/MM/YYYY)`;
          }
        }

        // 4. Detecção específica para valores de pedido (valor_pedido)
        if (!detectedField && header.toLowerCase().includes('valor') && header.toLowerCase().includes('pedido')) {
          const currencyMatches = columnValues.filter(v => CONTENT_PATTERNS.currency_br.test(v)).length / columnValues.length;
          if (currencyMatches > 0.7) {
            detectedField = 'order_value';
            confidence = 0.85;
            reasoning = `Coluna "${header}" contém valores monetários`;
          }
        }

        // 5. Validações de consistência entre campos relacionados
        if (detectedField) {
          // Validação de CPF/CNPJ
          if (detectedField === 'cpf_cnpj' && columnValues.length > 0) {
            const cpfMatches = columnValues.filter(v => CONTENT_PATTERNS.cpf.test(v)).length;
            const cnpjMatches = columnValues.filter(v => CONTENT_PATTERNS.cnpj.test(v)).length;
            const total = cpfMatches + cnpjMatches;

            if (total / columnValues.length < 0.6) {
              validationErrors.push('Menos de 60% dos valores parecem ser CPF ou CNPJ válidos');
              confidence *= 0.8;
            } else if (cpfMatches > 0 && cnpjMatches > 0) {
              reasoning += ' (mistura de CPF e CNPJ detectada)';
            }
          }

          // Validação de endereço - verificar se tem números quando deveria
          if (detectedField === 'delivery_address' && columnValues.length > 0) {
            const hasNumbers = columnValues.filter(v => /\d/.test(v)).length / columnValues.length;
            if (hasNumbers < 0.3) {
              validationErrors.push('Endereços normalmente contêm números - verifique se este campo está correto');
              confidence *= 0.9;
            }
          }

          // Validação de bairro - não deve ter números
          if (detectedField === 'delivery_neighborhood' && columnValues.length > 0) {
            const hasNumbers = columnValues.filter(v => /\d/.test(v)).length / columnValues.length;
            if (hasNumbers > 0.2) {
              validationErrors.push('Bairros normalmente não contêm números');
              confidence *= 0.8;
            }
          }

          // Validação de estado - deve ser siglas válidas ou nomes completos
          if (detectedField === 'delivery_state' && columnValues.length > 0) {
            const validStates = columnValues.filter(v => {
              const upper = v.toUpperCase().trim();
              return /^[A-Z]{2}$/.test(upper) || // Siglas
                ['SÃO PAULO', 'RIO DE JANEIRO', 'MINAS GERAIS', 'BAHIA', 'PARANÁ', 'SANTA CATARINA', 'RIO GRANDE DO SUL', 'PARAÍBA', 'ALAGOAS', 'SERGIPE', 'MATO GROSSO', 'MATO GROSSO DO SUL', 'GOIÁS', 'DISTRITO FEDERAL', 'AMAZONAS', 'RORAIMA', 'AMAPÁ', 'TOCANTINS', 'RONDÔNIA', 'ACRE', 'CEARÁ', 'MARANHÃO', 'PIAUÍ', 'PERNAMBUCO', 'RIO GRANDE DO NORTE'].includes(upper);
            }).length / columnValues.length;

            if (validStates < 0.8) {
              validationErrors.push('Menos de 80% dos valores parecem ser estados brasileiros válidos');
              confidence *= 0.7;
            }
          }

          // Validação de fraudes básicas
          if (detectedField === 'tracking_code' && columnValues.length > 10) {
            // Verificar códigos duplicados (muito suspeito)
            const uniqueCodes = new Set(columnValues.map(v => v.trim().toUpperCase()));
            const duplicateRatio = 1 - (uniqueCodes.size / columnValues.length);

            if (duplicateRatio > 0.3) {
              validationErrors.push(`Alto índice de códigos de rastreio duplicados (${Math.round(duplicateRatio * 100)}%) - possível fraude`);
              confidence *= 0.7;
            }

            // Verificar padrões suspeitos (todos começando com mesma sequência)
            const firstChars = columnValues.map(v => v.substring(0, 3).toUpperCase());
            const mostCommon = firstChars.reduce((acc, curr) => {
              acc[curr] = (acc[curr] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const maxCount = Math.max(...Object.values(mostCommon));
            const suspiciousRatio = maxCount / columnValues.length;

            if (suspiciousRatio > 0.8) {
              validationErrors.push('Padrão suspeito detectado - muitos códigos começam com a mesma sequência');
              confidence *= 0.8;
            }
          }

          // Validação de emails suspeitos
          if (detectedField === 'customer_email' && columnValues.length > 5) {
            const suspiciousEmails = columnValues.filter(v =>
              v.includes('temp') || v.includes('test') || /^\d+@/.test(v) || /@temp\./.test(v)
            ).length / columnValues.length;

            if (suspiciousEmails > 0.2) {
              validationErrors.push('Detectados emails temporários ou de teste');
              confidence *= 0.9;
            }
          }

          // Validação de valores monetários suspeitos
          if (detectedField === 'order_value' && columnValues.length > 0) {
            const numericValues = columnValues
              .map(v => parseFloat(v.replace(/[R$\s,.]/g, '').replace(',', '.')))
              .filter(v => !isNaN(v));

            if (numericValues.length > 0) {
              const avgValue = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
              const highValues = numericValues.filter(v => v > avgValue * 10).length;

              if (highValues > numericValues.length * 0.1) {
                validationErrors.push('Valores muito discrepantes detectados - verifique se estão em reais');
                confidence *= 0.9;
              }
            }
          }
        }

        detections.push({
          csvColumn: header,
          detectedField,
          confidence,
          reasoning,
          sampleValues: columnValues.slice(0, 3),
          validationErrors
        });
      }

      // Resolver conflitos entre detecções
      const resolvedDetections = validateAndResolveConflicts(detections);

      // Calcular confiança geral
      const mappedFields = resolvedDetections.filter(d => d.detectedField);
      const avgConfidence = mappedFields.length > 0
        ? mappedFields.reduce((sum, d) => sum + d.confidence, 0) / mappedFields.length
        : 0;

      // Gerar sugestões
      const unmappedColumns = resolvedDetections.filter(d => !d.detectedField).map(d => d.csvColumn);
      if (unmappedColumns.length > 0) {
        suggestions.push(`${unmappedColumns.length} colunas não foram mapeadas automaticamente. Você pode mapeá-las manualmente.`);
      }

      const lowConfidence = resolvedDetections.filter(d => d.detectedField && d.confidence < 0.7);
      if (lowConfidence.length > 0) {
        suggestions.push(`${lowConfidence.length} mapeamentos têm baixa confiança. Verifique se estão corretos.`);
      }

      const requiredFields = ['tracking_code', 'customer_name', 'customer_email'];
      const mappedRequired = mappedFields.filter(d => requiredFields.includes(d.detectedField)).length;
      if (mappedRequired < requiredFields.length) {
        suggestions.push(`Campos obrigatórios não detectados. Certifique-se de mapear: ${requiredFields.join(', ')}`);
      }

      return {
        detectedFields: resolvedDetections,
        unmappedColumns,
        confidence: avgConfidence,
        suggestions
      };

    } finally {
      setIsAnalyzing(false);
    }
  }, [detectFieldByName, detectFieldByContent, validateAndResolveConflicts]);

  return {
    analyzeCSV,
    isAnalyzing
  };
};