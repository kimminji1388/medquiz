import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function clean(value) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function hash(value, length = 8) {
  return crypto.createHash("sha1").update(clean(value)).digest("hex").slice(0, length);
}

function decodeHtml(value = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, entity) => {
      if (entity.startsWith("#")) {
        const hexadecimal = entity[1].toLowerCase() === "x";
        return String.fromCodePoint(parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
      }
      return named[entity.toLowerCase()] ?? `&${entity};`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function attribute(source, name) {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(source);
  return match ? decodeHtml(match[1]) : "";
}

function extractLiteral(source, variable) {
  const match = new RegExp(`(?:const|let|var)\\s+${variable}\\s*=\\s*`).exec(source);
  if (!match) return null;
  const start = match.index + match[0].length;
  const opener = source[start];
  const closer = opener === "[" ? "]" : opener === "{" ? "}" : "";
  if (!closer) return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === opener) depth += 1;
    else if (character === closer && --depth === 0) return JSON.parse(source.slice(start, index + 1));
  }
  throw new Error(`Incomplete ${variable} data.`);
}

function answerValue(value, zeroBased = false) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [...new Set(values.map(Number).filter(Number.isInteger).map((number) => number + (zeroBased ? 1 : 0)))]
    .sort((left, right) => left - right);
  return normalized.length === 1 ? normalized[0] : normalized;
}

function examRank(value, type) {
  const label = clean(value).normalize("NFC");
  if (type === "physiology" && /^TalkFile_23(?!\d)/i.test(label)) return 300;
  const year = Number(label.match(/(?:20)?(19|20|21|22|23|24|25|26)/)?.[1]);
  if (!year) return 0;
  const isRetest = /재시|재-|23r|r-/i.test(label);
  return year * 10 + (isRetest ? 1 : 0);
}

function sectionCode(section) {
  const number = clean(section).match(/^(\d+)/)?.[1];
  return number ? number.padStart(2, "0") : slug(section) || hash(section);
}

function sourceCode(sourceId, fallback) {
  return slug(sourceId) || String(fallback).padStart(3, "0");
}

function uniqueId(proposed, seen) {
  let candidate = proposed;
  let suffix = 2;
  while (seen.has(candidate)) candidate = `${proposed}_${suffix++}`;
  seen.add(candidate);
  return candidate;
}

function takePriorId(context, section, sourceId, questionText, anatomy = false) {
  const textKey = clean(questionText);
  const byText = context.oldByText.get(textKey) || [];
  const textMatch = byText.find((id) => !context.usedOldIds.has(id));
  if (textMatch) {
    context.usedOldIds.add(textMatch);
    return textMatch;
  }

  const source = sourceCode(sourceId, 0);
  const lookupKey = anatomy ? source : `${sectionCode(section)}|${source}`;
  const bySource = context.oldBySource.get(lookupKey) || [];
  const sourceMatch = bySource.find((id) => !context.usedOldIds.has(id));
  if (sourceMatch) {
    context.usedOldIds.add(sourceMatch);
    return sourceMatch;
  }
  return "";
}

