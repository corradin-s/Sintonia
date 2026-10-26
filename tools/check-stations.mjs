// Sintonia: every station in the app, checked once a day. Does its stream answer with sound?
// When one doesn't (twice, a minute apart), an issue is opened in this repository, so GitHub tells the owner;
// it's updated while things change, and closed when every station answers again.
import fs from "fs";

const html = fs.readFileSync("index.html", "utf8");
const stations = [...html.matchAll(/<li class="tile" data-id="([^"]+)"[^>]*data-src="([^"]+)"[\s\S]*?<span class="name">([^<]+)<\/span>/g)]
  .map((m) => ({ id: m[1], src: m[2], name: m[3].replace(/&amp;/g, "&") }));

async function check(st) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(st.src, { signal: ctl.signal, redirect: "follow", headers: { "user-agent": "Sintonia station check (+https://corradin-s.github.io/Sintonia/)" } });
    const type = (r.headers.get("content-type") || "").toLowerCase();
    if (!r.ok) return `the server answers ${r.status}`;
    if (/mpegurl/.test(type) || /\.m3u8(\?|$)/i.test(st.src)) {
      const text = await r.text();
      return /#EXTM3U/.test(text) ? "" : "the playlist is empty";
    }
    if (!/audio|ogg|aac|mpeg|octet-stream/.test(type)) return `it sends no sound (${type || "no type"})`;
    const reader = r.body.getReader();
    let got = 0;
    const t0 = Date.now();
    while (got < 16384 && Date.now() - t0 < 10000) {
      const { value, done } = await reader.read();
      if (done) break;
      got += value.length;
    }
    return got >= 4096 ? "" : `it stops after ${got} bytes`;
  } catch (e) {
    return e.name === "AbortError" ? "no answer within 15 seconds" : `it can't be reached (${e.cause && e.cause.code || e.message})`;
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
}

const first = await Promise.all(stations.map(check));
await new Promise((r) => setTimeout(r, 60000));
const failing = [];
for (let i = 0; i < stations.length; i++) {
  if (!first[i]) continue;
  const again = await check(stations[i]);
  if (again) failing.push({ ...stations[i], why: again });
}
console.log(`${stations.length} stations checked; not answering: ${failing.length ? failing.map((f) => f.name + " (" + f.why + ")").join(", ") : "none"}`);

// ---------- tell the owner through an issue ----------
const token = process.env.GITHUB_TOKEN, repo = process.env.REPO;
if (!token || !repo) process.exit(0);
const TITLE = "Stazioni che non rispondono";
const gh = async (path, opts = {}) => {
  const r = await fetch("https://api.github.com/repos/" + repo + path, { ...opts, headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "content-type": "application/json" } });
  if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()).slice(0, 200));
  return r.status === 204 ? null : r.json();
};
const open = (await gh("/issues?state=open&per_page=100")).find((i) => i.title === TITLE && !i.pull_request);
const today = new Date().toISOString().slice(0, 10);
if (failing.length) {
  const list = failing.map((f) => `- **${f.name}**: ${f.why}\n  \`${f.src}\``).join("\n");
  const body = `Controllo del ${today}: queste stazioni non rispondono (provate due volte, a un minuto di distanza).\n\n${list}\n\n` +
    "Può essere un guasto passeggero o un indirizzo cambiato. Se domani sono ancora qui, conviene cercare il nuovo indirizzo sul sito della radio.";
  if (!open) await gh("/issues", { method: "POST", body: JSON.stringify({ title: TITLE, body }) });
  else {
    const names = (t) => (String(t || "").match(/\*\*([^*]+)\*\*/g) || []).sort().join();
    await gh("/issues/" + open.number, { method: "PATCH", body: JSON.stringify({ body }) });
    // a comment (which notifies) only when the list of stations changes
    if (names(open.body) !== names(body)) await gh("/issues/" + open.number + "/comments", { method: "POST", body: JSON.stringify({ body: "Aggiornato: " + failing.map((f) => f.name).join(", ") }) });
  }
} else if (open) {
  await gh("/issues/" + open.number + "/comments", { method: "POST", body: JSON.stringify({ body: `Controllo del ${today}: tutte le stazioni rispondono di nuovo.` }) });
  await gh("/issues/" + open.number, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
}
