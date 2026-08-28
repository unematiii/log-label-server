import { allowedEmails } from '../schema.js';
import { closeDatabase, db, migrateDatabase } from '../index.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: npm run whitelist -- user@example.com');
  process.exitCode = 1;
} else {
  try {
    await migrateDatabase();
    await db.insert(allowedEmails).values({ email }).onConflictDoNothing();
    console.log(`Allowed email: ${email}`);
  } finally {
    await closeDatabase();
  }
}
