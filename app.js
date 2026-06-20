const STORAGE_KEY = "medquiz-locker:v1:progress";
const SESSION_KEY = "medquiz-locker:v1:session";

let questions = [];
let progress = loadJson(STORAGE_KEY, {});
let filtered = [];
let currentIndex = 0;
let dataWarnings = [];

const $ = (id) => document.getElementById(id);
const els = {
  subjectFilter: $("subjectFilter"),
  sectionFilter: $("sectionFilter"),
  modeFilter: $("modeFilter"),
  resetSessionBtn: $("resetSessionBtn"),
  statsBox: $("statsBox"),
  quizCard: $("quizCard"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  questionCounter: $("questionCounter"),
  saveStatus: $("saveStatus"),
  exportBtn: $("exportBtn"),
  importInput: $("importInput"),
  clearProgressBtn: $("clearProgressBtn")
};

start();

async function start() {
  bindEvents();
  await loadQuestions();
  setupFilters();
  restoreSession();
  applyFilters();
  updateSaveStatus("Local save is on");
}

async function loadQuestions() {
  try {
    const response = await fetch("data/questions.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rawQuestions = await response.json();
    const normalized = normalizeQuestions(rawQuestions);
    questions = normalized.questions;
    dataWarnings = normalized.warnings;
  } catch (error) {
    console.error(error);
    questions = [];
    dataWarnings = ["data/questions.json could not be loaded or parsed."];
    els.quizCard.innerHTML = `
      <div class="empty">
        Could not load question data.<br>
        Run this app through a local server and check data/questions.json.
      </div>
    `;
  }
}

function bindEvents() {
  els.subjectFilter.addEventListener("change", () => {
    updateSectionOptions();
    currentIndex = 0;
    applyFilters();
  });
  els.sectionFilter.addEventListener("change", () => {
    currentIndex = 0;
    applyFilters();
  });
  els.modeFilter.addEventListener("change", () => {
    currentIndex = 0;
    applyFilters();
  });
  els.resetSessionBtn.addEventListener("click", () => {
    currentIndex = 0;
    render();
    saveSession();
  });
  els.prevBtn.addEventListener("click", () => move(-1));
  els.nextBtn.addEventListener("click", () => move(1));
  els.exportBtn.addEventListener("click", exportProgress);
  els.importInput.addEventListener("change", importProgress);
  els.clearProgressBtn.addEventListener("click", clearProgress);
  window.addEventListener("beforeunload", saveSession);
}

function setupFilters() {
  fillSelect(els.subjectFilter, ["All", ...unique(questions.map((q) => q.subject))]);
  updateSectionOptions();
}

function updateSectionOptions() {
  const subject = els.subjectFilter.value || "All";
  const pool = subject === "All" ? questions : questions.filter((q) => q.subject === subject);
  fillSelect(els.sectionFilter, ["All", ...unique(pool.map((q) => q.section))]);
}

function fillSelect(select, options) {
  const oldValue = select.value;
  select.innerHTML = "";
  options.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
  if (options.includes(oldValue)) select.value = oldValue;
}

function applyFilters() {
  const subject = els.subjectFilter.value || "All";
  const section = els.sectionFilter.value || "All";
  const mode = els.modeFilter.value || "all";

  filtered = questions.filter((question) => {
    const saved = progress[question.id] || {};
    if (subject !== "All" && question.subject !== subject) return false;
    if (section !== "All" && question.section !== section) return false;
    if (mode === "wrong" && !(saved.wrongCount > 0 && saved.lastCorrect !== true)) return false;
    if (mode === "bookmarked" && !saved.bookmarked) return false;
    if (mode === "unseen" && saved.attempts > 0) return false;
    return true;
  });

  if (currentIndex >= filtered.length) currentIndex = Math.max(filtered.length - 1, 0);
  render();
  saveSession();
}

function render() {
  renderStats();
  renderQuestion();
}

function renderStats() {
  const total = questions.length;
  const attempted = questions.filter((q) => (progress[q.id]?.attempts || 0) > 0).length;
  const correct = questions.filter((q) => progress[q.id]?.lastCorrect === true).length;
  const wrong = questions.filter((q) => (progress[q.id]?.wrongCount || 0) > 0 && progress[q.id]?.lastCorrect !== true).length;
  const bookmarked = questions.filter((q) => progress[q.id]?.bookmarked).length;
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;

  const warningLine = dataWarnings.length
    ? statLine("Data warnings", `${dataWarnings.length}`)
    : "";

  els.statsBox.innerHTML = [
    statLine("Total", `${total}`),
    statLine("Solved", `${attempted}`),
    statLine("Correct", `${correct}`),
    statLine("Wrong", `${wrong}`),
    statLine("Bookmarks", `${bookmarked}`),
    statLine("Accuracy", `${accuracy}%`),
    warningLine
  ].join("");
}

function statLine(label, value) {
  return `<div class="stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderQuestion() {
  els.prevBtn.disabled = currentIndex <= 0;
  els.nextBtn.disabled = currentIndex >= filtered.length - 1;
  els.questionCounter.textContent = filtered.length ? `${currentIndex + 1} / ${filtered.length}` : "0 / 0";

  if (!filtered.length) {
    const warningHtml = dataWarnings.length ? dataWarningHtml() : "";
    els.quizCard.innerHTML = `<div class="empty">No questions match the current filters.</div>${warningHtml}`;
    return;
  }

  const question = filtered[currentIndex];
  const saved = progress[question.id] || {};
  const answered = typeof saved.selected === "number";

  els.quizCard.innerHTML = `
    <div class="meta">
      <span class="tag">${escapeHtml(question.subject)}</span>
      <span class="tag">${escapeHtml(question.section)}</span>
      <span class="tag">${escapeHtml(question.id)}</span>
      ${(saved.wrongCount || 0) > 0 ? `<span class="tag">Wrong ${saved.wrongCount}</span>` : ""}
    </div>
    ${question.image ? `<img class="question-image" src="${escapeAttr(question.image)}" alt="Question image" loading="lazy">` : ""}
    <div class="question-title">${escapeHtml(question.question)}</div>
    <div id="choices" class="choices"></div>
    <div class="quiz-actions">
      <button id="bookmarkBtn" class="secondary">${saved.bookmarked ? "Remove bookmark" : "Bookmark"}</button>
      <button id="showAnswerBtn" class="ghost">Show answer</button>
      <button id="retryBtn" class="ghost">Clear this record</button>
    </div>
    <div id="feedback" class="feedback ${answered ? (saved.lastCorrect ? "good" : "bad") : ""}" style="display:${answered ? "block" : "none"}">
      ${answered ? feedbackHtml(question, saved) : ""}
    </div>
  `;

  const choicesBox = $("choices");
  question.choices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.type = "button";
    button.textContent = `${index + 1}. ${choice}`;

    if (answered) {
      if (index === question.answerIndex) button.classList.add("correct");
      if (index === saved.selected && index !== question.answerIndex) button.classList.add("incorrect");
      if (index === saved.selected) button.classList.add("selected");
    }

    button.addEventListener("click", () => answerQuestion(question, index));
    choicesBox.appendChild(button);
  });

  $("bookmarkBtn").addEventListener("click", () => toggleBookmark(question.id));
  $("showAnswerBtn").addEventListener("click", () => revealAnswer(question));
  $("retryBtn").addEventListener("click", () => resetOne(question.id));
}

function answerQuestion(question, selectedIndex) {
  const old = progress[question.id] || {};
  const correct = selectedIndex === question.answerIndex;
  progress[question.id] = {
    ...old,
    selected: selectedIndex,
    lastCorrect: correct,
    attempts: (old.attempts || 0) + 1,
    wrongCount: (old.wrongCount || 0) + (correct ? 0 : 1),
    lastSolvedAt: new Date().toISOString()
  };
  persistProgress();
  render();
}

function revealAnswer(question) {
  const old = progress[question.id] || {};
  progress[question.id] = {
    ...old,
    selected: old.selected ?? -1,
    lastCorrect: old.selected === question.answerIndex,
    attempts: old.attempts || 0,
    revealed: true,
    lastSolvedAt: new Date().toISOString()
  };
  persistProgress();
  render();
}

function feedbackHtml(question, saved) {
  const selectedText = saved.selected >= 0 ? `Choice ${saved.selected + 1}` : "Answer revealed";
  const answerText = `Choice ${question.answer} - ${question.choices[question.answerIndex]}`;
  const result = saved.lastCorrect ? "Correct" : "Wrong";

  return `
    <h3>${result}</h3>
    <p class="muted">Selected: ${escapeHtml(selectedText)} / Answer: ${escapeHtml(answerText)}</p>
    <div class="explanation">${escapeHtml(question.explanation || "No explanation yet.")}</div>
  `;
}

function toggleBookmark(id) {
  const old = progress[id] || {};
  progress[id] = {
    ...old,
    bookmarked: !old.bookmarked,
    lastSolvedAt: new Date().toISOString()
  };
  persistProgress();
  render();
}

function resetOne(id) {
  if (!confirm("Clear only this question record?")) return;
  const bookmarked = progress[id]?.bookmarked;
  if (bookmarked) progress[id] = { bookmarked };
  else delete progress[id];
  persistProgress();
  render();
}

function move(delta) {
  currentIndex = Math.min(Math.max(currentIndex + delta, 0), filtered.length - 1);
  render();
  saveSession();
}

function persistProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  updateSaveStatus("Saved locally");
  saveSession();
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    subject: els.subjectFilter.value || "All",
    section: els.sectionFilter.value || "All",
    mode: els.modeFilter.value || "all",
    currentIndex,
    updatedAt: new Date().toISOString()
  }));
}

function restoreSession() {
  const session = loadJson(SESSION_KEY, {});
  if (session.subject) els.subjectFilter.value = session.subject;
  updateSectionOptions();
  if (session.section) els.sectionFilter.value = session.section;
  if (session.mode) els.modeFilter.value = session.mode;
  currentIndex = session.currentIndex || 0;
}

function exportProgress() {
  const payload = {
    app: "medquiz-locker",
    exportedAt: new Date().toISOString(),
    progress
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `medquiz-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProgress(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const json = JSON.parse(await file.text());
    progress = { ...progress, ...(json.progress || json) };
    persistProgress();
    applyFilters();
    alert("Records imported.");
  } catch (error) {
    alert("Could not read this JSON file.");
  } finally {
    event.target.value = "";
  }
}

function clearProgress() {
  if (!confirm("Clear all saved quiz records?")) return;
  progress = {};
  persistProgress();
  applyFilters();
}

function normalizeQuestions(rawQuestions) {
  const warnings = [];
  if (!Array.isArray(rawQuestions)) {
    return {
      questions: [],
      warnings: ["questions.json must contain an array of question objects."]
    };
  }

  const idCounts = new Map();
  const questions = rawQuestions
    .map((raw, index) => normalizeQuestion(raw, index, idCounts, warnings))
    .filter(Boolean);

  return { questions, warnings };
}

function normalizeQuestion(raw, index, idCounts, warnings) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push(`Question ${index + 1} is not an object.`);
    return null;
  }

  const subject = cleanText(raw.subject);
  const section = cleanText(raw.section);
  const question = cleanText(raw.question);
  const explanation = cleanText(raw.explanation);
  const image = cleanText(raw.image);
  const choices = Array.isArray(raw.choices)
    ? raw.choices.map(cleanText).filter(Boolean)
    : [];

  if (!subject) warnings.push(`Question ${index + 1} is missing subject.`);
  if (!section) warnings.push(`Question ${index + 1} is missing section.`);
  if (!question) warnings.push(`Question ${index + 1} is missing question text.`);
  if (choices.length < 2) warnings.push(`Question ${index + 1} needs at least 2 choices.`);

  const answer = normalizeAnswer(raw.answer, raw.answerIndex, choices);
  if (!answer) warnings.push(`Question ${index + 1} has an invalid answer.`);

  if (!subject || !section || !question || choices.length < 2 || !answer) {
    return null;
  }

  const id = stableQuestionId(raw.id, subject, section, index, idCounts, warnings);

  return {
    id,
    subject,
    section,
    question,
    choices,
    answer,
    answerIndex: answer - 1,
    explanation: explanation || "No explanation yet.",
    image
  };
}

