# ACP (Agentic Commerce Protocol) Integration

## Overview

The Agentic Commerce Protocol (ACP) is an open standard that enables AI agents to interact with commerce platforms seamlessly. This integration allows your AI agents to:

- **Discover products** through intelligent search
- **Manage shopping carts** with add, update, and remove operations
- **Process checkouts** with complete order flows
- **Handle payments** through delegated payment providers
- **Track orders** and provide shipping updates

## Quick Start

### 1. Installation

The ACP integration is included in the `@lov3kaizen/agentsea-core` package:

```bash
pnpm add @lov3kaizen/agentsea-core
```

### 2. Basic Setup

```typescript
import {
  ACPClient,
  createACPTools,
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
} from '@lov3kaizen/agentsea-core';

// Initialize ACP client
const acpClient = new ACPClient({
  baseUrl: 'https://api.yourcommerce.com/v1',
  apiKey: process.env.ACP_API_KEY,
  merchantId: process.env.ACP_MERCHANT_ID,
});

// Create commerce tools
const acpTools = createACPTools(acpClient);

// Setup agent with commerce capabilities
const agent = new Agent(
  {
    name: 'shopping-assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    tools: acpTools,
    systemPrompt: 'You are a helpful shopping assistant...',
  },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY),
  toolRegistry,
  new BufferMemory(),
);
```

### 3. Execute Commerce Operations

```typescript
const response = await agent.execute(
  'I need wireless headphones under $100',
  context,
);
```

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                      AI Agent                           │
│  (with ACP Tools registered)                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ uses
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   ACP Tools                             │
│  • acp_search_products                                  │
│  • acp_create_cart                                      │
│  • acp_add_to_cart                                      │
│  • acp_create_checkout                                  │
│  • acp_complete_checkout                                │
│  • ... (14 total tools)                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  ACP Client                             │
│  (HTTP client for ACP-compliant APIs)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Commerce Platform API                         │
│  (ACP-compliant e-commerce backend)                     │
└─────────────────────────────────────────────────────────┘
```

## Available Tools

### Product Discovery

#### `acp_search_products`

Search for products with filters and sorting.

```typescript
// Agent can use this tool when user asks:
// "Find me running shoes under $100"
{
  query: "running shoes",
  maxPrice: 100,
  sortBy: "popularity"
}
```

#### `acp_get_product`

Get detailed information about a specific product.

```typescript
{
  productId: 'prod_abc123';
}
```

### Cart Management

#### `acp_create_cart`

Create a new shopping cart.

```typescript
// Returns: { id: "cart_xyz", items: [], totalAmount: { amount: 0, currency: "USD" } }
```

#### `acp_add_to_cart`

Add a product to the cart.

```typescript
{
  cartId: "cart_xyz",
  productId: "prod_abc123",
  quantity: 2,
  price: { amount: 49.99, currency: "USD" }
}
```

#### `acp_update_cart_item`

Update item quantity in cart.

```typescript
{
  cartId: "cart_xyz",
  productId: "prod_abc123",
  quantity: 3  // or 0 to remove
}
```

#### `acp_get_cart`

View current cart contents.

```typescript
{
  cartId: 'cart_xyz';
}
```

### Checkout

#### `acp_create_checkout`

Initiate checkout process.

```typescript
{
  cartId: "cart_xyz",
  customer: {
    email: "customer@example.com",
    name: "John Doe"
  }
}
```

#### `acp_update_shipping_address`

Set shipping address for the order.

```typescript
{
  sessionId: "checkout_abc",
  address: {
    line1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    postalCode: "94102",
    country: "US"
  }
}
```

#### `acp_update_payment_method`

Configure payment method.

```typescript
{
  sessionId: "checkout_abc",
  paymentMethod: {
    type: "delegated",
    delegatedProvider: "stripe",
    token: "tok_visa"
  }
}
```

#### `acp_complete_checkout`

Finalize the purchase.

```typescript
{
  sessionId: 'checkout_abc';
}
```

### Order Management

#### `acp_get_order`

Retrieve order details.

```typescript
{
  orderId: 'order_123';
}
```

#### `acp_cancel_order`

Cancel an order (if not shipped).

```typescript
{
  orderId: 'order_123';
}
```

#### `acp_get_order_tracking`

Get shipping tracking information.

```typescript
{
  orderId: 'order_123';
}
// Returns: { trackingNumber: "1Z999AA...", carrier: "UPS", status: "in_transit" }
```

## Payment Integration

### Delegated Payment Flow

ACP supports delegated payment processing, allowing you to integrate with payment providers like Stripe, PayPal, etc., without handling sensitive payment data.

```typescript
// 1. Create checkout session
const checkout = await agent.execute(
  'Start checkout with email: user@example.com',
  context,
);

// 2. Set up delegated payment
const payment = await acpClient.createDelegatedPayment(checkoutSessionId, {
  provider: 'stripe',
  merchantAccountId: 'acct_xxx',
  returnUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});

// 3. User completes payment on provider's platform
// (Stripe, PayPal, etc.)

