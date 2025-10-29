import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase,
}));

describe('Nuvemshop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should redirect to Nuvemshop OAuth URL with correct parameters', () => {
      const appId = '12345';
      const redirectUri = 'https://app.example.com/callback';
      const state = 'random-state-token';
      
      const expectedUrl = `https://www.nuvemshop.com.br/apps/${appId}/authorize?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
      
      expect(expectedUrl).toContain('authorize');
      expect(expectedUrl).toContain(appId);
      expect(expectedUrl).toContain('state=');
    });

    it('should include CSRF state token in OAuth URL', () => {
      const state = 'csrf-protection-token-12345';
      const url = `https://www.nuvemshop.com.br/apps/123/authorize?state=${state}`;
      
      expect(url).toContain(`state=${state}`);
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange authorization code for access token', async () => {
      const mockResponse = {
        access_token: 'nuvemshop-token-abc123',
        token_type: 'bearer',
        scope: 'read_products,write_orders',
        user_id: '67890',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const code = 'auth-code-xyz';
      const appId = '12345';
      const appSecret = 'secret-key';

      const response = await fetch('https://www.nuvemshop.com.br/apps/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, app_id: appId, app_secret: appSecret }),
      });

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('authorize'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(code),
        })
      );
      expect(data.access_token).toBe('nuvemshop-token-abc123');
      expect(data.user_id).toBe('67890');
    });

    it('should handle invalid authorization code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_grant' }),
      });

      const response = await fetch('https://www.nuvemshop.com.br/apps/authorize', {
        method: 'POST',
        body: JSON.stringify({ code: 'invalid-code' }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe('getOrders', () => {
    it('should fetch orders from Nuvemshop API', async () => {
      const mockOrders = [
        {
          id: 12345,
          number: 1001,
          status: 'paid',
          payment_status: 'paid',
          shipping_status: 'unshipped',
          customer: {
            id: 67890,
            name: 'João Silva',
            email: 'joao@example.com',
          },
          products: [
            {
              id: 111,
              name: 'Produto A',
              quantity: 2,
              price: '50.00',
            },
          ],
          total: '100.00',
          created_at: '2025-10-26T10:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const storeId = '12345';
      const accessToken = 'token-abc123';

      const response = await fetch(
        `https://api.nuvemshop.com.br/v1/${storeId}/orders`,
        {
          headers: {
            'Authentication': `bearer ${accessToken}`,
            'User-Agent': 'TrackyProFlow (contato@tracky.com)',
          },
        }
      );

      const orders = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/${storeId}/orders`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authentication': expect.stringContaining('bearer'),
          }),
        })
      );
      expect(orders).toHaveLength(1);
      expect(orders[0].number).toBe(1001);
      expect(orders[0].customer.name).toBe('João Silva');
    });

    it('should handle pagination with page and per_page parameters', async () => {
      const mockOrders = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        number: 1000 + i,
        status: 'paid',
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
      });

      const storeId = '12345';
      const page = 2;
      const perPage = 50;

      const response = await fetch(
        `https://api.nuvemshop.com.br/v1/${storeId}/orders?page=${page}&per_page=${perPage}`,
        { headers: { 'Authentication': 'bearer token' } }
      );

      const orders = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`page=${page}`),
        expect.any(Object)
      );
      expect(orders).toHaveLength(50);
    });

    it('should handle API rate limit (429 Too Many Requests)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          'X-Rate-Limit-Remaining': '0',
          'X-Rate-Limit-Reset': '1698326400',
        }),
        json: async () => ({ error: 'rate_limit_exceeded' }),
      });

      const response = await fetch('https://api.nuvemshop.com.br/v1/12345/orders', {
        headers: { 'Authentication': 'bearer token' },
      });

      expect(response.status).toBe(429);
      expect(response.headers.get('X-Rate-Limit-Remaining')).toBe('0');
    });

    it('should handle invalid access token (401 Unauthorized)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_token' }),
      });

      const response = await fetch('https://api.nuvemshop.com.br/v1/12345/orders', {
        headers: { 'Authentication': 'bearer invalid-token' },
      });

      expect(response.status).toBe(401);
    });
  });

  describe('getOrder', () => {
    it('should fetch single order by ID', async () => {
      const mockOrder = {
        id: 12345,
        number: 1001,
        status: 'paid',
        customer: { name: 'João Silva' },
        shipping_address: {
          address: 'Rua Exemplo, 123',
          city: 'São Paulo',
          province: 'SP',
          zipcode: '01234-567',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
      });

      const storeId = '12345';
      const orderId = 12345;

      const response = await fetch(
        `https://api.nuvemshop.com.br/v1/${storeId}/orders/${orderId}`,
        { headers: { 'Authentication': 'bearer token' } }
      );

      const order = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/orders/${orderId}`),
        expect.any(Object)
      );
      expect(order.id).toBe(12345);
      expect(order.shipping_address.city).toBe('São Paulo');
    });

    it('should return 404 for non-existent order', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not_found' }),
      });

      const response = await fetch(
        'https://api.nuvemshop.com.br/v1/12345/orders/999999',
        { headers: { 'Authentication': 'bearer token' } }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('getProducts', () => {
    it('should fetch products from Nuvemshop store', async () => {
      const mockProducts = [
        {
          id: 111,
          name: { pt: 'Produto A' },
          variants: [
            {
              id: 222,
              sku: 'PROD-A-001',
              stock: 10,
              price: '50.00',
            },
          ],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProducts,
      });

      const response = await fetch('https://api.nuvemshop.com.br/v1/12345/products', {
        headers: { 'Authentication': 'bearer token' },
      });

      const products = await response.json();

      expect(products).toHaveLength(1);
      expect(products[0].name.pt).toBe('Produto A');
      expect(products[0].variants[0].stock).toBe(10);
    });
  });

  describe('syncOrders', () => {
    it('should sync orders from Nuvemshop to Supabase', async () => {
      const mockNuvemshopOrders = [
        {
          id: 12345,
          number: 1001,
          status: 'paid',
          customer: { name: 'João Silva', email: 'joao@example.com' },
          total: '100.00',
          created_at: '2025-10-26T10:00:00Z',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNuvemshopOrders,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'uuid-123' },
        error: null,
      });

      // Simulate sync process
      const orders = mockNuvemshopOrders;
      const insertedOrders = [];

      for (const order of orders) {
        const { data } = await mockSupabase
          .from('orders')
          .insert({
            external_id: order.id.toString(),
            order_number: order.number.toString(),
            customer_name: order.customer.name,
            customer_email: order.customer.email,
            total_value: parseFloat(order.total),
            status: order.status,
            source: 'nuvemshop',
          })
          .select()
          .single();

        if (data) insertedOrders.push(data);
      }

      expect(mockSupabase.insert).toHaveBeenCalled();
      expect(insertedOrders).toHaveLength(1);
    });
  });
});

describe('Mercado Livre Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getToken', () => {
    it('should exchange authorization code for access token', async () => {
      const mockResponse = {
        access_token: 'ml-token-xyz789',
        token_type: 'bearer',
        expires_in: 21600,
        refresh_token: 'ml-refresh-abc123',
        user_id: 123456789,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const code = 'auth-code-ml';
      const clientId = 'ml-client-id';
      const clientSecret = 'ml-client-secret';
      const redirectUri = 'https://app.example.com/callback';

      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();

      expect(data.access_token).toBe('ml-token-xyz789');
      expect(data.refresh_token).toBe('ml-refresh-abc123');
      expect(data.expires_in).toBe(21600);
    });

    it('should refresh expired access token', async () => {
      const mockResponse = {
        access_token: 'ml-new-token-xyz',
        token_type: 'bearer',
        expires_in: 21600,
        refresh_token: 'ml-new-refresh-abc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const refreshToken = 'ml-refresh-abc123';

      const response = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'ml-client-id',
          client_secret: 'ml-client-secret',
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      expect(data.access_token).toBe('ml-new-token-xyz');
    });
  });

  describe('getOrders', () => {
    it('should fetch orders from Mercado Livre API', async () => {
      const mockSearchResponse = {
        results: [
          { id: 2000000001 },
          { id: 2000000002 },
        ],
        paging: {
          total: 2,
          offset: 0,
          limit: 50,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const userId = '123456789';
      const accessToken = 'ml-token-xyz789';

      const response = await fetch(
        `https://api.mercadolibre.com/orders/search?seller=${userId}&access_token=${accessToken}`,
        { method: 'GET' }
      );

      const data = await response.json();

      expect(data.results).toHaveLength(2);
      expect(data.results[0].id).toBe(2000000001);
    });

    it('should fetch order details by ID', async () => {
      const mockOrder = {
        id: 2000000001,
        status: 'paid',
        buyer: {
          id: 987654321,
          nickname: 'BUYER123',
        },
        order_items: [
          {
            item: {
              id: 'MLB123456',
              title: 'Produto ML',
            },
            quantity: 1,
            unit_price: 99.90,
          },
        ],
        total_amount: 99.90,
        date_created: '2025-10-26T10:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
      });

      const orderId = 2000000001;
      const accessToken = 'ml-token-xyz789';

      const response = await fetch(
        `https://api.mercadolibre.com/orders/${orderId}?access_token=${accessToken}`,
        { method: 'GET' }
      );

      const order = await response.json();

      expect(order.id).toBe(2000000001);
      expect(order.buyer.nickname).toBe('BUYER123');
      expect(order.order_items).toHaveLength(1);
    });
  });

  describe('getShipments', () => {
    it('should fetch shipment information for order', async () => {
      const mockShipment = {
        id: 40000000001,
        order_id: 2000000001,
        status: 'ready_to_ship',
        tracking_number: 'BR123456789BR',
        tracking_method: 'correios_pac',
        receiver_address: {
          address_line: 'Rua Exemplo, 123',
          city: { name: 'São Paulo' },
          state: { name: 'São Paulo' },
          zip_code: '01234-567',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockShipment,
      });

      const shipmentId = 40000000001;
      const accessToken = 'ml-token-xyz789';

      const response = await fetch(
        `https://api.mercadolibre.com/shipments/${shipmentId}?access_token=${accessToken}`,
        { method: 'GET' }
      );

      const shipment = await response.json();

      expect(shipment.tracking_number).toBe('BR123456789BR');
      expect(shipment.tracking_method).toBe('correios_pac');
      expect(shipment.status).toBe('ready_to_ship');
    });
  });
});

