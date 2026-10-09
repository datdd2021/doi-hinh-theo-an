// Chuyển mô tả tộc/hệ của CommunityDragon (tiếng Việt) thành chữ thường + từng dòng mốc, đã điền số.
// Tên biến bị băm dạng {xxxxxxxx} là FNV-1a 32-bit của tên viết thường.
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (const c of s.toLowerCase()) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return '{' + h.toString(16).padStart(8, '0') + '}';
};
const STAT = {
  scaleAD: 'SMCK', scaleAP: 'SMPT', scaleAS: 'Tốc Độ Đánh', scaleArmor: 'Giáp', scaleMR: 'Kháng Phép',
  scaleHealth: 'Máu', scaleManaRegen: 'Hồi Năng Lượng', scaleDR: 'Chống Chịu', scaleCritChance: 'Tỉ Lệ Chí Mạng',
  scaleCritMult: 'Sát Thương Chí Mạng', scaleSV: 'Hút Máu Toàn Phần', scaleDA: 'Khuếch Đại Sát Thương', scaleMana: 'Năng Lượng',
};
const num = (v, pct) => {
  if (v == null) return '?';
  const x = pct ? v * 100 : v;
  return String(Math.round(x * 100) / 100);
};
// Tìm biến theo tên (không phân biệt hoa thường) hoặc theo tên đã băm
const lookup = (vars, n) => {
  if (!vars) return null;
  if (vars[n] != null) return vars[n];
  if (vars[fnv(n)] != null) return vars[fnv(n)];
  const k = Object.keys(vars).find((x) => x.toLowerCase() === n.toLowerCase());
  return k ? vars[k] : null;
};
function fill(text, vars, min) {
  return text
    .replace(/@MinUnits@/g, String(min ?? ''))
    .replace(/@([A-Za-z0-9_]+)(\*100)?@/g, (_, n, p) => num(lookup(vars, n), !!p))
    .replace(/%i:(\w+)%/g, (_, k) => STAT[k] || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +\n/g, '\n')
    .trim();
}
// Trả về { intro, rows: [{ min, text }] }
export function traitDesc(t) {
  const effects = (t.effects || []).filter((e) => e.minUnits != null);
  const rows = [...t.desc.matchAll(/<row>([\s\S]*?)<\/row>/g)].map((m) => m[1]);
  const introRaw = t.desc.replace(/<row>[\s\S]*?<\/row>/g, '').replace(/(<br\s*\/?>\s*)+$/i, '');
  const allVars = Object.assign({}, ...effects.map((e) => e.variables || {}).reverse());
  return {
    intro: fill(introRaw, allVars),
    rows: rows.map((r, i) => {
      const e = effects[i] || effects[effects.length - 1];
      return { min: e?.minUnits ?? null, text: fill(r, { ...allVars, ...(e?.variables || {}) }, e?.minUnits) };
    }),
  };
}
