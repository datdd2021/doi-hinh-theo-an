// Tải dữ liệu TFT từ CommunityDragon (tiếng Việt), lọc ra một set, tải icon
// và ghi ra web/data.js để trang web dùng.
// Chạy:  node tools/build-data.mjs
// Đổi set: node tools/build-data.mjs TFTSet18

import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { traitDesc } from './trait-desc.mjs';

const SET_MUTATOR = process.argv[2] || 'TFTSet18';
const CDRAGON = 'https://raw.communitydragon.org/latest';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'web');

// Ấn không phải trang bị thật (cơ chế đặc biệt) hoặc bản trùng.
const SKIP_EMBLEMS = [/Phantom/i, /Augment$/i];

// Tộc/hệ đỡ đòn (Vệ Quân, Tiên Phong, Đấu Sĩ, Dũng Sĩ...). Tướng có 1 trong các hệ này là tank.
// Đổi set thì sửa danh sách này. Ngoài ra tướng cận chiến có giáp >= 60 cũng tính là tank.
const TANK_TRAIT_PATTERNS = [/Defender/i, /Vanguard/i, /Brawler/i, /Juggernaut/i, /Bastion/i, /Warden/i, /Battlemage/i, /Maokai/i, /ShieldTank/i, /HPTank/i, /ResistTank/i];
const TANK_MIN_ARMOR = 60;

// Tộc (origin): các mốc giữa yếu, chỉ mốc max có hiệu ứng đặc biệt. Còn lại là hệ (class):
// càng lên mốc cao càng mạnh. Đổi set thì sửa danh sách này (theo apiName).
const ORIGIN_PATTERNS = [/Elderwood/i, /Blossom/i, /Lunar/i, /Solar/i, /Coven/i, /_Fae$/i, /Blackthorn/i, /Inferno/i, /Primal/i, /Sprykin/i, /Riftbeast/i, /FloraFatalis/i, /Rival/i];

// Cơ chế đặc biệt (theo apiName tộc/hệ). Đổi set thì xem mô tả tộc/hệ riêng và sửa ở đây.
const SPECIAL = {
  // Tướng có tộc/hệ này chiếm nhiều ô đội hình (Rồng Ngàn Tuổi: 2 ô).
  slots: { DA_18_ApexPredator: 2 },
  // Tướng có tộc/hệ này cộng thêm vào tộc/hệ khác, ngoài 1 điểm của chính nó.
  // Rồng Ngàn Tuổi: mô tả ghi "+2 Quái Rừng" nhưng là tính 2 tổng cộng (chính nó + 1), đã đối chiếu đội
  // "10 Riftbeast" của TFT Academy (Rồng + 8 Quái Rừng = 10) và "Riftbeast Sentinel" của seemeta (Rồng + 5 = 7).
  bonus: { DA_18_ApexPredator: { DA_Riftbeast18: 1 } },
  // Tướng có tộc/hệ này được tính gấp đôi tộc/hệ còn lại (Lux Thế Thần).
  doubleOther: [/LuxUniqueTrait/i, /Avatar/i],
  // Tộc/hệ chỉ kích hoạt khi có đúng 1 tướng: các tướng này không được đứng chung (Khắc Tinh).
  onlyOne: [/Rival/i],
};

// Icon tộc/hệ bị sai trong dữ liệu game (đã đối chiếu với icon ấn và TFT Academy): dùng file đúng thay thế.
const ICON_FIX = {
  DA_18_Invoker: 'ASSETS/UX/TraitIcons/trait_icon_16_invoker.tex', // file Set 18 là hình cái cốc; đúng là vòm + giọt nước
};

