// Sintonia: every Sunday, next week's shows on the stations that publish a schedule, in Italian time,
// numbered, as an issue in this repository (so GitHub emails it). Replying with three numbers fills This week
// (see tools/picks-from-comment.mjs). Reruns, archives and automatic playlists are left out.
import fs from "fs";

const ROME = "Europe/Rome";
const html = fs.readFileSync("index.html", "utf8");
const ST = {};
for (const m of html.matchAll(/<li class="tile" data-id="([^"]+)"[^>]*data-tz="([^"]+)"[\s\S]*?<span class="name">([^<]+)<\/span>/g)) {
  ST[m[1]] = { id: m[1], tz: m[2], name: m[3].replace(/&amp;/g, "&") };
}

const NTS = { nts1: 1, nts2: 2 };
const AIRTIME = { kiosk: "kioskradiobxl", raheem: "radioraheem", cashmere: "cashmereradio", batuta: "radioims", stegi: "movementathens", setagaya: "fmsetagaya834", pass: "pass", retreat: "retreatradio" };
const RADIOCO = { refuge: "s3699c5e49", super45: "s421105570", newtown: "s0d090ee43" };
const RADIOCULT = { wwfm: "worldwide-fm", noods: "noods-radio", bcr: "bcr", hanoi: "ha-noi-community-radio", rotation: "rotation-radio-befbc736", sonic: "sonicradio" };

const from = Date.now(), to = from + 8 * 864e5; // run on Sunday morning: Sunday to next Sunday
const SKIP = /\((r|repeat|restream|replay)\)|\brepeats?\b|re-?run|restream|replay|archiv|rotation|playlist|best of|off ?air|default|overnight|auto ?dj|staff picks|non-?stop|^music$|834\s*music/i;
const clean = (t) => String(t || "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "’").replace(/&quot;/g, "\"").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const firstSentence = (t) => { const c = clean(t); if (!c) return ""; const m = /^(.{20,160}?[.!?])(\s|$)/.exec(c); return (m ? m[1] : c.slice(0, 140)).trim(); };

async function getJSON(url) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 20000);
  try { const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": "Sintonia weekly schedule (+https://corradin-s.github.io/Sintonia/)" } }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  finally { clearTimeout(timer); }
}
// "2026-10-26 18:00:00" in a station's time zone, as a UTC timestamp
function zoned(local, tz) {
  const [d, t] = local.split(" "); const [y, mo, da] = d.split("-").map(Number); const [h, mi, s] = (t || "0:0:0").split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, da, h, mi, s || 0);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asIf = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return guess - (asIf - guess);
}

const shows = [], missing = [];
const add = (id, title, start, end, why) => {
  title = clean(title);
  if (!ST[id] || !title || !(start >= from && start < to) || !(end > start)) return;
  const mins = (end - start) / 60000;
  if (SKIP.test(title) || mins < 25 || mins > 6 * 60 || title.toLowerCase() === ST[id].name.toLowerCase()) return;
  shows.push({ id, title, start, end, why: firstSentence(why) });
};

