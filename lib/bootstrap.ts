import { prisma } from './prisma';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';

export async function hasUsers() {
  return (await prisma.user.count()) > 0;
}

export async function createBootstrapAdmin({
  email,
  password,
  orgName,
}: {
  email: string;
  password: string;
  orgName: string;
}) {
  if (await hasUsers()) {
    throw new Error('Users already exist; bootstrap admin disabled.');
  }

  const passwordHash = await hash(password, 10);
  const organization = await prisma.organization.create({ data: { name: orgName } });
  const user = await prisma.user.create({
    data: { email, passwordHash, name: email.split('@')[0] || 'Admin' },
  });
  await prisma.membership.create({
    data: { organizationId: organization.id, userId: user.id, role: Role.ADMIN },
  });
  return { organization, user };
}
