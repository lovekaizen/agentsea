import {
  ACPConfig,
  ACPProduct,
  ACPProductSearchQuery,
  ACPProductSearchResult,
  ACPCart,
  ACPCartItem,
  ACPCheckoutSession,
  ACPPaymentIntent,
  ACPOrder,
  ACPCustomer,
  ACPAddress,
  ACPPaymentMethod,
  ACPDelegatedPaymentConfig,
  ACPResponse,
} from './types';

/**
 * ACP API Client
 * Handles communication with ACP-compliant commerce APIs
 */
export class ACPClient {
  private config: ACPConfig;

  constructor(config: ACPConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Make HTTP request to ACP API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any,
  ): Promise<ACPResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    if (this.config.merchantId) {
      headers['X-Merchant-Id'] = this.config.merchantId;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        return {
          data: null as T,
          error: {
            code: `HTTP_${response.status}`,
            message: (data.message as string) || response.statusText,
            details: data,
          },
        };
      }

      return { data: data as T };
    } catch (error) {
      return {
        data: null as T,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  // ==================== Product Discovery ====================

  /**
   * Search for products
   */
  async searchProducts(
    query: ACPProductSearchQuery,
  ): Promise<ACPResponse<ACPProductSearchResult>> {
    const params = new URLSearchParams();

    if (query.query) params.append('q', query.query);
    if (query.category) params.append('category', query.category);
    if (query.minPrice !== undefined)
      params.append('min_price', query.minPrice.toString());
    if (query.maxPrice !== undefined)
      params.append('max_price', query.maxPrice.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.offset) params.append('offset', query.offset.toString());
    if (query.sortBy) params.append('sort_by', query.sortBy);
    if (query.sortOrder) params.append('sort_order', query.sortOrder);

    return this.request<ACPProductSearchResult>(
      'GET',
      `/products/search?${params.toString()}`,
    );
  }

  /**
   * Get product by ID
   */
  async getProduct(productId: string): Promise<ACPResponse<ACPProduct>> {
    return this.request<ACPProduct>('GET', `/products/${productId}`);
  }

  /**
   * Get multiple products by IDs
   */
  async getProducts(productIds: string[]): Promise<ACPResponse<ACPProduct[]>> {
    return this.request<ACPProduct[]>('POST', '/products/batch', {
      product_ids: productIds,
    });
  }

  // ==================== Cart Management ====================

  /**
   * Create a new cart
   */
  async createCart(): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>('POST', '/carts');
  }

  /**
   * Get cart by ID
   */
  async getCart(cartId: string): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>('GET', `/carts/${cartId}`);
  }

  /**
   * Add item to cart
   */
  async addToCart(
    cartId: string,
    item: ACPCartItem,
  ): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>('POST', `/carts/${cartId}/items`, item);
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(
    cartId: string,
    productId: string,
    quantity: number,
  ): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>(
      'PATCH',
      `/carts/${cartId}/items/${productId}`,
      { quantity },
    );
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(
    cartId: string,
    productId: string,
  ): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>(
      'DELETE',
      `/carts/${cartId}/items/${productId}`,
    );
  }

  /**
   * Clear cart
   */
  async clearCart(cartId: string): Promise<ACPResponse<ACPCart>> {
    return this.request<ACPCart>('DELETE', `/carts/${cartId}/items`);
  }

  // ==================== Checkout ====================

  /**
   * Create checkout session
   */
  async createCheckoutSession(
    cartId: string,
    customer?: ACPCustomer,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>('POST', '/checkout/sessions', {
      cart_id: cartId,
      customer,
    });
  }

  /**
   * Get checkout session
   */
  async getCheckoutSession(
    sessionId: string,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>(
      'GET',
      `/checkout/sessions/${sessionId}`,
    );
  }

  /**
   * Update checkout session with shipping address
   */
  async updateShippingAddress(
    sessionId: string,
    address: ACPAddress,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>(
      'PATCH',
      `/checkout/sessions/${sessionId}`,
      { shipping_address: address },
    );
  }

  /**
   * Update checkout session with billing address
   */
  async updateBillingAddress(
    sessionId: string,
    address: ACPAddress,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>(
      'PATCH',
      `/checkout/sessions/${sessionId}`,
      { billing_address: address },
    );
  }

  /**
   * Update checkout session with payment method
   */
  async updatePaymentMethod(
    sessionId: string,
    paymentMethod: ACPPaymentMethod,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>(
      'PATCH',
      `/checkout/sessions/${sessionId}`,
      { payment_method: paymentMethod },
    );
  }

  /**
   * Complete checkout
   */
  async completeCheckout(
    sessionId: string,
  ): Promise<ACPResponse<ACPCheckoutSession>> {
    return this.request<ACPCheckoutSession>(
      'POST',
      `/checkout/sessions/${sessionId}/complete`,
    );
  }

  // ==================== Delegated Payment ====================

  /**
   * Create delegated payment intent
   */
  async createDelegatedPayment(
    sessionId: string,
    config: ACPDelegatedPaymentConfig,
  ): Promise<ACPResponse<ACPPaymentIntent>> {
    return this.request<ACPPaymentIntent>(
      'POST',
      `/checkout/sessions/${sessionId}/delegated-payment`,
      config,
    );
  }

  /**
   * Get payment intent
   */
  async getPaymentIntent(
    intentId: string,
  ): Promise<ACPResponse<ACPPaymentIntent>> {
    return this.request<ACPPaymentIntent>('GET', `/payments/${intentId}`);
  }

  /**
   * Confirm payment intent
   */
  async confirmPayment(
    intentId: string,
    paymentToken?: string,
  ): Promise<ACPResponse<ACPPaymentIntent>> {
    return this.request<ACPPaymentIntent>(
      'POST',
      `/payments/${intentId}/confirm`,
      { payment_token: paymentToken },
    );
  }

  // ==================== Order Management ====================

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<ACPResponse<ACPOrder>> {
    return this.request<ACPOrder>('GET', `/orders/${orderId}`);
  }

  /**
   * Get orders for a customer
   */
  async getCustomerOrders(
    customerId: string,
    limit?: number,
    offset?: number,
  ): Promise<ACPResponse<ACPOrder[]>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    return this.request<ACPOrder[]>(
      'GET',
      `/customers/${customerId}/orders?${params.toString()}`,
    );
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<ACPResponse<ACPOrder>> {
    return this.request<ACPOrder>('POST', `/orders/${orderId}/cancel`);
  }

  /**
   * Get order tracking information
   */
  async getOrderTracking(
    orderId: string,
  ): Promise<
    ACPResponse<{ trackingNumber: string; carrier: string; status: string }>
  > {
    return this.request('GET', `/orders/${orderId}/tracking`);
  }
}
