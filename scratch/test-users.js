import { prisma } from "../lib/prisma-client.js";

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in Database:");
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
