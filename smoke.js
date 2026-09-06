/* Headless smoke test for StudyOS using jsdom.
   Loads every script in the same order as index.html, simulates
   localStorage + IndexedDB absence, then drives the UI and asserts
   that clicks on every rendered control produce a state change rather
   than a thrown error. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "StudyOS");
const files = [
  "js/utils.js", "js/logo.js", "js/db.js", "js/db-bridge.js", "js/store.js",
  "js/tutor.js", "js/ui.js", "js/auth.js", "js/pages-core.js",
  "js/pages-study.js", "js/pages-meta.js", "js/app.js",
];

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const dom = new JSDOM(html, {
  url: "http://localhost:8080/index.html",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;

// Minimal stubs for browser APIs jsdom lacks.
window.scrollTo = () => {};
window.AudioContext = function () {
  return {
    createOscillator: () => ({ connect: () => {}, frequency: {}, type: "", start: () => {}, stop: () => {} }),
    createGain: () => ({ connect: () => {}, gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }),
    destination: {}, currentTime: 0,
  };
};
window.URL.createObjectURL = () => "blob:fake";
window.URL.revokeObjectURL = () => {};
window.Blob = window.Blob || class { constructor() {} };

const errors = [];
window.addEventListener("error", (e) => errors.push("window error: " + e.message));

for (const f of files) {
  try {
    window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  } catch (e) {
    errors.push(`SCRIPT ${f}: ${e.stack || e}`);
  }
}

const $ = (sel) => window.document.querySelector(sel);
const $$ = (sel) => Array.from(window.document.querySelectorAll(sel));
const click = (el) => {
  if (!el) { errors.push("click on missing element"); return; }
  el.click();
};
const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(`PASS ${label}`);
  } catch (e) {
    results.push(`FAIL ${label}: ${e.message}`);
    errors.push(`CHECK ${label}: ${e.message}\n${e.stack || ""}`);
  }
};

const Store = window.Store, App = window.App, Auth = window.Auth, UI = window.UI;
const subjByName = (n) => Store.state.subjects.find((s) => s.name === n);

// Fire DOMContentLoaded exactly like the browser does so app.js wires up.
window.document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));

// ---------- boot as guest ----------
check("auth landing renders", () => {
  Auth.render();
  if (!$$("button").some((b) => b.textContent.includes("Continue with Google"))) throw new Error("landing missing");
});
check("guest sign-in works", () => {
  Auth.guest();
  if (!Store.account) throw new Error("no account");
  if (window.document.getElementById("appRoot").style.display === "none") throw new Error("app hidden");
});
check("app boots to onboarding page when fresh", () => {
  App.render();
  const main = $("#main").textContent;
  if (!main.includes("Let's set up your profile")) throw new Error("onboarding missing: " + main.slice(0, 80));
});
check("onboarding end-to-end (clean start)", () => {
  $("#ob-name").value = "Tester";
  $$("#ob-goal option").forEach((o) => { if (o.value === "120") o.selected = true; });
  click($('[data-ob-next="2"]'));
  click($('[data-ob-subject="Mathematics"]'));
  click($('[data-ob-next="3"]'));
  click($('[data-ob-finish="clean"]'));
  if (window.document.getElementById("main").textContent.includes("Let's set up")) throw new Error("still onboarding");
  if (Store.state.subjects.length !== 1) throw new Error("subjects not created");
});

// ---------- Subjects / chapters / notes / cards ----------
check("dashboard renders", () => { App.go("dashboard"); if (!$("#main").querySelector(".stat-row")) throw new Error("no stats"); });
check("add subject modal + save", () => {
  App.modalSubject();
  $("#sb-name").value = "Physics";
  $("#sb-save").click();
  if (!subjByName("Physics")) throw new Error("subject not saved");
});
check("add chapter modal + save", () => {
  const s = subjByName("Physics");
  App.modalChapter(s.id);
  $("#ch-name").value = "Chapter One";
  $("#ch-save").click();
  if (s.chapters.length !== 1) throw new Error("chapter not saved");
});
check("chapter detail renders", () => {
  const s = subjByName("Physics");
  App.go("chapter", { sid: s.id, cid: s.chapters[0].id });
  if (!$("#main").textContent.includes("Chapter One")) throw new Error("chapter page missing");
});
check("progress slider updates", () => {
  const s = subjByName("Physics");
  const r = $('#main input[type="range"]');
  r.value = "80";
  r.dispatchEvent(new window.Event("change", { bubbles: true }));
  if (s.chapters[0].progress !== 80) throw new Error("progress not saved");
});
check("difficulty buttons update", () => {
  const s = subjByName("Physics");
  click($('[data-set-diff$="|3"]'));
  if (s.chapters[0].difficulty !== 3) throw new Error("difficulty not set");
});
check("mark revised works", () => {
  click($("[data-mark-revised]"));
  const s = subjByName("Physics");
  if (!s.chapters[0].lastRevised) throw new Error("not revised");
});
check("add note modal + save", () => {
  const s = subjByName("Physics"), c = s.chapters[0];
  App.modalNote(s.id, c.id);
  $("#nt-title").value = "My note";
  window.document.getElementById("nt-body").value = "The cell is the basic unit of life.\nMitochondria: powerhouse of the cell.";
  $("#nt-save").click();
  if (c.notes.length !== 1) throw new Error("note not saved");
});
check("pin note toggles", () => {
  const s = subjByName("Physics"), c = s.chapters[0];
  App.go("chapter", { sid: s.id, cid: c.id });
  click($("[data-pin-note]"));
  if (!c.notes[0].pinned) throw new Error("not pinned");
});
check("cards from note", () => {
  const s = subjByName("Physics"), c = s.chapters[0];
  const before = c.cards.length;
  click($("[data-cards-from-note]"));
  if (c.cards.length <= before) throw new Error("cards not created");
});
check("add card modal + save", () => {
  const s = subjByName("Physics"), c = s.chapters[0];
  App.modalCard(s.id, c.id);
  window.document.getElementById("fc-front").value = "Q?";
  window.document.getElementById("fc-back").value = "A.";
  $("#fc-save").click();
  if (!c.cards.some((k) => k.front === "Q?")) throw new Error("card not saved");
});

// ---------- Homework ----------
check("add homework modal + save (task/due shapes)", () => {
  App.modalHomework();
  $("#hw-title").value = "Worksheet 3";
  $("#hw-due").value = "2026-09-08";
  $("#hw-prio").value = "high";
  $("#hw-save").click();
  const h = Store.state.homework.find((x) => x.task === "Worksheet 3");
  if (!h) throw new Error("homework not saved");
  if (h.task !== "Worksheet 3" || h.due !== "2026-09-08") throw new Error("shape wrong: " + JSON.stringify(h));
  if (h.priority !== "High") throw new Error("priority not capitalized");
});
check("homework page renders + filters", () => {
  App.go("homework");
  click($('[data-hw-filter="all"]'));
  if (!$("#main").textContent.includes("Worksheet 3")) throw new Error("task missing");
});
check("hw start marks in progress", () => {
  const h = Store.state.homework.find((x) => x.task === "Worksheet 3");
  click($(`[data-hw-start="${h.id}"]`));
  if (Store.state.homework.find((x) => x.id === h.id).status !== "progress") throw new Error("not progress");
});
check("hw toggle done", () => {
  const h = Store.state.homework.find((x) => x.task === "Worksheet 3");
  click($(`[data-hw-toggle="${h.id}"]`));
  if (Store.state.homework.find((x) => x.id === h.id).status !== "done") throw new Error("not done");
  click($(`[data-hw-toggle="${h.id}"]`));
  if (Store.state.homework.find((x) => x.id === h.id).status !== "todo") throw new Error("not restored to todo");
});

// ---------- Exams ----------
check("add exam modal + save (date/topic shapes)", () => {
  App.modalExam();
  $("#ex-title").value = "Mid-Term Physics";
  $("#ex-date").value = "2026-09-20";
  window.window.document.getElementById("ex-syl").value = "Kinematics\nNewton's Laws";
  $("#ex-save").click();
  const ex = Store.state.exams.find((x) => x.title === "Mid-Term Physics");
  if (!ex) throw new Error("exam not saved");
  if (!ex.date || ex.syllabus.some((t) => !t.topic)) throw new Error("exam shape wrong");
});
check("exam page renders", () => {
  App.go("exams");
  if (!$("#main").textContent.includes("Mid-Term Physics")) throw new Error("exam missing");
});
check("add/remove syllabus item", () => {
  const ex = Store.state.exams.find((x) => x.title === "Mid-Term Physics");
  const before = ex.syllabus.length;
  // prompt modal
  App.render();
  // use the global prompt through UI and simulate
  UI.prompt("Add syllabus item", "Topic name", "", (val) => {
    Store.set(() => { ex.syllabus.push({ topic: val, done: false }); });
    App.render();
  }, { ok: "Add" });
  $("#ui-input").value = "Waves";
  $("#ui-ok").click();
  if (ex.syllabus.length !== before + 1) throw new Error("syllabus not added");
  const idx = ex.syllabus.length - 1;
  const btn = $(`[data-del-syllabus="${ex.id}|${idx}"]`);
  if (!btn) throw new Error("no delete button: " + $("#main").textContent.slice(0, 200));
  click(btn);
  if (ex.syllabus.some((t) => t.topic === "Waves")) throw new Error("syllabus not deleted");
});
check("exam syllabus toggle", () => {
  App.go("exams");
  const ex = Store.state.exams.find((x) => x.title === "Mid-Term Physics");
  click($(`[data-syl-toggle="${ex.id}|0"]`));
  if (ex.syllabus[0].done !== true) throw new Error("toggle failed");
});
check("exam prep plan", () => {
  const ex = Store.state.exams.find((x) => x.title === "Mid-Term Physics");
  const before = Store.state.plan.length;
  App.examPlan(ex.id);
  if (Store.state.plan.length <= before) throw new Error("no plan blocks");
});

// ---------- Timer ----------
check("timer page renders and modes switch", () => {
  App.go("timer");
  click($('[data-timer-mode="deep"]'));
  if (window.PagesStudy.T.mode !== "deep") throw new Error("mode not set");
});
check("timer start/pause/reset", () => {
  App.go("timer");
  click($("#t-subject") ? $("#t-subject") : null);
  click($("[data-timer-toggle]"));
  if (!window.PagesStudy.T.running) throw new Error("not running");
  click($("[data-timer-toggle]"));
  if (window.PagesStudy.T.running) throw new Error("still running");
  click($("[data-timer-reset]"));
  if (window.PagesStudy.T.remaining !== window.PagesStudy.T.total) throw new Error("not reset");
});
check("quick log works", () => {
  App.go("dashboard");
  const before = Store.state.sessions.length;
  click($('[data-quick-min="25"]'));
  if (Store.state.sessions.length !== before + 1) throw new Error("session not logged");
});

// ---------- Planner ----------
check("planner renders", () => { App.go("planner"); if (!$("#main").querySelector(".week-grid")) throw new Error("no week grid"); });
check("add block modal + save (end computed)", () => {
  App.render();
  App.modalBlock(window.U.todayISO());
  $("#bl-date").value = window.U.todayISO();
  $("#bl-subject").value = "Mathematics";
  $("#bl-start").value = "10:00";
  $("#bl-min").value = "50";
  $("#bl-save").click();
  const b = Store.state.plan.find((x) => x.start === "10:00" && x.dateISO === window.U.todayISO());
  if (!b) throw new Error("block not saved");
  if (b.end !== "10:50") throw new Error("end not computed: " + b.end);
});
check("auto-plan adds blocks", () => {
  App.go("dashboard");
  const before = Store.state.plan.length;
  App.autoPlan(window.U.todayISO());
  const apply = $("#ap-apply");
  if (!apply) throw new Error("auto-plan modal missing");
  click(apply);
  if (Store.state.plan.length <= before) throw new Error("no blocks");
});

// ---------- Quiz ----------
check("quiz generate + answer + next + results", () => {
  App.go("quiz");
  const before = Store.state.quizResults.length;
  window.PagesStudy.startQuiz({ subject: "Mathematics", chapter: "Chapter One", count: 3, difficulty: "easy" });
  for (let i = 0; i < 3; i++) {
    const btns = $$(".quiz-opt");
    if (!btns.length) throw new Error("no options at q" + i);
    btns[0].click();
    click($("[data-quiz-next]"));
  }
  if (!window.PagesStudy.getQuiz() || !window.PagesStudy.getQuiz().finished) throw new Error("not finished");
  if (Store.state.quizResults.length !== before + 1) throw new Error("result not saved");
});
check("retake quiz resets", () => {
  const q = window.PagesStudy.getQuiz();
  window.PagesStudy.retryQuiz();
  if (window.PagesStudy.getQuiz().idx !== 0 || window.PagesStudy.getQuiz().finished) throw new Error("not reset");
});
check("wrong answers -> cards", () => {
  const before = Store.allCards().length;
  window.PagesStudy.wrongToCards();
  if (Store.allCards().length <= before && window.PagesStudy.getQuiz().wrong.length) throw new Error("cards not made");
});
check("quiz exit returns to setup", () => {
  window.PagesStudy.exitQuiz();
  if (window.PagesStudy.getQuiz() !== null) throw new Error("quiz not cleared");
});

// ---------- Flashcards ----------
check("flashcards page + deck flow", () => {
  App.go("flashcards");
  if (!$("#main").textContent.includes("Flashcards")) throw new Error("page missing");
  click($("[data-review-all]"));
  // flip + rate through up to 12 cards
  let guard = 0;
  while (window.PagesStudy.getDeck() && (window.PagesStudy.getDeck().idx < window.PagesStudy.getDeck().items.length) && guard < 20) {
    click($("[data-fc-flip]"));
    click($('[data-fc-rate="easy"]'));
    guard++;
  }
  if (guard === 0) throw new Error("deck did not start");
});
check("deck exit works", () => {
  if (window.PagesStudy.getDeck()) window.PagesStudy.exitDeck();
  if (window.PagesStudy.getDeck()) throw new Error("deck not cleared");
});
check("review-due from revision", () => {
  App.go("revision");
  if (!$("#main").textContent.includes("Smart Revision")) throw new Error("revision page missing");
});

// ---------- Tutor ----------
check("tutor page + chat send", () => {
  App.go("tutor");
  const before = Store.state.chats.length;
  $("#chatInput").value = "What should I study today?";
  click($("[data-chat-send]"));
  if (Store.state.chats.length < before + 1) throw new Error("chat not pushed");
});
check("suggest prompt sends", () => {
  const before = Store.state.chats.length;
  const sug = $("[data-suggest]");
  sug.click();
  if (Store.state.chats.length < before + 1) throw new Error("suggest not sent");
});

// ---------- Scan ----------
check("scan run + quiz + save cards + save note", () => {
  App.go("scan");
  const sample = window.PagesStudy.sampleScan();
  window.PagesStudy.runScan(sample.text, sample.name);
  if (!window.PagesStudy.getScan()) throw new Error("scan failed");
  const cards = window.PagesStudy.getScan().cards.length;
  window.PagesStudy.scanQuiz();
  if (!window.PagesStudy.getQuiz()) throw new Error("scan quiz failed");
  window.PagesStudy.exitQuiz();
  // save cards into a chapter
  const beforeCards = Store.allCards().length;
  window.PagesStudy.saveScanCards();
  // modal open: pick subject/chapter
  $("#sv-subject").value = "Mathematics";
  $("#sv-save").click();
  if (Store.allCards().length < beforeCards + Math.min(cards, 12)) throw new Error("scan cards not saved");
});
check("scan save note", () => {
  window.PagesStudy.runScan(window.PagesStudy.sampleScan().text, "Sample");
  const before = Store.state.subjects.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.notes.length, 0), 0);
  window.PagesStudy.saveScanNote();
  $("#sn-title").value = "Scan note";
  $("#sn-save").click();
  const after = Store.state.subjects.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.notes.length, 0), 0);
  if (after !== before + 1) throw new Error("note not saved");
});

// ---------- Friends / challenges / settings ----------
check("add friend", () => {
  App.go("friends");
  App.modalFriend();
  $("#fr-name").value = "Amit";
  $("#fr-save").click();
  if (!Store.state.friends.some((f) => f.name === "Amit")) throw new Error("friend not added");
});
check("preset challenge opens + saves", () => {
  App.go("friends");
  const preset = $("[data-preset-challenge]");
  const val = preset.getAttribute("data-preset-challenge");
  const [title, goal, unit] = val.split("|");
  App.modalChallenge({ title, goal: +goal, unit });
  $("#cl-save").click();
  if (!Store.state.challenges.some((c) => c.title === title)) throw new Error("challenge not added");
});
check("settings save profile + theme", () => {
  App.go("settings");
  $("#st-name").value = "Tester2";
  $("#st-goal").value = "90";
  click($("[data-save-profile]"));
  if (Store.state.profile.name !== "Tester2" || Store.state.profile.dailyGoalMin !== 90) throw new Error("profile not saved");
  click($('[data-set-theme="light"]'));
  if (window.document.documentElement.getAttribute("data-theme") !== "light") throw new Error("theme not applied");
});
check("notification toggle", () => {
  App.go("notifications");
  const cb = $('[data-notif="homework"]');
  if (!cb) throw new Error("no toggle");
  cb.checked = false;
  cb.dispatchEvent(new window.Event("change", { bubbles: true }));
  if (Store.state.profile.notif.homework !== false) throw new Error("notif not saved");
});
check("edit-goal modal", () => {
  App.go("dashboard");
  App.modalGoal();
  $("#goal-min").value = "60";
  $("#goal-save").click();
  if (Store.state.profile.dailyGoalMin !== 60) throw new Error("goal not saved");
});
check("study-chapter jumps to timer", () => {
  const s = subjByName("Mathematics");
  App.studyChapter(`${s.id}|${s.chapters[0].id}`);
  if (App.route.page !== "timer") throw new Error("not on timer");
  if (window.PagesStudy.T.subject !== "Mathematics") throw new Error("subject not preset");
});

// ---------- persistence across reload ----------
check("state persists in localStorage", () => {
  const raw = window.localStorage.getItem("studyos.data.v2." + Store.account.id);
  if (!raw || !JSON.parse(raw).subjects.length) throw new Error("not persisted");
});

// ---------- report ----------
console.log(results.join("\n"));
const ok = results.filter((r) => r.startsWith("PASS")).length;
console.log(`\n${ok}/${results.length} checks passed`);
if (errors.length) {
  console.log("\n--- ERRORS ---");
  errors.forEach((e) => console.log(e));
  process.exit(1);
}
