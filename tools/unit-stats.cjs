// Thống kê nhanh chất lượng tướng trong đội gợi ý (giá TB, số tướng rẻ, số tank) để so sánh khi chỉnh điểm.
// Chạy: node tools/unit-stats.cjs
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
const E = D.emblems.map((e) => e.trait);
const combos = [];
for (let a = 0; a < E.length; a++) for (let b = a; b < E.length; b++) combos.push([E[a], E[b]]);
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 150; i++) combos.push([0, 1, 2].map(() => E[Math.floor(rnd() * E.length)]));

(async () => {
  for (const L of [7, 8, 9, 10]) {
    let comps = 0, units = 0, cost = 0, cheap = 0, tanks = 0, tankCost = 0, byCost = [0, 0, 0, 0, 0, 0];
    for (const tr of combos) {
      for (const c of (await S.recommendAsync(tr, L, 10)).slice(0, 3)) {
        comps++;
        for (const u of c.units) {
          const x = D.units[u];
          units++; cost += x.cost; byCost[x.cost]++;
          if (x.cost <= 2) cheap++;
          if (x.tank) { tanks++; tankCost += x.cost; }
        }
      }
    }
    const pct = (n) => (100 * n / units).toFixed(0) + '%';
    console.log(`Cấp ${L}: ${comps} đội (top 3 mỗi bộ ấn) · giá TB ${(cost / units).toFixed(2)} · tướng 1–2V/đội ${(cheap / comps).toFixed(2)}`
      + ` · tank/đội ${(tanks / comps).toFixed(2)} (giá TB tank ${(tankCost / tanks).toFixed(2)})`
      + ` · tỉ lệ 1V..5V: ${byCost.slice(1).map(pct).join(' / ')}`);
  }
})();
