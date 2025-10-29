/**
 * Serviço Inteligente de Detecção Automática de Transportadora
 * 
 * Utiliza múltiplos critérios para detectar a transportadora:
 * 1. Regex patterns (alta precisão)
 * 2. Comprimento do código
 * 3. Checksum/validação
 * 4. Prefixos conhecidos
 * 5. Histórico do usuário (aprendizado)
 * 6. Validação cruzada
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  CARRIER_PATTERNS, 
  getPatternsByPrefix, 
  getCarrierById,
  type CarrierPattern 
} from '@/data/carrierPatterns';

/**
 * Resultado da detecção com nível de confiança
 */
export interface DetectionResult {
  carrier: CarrierPattern;
  confidence: number; // 0-100
  matchedCriteria: string[]; // Critérios que deram match
  score: number; // Pontuação bruta
}

/**
 * Opções de detecção
 */
export interface DetectionOptions {
  userId?: string; // Para aprendizado personalizado
  country?: string; // Filtrar por país
  includeInternational?: boolean; // Incluir transportadoras internacionais
  minConfidence?: number; // Confiança mínima (0-100)
  maxResults?: number; // Número máximo de sugestões
  useHistory?: boolean; // Usar histórico do usuário
}

/**
 * Serviço de Detecção de Transportadora
 */
export class CarrierDetectionService {
  
