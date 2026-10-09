// Kiểm tra cách đếm tộc/hệ của tướng có cơ chế cộng thêm (vd Rồng Ngàn Tuổi +Quái Rừng).
// Với mỗi đội thật có tướng đó, xem số đếm của app có rơi đúng mốc không, so với đếm dư/thiếu 1.
// Chạy: node tools/check-counts.cjs
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
const D = window.TFT_DATA, M = window.TFT_META;
const unitById = new Map(D.units.map((u) => [u.id, u]));
const emblemTrait = new Map(D.emblems.map((e) => [e.id, e.trait]));
const comps = [...M.comps.map((c) => ({ name: 'TFT Academy · ' + c.title, board: c.board })),
  ...(M.smComps || []).map((c) => ({ name: 'seemeta · ' + c.name, board: c.board }))];

let warn = 0;
for (const sp of D.units.filter((u) => u.extra?.length && !u.base)) {
  for (const [t, bonus] of sp.extra) {
    const bps = D.traits[t].bps.map(([m]) => m);
    const hits = { [-1]: 0, 0: 0, 1: 0 };
    let n = 0;
    for (const c of comps) {
      if (!c.board.some((b) => (b.id || b) === sp.id)) continue;
      let cnt = 0;
      for (const b of c.board) {
        const u = unitById.get(b.id || b);
        if (!u) continue;
        if (u.traits.includes(t)) cnt++;
        else if ((b.items || []).some((it) => emblemTrait.get(it) === t)) cnt++;
      }
      cnt += bonus;
      n++;
      for (const d of [-1, 0, 1]) if (bps.includes(cnt + d)) hits[d]++;
    }
    const line = `${sp.name} +${bonus} ${D.traits[t].name}: ${n} đội thật · đúng mốc ${hits[0]} (đếm thiếu 1: ${hits[-1]}, đếm dư 1: ${hits[1]})`;
    const off = n >= 2 && (hits[-1] > hits[0] || hits[1] > hits[0]);
    if (off) warn++;
    console.log((off ? 'NGHI SAI  ' : 'ổn        ') + line);
  }
}
console.log(warn ? `${warn} cơ chế cần xem lại (sửa SPECIAL.bonus trong tools/build-data.mjs).` : 'Không thấy cơ chế đếm nào lệch.');
