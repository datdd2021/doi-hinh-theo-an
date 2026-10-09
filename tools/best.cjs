// Tính sẵn đội mạnh nhất KHÔNG ấn ở cấp 8, 9, 10 (chỉ số liệu tướng + tộc/hệ, không đội mẫu) → web/best.js
// Chạy: node tools/best.cjs
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const fs = require('fs');
const path = require('path');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
(async () => {
  const out = { updated: new Date().toISOString().slice(0, 10), levels: {} };
  for (const L of [8, 9, 10]) {
    const r = await S.bestComps(L, 6);
    out.levels[L] = r.map((c) => ({ units: c.units.map((u) => D.units[u].id), total: +c.total.toFixed(2) }));
    console.log(`cấp ${L}: ${r.length} đội · tốt nhất ${r[0]?.total.toFixed(1)} · ${r[0]?.units.map((u) => D.units[u].name).join(', ')}`);
  }
  fs.writeFileSync(path.join(__dirname, '../web/best.js'),
    '// Tự sinh bởi tools/best.cjs — đội mạnh nhất không ấn theo cấp (chỉ số liệu tướng + tộc/hệ)\nwindow.TFT_BEST = ' + JSON.stringify(out) + ';\n');
  console.log('Đã ghi web/best.js');
})();