const jobs = [];
for (const [id, ch] of Object.entries(NTS)) jobs.push(getJSON("https://www.nts.live/api/v2/radio/schedule/" + ch).then((j) => {
  for (const d of j.results || []) for (const b of d.broadcasts || []) {
    const det = (b.embeds && b.embeds.details) || {};
    add(id, b.broadcast_title || det.name, Date.parse(b.start_timestamp), Date.parse(b.end_timestamp), det.description);
  }
}).catch((e) => missing.push(ST[id] ? ST[id].name : id)));
for (const [id, sub] of Object.entries(AIRTIME)) jobs.push(getJSON(`https://${sub}.airtime.pro/api/week-info`).then((j) => {
  for (const [k, list] of Object.entries(j)) if (Array.isArray(list)) for (const s of list) {
    if (s.auto_dj) continue;
    add(id, s.name, zoned(s.starts || s.start_timestamp, ST[id].tz), zoned(s.ends || s.end_timestamp, ST[id].tz), s.description || s.instance_description);
  }
}).catch(() => missing.push(ST[id] ? ST[id].name : id)));
for (const [id, sid] of Object.entries(RADIOCO)) jobs.push(getJSON(`https://public.radio.co/stations/${sid}/embed/schedule`).then((j) => {
  for (const e of j.data || []) add(id, (e.playlist && (e.playlist.title || e.playlist.name)) || "", Date.parse(e.start), Date.parse(e.end), e.description);
}).catch(() => missing.push(ST[id] ? ST[id].name : id)));
for (const [id, sid] of Object.entries(RADIOCULT)) jobs.push(getJSON(`https://api.radiocult.fm/api/station/${sid}/schedule?startDate=${new Date(from).toISOString()}&endDate=${new Date(to).toISOString()}`).then((j) => {
  const list = j.schedules || (j.result && (j.result.schedules || j.result)) || j.data || [];
  for (const e of Array.isArray(list) ? list : []) {
    if (e.media && e.media.type === "playlist") continue;
    add(id, e.title, Date.parse(e.startDateUtc || e.start), Date.parse(e.endDateUtc || e.end), e.description);
  }
}).catch(() => missing.push(ST[id] ? ST[id].name : id)));
await Promise.all(jobs);

// one line per show, numbered, grouped by day in Italian time
const seen = new Set();
const list = shows.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).filter((s) => { const k = s.id + s.start + s.title; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 600);
list.forEach((s, i) => { s.n = i + 1; });
const day = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, weekday: "long", day: "numeric", month: "long" }).format(t);
const hm = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(t);
const short = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "numeric", month: "short" }).format(t);
let body = `Ecco i programmi dei prossimi giorni sulle radio di Sintonia, **in ora italiana**.\n\n` +
  `**Per scegliere This week rispondi qui con tre numeri**, per esempio \`12, 57, 140\`: entro qualche minuto li trovi nell'app.\n\n` +
  `Repliche, archivi e playlist automatiche sono esclusi.` +
  (missing.length ? ` Questa volta non è stato possibile leggere: ${[...new Set(missing)].join(", ")}.` : "") +
  ` Non pubblicano un palinsesto leggibile: Rinse FM, Radio alHara, Deep Space Radio, Lithium, Satellite Radio, Radio Nopal, The Lake Radio, IDA Radio.\n`;
let cur = "";
for (const s of list) {
  const d = day(s.start);
  if (d !== cur) { cur = d; body += `\n### ${d.charAt(0).toUpperCase() + d.slice(1)}\n`; }
  body += `- **${s.n}** · ${hm(s.start)}–${hm(s.end)} · ${ST[s.id].name} · ${s.title}\n`;
}
// the numbers, hidden in the issue, compact: [number, station, start in minutes since 1970, length in minutes]; titles are in the list above
const data = Buffer.from(JSON.stringify(list.map((s) => [s.n, s.id, Math.round(s.start / 60000), Math.round((s.end - s.start) / 60000)]))).toString("base64");
body += `\n<!-- sintonia-picks:${data} -->\n`;
const title = `Palinsesti dal ${short(from)} al ${short(to - 864e5)}`;
console.log(`${list.length} shows; not read: ${missing.join(", ") || "none"}; body ${body.length} chars`);
if (body.length > 65000) throw new Error("the list is too long for one issue: " + body.length);

const token = process.env.GITHUB_TOKEN, repo = process.env.REPO;
if (!token || !repo) { fs.writeFileSync("schedule-preview.md", body); process.exit(0); }
const gh = async (path, opts = {}) => {
  const r = await fetch("https://api.github.com/repos/" + repo + path, { ...opts, headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "content-type": "application/json" } });
  if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return r.status === 204 ? null : r.json();
};
// last week's list is closed, so the inbox keeps only the current one
for (const i of await gh("/issues?state=open&per_page=100")) {
  if (!i.pull_request && /^Palinsesti /.test(i.title)) await gh("/issues/" + i.number, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
}
await gh("/issues", { method: "POST", body: JSON.stringify({ title, body }) });
