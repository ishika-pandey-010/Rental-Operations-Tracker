// Load .env.local (written by `make env`) so API tests find the local stack.
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
