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
const RADIOCULT = { wwfm: "worldwide-fm", noods: "noods-radio", bcr: "bcr", hanoi: "ha-noi-community-radio", rotation: "rotation-radio-befbc736", sonic: "sonicradio", rbl: "rblmedia-a4a44e62" };

// the week, Monday to Sunday in Italian time: on Sunday it's the coming week, on other days what is left of this one
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const romeDay = (t) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: ROME, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(t).map((x) => [x.type, x.value]));
const midnight = (t, plus) => { const p = romeDay(t); return zoned(new Date(Date.UTC(+p.year, +p.month - 1, +p.day + plus)).toISOString().slice(0, 10) + " 00:00:00", ROME); };
const now = Date.now(), dow = DOW[romeDay(now).weekday];
const from = dow === 6 ? midnight(now, 1) : now, to = midnight(now, dow === 6 ? 8 : 7 - dow);
const SKIP = /\((r|repeat|restream|replay)\)|\brepeats?\b|re-?run|restream|replay|archiv|rotation|playlist|best of|off ?air|default|overnight|auto ?dj|staff picks|non-?stop|^music$|834\W*music|^\w+day\s*-\s*show\s*\d+$/i;
// one-offs worth a look, listed again at the top
const SPECIAL = /special|\bb2b\b|tribute|launch|takeover|in conversation|anniversar|birthday|premiere|showcase|listening party|live (at|from|in)\b/i;
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

// daily strips (the same title, give or take a number, three or more times in the week) are left out,
// and a show that comes back later in the week is listed only the first time
const key = (s) => s.id + "|" + s.title.toLowerCase().replace(/\d+/g, "#").replace(/[^\p{L}#]+/gu, " ").trim();
const times = {};
for (const s of shows) times[key(s)] = (times[key(s)] || 0) + 1;
const seen = new Set();
const list = shows.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id)).filter((s) => {
  const k = key(s);
  if (times[k] >= 3 || seen.has(k)) return false;
  seen.add(k); return true;
});
list.forEach((s, i) => { s.n = i + 1; });
const day = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, weekday: "long", day: "numeric", month: "long" }).format(t);
const hm = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(t);
const short = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, day: "numeric", month: "short" }).format(t);
const dayShort = (t) => new Intl.DateTimeFormat("it-IT", { timeZone: ROME, weekday: "short", day: "numeric" }).format(t);
const specials = list.filter((s) => SPECIAL.test(s.title));
function compose(shown) {
  let b = `Ecco i programmi della settimana sulle radio di Sintonia, **in ora italiana**.\n\n` +
    `**Per scegliere This week rispondi qui con tre numeri**, per esempio \`12, 57, 140\`: entro qualche minuto li trovi nell'app.\n\n` +
    `Sono esclusi repliche, archivi, playlist automatiche e le trasmissioni fisse di ogni giorno.` +
    (missing.length ? ` Questa volta non è stato possibile leggere: ${[...new Set(missing)].join(", ")}.` : "") +
    ` Non pubblicano un palinsesto leggibile: Rinse FM, Radio alHara, Deep Space Radio, Lithium, Satellite Radio, Radio Nopal, The Lake Radio, IDA Radio.\n`;
  const sp = specials.filter((s) => shown.includes(s));
  if (sp.length) b += `\n### Da notare\n` + sp.map((s) => `- **${s.n}** — ${dayShort(s.start)}, ${hm(s.start)}, ${ST[s.id].name}: ${s.title}`).join("\n") + "\n";
  let cur = "";
  for (const s of shown) {
    const d = day(s.start);
    if (d !== cur) { cur = d; b += `\n### ${d.charAt(0).toUpperCase() + d.slice(1)}\n`; }
    b += `- **${s.n}** · ${hm(s.start)}–${hm(s.end)} · ${ST[s.id].name} · ${s.title}\n`;
  }
  if (shown.length < list.length) b += `\n_L'elenco continua oltre il limite di lunghezza di GitHub: mancano ${list.length - shown.length} programmi alla fine della settimana._\n`;
  // the numbers, hidden in the issue, compact: [number, station, start in minutes since 1970, length in minutes]; titles are in the list above
  const data = Buffer.from(JSON.stringify(shown.map((s) => [s.n, s.id, Math.round(s.start / 60000), Math.round((s.end - s.start) / 60000)]))).toString("base64");
  return b + `\n<!-- sintonia-picks:${data} -->\n`;
}
// an issue holds up to 65,536 characters: if the week doesn't fit, its last shows are left out
let shown = list, body = compose(shown);
while (body.length > 64000 && shown.length) { shown = shown.slice(0, Math.floor(shown.length * 0.95)); body = compose(shown); }
const title = `Palinsesti dal ${short(from)} al ${short(to - 864e5)}`;
console.log(`${title}: ${shown.length} of ${list.length} shows (${shows.length} before strips), ${specials.length} to note; not read: ${missing.join(", ") || "none"}; body ${body.length} chars`);

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
