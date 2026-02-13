import { NextRequest, NextResponse } from 'next/server';
import { explainPlan } from '@/agent/explainer';
import { validateUIPlanStrict } from '@/agent/schema';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, previousPlan } = body;

    // STRICT: Validate request body
    if (!plan || typeof plan !== 'object') {
      return NextResponse.json(
        { error: 'INVALID_REQUEST: Missing or invalid plan' },
        { status: 400 }
      );
    }

    // STRICT: Validate plan with all checks
    const validation = validateUIPlanStrict(plan);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `PLAN_VALIDATION_ERROR: ${validation.error}` },
        { status: 400 }
      );
    }

    if (!validation.data) {
      return NextResponse.json(
        { error: 'PLAN_VALIDATION_ERROR: Plan validation succeeded but no data returned' },
        { status: 400 }
      );
    }

    // STRICT: Validate previousPlan if provided
    if (previousPlan) {
      const previousValidation = validateUIPlanStrict(previousPlan);
      if (!previousValidation.valid) {
        return NextResponse.json(
          { error: `INVALID_PREVIOUS_PLAN: ${previousValidation.error}` },
          { status: 400 }
        );
      }
    }

    // Generate explanation
    const result = await explainPlan(validation.data, previousPlan);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    if (!result.explanation) {
      return NextResponse.json(
        { error: 'EXPLANATION_GENERATION_ERROR: No explanation generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ explanation: result.explanation });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `INTERNAL_ERROR: ${errorMessage}` },
      { status: 500 }
    );
  }
}
