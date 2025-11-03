/**
 * Detector Automático de Plataforma E-commerce
 * Analisa headers do CSV e identifica qual e-commerce
 */

import type { DetectionResult, EcommerceTemplate } from './types';
import { nuvemshopTemplate } from './platforms/nuvemshop';

// ===== TEMPLATES DISPONÍVEIS =====
const availableTemplates: EcommerceTemplate[] = [
  nuvemshopTemplate,
  // Adicionar outros templates aqui
];

/**
 * Normaliza header para comparação
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, '_'); // Substitui espaços por underscore
}

/**
 * Calcula similaridade entre dois textos (0-1)
 * Usa algoritmo de Levenshtein simplificado
 */
function similarity(str1: string, str2: string): number {
  const s1 = normalizeHeader(str1);
  const s2 = normalizeHeader(str2);
  
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1;
  
  // Se um contém o outro, alta similaridade
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Verifica palavras em comum
  const words1 = s1.split('_');
  const words2 = s2.split('_');
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords / totalWords;
}

/**
 * Encontra melhor match para um header
 */
function findBestMatch(header: string, candidates: string[]): {
  match: string;
  score: number;
} {
  let bestMatch = '';
  let bestScore = 0;
  
  for (const candidate of candidates) {
    const score = similarity(header, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  return { match: bestMatch, score: bestScore };
}

/**
 * Detecta plataforma e-commerce analisando headers do CSV
 */
export function detectPlatform(headers: string[]): DetectionResult {
  let bestTemplate: EcommerceTemplate | undefined;
  let bestConfidence = 0;
  let bestMatches: string[] = [];
  
  for (const template of availableTemplates) {
    const { uniqueHeaders, requiredHeaders, minConfidence } = template.detection;
    
    let score = 0;
    const matches: string[] = [];
    
    // Verifica headers únicos (peso maior)
    for (const uniqueHeader of uniqueHeaders) {
      const { match, score: matchScore } = findBestMatch(uniqueHeader, headers);
      if (matchScore > 0.8) { // 80% similaridade mínima
        score += 20; // 20 pontos por header único
        matches.push(match);
      }
    }
    
    // Verifica headers obrigatórios (peso menor)
    for (const requiredHeader of requiredHeaders) {
      const { match, score: matchScore } = findBestMatch(requiredHeader, headers);
      if (matchScore > 0.7) { // 70% similaridade mínima
        score += 5; // 5 pontos por header obrigatório
        matches.push(match);
      }
    }
    
    // Calcula confiança final (0-100)
    const maxScore = (uniqueHeaders.length * 20) + (requiredHeaders.length * 5);
    const confidence = Math.min(100, (score / maxScore) * 100);
    
    if (confidence >= minConfidence && confidence > bestConfidence) {
      bestConfidence = confidence;
      bestTemplate = template;
      bestMatches = matches;
    }
  }
  
  // Se não encontrou nenhum template
  if (!bestTemplate) {
    return {
      platform: 'unknown',
      confidence: 0,
      matchedHeaders: [],
      suggestions: [
        'Formato não reconhecido. Configure o mapeamento manualmente.',
        'Headers encontrados: ' + headers.slice(0, 5).join(', ') + '...',
      ],
    };
  }
  
  return {
    platform: bestTemplate.platform,
    confidence: Math.round(bestConfidence),
    matchedHeaders: bestMatches,
    template: bestTemplate,
    suggestions: bestConfidence < 90 
      ? ['Confiança média. Revise o mapeamento antes de importar.']
      : [],
  };
}

/**
 * Valida se headers contêm campos mínimos necessários
 */
export function validateHeaders(headers: string[]): {
  valid: boolean;
  missingFields: string[];
} {
  const essentialFields = [
    'pedido', 'order', 'numero',
    'email', 'e-mail',
    'rastreio', 'tracking', 'codigo',
  ];
  
  const normalizedHeaders = headers.map(normalizeHeader);
  
  const hasPedido = normalizedHeaders.some(h => 
    h.includes('pedido') || h.includes('order') || h.includes('numero')
  );
  
  const hasEmail = normalizedHeaders.some(h =>
    h.includes('email') || h.includes('e_mail')
  );
  
  const hasTracking = normalizedHeaders.some(h =>
    h.includes('rastreio') || h.includes('tracking') || h.includes('codigo')
  );
  
  const missingFields: string[] = [];
  if (!hasPedido) missingFields.push('Número do Pedido');
  if (!hasEmail) missingFields.push('E-mail');
  if (!hasTracking) missingFields.push('Código de Rastreio');
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Sugere mapeamentos para headers desconhecidos
 */
export function suggestMappings(headers: string[]): Record<string, string[]> {
  const suggestions: Record<string, string[]> = {};
  
  const fieldPatterns: Record<string, string[]> = {
    'order_id': ['pedido', 'order', 'numero', 'id'],
    'customer_email': ['email', 'e-mail', 'correio'],
    'customer_name': ['nome', 'name', 'cliente', 'customer', 'comprador'],
    'tracking_code': ['rastreio', 'tracking', 'codigo', 'code', 'track'],
    'customer_phone': ['telefone', 'phone', 'fone', 'tel', 'celular'],
    'order_date': ['data', 'date', 'quando', 'dia'],
    'total': ['total', 'valor', 'price', 'preco'],
  };
  
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const possibleFields: string[] = [];
    
    for (const [field, patterns] of Object.entries(fieldPatterns)) {
      for (const pattern of patterns) {
        if (normalized.includes(pattern)) {
          possibleFields.push(field);
          break;
        }
      }
    }
    
    if (possibleFields.length > 0) {
      suggestions[header] = possibleFields;
    }
  }
  
  return suggestions;
}
