import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ACPClient } from '../client';
import { ACPConfig } from '../types';

// Mock fetch
global.fetch = vi.fn();

describe('ACPClient', () => {
  let client: ACPClient;
  let config: ACPConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      baseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      merchantId: 'merchant-123',
    };
    client = new ACPClient(config);
  });

  describe('constructor', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
    });

    it('should set default timeout', () => {
      const clientWithoutTimeout = new ACPClient({
        baseUrl: 'https://api.example.com',
      });
      expect(clientWithoutTimeout).toBeDefined();
    });

    it('should use custom timeout', () => {
      const clientWithTimeout = new ACPClient({
        baseUrl: 'https://api.example.com',
        timeout: 10000,
      });
      expect(clientWithTimeout).toBeDefined();
    });
  });

  describe('searchProducts', () => {
    it('should search products successfully', async () => {
      const mockResponse = {
        results: [
          {
            id: 'prod-1',
            name: 'Test Product',
            price: 99.99,
            currency: 'USD',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchProducts({
        query: 'test product',
      });

      expect(result.data).toEqual(mockResponse);
      expect(result.error).toBeUndefined();
    });

    it('should handle search errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid query' }),
      });

      const result = await client.searchProducts({
        query: '',
      });

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('HTTP_400');
    });

    it('should include authorization headers', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.searchProducts({ query: 'test' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBe('Bearer test-api-key');
    });

    it('should include merchant ID header', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.searchProducts({ query: 'test' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['X-Merchant-Id']).toBe('merchant-123');
    });
  });

  describe('getProduct', () => {
    it('should get product by ID', async () => {
      const mockProduct = {
        id: 'prod-1',
        name: 'Test Product',
        price: 99.99,
        currency: 'USD',
        description: 'A test product',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockProduct,
      });

      const result = await client.getProduct('prod-1');

      expect(result.data).toEqual(mockProduct);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/products/prod-1',
        expect.any(Object),
      );
    });

    it('should handle not found errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Product not found' }),
      });

      const result = await client.getProduct('non-existent');

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('HTTP_404');
    });
  });

  describe('createCart', () => {
    it('should create a new cart', async () => {
      const mockCart = {
        id: 'cart-1',
        items: [],
        total: 0,
        currency: 'USD',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCart,
      });

      const result = await client.createCart();

      expect(result.data).toEqual(mockCart);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/carts',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('addToCart', () => {
    it('should add item to cart', async () => {
      const mockCart = {
        id: 'cart-1',
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            price: 99.99,
          },
        ],
        total: 199.98,
        currency: 'USD',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCart,
      });

      const result = await client.addToCart('cart-1', {
        productId: 'prod-1',
        quantity: 2,
      });

      expect(result.data).toEqual(mockCart);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/carts/cart-1/items',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('removeFromCart', () => {
    it('should remove item from cart', async () => {
      const mockCart = {
        id: 'cart-1',
        items: [],
        total: 0,
        currency: 'USD',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCart,
      });

      const result = await client.removeFromCart('cart-1', 'item-1');

      expect(result.data).toEqual(mockCart);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/carts/cart-1/items/item-1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('getCart', () => {
    it('should get cart by ID', async () => {
      const mockCart = {
        id: 'cart-1',
        items: [],
        total: 0,
        currency: 'USD',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCart,
      });

      const result = await client.getCart('cart-1');

      expect(result.data).toEqual(mockCart);
    });
  });

  describe('createCheckout', () => {
    it('should create checkout session', async () => {
      const mockSession = {
        id: 'session-1',
        cartId: 'cart-1',
        status: 'pending',
        expiresAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      });

      const result = await client.createCheckout('cart-1');

      expect(result.data).toEqual(mockSession);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/checkout/sessions',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await client.searchProducts({ query: 'test' });

      expect(result.data).toBeNull();
      expect(result.error?.code).toBe('REQUEST_FAILED');
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve({ ok: true, json: async () => ({}) }),
              100000,
            );
          }),
      );

      const shortTimeoutClient = new ACPClient({
        baseUrl: 'https://api.example.com',
        timeout: 100,
      });

      const result = await shortTimeoutClient.searchProducts({ query: 'test' });

      expect(result.error).toBeDefined();
    });
  });

  describe('custom headers', () => {
    it('should include custom headers', async () => {
      const clientWithHeaders = new ACPClient({
        baseUrl: 'https://api.example.com',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await clientWithHeaders.searchProducts({ query: 'test' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['X-Custom-Header']).toBe('custom-value');
    });

    it('should work without API key', async () => {
      const clientWithoutKey = new ACPClient({
        baseUrl: 'https://api.example.com',
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await clientWithoutKey.searchProducts({ query: 'test' });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Authorization']).toBeUndefined();
    });
  });
});
