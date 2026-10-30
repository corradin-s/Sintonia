// Sintonia: replies on the week's schedule issue.
// - Three numbers from the list become This week (picks.json, for the app and its test copy).
// - "evento ok" publishes the event proposed under the issue: the test copy already shows it (prova/events.json),
//   the app gets the same file (events.json).
// Writes the changed files to changed.txt and a short summary for the reply to picks-reply.md.
import fs from "fs";

const body = process.env.ISSUE_BODY || "";
// only what was written in the reply: an email reply carries the whole message it answers below it, quoted
function ownText(c) {
  const lines = String(c || "").replace(/\r/g, "").split("\n");
  let end = lines.findIndex((l) => /^\s*>/.test(l));
  if (end < 0) end = lines.length;
  const head = lines.slice(0, end);
  const k = head.findIndex((l) => /^(On|Il|Le|El|Am|Op)\s.*\d/.test(l.trim()) || /(wrote|scritto|écrit|escribió|schrieb):\s*$/.test(l.trim()) || /-{3,}\s*(Original|Messaggio originale)/i.test(l));
  return (k >= 0 ? head.slice(0, k) : head).join("\n");
}
const comment = ownText(process.env.COMMENT_BODY);
const out = [], changed = [];

// 1. the event
const eventOk = /\bevento\s+ok\b|\bok\s+(?:l['’]|all['’]|per\s+l['’])?\s*evento\b/i.test(comment);
if (eventOk) {
  if (fs.existsSync("prova/events.json")) {
    fs.copyFileSync("prova/events.json", "events.json");
    changed.push("events.json");
    let title = "";
    try { const ev = (JSON.parse(fs.readFileSync("events.json", "utf8")).events || [])[0]; title = ev && ev.title ? " (" + ev.title + ")" : ""; } catch (e) {}
    out.push("Fatto, l'evento" + title + " è nell'app.");
  } else out.push("Non trovo nessun evento da pubblicare.");
}

// 2. the picks: the hidden numbers ([n, station, start minute, length]) and the visible lines ("- **n** · 18:00–19:00 · Station · Title")
const m = /<!-- sintonia-picks:([A-Za-z0-9+/=]+) -->/.exec(body);
const nums = [...new Set((comment.match(/\d+/g) || []).map(Number))];
if (!m) {
  if (!eventOk) out.push("Non trovo l'elenco dei programmi in questa issue.");
} else {
  const titles = {};
  for (const line of body.split("\n")) { const x = /^- \*\*(\d+)\*\* · [^·]+ · [^·]+ · (.+)$/.exec(line.trim()); if (x) titles[+x[1]] = x[2].trim(); }
  const list = JSON.parse(Buffer.from(m[1], "base64").toString("utf8")).map(([n, id, start, len]) => ({ n, id, title: titles[n] || "", start: new Date(start * 60000).toISOString(), end: new Date((start + len) * 60000).toISOString() }));
  const chosen = nums.map((n) => list.find((s) => s.n === n)).filter(Boolean).slice(0, 3);
  if (!chosen.length) {
    if (!eventOk) out.push("Non ho trovato numeri dell'elenco nel messaggio. Rispondi per esempio con `12, 57, 140`.");
  } else {
    const html = fs.readFileSync("index.html", "utf8");
    const names = Object.fromEntries([...html.matchAll(/<li class="tile" data-id="([^"]+)"[\s\S]*?<span class="name">([^<]+)<\/span>/g)].map((x) => [x[1], x[2]]));
    const week = new Date().toISOString().slice(0, 10);
    const json = JSON.stringify({ week, note: "Three shows picked by hand each week. Times in UTC; the app shows them in the listener's own time.",
      picks: chosen.sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).map(({ id, title, start, end }) => ({ id, title, start, end })) }, null, 1) + "\n";
    fs.writeFileSync("picks.json", json); changed.push("picks.json");
    if (fs.existsSync("prova")) { fs.writeFileSync("prova/picks.json", json); changed.push("prova/picks.json"); }
    const when = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(t));
    out.push("Fatto, in This week ci sono:\n\n" + chosen.map((s) => `- ${when(s.start)} · ${names[s.id] || s.id} · ${s.title}`).join("\n") +
      (nums.length > chosen.length ? `\n\n(Ho ignorato: ${nums.filter((n) => !chosen.some((s) => s.n === n)).join(", ")}.)` : ""));
    console.log("picked", chosen.map((s) => s.n).join(", "));
  }
}

fs.writeFileSync("changed.txt", changed.join("\n"));
fs.writeFileSync("picks-reply.md", out.join("\n\n") + (changed.length ? "\n\nL'app si aggiorna da sola nei prossimi minuti." : ""));
console.log("changed:", changed.join(", ") || "nothing");
