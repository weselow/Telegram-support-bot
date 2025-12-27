import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

// Test database URL - uses same PostgreSQL but different database
const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://postgres:postgres@localhost:5433/support_bot_test';

const adapter = new PrismaPg({
  connectionString: TEST_DATABASE_URL,
});

export const testPrisma = new PrismaClient({ adapter });

export async function connectTestDatabase(): Promise<void> {
  await testPrisma.$connect();
}

export async function disconnectTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
}

export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign keys
  await testPrisma.messageMap.deleteMany();
  await testPrisma.ticketEvent.deleteMany();
  await testPrisma.user.deleteMany();
}
