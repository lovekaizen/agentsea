import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || '.agentsea/admin.db';

async function runMigrations() {
  try {
    // Ensure directory exists
    await mkdir(dirname(DATABASE_PATH), { recursive: true });

    const sqlite = new Database(DATABASE_PATH);
    sqlite.pragma('journal_mode = WAL');

    const db = drizzle(sqlite);

    console.log('Running migrations...');
    migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully!');

    sqlite.close();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
