// Lấy dữ liệu meta mới nhất và ghi ra web/meta.js.
//   - TFT Academy (api.tftacademy.com): đội hình (tướng, sao, trang bị, ấn, vị trí), tier, ấn khuyên dùng, vai trò tướng.
//   - seemeta.com: thống kê trận xếp hạng — độ mạnh tướng, độ mạnh ấn, tướng cầm ấn tốt nhất, từng mốc tộc/hệ.
// Chạy:  node tools/build-meta.mjs   (rồi chạy node tools/build-data.mjs để tải icon trang bị)

import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMetaTFT, fetchMetaComps } from './metatft.mjs';

const SET = 18;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACADEMY_API = 'https://api.tftacademy.com/api/collections';
const SEEMETA = `https://seemeta.com/en/tft/set-${SET}`;
const UA = { 'User-Agent': 'Mozilla/5.0 (personal TFT helper)' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function getText(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(String(res.status));
      return await res.text();
    } catch (e) {
      if (i === 2) { console.warn(`  ! bỏ qua ${url} (${e.message})`); return ''; }
      await sleep(1500);
    }
  }
}

async function academy(collection, filter) {
  const q = new URLSearchParams({ filter, perPage: '500' });
  return (await getJson(`${ACADEMY_API}/${collection}/records?${q}`)).items;
}

const strip = (h) => h
  .replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ');
const num = (s) => Number(String(s).replace(/\s/g, ''));
// Props của Astro: [0, giá trị] hoặc [1, [mảng]]
const astro = (v) => Array.isArray(v) ? (v[0] === 1 ? v[1].map(astro) : astro(v[1]))
  : (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, astro(x)])) : v);
function astroProps(html) {
  return [...html.matchAll(/props="([^"]+)"/g)].map((m) => {
    try { return astro(JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'"))); } catch { return null; }
  }).filter(Boolean);
}
const TIER = '(S\\+|S|A|B|C|D)';
const WAS = '(?: Tier (?:up|down) since last patch, was \\S+)?';

// Bảng tier dạng "S+ Kennen Cost 5 Pick rate 20.37% Games 70 270 Avg place 3.86 Top 4 % 60.93% ..."
function parseTierRows(text, withCost) {
  const re = new RegExp(`${TIER}${WAS} ([A-Za-z'.&\\- ]+?)${withCost ? ' Cost \\d' : ''} Pick rate ([\\d.]+)% Games ([\\d ]+?) Avg place ([\\d.]+) Top 4 % ([\\d.]+)%`, 'g');
  return [...text.matchAll(re)].map((m) => ({
    tier: m[1], name: m[2].trim(), pick: num(m[3]), games: num(m[4]), avg: num(m[5]), top4: num(m[6]),
  }));
}

