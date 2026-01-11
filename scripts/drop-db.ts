import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function dropDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Please provide a connection string.',
    );
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🧨 Dropping public schema (cascade)...');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');

    console.log('🛠️ Recreating public schema...');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    await pool.query('GRANT ALL ON SCHEMA public TO postgres');

    console.log('✅ Database schema reset complete.');
  } catch (error) {
    console.error('❌ Failed to drop database schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

dropDatabase();
