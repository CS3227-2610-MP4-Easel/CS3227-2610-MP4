import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Client generation must work in credential-free preview builds; runtime clients still require DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/agile_platform",
  },
});
