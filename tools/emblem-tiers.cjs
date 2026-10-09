// Đánh giá từng ấn: node tools/emblem-tiers.cjs   (in bảng; WRITE=1 để ghi kết quả vào web/emblem-tiers.js)
// Kết hợp: hạng TB của ấn (seemeta), người cầm tốt nhất, mốc mạnh nhất ấn giúp đạt, và ấn có lên mốc
// trong các đội app gợi ý (cấp 8 và 9) hay không.
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const fs = require('fs');
const path = require('path');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA, M = window.TFT_META;
const S = createSolver(D, M);
const PRIOR = 4.5, K = 1500, MIN = 300;
const adj = (avg, g, prior = PRIOR, k = K) => (avg == null || !g || g < MIN ? prior : (g * avg + k * prior) / (g + k));

(async () => {
  const rows = [];
  for (const e of D.emblems) {
    const t = e.trait;
    const tr = D.traits[t];
    const st = M.emblems?.[tr.id] || {};
    const ownAvg = adj(st.avg, st.games);
    // người cầm tốt nhất (đủ mẫu)
    const holders = (st.holders || []).filter((h) => h.games >= MIN).map((h) => ({ ...h, a: adj(h.avg, h.games, st.avg ?? PRIOR, 800) }))
      .sort((a, b) => a.a - b.a);
    const bestHolder = holders[0];
    // mốc mạnh nhất (đủ mẫu) của tộc/hệ
    const lv = (M.traits?.[tr.id]?.levels || []).filter((l) => l.games >= MIN).map((l) => ({ ...l, a: adj(l.avg, l.games) })).sort((a, b) => a.a - b.a);
    const bestLv = lv[0];
    // trong đội gợi ý: tỉ lệ đội mà ấn lên mốc, và điểm đội tốt nhất
    let useful = 0, total = 0, topScore = 0;
    for (const L of [8, 9]) {
      const res = await S.recommendAsync([t], L, 10);
      for (const c of res) { total++; if (c.emblems.some((x) => x.unit != null && x.lifts)) useful++; }
      topScore += res[0]?.total || 0;
    }
    rows.push({ e, tr, st, ownAvg, bestHolder, bestLv, usefulRate: total ? useful / total : 0, topScore: topScore / 2 });
  }
  // Điểm tổng: ấn càng giúp hạng TB thấp càng tốt (ấn, người cầm, mốc), cộng điểm đội gợi ý tốt nhất
  const minTop = Math.min(...rows.map((r) => r.topScore)), maxTop = Math.max(...rows.map((r) => r.topScore));
  for (const r of rows) {
    const holderA = r.bestHolder ? r.bestHolder.a : PRIOR;
    const lvA = r.bestLv ? r.bestLv.a : PRIOR;
    const team = maxTop > minTop ? (r.topScore - minTop) / (maxTop - minTop) : 0.5;
    r.score = 40 * (PRIOR - r.ownAvg) + 25 * (PRIOR - holderA) + 15 * (PRIOR - lvA) + 20 * team * r.usefulRate;
  }
  rows.sort((a, b) => b.score - a.score);
  const n = rows.length;
  rows.forEach((r, i) => {
    const p = i / n;
    r.tier = p < 0.15 ? 'S' : p < 0.4 ? 'A' : p < 0.65 ? 'B' : p < 0.85 ? 'C' : 'D';
    r.verdict = r.tier === 'S' || r.tier === 'A' ? 'ngon' : r.tier === 'B' ? 'tinh-huong' : 'dap-lai';
  });
  const label = { ngon: 'Ngon', 'tinh-huong': 'Tình huống', 'dap-lai': 'Đập lại' };
  const name = (id) => D.units.find((u) => u.id === id)?.name || id;
  for (const r of rows) {
    console.log(`${r.tier} ${label[r.verdict].padEnd(10)} ${r.e.name.padEnd(16)} | ấn TB ${r.st.avg ?? '-'} (${r.st.games ?? 0} ván)`
      + ` | cầm tốt nhất: ${r.bestHolder ? `${name(r.bestHolder.id)} ${r.bestHolder.avg} (${r.bestHolder.games} ván)` : '-'}`
      + ` | mốc tốt nhất: ${r.bestLv ? `${r.bestLv.n} ${r.tr.name} ${r.bestLv.avg} (${r.bestLv.games} ván)` : '-'}`
      + ` | lên mốc trong ${Math.round(r.usefulRate * 100)}% đội gợi ý | ${r.e.recipe.length ? 'ghép được' : 'chỉ từ lõi'}`);
  }
  if (process.env.WRITE) {
    const out = Object.fromEntries(rows.map((r) => [r.e.id, {
      tier: r.tier, verdict: r.verdict,
      holder: r.bestHolder ? { id: r.bestHolder.id, avg: r.bestHolder.avg, games: r.bestHolder.games } : null,
      level: r.bestLv ? { n: r.bestLv.n, avg: r.bestLv.avg, games: r.bestLv.games } : null,
      avg: r.st.avg ?? null, games: r.st.games ?? null, useful: Math.round(r.usefulRate * 100),
    }]));
    fs.writeFileSync(path.join(__dirname, '..', 'web', 'emblem-tiers.js'), `window.TFT_EMBLEM_TIERS = ${JSON.stringify(out)};\n`);
    console.log('Đã ghi web/emblem-tiers.js');
  }
})();
