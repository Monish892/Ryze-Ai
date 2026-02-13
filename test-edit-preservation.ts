/**
 * Test for edit-mode structural preservation
 * 
 * User's test case:
 * 1. Initial: "Create a dashboard with sidebar, navbar, two cards with chart and table"
 * 2. Edit: "Remove sidebar and add settings modal with two inputs"
 * 
 * Expected result:
 * - Sidebar removed ✅
 * - Navbar preserved ✅
 * - Two cards preserved ✅
 * - Chart preserved ✅
 * - Table preserved ✅
 * - Modal added ✅
 * - Two inputs in modal ✅
 */

import { planUI } from '@/agent/planner';

async function testEditModePreservation() {
  console.log('🧪 Testing Edit-Mode Structural Preservation\n');

  // Step 1: Create initial layout
  console.log('Step 1: Generate initial dashboard');
  const initialPrompt = `Create a dashboard with a sidebar and a navbar. 
    Below the navbar place two cards side by side, 
    one with a chart and one with a table.`;

  const initialResult = await planUI(initialPrompt);
  
  if (initialResult.error) {
    console.log(`❌ Initial generation failed: ${initialResult.error}`);
    process.exit(1);
  }

  const initialPlan = initialResult.plan!;
  console.log(`✅ Initial plan generated`);
  console.log(`   Root: ${initialPlan.root.component}`);
  
  const initialStr = JSON.stringify(initialPlan);
  const hasInitialSidebar = initialStr.includes('"component":"Sidebar"');
  const hasInitialNavbar = initialStr.includes('"component":"Navbar"');
  const hasInitialChart = initialStr.includes('"component":"Chart"');
  const hasInitialTable = initialStr.includes('"component":"Table"');
  
  console.log(`   Has Sidebar: ${hasInitialSidebar ? '✅' : '❌'}`);
  console.log(`   Has Navbar: ${hasInitialNavbar ? '✅' : '❌'}`);
  console.log(`   Has Chart: ${hasInitialChart ? '✅' : '❌'}`);
  console.log(`   Has Table: ${hasInitialTable ? '✅' : '❌'}`);

  if (!hasInitialSidebar || !hasInitialNavbar || !hasInitialChart || !hasInitialTable) {
    console.log(`\n⚠️  Initial plan missing expected components`);
    console.log(`Plan: ${JSON.stringify(initialPlan, null, 2)}`);
  }

  // Step 2: Apply edit (remove sidebar, add modal with inputs)
  console.log(`\nStep 2: Edit - Remove sidebar and add settings modal`);
  const editPrompt = `Remove the sidebar and add a settings modal with two inputs.`;

  const editResult = await planUI(editPrompt, initialPlan);

  if (editResult.error) {
    console.log(`❌ Edit failed: ${editResult.error}`);
    process.exit(1);
  }

  const editedPlan = editResult.plan!;
  console.log(`✅ Edit plan generated`);
  console.log(`   Modification Type: ${editedPlan.modificationType}`);
  console.log(`   Root: ${editedPlan.root.component}`);

  // Verify expected structure in edited plan
  const editedStr = JSON.stringify(editedPlan);
  
  const hasSidebarRemoved = !editedStr.includes('"component":"Sidebar"');
  const hasNavbarPreserved = editedStr.includes('"component":"Navbar"');
  const hasChartPreserved = editedStr.includes('"component":"Chart"');
  const hasTablePreserved = editedStr.includes('"component":"Table"');
  const hasModalAdded = editedStr.includes('"component":"Modal"');
  const hasInputsAdded = (editedStr.match(/"component":"Input"/g) || []).length >= 2;

  console.log(`\n📊 Verification:
   Sidebar removed: ${hasSidebarRemoved ? '✅' : '❌'}
   Navbar preserved: ${hasNavbarPreserved ? '✅' : '❌'}
   Chart preserved: ${hasChartPreserved ? '✅' : '❌'}
   Table preserved: ${hasTablePreserved ? '✅' : '❌'}
   Modal added: ${hasModalAdded ? '✅' : '❌'}
   2+ Inputs in Modal: ${hasInputsAdded ? '✅' : '❌'}`);

  // Show structure
  console.log(`\n📐 Structure:`);
  console.log(JSON.stringify(editedPlan.root, null, 2).substring(0, 800));
  console.log(`...\n`);

  const allPassed = hasSidebarRemoved && hasNavbarPreserved && 
                   hasChartPreserved && hasTablePreserved && 
                   hasModalAdded && hasInputsAdded;

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Edit mode preservation works correctly!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - Edit mode needs more work');
    process.exit(1);
  }
}

testEditModePreservation().catch(console.error);
