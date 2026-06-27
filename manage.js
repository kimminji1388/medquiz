const setList = document.getElementById("setList");
const managerStats = document.getElementById("managerStats");
const managerStatus = document.getElementById("managerStatus");
const showAllBtn = document.getElementById("showAllBtn");
const downloadSetsBtn = document.getElementById("downloadSetsBtn");

let questionSets = [];

start();

async function start() {
  try {
    const response = await fetch("data/question-sets.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("question-sets.json must contain an array.");
    questionSets = data.map(normalizeSet).filter(Boolean);
    render();
  } catch (error) {
    console.error(error);
    managerStats.textContent = "Could not load question sets.";
    setList.innerHTML = '<div class="empty">Check data/question-sets.json.</div>';
  }
}

function normalizeSet(raw) {
  if (!raw || typeof raw !== "object" || !raw.id || !raw.name) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    subject: String(raw.subject || "Uncategorized"),
    active: raw.active !== false,
    sourceFile: String(raw.sourceFile || ""),
    questionCount: Number(raw.questionCount) || 0,
    updatedAt: String(raw.updatedAt || "")
  };
}

function render() {
  const active = questionSets.filter((set) => set.active).length;
  const activeQuestions = questionSets
    .filter((set) => set.active)
    .reduce((total, set) => total + set.questionCount, 0);
  managerStats.textContent = `${active} of ${questionSets.length} sets visible · ${activeQuestions} active questions`;

  setList.innerHTML = questionSets.map((set) => `
    <label class="set-row">
      <span class="set-copy">
        <strong>${escapeHtml(set.name)}</strong>
        <span>${escapeHtml(set.subject)} · ${set.questionCount} questions</span>
        <small>${escapeHtml(set.sourceFile)}</small>
      </span>
      <span class="set-toggle">
        <input type="checkbox" data-set-id="${escapeAttr(set.id)}" ${set.active ? "checked" : ""}>
        <span>${set.active ? "Visible" : "Archived"}</span>
      </span>
    </label>
  `).join("");

  setList.querySelectorAll("input[data-set-id]").forEach((input) => {
    input.addEventListener("change", () => {
      const set = questionSets.find((item) => item.id === input.dataset.setId);
      if (!set) return;
      set.active = input.checked;
      render();
      showStatus("Settings changed. Download the file to apply them on GitHub.");
    });
  });
}

showAllBtn.addEventListener("click", () => {
  questionSets.forEach((set) => { set.active = true; });
  render();
  showStatus("All question sets are visible.");
});

downloadSetsBtn.addEventListener("click", () => {
  const blob = new Blob([`${JSON.stringify(questionSets, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "question-sets.json";
  link.click();
  URL.revokeObjectURL(url);
  showStatus("Downloaded question-sets.json.");
});

function showStatus(message) {
  managerStatus.hidden = false;
  managerStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
