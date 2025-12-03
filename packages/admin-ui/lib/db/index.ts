import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH || '.agentsea/admin.db';

// Ensure directory exists
async function ensureDbDirectory() {
  try {
    await mkdir(dirname(DATABASE_PATH), { recursive: true });
  } catch (error) {
    // Directory already exists or other error - ignore
  }
}

// Initialize database
let dbInstance: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!dbInstance) {
    await ensureDbDirectory();
    const sqlite = new Database(DATABASE_PATH);
    sqlite.pragma('journal_mode = WAL');
    dbInstance = drizzle(sqlite, { schema });
  }
  return dbInstance;
}

// Export schema
export * from './schema';
