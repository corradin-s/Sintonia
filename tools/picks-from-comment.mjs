// Sintonia: a reply with three numbers on the week's schedule issue becomes This week (picks.json).
// Reads the issue body (with the numbered shows hidden in it) and the comment; writes picks.json for the app
// and its test copy, and a short summary for the reply.
import fs from "fs";

const body = process.env.ISSUE_BODY || "", comment = process.env.COMMENT_BODY || "";
const m = /<!-- sintonia-picks:([A-Za-z0-9+/=]+) -->/.exec(body);
if (!m) { fs.writeFileSync("picks-reply.md", "Non trovo l'elenco dei programmi in questa issue."); process.exit(0); }
// the hidden numbers ([n, station, start minute, length]) and the visible lines ("- **n** · 18:00–19:00 · Station · Title")
const titles = {};
for (const line of body.split("\n")) { const x = /^- \*\*(\d+)\*\* · [^·]+ · [^·]+ · (.+)$/.exec(line.trim()); if (x) titles[+x[1]] = x[2].trim(); }
const list = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")).map(([n, id, start, len]) => ({ n, id, title: titles[n] || "", start: new Date(start * 60000).toISOString(), end: new Date((start + len) * 60000).toISOString(), why: "" }));
const nums = [...new Set((comment.match(/\d+/g) || []).map(Number))];
const chosen = nums.map((n) => list.find((s) => s.n === n)).filter(Boolean).slice(0, 3);
if (!chosen.length) { fs.writeFileSync("picks-reply.md", "Non ho trovato numeri dell'elenco nel messaggio. Rispondi per esempio con `12, 57, 140`."); process.exit(0); }

const html = fs.readFileSync("index.html", "utf8");
const names = Object.fromEntries([...html.matchAll(/<li class="tile" data-id="([^"]+)"[\s\S]*?<span class="name">([^<]+)<\/span>/g)].map((x) => [x[1], x[2]]));
const week = new Date().toISOString().slice(0, 10);
const out = JSON.stringify({ week, note: "Three shows picked by hand each week. Times in UTC; the app shows them in the listener's own time.",
  picks: chosen.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).map(({ id, title, start, end }) => ({ id, title, start, end })) }, null, 1) + "\n";
fs.writeFileSync("picks.json", out);
if (fs.existsSync("prova")) fs.writeFileSync("prova/picks.json", out);
const when = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
fs.writeFileSync("picks-reply.md", "Fatto, in This week ci sono:\n\n" + chosen.map((s) => `- ${when(s.start)} · ${names[s.id] || s.id} · ${s.title}`).join("\n") +
  (nums.length > chosen.length ? `\n\n(Ho ignorato: ${nums.filter((n) => !chosen.some((s) => s.n === n)).join(", ")}.)` : "") + "\n\nL'app si aggiorna da sola nei prossimi minuti.");
console.log("picked", chosen.map((s) => s.n).join(", "));
