import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string from previous context (Local DB)
const connectionString = 'postgresql://postgres:postgres@localhost:5432/control_creditos';

const client = new Client({
    connectionString,
});

async function runMigration() {
    try {
        await client.connect();
        console.log('Connected to database.');

        const migrationPath = path.resolve(__dirname, '../../database/migrations/140_overdue_and_refinance_logic.sql');
        console.log(`Reading migration file: ${migrationPath}`);

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Executing migration...');
        await client.query(sql);

        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
