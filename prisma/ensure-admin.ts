import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: "admin@sechub.local" },
  });

  if (existing) {
    console.log("Super admin already exists: admin@sechub.local");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.create({
    data: {
      email: "admin@sechub.local",
      name: "Super Admin",
      passwordHash,
      role: Role.SuperAdmin,
    },
  });

  console.log("Super admin created:");
  console.log("  Email:    admin@sechub.local");
  console.log("  Password: admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
