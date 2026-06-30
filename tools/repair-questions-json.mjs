import fs from 'node:fs';
import path from 'node:path';

const target = path.join(process.cwd(), 'data', 'questions.json');
const backupDir = path.join(process.cwd(), 'data', 'backups');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function escapeRawNewlinesInsideStrings(text) {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (inString && ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      out += ch;
      inString = !inString;
      continue;
    }

    if (inString && ch === '\r') {
      out += '\\n';
      if (text[i + 1] === '\n') i += 1;
      continue;
    }

    if (inString && ch === '\n') {
      out += '\\n';
      continue;
    }

    if (inString && ch === '\t') {
      out += '\\t';
      continue;
    }

    out += ch;
  }

  return out;
}

if (!fs.existsSync(target)) {
  throw new Error(`Missing ${target}`);
}

const original = fs.readFileSync(target, 'utf8');
let parsed;
let repairedText = original;

try {
  parsed = JSON.parse(original);
  console.log('questions.json is already valid JSON. Reformatting only.');
} catch (firstError) {
  console.log('questions.json is invalid JSON. Attempting newline repair...');
  repairedText = escapeRawNewlinesInsideStrings(original);
  try {
    parsed = JSON.parse(repairedText);
  } catch (secondError) {
    console.error('Original parse error:', firstError.message);
    console.error('Repair parse error:', secondError.message);
    throw secondError;
  }
}

if (!Array.isArray(parsed)) {
  throw new Error('questions.json parsed, but it is not an array. Aborting.');
}

fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `questions-before-repair-${timestamp()}.json`);
fs.writeFileSync(backupPath, original, 'utf8');

const clean = `${JSON.stringify(parsed, null, 2)}\n`;
fs.writeFileSync(target, clean, 'utf8');
console.log(`Repaired questions.json with ${parsed.length} questions.`);
console.log(`Backup saved to ${backupPath}`);
