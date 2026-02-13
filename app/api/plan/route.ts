import { NextRequest, NextResponse } from 'next/server';
import { planUI } from '@/agent/planner';
import { checkPromptInjectionStrict, validateUIPlanStrict } from '@/agent/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, previousPlan } = body;

    // STRICT: Validate request body
    if (!intent || typeof intent !== 'string') {
      return NextResponse.json(
        { error: 'INVALID_REQUEST: Missing or invalid intent field' },
        { status: 400 }
      );
    }

    // STRICT: Check for prompt injection
    const injectionCheck = checkPromptInjectionStrict(intent);
    if (!injectionCheck.safe) {
      return NextResponse.json(
        { error: `PROMPT_INJECTION_DETECTED: ${injectionCheck.reason}` },
        { status: 400 }
      );
    }

    // STRICT: Validate previousPlan if provided
    if (previousPlan) {
      const planValidation = validateUIPlanStrict(previousPlan);
      if (!planValidation.valid) {
        return NextResponse.json(
          { error: `INVALID_PREVIOUS_PLAN: ${planValidation.error}` },
          { status: 400 }
        );
      }
    }

    // Generate plan
    const result = await planUI(intent, previousPlan);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    if (!result.plan) {
      return NextResponse.json(
        { error: 'PLAN_GENERATION_ERROR: No plan generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan: result.plan });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR: ${errorMessage}` },
      { status: 500 }
    );
  }
}
