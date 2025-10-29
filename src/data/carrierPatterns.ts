/**
 * Base de Dados Inteligente de Padrões de Transportadoras
 * 
 * Sistema completo de detecção com:
 * - Regex patterns para validação
 * - Comprimento exato ou range
 * - Algoritmos de checksum (quando aplicável)
 * - Exemplos reais para testes
 * - Prioridade de detecção
 * - Padrões de formato
 */

export interface CarrierPattern {
  id: string;
  name: string;
  country: string;
  regex: RegExp[];
  length?: number | [number, number]; // Exato ou [min, max]
  checksum?: (code: string) => boolean;
  priority: number; // Maior = mais específico
  examples: string[];
  prefixes?: string[];
  format?: string; // Formato visual (ex: "AA123456789BR")
  description: string;
}

/**
 * Valida checksum dos Correios (módulo 11)
 */
const correiosChecksum = (code: string): boolean => {
  const numbers = code.match(/\d+/g)?.[0];
  if (!numbers || numbers.length !== 8) return true; // Sem checksum
  
  const weights = [8, 6, 4, 2, 3, 5, 9, 7];
  let sum = 0;
  
  for (let i = 0; i < 8; i++) {
    sum += parseInt(numbers[i]) * weights[i];
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 5 : remainder === 1 ? 0 : 11 - remainder;
  const lastDigit = parseInt(code.match(/\d(\D{2})$/)?.[1] || '0');
  
  return checkDigit === lastDigit;
};

/**
 * Valida checksum da DHL (módulo 7)
 */
const dhlChecksum = (code: string): boolean => {
  if (code.length !== 10) return true;
  
  const numbers = code.slice(0, 9);
  const checkDigit = parseInt(code[9]);
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (i + 1);
  }
  
  return (sum % 7) === checkDigit;
};

/**
 * Valida checksum da UPS (algoritmo proprietário simplificado)
 */
const upsChecksum = (code: string): boolean => {
  if (code.length !== 18 || !code.startsWith('1Z')) return true;
  
  const trackingNumber = code.slice(2, -1);
  const checkDigit = code.slice(-1);
  
  let sum = 0;
  let isOdd = true;
  
  for (const char of trackingNumber) {
    const value = isNaN(parseInt(char)) ? char.charCodeAt(0) - 63 : parseInt(char);
    sum += isOdd ? value : value * 2;
    isOdd = !isOdd;
  }
  
  const calculatedCheck = ((sum % 10) === 0 ? 0 : 10 - (sum % 10)).toString();
  return calculatedCheck === checkDigit;
};

/**
 * Base de dados completa de transportadoras
 */
