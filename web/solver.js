// Gợi ý đội hình theo ấn.
// Điểm lấy từ số liệu trận xếp hạng (seemeta) khi có đủ mẫu, kéo về mức trung bình khi mẫu nhỏ:
//   - mỗi mốc tộc/hệ: hạng TB của các đội dừng ở đúng mốc đó
//   - mỗi tướng: hạng TB của tướng
//   - tướng cầm ấn: hạng TB khi tướng đó cầm ấn đó
// Đội hình meta lấy từ TFT Academy.
(function (root) {
  const PRIOR_AVG = 4.5;   // hạng trung bình "không biết gì"
  const PRIOR_GAMES = 500;  // mẫu nhỏ bị kéo về PRIOR_AVG như thể trộn thêm chừng này ván trung bình (MetaTFT có mẫu rất lớn)
  const MIN_GAMES = 300;    // dưới mức này không dùng số liệu

  const TRAIT_K = 10;       // điểm cho mỗi 1 hạng TB tốt hơn mức trung bình (mốc tộc/hệ)
  const UNIT_K = 6;         // như trên, cho tướng
  const HOLDER_K = 8;       // như trên, cho tướng cầm ấn (so với hạng TB của ấn)
  // Thưởng theo chất lượng của chính mốc tộc/hệ (hoặc chính tướng) theo số liệu; kéo tụt hạng thì không thưởng
  const BONUS_GOOD = 2;     // điểm số liệu từ 1 trở lên
  const BONUS_OK = 1;       // ngang trung bình (điểm 0 đến dưới 1)
  const activeBonus = (data) => (data >= 1 ? BONUS_GOOD : data >= 0 ? BONUS_OK : 0);
  const HOLDER_WRONG_ROLE = 15; // ấn sát thương trên tank, hoặc ấn tank trên tướng hàng sau
  const HOLDER_COST_W = 1;   // mỗi bậc giá so với 3 vàng khi chọn người cầm ấn
  const DISPLACE_ITEM = 3;
  const EMBLEM_ON_FILLER = 8; // ấn đưa cho tướng kích hệ (không thuộc nhóm cầm đồ)   // cầm ấn phải bỏ 1 món đồ đang có
  const HOLDER_W = 1;       // trọng số điểm tướng cầm ấn (chỉ khi ấn lên mốc)
  const WASTED_EMBLEM = 10; // ấn không lên mốc (phí ấn)
  const ADAPT_SWAPS = 2;    // số tướng tối đa được đổi khi chỉnh đội mẫu
  const TRAIT_DECAY = [1, 0.6, 0.4, 0.3, 0.25, 0.2]; // trọng số mốc có lợi, xếp từ mạnh tới yếu
  const TRAIT_DECAY_REST = 0.15;
  const JUMP_W = 1;         // thưởng bước nhảy giữa 2 mốc liên tiếp (mốc "đổi trận" như 6 Dũng Sĩ)
  const OVERSHOOT = 4;     // mỗi tướng dư so với mốc đang đạt (vd 3/2): phí 1 ô, trông dở
  const TANK_EACH = 4;      // mỗi tank: cộng điểm (không có số tối thiểu, càng nhiều tank càng tốt)
  const UNUSED_TRAIT = 3; // mỗi tộc/hệ lơ lửng (có tướng nhưng chưa đủ mốc, vd 1/2)
  const IGNORE_BP_FROM = 9;  // tạm thời: mốc từ 9 trở lên (9 Thần Rừng, 11 Hoa Linh…) không được tính thêm
  const BACKLINE_MAX = 4;    // tối đa số tướng hàng sau (đánh xa); người chơi: "3 dame là đủ", thêm 1 chỗ cho Lux
  const BACKLINE_OVER = 8;   // trừ cho mỗi tướng hàng sau vượt mức
  const ITEM_FRONT = 3, ITEM_BACK = 3; // số tướng cầm đồ: 3 hàng trước + 3 hàng sau
  const FILLER_W = 0.3; // tướng kích mốc (không cầm đồ): phần điểm riêng được tính
  const FILLER_TANK = 1.5; // tank không cầm đồ vẫn đỡ đòn một chút
  const CARRY_TRAIT_MISS = 4; // mỗi tộc/hệ lơ lửng của carry cầm đồ
  const NO_FULL_CARRY = 10;   // không carry chính nào được kích đủ tộc/hệ
  const COST_W = 1.5;        // ưu tiên tướng đắt: mỗi bậc giá so với 3 vàng (cộng thêm vào số liệu)
  const POLISH_TOP = 5;      // số đội tốt nhất được "mài"
  const PAIR_TOP = 3;        // số đội đầu bảng được mài bằng cách đổi cặp 2 tướng
  const POLISH_SWAPS = 4;    // số lần đổi tướng tối đa khi mài
  const UNIT_W = 1;         // trọng số điểm tướng
  const DANGLE_CAP = 99;    // số tộc/hệ lơ lửng tối đa bị trừ
  const DEAD_UNIT = 5;      // tướng không kích được tộc/hệ chung nào (tộc/hệ riêng không tính)
  const EMBLEM_WEIGHT = 1.3;
  const MAX_COUNT = 24;

  // Theo cấp: giá tối đa, số 5 vàng tối đa, tank tối thiểu (0 = không giới hạn, theo ý người chơi), giá tối thiểu của carry, số carry tối thiểu.
  const LEVEL_RULES = {
    7: { maxCost: 3, c5: 0, tank: 0, carryCost: 3, carry: 1, dpsMax: 9 },
    8: { maxCost: 4, c5: 0, tank: 0, carryCost: 4, carry: 2, dpsMax: 9 },
    9: { maxCost: 5, c5: 4, tank: 0, carryCost: 4, carry: 2, dpsMax: 9 },
    10: { maxCost: 5, c5: 6, tank: 0, carryCost: 4, carry: 2, dpsMax: 9 },
  };
  const MISSING_TANK = 8;
  // Lux có 9 dạng tộc/hệ, dạng nào xuất hiện là ngẫu nhiên → gặp đúng dạng mong muốn là hên xui.
  // Khả năng gặp đúng dạng trong một ván: TẠM 30% (người chơi: "thấp lắm, cứ thử 30"; chưa có số liệu — cần kiểm chứng lại).
  const LUX_HIT = 0.3;
  const LUX_ALT_TOP = 4; // số đội đầu có Lux được tạo thêm bản không Lux
  const MISSING_CARRY = 6;
  const EXTRA_DPS = 1.5;
  const TIERS = ['S', 'A', 'B', 'C'];
  const TIER_PCT = { S: 10, A: 35, B: 70 }; // tier tuyệt đối: S = top 10%, A = top 35%, B = top 70% các bộ ấn cùng cấp
  const TIER_SCORE = { S: 34, A: 30, B: 22, C: 14, X: 10 };

  // Hạng TB đã hiệu chỉnh theo cỡ mẫu.
  // Nhường lượt cho trình duyệt giữa các bước tính. Dùng MessageChannel thay setTimeout: tab nền làm chậm setTimeout
  // (≥ 1 giây mỗi lần), làm phần tính đập ấn / lối chơi gần như đứng yên khi người dùng chuyển sang tab khác.
  const tick = (() => {
    if (typeof setImmediate === 'function') return () => new Promise((r) => setImmediate(r)); // Node (công cụ kiểm tra)
    if (typeof MessageChannel === 'undefined') return () => new Promise((r) => setTimeout(r, 0));
    const ch = new MessageChannel(), q = [];
    ch.port1.onmessage = () => { const r = q.shift(); if (r) r(); };
    return () => new Promise((r) => { q.push(r); ch.port2.postMessage(0); });
  })();

  function adjAvg(avg, games, prior = PRIOR_AVG, k = PRIOR_GAMES) {
    if (avg == null || !games || games < MIN_GAMES) return prior;
    return (games * avg + k * prior) / (games + k);
  }

  function createSolver(data, meta, scale = root.TFT_SCALE) {
    meta = meta || {};
    const U = data.units;
    const TR = data.traits;
    const NT = TR.length;
    const NU = U.length;
    const unitIdx = new Map(U.map((u, i) => [u.id, i]));
    const statId = (u) => U[u].base || U[u].id; // Lux biến thể dùng số liệu của Lux gốc

    const tank = U.map((u) => (u.tank ? 1 : 0));
    const slotsOf = U.map((u) => u.slots || 1);
    const contrib = U.map((u) => {
      const m = new Map(u.traits.map((t) => [t, 1]));
      for (const [t, n] of u.extra || []) m.set(t, (m.get(t) || 0) + n);
      return [...m.entries()];
    });

    // ---------- Giá trị từng mốc tộc/hệ (từ số liệu) ----------
    const tVal = [];
    const tIdx = [];
    const tNext = [];
    const tExcess = []; // số tướng dư so với mốc đang đạt, theo số lượng
    const bpVal = TR.map(() => []);
    const bpGames = TR.map(() => []);
    TR.forEach((t, ti) => {
      const stats = meta.traits?.[t.id];
      let prevV = 0; // điểm của mốc thấp hơn liền trước (mốc cao không bao giờ kém mốc thấp)
      t.bps.forEach(([min, style], i) => {
        let v;
        const lv = stats?.levels?.find((l) => l.n === min);
        if (t.kind === 'unique' || style === 4) {
          v = 0; // tộc/hệ độc nhất: không ưu tiên
        } else if (lv) {
          const data = TRAIT_K * (PRIOR_AVG - adjAvg(lv.avg, lv.games));
          // Mốc cao ít nhất bằng mốc thấp hơn của cùng tộc/hệ (lên 4 Dũng Sĩ không thể tệ hơn 2 Dũng Sĩ).
          // (Bỏ thưởng bước nhảy: nó làm mốc giữa như 3 Mặt Trăng được điểm cao hơn 5 Mặt Trăng.)
          v = Math.max(data + activeBonus(data), i > 0 ? prevV : -Infinity);
          // Tạm thời bỏ qua mốc cực cao (9, 11): chỉ tính ngang mốc ngay dưới
          if (min >= IGNORE_BP_FROM && i > 0) v = prevV;
          prevV = v;
          bpGames[ti][i] = lv.games;
        } else {
          v = BONUS_OK + 0.15 * min; // không có số liệu: ước lượng nhẹ
        }
        bpVal[ti][i] = v;
      });
      const val = new Float32Array(MAX_COUNT + 1);
      const idx = new Int8Array(MAX_COUNT + 1).fill(-1);
      const next = new Int8Array(MAX_COUNT + 1).fill(0);
      for (let n = 0; n <= MAX_COUNT; n++) {
        t.bps.forEach(([min], i) => { if (n >= min) { val[n] = bpVal[ti][i]; idx[n] = i; } });
        const nb = t.bps.find(([min]) => min > n);
        next[n] = nb ? nb[0] : 0;
      }
      tVal.push(val); tIdx.push(idx); tNext.push(next);
      tExcess.push(Int8Array.from(idx, (i, n) => (i >= 0 && t.kind !== 'unique' ? n - t.bps[i][0] : 0)));
    });

    // ---------- Giá trị tướng (từ số liệu, chấm như mốc tộc/hệ; không cộng trừ theo giá) ----------
    // Chỉ tính các ván tướng ở 1–2 sao: chơi theo ấn thì không reroll, số liệu 3 sao làm tướng rẻ trông mạnh hơn thật.
    const unitStat = (i) => {
      const s = meta.units?.[statId(i)];
      const st = (s?.stars || []).filter((x) => x.n <= 2);
      if (!st.length) return { avg: s?.avg, games: s?.games };
      const games = st.reduce((a, x) => a + x.games, 0);
      return { avg: st.reduce((a, x) => a + x.games * x.avg, 0) / games, games };
    };
    const unitVal = U.map((u, i) => {
      const s = unitStat(i);
      const data = UNIT_K * (PRIOR_AVG - adjAvg(s.avg, s.games));
      return data + activeBonus(data);
    });

    // ---------- Ấn: ai cầm tốt nhất ----------
    // Ấn "chống chịu" nếu phần lớn tướng có tộc/hệ đó là tank, ấn "sát thương" nếu hầu như không.
    const emblemKind = TR.map((t, ti) => {
      const owners = U.filter((u) => !u.hidden && u.traits.includes(ti));
      if (!owners.length) return 'flex';
      const r = owners.filter((u) => u.tank).length / owners.length;
      return r >= 0.6 ? 'tank' : r <= 0.3 ? 'damage' : 'flex';
    });
    const emblemItemTrait = new Map((data.emblems || []).map((e) => [e.id, e.trait]));
    const academyPlaced = new Map(); // "trait|unitId" -> số đội TFT Academy đặt ấn đó cho tướng đó
    for (const c of meta.comps || []) {
      for (const b of c.board) for (const it of b.items) {
        const t = emblemItemTrait.get(it);
        if (t != null) academyPlaced.set(t + '|' + b.id, (academyPlaced.get(t + '|' + b.id) || 0) + 1);
      }
    }
    // Điểm tướng cầm ấn: chấm như mốc tộc/hệ — hạng TB khi tướng đó cầm đúng ấn đó, so với hạng TB chung
    // của ấn; mẫu nhỏ kéo về trung bình (như trộn thêm 1.500 ván), dưới 300 ván thì không dùng;
    // rồi thưởng theo chính số liệu đó (tốt +2, ngang +1, kéo tụt hạng 0).
    // Chỉ khi cặp ấn–tướng thiếu số liệu mới đoán theo kiểu ấn (tank / sát thương) và đội TFT Academy.
    // Luôn áp dụng (kể cả khi có số liệu): ấn sát thương không đưa cho tank; ưu tiên tướng đắt
    // (tướng 1–2 vàng sẽ bị thay giữa trận, không nên giữ ấn).
    function holderScore(t, u) {
      const e = meta.emblems?.[TR[t].id];
      const base = statId(u);
      const h = e?.holders?.find((x) => x.id === base);
      const prior = e?.avg ?? PRIOR_AVG;
      let s;
      if (h && h.games >= MIN_GAMES) {
        const data = HOLDER_K * (prior - adjAvg(h.avg, h.games, prior));
        s = data + activeBonus(data);
      } else {
        s = 0.5 * Math.min(2, academyPlaced.get(t + '|' + U[u].id) || academyPlaced.get(t + '|' + base) || 0);
      }
      const kind = emblemKind[t];
      if (kind === 'damage' && tank[u]) s -= HOLDER_WRONG_ROLE;
      // Ấn tank (Dũng Sĩ, Vệ Quân…) trên tướng hàng sau (đánh xa, không phải tank) thì vô dụng; tướng cận chiến không phải tank chỉ trừ nhẹ
      if (kind === 'tank' && !tank[u]) s -= (U[u].range || 1) >= 3 ? HOLDER_WRONG_ROLE : 3;
      s += HOLDER_COST_W * (U[u].cost - 3);
      return s;
    }

    // ---------- Trạng thái đội & chấm điểm ----------
    let isCarry = U.map(() => 0);
    let currentLevel = 0;
    function setLevel(L) {
      if (L === currentLevel) return;
      currentLevel = L;
      const min = LEVEL_RULES[L].carryCost;
      isCarry = U.map((u) => (!u.tank && u.cost >= min ? 1 : 0));
    }
    const perSlot = new Float32Array(NT).fill(1);
    contrib.forEach((list, u) => list.forEach(([t, n]) => { perSlot[t] = Math.max(perSlot[t], n / slotsOf[u]); }));
    const groups = [...new Set(U.map((u) => u.group).filter(Boolean))];
    const groupBit = U.map((u) => (u.group ? 1 << groups.indexOf(u.group) : 0));

    function emptyState() {
      return { units: [], counts: new Int8Array(NT), own: new Int8Array(NT), m0: 0, m1: 0, m2: 0, slots: 0, c5: 0, tanks: 0, carries: 0, grp: 0 };
    }
    function addUnit(st, u) {
      const word = u >> 5, bit = 1 << (u & 31);
      const counts = st.counts.slice();
      const own = st.own.slice();
      for (const [t, n] of contrib[u]) counts[t] += n;
      for (const t of U[u].traits) own[t]++;
      return {
        units: st.units.concat(u), counts, own,
        m0: word === 0 ? st.m0 | bit : st.m0, m1: word === 1 ? st.m1 | bit : st.m1, m2: word === 2 ? st.m2 | bit : st.m2,
        slots: st.slots + slotsOf[u], c5: st.c5 + (U[u].cost === 5),
        tanks: st.tanks + tank[u], carries: st.carries + isCarry[u], grp: st.grp | groupBit[u],
      };
    }
    function build(units) {
      let st = emptyState();
      for (const u of units) st = addUnit(st, u);
      return st;
    }

    const eff = new Int8Array(NT);
    let target = null;
    let needGroups = 0; // bit các nhóm (vd. Lux) người dùng muốn có trong đội

    // Tướng người dùng muốn có: tướng thường thì đặt sẵn vào đội; tướng gốc ẩn (Lux) thì yêu cầu
    // có 1 bản bất kỳ trong nhóm đó, để thuật toán tự chọn bản hợp nhất.
    function splitLocked(locked = []) {
      const fixed = [];
      let groupsMask = 0;
      for (const u of locked) {
        if (U[u].hidden) {
          const g = groups.indexOf(U[u].en.replace(/\s*\(.+\)$/, ''));
          const gi = g >= 0 ? g : groups.indexOf(U[u].name);
          if (gi >= 0) groupsMask |= 1 << gi;
        } else if (!fixed.includes(u)) fixed.push(u);
      }
      return { fixed, groupsMask };
    }

    const traitPos = [], frontU = [], backU = [];
    const cheapIn = new Uint8Array(NT);
    function score(st, L, ek, final) {
      const nUnits = st.units.length;
      const ramp = final ? 1 : st.slots / L;
      const free = L - st.slots;
      let s = 0;
      traitPos.length = 0;
      for (let t = 0; t < NT; t++) {
        const c = st.counts[t];
        const k = ek[t];
        const add = k ? Math.min(k, nUnits - st.own[t]) : 0;
        const n = Math.min(MAX_COUNT, c + add);
        eff[t] = n;
        if (!n && !k) continue;
        const w = k ? EMBLEM_WEIGHT : 1;
        const v = tVal[t][n];
        // Mốc có lợi: gom lại, mốc mạnh nhất tính đủ, các mốc sau giảm dần (xem dưới). Mốc có hại: trừ đủ.
        if (v > 0) traitPos.push(w * v); else s += w * v;
        if (k) {
          if (tIdx[t][n] > tIdx[t][Math.min(MAX_COUNT, c)]) s += 1.5 * k; else s -= WASTED_EMBLEM * k * ramp;
          if (add < k) s -= 4 * (k - add) * ramp;
        }
        if (!final && n > 0) {
          const m = tNext[t][n];
          if (m) s += 0.4 * w * (n / m) * Math.max(0, tVal[t][m] - v);
        }
      }
      // Mốc chủ lực quyết định trận đấu, mốc phụ chỉ bổ trợ: mốc mạnh nhất ×1, rồi ×0,6, ×0,4, ×0,3…
      // (hạng TB của mỗi mốc đã phản ánh cả đội trong những ván đó; cộng đủ nhiều mốc là đếm trùng)
      const dbg = final && globalThis.__dbg; let s0 = s;
      if (dbg) dbg.push(['mốc có hại + ấn', s]);
      traitPos.sort((a, b) => b - a);
      for (let i = 0; i < traitPos.length; i++) s += traitPos[i] * (TRAIT_DECAY[i] ?? TRAIT_DECAY_REST);
      if (dbg) { dbg.push(['mốc có lợi', s - s0, traitPos.map((x) => +x.toFixed(1))]); s0 = s; }
      for (let t = 0; t < NT; t++) if (eff[t]) s -= OVERSHOOT * tExcess[t][eff[t]] * ramp;
      // Tộc/hệ lơ lửng: có tướng nhưng chưa lên mốc nào (mỗi tướng thêm vào nên hoàn thành một cặp)
      // Tướng 5 vàng mang theo tộc/hệ lẻ là bình thường (lấy vì sức mạnh): chỉ trừ khi có tướng rẻ hơn góp vào
      cheapIn.fill(0);
      for (const u of st.units) if (U[u].cost < 5) for (const t of U[u].traits) cheapIn[t] = 1;
      let dangling = 0;
      for (let t = 0; t < NT; t++) if (eff[t] && cheapIn[t] && TR[t].kind !== 'unique' && tIdx[t][eff[t]] < 0) dangling++;
      s -= UNUSED_TRAIT * Math.min(dangling, DANGLE_CAP) * ramp;
      if (dbg) { dbg.push(['mốc dư', s - s0]); s0 = s; }
      // Đồ có hạn: chỉ ITEM_FRONT tướng hàng trước + ITEM_BACK tướng hàng sau mạnh nhất cầm đồ, tính đủ điểm.
      // Tướng còn lại là tướng kích mốc: giá trị chủ yếu ở mốc họ kích, chỉ tính FILLER_W điểm riêng.
      frontU.length = 0; backU.length = 0;
      for (const u of st.units) ((tank[u] || (U[u].range || 1) <= 2) ? frontU : backU).push(u);
      const own = (u) => UNIT_W * unitVal[u] + COST_W * (U[u].cost - 3);
      frontU.sort((a, b) => own(b) + (tank[b] ? TANK_EACH : 0) - own(a) - (tank[a] ? TANK_EACH : 0));
      backU.sort((a, b) => own(b) - own(a));
      // tướng kích mốc: số liệu riêng giảm còn FILLER_W, ưu tiên giá vẫn tính đủ (người chơi vẫn chọn tướng đắt)
      const filler = (u) => FILLER_W * UNIT_W * unitVal[u] + COST_W * (U[u].cost - 3);
      frontU.forEach((u, i) => { s += i < ITEM_FRONT ? own(u) + (tank[u] ? TANK_EACH : 0) : filler(u) + (tank[u] ? FILLER_TANK : 0); });
      backU.forEach((u, i) => { s += i < ITEM_BACK ? own(u) : filler(u); });
      // Carry cầm đồ ở hàng sau (trừ Lux, tướng linh hoạt) cần được kích tộc/hệ của mình mới có sát thương:
      // mỗi tộc/hệ lơ lửng của carry bị trừ; không carry nào được kích đủ thì trừ nặng
      let carriesSeen = 0, carriesFull = 0;
      for (let i = 0; i < Math.min(ITEM_BACK, backU.length); i++) {
        const u = backU[i];
        if (groupBit[u]) continue;
        let miss = 0, own = 0;
        for (const t of U[u].traits) if (TR[t].kind !== 'unique') { own++; if (tIdx[t][eff[t]] < 0) miss++; }
        if (!own) continue; // tướng chỉ có tộc/hệ độc nhất (vd Ivern): không tính là carry kích đủ
        carriesSeen++;
        s -= CARRY_TRAIT_MISS * miss * ramp;
        if (!miss) carriesFull++;
      }
      // không carry nào kích đủ, hoặc hàng sau chỉ có Lux / tướng độc nhất (không có carry thật)
      if (final && backU.length && !carriesFull) s -= NO_FULL_CARRY;
      for (const u of st.units) {
        const unit = U[u];
        let alive = false;
        for (const t of unit.traits) if (TR[t].kind !== 'unique' && tIdx[t][eff[t]] >= 0) { alive = true; break; }
        if (!alive) s -= DEAD_UNIT * ramp;
      }
      if (dbg) { dbg.push(['tướng (+ tướng chết)', s - s0]); s0 = s; }
      const r = LEVEL_RULES[L];
      const needTank = Math.max(0, r.tank - st.tanks);
      const needCarry = Math.max(0, r.carry - st.carries);
      if (final) s -= MISSING_TANK * needTank + MISSING_CARRY * needCarry;
      else if (needTank + needCarry > free) s -= MISSING_TANK * (needTank + needCarry - free);
      const dps = nUnits - st.tanks;
      if (dps > r.dpsMax) s -= EXTRA_DPS * (dps - r.dpsMax) * ramp;
      // Cân hàng: hàng sau (tướng đánh xa, không phải tank) tối đa BACKLINE_MAX; thừa thì hàng trước mỏng
      let back = 0;
      for (const u of st.units) if (!tank[u] && (U[u].range || 1) >= 3) back++;
      if (back > BACKLINE_MAX) s -= BACKLINE_OVER * (back - BACKLINE_MAX) * ramp;
      if (dbg) { dbg.push(['thiếu tank/carry, thừa sát thương', s - s0]); s0 = s; }
      if (needGroups) {
        const missing = needGroups & ~st.grp;
        if (missing) {
          let n = 0;
          for (let m = missing; m; m &= m - 1) n++;
          if (final || n > free) s -= 100;
        }
      }
      if (target) {
        const have = eff[target.t];
        const missing = target.m - have;
        if (missing > 0 && (final || missing > free * perSlot[target.t])) s -= 100;
        else if (!final) s += 3 * Math.min(have, target.m);
      }
      return s;
    }

    // Tướng bị loại trừ (loại "Lux" gốc thì loại mọi bản Lux).
    function banMask(banned = []) {
      const ban = new Uint8Array(NU);
      for (const b of banned) {
        ban[b] = 1;
        if (U[b].hidden) U.forEach((u, i) => { if (u.base === U[b].id) ban[i] = 1; });
      }
      return ban;
    }

    function solve(emblemTraits, L, beamWidth, locked = [], banned = []) {
      const ban = banMask(banned);
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT);
      for (const t of emblemTraits) ek[t]++;
      const { fixed, groupsMask } = splitLocked(locked);
      needGroups = groupsMask;
      let start = emptyState();
      for (const u of fixed) if (start.slots + slotsOf[u] <= L) start = addUnit(start, u);
      if (start.units.length) start.score = score(start, L, ek, start.slots === L);
      let beam = [start];
      for (let step = 1; step <= L; step++) {
        const seen = new Set();
        const next = [];
        for (const st of beam) {
          if (st.slots >= L) {
            const key = st.m0 + ',' + st.m1 + ',' + st.m2;
            if (!seen.has(key)) { seen.add(key); next.push(st); }
            continue;
          }
          for (let u = 0; u < NU; u++) {
            if (U[u].hidden || ban[u]) continue;
            const word = u >> 5, bit = 1 << (u & 31);
            const m = word === 0 ? st.m0 : word === 1 ? st.m1 : st.m2;
            if (m & bit) continue;
            if (st.slots + slotsOf[u] > L) continue;
            const cost = U[u].cost;
            if (cost > rules.maxCost) continue;
            if (cost === 5 && st.c5 >= rules.c5) continue;
            if (groupBit[u] & st.grp) continue;
            const key = (word === 0 ? st.m0 | bit : st.m0) + ',' + (word === 1 ? st.m1 | bit : st.m1) + ',' + (word === 2 ? st.m2 | bit : st.m2);
            if (seen.has(key)) continue;
            seen.add(key);
            const ns = addUnit(st, u);
            ns.score = score(ns, L, ek, ns.slots === L);
            next.push(ns);
          }
        }
        next.sort((a, b) => b.score - a.score);
        beam = next.slice(0, beamWidth);
      }
      needGroups = 0;
      return beam.filter((st) => st.slots === L);
    }

    // Đặt ấn: mỗi ấn cho tướng có điểm cầm ấn cao nhất (theo số liệu), tướng chưa có tộc/hệ đó.
    // fixed: Map tộc/hệ -> tướng do đội meta chỉ định sẵn.
    // Tướng cầm đồ (giống cách chấm điểm): ITEM_FRONT tướng hàng trước + ITEM_BACK tướng hàng sau mạnh nhất; còn lại là tướng kích hệ
    function itemHolders(units) {
      const own = (u) => UNIT_W * unitVal[u] + COST_W * (U[u].cost - 3);
      const fr = units.filter((u) => tank[u] || (U[u].range || 1) <= 2).sort((a, b) => own(b) + (tank[b] ? TANK_EACH : 0) - own(a) - (tank[a] ? TANK_EACH : 0));
      const bk = units.filter((u) => !(tank[u] || (U[u].range || 1) <= 2)).sort((a, b) => own(b) - own(a));
      return new Set(fr.slice(0, ITEM_FRONT).concat(bk.slice(0, ITEM_BACK)));
    }
    function assignEmblems(units, emblemTraits, fixed, itemCount) {
      const held = new Map();
      const holders = itemHolders(units);
      const out = [];
      for (const t of emblemTraits) {
        // Tối đa 3 món; tướng đã đủ đồ vẫn cầm được ấn nếu bỏ bớt 1 món (bị trừ điểm)
        const can = (u) => !U[u].traits.includes(t) && !(held.get(u) || []).includes(t) && (held.get(u) || []).length < 3;
        const displaced = (u) => Math.max(0, (held.get(u) || []).length + (itemCount?.get(u) || 0) + 1 - 3);
        const f = fixed?.get(t);
        if (f != null && units.includes(f) && can(f)) {
          held.set(f, [...(held.get(f) || []), t]);
          out.push({ trait: t, unit: f, fixed: true });
          continue;
        }
        let best = null;
        let bestScore = -Infinity;
        for (const u of units) {
          if (!can(u)) continue;
          // tướng kích hệ không cầm đồ: đưa ấn cho họ là phí (vd Diana chỉ để kích Mặt Trăng)
          const s = holderScore(t, u) - 2 * (held.get(u)?.length || 0) - DISPLACE_ITEM * displaced(u) - (holders.has(u) ? 0 : EMBLEM_ON_FILLER);
          if (s > bestScore) { bestScore = s; best = u; }
        }
        if (best == null) { out.push({ trait: t, unit: null }); continue; }
        held.set(best, [...(held.get(best) || []), t]);
        out.push({ trait: t, unit: best });
      }
      return out;
    }

    function holderInfo(t, u) {
      const e = meta.emblems?.[TR[t].id];
      const h = e?.holders?.find((x) => x.id === statId(u));
      return h && h.games >= MIN_GAMES ? { avg: h.avg, games: h.games } : null;
    }

    function describe(st, emblemTraits, L, opts = {}) {
      const counts = Array.from(st.counts);
      const placed = assignEmblems(st.units, emblemTraits, opts.fixed, opts.items);
      const base = counts.slice();
      for (const p of placed) if (p.unit != null) counts[p.trait]++;
      const traits = [];
      for (let t = 0; t < NT; t++) {
        if (!counts[t]) continue;
        const n = Math.min(MAX_COUNT, counts[t]);
        const i = tIdx[t][n];
        traits.push({
          trait: t, count: counts[t], active: i >= 0,
          style: i >= 0 ? TR[t].bps[i][1] : 0,
          value: i >= 0 ? bpVal[t][i] : 0,
          games: i >= 0 ? bpGames[t][i] || 0 : 0,
          next: tNext[t][n] || null,
          fromEmblem: counts[t] - base[t],
        });
      }
      const rank = { 6: 5, 5: 4, 3: 3, 1: 2, 4: 1, 0: 0 };
      traits.sort((a, b) => (b.active - a.active) || rank[b.style] - rank[a.style] || b.count - a.count);
      const emblems = placed.map((p) => {
        const c = counts[p.trait];
        const before = c - placed.filter((q) => q.trait === p.trait && q.unit != null).length;
        return {
          ...p, before, after: c,
          gain: tVal[p.trait][Math.min(MAX_COUNT, c)] - tVal[p.trait][Math.min(MAX_COUNT, before)],
          // ấn có tác dụng = giúp tộc/hệ lên được mốc mới (kể cả mốc có số liệu xấu, vd 2 Đao Phủ)
          lifts: tIdx[p.trait][Math.min(MAX_COUNT, c)] > tIdx[p.trait][Math.min(MAX_COUNT, before)],
          stats: p.unit != null ? holderInfo(p.trait, p.unit) : null,
        };
      });
      const units = opts.keepOrder ? st.units.slice()
        : st.units.slice().sort((a, b) => tank[b] - tank[a] || U[b].cost - U[a].cost);
      const carries = opts.carries || st.units.filter((u) => isCarry[u])
        .sort((a, b) => unitVal[b] - unitVal[a]).slice(0, 3);
      return {
        units, traits, emblems, carries,
        score: st.score,
        allUseful: emblems.every((e) => e.unit != null && e.lifts),
        tanks: st.tanks,
        avgCost: st.units.reduce((a, u) => a + U[u].cost, 0) / Math.max(1, st.units.length),
        level: L,
      };
    }

    // Điểm tối đa một tộc/hệ gom được (mỗi nhóm như Lux chỉ 1 tướng).
    function maxPoints(t) {
      const best = new Map();
      U.forEach((u, i) => {
        if (u.hidden) return;
        const n = contrib[i].find(([x]) => x === t)?.[1] || 0;
        if (!n) return;
        const key = u.group || u.id;
        best.set(key, Math.max(best.get(key) || 0, n));
      });
      return [...best.values()].reduce((a, b) => a + b, 0);
    }

    // Hướng đi: tự do; các mốc đáng giá của tộc/hệ ấn; các mốc mạnh nhất theo số liệu.
    function variants(emblemTraits, L, opts = {}) {
      const out = [null];
      const k = {};
      emblemTraits.forEach((t) => (k[t] = (k[t] || 0) + 1));
      for (const t of Object.keys(k).map(Number)) {
        const reach = maxPoints(t) + k[t];
        TR[t].bps.forEach(([m, style], i) => {
          if (style === 4 || m <= k[t] + 1 || m > reach || m - k[t] > L) return;
          if (i > 0 && bpVal[t][i] <= bpVal[t][i - 1] + 0.3) return; // không tốt hơn mốc dưới thì bỏ
          if (bpVal[t][i] < 2) return;
          out.push({ t, m });
        });
      }
      const strong = [];
      TR.forEach((tr, t) => {
        if (k[t] || tr.kind === 'unique') return;
        tr.bps.forEach(([m], i) => {
          if (m < 3 || m > L || m > maxPoints(t) || !bpGames[t][i]) return;
          if (i > 0 && bpVal[t][i] <= bpVal[t][i - 1] + 0.3) return;
          strong.push({ t, m, v: bpVal[t][i], big: true });
        });
      });
      strong.sort((a, b) => b.v - a.v).slice(0, opts.maxBig ?? 6).forEach((v) => out.push(v));
      return out;
    }

    const overlap = (a, b) => { const s = new Set(a.units); return b.units.filter((u) => s.has(u)).length; };

    // opts.beamScale < 1 và opts.maxBig = 0: chạy nhanh (dùng khi phân tích hàng loạt).
    function* suggestSteps(emblemTraits, L = 9, howMany = 6, opts = {}) {
      const limit = Math.ceil(L * 0.6);
      const best = [];
      const extra = [];
      const vs = variants(emblemTraits, L, opts);
      const bw = (w) => Math.max(60, Math.round(w * (opts.beamScale ?? 1)));
      for (const [i, v] of vs.entries()) {
        yield { done: i, total: vs.length };
        target = v;
        const beam = solve(emblemTraits, L, bw(!v ? 600 : v.big ? 200 : 400), opts.locked || [], opts.banned || []);
        target = null;
        const pool = beam.map((st) => describe(st, emblemTraits, L))
          .filter((c) => !v || (c.traits.find((x) => x.trait === v.t)?.count || 0) >= v.m);
        pool.forEach((c) => (c.focus = v));
        const ordered = pool.filter((c) => c.allUseful).concat(pool.filter((c) => !c.allUseful));
        if (ordered[0]) best.push(ordered[0]);
        extra.push(...ordered.slice(1, 40));
      }
      setLevel(L);
      const ek = new Int8Array(NT);
      emblemTraits.forEach((t) => ek[t]++);
      needGroups = splitLocked(opts.locked || []).groupsMask;
      const rescore = (c) => {
        c.score = score(build(c.units), L, ek, true)
          + 0.5 * c.emblems.reduce((a, e) => a + (e.unit != null ? holderScore(e.trait, e.unit) : 0), 0);
      };
      best.forEach(rescore);
      extra.forEach(rescore);
      needGroups = 0;
      const setLabel = (c) => {
        const e = c.traits.filter((x) => x.active && x.style !== 4).sort((a, b) =>
          (emblemTraits.includes(b.trait) * 2 + b.value / 5) - (emblemTraits.includes(a.trait) * 2 + a.value / 5))[0];
        if (e) c.label = { t: e.trait, m: e.count };
      };
      best.forEach(setLabel);
      extra.forEach(setLabel);
      const same = (a, b) => a.label?.t === b.label?.t && a.label?.m === b.label?.m;
      const picked = [];
      const tryAdd = (c) => {
        if (picked.length >= howMany) return;
        if (picked.some((p) => overlap(p, c) >= c.units.length - 1)) return;
        if (picked.some((p) => same(p, c) && overlap(p, c) > limit)) return;
        picked.push(c);
      };
      const order = (a, b) => b.allUseful - a.allUseful || b.score - a.score;
      best.sort(order);
      best.filter((c) => !c.focus || !c.focus.big).forEach(tryAdd);
      best.filter((c) => c.focus && c.focus.big).forEach(tryAdd);
      extra.sort(order).forEach(tryAdd);
      picked.sort(order);
      const top = Math.max(...picked.map((c) => c.score), 1);
      picked.forEach((c) => { c.rating = Math.max(1, Math.round((c.score / top) * 100)); });
      return picked.filter((c, i) => i === 0 || c.rating >= 75);
    }

    async function suggestAsync(emblemTraits, L, howMany, onProgress, opts) {
      const it = suggestSteps(emblemTraits, L, howMany, opts);
      let r = it.next();
      while (!r.done) {
        onProgress?.(r.value);
        await tick();
        r = it.next();
      }
      return r.value;
    }
    function suggest(emblemTraits, L, howMany, opts) {
      const it = suggestSteps(emblemTraits, L, howMany, opts);
      let r = it.next();
      while (!r.done) r = it.next();
      return r.value;
    }

    // ---------- Đội hình thật: TFT Academy (chuyên gia) + seemeta (hạng TB trận xếp hạng) ----------
    const SM_MAX_AVG = 4.6; // đội seemeta có hạng TB tệ hơn mức này thì bỏ
    const teamLevel = (board) => Math.min(10, Math.max(7, board.reduce((a, b) => a + slotsOf[unitIdx.get(b.id)], 0)));
    const prep = (c) => {
      const board = c.board.filter((b) => unitIdx.has(b.id));
      const unitsI = board.map((b) => unitIdx.get(b.id));
      const placedEmblems = [];
      board.forEach((b) => b.items.forEach((it) => {
        const t = emblemItemTrait.get(it);
        if (t != null) placedEmblems.push({ t, u: unitIdx.get(b.id) });
      }));
      return { ...c, board, unitsI, placedEmblems };
    };
    const metaComps = (meta.comps || []).map((c) => prep({ ...c, source: 'academy', quality: TIER_SCORE[c.tier] || 0 }));
    const sameIds = (a, b) => { const s = new Set(a.board.map((x) => x.id)); return b.board.filter((x) => s.has(x.id)).length; };
    // Kiểu đội hình thật của MetaTFT (bản hiện tại): làm đội mẫu và để chấm sức mạnh cả đội
    const mtComps = (meta.mtComps || []).map((c) => prep({ ...c, source: 'metatft', title: c.name, level: teamLevel(c.board), style: '' }));
    metaComps.push(...mtComps);
    // Điểm theo cả đội: giống kiểu đội thật nào nhất (tính theo tướng lõi) thì cộng/trừ theo hạng TB của kiểu đó
    const COMP_K = 40;          // điểm cho mỗi 1 hạng TB tốt hơn 4,5 (cả đội, theo kiểu đội thật của MetaTFT)
    const UNKNOWN_AVG = 4.5;    // đội không giống kiểu thật nào: coi như trung bình (có ấn thì đội hay khác kiểu phổ biến)
    const COMP_MIN_SHARE = 0.85; // phải trùng gần như toàn bộ tướng lõi mới tính (vài tướng lẻ cùng hệ không phải là cùng kiểu đội)
    // Mốc (chỉ số trong bảng mốc, -1 = chưa kích) của một tộc/hệ với số tướng n
    const bpAt = (t, n) => tIdx[t][Math.min(MAX_COUNT, n)];
    function compPrior(units, emblemTraits = []) {
      const have = new Set(units.map((u) => U[u].base || U[u].id));
      // Mốc của các tộc/hệ có ấn trong đội này (giả sử ấn nào cũng gắn được)
      const mine = emblemTraits.length ? build(units).counts : null;
      let best = null;
      for (const c of mtComps) {
        const share = c.board.filter((b) => have.has(b.id)).length / c.board.length;
        if (share < COMP_MIN_SHARE) continue;
        // Ấn đẩy tộc/hệ lên mốc khác kiểu đội thật (vd 5 Mặt Trăng thay vì 3) thì không còn là cùng kiểu đội
        if (mine) {
          const theirs = c.ctCounts || (c.ctCounts = (() => { const k = Array.from(build(c.unitsI).counts); c.placedEmblems.forEach((p) => k[p.t]++); return k; })());
          const ek = {}; emblemTraits.forEach((t) => { ek[t] = (ek[t] || 0) + 1; });
          if (Object.keys(ek).some((t) => bpAt(t, mine[t] + ek[t]) !== bpAt(t, theirs[t]))) continue;
        }
        const v = COMP_K * (PRIOR_AVG - adjAvg(c.avg, c.games)) * share;
        if (!best || share > best.share || (share === best.share && v > best.v)) best = { v, share, comp: c };
      }
      if (!best && mtComps.length) best = { v: COMP_K * (PRIOR_AVG - UNKNOWN_AVG), share: 0, comp: { avg: UNKNOWN_AVG, games: 0 } };
      return best;
    }
    for (const c of meta.smComps || []) {
      if (c.avg > SM_MAX_AVG) continue;
      const p = prep({
        ...c, source: 'seemeta', title: c.name, level: teamLevel(c.board),
        // Quy đổi hạng TB sang thang điểm của tier TFT Academy (A ≈ 30)
        quality: 30 + (4.25 - c.avg) * 25,
      });
      const twin = metaComps.find((m) => m.source === 'academy' && sameIds(m, p) >= 7);
      if (twin) { twin.sm = { avg: c.avg, top4: c.top4, name: c.name }; continue; } // trùng đội TFT Academy: gộp số liệu
      // Không đưa đội chỉ có ở seemeta vào danh sách: bảng đội của họ không có số ván và xếp theo
      // đội hình cuối trận (người sống lâu mới có bàn 9 tướng), nên hạng TB bị đẹp giả.
    }

    function rankMeta(emblemTraits, howMany = 4, locked = [], banned = []) {
      if (!metaComps.length || (!emblemTraits.length && !locked.length)) return [];
      const wantIds = locked.map((u) => U[u].id);
      const banIds = new Set(banned.map((u) => U[u].id));
      const out = [];
      for (const c of metaComps) {
        const L = Math.min(10, Math.max(7, c.level));
        setLevel(L);
        const fixed = new Map();
        const need = [];
        for (const p of c.placedEmblems) {
          if (emblemTraits.includes(p.t)) fixed.set(p.t, p.u);
          else need.push(p.t);
        }
        const st = build(c.unitsI);
        let carries = c.board.filter((b) => b.items.filter((it) => !emblemItemTrait.has(it)).length >= 2 && !U[unitIdx.get(b.id)].tank)
          .map((b) => unitIdx.get(b.id));
        if (!carries.length) carries = c.unitsI.filter((u) => !tank[u]).sort((a, b) => unitVal[b] - unitVal[a]).slice(0, 2);
        const d = describe(st, emblemTraits, L, { fixed, keepOrder: true, carries });
        let fit = 0;
        let useful = 0;
        for (const e of d.emblems) {
          if (e.fixed) { fit += 12; useful++; continue; }
          if (e.unit == null) continue;
          if (e.gain > 2.5) { fit += e.gain + 0.5 * Math.max(0, holderScore(e.trait, e.unit)); useful++; }
        }
        const ids = new Set(c.board.map((b) => b.id).concat(c.unitsI.map((u) => U[u].base).filter(Boolean)));
        if ([...ids].some((id) => banIds.has(id))) continue;
        const hit = wantIds.filter((id) => ids.has(id)).length;
        if (wantIds.length && !hit) continue;
        if (!useful && !(emblemTraits.length === 0 && hit)) continue;
        out.push({ ...d, meta: c, need, hit, metaScore: c.quality + 1.5 * fit - 4 * need.length + 12 * hit });
      }
      out.sort((a, b) => b.metaScore - a.metaScore);
      // Bỏ đội gần như trùng đội đã chọn (2 nguồn có thể có đội giống nhau)
      const picked = [];
      for (const c of out) {
        if (picked.some((p) => sameIds(p.meta, c.meta) >= 7)) continue;
        picked.push(c);
        if (picked.length >= howMany) break;
      }
      return picked;
    }

    // ---------- Gợi ý cho bộ ấn: gom đội đã kiểm chứng + đội tự ghép, chấm chung một thang, xếp S/A/B/C ----------
    // Đội đã kiểm chứng (từ kho đội của chuyên gia) chỉ là kiến thức nền: được cộng điểm ngầm, không hiện nguồn.
    // Thưởng nhỏ cho đội dựa trên đội mẫu TFT Academy: chỉ để phân định khi gần bằng điểm, không lấn át điểm thật
    const KNOWN_BONUS = { S: 5, A: 4, B: 3, C: 2, X: 1 };
    const isReroll = (c) => /reroll/i.test(c.style || '');
    function totalScore(units, emblemTraits, L, placed) {
      setLevel(L);
      const ek = new Int8Array(NT);
      emblemTraits.forEach((t) => ek[t]++);
      // Tướng cầm ấn hợp (vd Ahri cầm Đao Phủ) chỉ được cộng khi ấn đó lên mốc
      return score(build(units), L, ek, true)
        + HOLDER_W * placed.reduce((a, e) => a + (e.unit != null && e.lifts ? holderScore(e.trait, e.unit) : 0), 0);
    }
    // Chỉnh một đội đã kiểm chứng cho hợp bộ ấn: giữ carry đang cầm đồ, bỏ tướng bị loại trừ,
    // thêm tướng muốn có, bù/bớt cho đúng cấp, rồi đổi tối đa 2 tướng nếu giúp ấn lên mốc tốt hơn.
    function adapt(c, emblemTraits, L, locked, ban, cfg = {}) {
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT);
      emblemTraits.forEach((t) => ek[t]++);
      const slotsSum = (arr) => arr.reduce((a, u) => a + slotsOf[u], 0);
      const hasCap = true; // luôn kiểm: giới hạn người dùng + tướng dư mốc
      let frameItems = null; // gán bên dưới
      const evalArr = (arr) => score(build(arr), L, ek, slotsSum(arr) === L)
        - (hasCap && slotsSum(arr) === L ? 4 * overCap(boardStats(arr, emblemTraits, frameItems), cfg) : 0);
      const grpOk = (arr, u) => !groupBit[u] || !arr.some((x) => groupBit[x] & groupBit[u]);
      // Chỉ giữ cứng carry đang cầm đồ; tank thì được thay (luật số tank vẫn giữ)
      const protect = new Set(c.board.filter((b) => b.items.filter((it) => !emblemItemTrait.has(it)).length >= 2).map((b) => unitIdx.get(b.id)).filter((u) => !tank[u]));
      locked.forEach((u) => protect.add(u));
      frameItems = new Map(c.board.map((b) => [unitIdx.get(b.id), b.items.filter((it) => !emblemItemTrait.has(it)).length]));
      let cur = c.unitsI.filter((u) => !ban[u] && (U[u].cost <= rules.maxCost || locked.includes(u)));
      // Lux gốc (không mang tộc/hệ) đổi sang bản Lux hợp với đội nhất
      cur = cur.map((u) => {
        if (!U[u].hidden) return u;
        const opts = U.map((x, i) => i).filter((i) => U[i].base === U[u].id && !ban[i]);
        let best = u, bestS = -Infinity;
        for (const o of opts) { const s2 = evalArr(cur.filter((x) => x !== u).concat(o)); if (s2 > bestS) { bestS = s2; best = o; } }
        return best;
      });
      const canAdd = (arr, u) => !U[u].hidden && !ban[u] && !arr.includes(u) && U[u].cost <= rules.maxCost && grpOk(arr, u);
      // Tướng bỏ ra ít thiệt nhất. hard=true: chỉ giữ cứng tướng người dùng khóa (bỏ được cả carry của đội mẫu)
      const worst = (arr, hard = false) => {
        let best = -1, bestS = -Infinity;
        arr.forEach((u, i) => {
          if (hard ? locked.includes(u) : protect.has(u)) return;
          const s = evalArr(arr.filter((_, j) => j !== i));
          if (s > bestS) { bestS = s; best = i; }
        });
        return best;
      };
      // Tướng muốn có (Lux gốc = bản Lux bất kỳ: chọn bản hợp nhất)
      for (const w of locked) {
        const options = U[w].hidden ? U.map((u, i) => i).filter((i) => U[i].base === U[w].id) : [w];
        if (cur.some((u) => options.includes(u))) continue;
        let bestArr = null, bestS = -Infinity;
        for (const o of options) {
          if (ban[o]) continue;
          let arr = cur.filter((u) => !(groupBit[o] & groupBit[u]));
          while (slotsSum(arr) + slotsOf[o] > L) { const i = worst(arr); if (i < 0) break; arr = arr.filter((_, j) => j !== i); }
          arr = arr.concat(o);
          const s = evalArr(arr);
          if (s > bestS) { bestS = s; bestArr = arr; }
        }
        if (bestArr) { cur = bestArr; protect.add(cur[cur.length - 1]); }
      }
      // Đúng số ô theo cấp
      while (slotsSum(cur) > L) {
        let i = worst(cur);
        if (i < 0) i = worst(cur, true); // hết chỗ: tướng khóa được ưu tiên hơn carry của đội mẫu
        if (i < 0) break;
        cur = cur.filter((_, j) => j !== i);
      }
      while (slotsSum(cur) < L) {
        let best = -1, bestS = -Infinity;
        for (let u = 0; u < NU; u++) {
          if (!canAdd(cur, u) || slotsSum(cur) + slotsOf[u] > L) continue;
          const s = evalArr(cur.concat(u));
          if (s > bestS) { bestS = s; best = u; }
        }
        if (best < 0) break;
        cur = cur.concat(best);
      }
      // Đổi tối đa 2 tướng
      for (let step = 0; step < ADAPT_SWAPS; step++) {
        const base = evalArr(cur);
        let bestArr = null, bestS = base + 0.8;
        cur.forEach((x, i) => {
          if (protect.has(x)) return;
          const rest = cur.filter((_, j) => j !== i);
          for (let u = 0; u < NU; u++) {
            if (!canAdd(rest, u) || u === x || slotsSum(rest) + slotsOf[u] > L) continue;
            const arr = rest.concat(u);
            const s = evalArr(arr);
            if (s > bestS) { bestS = s; bestArr = arr; }
          }
        });
        if (!bestArr) break;
        cur = bestArr;
      }
      // Đủ tank theo cấp (cấp 8 cần 4, cấp 9+ cần 5): đổi tướng không phải tank yếu nhất lấy tank tốt nhất
      for (let guard = 0; guard < 4 && cur.filter((u) => tank[u]).length < rules.tank; guard++) {
        let bestArr = null, bestS = -Infinity;
        cur.forEach((x, i) => {
          if (protect.has(x) || tank[x]) return;
          const rest = cur.filter((_, j) => j !== i);
          for (let u = 0; u < NU; u++) {
            if (!tank[u] || !canAdd(rest, u) || slotsSum(rest) + slotsOf[u] > L) continue;
            const arr = rest.concat(u);
            const s2 = evalArr(arr);
            if (s2 > bestS) { bestS = s2; bestArr = arr; }
          }
        });
        if (!bestArr) break;
        cur = bestArr;
      }
      // Tướng không kích được tộc/hệ chung nào: thay bằng tướng cùng vai trò (tank thay tank) có đóng góp
      for (let guard = 0; guard < 4; guard++) {
        const dead = deadUnits(cur, emblemTraits, frameItems).filter((u) => !protect.has(u));
        if (!dead.length) break;
        let bestArr = null, bestS = -Infinity;
        for (const x of dead) {
          const rest = cur.filter((u) => u !== x);
          for (let u = 0; u < NU; u++) {
            if (tank[u] !== tank[x] || !canAdd(rest, u) || slotsSum(rest) + slotsOf[u] > L) continue;
            const arr = rest.concat(u);
            if (deadUnits(arr, emblemTraits, frameItems).includes(u)) continue;
            const s2 = evalArr(arr);
            if (s2 > bestS) { bestS = s2; bestArr = arr; }
          }
        }
        if (!bestArr) break;
        cur = bestArr;
      }
      // Tướng dư mốc, vượt giới hạn tộc/hệ thừa hoặc tướng có tộc/hệ độc nhất: đổi 1 tướng (cùng vai trò) để giảm vi phạm
      for (let guard = 0; hasCap && guard < 4; guard++) {
        const v0 = overCap(boardStats(cur, emblemTraits, frameItems), cfg);
        if (!v0) break;
        const dead0 = deadUnits(cur, emblemTraits, frameItems).length;
        let bestArr = null, bestV = v0, bestS = -Infinity;
        cur.forEach((x, i) => {
          if (protect.has(x)) return;
          const rest = cur.filter((_, j) => j !== i);
          for (let u = 0; u < NU; u++) {
            if (tank[u] !== tank[x] || !canAdd(rest, u) || slotsSum(rest) + slotsOf[u] > L) continue;
            const arr = rest.concat(u);
            if (deadUnits(arr, emblemTraits, frameItems).length > dead0) continue; // không làm tướng nào thành tướng chết
            const v = overCap(boardStats(arr, emblemTraits, frameItems), cfg);
            if (v > bestV) continue;
            const s2 = evalArr(arr);
            if (v < bestV || s2 > bestS) { bestV = v; bestS = s2; bestArr = arr; }
          }
        });
        if (!bestArr || bestV >= v0) break;
        cur = bestArr;
      }
      return cur;
    }

    // Loại sát thương theo vai trò tướng: "Attack ..." = AD, "Magic ..." = AP
    const dmgType = (u) => { const r = U[u].role || ''; return /^Attack/i.test(r) ? 'AD' : /^Magic/i.test(r) ? 'AP' : null; };
    const hasUnique = (u) => U[u].traits.some((t) => TR[t].kind === 'unique');
    // Tộc/hệ thừa = tộc/hệ chung có tướng (kể cả nhờ ấn) nhưng chưa đủ mốc đầu
    function boardStats(units, emblemTraits, items) {
      const counts = Array.from(build(units).counts);
      for (const p of assignEmblems(units, emblemTraits, null, items)) if (p.unit != null) counts[p.trait]++;
      let unused = 0;
      for (let t = 0; t < NT; t++) if (TR[t].kind !== 'unique' && counts[t] > 0 && tIdx[t][Math.min(MAX_COUNT, counts[t])] < 0) unused++;
      let excess = 0;
      for (let t = 0; t < NT; t++) excess += tExcess[t][Math.min(MAX_COUNT, counts[t])];
      return { unused, uniques: units.filter(hasUnique).length, excess };
    }
    // Số vi phạm: vượt giới hạn người dùng chọn + tướng dư mốc
    const overCap = (st, cfg) => Math.max(0, st.unused - (cfg.maxUnused ?? Infinity)) + Math.max(0, st.uniques - (cfg.maxUnique ?? Infinity)) + st.excess;

    // Tướng trong đội không kích được tộc/hệ chung nào (tính cả ấn, không tính tộc/hệ độc nhất)
    function deadUnits(units, emblemTraits, items) {
      const st = build(units);
      const counts = Array.from(st.counts);
      const placed = assignEmblems(units, emblemTraits, null, items);
      for (const p of placed) if (p.unit != null) counts[p.trait]++;
      const holderTraits = new Map();
      for (const p of placed) if (p.unit != null) holderTraits.set(p.unit, [...(holderTraits.get(p.unit) || []), p.trait]);
      return units.filter((u) => !U[u].traits.concat(holderTraits.get(u) || [])
        .some((t) => TR[t].kind !== 'unique' && tIdx[t][Math.min(MAX_COUNT, counts[t])] >= 0));
    }

    // Rủi ro Lux: đội cần Lux đúng dạng X. Không gặp đúng dạng thì dùng phương án dự phòng tốt nhất cho ô đó
    // (tướng khác, hoặc Lux dạng khác — tính trung bình vì dạng nào ra cũng ngẫu nhiên). Điểm kỳ vọng:
    // điểm khi có X − (1 − LUX_HIT) × (điểm khi có X − điểm dự phòng).
    function luxRisk(units, emblemTraits, L) {
      const i = units.findIndex((u) => U[u].group === 'Lux' && U[u].base);
      if (i < 0) return null;
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT); emblemTraits.forEach((t) => ek[t]++);
      const sc = (arr) => score(build(arr), L, ek, true);
      const withX = sc(units);
      const rest = units.filter((_, j) => j !== i);
      let best = null;
      for (let u = 0; u < NU; u++) {
        if (U[u].hidden || U[u].group === 'Lux' || units.includes(u) || U[u].cost > rules.maxCost) continue;
        if (groupBit[u] && rest.some((x) => groupBit[x] & groupBit[u])) continue;
        const v = sc(rest.concat(u));
        if (!best || v > best.v) best = { unit: u, v };
      }
      const others = U.map((x, k) => k).filter((k) => U[k].group === 'Lux' && U[k].base && k !== units[i]);
      const anyLux = others.length ? others.reduce((a, k) => a + sc(rest.concat(k)), 0) / others.length : -Infinity;
      const fb = !best || anyLux >= best.v ? { unit: null, v: anyLux } : best;
      const loss = Math.max(0, withX - fb.v);
      return { variant: units[i], hit: LUX_HIT, fallback: fb.unit, bestUnit: best ? best.unit : null, loss, penalty: (1 - LUX_HIT) * loss };
    }
    const withLux = (cand, emblemTraits, L) => { const r = luxRisk(cand.units, emblemTraits, L); if (r) { cand.total -= r.penalty; cand.lux = r; } return cand; };
    async function recommendAsync(emblemTraits, L, howMany = 10, onProgress, opts = {}) {
      const carry = opts.carry ?? null;
      const locked = (opts.locked || []).concat(carry != null && !(opts.locked || []).includes(carry) ? [carry] : []);
      const banned = opts.banned || [];
      const ban = banMask(banned);
      const cfg = { maxUnused: opts.maxUnused ?? null, maxUnique: opts.maxUnique ?? null };
      const dmg = opts.dmg || null;
      const isCarryOf = (u) => carry != null && (u === carry || U[u].base === U[carry].id);
      // Đưa carry người chọn (hoặc carry đúng loại AD/AP) lên đầu danh sách carry; null nếu không thỏa
      const orderCarries = (list, units) => {
        let arr = list.slice();
        if (carry != null) {
          const c0 = units.find(isCarryOf);
          if (c0 == null) return null;
          arr = [c0].concat(arr.filter((u) => u !== c0));
        }
        if (dmg) {
          const ok = arr.filter((u) => dmgType(u) === dmg);
          if (!ok.length && carry == null) return null;
          if (carry == null) arr = ok.concat(arr.filter((u) => dmgType(u) !== dmg));
          else if (dmgType(arr[0]) !== dmg) return null;
        }
        return arr;
      };
      const out = [];
      const same = (a, b) => { const s = new Set(a.units.map((u) => U[u].base || U[u].id)); return b.units.filter((u) => s.has(U[u].base || U[u].id)).length; };
      // 1. Từ khung đội đã kiểm chứng: không reroll (có ấn thì không reroll), cấp gần với cấp chọn,
      //    không dựa vào ấn mình không có.
      const maxCost = LEVEL_RULES[L].maxCost;
      const frames = metaComps.filter((c) => (c.source === 'academy' || c.source === 'metatft') && !isReroll(c)
        && c.board.every((b) => b.items.filter((it) => !emblemItemTrait.has(it)).length < 2 || U[unitIdx.get(b.id)].cost <= maxCost)
        && c.level <= L + 1 && c.level >= L - (c.source === 'metatft' ? 2 : 1)
        && c.placedEmblems.every((p) => emblemTraits.includes(p.t))
        // chọn AD/AP: khung phải có carry cầm đồ đúng loại
        && (!dmg || carry != null || c.board.some((b) => b.items.length >= 2 && !tank[unitIdx.get(b.id)] && dmgType(unitIdx.get(b.id)) === dmg)));
      for (const [i, c] of frames.entries()) {
        if (i % 4 === 0) { onProgress?.({ done: i, total: frames.length + 1 }); await tick(); }
        const units = adapt(c, emblemTraits, L, locked, ban, cfg);
        setLevel(L);
        const fixed = new Map(c.placedEmblems.filter((p) => units.includes(p.u)).map((p) => [p.t, p.u]));
        const carries = c.board.filter((b) => b.items.filter((it) => !emblemItemTrait.has(it)).length >= 2 && !tank[unitIdx.get(b.id)])
          .map((b) => unitIdx.get(b.id)).filter((u) => units.includes(u));
        const items = new Map(c.board.map((b) => [unitIdx.get(b.id), b.items.filter((it) => !emblemItemTrait.has(it)).length]));
        let carryList = carries.length ? carries : units.filter((u) => !tank[u]).sort((a, b) => unitVal[b] - unitVal[a]).slice(0, 2);
        if (carry != null && !carryList.some(isCarryOf)) carryList = carryList.concat(units.filter(isCarryOf));
        carryList = orderCarries(carryList, units);
        if (!carryList) continue; // không đúng carry / loại sát thương đã chọn
        const d = describe(build(units), emblemTraits, L, { fixed, keepOrder: true, carries: carryList, items });
        if (emblemTraits.length && !d.emblems.some((e) => e.unit != null && e.lifts)) continue; // ấn không giúp gì
        if (d.emblems.some((e) => e.unit == null)) continue; // không đặt được hết ấn (không còn tướng trống ô đồ)
        // Đếm tướng chết theo đúng cách đặt ấn sẽ hiển thị (không tự chia ấn lại)
        const activeT = new Set(d.traits.filter((t) => t.active && TR[t.trait].kind !== 'unique').map((t) => t.trait));
        d.dead = units.filter((u) => !U[u].traits.concat(d.emblems.filter((e) => e.unit === u).map((e) => e.trait)).some((t) => activeT.has(t))).length;
        d.over = overCap(boardStats(units, emblemTraits, items), cfg);
        if (locked.length && !locked.every((w) => units.some((u) => u === w || U[u].base === U[w].id))) continue;
        if (units.reduce((a, x) => a + slotsOf[x], 0) !== L) continue; // sai số ô so với cấp: bỏ
        const cand = { ...d, frame: c, known: true, level: L,
          total: totalScore(units, emblemTraits, L, d.emblems) + (c.source === 'academy' ? KNOWN_BONUS[c.tier] || 0 : 0) };
        const pr = compPrior(units, emblemTraits); if (pr) { cand.total += pr.v; cand.prior = { avg: pr.comp.avg, games: pr.comp.games, share: pr.share }; }
        withLux(cand, emblemTraits, L);
        const dup = out.findIndex((k) => same(k, cand) >= L - 1);
        if (dup >= 0) { if (out[dup].total < cand.total) out[dup] = cand; continue; }
        out.push(cand);
      }
      const bad = (c) => c.dead > 0 || c.over > 0;
      out.sort((a, b) => b.total - a.total);
      // Đội có tướng chết / vượt giới hạn: bỏ ra, chỉ dùng lại khi không còn đội nào khác
      const spare = out.filter(bad);
      for (let i = out.length - 1; i >= 0; i--) if (bad(out[i])) out.splice(i, 1);
      // 2. Luôn tự ghép thêm (tìm cả những đội không có trong đội mẫu), xếp hạng ngang hàng
      //    nhưng phải qua đủ luật: đủ tank, đủ carry đắt, không tướng chết, không mốc dư, mọi ấn lên mốc
      if (!opts.quick) {
        const rules = LEVEL_RULES[L];
        const algo = await suggestAsync(emblemTraits, L, 8, onProgress, { locked, banned, beamScale: 0.35, maxBig: 2 });
        const addAlgo = (c) => {
          if (c.units.reduce((a, u) => a + slotsOf[u], 0) !== L) return;
          if (c.units.filter((u) => tank[u]).length < rules.tank) return;
          if (c.units.filter((u) => !tank[u] && U[u].cost >= rules.carryCost).length < rules.carry) return;
          if (c.emblems.some((e) => e.unit == null || (emblemTraits.length && !e.lifts))) return;
          if (deadUnits(c.units, emblemTraits).length) return;
          if (overCap(boardStats(c.units, emblemTraits), cfg)) return;
          if (locked.length && !locked.every((w) => c.units.some((u) => u === w || U[u].base === U[w].id))) return;
          const cl = orderCarries(c.carries.length ? c.carries : c.units.filter((u) => !tank[u]), c.units);
          if (!cl) return;
          const cand = { ...c, carries: cl, known: false, level: L, total: totalScore(c.units, emblemTraits, L, c.emblems) };
          const pr = compPrior(c.units, emblemTraits); if (pr) { cand.total += pr.v; cand.prior = { avg: pr.comp.avg, games: pr.comp.games, share: pr.share }; }
          withLux(cand, emblemTraits, L);
          const dup = out.findIndex((k) => same(k, cand) >= L - 2);
          if (dup >= 0) { if (out[dup].total < cand.total) out[dup] = cand; return; }
          out.push(cand);
        };
        for (const c of algo) addAlgo(c);
        out.sort((a, b) => b.total - a.total);
        // 3. Mài đội (như người chơi tinh chỉnh): với vài đội tốt nhất, lần lượt đổi từng tướng
        //    nếu đội mạnh hơn (tối đa POLISH_SWAPS lần), không đụng tướng người dùng khóa
        for (const c of out.slice(0, POLISH_TOP)) {
          const keep = new Set(locked.filter((u) => c.units.includes(u)));
          const p = keepScore(c.units, emblemTraits, L, keep, { banned }, POLISH_SWAPS).units;
          if (p.length === c.units.length && p.every((u) => c.units.includes(u))) continue;
          addAlgo(describe(build(p), emblemTraits, L));
        }
        out.sort((a, b) => b.total - a.total);
        // Đổi cặp cho vài đội đầu bảng
        for (const c of out.slice(0, PAIR_TOP)) {
          await tick();
          const keep = new Set(locked.filter((u) => c.units.includes(u)));
          const p = pairPolish(c.units, emblemTraits, L, keep, { banned });
          if (p.length === c.units.length && p.every((u) => c.units.includes(u))) continue;
          addAlgo(describe(build(p), emblemTraits, L));
        }
        out.sort((a, b) => b.total - a.total);
        // Lux hên xui: với vài đội đầu có Lux, thêm bản KHÔNG Lux (thay bằng tướng dự phòng rồi mài lại) để so công bằng
        const noLux = banned.concat(U.map((x, k) => k).filter((k) => U[k].group === 'Lux'));
        for (const c of out.slice(0, LUX_ALT_TOP)) {
          if (!c.lux || locked.some((u) => U[u].group === 'Lux')) continue;
          await tick();
          const sub = c.lux.fallback ?? c.lux.bestUnit;
          if (sub == null) continue;
          const start = c.units.map((u) => (u === c.lux.variant ? sub : u));
          const keep = new Set(locked.filter((u) => start.includes(u)));
          const p = keepScore(start, emblemTraits, L, keep, { banned: noLux }, POLISH_SWAPS).units;
          addAlgo(describe(build(p), emblemTraits, L));
        }
        out.sort((a, b) => b.total - a.total);
      }
      // Không còn đội nào khác: dùng đội ít lỗi nhất (tướng chết nặng hơn mốc dư / vượt giới hạn)
      if (!out.length) out.push(...spare.sort((a, b) => a.dead - b.dead || a.over - b.over || b.total - a.total));
      const wasted = (c) => c.emblems.some((e) => e.unit == null || !e.lifts);
      const picked = out.slice(0, howMany);
      // Tier tương đối: so với đội tốt nhất không phí ấn của chính bộ ấn này
      const base = picked.filter((c) => !wasted(c));
      const top = Math.max(1, ...(base.length ? base : picked).map((c) => c.total));
      const q = scaleOf(L, emblemTraits.length);
      picked.forEach((c, i) => {
        const r = (c.total / top) * 100;
        let tier = r >= 95 ? 'S' : r >= 86 ? 'A' : r >= 76 ? 'B' : 'C';
        c.rating = Math.round(r);
        // Tier tuyệt đối: so với đội tốt nhất của mọi bộ ấn ở cùng cấp (web/scale.js) — bộ ấn yếu không thể ra S
        if (q) {
          const pct = percentile(q, c.total);
          const abs = pct >= 100 - TIER_PCT.S ? 'S' : pct >= 100 - TIER_PCT.A ? 'A' : pct >= 100 - TIER_PCT.B ? 'B' : 'C';
          if (TIERS.indexOf(abs) > TIERS.indexOf(tier)) tier = abs;
          c.pct = Math.round(pct);
          c.rating = Math.max(0, Math.min(100, Math.round((100 * (c.total - q[0])) / Math.max(1, q[100] - q[0]))));
        }
        // Đội làm phí ấn (ấn không lên mốc) tối đa hạng B
        if (wasted(c) && (tier === 'S' || tier === 'A')) tier = 'B';
        c.tier = tier;
        c.bestInSet = i === 0;
      });
      return picked;
    }

    // Bảng phân vị của nhóm cùng cấp và cùng số ấn (1–4); không có ấn thì không xếp tuyệt đối
    function scaleOf(L, k) {
      const lv = scale?.levels?.[L];
      return k > 0 && lv && !Array.isArray(lv) ? lv[Math.min(4, k)] || null : null;
    }
    // Vị trí (0–100) của một điểm trong bảng phân vị 101 mốc
    function percentile(q, v) {
      if (v <= q[0]) return 0;
      if (v >= q[100]) return 100;
      let i = 0;
      while (i < 100 && q[i + 1] < v) i++;
      const lo = q[i], hi = q[i + 1];
      return i + (hi > lo ? (v - lo) / (hi - lo) : 0);
    }

    // Mã Team Planner (như TFT Academy): "02" + mã hex 3 ký tự CHỮ HOA của từng tướng
    // (tối đa 10, thiếu thì bù 0 cho đủ 30 ký tự) + "TFTSet18".
    function teamCode(units) {
      const body = units.map((u) => U[u].tp).filter((x) => x != null).slice(0, 10)
        .map((x) => x.toString(16).toUpperCase().padStart(3, '0')).join('');
      return '02' + body.padEnd(30, '0') + (data.plannerSet || 'TFTSet' + data.set);
    }

    // ---------- Có nên đập ấn (Búa Rèn: đổi ngẫu nhiên sang 1 ấn khác)? ----------
    // Thử đập từng ấn (thay lần lượt bằng mọi ấn khác); ấn nào đập có lợi thì thử đập chung
    // (bốc ngẫu nhiên nhiều lần). Chọn cách đập (0–3 ấn) có điểm đội tốt nhất kỳ vọng cao nhất.
    function keepScore(units, emblemTraits, L, keepSet, opts = {}, swaps = 2) {
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT);
      emblemTraits.forEach((t) => ek[t]++);
      const ban = banMask(opts.banned || []);
      const slotsSum = (arr) => arr.reduce((a, u) => a + slotsOf[u], 0);
      const ok = (arr, u) => !U[u].hidden && !ban[u] && !arr.includes(u) && U[u].cost <= rules.maxCost
        && (!groupBit[u] || !arr.some((x) => groupBit[x] & groupBit[u]));
      let cur = units.slice();
      for (let step = 0; step < swaps; step++) {
        let best = null, bestS = score(build(cur), L, ek, true) + 0.8;
        cur.forEach((x, i) => {
          if (keepSet.has(x)) return;
          const rest = cur.filter((_, j) => j !== i);
          for (let u = 0; u < NU; u++) {
            if (!ok(rest, u) || slotsSum(rest) + slotsOf[u] > L) continue;
            const arr = rest.concat(u);
            const sc = score(build(arr), L, ek, slotsSum(arr) === L);
            if (sc > bestS) { bestS = sc; best = arr; }
          }
        });
        if (!best) break;
        cur = best;
      }
      const d = describe(build(cur), emblemTraits, L, { keepOrder: true });
      return { total: totalScore(cur, emblemTraits, L, d.emblems), units: cur };
    }

    // Mài bằng cách đổi CẶP 2 tướng cùng lúc (đổi lẻ thường làm vỡ mốc giữa chừng).
    // Chỉ xét tướng từ 3 vàng có tộc/hệ của ấn hoặc tộc/hệ đang có trong đội, để không quá chậm.
    function pairPolish(units, emblemTraits, L, keepSet, opts = {}, iters = 3) {
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT);
      emblemTraits.forEach((t) => ek[t]++);
      const ban = banMask(opts.banned || []);
      const sc = (arr) => score(build(arr), L, ek, true);
      const slotsSum = (arr) => arr.reduce((a, u) => a + slotsOf[u], 0);
      const ok = (arr, u) => !U[u].hidden && !ban[u] && !arr.includes(u) && U[u].cost <= rules.maxCost
        && (!groupBit[u] || !arr.some((x) => groupBit[x] & groupBit[u]));
      let cur = units.slice(), cs = sc(cur);
      for (let it = 0; it < iters; it++) {
        const have = new Set(cur.flatMap((x) => U[x].traits));
        const pool = [];
        for (let i = 0; i < NU; i++) if (!U[i].hidden && U[i].cost >= 3 && U[i].traits.some((t) => have.has(t) || ek[t])) pool.push(i);
        let bArr = null, bS = cs + 0.8;
        for (let a = 0; a < cur.length; a++) {
          if (keepSet.has(cur[a])) continue;
          for (let b = a + 1; b < cur.length; b++) {
            if (keepSet.has(cur[b])) continue;
            const rest = cur.filter((_, j) => j !== a && j !== b);
            for (const x of pool) {
              if (!ok(rest, x)) continue;
              const r1 = rest.concat(x);
              for (const y of pool) {
                if (y <= x || !ok(r1, y)) continue;
                const arr = r1.concat(y);
                if (slotsSum(arr) !== L) continue;
                const v = sc(arr);
                if (v > bS) { bS = v; bArr = arr; }
              }
            }
          }
        }
        if (!bArr) break;
        cur = bArr; cs = bS;
      }
      return cur;
    }

    const REFORGE_MIN_GAIN = 3;   // tăng trung bình tối thiểu (điểm) mới khuyên đập
    const REFORGE_SAMPLES = 24;   // số lần bốc thử khi đập từ 2 ấn trở lên
    async function reforgeAdvice(emblemTraits, L, opts = {}, onProgress, shouldStop) {
      const pool = [...new Set((data.emblems || []).map((e) => e.trait))];
      const keep = opts.keep;
      const keepSet = keep ? new Set(keep.keep || []) : null;
      const bestOf = async (ems) => {
        if (keep) { await null; return keepScore(keep.units, ems, L, keepSet, opts).total; }
        const r = await recommendAsync(ems, L, 6, null, { ...opts, quick: true });
        return Math.max(0, ...r.map((c) => c.total));
      };
      const n = emblemTraits.length;
      let done = 0;
      const total = n * (pool.length - 1) + 1;
      const tick = () => { done++; onProgress?.(Math.min(1, done / (total + REFORGE_SAMPLES * 2))); };
      const base = await bestOf(emblemTraits); tick();
      const singles = [];
      for (let i = 0; i < n; i++) {
        const outs = [];
        for (const j of pool) {
          if (j === emblemTraits[i]) continue;
          if (shouldStop?.()) return null;
          const ems = emblemTraits.slice(); ems[i] = j;
          outs.push({ trait: j, total: await bestOf(ems) }); tick();
        }
        const avg = outs.reduce((a, o) => a + o.total, 0) / outs.length;
        outs.sort((a, b) => b.total - a.total);
        singles.push({ index: i, trait: emblemTraits[i], gain: avg - base, better: outs.filter((o) => o.total > base).length, of: outs.length,
          best: outs.slice(0, 3).map((o) => o.trait) });
      }
      // Phương án: giữ hết, đập 1 ấn, hoặc đập chung các ấn đập riêng đã có lợi
      const options = [{ idx: [], gain: 0, better: 0, of: 0 }];
      for (const sgl of singles) options.push({ idx: [sgl.index], gain: sgl.gain, better: sgl.better, of: sgl.of });
      const good = singles.filter((x) => x.gain > 0).sort((a, b) => b.gain - a.gain).map((x) => x.index);
      let seed = 12345;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let k = 2; k <= good.length; k++) {
        const idx = good.slice(0, k);
        let sum = 0, better = 0;
        for (let m = 0; m < REFORGE_SAMPLES; m++) {
          if (shouldStop?.()) return null;
          const ems = emblemTraits.slice();
          for (const i of idx) { let j; do { j = pool[Math.floor(rnd() * pool.length)]; } while (j === emblemTraits[i]); ems[i] = j; }
          const t = await bestOf(ems); tick();
          sum += t; if (t > base) better++;
        }
        options.push({ idx, gain: sum / REFORGE_SAMPLES - base, better, of: REFORGE_SAMPLES });
      }
      options.sort((a, b) => b.gain - a.gain);
      const pick = options.find((o) => o.idx.length === 0 || o.gain >= REFORGE_MIN_GAIN) || options.find((o) => o.idx.length === 0);
      onProgress?.(1);
      return { base, singles, pick: { ...pick, traits: pick.idx.map((i) => emblemTraits[i]) } };
    }

    // ---------- Hai lối chơi: "Lên 8" và "Lên 9" (hai con đường riêng, không phải hai chặng của một đường) ----------
    // Lên 8: thiếu kinh tế, roll ở cấp 8 lấy bài thủ → đội mạnh nhất cấp 8; sống lâu dư vàng thì thêm 1 tướng lên 9, không bán.
    // Lên 9: kinh tế mạnh, chịu bán máu giai đoạn 4 (bài chịu máu không roll), lên 9 roll tướng 5 vàng → đội mạnh nhất cấp 9,
    //        bài chịu máu = tướng 1–4 vàng của đội cuối + tướng bù mạnh nhất, lên 9 chỉ bán tướng bù; cấp 10 thêm 1 tướng.
    const PLAN_SELL = 3;   // bài chịu máu: mỗi tướng bù (sẽ bán khi lên 9) trừ chừng này điểm thang 100
    const PLAN_PICK = 10;  // chênh lệch phân vị để khuyên hẳn một lối chơi
    const toRating = (total, L, k) => {
      const q = scaleOf(L, k);
      return q ? (100 * (total - q[0])) / Math.max(1, q[100] - q[0]) : total;
    };
    const pctOf = (total, L, k) => { const q = scaleOf(L, k); return q ? percentile(q, total) : null; };
    // Chấm một đội ở cấp L, giữ nguyên tướng cầm ấn từ bước trước (ấn đã gắn thì không chuyển được)
    function levelEval(units, emblemTraits, L, fixed, k = emblemTraits.length) {
      setLevel(L);
      const d = describe(build(units), emblemTraits, L, { fixed, keepOrder: true });
      let total = totalScore(units, emblemTraits, L, d.emblems);
      const pr = compPrior(units, emblemTraits); if (pr) total += pr.v;
      const lux = luxRisk(units, emblemTraits, L); if (lux) total -= lux.penalty;
      return { units, lux, emblems: d.emblems, traits: d.traits, carries: d.carries, total, rating: toRating(total, L, k), pct: pctOf(total, L, k), level: L,
        levelling: pr?.share ? pr.comp.levelling || null : null,
        fixed: new Map(d.emblems.filter((e) => e.unit != null).map((e) => [e.trait, e.unit])) };
    }
    const sameUnit = (a, b) => a === b || (U[a].base && U[a].base === U[b].base);
    const slotsSum = (arr) => arr.reduce((a, u) => a + slotsOf[u], 0);
    // Thêm tướng tốt nhất cho tới đủ L ô (không bán ai)
    function grow(prev, emblemTraits, L, ban) {
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const ek = new Int8Array(NT); emblemTraits.forEach((t) => ek[t]++);
      const ok = (arr, u) => !U[u].hidden && !ban[u] && !arr.includes(u) && U[u].cost <= rules.maxCost
        && (!groupBit[u] || !arr.some((x) => groupBit[x] & groupBit[u]));
      let cur = prev.slice();
      while (slotsSum(cur) < L) {
        let best = null, bs = -Infinity;
        for (let u = 0; u < NU; u++) {
          if (!ok(cur, u) || slotsSum(cur) + slotsOf[u] > L) continue;
          const arr = cur.concat(u);
          const sc = score(build(arr), L, ek, slotsSum(arr) === L);
          if (sc > bs) { bs = sc; best = arr; }
        }
        if (!best) break;
        cur = best;
      }
      return cur;
    }
    // Bớt tướng (bỏ đi ít thiệt nhất) cho vừa L ô, giữ tướng trong keep
    function shrink(units, emblemTraits, L, keep) {
      setLevel(L);
      const ek = new Int8Array(NT); emblemTraits.forEach((t) => ek[t]++);
      let cur = units.slice();
      while (slotsSum(cur) > L) {
        let best = null, bs = -Infinity;
        cur.forEach((x, i) => {
          if (keep.has(x)) return;
          const arr = cur.filter((_, j) => j !== i);
          const sc = score(build(arr), L, ek, slotsSum(arr) === L);
          if (sc > bs) { bs = sc; best = arr; }
        });
        if (!best) break;
        cur = best;
      }
      return cur;
    }
    // Chuỗi các bước (mỗi bước: cấp + đội). Ấn tháo ra được, nên mỗi bước tự gắn ấn cho người hợp nhất.
    function runSteps(lv, emblemTraits) {
      return lv.map(([L, us], i) => {
        const st = levelEval(us, emblemTraits, L);
        st.waiting = [];
        const prev = i ? lv[i - 1][1] : null;
        st.added = prev ? us.filter((u) => !prev.some((p) => sameUnit(p, u))) : [];
        st.removed = prev ? prev.filter((p) => !us.some((u) => sameUnit(p, u))) : [];
        return st;
      });
    }
    async function planAsync(emblemTraits, opts = {}, onProgress) {
      const k = emblemTraits.length;
      const ban = banMask(opts.banned || []);
      onProgress?.(0.05);
      const rec8 = (await recommendAsync(emblemTraits, 8, 6, null, opts)).slice(0, 5);
      onProgress?.(0.45);
      const rec9 = (await recommendAsync(emblemTraits, 9, 6, null, opts)).slice(0, 5);
      onProgress?.(0.85);
      // --- Lên 8: đội mạnh nhất cấp 8; lên được 9 thì thêm 1 tướng, không bán ---
      let up8 = null;
      if (rec8.length) {
        const top = rec8[0];
        const u9 = grow(top.units, emblemTraits, 9, ban);
        up8 = { steps: runSteps([[8, top.units], [9, u9]], emblemTraits) };
        // Chỉ thêm 1 tướng: giữ nguyên chỗ gắn ấn của cấp 8, không tháo ra gắn lại
        const keepEm = levelEval(u9, emblemTraits, 9, up8.steps[0].fixed);
        up8.steps[1] = { ...keepEm, waiting: [], added: up8.steps[1].added, removed: up8.steps[1].removed };
        up8.main = up8.steps[0];
      }
      // --- Lên 9: đội đích = đội mạnh nhất cấp 9; bài chịu máu ở cấp 8 ít phải bán nhất mà vẫn đủ mạnh ---
      let up9 = null;
      if (rec9.length) {
        const target = rec9[0];
        const keep = new Set(opts.locked || []);
        const core = target.units.filter((u) => U[u].cost <= LEVEL_RULES[8].maxCost); // tướng của đội cuối mua được sớm
        const opts8 = [];
        if (slotsSum(core) > 8) opts8.push(shrink(core, emblemTraits, 8, keep));
        else {
          opts8.push(grow(core, emblemTraits, 8, ban));
          for (const r of rec8) { // bù bằng tướng của một đội cấp 8 mạnh
            const cur = core.slice();
            for (const u of r.units) if (!cur.includes(u) && slotsSum(cur) + slotsOf[u] <= 8 && !(groupBit[u] && cur.some((x) => groupBit[x] & groupBit[u]))) cur.push(u);
            if (slotsSum(cur) === 8) opts8.push(cur);
          }
        }
        const u10 = grow(target.units, emblemTraits, 10, ban);
        // So: đội cấp 9 mạnh hơn trước (gần như luôn là đội đích), rồi bài chịu máu mạnh hơn − tướng phải bán
        // Bài chịu máu: mạnh nhất có thể, trừ điểm cho mỗi tướng bù sẽ phải bán khi lên 9
        const v8 = (p) => p[0].rating - PLAN_SELL * p[1].removed.length;
        let best = null;
        for (const u8 of opts8) {
          const p = runSteps([[8, u8], [9, target.units], [10, u10]], emblemTraits);
          if (!best || v8(p) > v8(best)) best = p;
        }
        if (best) up9 = { steps: best, main: best[1] };
      }
      onProgress?.(1);
      if (!up8 && !up9) return null;
      // Khuyên lối nào: so vị trí của đội chính trong nhóm cùng cấp, cùng số ấn
      const p8 = up8?.main.pct, p9 = up9?.main.pct;
      let pick = null;
      if (p8 != null && p9 != null) pick = p9 >= p8 + PLAN_PICK ? 'up9' : p8 >= p9 + PLAN_PICK ? 'up8' : 'both';
      return { up8, up9, pick };
    }

    // ---------- Đội mạnh nhất KHÔNG ấn ở cấp L ----------
    // Chỉ dùng số liệu tướng + tộc/hệ (bộ chấm điểm của app): không đội mẫu (TFT Academy / kiểu đội MetaTFT),
    // không điểm "giống kiểu đội thật". Tìm bằng beam rộng + mài đổi từng tướng + đổi cặp, đủ luật như gợi ý theo ấn.
    async function bestComps(L, howMany = 6, onProgress) {
      setLevel(L);
      const rules = LEVEL_RULES[L];
      const none = new Int8Array(NT);
      const cfg = { maxUnused: 3, maxUnique: null };
      const key = (u) => U[u].base || U[u].id;
      const same = (a, b) => { const k = new Set(a.map(key)); return b.filter((u) => k.has(key(u))).length; };
      const out = [];
      const add = (units) => {
        setLevel(L);
        if (units.reduce((a, u) => a + slotsOf[u], 0) !== L) return;
        if (units.filter((u) => tank[u]).length < rules.tank) return;
        if (units.filter((u) => !tank[u] && U[u].cost >= rules.carryCost).length < rules.carry) return;
        if (deadUnits(units, []).length || overCap(boardStats(units, []), cfg)) return;
        const lux = luxRisk(units, [], L);
        const total = score(build(units), L, none, true) - (lux ? lux.penalty : 0);
        const dup = out.findIndex((k) => same(k.units, units) >= L - 1);
        if (dup >= 0) { if (out[dup].total < total) out[dup] = { units, total, lux }; return; }
        out.push({ units, total, lux });
      };
      const algo = await suggestAsync([], L, 16, onProgress, { beamScale: 1, maxBig: 6 });
      for (const c of algo) add(c.units);
      out.sort((a, b) => b.total - a.total);
      for (const c of out.slice(0, POLISH_TOP)) { await tick(); add(keepScore(c.units, [], L, new Set(), {}, POLISH_SWAPS).units); }
      out.sort((a, b) => b.total - a.total);
      for (const c of out.slice(0, PAIR_TOP)) { await tick(); add(pairPolish(c.units, [], L, new Set(), {})); }
      out.sort((a, b) => b.total - a.total);
      return out.slice(0, howMany);
    }

    // ---------- Gặp tướng 5 vàng thì thay ai (như "Flex Units" của TFT Academy) ----------
    // Đội cấp 8 không dựa vào tướng 5 vàng; nếu gặp một tướng 5 vàng (trừ Lux — gặp cũng khó đúng hệ) thì thay
    // tướng nào để đội mạnh lên nhiều nhất. Ấn được gắn lại tự do. pure = chỉ số liệu (tab "Đội mạnh nhất").
    function upgrades5(units, emblemTraits, L, opts = {}) {
      setLevel(L);
      const ek = new Int8Array(NT); emblemTraits.forEach((t) => ek[t]++);
      const key = (u) => U[u].base || U[u].id;
      const have = new Set(units.map(key));
      const ban = banMask(opts.banned || []);
      const keep = new Set(opts.locked || []);
      const val = (arr) => {
        if (opts.pure) return score(build(arr), L, ek, true);
        const d = describe(build(arr), emblemTraits, L);
        const pr = compPrior(arr, emblemTraits);
        return totalScore(arr, emblemTraits, L, d.emblems) + (pr ? pr.v : 0);
      };
      const base = val(units);
      const out = [];
      for (let u = 0; u < NU; u++) {
        if (U[u].cost !== 5 || U[u].hidden || U[u].group === 'Lux' || ban[u] || have.has(key(u))) continue;
        let best = null;
        units.forEach((x, i) => {
          if (keep.has(x) || slotsOf[x] !== slotsOf[u]) return;
          const arr = units.slice(); arr[i] = u;
          const v = val(arr);
          if (!best || v > best.total) best = { add: u, remove: x, total: v, units: arr };
        });
        if (best && best.total > base) out.push({ ...best, gain: best.total - base });
      }
      return out.sort((a, b) => b.gain - a.gain).slice(0, opts.howMany || 3);
    }

    // Chấm một đội bất kỳ theo đúng cách xếp hạng gợi ý (để kiểm tra / so với đội người chơi tự xếp)
    function evalComp(units, emblemTraits, L) {
      setLevel(L);
      const d = describe(build(units), emblemTraits, L);
      let total = totalScore(units, emblemTraits, L, d.emblems);
      const pr = compPrior(units, emblemTraits); if (pr) total += pr.v;
      const lux = luxRisk(units, emblemTraits, L); if (lux) total -= lux.penalty;
      return { ...d, total, lux, prior: pr && pr.share ? { avg: pr.comp.avg, share: pr.share, v: pr.v } : null,
        dead: deadUnits(units, emblemTraits).length, over: overCap(boardStats(units, emblemTraits), { maxUnused: 3, maxUnique: 3 }) };
    }
    return { LUX_HIT, suggest, suggestAsync, rankMeta, recommendAsync, reforgeAdvice, planAsync, bestComps, upgrades5, teamCode, scaleOf, evalComp, LEVEL_RULES, MIN_GAMES, _score: (units, emblemTraits, L) => { setLevel(L); const ek = new Int8Array(NT); emblemTraits.forEach((t) => ek[t]++); return score(build(units), L, ek, true); } };
  }

  root.createSolver = createSolver;
  if (typeof module !== 'undefined') module.exports = { createSolver };
})(typeof window !== 'undefined' ? window : globalThis);
