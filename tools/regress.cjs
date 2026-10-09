// Bộ kiểm tra tự động: các đội "chuẩn" người chơi đã xác nhận. Chạy sau mỗi lần sửa cách chấm điểm.
// Chạy: node tools/regress.cjs
global.window = globalThis;
require('../web/data.js');
require('../web/meta.js');
try { require('../web/scale.js'); } catch (e) { console.log('(chưa có web/scale.js: bỏ qua kiểm tra tier tuyệt đối)'); }
const { createSolver } = require('../web/solver.js');
const D = window.TFT_DATA;
const S = createSolver(D, window.TFT_META);
const T = (en) => { const i = D.traits.findIndex((t) => t.en === en); if (i < 0) throw new Error('trait ' + en); return i; };
const UN = (en) => { const i = D.units.findIndex((u) => u.en === en); if (i < 0) throw new Error('unit ' + en); return i; };
const key = (u) => D.units[u].base || D.units[u].id; // các biến thể Lux tính là một

const UI_DEFAULTS = { maxUnused: 3, maxUnique: null };

const CASES = [
  { name: 'Thuật Sư + Đấu Sĩ + Thần Rừng (người chơi tự xếp)', emb: ['Spellweaver', 'Brawler', 'Elderwood'], L: 9,
    expect: ['Maokai', 'Taric', 'Amumu', 'Lux (Lunar)', 'Alune', 'Kennen', 'Gnar', 'Ezreal', 'Diana'], minSame: 8 },
  { name: 'Đao Phủ + Dũng Sĩ + Mặt Trăng (người chơi tự xếp)', emb: ['Executioner', 'Juggernaut', 'Lunar'], L: 9,
    // Đội người chơi tự xếp (Kennen cầm Dũng Sĩ, 5 Mặt Trăng): 4 đội đầu phải có đội trùng ≥ 7/9 tướng
    expect: ['Kennen', 'Alune', 'Lux (Lunar)', 'Amumu', 'Fiddlesticks', 'Lillia', 'Diana', 'Taric', 'Ezreal'], minSame: 7, inTop: 4 },
  { name: 'Đấu Sĩ + Vệ Quân + Thần Rừng (người chơi xác nhận mạnh hơn tftflex)', emb: ['Brawler', 'Defender', 'Elderwood'], L: 9,
    expect: ['Maokai', 'Amumu', 'Fiddlesticks', 'Lux (Lunar)', 'Gnar', 'Alune', 'Kennen', 'Ezreal', 'Soraka'], minSame: 7 },
  { name: 'Liên Kích + Tiên Phong + Hoa Linh: không lấy tướng rẻ (Krug) thay tướng 5 vàng', emb: ['Rapidfire', 'Vanguard', 'Blossom'], L: 9, not: ['Krug'], min5: 4 },
  { name: 'Bộ ấn yếu Thần Rừng + Tiên Linh + Tinh Nghịch: không được hạng S', emb: ['Elderwood', 'Fae', 'Sprykin'], L: 9, notTier: 'S' },
];

(async () => {
  let fail = 0;
  for (const c of CASES) {
    // Chạy đúng tùy chọn mặc định của giao diện (web/index.html: maxUnused 3, maxUnique Bất kỳ)
    const res = await S.recommendAsync(c.emb.map(T), c.L, 10, null, UI_DEFAULTS);
    const top = res[0];
    const errs = [];
    if (!top) errs.push('không ra đội nào');
    else {
      if (c.expect && c.inTop) {
        const want = new Set(c.expect.map((n) => key(UN(n))));
        const pos = res.findIndex((x) => x.units.filter((u) => want.has(key(u))).length >= c.minSame);
        if (pos < 0 || pos >= c.inTop) errs.push(pos < 0 ? 'không có trong danh sách gợi ý' : 'đứng thứ ' + (pos + 1) + ' (cần trong top ' + c.inTop + ')');
      } else if (c.expect) {
        const want = new Set(c.expect.map((n) => key(UN(n))));
        const same = top.units.filter((u) => want.has(key(u))).length;
        if (same < c.minSame) errs.push(`chỉ trùng ${same}/${c.expect.length} tướng (cần ≥ ${c.minSame})`);
      }
      for (const n of c.has || []) if (!top.units.some((u) => key(u) === key(UN(n)))) errs.push('thiếu ' + n);
      for (const n of c.not || []) if (top.units.some((u) => key(u) === key(UN(n)))) errs.push('có ' + n);
      if (c.min5 && top.units.filter((u) => D.units[u].cost >= 5).length < c.min5) errs.push('ít hơn ' + c.min5 + ' tướng 5 vàng');
      if (c.notTier && window.TFT_SCALE && top.tier === c.notTier) errs.push('đang là hạng ' + top.tier);
    }
    if (errs.length) fail++;
    console.log((errs.length ? '✗ ' : '✓ ') + c.name + (top ? ` · ${top.tier} ${top.rating}đ` : ''));
    if (top) console.log('    ' + top.units.map((u) => D.units[u].en).join(', '));
    errs.forEach((e) => console.log('    → ' + e));
  }
  console.log(fail ? `${fail}/${CASES.length} trường hợp sai` : 'Tất cả đều đạt');
  process.exitCode = fail ? 1 : 0;
})();
