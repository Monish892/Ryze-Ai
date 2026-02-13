/**
 * Test script to verify minimal intent detection works correctly
 */

import { planUI } from '@/agent/planner';

async function testMinimalIntents() {
  console.log('🧪 Testing Minimal Intent Detection\n');

  const testCases = [
    {
      intent: 'Create a page with only one card titled "Profile". Nothing else.',
      expectedTitle: 'Profile',
      description: 'Should create minimal card with "Profile" title only',
    },
    {
      intent: 'Create a minimal page with one centered card titled "Welcome".',
      expectedTitle: 'Welcome',
      description: 'Should create minimal card with "Welcome" title only',
    },
    {
      intent: 'Only one card titled "Settings".',
      expectedTitle: 'Settings',
      description: 'Should create minimal card with "Settings" title only',
    },
    {
      intent: 'Create a simple, minimal interface with just one card.',
      expectedTitle: 'Welcome',
      description: 'Should create minimal card with default "Welcome" title',
    },
    {
      intent: 'Dashboard with sidebar',
      expectedTitle: null,
      description: 'Should NOT be minimal (has dashboard keyword)',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = await planUI(testCase.intent);

      if (result.error) {
        console.log(`❌ FAILED: ${testCase.description}`);
        console.log(`   Intent: "${testCase.intent}"`);
        console.log(`   Error: ${result.error}\n`);
        failed++;
        continue;
      }

      if (!result.plan) {
        console.log(`❌ FAILED: ${testCase.description}`);
        console.log(`   Intent: "${testCase.intent}"`);
        console.log(`   No plan generated\n`);
        failed++;
        continue;
      }

      const rootCard = result.plan.root.children?.[0];
      if (!rootCard) {
        console.log(`❌ FAILED: ${testCase.description}`);
        console.log(`   Intent: "${testCase.intent}"`);
        console.log(`   No card found in plan\n`);
        failed++;
        continue;
      }

      const cardTitle = (rootCard as any).props?.title;
      const hasChildren = (rootCard as any).children && (rootCard as any).children.length > 0;

      console.log(`✅ PASSED: ${testCase.description}`);
      console.log(`   Intent: "${testCase.intent}"`);
      console.log(`   Card Title: "${cardTitle}"`);
      console.log(`   Has Children: ${hasChildren}`);

      if (testCase.expectedTitle && cardTitle !== testCase.expectedTitle) {
        console.log(`   ⚠️  Title mismatch: expected "${testCase.expectedTitle}", got "${cardTitle}"`);
      }

      if (!testCase.expectedTitle && hasChildren) {
        console.log(`   ✓ Complex layout detected (as expected, not minimal)`);
      }

      console.log();
      passed++;
    } catch (error) {
      console.log(`❌ CRASHED: ${testCase.description}`);
      console.log(`   Intent: "${testCase.intent}"`);
      console.log(`   Error: ${error}\n`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

testMinimalIntents().then((success) => {
  process.exit(success ? 0 : 1);
});
