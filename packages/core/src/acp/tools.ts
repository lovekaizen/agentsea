import { z } from 'zod';
import { Tool } from '../types';
import { ACPClient } from './client';

/**
 * Create ACP tools for agent use
 */
export function createACPTools(client: ACPClient): Tool[] {
  return [
    createSearchProductsTool(client),
    createGetProductTool(client),
    createCreateCartTool(client),
    createAddToCartTool(client),
    createUpdateCartItemTool(client),
    createRemoveFromCartTool(client),
    createGetCartTool(client),
    createCheckoutTool(client),
    createUpdateShippingAddressTool(client),
    createUpdatePaymentMethodTool(client),
    createCompleteCheckoutTool(client),
    createGetOrderTool(client),
    createCancelOrderTool(client),
    createGetOrderTrackingTool(client),
  ];
}

/**
 * Search for products
 */
function createSearchProductsTool(client: ACPClient): Tool {
  return {
    name: 'acp_search_products',
    description:
      'Search for products in the commerce catalog. Supports filtering by query text, category, price range, and sorting.',
    parameters: z.object({
      query: z.string().optional().describe('Search query text'),
      category: z.string().optional().describe('Product category filter'),
      minPrice: z.number().optional().describe('Minimum price filter'),
      maxPrice: z.number().optional().describe('Maximum price filter'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Maximum number of results'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
      sortBy: z
        .enum(['price', 'name', 'popularity', 'newest'])
        .optional()
        .describe('Sort field'),
      sortOrder: z
        .enum(['asc', 'desc'])
        .optional()
        .default('asc')
        .describe('Sort order'),
    }),
    execute: async (params) => {
      const response = await client.searchProducts(params);

      if (response.error) {
        throw new Error(`Product search failed: ${response.error.message}`);
      }

      return {
        products: response.data.products,
        total: response.data.total,
        hasMore: response.data.hasMore,
      };
    },
  };
}

/**
 * Get product details
 */
function createGetProductTool(client: ACPClient): Tool {
  return {
    name: 'acp_get_product',
    description: 'Get detailed information about a specific product by its ID.',
    parameters: z.object({
      productId: z.string().describe('Product ID'),
    }),
    execute: async (params) => {
      const response = await client.getProduct(params.productId);

      if (response.error) {
        throw new Error(`Failed to get product: ${response.error.message}`);
      }

      return response.data;
    },
  };
}

/**
 * Create a new shopping cart
 */
function createCreateCartTool(client: ACPClient): Tool {
  return {
    name: 'acp_create_cart',
    description:
      'Create a new shopping cart for the customer. Returns the cart ID for subsequent operations.',
    parameters: z.object({}),
    execute: async () => {
      const response = await client.createCart();

      if (response.error) {
        throw new Error(`Failed to create cart: ${response.error.message}`);
      }

      return response.data;
    },
  };
}

/**
 * Add item to cart
 */
function createAddToCartTool(client: ACPClient): Tool {
  return {
    name: 'acp_add_to_cart',
    description: 'Add a product to the shopping cart with specified quantity.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      productId: z.string().describe('Product ID to add'),
      variantId: z.string().optional().describe('Product variant ID'),
      quantity: z.number().min(1).describe('Quantity to add'),
      price: z
        .object({
          amount: z.number().describe('Price amount'),
          currency: z.string().describe('Currency code (e.g., USD, EUR)'),
        })
        .describe('Product price'),
    }),
    execute: async (params) => {
      const response = await client.addToCart(params.cartId, {
        productId: params.productId,
        variantId: params.variantId,
        quantity: params.quantity,
        price: params.price,
      });

      if (response.error) {
        throw new Error(
          `Failed to add item to cart: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Update cart item quantity
 */
function createUpdateCartItemTool(client: ACPClient): Tool {
  return {
    name: 'acp_update_cart_item',
    description: 'Update the quantity of an item in the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      productId: z.string().describe('Product ID to update'),
      quantity: z.number().min(0).describe('New quantity (0 to remove)'),
    }),
    execute: async (params) => {
      const response = await client.updateCartItem(
        params.cartId,
        params.productId,
        params.quantity,
      );

      if (response.error) {
        throw new Error(
          `Failed to update cart item: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Remove item from cart
 */
function createRemoveFromCartTool(client: ACPClient): Tool {
  return {
    name: 'acp_remove_from_cart',
    description: 'Remove a product from the shopping cart.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      productId: z.string().describe('Product ID to remove'),
    }),
    execute: async (params) => {
      const response = await client.removeFromCart(
        params.cartId,
        params.productId,
      );

      if (response.error) {
        throw new Error(
          `Failed to remove item from cart: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Get cart details
 */
function createGetCartTool(client: ACPClient): Tool {
  return {
    name: 'acp_get_cart',
    description:
      'Get the current state of a shopping cart including all items and total amount.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
    }),
    execute: async (params) => {
      const response = await client.getCart(params.cartId);

      if (response.error) {
        throw new Error(`Failed to get cart: ${response.error.message}`);
      }

      return response.data;
    },
  };
}

/**
 * Create checkout session
 */
function createCheckoutTool(client: ACPClient): Tool {
  return {
    name: 'acp_create_checkout',
    description:
      'Create a checkout session from a shopping cart to begin the purchase process.',
    parameters: z.object({
      cartId: z.string().describe('Cart ID'),
      customer: z
        .object({
          email: z.string().email().describe('Customer email'),
          name: z.string().optional().describe('Customer name'),
          phone: z.string().optional().describe('Customer phone number'),
        })
        .optional()
        .describe('Customer information'),
    }),
    execute: async (params) => {
      const response = await client.createCheckoutSession(
        params.cartId,
        params.customer,
      );

      if (response.error) {
        throw new Error(
          `Failed to create checkout session: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Update shipping address
 */
function createUpdateShippingAddressTool(client: ACPClient): Tool {
  return {
    name: 'acp_update_shipping_address',
    description: 'Update the shipping address for a checkout session.',
    parameters: z.object({
      sessionId: z.string().describe('Checkout session ID'),
      address: z
        .object({
          line1: z.string().describe('Address line 1'),
          line2: z.string().optional().describe('Address line 2'),
          city: z.string().describe('City'),
          state: z.string().optional().describe('State/Province'),
          postalCode: z.string().describe('Postal/ZIP code'),
          country: z.string().describe('Country code (e.g., US, GB)'),
        })
        .describe('Shipping address'),
    }),
    execute: async (params) => {
      const response = await client.updateShippingAddress(
        params.sessionId,
        params.address,
      );

      if (response.error) {
        throw new Error(
          `Failed to update shipping address: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Update payment method
 */
function createUpdatePaymentMethodTool(client: ACPClient): Tool {
  return {
    name: 'acp_update_payment_method',
    description: 'Update the payment method for a checkout session.',
    parameters: z.object({
      sessionId: z.string().describe('Checkout session ID'),
      paymentMethod: z
        .object({
          type: z
            .enum(['card', 'delegated', 'wallet', 'bank_transfer'])
            .describe('Payment method type'),
          token: z.string().optional().describe('Payment token'),
          delegatedProvider: z
            .string()
            .optional()
            .describe('Delegated payment provider (e.g., stripe, paypal)'),
        })
        .describe('Payment method details'),
    }),
    execute: async (params) => {
      const response = await client.updatePaymentMethod(
        params.sessionId,
        params.paymentMethod,
      );

      if (response.error) {
        throw new Error(
          `Failed to update payment method: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Complete checkout
 */
function createCompleteCheckoutTool(client: ACPClient): Tool {
  return {
    name: 'acp_complete_checkout',
    description:
      'Complete the checkout process and create an order. This finalizes the purchase.',
    parameters: z.object({
      sessionId: z.string().describe('Checkout session ID'),
    }),
    execute: async (params) => {
      const response = await client.completeCheckout(params.sessionId);

      if (response.error) {
        throw new Error(
          `Failed to complete checkout: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}

/**
 * Get order details
 */
function createGetOrderTool(client: ACPClient): Tool {
  return {
    name: 'acp_get_order',
    description: 'Get detailed information about an order by its ID.',
    parameters: z.object({
      orderId: z.string().describe('Order ID'),
    }),
    execute: async (params) => {
      const response = await client.getOrder(params.orderId);

      if (response.error) {
        throw new Error(`Failed to get order: ${response.error.message}`);
      }

      return response.data;
    },
  };
}

/**
 * Cancel order
 */
function createCancelOrderTool(client: ACPClient): Tool {
  return {
    name: 'acp_cancel_order',
    description:
      'Cancel an order. Only orders that have not been shipped can be cancelled.',
    parameters: z.object({
      orderId: z.string().describe('Order ID'),
    }),
    execute: async (params) => {
      const response = await client.cancelOrder(params.orderId);

      if (response.error) {
        throw new Error(`Failed to cancel order: ${response.error.message}`);
      }

      return response.data;
    },
  };
}

/**
 * Get order tracking
 */
function createGetOrderTrackingTool(client: ACPClient): Tool {
  return {
    name: 'acp_get_order_tracking',
    description: 'Get shipping tracking information for an order.',
    parameters: z.object({
      orderId: z.string().describe('Order ID'),
    }),
    execute: async (params) => {
      const response = await client.getOrderTracking(params.orderId);

      if (response.error) {
        throw new Error(
          `Failed to get order tracking: ${response.error.message}`,
        );
      }

      return response.data;
    },
  };
}
