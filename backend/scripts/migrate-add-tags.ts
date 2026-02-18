/**
 * One-time migration: assign random 4-digit tags to users with tag='0000'.
 * Run from backend dir: npx ts-node scripts/migrate-add-tags.ts
 * Requires DB connection (same .env as backend).
 */
import { config } from 'dotenv';
import { Pool } from 'pg';

config({ path: '.env' });

function randomTag(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'chatdb',
  });

  const res = await pool.query(
    "SELECT id, username FROM users WHERE tag = '0000' OR tag IS NULL",
  );

  if (res.rows.length === 0) {
    console.log('No users to migrate.');
    await pool.end();
    return;
  }

  const used = new Set<string>();
  for (const row of res.rows) {
    const { id, username } = row;
    let tag: string;
    let attempts = 0;
    do {
      tag = randomTag();
      const key = `${String(username).toLowerCase()}#${tag}`;
      if (used.has(key)) {
        attempts++;
        if (attempts > 20) throw new Error(`Could not assign unique tag for ${username}`);
      } else {
        used.add(key);
        break;
      }
    } while (true);

    await pool.query('UPDATE users SET tag = $1 WHERE id = $2', [tag, id]);
    console.log(`Updated ${username} -> #${tag}`);
  }

  console.log(`Migrated ${res.rows.length} user(s).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
