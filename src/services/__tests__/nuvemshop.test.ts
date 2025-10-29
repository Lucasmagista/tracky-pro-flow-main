/**
 * Testes Unitários - Nuvemshop Service
 * Testa todas as funcionalidades do serviço de integração com Nuvemshop
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NuvemshopService } from '@/services/nuvemshop'
import type { NuvemshopConfig, NuvemshopOrder } from '@/types/nuvemshop'

// Mock global fetch
global.fetch = vi.fn()

describe('NuvemshopService', () => {
  const mockConfig: NuvemshopConfig = {
    app_id: 'test_app_id',
    app_secret: 'test_app_secret',
    access_token: 'test_access_token',
    store_id: 'test_store_id',
    store_url: 'https://test-store.com',
    user_id: 'test_user_id',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAuthorizationUrl', () => {
    it('should generate correct OAuth URL', () => {
      const appId = 'test_app_id'
      const redirectUri = 'https://app.com/callback'
      
      const url = NuvemshopService.getAuthorizationUrl(appId, redirectUri)
      
      expect(url).toContain('https://www.nuvemshop.com.br/apps/authorize/token')
      expect(url).toContain(`client_id=${appId}`)
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`)
    })
  })

  describe('fetchOrders', () => {
    it('should fetch orders successfully', async () => {
      const mockOrders: Partial<NuvemshopOrder>[] = [
        {
          id: 1,
          number: 100,
          shipping_status: 'unpacked',
          payment_status: 'paid',
          status: 'open',
          total: '150.00',
          currency: 'BRL',
          customer: {
            id: 1,
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '+5511999999999',
            identification: '12345678900',
            note: ''
          },
          shipping_address: {
            address: 'Test Street',
            number: '123',
            floor: '',
            locality: '',
            city: 'São Paulo',
            province: 'SP',
            zipcode: '01000-000',
            country: 'BR',
          },
          products: [],
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      })

      const orders = await NuvemshopService.fetchOrders(mockConfig, { status: 'open' })

      expect(orders).toEqual(mockOrders)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.nuvemshop.com.br/v1/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockConfig.access_token}`,
          }),
        })
      )
    })

    it('should throw error on failed request', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(
        NuvemshopService.fetchOrders(mockConfig, {})
      ).rejects.toThrow('Erro ao buscar pedidos da Nuvemshop')
    })
  })

  describe('fetchOrder', () => {
    it('should fetch single order by id', async () => {
      const mockOrder: Partial<NuvemshopOrder> = {
        id: 1,
        number: 100,
        status: 'open',
        payment_status: 'paid',
        shipping_status: 'shipped',
        total: '150.00',
        currency: 'BRL',
        customer: {
          id: 1,
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '+5511999999999',
          identification: '12345678900',
          note: ''
        },
        shipping_address: {
          address: 'Test Street',
          number: '123',
          floor: '',
          locality: '',
          city: 'São Paulo',
          province: 'SP',
          zipcode: '01000-000',
          country: 'BR',
        },
        products: [],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
      })

      const order = await NuvemshopService.fetchOrder(mockConfig, 1)

      expect(order).toEqual(mockOrder)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/1'),
        expect.any(Object)
      )
    })
  })

  describe('updateShippingStatus', () => {
    it('should update shipping status successfully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await expect(
        NuvemshopService.updateShippingStatus(mockConfig, 1, 'shipped', 'BR123456789')
      ).resolves.not.toThrow()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/1'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('shipped'),
        })
      )
    })
  })

  describe('registerWebhooks', () => {
    it('should register webhooks successfully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'webhook_1' }),
      })
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'webhook_2' }),
      })

      await expect(
        NuvemshopService.registerWebhooks(mockConfig, 'https://app.com/webhooks', ['order/created', 'order/updated'])
      ).resolves.not.toThrow()

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('convertToTrackyOrder', () => {
    it('should convert Nuvemshop order to Tracky format', () => {
      const nuvemshopOrder: Partial<NuvemshopOrder> = {
        id: 1,
        number: 100,
        status: 'open',
        payment_status: 'paid',
        shipping_status: 'shipped',
        shipping_tracking_number: 'BR123456789BR',
        total: '150.00',
        currency: 'BRL',
        customer: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5511999999999',
          identification: '12345678900',
          note: ''
        },
        shipping_address: {
          address: 'Test Street',
          number: '123',
          floor: '',
          locality: '',
          city: 'São Paulo',
          province: 'SP',
          zipcode: '01000-000',
          country: 'BR',
        },
        products: [],
      }

      const trackyOrder = NuvemshopService.convertToTrackyOrder(nuvemshopOrder as any, 'user_123')

      expect(trackyOrder.tracking_code).toBe('BR123456789')
      expect(trackyOrder.customer_name).toBe('John Doe')
      expect(trackyOrder.customer_email).toBe('john@example.com')
      expect(trackyOrder.customer_phone).toBe('+5511999999999')
      expect(trackyOrder.status).toBe('in_transit')
      expect(trackyOrder.carrier).toBe('correios')
    })

    it('should handle missing tracking code', () => {
      const nuvemshopOrder: Partial<NuvemshopOrder> = {
        id: 1,
        number: 100,
        status: 'open',
        payment_status: 'paid',
        shipping_status: 'unpacked',
        total: '150.00',
        currency: 'BRL',
        customer: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+5511999999999',
          identification: '12345678900',
          note: ''
        },
        shipping_address: {
          address: 'Test Street',
          number: '123',
          floor: '',
          locality: '',
          city: 'São Paulo',
          province: 'SP',
          zipcode: '01000-000',
          country: 'BR',
        },
        products: [],
      }

      const trackyOrder = NuvemshopService.convertToTrackyOrder(nuvemshopOrder as any, 'user_123')

      expect(trackyOrder.tracking_code).toBe('NUVEMSHOP-1')
      expect(trackyOrder.status).toBe('pending')
    })
  })

  // Remover testes de métodos privados que não existem como métodos públicos
  // Os métodos mapShippingStatus e detectCarrier são usados internamente
  // e são testados através dos testes de convertToTrackyOrder
})
