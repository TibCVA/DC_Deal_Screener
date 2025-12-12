import { PrismaClient, Role, DealType } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.DEMO_SEED !== '1') {
    console.log('DEMO_SEED not set; skipping demo seed to avoid populating production data.');
    return;
  }

  const password = process.env.DEMO_ADMIN_PASSWORD || 'password123';
  const passwordHash = await hash(password, 10);
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: { id: 'demo-org', name: 'Demo Infrastructure Partners' },
  });

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin Analyst', passwordHash },
  });

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: {},
    create: { userId: user.id, organizationId: org.id, role: Role.ADMIN },
  });

  const fund = await prisma.fund.upsert({
    where: { id: 'demo-fund' },
    update: {},
    create: {
      id: 'demo-fund',
      name: 'Pan-EU Digital Infra Fund',
      organizationId: org.id,
      thesis: {
        markets: 'FR, UK, NL, DE, ES, IT, PL, IE, Nordics',
        productFocus: 'Hyperscale + edge-ready',
        dealTypes: 'Greenfield, Brownfield',
        riskAppetite: 'Prefer firm capacity; flex with clear curtailment caps',
        esg: 'EU data residency; renewable-backed where possible',
        evidenceLevel: 'Signed grid letters, permit numbers, customer LOIs',
      },
    },
  });

  await prisma.deal.upsert({
    where: { id: 'demo-deal' },
    update: {},
    create: {
      id: 'demo-deal',
      name: 'Paris South Campus',
      country: 'FR',
      city: 'Paris',
      productType: 'Hyperscale',
      type: DealType.GREENFIELD,
      fundId: fund.id,
    },
  });

  const countryPacks = [
    { code: 'FR', name: 'France' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'ES', name: 'Spain' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'PL', name: 'Poland' },
    { code: 'IE', name: 'Ireland' },
    { code: 'NO', name: 'Nordics (NO/SE/FI/DK)' },
  ];

  for (const pack of countryPacks) {
    await prisma.countryPack.upsert({
      where: { organizationId_countryCode: { organizationId: org.id, countryCode: pack.code } },
      update: {},
      create: {
        name: pack.name,
        countryCode: pack.code,
        organizationId: org.id,
        allowedDomains: ['*.gov', '*.eu'],
        goldSources: { label: 'Official TSO queue and energy regulator publications', note: 'Replace with verified URLs' },
        artefacts: {
          capacity: 'Signed reservation letter or grid contract with MW and voltage',
          firmness: 'Firm/non-firm/curtailment terms spelled out',
          milestones: 'Queue position, energization target, civil works permits',
        },
      },
    });
  }

  console.log('Demo seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
