import { PrismaClient } from "@prisma/client";

// A single shared Prisma instance across the app
// (prevents exhausting the database connection pool in development).
export const prisma = new PrismaClient();