function normalizeAnswer(answer, answerIndex, choices) {
  const byAnswer = Number(answer);
  const byLegacyIndex = Number(answerIndex);
  const value = Number.isInteger(byAnswer) ? byAnswer : byLegacyIndex + 1;
  if (!Number.isInteger(value) || value < 1 || value > choices.length) return null;
  return value;
}

function stableQuestionId(rawId, subject, section, index, idCounts, warnings) {
  const base = `${slugify(subject)}_${slugify(section)}`;
  const fallbackNumber = String(index + 1).padStart(3, "0");
  const proposed = cleanText(rawId);
  let id = /^[a-z0-9]+(?:_[a-z0-9]+)*$/i.test(proposed) ? proposed : `${base}_${fallbackNumber}`;

  const count = idCounts.get(id) || 0;
  idCounts.set(id, count + 1);
  if (count > 0) {
    id = `${base}_${String(index + 1).padStart(3, "0")}`;
    warnings.push(`Question ${index + 1} had a duplicate id, so it was normalized to ${id}.`);
  }

  return id;
}

function dataWarningHtml() {
  const items = dataWarnings
    .slice(0, 5)
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  const more = dataWarnings.length > 5 ? `<li>${dataWarnings.length - 5} more warnings in the browser console.</li>` : "";
  console.warn("Question data warnings:", dataWarnings);
  return `
    <div class="feedback bad">
      <h3>Question data needs attention</h3>
      <ul class="warning-list">${items}${more}</ul>
    </div>
  `;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "unknown";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function updateSaveStatus(text) {
  els.saveStatus.textContent = text;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}
