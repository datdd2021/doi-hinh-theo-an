// Xếp hạng mọi tổ hợp 3 ấn theo bộ chấm điểm của app. Chạy: node tools/rank-combos.cjs [cấp]
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const fs = require('fs');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA, M = window.TFT_META;
const S = createSolver(D, M);
const L = +(process.argv[2] || 9);
const E = D.emblems.map((e) => e.trait);
const combos = [];
for (let a = 0; a < E.length; a++) for (let b = a; b < E.length; b++) for (let c = b; c < E.length; c++) combos.push([E[a], E[b], E[c]]);
const t0 = Date.now();
const out = [];
combos.forEach((tr, i) => {
  const algo = S.suggest(tr, L, 1, { beamScale: 0.3, maxBig: 0 })[0];
  const meta = S.rankMeta(tr, 1)[0];
  out.push({
    traits: tr,
    algoScore: algo ? algo.score : -999,
    algoUseful: algo ? algo.emblems.filter((e) => e.unit != null && e.lifts).length : 0,
    algoUnits: algo ? algo.units.map((u) => D.units[u].id) : [],
    algoHolders: algo ? algo.emblems.map((e) => [e.trait, e.unit != null ? D.units[e.unit].id : null, e.stats]) : [],
    algoTraits: algo ? algo.traits.filter((t) => t.active && D.traits[t.trait].kind !== 'unique').map((t) => [t.trait, t.count, +t.value.toFixed(2)]) : [],
    metaScore: meta ? meta.metaScore : null,
    metaTitle: meta ? meta.meta.title + ' (' + meta.meta.tier + ')' : null,
    metaNeed: meta ? meta.need : [],
  });
  if (i % 100 === 0) console.error(i + '/' + combos.length, Math.round((Date.now() - t0) / 1000) + 's');
});
fs.writeFileSync(process.env.OUT || 'combos.json', JSON.stringify(out));
console.error('xong', Math.round((Date.now() - t0) / 1000) + 's');