// 4. Confirm payment and complete order
await acpClient.confirmPayment(paymentIntentId, paymentToken);
```

### Security Best Practices

- ✅ **Never store raw card numbers** - Use payment tokens
- ✅ **Use delegated providers** - Let Stripe/PayPal handle PCI compliance
- ✅ **Validate amounts** - Always confirm prices before charging
- ✅ **Use HTTPS** - All API calls are over secure connections
- ✅ **Tokenize sensitive data** - Use one-time payment tokens

## Examples

### Example 1: Product Search and Add to Cart

```typescript
const agent = new Agent(/* ... with ACP tools ... */);

// User: "I need a laptop for programming"
const response = await agent.execute(
  'I need a laptop for programming under $1500',
  context,
);

// Agent uses: acp_search_products
// Agent responds with product options

// User: "Add the MacBook to my cart"
const cartResponse = await agent.execute(
  'Add the MacBook Pro to my cart',
  context,
);

// Agent uses: acp_create_cart (if needed), then acp_add_to_cart
```

### Example 2: Complete Purchase Flow

```typescript
// 1. Search products
await agent.execute('Find wireless headphones', context);

// 2. Add to cart
await agent.execute('Add the Sony WH-1000XM5', context);

// 3. Start checkout
await agent.execute(
  'Checkout with email: john@example.com, ship to 123 Main St, SF, CA 94102',
  context,
);

// 4. Set payment
await agent.execute('Use my Stripe account for payment', context);

// 5. Complete order
await agent.execute('Complete my order', context);

// 6. Track order
await agent.execute('Where is my order?', context);
```

### Example 3: Order Management

```typescript
// Check order status
await agent.execute('What is the status of order #12345?', context);

// Track shipment
await agent.execute('Track my order', context);

// Cancel order
await agent.execute('Cancel order #12345', context);
```

## Configuration

### ACP Client Configuration

```typescript
const acpClient = new ACPClient({
  // Required
  baseUrl: 'https://api.commerce.com/v1',

  // Optional authentication
  apiKey: 'your-api-key',
  merchantId: 'merchant-123',

  // Optional request configuration
  timeout: 30000, // 30 seconds
  headers: {
    'X-Custom-Header': 'value',
  },
});
```

### Agent System Prompt Template

```typescript
const systemPrompt = `You are a professional shopping assistant.

Capabilities:
- Product search and recommendations
- Shopping cart management
- Secure checkout processing
- Order tracking and support

Guidelines:
- Always confirm prices before adding to cart
- Ask for confirmation before completing purchases
- Provide clear shipping and payment information
- Handle errors gracefully with alternatives
- Be proactive about suggesting related products

When handling payments:
- Never ask for raw credit card numbers
- Use secure payment tokens only
- Confirm amounts before processing
- Provide clear transaction receipts`;
```

## API Reference

### Types

See [`packages/core/src/acp/types.ts`](../packages/core/src/acp/types.ts) for complete type definitions:

- `ACPProduct` - Product information
- `ACPCart` - Shopping cart
- `ACPCheckoutSession` - Checkout session
- `ACPPaymentIntent` - Payment intent
- `ACPOrder` - Order details
- `ACPConfig` - Client configuration

### Client Methods

See [`packages/core/src/acp/client.ts`](../packages/core/src/acp/client.ts) for all available methods:

**Product Discovery**

- `searchProducts(query)` - Search products
- `getProduct(productId)` - Get product details
- `getProducts(productIds)` - Batch get products

**Cart Management**

- `createCart()` - Create cart
- `getCart(cartId)` - Get cart
- `addToCart(cartId, item)` - Add item
- `updateCartItem(cartId, productId, quantity)` - Update quantity
- `removeFromCart(cartId, productId)` - Remove item

**Checkout**

- `createCheckoutSession(cartId, customer?)` - Start checkout
- `updateShippingAddress(sessionId, address)` - Set shipping
- `updatePaymentMethod(sessionId, paymentMethod)` - Set payment
- `completeCheckout(sessionId)` - Complete purchase

**Payments**

- `createDelegatedPayment(sessionId, config)` - Delegated payment
- `confirmPayment(intentId, token?)` - Confirm payment

**Orders**

- `getOrder(orderId)` - Get order
- `getCustomerOrders(customerId)` - Get customer orders
- `cancelOrder(orderId)` - Cancel order
- `getOrderTracking(orderId)` - Track shipment

## Resources

- **ACP Specification**: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
- **OpenAI Commerce Docs**: https://developers.openai.com/commerce/
- **Example Applications**: See `examples/acp-*.ts` files

## Troubleshooting

### Common Issues

**Issue**: "Tool not found" error

```typescript
// Solution: Ensure ACP tools are registered
const acpTools = createACPTools(acpClient);
toolRegistry.registerMany(acpTools);
```

**Issue**: API timeout errors

```typescript
// Solution: Increase timeout in client config
const acpClient = new ACPClient({
  baseUrl: '...',
  timeout: 60000, // 60 seconds
});
```

**Issue**: Payment fails

```typescript
// Solution: Verify payment token and provider config
// Ensure delegated payment configuration is correct
// Check merchant account credentials
```

## Contributing

To extend ACP functionality:

1. Add new types to `packages/core/src/acp/types.ts`
2. Add client methods to `packages/core/src/acp/client.ts`
3. Create tools in `packages/core/src/acp/tools.ts`
4. Update examples and documentation

## License

MIT - See LICENSE file for details
