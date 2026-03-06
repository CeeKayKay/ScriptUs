const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const p = new PrismaClient();

(async () => {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log("Usage: node scripts/set-password.js <email> <password>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await p.user.update({
    where: { email },
    data: { password: hash },
  });

  console.log(`Password set for ${user.email} (${user.name})`);
  await p.$disconnect();
})();