function imageExtension(dataUrl) {
  const type = /^data:image\/([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase();
  if (type === "jpeg" || type === "jpg") return ".jpg";
  if (type === "webp") return ".webp";
  if (type === "gif") return ".gif";
  return ".png";
}

async function saveImage(dataUrl, id, imageDir) {
  if (!clean(dataUrl).startsWith("data:image/")) return "";
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return "";
  const filename = `${id}${imageExtension(dataUrl)}`;
  await fs.writeFile(path.join(imageDir, filename), Buffer.from(dataUrl.slice(comma + 1), "base64"));
  return `assets/images/${filename}`;
}

function validQuestion(question) {
  const answers = Array.isArray(question.answer) ? question.answer : [question.answer];
  return question.id && question.subject && question.section && question.question &&
    Array.isArray(question.choices) && question.choices.length >= 2 && answers.length &&
    answers.every((answer) => Number.isInteger(answer) && answer >= 1 && answer <= question.choices.length);
}

function anatomySection(raw, histology) {
  if (histology) return "Histology";
  if (/^01/.test(raw)) return "Lower Limb";
  if (/^02/.test(raw)) return "Thorax Abdomen Pelvis";
  if (/^03/.test(raw)) return "Head Neck";
  return clean(raw) || "General";
}

function detectParser(html) {
  if (/<div class="card"[^>]+data-answer=/i.test(html) && extractLiteral(html, "IMG_MAP")) return "anatomy";
  const data = extractLiteral(html, "DATA");
  if (Array.isArray(data) && data[0]?.imageData !== undefined) return "microbiology";
  const questions = extractLiteral(html, "QUESTIONS");
  const first = questions?.[0];
  if (!first) throw new Error("No supported question array was found.");
  if (first.source_short !== undefined && Array.isArray(first.options) && typeof first.options[0] === "object") return "previous";
  if (first.sec !== undefined && first.src !== undefined) return "pathology";
  if (first.q !== undefined && first.opts !== undefined && first.file !== undefined) return "physiology";
  if (first.question !== undefined && first.source !== undefined) return "biochemistry";
  if (first.stem !== undefined && first.options !== undefined && first.explanation !== undefined) return "pharmacology";
  throw new Error("This HTML question format is not supported yet.");
}

const PARSER_INFO = {
  anatomy: { code: "anatomy", subject: "Anatomy" },
  biochemistry: { code: "biochemistry", subject: "Biochemistry & Genetics" },
  physiology: { code: "physiology", subject: "Physiology" },
  pathology: { code: "pathology", subject: "Pathology" },
  microbiology: { code: "microbiology_parasitology", subject: "Microbiology & Parasitology" },
  previous: { code: "anatomy_histology_previous", subject: "Anatomy & Histology Previous Exams" },
  pharmacology: { code: "pharmacology", subject: "Pharmacology" }
};

function arrayConfig(type, html) {
  if (type === "microbiology") {
    return {
      source: extractLiteral(html, "DATA"), sourceId: (q) => q.id, section: (q) => q.section,
      question: (q) => q.stem, choices: (q) => q.options || [], answer: (q) => q.answer,
      explanation: (q) => q.explanation, image: (q) => q.imageData || "",
      examSource: (q) => q.id, zeroBased: true
    };
  }
  const source = extractLiteral(html, "QUESTIONS");
  if (type === "biochemistry") return {
    source, sourceId: (q) => q.id, section: (q) => q.section, question: (q) => q.question,
    choices: (q) => q.options || [], answer: (q) => q.answer, explanation: (q) => q.explanation,
    image: (q) => q.image || "", examSource: (q) => q.source, zeroBased: false
  };
  if (type === "physiology") return {
    source, sourceId: (q) => q.id, section: (q) => q.section, question: (q) => q.q,
    choices: (q) => q.opts || [], answer: (q) => q.ans, explanation: (q) => q.exp,
    image: (q) => q.image || "", examSource: (q) => q.file, zeroBased: true
  };
  if (type === "pathology") {
    const images = extractLiteral(html, "IMG") || {};
    return {
      source, sourceId: (q) => q.num, section: (q) => q.sec, question: (q) => q.q,
      choices: (q) => q.opts || [], answer: (q) => q.ans, explanation: (q) => q.expl,
      image: (q) => images[q.num] || "", examSource: (q) => q.num, zeroBased: true
    };
  }
  if (type === "previous") return {
    source, sourceId: (q) => q.id, section: (q) => `인구기 ${q.source_short || q.file_display || q.file}`,
    sections: (q) => [q.section, `인구기 ${q.source_short || q.file_display || q.file}`],
    question: (q) => q.stem,
    choices: (q) => (q.options || []).map((choice) => choice.text), answer: (q) => q.answer,
    explanation: (q) => q.explain, image: (q) => q.image || "", zeroBased: false
  };
  return {
    source, sourceId: (q) => q.id, section: (q) => q.section, question: (q) => q.stem,
    choices: (q) => q.options || [], answer: (q) => q.answer, explanation: (q) => q.explanation,
    image: (q) => q.image || "", examSource: (q) => q.id, zeroBased: true
  };
}

async function parseArray(type, html, context) {
  const config = arrayConfig(type, html);
  const info = PARSER_INFO[type];
  const questions = [];
  for (let index = 0; index < config.source.length; index += 1) {
    const source = config.source[index];
    const sourceId = clean(config.sourceId(source)) || String(index + 1);
    const section = clean(config.section(source)) || "General";
    const questionText = clean(config.question(source)).replace(/^\d+\.\s*/, "");
    const priorId = takePriorId(context, section, sourceId, questionText);
    const id = uniqueId(
      priorId || `${info.code}_${sectionCode(section)}_${sourceCode(sourceId, index + 1)}`,
      context.seen
    );
    const question = {
      id, setId: context.setId, sourceId, subject: info.subject, section,
      sections: config.sections ? config.sections(source).map(clean).filter(Boolean) : [section],
      question: questionText,
      choices: config.choices(source).map(clean).filter(Boolean),
      answer: answerValue(config.answer(source), config.zeroBased),
      examSource: config.examSource ? clean(config.examSource(source)) : "",
      examRank: config.examSource ? examRank(config.examSource(source), type) : 0,
      explanation: clean(config.explanation(source)),
      image: await saveImage(config.image(source), id, context.imageDir)
    };
    if (!validQuestion(question)) throw new Error(`Invalid question ${sourceId} in ${context.filename}.`);
    questions.push(question);
  }
  return type === "previous"
    ? questions
    : questions.sort((left, right) => right.examRank - left.examRank);
}

async function parseAnatomy(html, context) {
  const imageMap = extractLiteral(html, "IMG_MAP") || {};
  const cards = [...html.matchAll(/<div class="card"(?<attrs>[^>]*)>(?<body>[\s\S]*?)(?=<div class="card"|<\/section>)/g)];
  const questions = [];
  for (let index = 0; index < cards.length; index += 1) {
    const attrs = cards[index].groups.attrs;
    const body = cards[index].groups.body;
    const sourceId = attribute(attrs, "data-id") || String(index + 1);
    const rawSection = attribute(attrs, "data-big");
    const section = anatomySection(rawSection, attribute(attrs, "data-histo") === "1");
    const questionText = decodeHtml(/<div class="stem">(?<text>[\s\S]*?)<\/div>/.exec(body)?.groups.text);
    const priorId = takePriorId(context, section, sourceId, questionText, true);
    const id = uniqueId(priorId || `anatomy_${sectionCode(rawSection)}_${sourceCode(sourceId, index + 1)}`, context.seen);
    const imageKey = /<img[^>]+class="qimg"[^>]+data-img="(?<key>[^"]+)"/i.exec(body)?.groups.key;
    const answerBox = /<div class="answer-box">(?<text>[\s\S]*)$/.exec(body)?.groups.text || "";
    const question = {
      id, setId: context.setId, sourceId, subject: "Anatomy", section,
      sections: [section],
      question: questionText,
      choices: [...body.matchAll(/<button class="choice"[^>]*data-choice="\d+"[^>]*>(?<text>[\s\S]*?)<\/button>/g)]
        .map((match) => decodeHtml(match.groups.text).replace(/^\d+\)\s*/, "")),
      answer: Number(attribute(attrs, "data-answer")),
      examSource: sourceId,
      examRank: examRank(sourceId, "anatomy"),
      explanation: decodeHtml(answerBox.replace(/<details[\s\S]*?<\/details>/gi, "")),
      image: imageKey ? await saveImage(imageMap[decodeHtml(imageKey)] || "", id, context.imageDir) : ""
    };
    if (!validQuestion(question)) throw new Error(`Invalid anatomy question ${sourceId}.`);
    questions.push(question);
  }
  if (!questions.length) throw new Error("No anatomy cards were found.");
  return questions.sort((left, right) => right.examRank - left.examRank);
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function removeOldImages(questions, root) {
  for (const question of questions) {
    if (!question.image?.startsWith("assets/images/")) continue;
    await fs.rm(path.join(root, ...question.image.split("/")), { force: true });
  }
}

