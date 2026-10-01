import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { createDb } from "../lib";
import { createAuthService, createTokenManager } from "../services";

/**
 * Users are made here, not in the app: there is no sign-up page.
 *
 *   pnpm user:create <username>      # asks for the password
 *   pnpm user:password <username>    # sets a new one, ending every session
 *
 * On the Pi: docker compose exec -it api node_modules/.bin/tsx src/cli/users.ts create <username>
 * The password can also come from GYMLOG_PASSWORD, for scripts.
 */
async function main(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // No .env: the environment is enough.
  }
  const [command, username] = process.argv.slice(2);
  if ((command !== "create" && command !== "password") || username === undefined || username.trim() === "") {
    console.error("Usage: users.ts create|password <username>");
    process.exitCode = 2;
    return;
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const password = process.env.GYMLOG_PASSWORD ?? (await ask(`Password for ${username}: `));
  const db = createDb(url);
  try {
    // Tokens are not issued here: any secret will do.
    const auth = createAuthService(db, createTokenManager(new Uint8Array(32)));
    if (command === "create") {
      const user = await auth.createUser(username.trim(), password);
      console.log(`Created ${user.username} (id ${user.id}).`);
    } else {
      await auth.setPassword(username.trim(), password);
      console.log(`Password changed for ${username.trim()}; every session ended.`);
    }
  } finally {
    await db.$client.end();
  }
}

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
