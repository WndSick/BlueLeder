import { Client } from "pg";

async function run() {
  const connectionString = "postgresql://postgres:postgres@localhost:5433/blueledger?schema=public";
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log("Querying active database backends...");
    const res = await client.query(`
      SELECT pid, state, query, age(clock_timestamp(), query_start) 
      FROM pg_stat_activity 
      WHERE datname = 'blueledger' AND pid <> pg_backend_pid();
    `);
    console.log("Active Backends:", res.rows);

    console.log("Checking for locks...");
    const locks = await client.query(`
      SELECT t.relname AS relation_name, l.mode, l.granted, l.pid, a.query
      FROM pg_locks l
      JOIN pg_class t ON l.relation = t.oid
      JOIN pg_stat_activity a ON l.pid = a.pid
      WHERE relname NOT LIKE 'pg_%';
    `);
    console.log("Locks:", locks.rows);

  } catch (err) {
    console.error("Diagnostic query failed:", err);
  } finally {
    await client.end();
  }
}

run();
