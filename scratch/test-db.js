import { PrismaClient } from "@prisma/client";

const passwords = [
  "postgres",
  "admin",
  "root",
  "password",
  "123456",
  "1234",
  "anish",
  ""
];

async function testConnection(password) {
  const url = `postgresql://postgres:${password}@localhost:5432/blueledger?schema=public`;
  console.log(`Testing password: "${password}"...`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    },
    log: []
  });

  try {
    await prisma.$connect();
    console.log(`\n🎉 SUCCESS! Working connection string:\n${url}\n`);
    await prisma.$disconnect();
    return true;
  } catch (error) {
    const errorStr = error.message || String(error);
    if (error.code === "P1000" || errorStr.includes("Authentication failed")) {
      // Auth failed, try next
      return false;
    }
    console.log(`Credentials valid but database error: ${error.code} - ${errorStr}`);
    return url;
  }
}

async function main() {
  for (const pw of passwords) {
    const result = await testConnection(pw);
    if (result) {
      process.exit(0);
    }
  }
  console.log("❌ Could not connect with any common password.");
  process.exit(1);
}

main();
