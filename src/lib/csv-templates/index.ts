/**
 * Sistema de Templates CSV para E-commerce
 * Export principal
 */

// Tipos
export type {
  EcommercePlatform,
  OrderStatus,
  ShippingStatus,
  Address,
  OrderItem,
  NormalizedOrder,
  ColumnMapping,
  DetectionPattern,
  DataTransformer,
  EcommerceTemplate,
  DetectionResult,
  ValidationError,
  ValidationResult,
  ProcessingResult,
  ImportConfig,
} from './types';

// Detector
export {
  detectPlatform,
  validateHeaders,
  suggestMappings,
} from './detector';

// Normalizer
export {
  normalizeRow,
  groupOrders,
  processCSV,
  cleanText,
  normalizeName,
  extractStats,
} from './normalizer';

// Validator
export {
  validateOrder,
  validateOrders,
} from './validator';

// Templates
export { nuvemshopTemplate } from './platforms/nuvemshop';

// Processador principal
export { processImport } from './processor';
