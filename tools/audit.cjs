// Kiểm tra tự động các gợi ý: node tools/audit.cjs
// Chạy qua mọi tổ hợp 1–2 ấn, một mẫu tổ hợp 3 ấn và 4 ấn, ở cấp 8 và 9, rồi đếm các lỗi.
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
const E = D.emblems.map((e) => e.trait);
const emblemIds = new Set(D.emblems.map((e) => e.id));

const combos = [];
for (let a = 0; a < E.length; a++) combos.push([E[a]]);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// Mỗi bộ ấn mất ~2 giây (luôn chạy thêm bộ máy tự ghép) nên lấy mẫu: FULL=1 để chạy mọi tổ hợp 2 ấn như trước
const FULL = process.env.FULL === '1';
if (FULL) { for (let a = 0; a < E.length; a++) for (let b = a; b < E.length; b++) combos.push([E[a], E[b]]); }
else for (let i = 0; i < 60; i++) combos.push([0, 1].map(() => E[Math.floor(rnd() * E.length)]));
for (let i = 0; i < (FULL ? 300 : 100); i++) combos.push([0, 1, 2].map(() => E[Math.floor(rnd() * E.length)]));
for (let i = 0; i < (FULL ? 200 : 40); i++) combos.push([0, 1, 2, 3].map(() => E[Math.floor(rnd() * E.length)]));

const issues = {};
const add = (k, ex) => { issues[k] = issues[k] || { n: 0, ex: [] }; issues[k].n++; if (issues[k].ex.length < 3) issues[k].ex.push(ex); };
const name = (tr) => tr.map((t) => D.traits[t].name).join('+');

(async () => {
  let runs = 0, comps = 0;
  const stats = { active: 0, n: 0 };
  for (const L of [8, 9]) {
    const rules = S.LEVEL_RULES[L];
    for (const tr of combos) {
      runs++;
      const res = await S.recommendAsync(tr, L, 10);
      if (!res.length) { add('Không ra đội nào', `${name(tr)} cấp ${L}`); continue; }
      for (const c of res) {
        comps++;
        const tag = `${name(tr)} cấp ${L}: ${c.units.map((u) => D.units[u].name).join(', ')}`;
        const slots = c.units.reduce((a, u) => a + (D.units[u].slots || 1), 0);
        if (slots !== L) add('Sai số ô so với cấp', tag);
        if (new Set(c.units).size !== c.units.length) add('Trùng tướng', tag);
        if (c.units.some((u) => D.units[u].hidden)) add('Còn Lux gốc (không tộc/hệ)', tag);
        if (c.units.some((u) => D.units[u].cost > rules.maxCost)) add(`Tướng vượt giá ở cấp ${L}`, tag);
        if (c.units.filter((u) => D.units[u].tank).length < rules.tank) add('Thiếu tank', tag);
        for (const e of c.emblems) {
          if (e.unit == null) { add('Ấn không có người cầm', `${tag} | ${D.traits[e.trait].name}`); continue; }
          const b = c.frame?.board.find((x) => x.id === D.units[e.unit].id);
          const own = b ? b.items.filter((it) => !emblemIds.has(it)).length : 0;
          const held = c.emblems.filter((x) => x.unit === e.unit).length;
          if (held > 3) add('Người cầm ấn vượt 3 món đồ', `${tag} | ${D.units[e.unit].name}`);
          if (D.units[e.unit].traits.includes(e.trait)) add('Ấn đưa cho tướng đã có tộc/hệ đó', tag);
        }
        if (tr.length && !c.emblems.some((e) => e.unit != null && e.lifts)) add('Không ấn nào có tác dụng', tag);
        // Tướng không kích được tộc/hệ chung nào (tộc/hệ riêng không tính)
        const active = new Set(c.traits.filter((t) => t.active && D.traits[t.trait].kind !== 'unique').map((t) => t.trait));
        const dead = c.units.filter((u) => !D.units[u].traits.concat(c.emblems.filter((e) => e.unit === u).map((e) => e.trait)).some((t) => active.has(t)));
        if (dead.length) add('Có tướng không kích tộc/hệ nào', `${tag} | ${dead.map((u) => D.units[u].name).join(', ')}`);
        // Mốc dư tướng: vd 3/2 (3 tướng nhưng chỉ đạt mốc 2)
        const over = c.traits.filter((t) => t.active && D.traits[t.trait].kind !== 'unique').map((t) => {
          const bp = D.traits[t.trait].bps.filter(([m]) => m <= t.count).pop()[0];
          return t.count > bp ? `${t.count}/${bp} ${D.traits[t.trait].name}` : null;
        }).filter(Boolean);
        if (over.length) add('Mốc dư tướng', `${tag} | ${over.join(', ')}`);
        stats.active += active.size; stats.n++;
      }
    }
  }
  console.log(`Đã kiểm ${runs} lượt, ${comps} đội gợi ý. Trung bình ${(stats.active / stats.n).toFixed(2)} tộc/hệ kích hoạt mỗi đội.`);
  const keys = Object.keys(issues);
  if (!keys.length) console.log('Không phát hiện lỗi.');
  for (const k of keys) { console.log(`- ${k}: ${issues[k].n}`); issues[k].ex.forEach((x) => console.log('    ví dụ:', x)); }
})();
