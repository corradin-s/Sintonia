// one-off: open every station website and support link like a browser would, and note what comes back
import fs from "fs";
const urls = JSON.parse(fs.readFileSync("links.json", "utf8"));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
async function one([id, name, kind, url]) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctl.signal, headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml", "accept-language": "en,it;q=0.8" } });
    const body = (await r.text()).slice(0, 200000);
    const title = ((body.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim().slice(0, 90);
    const cf = /cf-chl|challenge-platform|Just a moment|Attention Required/i.test(body);
    return { id, name, kind, url, status: r.status, final: r.url, title, cf, len: body.length };
  } catch (e) { return { id, name, kind, url, status: 0, err: e.name === "AbortError" ? "timeout" : String(e.cause && e.cause.code || e.message) }; }
  finally { clearTimeout(t); }
}
const out = [];
for (const u of urls) out.push(await one(u));
fs.writeFileSync("results.json", JSON.stringify(out, null, 1));
