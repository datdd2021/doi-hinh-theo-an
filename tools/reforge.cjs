// Có nên đập (Búa Rèn) ấn nào không? Với mỗi ấn đang cầm, thử thay bằng từng ấn khác
// (đập ra ngẫu nhiên 1 ấn khác), so điểm đội tốt nhất trước/sau.
// Chạy: node tools/reforge.cjs <cấp> "Ấn A" "Ấn B" ...
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const D = window.TFT_DATA;
const S = require('../web/solver.js').createSolver(D, window.TFT_META);
const L = +process.argv[2];
const picked = process.argv.slice(3).map((n) => D.emblems.findIndex((e) => e.name.includes(n)));
const best = async (ems) => {
  const r = await S.recommendAsync(ems.map((i) => D.emblems[i].trait), L, 10);
  const ok = r.filter((c) => !c.emblems.some((e) => e.unit == null || !e.lifts));
  return { top: Math.max(0, ...r.map((c) => c.total)), clean: Math.max(0, ...ok.map((c) => c.total)) };
};
(async () => {
  const base = await best(picked);
  console.log(`Cấp ${L} · ${picked.map((i) => D.emblems[i].name).join(' + ')} · đội tốt nhất ${base.top.toFixed(1)} điểm`);
  for (let k = 0; k < picked.length; k++) {
    const res = [];
    for (let j = 0; j < D.emblems.length; j++) {
      if (j === picked[k]) continue;
      const ems = picked.slice(); ems[k] = j;
      res.push({ j, ...(await best(ems)) });
    }
    const avg = res.reduce((a, r) => a + r.top, 0) / res.length;
    const better = res.filter((r) => r.top > base.top).length;
    res.sort((a, b) => b.top - a.top);
    console.log(`  Đập ${D.emblems[picked[k]].name}: TB sau đập ${avg.toFixed(1)} (${avg >= base.top ? '+' : ''}${(avg - base.top).toFixed(1)}) · ${better}/${res.length} ấn mới tốt hơn`
      + ` · tốt nhất: ${res.slice(0, 3).map((r) => D.emblems[r.j].name.replace('Ấn ', '') + ' ' + r.top.toFixed(1)).join(', ')}`
      + ` · tệ nhất: ${res.slice(-2).map((r) => D.emblems[r.j].name.replace('Ấn ', '') + ' ' + r.top.toFixed(1)).join(', ')}`);
  }
})();
