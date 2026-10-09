// Số liệu trận xếp hạng từ MetaTFT (bản hiện tại, Bạch Kim trở lên).
// API công khai mà chính trang metatft.com dùng. Mỗi mục trả về phân bố hạng 1..8 ("places").
//   - units: mọi tướng
//   - traits: từng mốc tộc/hệ (tên dạng <tộc/hệ>_<chỉ số dòng hiệu ứng>)
//   - unit_detail_overall: tướng theo số sao
//   - unit_detail_items (không lọc số món): tướng theo từng món đồ đang cầm (có cả ấn) → số liệu cặp ấn–tướng
const API = 'https://api-hc.metatft.com/tft-stat-api';
const RANKS = 'CHALLENGER,DIAMOND,EMERALD,GRANDMASTER,MASTER,PLATINUM';
const Q = `queue=1100&patch=current&days=3&rank=${RANKS}&permit_filter_adjustment=true`;
// Cùng một tướng nhưng MetaTFT tách theo dạng (AD/AP): gộp về mã trong app
const ALIAS = { DA_Gromp18_AD: 'DA_Gromp18_AP', DA_KogMaw18_AP: 'DA_KogMaw18_AD' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(`${API}/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (personal TFT helper)' } });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (e) {
      if (i === 2) throw e;
      await sleep(1500);
    }
  }
}

const add = (a, b) => (a ? a.map((x, i) => x + (b[i] || 0)) : b.slice());
const total = (p) => p.reduce((a, b) => a + b, 0);
const stat = (p) => {
  const g = total(p);
  if (!g) return { avg: null, top4: null, games: 0 };
  const avg = p.reduce((a, b, i) => a + b * (i + 1), 0) / g;
  const top4 = (p[0] + p[1] + p[2] + p[3]) / g * 100;
  return { avg: Math.round(avg * 1000) / 1000, top4: Math.round(top4 * 10) / 10, games: g };
};

export async function fetchMetaTFT(data, log = console.log) {
  const ids = new Set(data.units.map((u) => u.id));
  const unitsRaw = await get(`units?${Q}`);
  const boards = unitsRaw.games?.[0]?.count || 0; // số lượt đội (8 mỗi trận)
  const patch = unitsRaw.games?.[0] ? unitsRaw.games[0].patch + (unitsRaw.games[0].b_patch_version || '') : '';

  // Tướng
  const uPlaces = new Map();
  for (const r of unitsRaw.results || []) {
    const id = ALIAS[r.unit] || r.unit;
    if (ids.has(id)) uPlaces.set(id, add(uPlaces.get(id), r.places));
  }
  const units = {};
  for (const [id, p] of uPlaces) units[id] = { ...stat(p), pick: Math.round(total(p) / boards * 1000) / 10 };

  // Từng mốc tộc/hệ: chỉ số dòng hiệu ứng → số tướng tối thiểu (effMin)
  const traitsRaw = await get(`traits?${Q}`);
  const tPlaces = new Map(); // traitId -> Map(n -> places)
  for (const r of traitsRaw.results || []) {
    const m = r.trait.match(/^(.*)_(\d+)$/);
    if (!m) continue;
    const tr = data.traits.find((t) => t.id === m[1]);
    if (!tr) continue;
    const n = (tr.effMin || tr.bps.map(([x]) => x))[+m[2] - 1];
    if (n == null) continue;
    if (!tPlaces.has(tr.id)) tPlaces.set(tr.id, new Map());
    const lv = tPlaces.get(tr.id);
    lv.set(n, add(lv.get(n), r.places));
  }
  const traits = {};
  for (const [id, lv] of tPlaces) {
    let all = null;
    for (const p of lv.values()) all = add(all, p);
    const sAll = stat(all);
    traits[id] = {
      ...sAll,
      levels: [...lv.entries()].sort((a, b) => a[0] - b[0])
        .map(([n, p]) => ({ n, ...stat(p), share: Math.round(total(p) / sAll.games * 1000) / 10 })),
    };
  }

  // Theo tướng: số sao + đồ đang cầm (ấn)
  const emblemTrait = new Map((data.emblems || []).map((e) => [e.id, data.traits[e.trait].id]));
  const holders = {}; // traitId -> Map(unitId -> places)
  const list = [...uPlaces.keys()];
  for (let i = 0; i < list.length; i += 5) {
    await Promise.all(list.slice(i, i + 5).map(async (id) => {
      const q = `${Q}&unit=${id}`;
      const [ov, it] = await Promise.all([get(`unit_detail_overall?${q}`), get(`unit_detail_items?${q}`)]);
      const byStar = new Map();
      for (const l of ov.levels || []) byStar.set(+l.lvl_items[0], add(byStar.get(+l.lvl_items[0]), l.places));
      const g = units[id].games || 1;
      units[id].stars = [...byStar.entries()].sort((a, b) => a[0] - b[0])
        .map(([n, p]) => ({ n, ...stat(p), share: total(p) / g }));
      for (const r of it.items || []) {
        const name = r.itemName.replace(/-\d+$/, '');
        const t = emblemTrait.get(name);
        if (!t) continue;
        if (!holders[t]) holders[t] = new Map();
        holders[t].set(id, add(holders[t].get(id), r.places));
      }
    }));
    log?.('.');
    await sleep(300);
  }
  const emblems = {};
  for (const [t, m] of Object.entries(holders)) {
    let all = null;
    for (const p of m.values()) all = add(all, p);
    emblems[t] = {
      ...stat(all),
      holders: [...m.entries()].map(([id, p]) => ({ id, ...stat(p), pick: Math.round(total(p) / total(all) * 1000) / 10 }))
        .sort((a, b) => b.games - a.games),
    };
  }
  return { units, traits, emblems, info: { name: 'MetaTFT', url: 'https://www.metatft.com/units', patch, boards, matches: Math.round(boards / 8), range: '3 ngày gần nhất' } };
}

// Các kiểu đội hình thật (MetaTFT gom cụm trận đấu): tướng lõi, đồ phổ biến nhất, hạng TB ở bản hiện tại.
// Dùng làm đội mẫu và để chấm sức mạnh của cả đội (không chỉ cộng từng mốc).
const COMPS = 'https://api-hc.metatft.com/tft-comps-api';
export async function fetchMetaComps(data) {
  const ids = new Set(data.units.map((u) => u.id));
  const emblemIds = new Set((data.emblems || []).map((e) => e.id));
  const getC = async (path) => (await fetch(`${COMPS}/${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 (personal TFT helper)' } })).json();
  const [cd, cs] = await Promise.all([getC('comps_data?queue=1100'), getC(`comps_stats?${Q}`)]);
  const stats = new Map((cs.results || []).filter((r) => r.cluster).map((r) => [String(r.cluster), r.places.slice(0, 8)]));
  const out = [];
  for (const c of Object.values(cd.results?.data?.cluster_details || {})) {
    const p = stats.get(String(c.Cluster));
    if (!p) continue;
    const st = stat(p);
    const units = c.units_string.split(', ').map((u) => ALIAS[u] || u).filter((u) => ids.has(u));
    if (units.length < 6) continue;
    // Đồ: bộ phổ biến nhất của tướng nào thường cầm đủ 3 món (carry / tank chính); bỏ ấn ra
    const best = new Map();
    for (const b of c.builds || []) {
      const id = ALIAS[b.unit] || b.unit;
      if (!units.includes(id) || b.num_items !== 3) continue;
      if (!best.has(id) || best.get(id).count < b.count) best.set(id, b);
    }
    const holders = [...best.values()].sort((a, b) => b.unit_numitems_count - a.unit_numitems_count).slice(0, 3);
    const board = units.map((id) => {
      const b = holders.find((h) => (ALIAS[h.unit] || h.unit) === id);
      return { id, stars: 2, items: b ? b.buildName.filter((it) => !emblemIds.has(it)) : [] };
    });
    out.push({ id: c.Cluster, name: c.name_string, board, avg: st.avg, top4: st.top4, games: st.games, levelling: c.levelling || null }); // levelling: lối lên cấp hay dùng (vd "Fast 9")
  }
  return out.sort((a, b) => a.avg - b.avg);
}
