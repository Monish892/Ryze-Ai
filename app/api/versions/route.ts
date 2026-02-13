import { NextRequest, NextResponse } from 'next/server';
import { getVersionStore } from '@/lib/versionStore';

export async function GET() {
  try {
    const store = getVersionStore();
    const versions = store.getAllVersions();
    
    return NextResponse.json({
      versions: versions.map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        explanation: v.explanation,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, versionId, plan, code, explanation } = body;

    const store = getVersionStore();

    if (action === 'add') {
      if (!plan || !code || !explanation) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const id = store.addVersion(plan, code, explanation);
      return NextResponse.json({ id });
    } else if (action === 'get') {
      if (!versionId) {
        return NextResponse.json(
          { error: 'Missing versionId' },
          { status: 400 }
        );
      }

      const version = store.getVersion(versionId);
      if (!version) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ version });
    } else if (action === 'set-current') {
      if (!versionId) {
        return NextResponse.json(
          { error: 'Missing versionId' },
          { status: 400 }
        );
      }

      const success = store.setCurrentVersion(versionId);
      if (!success) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } else if (action === 'delete') {
      if (!versionId) {
        return NextResponse.json(
          { error: 'Missing versionId' },
          { status: 400 }
        );
      }

      const success = store.deleteVersion(versionId);
      if (!success) {
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
