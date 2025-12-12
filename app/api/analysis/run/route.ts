import { runDeterministicAnalysis } from '@/lib/analysis';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { dealId, userId } = body;
  if (!dealId || !userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  const run = await runDeterministicAnalysis({ dealId, userId });
  return NextResponse.json(run);
}