export const CARRIER_PATTERNS: CarrierPattern[] = [
  // ============================================
  // BRASIL
  // ============================================
  {
    id: 'correios',
    name: 'Correios',
    country: 'BR',
    regex: [
      /^[A-Z]{2}\d{9}[A-Z]{2}$/i, // Padrão internacional
      /^[A-Z]{2}\s?\d{9}\s?[A-Z]{2}$/i, // Com espaços
    ],
    length: 13,
    checksum: correiosChecksum,
    priority: 100,
    prefixes: ['JD', 'JE', 'JF', 'JH', 'JI', 'JJ', 'JK', 'JL', 'JM', 'JN', 'JO', 'JP', 'JQ', 'JR', 'JS', 'JT', 'JU', 'JV', 'JW', 'JX', 'JY', 'JZ', 'PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'PH', 'PI', 'PJ', 'PK', 'PL', 'PM', 'PN', 'PO', 'PP', 'PQ', 'PR', 'PS', 'PT', 'PU', 'PV', 'PW', 'PX', 'PY', 'PZ', 'RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ', 'RK', 'RL', 'RM', 'RN', 'RO', 'RP', 'RQ', 'RR', 'RS', 'RT', 'RU', 'RV', 'RW', 'RX', 'RY', 'RZ', 'SA', 'SB', 'SC', 'SD', 'SE', 'SF', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SP', 'SQ', 'SR', 'SS', 'ST', 'SU', 'SV', 'SW', 'SX', 'SY', 'SZ'],
    examples: [
      'JD123456789BR',
      'PA987654321BR',
      'RE123456789BR',
      'SS987654321BR',
    ],
    format: 'AA123456789BR',
    description: 'Código de rastreamento dos Correios (padrão internacional)',
  },
  {
    id: 'jadlog',
    name: 'Jadlog',
    country: 'BR',
    regex: [
      /^\d{14}$/,
      /^\d{15}$/,
    ],
    length: [14, 15],
    priority: 70,
    examples: [
      '12345678901234',
      '123456789012345',
    ],
    format: '12345678901234',
    description: 'Código numérico de 14 ou 15 dígitos',
  },
  {
    id: 'total-express',
    name: 'Total Express',
    country: 'BR',
    regex: [
      /^[A-Z]{3}\d{9,10}$/i,
      /^TE\d{10}$/i,
    ],
    length: [12, 13],
    priority: 75,
    prefixes: ['TEX', 'TE'],
    examples: [
      'TEX1234567890',
      'TE1234567890',
    ],
    format: 'TEX1234567890',
    description: 'Código com prefixo TEX ou TE seguido de números',
  },
  {
    id: 'loggi',
    name: 'Loggi',
    country: 'BR',
    regex: [
      /^LOG\d{12}$/i,
      /^[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12}$/i, // UUID
    ],
    priority: 80,
    prefixes: ['LOG'],
    examples: [
      'LOG123456789012',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    ],
    format: 'LOG123456789012 ou UUID',
    description: 'Código com prefixo LOG ou formato UUID',
  },
  {
    id: 'azul-cargo',
    name: 'Azul Cargo',
    country: 'BR',
    regex: [
      /^\d{3}-\d{8}$/,
      /^\d{11}$/,
    ],
    length: [11, 12], // Com ou sem hífen
    priority: 65,
    examples: [
      '123-45678901',
      '12345678901',
    ],
    format: '123-45678901',
    description: 'Código numérico com formato 123-45678901',
  },

  // ============================================
  // INTERNACIONAL
  // ============================================
  {
    id: 'fedex',
    name: 'FedEx',
    country: 'US',
    regex: [
      /^\d{12}$/, // 12 dígitos
      /^\d{15}$/, // 15 dígitos
      /^\d{20}$/, // 20 dígitos
      /^\d{22}$/, // 22 dígitos
    ],
    length: [12, 22],
    priority: 60,
    examples: [
      '123456789012',
      '123456789012345',
      '12345678901234567890',
    ],
    format: '12/15/20/22 dígitos',
    description: 'Código numérico de 12, 15, 20 ou 22 dígitos',
  },
  {
    id: 'ups',
    name: 'UPS',
    country: 'US',
    regex: [
      /^1Z[A-Z0-9]{16}$/i,
      /^\d{9}$/,
      /^T\d{10}$/i,
    ],
    length: [9, 18],
    checksum: upsChecksum,
    priority: 95,
    prefixes: ['1Z', 'T'],
    examples: [
      '1Z999AA10123456784',
      '123456789',
      'T1234567890',
    ],
    format: '1Z999AA10123456784',
    description: 'Código começando com 1Z + 16 caracteres alfanuméricos',
  },
  {
    id: 'dhl',
    name: 'DHL',
    country: 'DE',
    regex: [
      /^\d{10}$/,
      /^\d{11}$/,
      /^[A-Z]{3}\d{7}$/i,
    ],
    length: [10, 11],
    checksum: dhlChecksum,
    priority: 85,
    examples: [
      '1234567890',
      '12345678901',
      'JJD01234567890',
    ],
    format: '1234567890',
    description: 'Código numérico de 10 ou 11 dígitos',
  },
  {
    id: 'usps',
    name: 'USPS',
    country: 'US',
    regex: [
      /^[A-Z]{2}\d{9}US$/i,
      /^\d{20}$/,
      /^\d{22}$/,
      /^94\d{20}$/,
    ],
    length: [13, 22],
    priority: 90,
    prefixes: ['EA', 'EB', 'EC', 'ED', 'EE', 'CP', 'RA', 'RB', '94'],
    examples: [
      'EA123456789US',
      '9400111899223344556677',
      '12345678901234567890',
    ],
    format: 'EA123456789US ou 9400...',
    description: 'Código USPS (padrão internacional ou Priority Mail)',
  },
  {
    id: 'china-post',
    name: 'China Post',
    country: 'CN',
    regex: [
      /^[A-Z]{2}\d{9}[A-Z]{2}$/i,
      /^[A-Z]{2}\d{9}CN$/i,
    ],
    length: 13,
    priority: 70,
    prefixes: ['LY', 'LZ', 'LP', 'LO', 'LN', 'LM', 'LK', 'LJ', 'LI', 'LH', 'LG', 'LF', 'LE', 'LD', 'LC', 'LB', 'LA'],
    examples: [
      'LY123456789CN',
      'LZ987654321CN',
    ],
    format: 'LY123456789CN',
    description: 'Código internacional do China Post',
  },
  {
    id: 'aramex',
    name: 'Aramex',
    country: 'AE',
    regex: [
      /^\d{11}$/,
      /^\d{13}$/,
    ],
    length: [11, 13],
    priority: 55,
    examples: [
      '12345678901',
      '1234567890123',
    ],
    format: '12345678901',
    description: 'Código numérico de 11 ou 13 dígitos',
  },
  {
    id: 'tnt',
    name: 'TNT',
    country: 'NL',
    regex: [
      /^[A-Z]{2}\d{9}$/i,
      /^\d{9}$/,
    ],
    length: [9, 11],
    priority: 65,
    examples: [
      'GE123456789',
      '123456789',
    ],
    format: 'GE123456789',
    description: 'Código com 2 letras + 9 dígitos ou 9 dígitos',
  },
  {
    id: 'correios-portugal',
    name: 'CTT Portugal',
    country: 'PT',
    regex: [
      /^[A-Z]{2}\d{9}PT$/i,
    ],
    length: 13,
    priority: 80,
    prefixes: ['RR', 'RA', 'RB', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI'],
    examples: [
      'RR123456789PT',
      'RA987654321PT',
    ],
    format: 'RR123456789PT',
    description: 'Código internacional dos CTT Portugal',
  },

  // ============================================
  // E-COMMERCE MARKETPLACES
  // ============================================
  {
    id: 'mercado-envios',
    name: 'Mercado Envios',
    country: 'BR',
    regex: [
      /^ME\d{12}$/i,
      /^[A-Z]{2}\d{9}[A-Z]{2}$/i, // Às vezes usa código Correios
    ],
    priority: 75,
    prefixes: ['ME'],
    examples: [
      'ME123456789012',
      'PA123456789BR',
    ],
    format: 'ME123456789012',
    description: 'Código Mercado Envios ou código Correios',
  },
  {
    id: 'shopee',
    name: 'Shopee',
    country: 'SG',
    regex: [
      /^SPXBR\d{10,12}$/i,
      /^[A-Z]{2}\d{9}[A-Z]{2}$/i,
    ],
    priority: 70,
    prefixes: ['SPXBR', 'SPX'],
    examples: [
      'SPXBR1234567890',
      'PA123456789BR',
    ],
    format: 'SPXBR1234567890',
    description: 'Código Shopee Express ou código Correios',
  },
];

/**
 * Índice de prefixos para busca rápida
 */
export const CARRIER_PREFIX_INDEX = new Map<string, CarrierPattern[]>();

// Construir índice de prefixos
CARRIER_PATTERNS.forEach(pattern => {
  if (pattern.prefixes) {
    pattern.prefixes.forEach(prefix => {
      const existing = CARRIER_PREFIX_INDEX.get(prefix.toUpperCase()) || [];
      existing.push(pattern);
      CARRIER_PREFIX_INDEX.set(prefix.toUpperCase(), existing);
    });
  }
});

/**
 * Obtém padrões por prefixo (busca rápida)
 */
export function getPatternsByPrefix(code: string): CarrierPattern[] {
  const prefix2 = code.slice(0, 2).toUpperCase();
  const prefix3 = code.slice(0, 3).toUpperCase();
  
  const patterns: CarrierPattern[] = [];
  
  if (CARRIER_PREFIX_INDEX.has(prefix3)) {
    patterns.push(...CARRIER_PREFIX_INDEX.get(prefix3)!);
  }
  if (CARRIER_PREFIX_INDEX.has(prefix2)) {
    patterns.push(...CARRIER_PREFIX_INDEX.get(prefix2)!);
  }
  
  return patterns;
}

/**
 * Obtém todas as transportadoras por país
 */
export function getCarriersByCountry(country: string): CarrierPattern[] {
  return CARRIER_PATTERNS.filter(p => p.country === country);
}

/**
 * Obtém transportadora por ID
 */
export function getCarrierById(id: string): CarrierPattern | undefined {
  return CARRIER_PATTERNS.find(p => p.id === id);
}
