import { defineConfig } from "drizzle-kit";

// pnpm db:generate turns changes to the schema into a new SQL migration.
// The API applies pending migrations itself at start.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/database/schema/index.ts",
  out: "./src/lib/database/migrations",
});
