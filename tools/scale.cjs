// Thang điểm chung: với từng CẤP và từng SỐ ẤN (1–4), chấm đội tốt nhất của nhiều bộ ấn ngẫu nhiên, lưu phân bố
// điểm vào web/scale.js. App xếp tier tuyệt đối bằng cách so đội với các bộ ấn CÙNG cấp và CÙNG số ấn
// (không so đội 4 ấn với đội 3 ấn, không so cấp 8 với cấp 9).
// Chạy: node tools/scale.cjs [số bộ ấn mỗi nhóm, mặc định 40]
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const fs = require('fs');
const path = require('path');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
const E = [...new Set(D.emblems.map((e) => e.trait))];
const N = +(process.argv[2] || 40);
let seed = 20261009;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// 1 ấn: dùng hết mọi ấn; 2–4 ấn: bốc ngẫu nhiên (được trùng ấn, như người chơi có thể có 2 ấn giống nhau)
const groups = { 1: E.map((t) => [t]) };
for (const k of [2, 3, 4]) groups[k] = Array.from({ length: N }, () => Array.from({ length: k }, () => E[Math.floor(rnd() * E.length)]));
(async () => {
  const out = { updated: new Date().toISOString().slice(0, 10), sets: N, levels: {}, top: {} };
  const t0 = Date.now();
  for (const L of [7, 8, 9, 10]) {
    out.levels[L] = {}; out.top[L] = {};
    for (const k of [1, 2, 3, 4]) {
      const best = [];
      let top = null;
      for (const tr of groups[k]) {
        const r = await S.recommendAsync(tr, L, 10);
        const ok = r.filter((c) => !c.emblems.some((e) => e.unit == null || !e.lifts));
        for (const c of ok.length ? ok : r) if (!top || c.total > top.total) top = { total: +c.total.toFixed(2), emblems: tr.map((t) => D.traits[t].id), units: c.units.map((u) => D.units[u].id) };
        if (r.length) best.push(Math.max(...(ok.length ? ok : r).map((c) => c.total)));
      }
      best.sort((a, b) => a - b);
      // 101 điểm phân vị (0%, 1%, …, 100%)
      out.levels[L][k] = Array.from({ length: 101 }, (_, i) => +best[Math.min(best.length - 1, Math.round((i / 100) * (best.length - 1)))].toFixed(2));
      out.top[L][k] = top; // đội đạt 100 điểm của nhóm này
      const q = out.levels[L][k];
      console.error(`cấp ${L} · ${k} ấn: thấp ${q[0]} · giữa ${q[50]} · cao ${q[100]} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  }
  fs.writeFileSync(path.join(__dirname, '../web/scale.js'),
    '// Tự sinh bởi tools/scale.cjs — phân bố điểm đội tốt nhất của các bộ ấn ngẫu nhiên, theo cấp và số ấn\nwindow.TFT_SCALE = ' + JSON.stringify(out) + ';\n');
  console.log('Đã ghi web/scale.js');
})();
