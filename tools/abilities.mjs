// Kỹ năng tướng để hiện khi di chuột (giống TFT Academy).
// - Số liệu (theo 1/2/3 sao) lấy từ TFT Academy (api.tftacademy.com), vốn đã tính sẵn từ dữ liệu game.
// - Lời mô tả tiếng Việt lấy từ dữ liệu game (CommunityDragon vi_vn), nhưng các con số ở đó chỉ là chỗ trống (@Ten@).
//   Nếu số chỗ trống bằng số con số của Academy thì điền lần lượt theo thứ tự; không bằng thì dùng nguyên câu
//   tiếng Anh của Academy (đúng số) chứ không đoán.
// Định dạng văn bản trả về: dòng mới = "\n"; số có loại = ⟦ap|250/350/3000⟧; từ khóa in đậm = ⟦b|Thiêu Đốt⟧.

const strip = (s) => (s || '').replace(/<\/?TFTConditionalStyle[^>]*>/g, '').replace(/\r/g, '');

// Các con số trong câu tiếng Anh của Academy, theo thứ tự (kèm loại sát thương nếu có)
function academyNumbers(text) {
  return [...strip(text).matchAll(/<stat type="(\w+)">([^<]*)<\/stat>|(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)*%?)/g)]
    .map((m) => (m[1] ? { type: m[1], v: m[2] } : { type: null, v: m[3] }));
}

function fromAcademy(text) {
  return strip(text)
    .replace(/<stat type="(\w+)">([^<]*)<\/stat>/g, '⟦$1|$2⟧')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function fromVietnamese(desc, nums) {
  let i = 0;
  let out = desc
    .replace(/\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/%i:[a-zA-Z]+%/g, '')
    .replace(/<rules>[\s\S]*?<\/rules>/g, '')
    .replace(/@[^@\s]+@(%?)/g, (_, pct) => {
      const n = nums[i++];
      const v = n.v + (pct && !n.v.endsWith('%') ? '%' : '');
      return n.type ? `⟦${n.type}|${v}⟧` : v;
    })
    .replace(/<(Keyword|bright|TFTKeyword|keyword)>([^<]*)<\/\1>/g, '⟦b|$2⟧')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,:;])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return out;
}

function rulesVi(desc) {
  return [...(desc || '').matchAll(/<rules>([\s\S]*?)<\/rules>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
}

/**
 * @param viChamps  danh sách tướng của bộ (CommunityDragon vi_vn)
 * @param acChamps  danh sách tướng của TFT Academy (better_champions)
 * @returns Map apiName -> { name, text, rules, mana: [đầu trận, tối đa], icon, lang }
 */
export function buildAbilities(viChamps, acChamps) {
  const ac = new Map(acChamps.map((c) => [c.apiName, c]));
  const out = new Map();
  for (const c of viChamps) {
    const a = ac.get(c.apiName);
    if (!a || !a.ability) continue;
    const nums = academyNumbers(a.ability);
    const desc = c.ability?.desc || '';
    const holes = (desc.replace(/<rules>[\s\S]*?<\/rules>/g, '').match(/@[^@\s]+@/g) || []).length;
    const vi = desc && holes === nums.length;
    out.set(c.apiName, {
      name: (vi && c.ability?.name) || a.abilityName || c.ability?.name || '',
      text: vi ? fromVietnamese(desc, nums) : fromAcademy(a.ability),
      rules: vi ? rulesVi(desc) : (a.rules || []),
      mana: [a.stats?.initialMana ?? c.stats?.initialMana ?? 0, a.stats?.mana ?? c.stats?.mana ?? 0],
      icon: `https://assets.tftacademy.com/champions/champion_abilities/${c.apiName}.webp`,
      lang: vi ? 'vi' : 'en',
    });
  }
  return out;
}
