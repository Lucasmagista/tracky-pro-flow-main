import { CarrierDetectionService } from './carrierDetection';
import { getCarrierById, CARRIER_PATTERNS } from '@/data/carrierPatterns';

export interface TrackingValidationResult {
  isValid: boolean;
  carrier?: string;
  carrierName?: string;
  errors: string[];
  warnings: string[];
  confidence: number;
}

export class TrackingValidationService {
  static async validate(code: string, userId?: string): Promise<TrackingValidationResult> {
    const result: TrackingValidationResult = {
      isValid: false,
      errors: [],
      warnings: [],
      confidence: 0,
    };

    if (!code) {
      result.errors.push('Código inválido');
      return result;
    }

    const detection = await CarrierDetectionService.detectBest(code.trim().toUpperCase(), { userId });
    
    if (detection) {
      result.carrier = detection.carrier.id;
      result.carrierName = detection.carrier.name;
      result.confidence = detection.confidence;
      result.isValid = detection.confidence >= 50;
    }

    return result;
  }

  static getCarrierInfo(carrierId: string) {
    return getCarrierById(carrierId);
  }

  static getSupportedCarriers() {
    return CARRIER_PATTERNS;
  }
}