async function main() {
  // ---------- Dữ liệu game (để đổi tên tiếng Anh <-> apiName) ----------
  const dataSrc = await readFile(join(ROOT, 'web', 'data.js'), 'utf8');
  const data = JSON.parse(dataSrc.slice(dataSrc.indexOf('{'), dataSrc.lastIndexOf('}') + 1));
  const unitByEn = new Map(data.units.map((u) => [u.en, u.id]));
  // Các bản Lux dùng chung thống kê của Lux gốc.
  for (const u of data.units) if (u.hidden) unitByEn.set(u.en, u.id);
  const traitByEn = new Map(data.traits.map((t) => [t.en, t.id]));
  const traitBySlug = new Map(data.traits.map((t) => [t.id.replace(/^DA_(18_)?/, '').replace(/18$/, ''), t.id]));

  // ---------- TFT Academy ----------
  console.log('TFT Academy...');
  const [patchRec] = (await getJson(`${ACADEMY_API}/patch/records?perPage=1`)).items;
  const champs = await academy('better_champions', `set=${SET}`);
  const champById = new Map(champs.map((c) => [c.id, c]));
  const guides = (await academy('better_guides', `set=${SET} && isPublic=true`))
    .sort((a, b) => a.displayIndex - b.displayIndex);
  const emblemItems = await academy('better_items', `set=${SET} && type="emblems"`);
  const teamSize = new Map(champs.map((c) => [c.apiName, c.teamSizeContribution ?? 1]));
  const known = new Set(data.units.map((u) => u.id));

  const items = new Set();
  const comps = guides.map((g) => {
    const board = g.finalComp
      .filter((u) => known.has(u.apiName))
      .map((u) => {
        u.items.forEach((i) => items.add(i));
        return { id: u.apiName, stars: u.stars || 1, items: u.items, hex: u.boardIndex ?? null };
      });
    const level = Math.min(10, board.reduce((a, u) => a + (teamSize.get(u.id) ?? 1), 0));
    return {
      title: g.title.trim(),
      subtitle: (g.metaTitle || '').trim(),
      tier: g.tier,
      slug: g.compSlug,
      style: g.style,
      difficulty: g.difficulty,
      listed: g.displayIndex < 1000, // đang hiện trên bảng tier của TFT Academy
      level,
      board,
      alts: (g.maxCap || []).filter((u) => known.has(u.apiName))
        .map((u) => ({ id: u.apiName, replaces: u.predecessors || [] })),
    };
  });

  // ---------- seemeta ----------
  console.log('seemeta: tướng, ấn, tộc/hệ...');
  const champHtml = await getText(`${SEEMETA}/champions`);
  const champText = strip(champHtml);
  const range = (champText.match(/(\w+ \d+, \d{4}) to (\w+ \d+, \d{4})/) || []).slice(1).join(' – ');
  const matches = num((champText.match(/Matches analyzed (\d{1,3}(?: \d{3})*)/) || [])[1] || 0);
  // Tổng số đội hình (8 người mỗi trận) để ước lượng số ván từ tỉ lệ chọn.
  const boards = matches * 8;
  const smPatch = (champText.match(/Patch (\d+\.\d+\w?)/) || [])[1] || '';
  const units = {};
  for (const r of parseTierRows(champText, true)) {
    const id = unitByEn.get(r.name);
    if (id) units[id] = { tier: r.tier, avg: r.avg, top4: r.top4, pick: r.pick, games: r.games };
  }
  await sleep(400);

  // Hạng TB theo số sao của từng tướng (trang riêng của tướng, mục "Level Distribution").
  // Dùng để chấm tướng không bị lệch bởi đội reroll 3 sao.
  const normSlug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const slugKey = (id) => normSlug(id.replace(/^DA_(18_)?/, '').replace(/18/, ''));
  const idBySlug = new Map(data.units.filter((u) => !u.base).map((u) => [slugKey(u.id), u.id]));
  const slugs = [...new Set([...champHtml.matchAll(/\/en\/tft\/set-\d+\/champions\/([^"/?#]+)/g)].map((m) => m[1]))];
  let starPages = 0;
  for (let i = 0; i < slugs.length; i += 6) {
    await Promise.all(slugs.slice(i, i + 6).map(async (slug) => {
      const id = idBySlug.get(normSlug(slug));
      if (!id || !units[id]) return;
      const text = strip(await getText(`${SEEMETA}/champions/${slug}`));
      const seg = (text.match(/Level Distribution(.*?)Item Distribution/) || [])[1] || '';
      const stars = [...seg.matchAll(/(\d) Avg Place ([\d.]+) ([\d.]+)%/g)]
        .map((m) => ({ n: +m[1], avg: +m[2], share: +m[3] / 100, games: Math.round(units[id].games * +m[3] / 100) }));
      if (stars.length) { units[id].stars = stars; starPages++; }
    }));
    await sleep(400);
  }
  console.log(`  số liệu theo số sao: ${starPages}/${Object.keys(units).length} tướng`);

  const emblemHtml = await getText(`${SEEMETA}/emblems`);
  const emblemText = strip(emblemHtml);
  const emblems = {};
  for (const r of parseTierRows(emblemText, false)) {
    const t = traitByEn.get(r.name.replace(/ Emblem$/, ''));
    if (t && !emblems[t]) emblems[t] = { tier: r.tier, avg: r.avg, top4: r.top4, pick: r.pick, games: r.games };
  }
  const emblemSlugs = [...new Set([...emblemHtml.matchAll(new RegExp(`/set-${SET}/items/(Emblem[A-Za-z]+)"`, 'g'))].map((m) => m[1]))];
  for (const slug of emblemSlugs) {
    await sleep(400);
    const html = await getText(`${SEEMETA}/items/${slug}`);
    const name = slug.replace(/^Emblem/, '');
    const t = traitBySlug.get(name) || traitByEn.get(name.replace(/([a-z])([A-Z])/g, '$1 $2'));
    if (!t) continue;
    const holders = [];
    const re = /aria-label="([^"]+)"[\s\S]{0,1500}?Avg Place<\/span><span[^>]*>([\d.]+)<\/span>[\s\S]{0,300}?Top 4<\/span><span[^>]*>([\d.]+)%[\s\S]{0,300}?Winrate<\/span><span[^>]*>([\d.]+)%<\/span><\/span><\/div><span[^>]*>([\d.]+)%/g;
    for (const m of html.matchAll(re)) {
      const id = unitByEn.get(m[1]);
      if (id && !holders.some((h) => h.id === id)) holders.push({ id, avg: num(m[2]), top4: num(m[3]), pick: num(m[5]), games: Math.round(num(m[5]) / 100 * (units[id]?.games || 0)) });
    }
    emblems[t] = { ...(emblems[t] || {}), holders };
    process.stdout.write('.');
  }
  console.log('');

  // Ấn khuyên dùng của TFT Academy
  for (const it of emblemItems) {
    if (!it.trait) continue;
    const rec = (it.recommendedChampions || []).map((id) => champById.get(id)?.apiName).filter(Boolean);
    emblems[it.trait] = { ...(emblems[it.trait] || {}), recommended: rec };
  }

  // Từng mốc tộc/hệ
  const synIdx = await getText(`${SEEMETA}/synergies`);
  const synText = strip(synIdx);
  const traits = {};
  const compExtra = new Map(); // mã đội -> { stars, style, difficulty }
  for (const r of parseTierRows(synText, false)) {
    const t = traitByEn.get(r.name);
    if (t && !traits[t]) traits[t] = { tier: r.tier, avg: r.avg, top4: r.top4, pick: r.pick, games: r.games };
  }
  const synSlugs = [...new Set([...synIdx.matchAll(new RegExp(`/set-${SET}/synergies/([A-Za-z]+)"`, 'g'))].map((m) => m[1]))];
  for (const slug of synSlugs) {
    const t = traitBySlug.get(slug);
    const tr = data.traits.find((x) => x.id === t);
    if (!tr || tr.kind === 'unique') continue;
    await sleep(400);
    const synHtml = await getText(`${SEEMETA}/synergies/${slug}`);
    for (const p of astroProps(synHtml)) {
      for (const c of p['trait-comps'] || []) {
        if (!c.code || compExtra.has(c.code)) continue;
        compExtra.set(c.code, {
          style: c.style || '', difficulty: c.difficulty || '',
          stars: Object.fromEntries((c.units || []).map((u) => [u.apiName, u.stars || 1])),
        });
      }
    }
    const text = strip(synHtml);
    const start = text.indexOf('levels & bonuses');
    if (start < 0) continue;
    const seg = text.slice(start + 'levels & bonuses '.length + tr.en.length);
    const levels = [];
    const re = /Share of trait games ([\d.]+)% Avg Place ([\d.]+) Top 4 ([\d.]+)% Winrate ([\d.]+)%/g;
    let prev = 0;
    for (const m of seg.matchAll(re)) {
      const head = seg.slice(prev, m.index).trim();
      const n = Number((head.match(/^(\d+)/) || [])[1]);
      if (n) levels.push({ n, share: num(m[1]), avg: num(m[2]), top4: num(m[3]), games: Math.round((traits[t]?.games || 0) * num(m[1]) / 100) });
      prev = m.index + m[0].length;
    }
    traits[t] = { ...(traits[t] || {}), levels };
    process.stdout.write('.');
  }
  console.log('');

  // ---------- Số liệu chính: MetaTFT (đúng bản hiện tại, mẫu lớn) ----------
  // seemeta ở trên chỉ còn dùng dự phòng (và cho danh sách đội); đã đối chiếu MetaTFT với tactics.tools: lệch < 0,1 hạng.
  let mtComps = [];
  let statsSource = { name: 'seemeta', url: `${SEEMETA}/champions`, patch: smPatch, range, matches };
  console.log('MetaTFT: tướng, số sao, tộc/hệ, ấn...');
  try {
    const mt = await fetchMetaTFT(data, (x) => process.stdout.write(x));
    console.log('');
    const tierOf = (avg) => (avg == null ? '' : avg <= 3.9 ? 'S' : avg <= 4.2 ? 'A' : avg <= 4.5 ? 'B' : avg <= 4.8 ? 'C' : 'D');
    for (const k of Object.keys(units)) delete units[k];
    for (const [id, u] of Object.entries(mt.units)) units[id] = { tier: tierOf(u.avg), ...u };
    for (const k of Object.keys(traits)) delete traits[k];
    for (const [id, t] of Object.entries(mt.traits)) traits[id] = { tier: tierOf(t.avg), ...t };
    for (const [t, e] of Object.entries(mt.emblems)) emblems[t] = { tier: tierOf(e.avg), ...e, recommended: emblems[t]?.recommended };
    statsSource = mt.info;
    mtComps = await fetchMetaComps(data);
    console.log(`  ${mtComps.length} kiểu đội hình thật (MetaTFT)`);
    console.log(`  MetaTFT bản ${mt.info.patch}: ${mt.info.matches} trận, ${Object.keys(mt.units).length} tướng, ${Object.keys(mt.emblems).length} ấn`);
  } catch (e) {
    console.warn('  ! MetaTFT lỗi, dùng số liệu seemeta:', e.message);
  }

  // ---------- Đội hình thật của seemeta (xếp theo hạng TB trong trận xếp hạng) ----------
  console.log('seemeta: đội hình...');
  const byTp = new Map(data.units.filter((u) => !u.base && u.tp != null).map((u) => [u.tp, u.id]));
  const tlHtml = await getText(`${SEEMETA}/tier-list`);
  const anchors = [...tlHtml.matchAll(new RegExp(`<a href="/en/tft/set-${SET}#(0[12][0-9a-fA-F]{30}TFTSet${SET}\\w*)"`, 'g'))];
  const smComps = [];
  anchors.forEach((m, k) => {
    const seg = strip(tlHtml.slice(m.index, k + 1 < anchors.length ? anchors[k + 1].index : m.index + 6000)).trim();
    const mm = seg.match(/^(S\+|S|A|B|C|D) (.+?) Avg Place ([\d.]+) · Winrate ([\d.]+)% · Top 4 ([\d.]+)%/);
    if (!mm) return;
    const code = m[1];
    const body = code.slice(2, 32);
    const extra = compExtra.get(code) || {};
    const board = [];
    for (let i = 0; i < 30; i += 3) {
      const id = byTp.get(parseInt(body.slice(i, i + 3), 16));
      if (id) board.push({ id, stars: extra.stars?.[id] || 1, items: [] });
    }
    if (board.length < 5 || smComps.some((c) => c.code === code)) return;
    smComps.push({ name: mm[2].trim(), tier: mm[1], avg: num(mm[3]), win: num(mm[4]), top4: num(mm[5]),
      style: extra.style || '', difficulty: extra.difficulty || '', code, board });
  });

  const roles = Object.fromEntries(champs.filter((c) => known.has(c.apiName)).map((c) => [c.apiName, c.role || '']));

  const out = {
    updated: new Date().toISOString().slice(0, 10),
    patch: patchRec?.patch || '',
    sources: {
      academy: { name: 'TFT Academy', url: 'https://tftacademy.com/tierlist/comps', patch: patchRec?.patch || '' },
      seemeta: { name: 'seemeta', url: `${SEEMETA}/champions`, patch: smPatch, range, matches },
      stats: statsSource,
    },
    comps,
    smComps,
    mtComps,
    units,
    roles,
    traits,
    emblems,
    items: [...items],
  };
  await writeFile(join(ROOT, 'web', 'meta.js'), `window.TFT_META = ${JSON.stringify(out)};\n`);
  console.log(`Xong: ${comps.length} đội TFT Academy, ${smComps.length} đội seemeta, ${Object.keys(units).length} tướng, ${Object.keys(emblems).length} ấn, ${Object.keys(traits).length} tộc/hệ.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
