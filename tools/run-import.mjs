import path from "node:path";
import { fileURLToPath } from "node:url";
import { importIncoming } from "./import-quiz.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  const report = await importIncoming({ root });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
