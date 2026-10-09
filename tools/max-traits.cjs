// Tìm số tộc/hệ chung (không tính tộc/hệ độc nhất) kích hoạt được nhiều nhất với 3 ấn tự chọn.
// Chạy: node tools/max-traits.cjs            (có luật của app, nhiều mức chặt)
//       RULES=0 node tools/max-traits.cjs    (không luật, giới hạn lý thuyết)
global.window = globalThis;
require('../web/data.js');
const D = window.TFT_DATA;
const U = D.units, TR = D.traits;
const NT = TR.length;
const EMBLEMS = 3;
const emblemTraits = new Set(D.emblems.map((e) => e.trait)); // chỉ tộc/hệ có ấn mới được cộng bằng ấn

const pool = U.map((u, i) => i).filter((i) => !U[i].hidden);
const contrib = U.map((u) => {
  const m = new Map(u.traits.map((t) => [t, 1]));
  for (const [t, n] of u.extra || []) m.set(t, (m.get(t) || 0) + n);
  return [...m.entries()];
});
const slots = U.map((u) => u.slots || 1);
const minBp = TR.map((t) => (t.kind === 'unique' ? Infinity : t.bps[0][0]));
const counted = TR.map((t) => t.kind !== 'unique');
// Mã Team Planner: "02" + mã hex 3 ký tự chữ hoa từng tướng (bù 0 đủ 30 ký tự) + "TFTSet18"
const teamCode = (units) => '02' + units.map((u) => U[u].tp).filter((x) => x != null).slice(0, 10).map((x) => x.toString(16).toUpperCase().padStart(3, '0')).join('').padEnd(30, '0') + (D.plannerSet || 'TFTSet' + D.set);
const slotSum = (arr) => arr.reduce((a, u) => a + slots[u], 0);

// Luật của app theo cấp
const APP = { 9: { tank: 5, carry: 2, dpsMax: 4, c5: 4 }, 10: { tank: 5, carry: 2, dpsMax: 4, c5: 6 } };

// Chia 3 ấn tối ưu: lấp các tộc/hệ thiếu ít điểm nhất trước
function evaluate(units) {
  const cnt = new Array(NT).fill(0);
  const own = new Array(NT).fill(0);
  for (const u of units) {
    for (const [t, n] of contrib[u]) cnt[t] += n;
    for (const t of U[u].traits) own[t]++;
  }
  const deficits = [];
  for (let t = 0; t < NT; t++) {
    if (!counted[t] || cnt[t] >= minBp[t] || !emblemTraits.has(t)) continue;
    const d = minBp[t] - cnt[t];
    if (d <= EMBLEMS && d <= units.length - own[t]) deficits.push({ t, d });
  }
  deficits.sort((a, b) => a.d - b.d);
  let left = EMBLEMS;
  const used = [];
  for (const x of deficits) if (x.d <= left) { left -= x.d; used.push(x); cnt[x.t] += x.d; }
  const activeSet = new Set();
  for (let t = 0; t < NT; t++) if (counted[t] && cnt[t] >= minBp[t]) activeSet.add(t);
  // tướng không kích tộc/hệ chung nào (tính cả tộc/hệ nhận từ ấn — giả sử ấn đưa cho tướng thiếu)
  const dead = units.filter((u) => !U[u].traits.some((t) => activeSet.has(t))).length;
  return { active: activeSet.size, used, cnt, activeSet, dead };
}

// Số lỗi so với luật (0 = hợp lệ)
function violations(units, L, rule) {
  let v = 0;
  const groups = new Set();
  for (const u of units) { const g = U[u].group; if (g) { if (groups.has(g)) v += 5; groups.add(g); } }
  if (slotSum(units) !== L) v += 5;
  if (!rule) return v;
  const r = APP[L];
  const tanks = units.filter((u) => U[u].tank).length;
  const carries = units.filter((u) => !U[u].tank && U[u].cost >= 4).length;
  const dps = units.length - tanks;
  const c5 = units.filter((u) => U[u].cost === 5).length;
  const cheap = units.filter((u) => U[u].cost <= 2).length;
  v += Math.max(0, r.tank - tanks) + Math.max(0, r.carry - carries) + Math.max(0, dps - r.dpsMax) + Math.max(0, c5 - r.c5);
  if (rule.maxCheap != null) v += Math.max(0, cheap - rule.maxCheap);
  return v;
}

function search(L, rule, restarts, iters, seed0) {
  let seed = seed0;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  const fill = (arr) => {
    let guard = 0;
    while (slotSum(arr) < L && guard++ < 500) {
      const u = pick();
      if (arr.includes(u) || slotSum(arr) + slots[u] > L) continue;
      arr.push(u);
    }
    return arr;
  };
  // Điểm: lỗi luật bị phạt nặng; rồi số tộc/hệ; rồi tướng chết; rồi giá trung bình (đội mạnh hơn)
  const obj = (arr) => {
    const e = evaluate(arr);
    const avg = arr.reduce((a, u) => a + U[u].cost, 0) / arr.length;
    return { e, s: -1000 * violations(arr, L, rule) + 100 * e.active - (rule ? 60 * e.dead : 0) + avg };
  };
  let best = null, hits = 0;
  for (let r = 0; r < restarts; r++) {
    let cur = fill([]);
    let cs = obj(cur);
    for (let it = 0; it < iters; it++) {
      const next = cur.slice();
      const k = rnd() < 0.7 ? 1 : 2;
      for (let j = 0; j < k; j++) next.splice(Math.floor(rnd() * next.length), 1);
      fill(next);
      const ns = obj(next);
      if (ns.s >= cs.s) { cur = next; cs = ns; }
    }
    const ok = violations(cur, L, rule) === 0 && (!rule || cs.e.dead === 0);
    if (!ok) continue;
    if (!best || cs.s > best.s + 1e-9) { best = { ...cs, units: cur.slice() }; hits = 1; }
    else if (cs.e.active === best.e.active) hits++;
  }
  return best && { ...best, hits };
}

