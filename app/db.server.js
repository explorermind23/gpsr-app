import { PrismaClient } from "@prisma/client";
const g = globalThis;
if (!g.__prisma) g.__prisma = new PrismaClient();
const prisma = g.__prisma;
export default prisma;
