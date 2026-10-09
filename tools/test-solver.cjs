// Chạy thử thuật toán trong terminal: node tools/test-solver.cjs "Ấn Dũng Sĩ"   (LV=8 để đổi cấp)
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
const L = +(process.env.LV || 9);
const nm = (u) => D.units[u].name + '(' + D.units[u].cost + ')';
const args = process.argv.slice(2);
const combos = args.length ? [args] : [['Ấn Dũng Sĩ'], ['Ấn Đao Phủ'], ['Ấn Liên Kích'], ['Ấn Hoa Linh', 'Ấn Thuật Sư']];
for (const combo of combos) {
  const traits = combo.map((n) => D.emblems.find((e) => e.name === n).trait);
  console.log('\n==', combo.join(' + '), 'cấp', L);
  for (const c of S.rankMeta(traits)) {
    console.log(' META', c.meta.tier, c.meta.title, '| ấn:', c.emblems.map((e) => D.traits[e.trait].name + '→' + (e.unit != null ? D.units[e.unit].name : '-') + (e.stats ? ' (' + e.stats.avg + ', ' + e.stats.games + ' ván)' : '')).join('; '), c.need.length ? '| cần thêm ' + c.need.map((t) => D.traits[t].name).join(',') : '');
  }
  const t0 = Date.now();
  for (const c of S.suggest(traits, L, 6)) {
    console.log(' ', c.rating, 'TB' + c.avgCost.toFixed(1), 'tank' + c.tanks, '[' + (c.label ? c.label.m + ' ' + D.traits[c.label.t].name : '-') + ']', c.units.map(nm).join(', '));
    console.log('     ', c.traits.filter((t) => t.active && t.style !== 4).map((t) => t.count + ' ' + D.traits[t.trait].name + '=' + t.value.toFixed(1)).join(' | '));
    console.log('      ấn:', c.emblems.map((e) => D.traits[e.trait].name + '→' + (e.unit != null ? D.units[e.unit].name : '-') + (e.stats ? ' (' + e.stats.avg + ')' : '')).join('; '));
  }
  console.log('  ', Date.now() - t0, 'ms');
}
