// So sánh số liệu tộc/hệ, tướng, ấn giữa 2 bản meta.js: node tools/diff-meta.cjs <meta cũ> [meta mới]
const path = require('path');
const load = (f) => { global.window = {}; delete require.cache[require.resolve(f)]; require(f); return window.TFT_META; };
const oldM = load(path.resolve(process.argv[2]));
const newM = load(path.resolve(process.argv[3] || path.join(__dirname, '../web/meta.js')));
global.window = globalThis; require('../web/data.js');
const D = window.TFT_DATA;
const tName = new Map(D.traits.map((t) => [t.id, t.name]));
const uName = new Map(D.units.map((u) => [u.id, u.name]));
const MIN = +(process.env.MIN || 0.08); // chỉ báo thay đổi hạng TB từ mức này
console.log(`Bản cũ: ${oldM.patch} (${oldM.updated}) · Bản mới: ${newM.patch} (${newM.updated})`);
const rows = (title, list) => { console.log(`\n## ${title}: ${list.length}`); list.slice(0, 25).forEach((r) => console.log('  ' + r)); if (list.length > 25) console.log(`  … và ${list.length - 25} dòng nữa`); };
const fmt = (d) => (d > 0 ? '+' : '') + d.toFixed(2);
// Tộc/hệ theo từng mốc
const tr = [];
for (const [id, t] of Object.entries(newM.traits || {})) {
  const o = oldM.traits?.[id];
  if (!o) { tr.push(`${tName.get(id) || id}: mới có số liệu`); continue; }
  for (const lv of t.levels || []) {
    const ol = (o.levels || []).find((x) => x.n === lv.n);
    if (ol && Math.abs(lv.avg - ol.avg) >= MIN && lv.games >= 300) tr.push({ d: lv.avg - ol.avg, s: `${lv.n} ${tName.get(id) || id}: ${ol.avg} → ${lv.avg} (${fmt(lv.avg - ol.avg)}, ${lv.games} ván)` });
  }
}
rows('Mốc tộc/hệ đổi hạng TB ≥ ' + MIN, tr.map((x) => (typeof x === 'string' ? x : x)).sort((a, b) => Math.abs(b.d || 0) - Math.abs(a.d || 0)).map((x) => x.s || x));
// Tướng (hạng TB tổng và theo sao 1–2)
const un = [];
for (const [id, u] of Object.entries(newM.units || {})) {
  const o = oldM.units?.[id];
  if (!o) { un.push({ d: 9, s: `${uName.get(id) || id}: mới có số liệu` }); continue; }
  if (Math.abs(u.avg - o.avg) >= MIN) un.push({ d: u.avg - o.avg, s: `${uName.get(id) || id}: ${o.avg} → ${u.avg} (${fmt(u.avg - o.avg)}) · hạng ${o.tier} → ${u.tier}` });
}
rows('Tướng đổi hạng TB ≥ ' + MIN, un.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).map((x) => x.s));
// Ấn
const em = [];
for (const [id, e] of Object.entries(newM.emblems || {})) {
  const o = oldM.emblems?.[id];
  if (o && Math.abs(e.avg - o.avg) >= MIN) em.push({ d: e.avg - o.avg, s: `Ấn ${tName.get(id) || id}: ${o.avg} → ${e.avg} (${fmt(e.avg - o.avg)})` });
}
rows('Ấn đổi hạng TB ≥ ' + MIN, em.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).map((x) => x.s));
const oc = new Set((oldM.mtComps || []).map((c) => c.name)), nc = new Set((newM.mtComps || []).map((c) => c.name));
console.log(`\nĐội hình MetaTFT: ${oc.size} → ${nc.size} kiểu đội (${[...nc].filter((n) => !oc.has(n)).length} kiểu mới)`);
