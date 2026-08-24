/* ═══ GHHA i18n v1 — English option ═══
   Loaded BEFORE game.js. Patches canvas text + observes DOM.
   Lang stored in localStorage 'vlcm_lang' ('vi' default | 'en'). */
(function () {
'use strict';
const KEY = 'vlcm_lang';
let lang = 'vi';
try { lang = localStorage.getItem(KEY) || 'vi'; } catch (e) {}

/* ---- term swaps: applied ONLY inside rule-captured fragments ---- */
const TERMS = [
  ['sát thương gánh chịu','damage taken'],['sát thương thiên lôi','lightning damage'],['Sát Thương','Damage'],['sát thương','damage'],
  ['kinh nghiệm','EXP'],['Kinh Nghiệm','EXP'],
  ['phòng ngự','defense'],['Phòng Ngự','Defense'],['phòng thủ','defense'],['Phòng Thủ','Defense'],
  ['tốc độ đánh','attack speed'],['Tốc Độ Đánh','Attack Speed'],['tốc đánh','attack speed'],
  ['Né Tránh','Dodge'],['né tránh','dodge'],[' né',' dodge'],
  ['Bạo Kích','Crit'],['bạo kích','crit'],['bạo','crit'],
  ['bạc rơi','silver drops'],['đồng rơi','coin drops'],['đồng','coins'],
  ['Sinh Lực Tối Đa','Max HP'],['Sinh Lực','HP'],['sinh lực','HP'],
  ['Nội Lực Tối Đa','Max Qi'],['Nội Lực','Qi'],['nội lực','Qi'],
  ['Chân Khí','True Qi'],['chân khí','True Qi'],
  ['tốc chạy','move speed'],['Tốc Chạy','Move Speed'],
  ['hút sinh lực','life steal'],['hút nội lực','Qi steal'],['hút','drain'],
  ['mỗi giây','per second'],['tỉ lệ thành công','success rate'],['tỉ lệ','rate'],['thành công','success'],
  ['hồi chiêu','cooldown'],['kháng độc','poison resist'],['kịch độc','deadly poison'],['độc','poison'],
  ['choáng','stun'],['chảy máu','bleed'],['làm chậm','slow'],['chậm','slow'],
  ['xuyên giáp','armor pierce'],['xuyên thấu','pierce'],['phong mạch','seal meridians'],
  ['hồi phục','regen'],['hồi','regen'],['máu','HP'],['chiêu thức','skills'],['chiêu','skills'],
  ['địch thủ','foes'],['địch','enemies'],['quái','monsters'],['tối đa','max'],['giây','s'],
  ['công lực','power'],['công','ATK'],['thể lực','stamina'],['trúng','hit'],['trượt','miss'],
  ['miễn phí','free'],['khiên','shield'],['hấp thụ','absorb'],['phản','reflect'],
  ['thuộc tính','attributes'],['cảnh giới','realm'],['cấp độ','level'],['cấp','Lv'],
  ['bạc','silver'],['vàng','gold'],['người chơi','player'],
];
function trFrag(s) {
  let out = s;
  for (const [a, b] of TERMS) out = out.split(a).join(b);
  return out;
}

/* ---- EXACT dictionary: full-string VI -> EN ---- */
const EXACT = {
  // Brand & chapters
  'HUYỄN ẢNH CHÍ TÔN': 'SUPREME PHANTOM',
  'Chương I · Nhập Thế': 'Chapter I · Entering the Jianghu',
  'Chương I · Thanh Ngưu Thôn': 'Chapter I · Green Ox Village',
  'Chương II · Tương Dương Phong Vân': 'Chapter II · Winds over Xiangyang',
  'Chương III · Chung Nam Vân Vụ': 'Chapter III · Mists of Zhongnan',
  'Chương IV · Cổ Mộ U Ảnh': 'Chapter IV · Shadows of the Tomb',
  'Chương V · Tuyệt Tình Tình Chướng': 'Chapter V · Valley of Severed Love',
  'Chương VI · Mông Cổ Phong Sa': 'Chapter VI · Sands of the Steppe',
  'Chương VII · Nhạn Môn Huyết Chiến': 'Chapter VII · Bloodbath at Yanmen',
  // Sects & roles
  'Thiếu Lâm': 'Shaolin', 'Toàn Chân': 'Quanzhen', 'Cổ Mộ': 'Ancient Tomb',
  'Bạch Đà Sơn': 'White Camel Mt.', 'Minh Giáo': 'Ming Cult', 'Đoàn Thị': 'Duan Clan',
  'Đào Hoa': 'Peach Blossom', 'Tán Nhân': 'Wanderer',
  'Tank / Khống chế': 'Tank / Control', 'Kiếm khí / Hỗ trợ': 'Sword Qi / Support',
  'Đột kích / Linh hoạt': 'Assault / Agile', 'Độc công / Tầm xa': 'Poison / Ranged',
  'Bộc phát / Hỏa diệm': 'Burst / Flame', 'Chỉ lực / Chuẩn xác': 'Precision / Focus',
  'Bộc phát / Tầm xa': 'Burst / Ranged', 'Lang bạt / Tự do': 'Roaming / Free',
  // Elements
  'Kim': 'Metal', 'Mộc': 'Wood', 'Thủy': 'Water', 'Hỏa': 'Fire', 'Thổ': 'Earth',
  // Maps
  'Đào Hoa Đảo': 'Peach Blossom Island', 'Tương Dương Thành': 'Xiangyang City',
  'Ngoại Ô Tương Dương': 'Xiangyang Outskirts', 'Chung Nam': 'Mt. Zhongnan',
  'Chung Nam Sơn': 'Mt. Zhongnan', 'Tuyệt Tình Cốc': 'Heartbreak Valley',
  'Mông Cổ': 'Mongolian Steppe', 'Nhạn Môn Quan': 'Yanmen Pass',
  'An Toàn': 'Safe Zone', 'Phó Bản': 'Dungeon',
  // Quality & tiers
  'Phàm': 'Common', 'Tinh': 'Fine', 'Linh': 'Spirit', 'Thần': 'Divine', 'Chí Tôn': 'Supreme',
  'PHÀM': 'COMMON', 'HUYỀN': 'MYSTIC', 'THIÊN': 'CELESTIAL',
  'Hoàn Hảo': 'Flawless', 'ST Hoàn Hảo': 'Flawless DMG',
  'Nhập Môn': 'Novice', 'Hành Hiệp': 'Wayfarer', 'Giang Hồ': 'Jianghu', 'Danh Môn': 'Renowned',
  'Tông Sư': 'Grandmaster', 'Tuyệt Thế': 'Peerless', 'Khai Sơn': 'Pathfinder', 'Chấn Phái': 'Pillars',
  'Tiêu Dao': 'Carefree', 'Thiên Nhân': 'Celestial Being',
  'Sơ Cấp': 'Basic', 'Trung Cấp': 'Intermediate', 'Cao Cấp': 'Advanced', 'Thần Cấp': 'Godly',
  'Tiểu Thành': 'Minor Success', 'Đại Thành': 'Major Success', 'Viên Dung': 'Perfection',
  // Realms
  'Phàm Nhân': 'Mortal', 'Luyện Khí': 'Qi Refining', 'Trúc Cơ': 'Foundation',
  'Kim Đan': 'Golden Core', 'Nguyên Anh': 'Nascent Soul', 'Hóa Thần': 'Spirit Severing',
  'Trúc Cơ Cảnh': 'Foundation Realm', 'Kim Đan Cảnh': 'Golden Core Realm', 'Hóa Thần Cảnh': 'Spirit Severing Realm',
  'Nguyên Anh · Trung Kỳ': 'Nascent Soul · Mid', 'Nguyên Anh · Hậu Kỳ': 'Nascent Soul · Late',
  '☁ Tán Tiên · xuất thế': '☁ Rogue Immortal · origin',
  'Đan Điền': 'Dantian', 'Độ Kiếp': 'Tribulation', '⚡ Độ Kiếp': '⚡ Tribulation',
  'Đột Phá': 'Breakthrough', 'Đan Đột Phá': 'Breakthrough Pill', 'Tiến Cấp Đan': 'Advance Pill',
  'Thức Tỉnh': 'Awakened', '— ĐÃ THỨC TỈNH ✦': '— AWAKENED ✦', '— TỐI THƯỢNG': '— SUPREME',
  // Stats
  'Công Kích': 'Attack', 'Tấn Công': 'Attack', 'Sinh Lực': 'HP', 'Nội Lực': 'Qi',
  'Phòng Ngự': 'Defense', 'Phòng Thủ': 'Defense', 'Tốc Độ Đánh': 'Atk Speed',
  'Né Tránh': 'Dodge', 'Tránh Đòn': 'Dodge', 'Bạo Kích': 'Crit', 'Bạo Kích %': 'Crit %',
  'Thân Pháp': 'Agility', 'Lực Lượng': 'Strength', 'Mẫn Tiệp': 'Dexterity',
  'Giảm Sát Thương': 'Damage Reduction', 'Phản Sát Thương': 'Reflect Damage',
  'Thêm Sát Thương': 'Bonus Damage', 'Hút Sinh Lực': 'Life Steal', 'Hút Nội Lực': 'Qi Steal',
  'Đồng Rơi Thêm': 'Bonus Coin Drops', 'EXP Thêm': 'Bonus EXP', 'Toàn Thuộc Tính': 'All Attributes',
  'Sinh Lực Tối Đa': 'Max HP', 'Nội Lực Tối Đa': 'Max Qi', 'Hồi Chân Khí': 'True Qi Regen',
  'Xuyên Giáp': 'Armor Pierce', 'Thần Lực': 'Divine Power', 'Thiên Nhãn': 'Heavenly Eye',
  // Slots
  'Vũ Khí': 'Weapon', 'Nón': 'Helm', 'Áo': 'Armor', 'Tay': 'Gloves', 'Quần': 'Pants',
  'Chân': 'Boots', 'Dây Chuyền': 'Amulet', 'Nhẫn 1': 'Ring 1', 'Nhẫn 2': 'Ring 2',
  'Áo Choàng': 'Cloak', 'Binh Khí': 'Weapon', 'đang mặc': 'equipped', 'túi': 'bag',
  // Materials & shop
  'Mảnh Trang Bị': 'Gear Shard', 'Tịch Ma Thạch': 'Demon-Seal Stone', 'Ấn Trấn Ải': 'Pass-Guard Seal',
  'Mảnh Cổ Thần': 'Ancient God Shard', 'Huyền Thiết': 'Mystic Iron', 'Bí Kíp →': 'Tomes →',
  'Thảo Dược': 'Herb', 'Thảo Dược Quý': 'Rare Herb', 'Phong Linh Phù': 'Spirit-Seal Charm',
  'Thiên Mệnh Phù': 'Fate Charm', '☂ Thiên Mệnh Phù': '☂ Fate Charm',
  'Hồ Lô Thuốc': 'Potion Gourd', '🧪 Hồ Lô Thuốc': '🧪 Potion Gourd',
  '🍶 Rượu Hổ Cốt': '🍶 Tiger Bone Wine', '🍶 RƯỢU HỔ CỐT': '🍶 TIGER BONE WINE',
  '⚡ Lôi Độn Phù': '⚡ Thunder Escape Charm', '⚡ LÔI ĐỘN PHÙ': '⚡ THUNDER ESCAPE',
  '✚ Trị Thương Toàn Phần': '✚ Full Heal', '🛏 Nghỉ Trọ': '🛏 Rest at Inn',
  'Sinh Tử Phù': 'Life-Death Charm', 'Tu La Tinh Thạch': 'Asura Crystal', 'Hỗn Nguyên Thạch': 'Chaos Stone',
  '◆ Tu La Tinh Thạch': '◆ Asura Crystal', '❖ Hỗn Nguyên Thạch': '❖ Chaos Stone',
  '◎ Chúc Phúc Châu': '◎ Blessing Pearl', '◉ Linh Hồn Châu': '◉ Soul Pearl',
  '❤ Sinh Mệnh Châu': '❤ Life Pearl', '● Hỗn Độn Châu': '● Chaos Pearl',
  '✦ Huyền Thiết ×5': '✦ Mystic Iron ×5', 'Huyền Thiết ×5': 'Mystic Iron ×5',
  '◈ Đan Đột Phá': '◈ Breakthrough Pill', '◈ Tiến Cấp Đan ×3': '◈ Advance Pill ×3',
  '⚔ Rương Binh Khí': '⚔ Weapon Chest', '⚔ Rương Binh Khí Tinh Tuyển': '⚔ Elite Weapon Chest',
  '🛡 Rương Phòng Cụ': '🛡 Armor Chest', 'bảo hiểm rèn': 'forge insurance', 'rèn +1~+11': 'forge +1~+11',
  'Mua thành công!': 'Purchase successful!',
  // Panels & buttons
  'VÕ HỌC PHỔ': 'MARTIAL ARTS CODEX', '☯ DUNG HỢP THẦN CÔNG': '☯ DIVINE FUSION',
  'Dung Hợp': 'Fusion', 'Tuyệt Học': 'Ultimate Arts', 'Nội Công': 'Internal Arts', 'Tâm Pháp': 'Mind Art',
  '⚔ Bắt Đầu Hành Trình': '⚔ Begin the Journey', 'Tiếp ▸': 'Next ▸', 'Đã học': 'Learned',
  'Thông Tin': 'Info', 'Rèn Luyện': 'Forge', 'Tăng Cường +': 'Enhance +',
  'Ô trống — bấm để gán kỹ năng (K)': 'Empty slot — click to assign a skill (K)',
  'võ học — bấm K gán vào taskbar': 'martial art — press K to assign to taskbar',
  'Trang bị đã tối ưu!': 'Gear fully optimized!', 'Kỹ năng đã viên mãn (Lv 120)!': 'Skill maxed (Lv 120)!',
  'Mang trang bị đến lò rèn (phím F) và Tăng Cường một món bất kỳ lên +3.': 'Bring gear to the Forge (F) and Enhance any item to +3.',
  'Hướng dẫn hoàn tất — chúc hiệp khách phi nước đại!': 'Tutorial complete — ride on, hero!',
  'Console playtest — gõ /help để xem lệnh, Esc để đóng.': 'Playtest console — type /help for commands, Esc to close.',
  '" — gõ /help': '" — type /help',
  // System messages & status
  'Nhiệm vụ hoàn thành!': 'Quest complete!', 'Túi đồ đã đầy!': 'Bag is full!',
  'Túi thuốc đã đầy (tối đa 5 lọ)!': 'Potion bag full (max 5)!', 'Không đủ Nội Lực!': 'Not enough Qi!',
  'Chân khí đã sung mãn!': 'True Qi is full!', 'Vẫn khỏe mạnh — không cần thuốc!': 'Still healthy — no potion needed!',
  'Đã gỡ Trọng Thương — có thể Té Núi ngay': 'Heavy Wound cleared — you can cliff-jump now',
  'Lỗi:': 'Error:', 'Lệnh lạ "': 'Unknown command "', 'Không có map "': 'No such map "',
  'Map này không có trấn thủ.': 'This map has no guardian.',
  'CHOÁNG!': 'STUNNED!', 'CHẢY MÁU!': 'BLEEDING!', 'CHẬM!': 'SLOWED!',
  'CƯƠNG KHÍ HỘ THỂ!': 'QI SHIELD!', 'Cương Khí Hộ Thể': 'Qi Shield',
  'VÔ TƯỚNG — toàn bộ chiêu đã hồi!': 'FORMLESS — all skills refreshed!',
  '✦ SONG THỦ HỖ BÁC — chiêu không hồi!': '✦ DUAL AMBIDEXTERITY — skills cost no cooldown!',
  '⚡ Liên Trảm — miễn phí Nội Lực!': '⚡ Chain Strike — free Qi!',
  'BẤT TỬ: BẬT': 'GODMODE: ON', 'BẤT TỬ: TẮT': 'GODMODE: OFF',
  'PK: BẬT': 'PK: ON', 'PK: Tắt': 'PK: OFF',
  'ĐÃ MỞ VÙNG MỚI': 'NEW REGION UNLOCKED', '☯ BÁI SƯ THỤ NGHIỆP': '☯ TAKEN AS DISCIPLE',
  '⚑ Kết Bái': '⚑ Sworn Oath', '⚑ KIM LAN KẾT NGHĨA': '⚑ SWORN BROTHERHOOD',
  '⚔ KẾT THÙ GIANG HỒ': '⚔ JIANGHU FEUD', '⚔ PHỤC KÍCH!': '⚔ AMBUSH!', '⚔TRUY THÙ': '⚔ VENDETTA',
  '⚔ Cừu Nhân': '⚔ Nemesis', '❤ Đạo Lữ': '❤ Dao Companion', '❤ ĐẠO LỮ ĐỊNH TAM SINH': '❤ DAO COMPANIONS FOR THREE LIVES',
  '📖 LUẬN ĐẠO NGỘ PHÁP': '📖 DAO DISCOURSE', '🕊 HÒA GIẢI': '🕊 RECONCILED',
  '☯ Sư Phụ': '☯ Master', '☯ Đồ Đệ': '☯ Disciple',
  '⚫ MA ĐẠO': '⚫ DEMON PATH', '☬ TRẤN ẢI': '☬ PASS GUARDIAN', '⛨ THỦ VỆ': '⛨ WARDEN',
  '✘ HỎA HẦU CHƯA ĐẠT — THẦN BINH VỠ NÁT!': '✘ INSUFFICIENT MASTERY — DIVINE WEAPON SHATTERED!',
  '☀ KHAI QUANG +11 — Thiên Lôi Cương Khí!': '☀ CONSECRATED +11 — Thunder Qi!',
  'Thần Binh đã THỨC TỈNH — tối đa!': 'Divine Weapon AWAKENED — maxed!',
  '☂ Thiên Mệnh Phù bảo hộ!': '☂ Fate Charm protects you!',
  'Ngũ Ấn:': 'Five Seals:', 'Trấn Ấn Chi Binh': 'Seal Warden', '⚑ Kết Bái': '⚑ Sworn Oath',
  // Mounts & stable
  'Xuất Chiến (V)': 'Summon (V)', 'Thu Hồi (V)': 'Recall (V)', 'Thú Cưỡi → tầng': 'Mount → tier',
  '→ tầng': '→ tier', 'Trại Chủ Mục Đồng': 'Stable Master', 'Trại Ngựa Ngoại Ô': 'Outskirts Stable',
  'Bạch Mã': 'White Steed', 'Xích Thố': 'Red Hare', 'Đích Lô': 'Dilu', 'Ô Tôn': 'Wuzhui',
  '(Nhận Bạch Mã)': '(Claim White Steed)', 'thu phục linh thú — bấm T': 'tame spirit beasts — press T',
  // Relations & personality
  'Xa Lạ': 'Stranger', 'Quen Biết': 'Acquaintance', 'Hảo Hữu': 'Friend', 'Tri Kỷ': 'Confidant',
  'Chí Giao': 'Bosom Friend', 'Sinh Tử Chi Giao': 'Life-and-Death Bond',
  'Chính Trực': 'Righteous', 'Hào Sảng': 'Generous', 'Ngạo Mạn': 'Arrogant', 'Tà Mị': 'Wicked',
  'Âm Hiểm': 'Cunning', 'Ôn Hòa': 'Gentle', 'Si Tình': 'Devoted', 'Tham Lam': 'Greedy',
  'Trung Thành': 'Loyal', 'Túc Trí Đa Mưu': 'Resourceful',
  'ngay thẳng, trọng nghĩa khí': 'upright, values honor', 'cởi mở, thích kết giao bằng hữu': 'open, loves making friends',
  'kiêu ngạo — thắng họ nhiều sẽ sinh thù hận': 'proud — beat them often and they will hold a grudge',
  'tà khí âm u, trọng lợi lạc, dễ ghi thù': 'dark-hearted, pleasure-seeking, bears grudges',
  'khó lường, ít để lộ tâm tư': 'hard to read, rarely shows intent',
  'ôn nhu dễ gần, tình cảm dễ nảy nở': 'gentle, quick to warm up',
  'đa tình, dễ rung động': 'romantic, easily moved', 'tham tài — quà càng quý càng trọng ngươi': 'greedy — the pricier the gift, the fonder',
  // Seasons & weather
  'Xuân': 'Spring', 'Hạ': 'Summer', 'Thu': 'Autumn', 'Đông': 'Winter',
  'Nắng đẹp': 'Clear skies', 'Nắng gắt': 'Scorching', 'Mưa phùn': 'Drizzle',
  'Mưa rào giông': 'Thunderstorm', 'Sương mù': 'Fog', 'Tuyết rơi': 'Snowfall',
  'Giang hồ lại trôi qua một vòng tuế nguyệt': 'Another year passes in the Jianghu',
  // Titles
  'Sơ Nhập Giang Hồ': 'Jianghu Novice', 'Bách Quái Trảm': 'Slayer of a Hundred',
  'Thiên Quái Trảm': 'Slayer of a Thousand', 'Thợ Rèn Truyền Thuyết': 'Legendary Smith',
  'Nguyên Anh Chân Quân': 'True Lord Nascent Soul', 'Hóa Thần Chân Nhân': 'Sage of Spirit Severing',
  'Tương Dương Đệ Nhất Hiệp': "Xiangyang's Greatest Hero", 'Giang Hồ Đại Hiệp': 'Great Hero of Jianghu',
  'Tiêu diệt 100 quái': 'Slay 100 monsters', 'Tiêu diệt 1.000 quái': 'Slay 1,000 monsters',
  'Hoàn thành toàn bộ chính tuyến': 'Complete the entire main storyline',
  'Độ kiếp thành Hóa Thần': 'Survive tribulation to Spirit Severing', 'Đỉnh cao mọi hệ thống': 'Pinnacle of all systems',
  // NPC roles
  'Trưởng Làng': 'Village Chief', 'Thợ Rèn · Lò Bát Quái': 'Smith · Bagua Forge', 'Thợ Rèn': 'Blacksmith',
  'Dược Lão · Dược Phường': 'Herbalist · Pharmacy', 'Dược Sư': 'Apothecary', 'Dược Lão': 'Old Herbalist',
  'Thương Nhân · Chợ Đấu Giá': 'Merchant · Auction House', 'Thương Nhân': 'Merchant', 'Trà Quán Chủ': 'Teahouse Keeper',
  'Bổ Đầu · Truy Nã Lệnh': 'Constable · Bounties', 'Bổ Đầu': 'Constable',
  'Binh Khí Chủ · Vũ Khí Phường': 'Arms Dealer · Weapon Shop', 'Quản Gia · Động Phủ': 'Steward · Cave Estate',
  'Thần Toán Tử · Vạn Duyên Các': 'Diviner · Fate Pavilion', 'Biên Ải Vệ Binh': 'Border Guard',
  'Quách Đại Hiệp': 'Great Hero Guo', 'Môn Khách': 'Retainer', 'Tán Tu': 'Rogue Cultivator',
  'Tân Binh Tập Luyện': 'Recruit Training', 'Thử Tài Tân Thủ': 'Trial of the Novice',
  // Misc UI
  'Cấp →': 'Lv →', 'Bí Kíp →': 'Tomes →', 'Đan Điền →': 'Dantian →', '(Tối đa)': '(Max)',
  'mạnh nhất vùng, cẩn thận!': 'strongest in the region — beware!', 'yếu nhất, hợp luyện công': 'weakest — good for practice',
  'cấp trung bình': 'mid-tier', 'mục tiêu trong': 'target within', 'người chơi': 'player',
  'an toàn tuyệt đối 100%': '100% safe', 'lửa': 'fire', 'máu': 'blood',
  'Gõ Cửa Giang Hồ': 'Knocking on Jianghu\'s Door', 'Bình Cảnh Chi Chiến': 'Battle of the Pass',
  'Dã Ngoại · PK': 'Wilds · PK', 'Huyết Chiến · Free PK': 'Bloodbath · Free PK',
  'PK tự do, không Tội Ác — giết thoải mái.': 'Free PK, no Sin — kill at will.',
  'Giết Du Hiệp không tăng Tội Ác': 'Killing Wanderers adds no Sin',
  'Võ học môn phái — tự ngộ khi đạt cấp': 'Sect arts — auto-learned by level',
  'Dung hợp cần Nguyên Anh · Trung Kỳ': 'Fusion requires Nascent Soul · Mid',
  'Chưa lĩnh ngộ đủ 2 môn tiền trệ': 'Prerequisite arts not yet learned',
  '· yêu cầu LV60': '· requires Lv60',
  'Hôm nay nói nhiều rồi, ngày mai ghé lại nhé.': 'Enough talk for today — come back tomorrow.',
  'Đứng yên nào.': 'Hold still.', 'Đến lượt ngươi.': 'Your turn.', 'Lên! Giết!': 'Charge! Kill!',
  'Ở lại cùng ta!': 'Stay with me!', 'Trăng lên rồi.': 'The moon is up.',
  'Tu luyện gấp gáp chi, tâm an vạn sự an.': 'Why rush cultivation — a calm heart settles all things.',
  'Giang hồ loạn lạc, kẻ sĩ nên lấy nghĩa làm đầu.': 'In troubled times, a hero puts honor first.',
  'Khí chất hiệp nghĩa, đi đâu cũng được người đời kính nể.': 'A chivalrous aura, respected everywhere.',
  'Hài hòa âm dương, không thiên vị bên nào.': 'Yin and yang in harmony, leaning to neither side.',
  'Bất tử không phải phúc — là phạt.': 'Immortality is not a blessing — it is a curse.',
  'Biết nhiều quá, không phải chuyện tốt đâu.': 'Knowing too much is never a good thing.',
  'Nghe nói Ngũ Ấn lại xao động — ngươi định xông pha chứ?': 'They say the Five Seals stir again — will you venture forth?',
  '"Giang hồ này, tin tức còn quý hơn bạc."': '"In the Jianghu, information is worth more than silver."',
  '"Giang hồ hiểm ác — nhưng trà trong quán này lúc nào cũng nóng."': '"The Jianghu is treacherous — but the tea in this house is always hot."',
  '"Vào đây uống chén trà nóng đã — chuyện giang hồ để sau hẵng hay."': '"Come in for a hot cup of tea — Jianghu business can wait."',
  '"Thuốc bổ hay thuốc độc — khác nhau ở liều lượng thôi, khách quân ạ."': '"Tonic or poison — only the dosage differs, dear guest."',
  '"Binh khí nhà ta ba đời rèn giũa — mở rương là biết liền."': '"Three generations of smithing — open a chest and see."',
  '"Kiếm tốt không chờ người — ngươi chậm thì người khác cầm mất."': '"A fine blade waits for no one — hesitate and another takes it."',
  '"Vì quốc vì dân, hiệp giả đại giả. Tương Dương còn, ta còn."': '"For nation and people, a true hero stands. While Xiangyang stands, I stand."',
  '"Bốn mươi năm trấn ải, xương già này chưa từng lùi một bước."': '"Forty years guarding this pass — these old bones have never taken one step back."',
  'Bạc không phải vạn năng, nhưng không bạc thì... ngươi hiểu mà.': "Silver isn't everything — but without it... you know.",
  'Ta thu mọi thứ — trừ lừa gạt.': 'I buy everything — except deceit.',
  'Ta không có tên. Chỉ có giá tiền.': 'I have no name. Only a price.',
  'Nghỉ ngơi dưỡng thần — hồi đầy HP và Chân Khí': 'Rest and recover — full HP and True Qi',
  'Dược Lão tự tay bốc thuốc — hồi đầy HP ngay lập tức': 'The Herbalist treats you himself — instant full HP',
  '3 phút +12% công lực — men say bừng bừng sát khí!': '3 min +12% power — drunk with killing intent!',
  '5 phút giảm 40% sát thương thiên lôi — cứ yên tâm độ kiếp!': '5 min -40% lightning damage — face tribulation calmly!',
  'Bảo mệnh độ kiếp — chịu 4 tia thiên lôi': 'Tribulation safeguard — absorbs 4 thunderbolts',
  'Bất Tử — chặn 1 đòn chí mạng, hồi 30% HP (180s)': 'Undying — blocks 1 fatal blow, heals 30% HP (180s)',
  'Mỗi màn chơi 1 lần: chết hồi sinh tại chỗ 50% máu': 'Once per run: revive on the spot at 50% HP',
  'Hồi 40% máu tức thì (phím R) — túi đựng tối đa 5 lọ': 'Instant 40% HP heal (press R) — carries up to 5',
  'Minimap hiện cả điểm Thảo Dược': 'Minimap also shows Herb spots',
  'Nguyên liệu rèn & đột phá Đan Điền': 'Forge & Dantian breakthrough material',
  'Tấn Phẩm & Kế Thừa — rơi từ quái/tinh anh': 'Promotion & Inheritance — drops from monsters/elites',
  'Khảm trang bị, rèn +7 trở lên — hiếm có': 'Socket gear, forge +7 and above — rare',
  'Rèn +10/+11 — cực hiếm': 'Forge +10/+11 — extremely rare',
  '×60 đổi Bảo Hạp Cổ Thần chọn bộ (Lò Rèn)': '×60 trades for a chosen Ancient God chest (Forge)',
  'rèn +7 trở lên · Áo Choàng': 'forge +7 and above · Cloak', 'rèn +10/+11 · Áo Choàng': 'forge +10/+11 · Cloak',
  'Bảo hiểm rèn +7 trở lên — xịt giữ nguyên cấp': 'Forge insurance +7 and above — fail keeps the level',
  'Lên +1 miễn phí, 100% thành công (áp dụng +0 đến +5)': 'Free +1, 100% success (applies to +0–+5)',
  'thất bại: giữ đồ & Ấn, mất nửa vật liệu': 'on failure: keep gear & Seal, lose half the materials',
  'Gói tiết kiệm — chỉ bán theo đợt': 'Budget bundle — sold in batches only',
  'tấn chức Tuyệt Học': 'promote to Ultimate Art',
  'dung hợp Huyết Ma Thôn Phệ': 'fuse into Blood Demon Devour',
  'Hồ Lô Thuốc hồi 55% máu (thay 40%)': 'Potion Gourd heals 55% HP (instead of 40%)',
  'Đả thông Kinh Mạch +25% tỉ lệ': 'Clear Meridians +25% rate',
  'Thái Cực hộ thể — phản 5% sát thương': 'Taiji guard — reflects 5% damage',
  'Rèn đồ +5% tỉ lệ thành công': 'Forge +5% success rate',
  '+1 Phong Linh Phù — bấm T gần tinh anh suy yếu': '+1 Spirit-Seal Charm — press T near a weakened elite',
  '+1 Đan Đột Phá': '+1 Breakthrough Pill', '+1 Đan Đột Phá — sẽ tự dùng khi độ kiếp': '+1 Breakthrough Pill — auto-used at tribulation',
  'MAX MODE — mọi tính năng tối đa!': 'MAX MODE — everything maxed!',
  'FULL SKILL — 34 võ học + 30 dung hợp, mọi kỹ năng Lv 120 (bấm K gán)': 'FULL SKILL — 34 arts + 30 fusions, all skills Lv 120 (press K to assign)',
  // Cheat help lines
  '/god — bật/tắt bất tử': '/god — toggle godmode',
  '/kill [bán kính=350] — hạ quái quanh mình': '/kill [radius=350] — slay nearby monsters',
  '/learn — học toàn bộ Võ Học Phổ': '/learn — learn the entire Codex',
  '/tenui — gỡ Trọng Thương (té núi lại ngay)': '/tenui — clear Heavy Wound (cliff-jump again)',
  '/wipe — xóa save & tải lại game': '/wipe — erase save & reload',
  '/boss — mở phong ấn & tới Tế Đàn Trấn Ải của map': '/boss — unseal & go to the Pass Guardian altar',
  '/max — mọi thứ tối đa (cấp 120, full đồ +11, full skill Lv 120)': '/max — everything maxed (Lv 120, full +11 gear, all skills Lv 120)',
  '/time [ngày=10] — nhảy thời gian thế giới (Lịch Tu Tiên)': '/time [days=10] — advance world time (Cultivation Calendar)',
  '/item [phẩm 0-4] [giai 1-10] — tạo trang bị vào túi': '/item [quality 0-4] [tier 1-10] — spawn gear into bag',
  '/fullskill — học hết võ học + 30 dung hợp, mọi kỹ năng Lv 120': '/fullskill — learn all arts + 30 fusions, all skills Lv 120',
};

/* ---- REGEX rules for dynamic/templated strings ---- */
const RULES = [
  [/^Cấp (\d+)$/, 'Lv $1'],
  [/^Cấp (\d+) → (\d+)$/, 'Lv $1 → $2'],
  [/^Luyện Khí · Tầng (\d+)$/, 'Qi Refining · Stage $1'],
  [/^Đan Điền cảnh (\d+) \((.*)\)$/, (m, a, b) => `Dantian Lv ${a} (${tr(b)})`],
  [/^Chương ([IVX]+) · (.*)$/, (m, a, b) => `Chapter ${a} · ${tr(b) === b ? b : tr(b)}`],
  [/^Bảo Hạp ([IVX]+)$/, 'Relic Chest $1'],
  [/^(.+) tầng (\d+) \(Tuyệt Học\)$/, (m, a, b) => `${a} — tier ${b} (Ultimate)`],
  [/^(.+) \((bị động)\)$/, (m, a) => `${a} (passive)`],
  [/^Thú Cưỡi → tầng (\d+)$/, 'Mount → tier $1'],
  [/^(\d+)\/7 ấn đã vỡ\.$/, '$1/7 seals broken.'],
  [/^(.+) ×(\d+)$/, (m, a, b) => `${tr(a)} ×${b}`],
  [/^×(\d+) (.*)$/, (m, a, b) => `×${a} ${trFrag(b)}`],
  [/^\+(\d+)% (.*)$/, (m, a, b) => `+${a}% ${trFrag(b)}`],
  [/^\+(\d+) (.*)$/, (m, a, b) => `+${a} ${trFrag(b)}`],
  [/^(\d+) phút (.*)$/, (m, a, b) => `${a} min: ${trFrag(b)}`],
  [/^(\d+)s (.*)$/, (m, a, b) => `${a}s: ${trFrag(b)}`],
  [/^Bị động: (.*)$/, (m, a) => `Passive: ${trFrag(a)}`],
  [/^rèn \+(\d+)(.*)$/, (m, a, b) => `forge +${a}${trFrag(b)}`],
  [/^Tàn Quyển \((.*)\)$/, (m, a) => `Fragment (${a})`],
  [/^Phó Bản · (.*)$/, (m, a) => `Dungeon · ${a}`],
  [/^(.+) · Vách Té Núi$/, (m, a) => `${tr(a)} · Cliff of Fortune`],
  [/^Qua Cổng (.*) → (.*)$/, (m, a, b) => `Through ${a} Gate → ${tr(b)}`],
  [/^Đạt cấp (\d+)$/, 'Reach Lv $1'],
  [/^Đã hạ$/, 'Slain'],
  [/^yêu cầu LV(\d+)$/i, 'requires Lv$1'],
  [/^cần cấp (\d+)$/i, 'requires Lv $1'],
  [/^Lễ Bạc (\d+)◈$/, 'Gift $1◈ silver'],
];

/* ---- core translate ---- */
function tr(s) {
  if (lang !== 'en' || !s || typeof s !== 'string') return s;
  if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
  const t2 = s.trim();
  if (t2 !== s && Object.prototype.hasOwnProperty.call(EXACT, t2)) return s.replace(t2, EXACT[t2]);
  for (const [re, rep] of RULES) {
    const m = s.match(re);
    if (m) return typeof rep === 'function' ? rep(...m) : s.replace(re, rep);
  }
  return s;
}

/* ---- canvas patch: translate all text drawn to canvas ---- */
for (const meth of ['fillText', 'strokeText', 'measureText']) {
  const orig = CanvasRenderingContext2D.prototype[meth];
  CanvasRenderingContext2D.prototype[meth] = function (t, ...rest) {
    return orig.call(this, lang === 'en' ? tr(String(t)) : t, ...rest);
  };
}

/* ---- DOM observer: translate text nodes & common attributes ---- */
let busy = false;
function trNode(n) {
  if (n.__ghhaI18n) return;
  const v = n.nodeValue;
  if (!v) return;
  const t = tr(v.trim()) === v.trim() ? v : v.replace(v.trim(), tr(v.trim()));
  if (t !== v) { busy = true; n.nodeValue = t; busy = false; n.__ghhaI18n = true; }
}
function trAttrs(root) {
  const els = root.querySelectorAll ? root.querySelectorAll('[title],[placeholder]') : [];
  els.forEach(el => {
    for (const at of ['title', 'placeholder']) {
      const v = el.getAttribute(at);
      if (v && tr(v) !== v) { busy = true; el.setAttribute(at, tr(v)); busy = false; }
    }
  });
}
function walk(root) {
  if (root.nodeType === 3) { trNode(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let n;
  while ((n = w.nextNode())) nodes.push(n);
  for (const nd of nodes) trNode(nd);
  trAttrs(root);
}
const obs = new MutationObserver(muts => {
  if (lang !== 'en' || busy) return;
  for (const m of muts) {
    if (m.type === 'characterData') { m.target.__ghhaI18n = false; trNode(m.target); }
    else m.addedNodes.forEach(nd => walk(nd));
  }
});
function boot() {
  obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  if (lang === 'en') walk(document.body);
  addToggle();
}

/* ---- language toggle (start screen & in-game) ---- */
function addToggle() {
  if (document.getElementById('ghha-lang-toggle')) return;
  const b = document.createElement('button');
  b.id = 'ghha-lang-toggle';
  b.textContent = lang === 'en' ? '🇻🇳 VI' : '🇬🇧 EN';
  b.title = 'Language / Ngôn ngữ';
  b.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999;'
    + 'padding:4px 12px;border-radius:999px;border:1px solid #8a6d3b;background:rgba(29,23,18,.92);'
    + 'color:#f0d68a;font:700 12px/1.4 system-ui,sans-serif;cursor:pointer;opacity:.9;pointer-events:auto';
  b.onmouseenter = () => { b.style.opacity = '1'; };
  b.onmouseleave = () => { b.style.opacity = '.9'; };
  b.onclick = () => {
    const nl = lang === 'en' ? 'vi' : 'en';
    const ask = nl === 'en'
      ? 'Switch to English?\nThe game will reload (progress is saved automatically).'
      : 'Chuyển sang Tiếng Việt?\nGame sẽ tải lại (tiến trình đã tự lưu).';
    if (confirm(ask)) { try { localStorage.setItem(KEY, nl); } catch (e) {} location.reload(); }
  };
  document.body.appendChild(b);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