const assetUrl =(p) => `${CDRAGON}/game/${p.toLowerCase().replace(/\.tex$/, '.png')}`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} khi tải ${url}`);
  return res.json();
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function download(url, file, tries = 3) {
  if (await exists(file)) return true;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      return true;
    } catch (e) {
      if (i === tries - 1) { console.warn(`  ! không tải được ${url} (${e.message})`); return false; }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

async function pool(jobs, size = 8) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < jobs.length) await jobs[i++]();
  }));
}

// Mốc kích hoạt: [[số tướng, kiểu]], kiểu 1 đồng, 3 bạc, 5 vàng, 6 kim cương, 4 tộc/hệ riêng.
function breakpoints(effects) {
  const byMin = new Map();
  for (const e of effects || []) {
    if (e.minUnits == null) continue;
    const prev = byMin.get(e.minUnits);
    byMin.set(e.minUnits, prev == null ? e.style : Math.min(prev, e.style));
  }
  return [...byMin.entries()].sort((a, b) => a[0] - b[0]);
}

async function main() {
  console.log(`Tải dữ liệu ${SET_MUTATOR}...`);
  const [data, en, planner, meta] = await Promise.all([
    getJson(`${CDRAGON}/cdragon/tft/vi_vn.json`),
    getJson(`${CDRAGON}/cdragon/tft/en_us.json`),
    // Mã tướng cho Team Planner trong game (để tạo mã đội hình dán vào game).
    getJson(`${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/tftchampions-teamplanner.json`).catch(() => ({})),
    getJson(`${CDRAGON}/content-metadata.json`).catch(() => ({ version: '?' })),
  ]);
  const set = data.setData.find((s) => s.mutator === SET_MUTATOR);
  if (!set) throw new Error(`Không thấy ${SET_MUTATOR}. Có: ${data.setData.map((s) => s.mutator).join(', ')}`);
  // Tên tiếng Anh (để khớp với đội hình meta trên các trang như TFT Academy).
  const enSet = en.setData.find((s) => s.mutator === SET_MUTATOR);
  const enName = new Map([...enSet.traits, ...enSet.champions].map((x) => [x.apiName, x.name]));
  const plannerList = planner[SET_MUTATOR] || [];
  const plannerById = new Map(plannerList.map((c) => [c.character_id, c.team_planner_code]));
  const plannerByName = new Map(plannerList.map((c) => [c.display_name, c.team_planner_code]));
  // Tướng nhiều phiên bản (Lux) dùng chung mã của bản gốc.
  const plannerCode = (c) => plannerById.get(c.apiName) ??
    plannerByName.get((enName.get(c.apiName) || '').replace(/\s*\(.+\)$/, '')) ?? null;

  const jobs = [];
  // meta.js (nếu đã có): vai trò tướng theo TFT Academy và danh sách trang bị dùng trong đội meta.
  let metaFile = {};
  try {
    const src = await readFile(join(WEB, 'meta.js'), 'utf8');
    metaFile = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  } catch {}
  const metaRoles = metaFile.roles || {};

  // Tộc/hệ
  const traits = [];
  const traitIdx = new Map(); // tên -> index
  for (const t of set.traits) {
    const bps = breakpoints(t.effects);
    if (!bps.length || traitIdx.has(t.name)) continue;
    const fix = ICON_FIX[t.apiName];
    const img = `img/t/${t.apiName}${fix ? '_fix' : ''}.png`;
    jobs.push(() => download(assetUrl(fix || t.icon), join(WEB, img)));
    traitIdx.set(t.name, traits.length);
    const unique = bps.length === 1 && (bps[0][1] === 4 || bps[0][0] === 1);
    const kind = unique ? 'unique' : ORIGIN_PATTERNS.some((r) => r.test(t.apiName)) ? 'origin' : 'class';
    const d = traitDesc(t); // mô tả + từng dòng mốc (đã điền số)
    // effMin: mốc của từng dòng hiệu ứng theo đúng thứ tự trong game (để ghép số liệu MetaTFT theo chỉ số mốc)
    const effMin = (t.effects || []).filter((e) => e.minUnits != null).map((e) => e.minUnits);
    traits.push({ id: t.apiName, name: t.name, en: enName.get(t.apiName) || t.name, kind, img, bps, effMin, desc: d.intro, rows: d.rows });
  }

  // Tướng
  const champs = set.champions.filter((c) => c.traits?.length && c.cost >= 1 && c.cost <= 5);
  const baseId = new Map(champs.map((c) => [c.name, c.apiName]));
  const variantBases = new Set(
    champs.filter((c) => /\(.+\)$/.test(c.name)).map((c) => c.name.replace(/\s*\(.+\)$/, '')),
  );
  const units = [];
  for (const c of champs) {
    const base = c.name.replace(/\s*\(.+\)$/, '');
    const isVariant = base !== c.name;
    // Tướng có nhiều phiên bản (vd. Lux): bản gốc giữ lại nhưng ẩn (để hiện trong đội meta),
    // thuật toán chỉ chọn các bản biến thể và chỉ được 1 bản.
    const hidden = !isVariant && variantBases.has(c.name);
    const ts = c.traits.map((n) => traitIdx.get(n)).filter((x) => x != null);
    const img = `img/c/${c.apiName}.png`;
    jobs.push(() => download(assetUrl(c.squareIcon || c.tileIcon), join(WEB, img)));
    const range = c.stats?.range ?? 1;
    const role = metaRoles[c.apiName] ?? (isVariant ? metaRoles[baseId.get(base)] : null) ?? null;
    const tank = role ? /Tank/i.test(role) :
      /Tank/i.test(c.role || '') ||
      ts.some((t) => TANK_TRAIT_PATTERNS.some((r) => r.test(traits[t].id))) ||
      (range <= 2 && (c.stats?.armor ?? 0) >= TANK_MIN_ARMOR);
    const tIds = ts.map((t) => traits[t].id);
    const slots = Math.max(1, ...tIds.map((id) => SPECIAL.slots[id] || 1));
    const extra = {}; // tộc/hệ -> số điểm cộng thêm ngoài 1 điểm mặc định
    for (const id of tIds) {
      for (const [other, n] of Object.entries(SPECIAL.bonus[id] || {})) {
        const oi = traits.findIndex((t) => t.id === other);
        if (oi >= 0) extra[oi] = (extra[oi] || 0) + n;
      }
      if (SPECIAL.doubleOther.some((r) => r.test(id))) {
        for (const t of ts) if (traits[t].id !== id) extra[t] = (extra[t] || 0) + 1;
      }
    }
    const onlyOne = ts.find((t) => SPECIAL.onlyOne.some((r) => r.test(traits[t].id)));
    units.push({
      id: c.apiName,
      name: c.name,
      en: enName.get(c.apiName) || c.name,
      tp: plannerCode(c),
      cost: c.cost,
      traits: ts,
      range,
      tank,
      role: role || '',
      ...(hidden ? { hidden: true } : {}),
      ...(isVariant ? { base: baseId.get(base) } : {}),
      slots,
      extra: Object.entries(extra).map(([t, n]) => [Number(t), n]),
      group: isVariant ? base : onlyOne != null ? traits[onlyOne].name : null,
      img,
    });
  }

  // Ấn
  const itemName = new Map(data.items.map((i) => [i.apiName, i.name]));
  const emblems = [];
  for (const it of data.items) {
    if (!/Emblem/i.test(it.apiName) || SKIP_EMBLEMS.some((r) => r.test(it.apiName))) continue;
    const traitName = it.name.replace(/^Ấn\s+/, '');
    const ti = traitIdx.get(traitName);
    if (ti == null) continue;
    // Chỉ lấy ấn thuộc set này (cùng tiền tố với tộc/hệ).
    const prefix = set.traits[0].apiName.split('_')[0];
    if (!it.apiName.startsWith(prefix)) continue;
    if (emblems.some((e) => e.trait === ti)) continue;
    const img = `img/e/${it.apiName}.png`;
    jobs.push(() => download(assetUrl(it.icon), join(WEB, img)));
    emblems.push({
      id: it.apiName,
      name: it.name,
      trait: ti,
      recipe: (it.composition || []).map((x) => itemName.get(x) || x),
      img,
    });
  }
  emblems.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // Trang bị xuất hiện trong đội meta (để hiện icon dưới tướng)
  const itemById = new Map(data.items.map((i) => [i.apiName, i]));
  const items = {};
  for (const id of metaFile.items || []) {
    const it = itemById.get(id);
    if (!it || !it.icon) continue;
    const img = `img/i/${id}.png`;
    jobs.push(() => download(assetUrl(it.icon), join(WEB, img)));
    items[id] = { name: it.name, img };
  }

  console.log(`${units.length} tướng, ${traits.length} tộc/hệ, ${emblems.length} ấn. Tải icon...`);
  await pool(jobs);

  const out = {
    set: set.number,
    plannerSet: SET_MUTATOR,
    mutator: SET_MUTATOR,
    version: meta.version,
    updated: new Date().toISOString().slice(0, 10),
    traits,
    units,
    emblems,
    items,
  };
  await mkdir(WEB, { recursive: true });
  await writeFile(join(WEB, 'data.js'), `window.TFT_DATA = ${JSON.stringify(out)};\n`);
  console.log('Xong: web/data.js');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