function report(L, label, rule, restarts, iters) {
  const t0 = Date.now();
  const best = search(L, rule, restarts, iters, Number(process.env.SEED || 12345) + L);
  if (!best) { console.log(`\n=== Cấp ${L} · ${label}: không tìm được đội hợp lệ`); return; }
  const { e } = best;
  const units = best.units.slice().sort((a, b) => U[b].tank - U[a].tank || U[b].cost - U[a].cost);
  const avg = units.reduce((a, u) => a + U[u].cost, 0) / units.length;
  console.log(`\n=== Cấp ${L} · ${label}: tối đa ${e.active} tộc/hệ chung (${best.hits}/${restarts} lượt đạt, ${Date.now() - t0} ms)`);
  console.log('Tướng:', units.map((u) => `${U[u].name} (${U[u].cost}${U[u].tank ? ', tank' : ''})`).join(', '));
  console.log(`Giá TB ${avg.toFixed(1)} · ${units.filter((u) => U[u].tank).length} tank · ${units.filter((u) => U[u].cost === 5).length} tướng 5 vàng`);
  console.log('Ấn:', e.used.map((x) => `${x.d}× Ấn ${TR[x.t].name}`).join(', ') || 'không cần');
  console.log('Kích hoạt:', [...e.activeSet].map((i) => `${e.cnt[i]} ${TR[i].name}`).join(', '));
  console.log('Mã đội:', teamCode(units));
}

// Chế độ "đổi tộc/hệ lấy giá tiền": với mỗi số tộc/hệ mục tiêu k, tìm đội đúng luật app
// có giá trung bình cao nhất mà vẫn kích được ít nhất k tộc/hệ chung.
function searchCost(L, k, restarts, iters, seed0) {
  let seed = seed0;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const pick = () => pool[Math.floor(rnd() * pool.length)];
  const fill = (arr) => { let g = 0; while (slotSum(arr) < L && g++ < 500) { const u = pick(); if (!arr.includes(u) && slotSum(arr) + slots[u] <= L) arr.push(u); } return arr; };
  const obj = (arr) => {
    const e = evaluate(arr);
    const avg = arr.reduce((a, u) => a + U[u].cost, 0) / arr.length;
    return { e, avg, s: -1000 * violations(arr, L, {}) - 400 * Math.max(0, k - e.active) - 60 * e.dead + 20 * avg };
  };
  let best = null;
  for (let r = 0; r < restarts; r++) {
    let cur = fill([]), cs = obj(cur);
    for (let it = 0; it < iters; it++) {
      const next = cur.slice();
      const n = rnd() < 0.7 ? 1 : 2;
      for (let j = 0; j < n; j++) next.splice(Math.floor(rnd() * next.length), 1);
      fill(next);
      const ns = obj(next);
      if (ns.s >= cs.s) { cur = next; cs = ns; }
    }
    if (violations(cur, L, {}) || cs.e.dead || cs.e.active < k) continue;
    if (!best || cs.avg > best.avg + 1e-9) best = { ...cs, units: cur.slice() };
  }
  return best;
}
function printComp(title, best) {
  const { e } = best;
  const units = best.units.slice().sort((a, b) => U[b].tank - U[a].tank || U[b].cost - U[a].cost);
  console.log(`
=== ${title}`);
  console.log('Tướng:', units.map((u) => `${U[u].name} (${U[u].cost}${U[u].tank ? ', tank' : ''})`).join(', '));
  console.log(`Giá TB ${best.avg.toFixed(2)} · ${units.filter((u) => U[u].tank).length} tank · ${units.filter((u) => U[u].cost === 5).length} tướng 5 vàng · ${units.filter((u) => U[u].cost <= 2).length} tướng 1–2 vàng`);
  console.log('Ấn:', e.used.map((x) => `${x.d}× Ấn ${TR[x.t].name}`).join(', ') || 'không cần (gắn ấn tùy ý)');
  console.log(`Kích hoạt (${e.active}):`, [...e.activeSet].map((i) => `${e.cnt[i]} ${TR[i].name}`).join(', '));
  console.log('Mã đội:', teamCode(units));
}
if (process.env.MODE === 'cost') {
  const R2 = Number(process.env.R || 500), IT2 = Number(process.env.IT || 8000);
  const top = { 9: 13, 10: 14 };
  for (const L of [9, 10]) for (let k = top[L]; k >= top[L] - 3; k--) {
    const b = searchCost(L, k, R2, IT2, Number(process.env.SEED || 4242) + L * 100 + k);
    if (b) printComp(`Cấp ${L} · ít nhất ${k} tộc/hệ · giá cao nhất`, b); else console.log(`
=== Cấp ${L} · ${k} tộc/hệ: không tìm được`);
  }
  process.exit(0);
}
const R = Number(process.env.R || 600), IT = Number(process.env.IT || 8000);
for (const L of [9, 10]) {
  if (process.env.RULES === '0') { report(L, 'không luật', null, R, IT); continue; }
  report(L, 'luật app', {}, R, IT);
  report(L, 'luật app + tối đa 2 tướng 1–2 vàng', { maxCheap: 2 }, R, IT);
  report(L, 'luật app + không tướng 1–2 vàng', { maxCheap: 0 }, R, IT);
}
