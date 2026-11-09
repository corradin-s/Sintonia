// one-off: which stations have their archive on Mixcloud, how many shows, how recent
import fs from "fs";
const urls = JSON.parse(fs.readFileSync("links.json", "utf8")).filter((u) => u[2] === "site");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const get = async (u, ms = 15000) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: { "user-agent": UA }, signal: c.signal, redirect: "follow" }); return r.ok ? await r.text() : ""; } catch { return ""; } finally { clearTimeout(t); } };
const BAD = new Set(["widget", "upload", "developers", "about", "settings", "dashboard", "player", "categories", "discover", "select", "live", "oembed"]);
const out = [];
for (const [id, name, , site] of urls) {
  let html = await get(site);
  const scripts = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => new URL(m[1], site).href).slice(0, 8);
  for (const s of scripts) html += await get(s);
  const handles = [...new Set([...html.matchAll(/mixcloud\.com\/([A-Za-z0-9_-]+)/g)].map((m) => m[1]).filter((h) => !BAD.has(h.toLowerCase())))];
  const found = [];
  for (const h of handles.slice(0, 4)) {
    const j = await get(`https://api.mixcloud.com/${h}/cloudcasts/?limit=3`);
    let d; try { d = JSON.parse(j); } catch { d = null; }
    if (d && d.data) {
      const u = await get(`https://api.mixcloud.com/${h}/`); let ud = {}; try { ud = JSON.parse(u); } catch {}
      found.push({ handle: h, shows: ud.cloudcast_count, latest: d.data.map((c) => [c.created_time && c.created_time.slice(0, 10), c.name, Math.round((c.audio_length || 0) / 60) + "min", (c.tags || []).map((t) => t.name).slice(0, 3).join("/")]) });
    }
  }
  out.push({ id, name, site, handles, found });
}
fs.writeFileSync("mix.json", JSON.stringify(out, null, 1));
