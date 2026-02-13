/**
 * Test script for negation and final directive handling
 * Verifies that the planner correctly handles:
 * - Negations: "remove X", "without X", "no X"
 * - Final directives: "then X" overrides earlier instructions
 * - Minimal requests: "make it minimal" produces single card
 */

import { planUI } from '@/agent/planner';

async function testNegationHandling() {
  console.log('🧪 Testing Negation & Final Directive Handling\n');

  const testCases = [
    {
      intent: 'Create a dashboard with a sidebar and a navbar. Below the navbar place two cards side by side, one with a chart and one with a table. Then remove the sidebar and make the layout minimal.',
      expectedLayout: 'ColumnLayout',
      expectedDescription: 'Should be minimal (final directive "make minimal" overrides earlier instructions)',
      shouldBeSimple: true,
    },
    {
      intent: 'Create a navbar with a chart, but remove the chart.',
      expectedLayout: 'ColumnLayout',
      expectedDescription: 'Should have navbar only (chart explicitly removed)',
      shouldHaveChart: false,
    },
    {
      intent: 'Create a form without input fields.',
      expectedLayout: 'ColumnLayout',
      expectedDescription: 'Should have form card but no input fields (explicitly excluded)',
      shouldHaveInputs: false,
    },
    {
      intent: 'Create a page with a sidebar, navbar, and two columns with chart and table. But remove the sidebar.',
      expectedLayout: 'ColumnLayout',
      expectedDescription: 'Should have navbar + two columns without sidebar',
      shouldHaveSidebar: false,
    },
    {
      intent: 'Create a page with only one card titled "Profile". Nothing else.',
      expectedLayout: 'ColumnLayout',
      expectedDescription: 'Should be minimal with "Profile" title',
      isMinimal: true,
      expectedTitle: 'Profile',
    },
    {
      intent: 'Dashboard with sidebar and navbar',
      expectedLayout: 'RowLayout',
      expectedDescription: 'Should be complex layout (no negations or final directives)',
      isMinimal: false,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n📋 Test: ${test.expectedDescription}`);
    console.log(`   Intent: "${test.intent}"`);

    try {
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

      const rootLayout = result.plan.root.component;
      const childCount = result.plan.root.children?.length ?? 0;
      const firstChild = result.plan.root.children?.[0];

      console.log(`   ✅ Plan generated`);
      console.log(`      Root layout: ${rootLayout}`);
      console.log(`      Children count: ${childCount}`);
      
      if (firstChild) {
        console.log(`      First child: ${(firstChild as any).component}`);
        if ((firstChild as any).props?.title) {
          console.log(`      Title: "${(firstChild as any).props.title}"`);
        }
      }

      // Check specific requirements
      let requirementsMet = true;

      if (test.expectedLayout && rootLayout !== test.expectedLayout) {
        console.log(`      ⚠️  Layout: expected ${test.expectedLayout}, got ${rootLayout}`);
        requirementsMet = false;
      }

      if (test.isMinimal !== undefined) {
        const isMinimal = childCount === 1 && (firstChild as any).component === 'Card' && !(firstChild as any).children;
        if (test.isMinimal && !isMinimal) {
          console.log(`      ⚠️  Should be minimal but isn't`);
          requirementsMet = false;
        } else if (!test.isMinimal && isMinimal) {
          console.log(`      ⚠️  Should be complex but is minimal`);
          requirementsMet = false;
        }
      }

      if (test.expectedTitle && (firstChild as any).props?.title !== test.expectedTitle) {
        console.log(`      ⚠️  Title: expected "${test.expectedTitle}", got "${(firstChild as any).props?.title}"`);
        requirementsMet = false;
      }

      if (test.shouldBeSimple && childCount > 1) {
        console.log(`      ⚠️  Should be simple (1 child) but has ${childCount} children`);
        requirementsMet = false;
      }

      if (test.shouldHaveChart === false) {
        const hasChart = JSON.stringify(result.plan).includes('"component":"Chart"');
        if (hasChart) {
          console.log(`      ⚠️  Should NOT have chart but does`);
          requirementsMet = false;
        }
      }

      if (test.shouldHaveSidebar === false) {
        const hasSidebar = JSON.stringify(result.plan).includes('"component":"Sidebar"');
        if (hasSidebar) {
          console.log(`      ⚠️  Should NOT have sidebar but does`);
          requirementsMet = false;
        }
      }

      if (test.shouldHaveInputs === false) {
        const hasInputs = JSON.stringify(result.plan).includes('"component":"Input"');
        if (hasInputs) {
          console.log(`      ⚠️  Should NOT have Input fields but does`);
          requirementsMet = false;
        }
      }

      if (requirementsMet) {
        console.log(`   ✅ PASSED all requirements`);
        passed++;
      } else {
        console.log(`   ❌ FAILED some requirements`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ CRASHED: ${error}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

testNegationHandling().then((success) => {
  process.exit(success ? 0 : 1);
});
