/**
 * ACP (Agentic Commerce Protocol) type definitions
 * Based on: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
 */

/**
 * Product information
 */
export interface ACPProduct {
  id: string;
  name: string;
  description?: string;
  price: {
    amount: number;
    currency: string;
  };
  images?: string[];
  variants?: ACPProductVariant[];
  metadata?: Record<string, any>;
}

/**
 * Product variant
 */
export interface ACPProductVariant {
  id: string;
  name: string;
  price: {
    amount: number;
    currency: string;
  };
  attributes?: Record<string, string>;
  inventory?: {
    available: boolean;
    quantity?: number;
  };
}

/**
 * Shopping cart item
 */
export interface ACPCartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: {
    amount: number;
    currency: string;
  };
}

/**
 * Shopping cart
 */
export interface ACPCart {
  id: string;
  items: ACPCartItem[];
  totalAmount: {
    amount: number;
    currency: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Checkout session
 */
export interface ACPCheckoutSession {
  id: string;
  cartId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  customer?: ACPCustomer;
  shippingAddress?: ACPAddress;
  billingAddress?: ACPAddress;
  paymentMethod?: ACPPaymentMethod;
  totalAmount: {
    amount: number;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Customer information
 */
export interface ACPCustomer {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

/**
 * Address information
 */
export interface ACPAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

/**
 * Payment method
 */
export interface ACPPaymentMethod {
  type: 'card' | 'delegated' | 'wallet' | 'bank_transfer';
  token?: string;
  delegatedProvider?: string;
  metadata?: Record<string, any>;
}

/**
 * Payment intent
 */
export interface ACPPaymentIntent {
  id: string;
  amount: {
    amount: number;
    currency: string;
  };
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  paymentMethod?: ACPPaymentMethod;
  metadata?: Record<string, any>;
}

/**
 * Order information
 */
export interface ACPOrder {
  id: string;
  checkoutSessionId: string;
  status:
    | 'pending'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';
  items: ACPCartItem[];
  customer: ACPCustomer;
  shippingAddress: ACPAddress;
  billingAddress?: ACPAddress;
  totalAmount: {
    amount: number;
    currency: string;
  };
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  trackingNumber?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * Product search query
 */
export interface ACPProductSearchQuery {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'price' | 'name' | 'popularity' | 'newest';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product search result
 */
export interface ACPProductSearchResult {
  products: ACPProduct[];
  total: number;
  hasMore: boolean;
}

/**
 * ACP API Configuration
 */
export interface ACPConfig {
  baseUrl: string;
  apiKey?: string;
  merchantId?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Delegated payment configuration
 */
export interface ACPDelegatedPaymentConfig {
  provider: string; // e.g., 'stripe', 'paypal', etc.
  merchantAccountId: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook event
 */
export interface ACPWebhookEvent {
  id: string;
  type:
    | 'checkout.completed'
    | 'payment.succeeded'
    | 'payment.failed'
    | 'order.confirmed'
    | 'order.shipped'
    | 'order.delivered'
    | 'order.cancelled';
  data: ACPCheckoutSession | ACPPaymentIntent | ACPOrder;
  createdAt: string;
}

/**
 * API Response wrapper
 */
export interface ACPResponse<T> {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Pagination metadata
 */
export interface ACPPaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
