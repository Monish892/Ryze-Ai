/**
 * Test script for improved planner logic
 * Tests complex multi-level layout interpretation
 */

import { planUI } from '@/agent/planner';

async function testPlannerLayouts() {
  console.log('🧪 Testing Improved Planner Logic\n');

  const testCases = [
    {
      intent: 'sidebar on the left',
      expectedRoot: 'RowLayout',
      expectedChildrenCount: 2,
      description: 'Sidebar on left should use RowLayout',
    },
    {
      intent: 'sidebar on the left with navbar at the top',
      expectedRoot: 'RowLayout',
      expectedChildrenCount: 2,
      description: 'Sidebar + navbar should create nested layout',
    },
    {
      intent: 'navbar at the top with two cards side by side',
      expectedRoot: 'ColumnLayout',
      expectedChildrenCount: 2,
      description: 'Navbar at top should use ColumnLayout as root',
    },
    {
      intent: 'two cards side by side with chart and table',
      expectedRoot: 'ColumnLayout',
      expectedChildrenCount: 1,
      description: 'Two columns with chart and table should nest properly',
    },
    {
      intent: 'dashboard with sidebar',
      expectedRoot: 'RowLayout',
      expectedChildrenCount: 2,
      description: 'Dashboard with sidebar should have Row as root',
    },
    {
      intent: 'create a simple form',
      expectedRoot: 'ColumnLayout',
      expectedChildrenCount: 1,
      description: 'Simple form should use ColumnLayout',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n📋 Test: ${test.description}`);
    console.log(`   Intent: "${test.intent}"`);

    const result = await planUI(test.intent);

    if (result.error) {
      console.log(`   ❌ FAILED: ${result.error}`);
      failed++;
      continue;
    }

    if (!result.plan) {
      console.log(`   ❌ FAILED: No plan generated`);
      failed++;
      continue;
    }

    const rootComponent = result.plan.root.component;
    const childrenCount = result.plan.root.children?.length || 0;

    const rootMatch = rootComponent === test.expectedRoot;
    const rootStatus = rootMatch ? '✅' : '❌';

    console.log(`   ${rootStatus} Root: ${rootComponent} (expected: ${test.expectedRoot})`);
    console.log(`   📊 Children: ${childrenCount}`);

    if (rootMatch) {
      console.log(`   ✅ PASSED`);
      passed++;
    } else {
      console.log(`   ❌ FAILED`);
      failed++;
    }

    // Print tree structure
    function printTree(node: any, indent = '      ') {
      const isLayout =
        node.component === 'ColumnLayout' ||
        node.component === 'RowLayout' ||
        node.component === 'GridLayout';
      const icon = isLayout ? '📦' : '🎯';
      console.log(`${indent}${icon} ${node.component} (${node.id})`);
      if (node.children) {
        node.children.forEach((child: any) => {
          printTree(child, indent + '  ');
        });
      }
    }

    console.log(`   Tree:`);
    printTree(result.plan.root);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed === 0) {
    console.log('✅ All tests passed! Planner logic is working correctly.\n');
  } else {
    console.log(`❌ ${failed} test(s) failed. Review planner logic.\n`);
  }
}

testPlannerLayouts().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
