// one-off: candidate Mixcloud accounts for each station — name, shows, latest, website listed on the profile
import fs from "fs";
const C = {
  relativa: ["RadioRelativa", "radiorelativa"], raheem: ["radioraheem", "RadioRaheem"], cashmere: ["cashmereradio", "CashmereRadio"],
  wwfm: ["worldwidefm", "WorldwideFM"], rinse: ["rinsefm", "RinseFM"], retreat: ["retreatradio", "RetreatRadio"], rotation: ["rotationradio", "RotationRadio"],
  lithium: ["lithiumradio", "lithium_radio", "LithiumParis"], ida: ["idaradio", "IDAradio", "idaidaida"], lake: ["thelakeradio", "TheLakeRadio"],
  bcr: ["bangkokcommunityradio", "BangkokCommunityRadio"], hanoi: ["hanoicommunityradio", "HanoiCommunityRadio"], rbl: ["rblmedia", "RadioBandaLarga", "radiobandalarga"],
  sonic: ["sonicradiolagos", "SonicRadio", "sonicradio"], deepspace: ["deepspaceradio", "DeepSpaceRadio"], batuta: ["radiobatuta", "RadioBatuta"],
  alhara: ["radioalhara", "RadioAlhara"], stegi: ["stegiradio", "StegiRadio", "onassisstegi"], newtown: ["newtownradio", "NewtownRadio"], setagaya: ["fmsetagaya"],
  nts: ["NTSRadio"], kiosk: ["KioskRadio"], noods: ["NoodsRadio"], nopal: ["radionopal"], super45: ["super45"], pass: ["chimurenga"], refuge: ["RefugeWorldwide"], satellite: ["satelliteradio"],
};
const get = async (u) => { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch { return null; } };
const out = {};
for (const [id, hs] of Object.entries(C)) {
  out[id] = [];
  for (const h of hs) {
    const u = await get(`https://api.mixcloud.com/${h}/`);
    if (!u || !u.username) continue;
    const c = await get(`https://api.mixcloud.com/${h}/cloudcasts/?limit=2`);
    out[id].push({ h: u.username, name: u.name, shows: u.cloudcast_count, followers: u.follower_count, city: u.city, country: u.country, bio: (u.biog || "").slice(0, 140).replace(/\s+/g, " "),
      latest: c && c.data ? c.data.map((x) => (x.created_time || "").slice(0, 10) + " " + x.name.slice(0, 40) + " " + x.key) : [] });
  }
}
fs.writeFileSync("mix2.json", JSON.stringify(out, null, 1));
