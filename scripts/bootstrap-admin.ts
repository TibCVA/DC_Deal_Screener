import { createBootstrapAdmin, hasUsers } from '../lib/bootstrap';
import { prisma } from '../lib/prisma';

async function run() {
  if (await hasUsers()) {
    console.log('Users already exist. Bootstrap admin skipped.');
    return;
  }

  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;
  const orgName = process.env.BOOTSTRAP_ORG_NAME;

  if (!email || !password || !orgName) {
    throw new Error('Missing BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, or BOOTSTRAP_ORG_NAME.');
  }

  await createBootstrapAdmin({ email, password, orgName });

  console.log(`Bootstrap admin created for org ${orgName} with email ${email}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