  /**
   * Detecta a transportadora de um código de rastreamento
   */
  static async detect(
    trackingCode: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResult[]> {
    const {
      userId,
      country = 'BR',
      includeInternational = true,
      minConfidence = 50,
      maxResults = 5,
      useHistory = true,
    } = options;

    // Normalizar código
    const normalizedCode = this.normalizeCode(trackingCode);
    
    // 1. Busca rápida por prefixo
    const prefixCandidates = getPatternsByPrefix(normalizedCode);
    
    // 2. Busca completa em todos os padrões
    const allCandidates = includeInternational 
      ? CARRIER_PATTERNS 
      : CARRIER_PATTERNS.filter(p => p.country === country);

    // 3. Calcular score para cada candidato
    const results: DetectionResult[] = [];
    
    for (const pattern of allCandidates) {
      const result = this.scorePattern(normalizedCode, pattern, prefixCandidates.includes(pattern));
      
      if (result.confidence >= minConfidence) {
        results.push(result);
      }
    }

    // 4. Aplicar boost de histórico do usuário
    if (useHistory && userId) {
      await this.applyHistoryBoost(results, userId, normalizedCode);
    }

    // 5. Ordenar por confiança e limitar resultados
    results.sort((a, b) => b.confidence - a.confidence);
    
    return results.slice(0, maxResults);
  }

  /**
   * Detecta apenas a transportadora mais provável
   */
  static async detectBest(
    trackingCode: string,
    options: DetectionOptions = {}
  ): Promise<DetectionResult | null> {
    const results = await this.detect(trackingCode, { ...options, maxResults: 1 });
    return results[0] || null;
  }

  /**
   * Calcula score/confiança de um padrão para um código
   */
  private static scorePattern(
    code: string,
    pattern: CarrierPattern,
    hasPrefix: boolean
  ): DetectionResult {
    let score = 0;
    const matchedCriteria: string[] = [];

    // 1. REGEX MATCH (0-40 pontos)
    const regexMatch = pattern.regex.some(r => r.test(code));
    if (regexMatch) {
      score += 40;
      matchedCriteria.push('regex');
    }

    // 2. COMPRIMENTO (0-15 pontos)
    const lengthMatch = this.checkLength(code, pattern.length);
    if (lengthMatch) {
      score += 15;
      matchedCriteria.push('length');
    }

    // 3. CHECKSUM (0-20 pontos)
    if (pattern.checksum) {
      try {
        const checksumValid = pattern.checksum(code);
        if (checksumValid) {
          score += 20;
          matchedCriteria.push('checksum');
        }
      } catch (error) {
        // Ignorar erro de checksum
      }
    }

    // 4. PREFIXO (0-15 pontos)
    if (hasPrefix) {
      score += 15;
      matchedCriteria.push('prefix');
    }

    // 5. PRIORIDADE DO PADRÃO (0-10 pontos)
    // Padrões mais específicos têm prioridade maior
    score += (pattern.priority / 100) * 10;

    // Calcular confiança (0-100%)
    const maxScore = 40 + 15 + 20 + 15 + 10; // 100
    const confidence = Math.min(100, Math.round((score / maxScore) * 100));

    return {
      carrier: pattern,
      confidence,
      matchedCriteria,
      score,
    };
  }

  /**
   * Verifica se o comprimento do código está dentro do esperado
   */
  private static checkLength(
    code: string,
    length?: number | [number, number]
  ): boolean {
    if (!length) return true;

    const codeLength = code.length;

    if (typeof length === 'number') {
      return codeLength === length;
    } else {
      const [min, max] = length;
      return codeLength >= min && codeLength <= max;
    }
  }

  /**
   * Normaliza código de rastreamento
   */
  private static normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  /**
   * Aplica boost baseado no histórico do usuário
   * 
   * Aprende com padrões anteriores:
   * - Transportadoras mais usadas ganham boost
   * - Padrões similares ganham boost
   */
  private static async applyHistoryBoost(
    results: DetectionResult[],
    userId: string,
    code: string
  ): Promise<void> {
    try {
      // Buscar histórico recente (últimos 100 rastreamentos)
      const { data: history } = await supabase
        .from('orders')
        .select('carrier, tracking_code')
        .eq('user_id', userId)
        .not('carrier', 'is', null)
        .not('tracking_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!history || history.length === 0) return;

      // Contar frequência de cada transportadora
      const carrierFrequency = new Map<string, number>();
      history.forEach(order => {
        const count = carrierFrequency.get(order.carrier!) || 0;
        carrierFrequency.set(order.carrier!, count + 1);
      });

      // Aplicar boost proporcional à frequência
      const totalOrders = history.length;
      results.forEach(result => {
        const frequency = carrierFrequency.get(result.carrier.id) || 0;
        const boost = (frequency / totalOrders) * 15; // Até 15 pontos de boost
        
        if (boost > 0) {
          result.score += boost;
          result.confidence = Math.min(100, result.confidence + Math.round(boost));
          result.matchedCriteria.push('history');
        }
      });

      // Boost adicional por similaridade de código
      results.forEach(result => {
        const similarCodes = history.filter(order => 
          order.carrier === result.carrier.id &&
          this.areSimilar(order.tracking_code!, code)
        );

        if (similarCodes.length > 0) {
          const similarityBoost = Math.min(10, similarCodes.length * 2);
          result.score += similarityBoost;
          result.confidence = Math.min(100, result.confidence + similarityBoost);
          
          if (!result.matchedCriteria.includes('similarity')) {
            result.matchedCriteria.push('similarity');
          }
        }
      });

    } catch (error) {
      console.error('Erro ao aplicar boost de histórico:', error);
    }
  }

  /**
   * Verifica se dois códigos são similares (mesmo padrão)
   */
  private static areSimilar(code1: string, code2: string): boolean {
    const c1 = this.normalizeCode(code1);
    const c2 = this.normalizeCode(code2);

    if (c1.length !== c2.length) return false;

    // Verifica se têm o mesmo prefixo (primeiras 2-3 letras)
    const prefix1 = c1.slice(0, 3);
    const prefix2 = c2.slice(0, 3);

    return prefix1 === prefix2;
  }

  /**
   * Valida se um código pertence a uma transportadora específica
   */
  static validate(trackingCode: string, carrierId: string): boolean {
    const pattern = getCarrierById(carrierId);
    if (!pattern) return false;

    const normalizedCode = this.normalizeCode(trackingCode);
    const result = this.scorePattern(normalizedCode, pattern, false);

    return result.confidence >= 70; // Confiança mínima de 70% para validação
  }

  /**
   * Retorna sugestões de correção para um código inválido
   */
  static async suggestCorrections(
    trackingCode: string,
    options: DetectionOptions = {}
  ): Promise<string[]> {
    const suggestions: string[] = [];
    const normalized = this.normalizeCode(trackingCode);

    // 1. Remover espaços extras
    if (trackingCode !== normalized) {
      suggestions.push(normalized);
    }

    // 2. Adicionar prefixo BR se parecer código dos Correios
    if (/^[A-Z]{2}\d{9}$/i.test(normalized)) {
      suggestions.push(normalized + 'BR');
    }

    // 3. Remover prefixo BR se estiver duplicado
    if (normalized.endsWith('BRBR')) {
      suggestions.push(normalized.slice(0, -2));
    }

    // 4. Corrigir letras trocadas por números similares
    const withCorrections = normalized
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S');

    if (withCorrections !== normalized) {
      suggestions.push(withCorrections);
    }

    // 5. Testar se alguma sugestão tem alta confiança
    const validSuggestions: string[] = [];
    for (const suggestion of suggestions) {
      const result = await this.detectBest(suggestion, options);
      if (result && result.confidence >= 80) {
        validSuggestions.push(suggestion);
      }
    }

    return validSuggestions;
  }

  /**
   * Retorna estatísticas de detecção do usuário
   */
  static async getDetectionStats(userId: string): Promise<{
    totalDetections: number;
    byCarrier: Record<string, number>;
    averageConfidence: number;
    mostUsed: string | null;
  }> {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('carrier')
        .eq('user_id', userId)
        .not('carrier', 'is', null);

      if (!orders || orders.length === 0) {
        return {
          totalDetections: 0,
          byCarrier: {},
          averageConfidence: 0,
          mostUsed: null,
        };
      }

      const byCarrier: Record<string, number> = {};
      orders.forEach(order => {
        if (order.carrier) {
          byCarrier[order.carrier] = (byCarrier[order.carrier] || 0) + 1;
        }
      });

      const mostUsed = Object.entries(byCarrier)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      return {
        totalDetections: orders.length,
        byCarrier,
        averageConfidence: 85, // Placeholder - seria calculado de metadata
        mostUsed,
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return {
        totalDetections: 0,
        byCarrier: {},
        averageConfidence: 0,
        mostUsed: null,
      };
    }
  }
}