export async function importIncoming({ root, now = new Date() }) {
  const dataDir = path.join(root, "data");
  const incomingDir = path.join(root, "incoming");
  const archiveDir = path.join(root, "archive", "html");
  const imageDir = path.join(root, "assets", "images");
  await Promise.all([dataDir, incomingDir, archiveDir, imageDir].map((directory) => fs.mkdir(directory, { recursive: true })));

  let questions = await readJson(path.join(dataDir, "questions.json"), []);
  let sets = await readJson(path.join(dataDir, "question-sets.json"), []);
  const filenames = (await fs.readdir(incomingDir)).filter((filename) => filename.toLowerCase().endsWith(".html")).sort();
  if (!filenames.length) return { processed: [], totalQuestions: questions.length, message: "No HTML files in incoming." };

  const processed = [];
  for (const filename of filenames) {
    const html = await fs.readFile(path.join(incomingDir, filename), "utf8");
    const type = detectParser(html);
    const info = PARSER_INFO[type];
    const existingSet = sets.find((set) => set.sourceFile === filename);
    const setId = existingSet?.id || `${info.code}_${hash(filename.toLowerCase())}`;
    const oldQuestions = questions.filter((question) => question.setId === setId);
    const oldByText = new Map();
    const oldBySource = new Map();
    for (let index = 0; index < oldQuestions.length; index += 1) {
      const question = oldQuestions[index];
      const textKey = clean(question.question);
      const source = sourceCode(question.sourceId || question.id, index + 1);
      const sourceKey = type === "anatomy" ? source : `${sectionCode(question.section)}|${source}`;
      oldByText.set(textKey, [...(oldByText.get(textKey) || []), question.id]);
      oldBySource.set(sourceKey, [...(oldBySource.get(sourceKey) || []), question.id]);
    }
    const seen = new Set(questions.filter((question) => question.setId !== setId).map((question) => question.id));
    await removeOldImages(oldQuestions, root);
    const context = { setId, oldByText, oldBySource, usedOldIds: new Set(), seen, imageDir, filename };
    const converted = type === "anatomy"
      ? await parseAnatomy(html, context)
      : await parseArray(type, html, context);
    questions = [...questions.filter((question) => question.setId !== setId), ...converted];
    const metadata = {
      id: setId,
      name: path.basename(filename, path.extname(filename)),
      subject: info.subject,
      active: existingSet?.active ?? true,
      sourceFile: filename,
      questionCount: converted.length,
      updatedAt: now.toISOString()
    };
    sets = [...sets.filter((set) => set.id !== setId), metadata].sort((left, right) => left.name.localeCompare(right.name));
    const archiveName = `${now.toISOString().replace(/\D/g, "").slice(0, 14)}-${filename}`;
    await fs.rename(path.join(incomingDir, filename), path.join(archiveDir, archiveName));
    processed.push({ filename, setId, subject: info.subject, questions: converted.length });
  }

  await fs.writeFile(path.join(dataDir, "questions.json"), `${JSON.stringify(questions, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(dataDir, "question-sets.json"), `${JSON.stringify(sets, null, 2)}\n`, "utf8");
  const report = { processed, totalQuestions: questions.length, totalSets: sets.length, completedAt: now.toISOString() };
  await fs.writeFile(path.join(dataDir, "last-import-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}