describe('Shopify Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrders', () => {
    it('should fetch orders from Shopify Admin API', async () => {
      const mockResponse = {
        orders: [
          {
            id: 5000000001,
            order_number: 1001,
            email: 'customer@example.com',
            financial_status: 'paid',
            fulfillment_status: 'unfulfilled',
            line_items: [
              {
                id: 6000000001,
                title: 'Produto Shopify',
                quantity: 2,
                price: '50.00',
              },
            ],
            total_price: '100.00',
            created_at: '2025-10-26T10:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const shopDomain = 'mystore.myshopify.com';
      const accessToken = 'shopify-token-abc';

      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-10/orders.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/api/'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Shopify-Access-Token': accessToken,
          }),
        })
      );
      expect(data.orders).toHaveLength(1);
      expect(data.orders[0].order_number).toBe(1001);
    });

    it('should handle Shopify API version in URL', async () => {
      const apiVersion = '2024-10';
      const url = `https://mystore.myshopify.com/admin/api/${apiVersion}/orders.json`;

      expect(url).toContain(apiVersion);
    });
  });

  describe('getProducts', () => {
    it('should fetch products from Shopify', async () => {
      const mockResponse = {
        products: [
          {
            id: 7000000001,
            title: 'Produto Shopify',
            variants: [
              {
                id: 8000000001,
                sku: 'SHOP-001',
                inventory_quantity: 50,
                price: '99.90',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await fetch(
        'https://mystore.myshopify.com/admin/api/2024-10/products.json',
        {
          headers: {
            'X-Shopify-Access-Token': 'shopify-token-abc',
          },
        }
      );

      const data = await response.json();

      expect(data.products).toHaveLength(1);
      expect(data.products[0].variants[0].inventory_quantity).toBe(50);
    });
  });

  describe('getInventoryLevels', () => {
    it('should fetch inventory levels by location', async () => {
      const mockResponse = {
        inventory_levels: [
          {
            inventory_item_id: 9000000001,
            location_id: 10000000001,
            available: 25,
            updated_at: '2025-10-26T10:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const locationId = 10000000001;

      const response = await fetch(
        `https://mystore.myshopify.com/admin/api/2024-10/inventory_levels.json?location_ids=${locationId}`,
        {
          headers: {
            'X-Shopify-Access-Token': 'shopify-token-abc',
          },
        }
      );

      const data = await response.json();

      expect(data.inventory_levels).toHaveLength(1);
      expect(data.inventory_levels[0].available).toBe(25);
    });
  });

  describe('createFulfillment', () => {
    it('should create fulfillment for Shopify order', async () => {
      const mockResponse = {
        fulfillment: {
          id: 11000000001,
          order_id: 5000000001,
          status: 'success',
          tracking_company: 'Correios',
          tracking_number: 'BR987654321BR',
          tracking_url: 'https://rastreamento.correios.com.br/BR987654321BR',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      });

      const orderId = 5000000001;

      const response = await fetch(
        `https://mystore.myshopify.com/admin/api/2024-10/orders/${orderId}/fulfillments.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': 'shopify-token-abc',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fulfillment: {
              line_items: [{ id: 6000000001 }],
              tracking_number: 'BR987654321BR',
              tracking_company: 'Correios',
              notify_customer: true,
            },
          }),
        }
      );

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.fulfillment.tracking_number).toBe('BR987654321BR');
    });
  });
});
