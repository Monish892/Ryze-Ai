/**
 * Determinism Test Utility
 * Verifies that identical inputs produce identical outputs
 */

import { planUI } from '@/agent/planner';
import { generateCode } from '@/agent/generator';
import { explainPlan } from '@/agent/explainer';

export interface DeterminismTestResult {
  passed: boolean;
  errors: string[];
  details: {
    planMatch: boolean;
    codeMatch: boolean;
    explanationMatch: boolean;
  };
}

/**
 * Test determinism by running planner twice with identical input
 */
export async function testDeterminism(prompt: string): Promise<DeterminismTestResult> {
  const errors: string[] = [];
  const details = {
    planMatch: false,
    codeMatch: false,
    explanationMatch: false,
  };

  try {
    // Run planner twice
    const result1 = await planUI(prompt);
    const result2 = await planUI(prompt);

    // Check if both succeeded
    if (result1.error) {
      errors.push(`First planner run error: ${result1.error}`);
      return { passed: false, errors, details };
    }
    if (result2.error) {
      errors.push(`Second planner run error: ${result2.error}`);
      return { passed: false, errors, details };
    }

    // Compare plans (deep JSON comparison)
    const plan1JSON = JSON.stringify(result1.plan, null, 2);
    const plan2JSON = JSON.stringify(result2.plan, null, 2);

    if (plan1JSON !== plan2JSON) {
      errors.push('Plans are not identical');
      errors.push(`Plan 1:\n${plan1JSON}`);
      errors.push(`Plan 2:\n${plan2JSON}`);
    } else {
      details.planMatch = true;
    }

    // If plans match, test code generation
    if (details.planMatch && result1.plan) {
      const code1 = await generateCode(result1.plan);
      const code2 = await generateCode(result1.plan);

      if (code1.error || code2.error) {
        errors.push(`Code generation error: ${code1.error || code2.error}`);
      } else if (code1.code !== code2.code) {
        errors.push('Generated code is not identical on consecutive runs');
      } else {
        details.codeMatch = true;
      }
    }

    // If plans match, test explanation generation
    if (details.planMatch && result1.plan) {
      const exp1 = await explainPlan(result1.plan);
      const exp2 = await explainPlan(result1.plan);

      if (exp1.error || exp2.error) {
        errors.push(`Explanation generation error: ${exp1.error || exp2.error}`);
      } else if (exp1.explanation !== exp2.explanation) {
        errors.push('Generated explanation is not identical on consecutive runs');
      } else {
        details.explanationMatch = true;
      }
    }

    return {
      passed: errors.length === 0 && details.planMatch && details.codeMatch && details.explanationMatch,
      errors,
      details,
    };
  } catch (err) {
    errors.push(`Determinism test error: ${String(err)}`);
    return { passed: false, errors, details };
  }
}

/**
 * Log determinism test results
 */
export function logDeterminismTest(result: DeterminismTestResult) {
  if (result.passed) {
    console.log('✅ DETERMINISM TEST PASSED');
    console.log('  - Plans are identical:', result.details.planMatch);
    console.log('  - Code is identical:', result.details.codeMatch);
    console.log('  - Explanations are identical:', result.details.explanationMatch);
  } else {
    console.error('❌ DETERMINISM TEST FAILED');
    result.errors.forEach(err => console.error(`  - ${err}`));
  }
}
