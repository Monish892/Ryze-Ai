/**
 * Test the specific user prompt
 */

import { planUI } from '@/agent/planner';

async function testUserPrompt() {
  const intent = `Create a dashboard with a sidebar and a navbar. 
Below the navbar place two cards side by side, 
one with a chart and one with a table. 
Then remove the sidebar and make the layout minimal.`;

  console.log('📋 Testing User Prompt');
  console.log(`Intent: "${intent}"\n`);

  const result = await planUI(intent);

  if (result.error) {
    console.log(`❌ Error: ${result.error}`);
    process.exit(1);
  }

  if (!result.plan) {
    console.log(`❌ No plan generated`);
    process.exit(1);
  }

  const plan = result.plan;
  console.log('Generated Plan Structure:');
  console.log(JSON.stringify(plan, null, 2));

  // Verify expectations
  console.log('\n✅ Verification:');
  
  const root = plan.root;
  console.log(`Root layout: ${root.component}`);
  
  // Should have navbar and two columns
  const hasNavbar = JSON.stringify(plan).includes('"component":"Navbar"');
  console.log(`Has Navbar: ${hasNavbar ? '✅' : '❌'}`);
  
  const hasSidebar = JSON.stringify(plan).includes('"component":"Sidebar"');
  console.log(`Has Sidebar: ${hasSidebar ? '❌ (WRONG - should be removed)' : '✅ (Correctly removed)'}`);
  
  const hasChart = JSON.stringify(plan).includes('"component":"Chart"');
  console.log(`Has Chart: ${hasChart ? '✅' : '❌'}`);
  
  const hasTable = JSON.stringify(plan).includes('"component":"Table"');
  console.log(`Has Table: ${hasTable ? '✅' : '❌'}`);
  
  const numCards = (JSON.stringify(plan).match(/"component":"Card"/g) || []).length;
  console.log(`Number of Cards: ${numCards} (should be 2 for side-by-side)`);

  // Should NOT be a single minimal card
  const isSingleCard = root.component === 'ColumnLayout' && 
                       root.children?.length === 1 &&
                       (root.children[0] as any).component === 'Card' &&
                       !(root.children[0] as any).children;
  console.log(`Is minimal single card: ${isSingleCard ? '❌ (WRONG)' : '✅ (Correctly complex)'}`);
}

testUserPrompt().catch(console.error);
