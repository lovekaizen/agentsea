/**
 * Multi-Tenancy Example
 * Demonstrates tenant isolation and management features
 */

import {
  TenantManager,
  MemoryTenantStorage,
  TenantBufferMemory,
  Agent,
  AnthropicProvider,
  ToolRegistry,
  TenantStatus,
} from '@lov3kaizen/agentsea-core';

async function main() {
  console.log('🏢 AgentSea Multi-Tenancy Example\n');

  // ============================================
  // 1. Setup Tenant Manager
  // ============================================
  console.log('1. Setting up tenant manager...');

  const tenantStorage = new MemoryTenantStorage();
  const tenantManager = new TenantManager({
    storage: tenantStorage,
    defaultSettings: {
      maxAgents: 5,
      maxConversations: 50,
      rateLimit: 100, // requests per minute
      dataRetentionDays: 30,
    },
  });

  // ============================================
  // 2. Create Tenants
  // ============================================
  console.log('\n2. Creating tenants...');

  const acmeTenant = await tenantManager.createTenant({
    name: 'Acme Corporation',
    slug: 'acme',
    metadata: {
      industry: 'Technology',
      size: 'Enterprise',
    },
    settings: {
      maxAgents: 10,
      rateLimit: 500,
    },
  });
  console.log(`✓ Created tenant: ${acmeTenant.name} (${acmeTenant.id})`);

  const globexTenant = await tenantManager.createTenant({
    name: 'Globex Industries',
    slug: 'globex',
    metadata: {
      industry: 'Manufacturing',
      size: 'Medium',
    },
  });
  console.log(`✓ Created tenant: ${globexTenant.name} (${globexTenant.id})`);

  // ============================================
  // 3. Generate API Keys
  // ============================================
  console.log('\n3. Generating API keys...');

  const acmeKey = await tenantManager.createApiKey(acmeTenant.id, {
    name: 'Production API Key',
    scopes: ['agents:read', 'agents:execute'],
  });
  console.log(`✓ Acme API Key: ${acmeKey.plainKey.substring(0, 20)}...`);

  const globexKey = await tenantManager.createApiKey(globexTenant.id, {
    name: 'Development API Key',
    scopes: ['*'], // All permissions
  });
  console.log(`✓ Globex API Key: ${globexKey.plainKey.substring(0, 20)}...`);

  // ============================================
  // 4. Verify API Keys
  // ============================================
  console.log('\n4. Verifying API keys...');

  const verifiedAcme = await tenantManager.verifyApiKey(acmeKey.plainKey);
  console.log(`✓ Acme key verified: ${verifiedAcme?.name}`);

  const verifiedGlobex = await tenantManager.verifyApiKey(globexKey.plainKey);
  console.log(`✓ Globex key verified: ${verifiedGlobex?.name}`);

  // Try invalid key
  const invalidKey = await tenantManager.verifyApiKey('agentsea_invalid_key');
  console.log(`✓ Invalid key rejected: ${invalidKey === null}`);

  // ============================================
  // 5. Tenant-Isolated Memory
  // ============================================
  console.log('\n5. Demonstrating tenant-isolated memory...');

  const tenantMemory = new TenantBufferMemory();

  // Acme conversations
  tenantMemory.save(
    'conv-1',
    [
      { role: 'user', content: 'Hello from Acme!' },
      { role: 'assistant', content: 'Hi Acme!' },
    ],
    acmeTenant.id,
  );

  // Globex conversations
  tenantMemory.save(
    'conv-1', // Same conversation ID, different tenant
    [
      { role: 'user', content: 'Hello from Globex!' },
      { role: 'assistant', content: 'Hi Globex!' },
    ],
    globexTenant.id,
  );

  // Retrieve tenant-specific conversations
  const acmeMessages = tenantMemory.load('conv-1', acmeTenant.id);
  console.log(
    `✓ Acme conv-1: "${acmeMessages[0].content}" (${acmeMessages.length} messages)`,
  );

  const globexMessages = tenantMemory.load('conv-1', globexTenant.id);
  console.log(
    `✓ Globex conv-1: "${globexMessages[0].content}" (${globexMessages.length} messages)`,
  );

  // Get stats per tenant
  const stats = tenantMemory.getTenantStats();
  console.log('\n✓ Tenant Stats:');
  stats.forEach((stat) => {
    console.log(
      `  ${stat.tenantId}: ${stat.conversationCount} conversations, ${stat.messageCount} messages`,
    );
  });

  // ============================================
  // 6. Quota Management
  // ============================================
  console.log('\n6. Managing quotas...');

  // Check quota
  let quota = await tenantManager.checkQuota(acmeTenant.id, 'requests');
  console.log(
    `✓ Acme requests quota: ${quota.remaining} remaining (allowed: ${quota.allowed})`,
  );

  // Increment usage
  await tenantManager.incrementQuota(acmeTenant.id, 'requests', 10);
  quota = await tenantManager.checkQuota(acmeTenant.id, 'requests');
  console.log(
    `✓ After 10 requests: ${quota.remaining} remaining (allowed: ${quota.allowed})`,
  );

  // ============================================
  // 7. Tenant-Aware Agent Execution
  // ============================================
  console.log('\n7. Running agents with tenant context...');

  if (process.env.ANTHROPIC_API_KEY) {
    const provider = new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-sonnet-4-20250514',
    });

    const toolRegistry = new ToolRegistry();

    // Create agent for Acme
    const acmeAgent = new Agent(
      {
        name: 'acme-support',
        description: 'Acme customer support agent',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        systemPrompt: `You are a customer support agent for ${acmeTenant.name}.`,
      },
      provider,
      toolRegistry,
    );

    const acmeResponse = await acmeAgent.execute('What is your company name?', {
      conversationId: `${acmeTenant.id}:support-1`,
      sessionData: { tenantId: acmeTenant.id },
      history: [],
    });

    console.log(`✓ Acme Agent: "${acmeResponse.content.substring(0, 100)}..."`);

    // Increment quota after execution
    await tenantManager.incrementQuota(acmeTenant.id, 'requests', 1);
  } else {
    console.log('⚠ Skipping agent execution (ANTHROPIC_API_KEY not set)');
  }

  // ============================================
  // 8. Tenant Management
  // ============================================
  console.log('\n8. Managing tenant lifecycle...');

  // Suspend tenant
  await tenantManager.suspendTenant(globexTenant.id);
  const suspended = await tenantManager.getTenant(globexTenant.id);
  console.log(`✓ Globex status: ${suspended?.status}`);

  // Verify suspended tenant cannot authenticate
  const suspendedVerify = await tenantManager.verifyApiKey(globexKey.plainKey);
  console.log(`✓ Suspended tenant authentication: ${suspendedVerify === null}`);

  // Reactivate tenant
  await tenantManager.activateTenant(globexTenant.id);
  const active = await tenantManager.getTenant(globexTenant.id);
  console.log(`✓ Globex reactivated: ${active?.status}`);

  // ============================================
  // 9. List Tenants
  // ============================================
  console.log('\n9. Listing all tenants...');

  const { tenants, total } = await tenantManager.listTenants({
    status: TenantStatus.ACTIVE,
  });

  console.log(`✓ Found ${total} active tenants:`);
  tenants.forEach((t) => {
    console.log(`  - ${t.name} (${t.slug}): ${t.status}`);
  });

  // ============================================
  // 10. Cleanup
  // ============================================
  console.log('\n10. Cleanup (optional in production)...');

  tenantMemory.clearTenant(acmeTenant.id);
  console.log(`✓ Cleared Acme memory`);

  console.log('\n✅ Multi-tenancy example completed!');
  console.log('\nKey Features Demonstrated:');
  console.log('  • Tenant creation and management');
  console.log('  • API key generation and validation');
  console.log('  • Data isolation with tenant-aware memory');
  console.log('  • Quota tracking and enforcement');
  console.log('  • Tenant lifecycle (suspend/activate)');
  console.log('  • Multi-tenant agent execution');
}

// Run the example
main().catch(console.error);
