// Tóm tắt kết quả rank-combos: node tools/summarize-combos.cjs combos.json
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const fs = require('fs');
const D = window.TFT_DATA, M = window.TFT_META;
const rows = JSON.parse(fs.readFileSync(process.argv[2] || 'combos.json', 'utf8'));
const tn = (t) => D.traits[t].name;
const un = (id) => (D.units.find((u) => u.id === id) || {}).name || id;
const em = (t) => D.emblems.find((e) => e.trait === t);
const craft = (t) => (em(t).recipe.length ? 'ghép được' : 'chỉ từ lõi');
const est = (t) => M.emblems?.[D.traits[t].id];

console.log('Tổng', rows.length, 'tổ hợp');
const full = rows.filter((r) => r.algoUseful === 3).sort((a, b) => b.algoScore - a.algoScore);
console.log('Cả 3 ấn đều có tác dụng:', full.length);
const top = full[0]?.algoScore || 1;

const show = (list, n, title) => {
  console.log('\n### ' + title);
  list.slice(0, n).forEach((r, i) => {
    const names = r.traits.map((t) => tn(t)).join(' + ');
    console.log(`${i + 1}. ${names} | điểm ${r.algoScore.toFixed(1)} (${Math.round((r.algoScore / top) * 100)})`);
    console.log('   ấn:', r.algoHolders.map(([t, u, s]) => `${tn(t)}→${u ? un(u) : '-'}${s ? ` (${s.avg}, ${s.games} ván)` : ''}`).join('; '));
    console.log('   mốc:', r.algoTraits.slice(0, 6).map(([t, c, v]) => `${c} ${tn(t)}`).join(', '));
    console.log('   đội:', r.algoUnits.map(un).join(', '));
    console.log('   meta:', r.metaTitle ? `${r.metaTitle} ${r.metaNeed.length ? '(cần thêm ' + r.metaNeed.map(tn).join(',') + ')' : ''}` : '-');
    console.log('   nguồn ấn:', r.traits.map((t) => `${tn(t)}: ${craft(t)}${est(t)?.tier ? ', hạng ' + est(t).tier + ' ' + est(t).avg : ''}`).join(' | '));
  });
};
show(full, 10, 'Top theo thuật toán (cấp 9)');
show(full.filter((r) => r.traits.every((t) => em(t).recipe.length)), 5, 'Top chỉ gồm ấn ghép được');
show(full.filter((r) => new Set(r.traits).size === 3), 5, 'Top 3 ấn khác nhau');

const metaTop = rows.filter((r) => r.metaScore != null && !r.metaNeed.length).sort((a, b) => b.metaScore - a.metaScore);
console.log('\n### Top theo đội meta TFT Academy (không cần thêm ấn khác)');
metaTop.slice(0, 8).forEach((r, i) => console.log(`${i + 1}. ${r.traits.map(tn).join(' + ')} → ${r.metaTitle} (meta ${r.metaScore.toFixed(1)}, thuật toán ${Math.round((r.algoScore / top) * 100)})`));

// Ấn xuất hiện nhiều nhất trong top 50
const freq = {};
full.slice(0, 50).forEach((r) => r.traits.forEach((t) => (freq[t] = (freq[t] || 0) + 1)));
console.log('\n### Ấn xuất hiện nhiều nhất trong top 50:', Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${tn(+t)} ${n}`).join(', '));
