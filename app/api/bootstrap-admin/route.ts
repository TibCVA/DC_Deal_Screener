import { createBootstrapAdmin, hasUsers } from '@/lib/bootstrap';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  if (await hasUsers()) {
    return NextResponse.json({ error: 'Bootstrap already completed' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;
  const orgName = body?.orgName as string | undefined;

  if (!email || !password || !orgName) {
    return NextResponse.json({ error: 'email, password, and orgName are required' }, { status: 400 });
  }

  try {
    const { organization, user } = await createBootstrapAdmin({ email, password, orgName });
    return NextResponse.json({ organizationId: organization.id, userId: user.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bootstrap failed' }, { status: 400 });
  }
}
