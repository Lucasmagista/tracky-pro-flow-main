/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartenviosService } from '../smartenvios';

// Mock fetch global
global.fetch = vi.fn();

describe('SmartenviosService', () => {
  const mockApiKey = 'test-api-key-123';
  const mockEnvironment = 'sandbox';
  const mockBaseUrl = 'https://api-sandbox.smartenvios.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createShipment', () => {
    it('deve criar um envio com sucesso', async () => {
      const mockShipmentData = {
        origin: {
          name: 'Loja Teste',
          phone: '+5511999999999',
          address: 'Rua Teste, 123',
          city: 'São Paulo',
          state: 'SP',
          zip_code: '01234-567',
        },
        destination: {
          name: 'Cliente Teste',
          phone: '+5511888888888',
          address: 'Av. Cliente, 456',
          city: 'Rio de Janeiro',
          state: 'RJ',
          zip_code: '20000-000',
        },
        package: {
          weight: 1.5,
          width: 20,
          height: 15,
          length: 30,
        },
        carrier: 'correios',
      };

      const mockResponse = {
        success: true,
        data: {
          shipment_id: 'SHIP123456',
          tracking_code: 'BR123456789BR',
          label_url: 'https://example.com/label.pdf',
          carrier: 'correios',
          estimated_delivery: '2025-11-05',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.createShipment(
        mockApiKey,
        mockEnvironment,
        mockShipmentData
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/shipments`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockShipmentData),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });

    it('deve lançar erro quando API retorna erro', async () => {
      const mockError = {
        error: 'Invalid API Key',
        message: 'A chave de API fornecida é inválida',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => mockError,
      });

      await expect(
        SmartenviosService.createShipment(mockApiKey, mockEnvironment, {} as any)
      ).rejects.toThrow('A chave de API fornecida é inválida');
    });

    it('deve lançar erro quando network falha', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        SmartenviosService.createShipment(mockApiKey, mockEnvironment, {} as any)
      ).rejects.toThrow('Network error');
    });
  });

  describe('trackShipment', () => {
    it('deve rastrear um envio com sucesso', async () => {
      const trackingCode = 'BR123456789BR';
      const mockResponse = {
        success: true,
        data: {
          tracking_code: trackingCode,
          status: 'in_transit',
          carrier: 'correios',
          events: [
            {
              status: 'posted',
              description: 'Objeto postado',
              location: 'São Paulo - SP',
              date: '2025-10-26T10:00:00Z',
            },
            {
              status: 'in_transit',
              description: 'Objeto em trânsito',
              location: 'Curitiba - PR',
              date: '2025-10-27T14:30:00Z',
            },
          ],
          estimated_delivery: '2025-11-05',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.trackShipment(
        mockApiKey,
        mockEnvironment,
        trackingCode
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/tracking/${trackingCode}`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
          },
        })
      );

      expect(result).toEqual(mockResponse.data);
      expect(result.events).toHaveLength(2);
    });

    it('deve retornar null quando tracking não existe', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      const result = await SmartenviosService.trackShipment(
        mockApiKey,
        mockEnvironment,
        'INVALID123'
      );

      expect(result).toBeNull();
    });
  });

  describe('calculateShipping', () => {
    it('deve calcular frete com sucesso', async () => {
      const mockRequest = {
        origin_zip: '01234-567',
        destination_zip: '20000-000',
        weight: 1.5,
        width: 20,
        height: 15,
        length: 30,
      };

      const mockResponse = {
        success: true,
        data: {
          options: [
            {
              carrier: 'correios',
              service: 'PAC',
              price: 25.50,
              delivery_days: 7,
            },
            {
              carrier: 'correios',
              service: 'SEDEX',
              price: 45.80,
              delivery_days: 3,
            },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.calculateShipping(
        mockApiKey,
        mockEnvironment,
        mockRequest
      );

      expect(result).toEqual(mockResponse.data.options);
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(25.50);
    });
  });

  describe('getCarriers', () => {
    it('deve listar transportadoras disponíveis', async () => {
      const mockResponse = {
        success: true,
        data: {
          carriers: [
            { code: 'correios', name: 'Correios', active: true },
            { code: 'jadlog', name: 'Jadlog', active: true },
            { code: 'loggi', name: 'Loggi', active: false },
          ],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.getCarriers(
        mockApiKey,
        mockEnvironment
      );

      expect(result).toEqual(mockResponse.data.carriers);
      expect(result.filter(c => c.active)).toHaveLength(2);
    });
  });

  describe('cancelShipment', () => {
    it('deve cancelar envio com sucesso', async () => {
      const shipmentId = 'SHIP123456';
      const mockResponse = {
        success: true,
        data: {
          shipment_id: shipmentId,
          status: 'cancelled',
          cancelled_at: '2025-10-26T15:00:00Z',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.cancelShipment(
        mockApiKey,
        mockEnvironment,
        shipmentId
      );

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/v1/shipments/${shipmentId}/cancel`,
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(result.status).toBe('cancelled');
    });

    it('deve lançar erro ao tentar cancelar envio já entregue', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Cannot cancel delivered shipment',
        }),
      });

      await expect(
        SmartenviosService.cancelShipment(mockApiKey, mockEnvironment, 'SHIP123')
      ).rejects.toThrow();
    });
  });

  describe('getShipmentLabel', () => {
    it('deve obter etiqueta do envio', async () => {
      const shipmentId = 'SHIP123456';
      const mockResponse = {
        success: true,
        data: {
          label_url: 'https://example.com/labels/SHIP123456.pdf',
          format: 'pdf',
          expires_at: '2025-10-27T00:00:00Z',
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.getShipmentLabel(
        mockApiKey,
        mockEnvironment,
        shipmentId
      );

      expect(result.label_url).toContain('.pdf');
      expect(result.format).toBe('pdf');
    });
  });

  describe('validateAddress', () => {
    it('deve validar endereço válido', async () => {
      const mockAddress = {
        zip_code: '01310-100',
        street: 'Avenida Paulista',
        number: '1578',
        city: 'São Paulo',
        state: 'SP',
      };

      const mockResponse = {
        success: true,
        data: {
          valid: true,
          normalized: mockAddress,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.validateAddress(
        mockApiKey,
        mockEnvironment,
        mockAddress
      );

      expect(result.valid).toBe(true);
      expect(result.normalized).toEqual(mockAddress);
    });

    it('deve retornar false para endereço inválido', async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: false,
          errors: ['CEP não encontrado'],
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await SmartenviosService.validateAddress(
        mockApiKey,
        mockEnvironment,
        { zip_code: '99999-999' } as any
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CEP não encontrado');
    });
  });
});
