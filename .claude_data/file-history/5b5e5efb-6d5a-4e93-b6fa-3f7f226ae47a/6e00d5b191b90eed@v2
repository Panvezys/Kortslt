// One-off migration: convert coaches.price_per_hour from numeric(10,2) euros
// to integer cents, and add isAcceptingStudents + experienceYears columns.
//
// Idempotent: rerunning is safe. Each step inspects information_schema before
// applying a change so a partial earlier run won't break a retry.
//
// Run with: cd lib/db && node migrate-coach-cents.mjs

import pg from "pg";

const { Client } = pg;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function columnInfo(column) {
  const { rows } = await db.query(
    `SELECT data_type, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'coaches' AND column_name = $1`,
    [column],
  );
  return rows[0] ?? null;
}

try {
  await db.query("BEGIN");

  // 1. price_per_hour: numeric → integer cents (multiply by 100, round).
  const priceCol = await columnInfo("price_per_hour");
  if (!priceCol) {
    console.error("coaches.price_per_hour not found — nothing to migrate");
  } else if (priceCol.data_type === "integer") {
    console.log("✓ price_per_hour already integer — skipping conversion");
  } else {
    console.log(`Converting price_per_hour from ${priceCol.data_type} → integer cents`);
    await db.query(`
      ALTER TABLE coaches
        ALTER COLUMN price_per_hour TYPE integer
        USING ROUND(COALESCE(price_per_hour, 0) * 100)::integer
    `);
    console.log("✓ price_per_hour converted");
  }

  // 2. is_accepting_students: add with default true.
  const acceptCol = await columnInfo("is_accepting_students");
  if (acceptCol) {
    console.log("✓ is_accepting_students already exists — skipping");
  } else {
    await db.query(`
      ALTER TABLE coaches
        ADD COLUMN is_accepting_students boolean NOT NULL DEFAULT true
    `);
    console.log("✓ is_accepting_students added");
  }

  // 3. experience_years: nullable integer.
  const expCol = await columnInfo("experience_years");
  if (expCol) {
    console.log("✓ experience_years already exists — skipping");
  } else {
    await db.query(`
      ALTER TABLE coaches
        ADD COLUMN experience_years integer
    `);
    console.log("✓ experience_years added");
  }

  await db.query("COMMIT");
  console.log("Migration complete.");
} catch (err) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Migration failed, rolled back:", err);
  process.exit(1);
} finally {
  await db.end();
}
