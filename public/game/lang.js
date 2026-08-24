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
  // ── Side-quest panel chrome ──
  'Nhận Nhiệm Vụ': 'Accept Quest', 'Nhận Thưởng': 'Claim Reward',
  'Đang nhận tối đa 3 phụ tuyến — hoàn thành bớt rồi quay lại.': 'Max 3 active side quests — finish some, then come back.',
  '★ Chính tuyến đã hoàn tất — ngươi chính là Huyễn Ảnh Chí Tôn!': '★ Main storyline complete — you are the Phantom Supreme!',
  'gặp': 'to meet',
  'PHỤ TUYẾN — ĐÀO HOA ĐẢO': 'SIDE QUESTS — PEACH BLOSSOM ISLAND',
  'PHỤ TUYẾN — TƯƠNG DƯƠNG THÀNH': 'SIDE QUESTS — XIANGYANG CITY',
  'PHỤ TUYẾN — NGOẠI Ô TƯƠNG DƯƠNG': 'SIDE QUESTS — XIANGYANG OUTSKIRTS',
  'PHỤ TUYẾN — CHUNG NAM SƠN': 'SIDE QUESTS — MT. ZHONGNAN',
  'PHỤ TUYẾN — CỔ MỘ MẬT THẤT': 'SIDE QUESTS — ANCIENT TOMB SANCTUM',
  'PHỤ TUYẾN — TUYỆT TÌNH CỐC': 'SIDE QUESTS — PASSIONLESS VALLEY',
  'PHỤ TUYẾN — MÔNG CỔ ĐẠI DOANH': 'SIDE QUESTS — MONGOL WAR CAMP',
  'PHỤ TUYẾN — NHẠN MÔN QUAN': 'SIDE QUESTS — YANMEN PASS',
  // ── Chapter subtitles ──
  'Tương Dương Phong Vân': 'Winds over Xiangyang', 'Chung Nam Vân Vụ': 'Mists of Zhongnan',
  'Cổ Mộ U Ảnh': 'Shadows of the Ancient Tomb', 'Tuyệt Tình Tình Chướng': 'The Passionless Passion Barrier',
  'Mông Cổ Phong Sa': 'Sandstorm of the Mongols', 'Nhạn Môn Huyết Chiến': 'Bloodbath at Yanmen',
  // ── Main quest names (35 chương) ──
  'Gõ Cửa Giang Hồ': 'Knocking on the Jianghu\'s Door', 'Thử Tài Tân Thủ': 'A Test for the Novice',
  'Thảo Dược Cứu Người': 'Herbs to Heal', 'Sói Dữ Quấy Phá': 'Wolves on the Prowl',
  'Rèn Luyện Sơ Nhập': 'First Steps at the Forge', 'Sơn Tặc Hoành Hành': 'Bandits Run Rampant',
  'Tĩnh Tâm Nhập Định': 'Still Mind, Deep Trance', 'Điểm Huyệt Phá Thế': 'Pressure-Point Breaker',
  'Trấn Phái Truyền Thừa': 'The Sect\'s Legacy Art', 'Bình Cảnh Chi Chiến': 'Battle of the Threshold',
  'Phá Cảnh Nhập Thành': 'Breakthrough into the City', 'Quân Nhu Thiếu Hụt': 'Army Supplies Run Short',
  'Thổ Phỉ Ngoại Ô': 'Brigands of the Outskirts', 'Triệu Tập Anh Hùng': 'Mustering the Heroes',
  'Lập Uy Trước Giặc': 'Show of Might Before the Foe', 'Bái Sơn Môn': 'Homage at the Mountain Gate',
  'Phản Đồ Loạn Đạo': 'Traitors Corrupt the Way', 'Xà Nữ Mê Tâm Thuật': 'The Serpent Women\'s Beguilement',
  'Kiếm Khách Bán Đảo': 'The Islet Swordsman', 'Người Thủ Mộ': 'The Tomb Keeper',
  'Thị Nữ Dạ Khúc': 'Maidens\' Night Lament', 'Phá Mộc Nhân Trận': 'Breaking the Wooden Man Formation',
  'Huyết Bát Tẫu Loạn': 'The Blood Bat Rampage', 'Tình Hoa Độc': 'Passion Flower Poison',
  'Đệ Tử Thất Lạc': 'The Lost Disciples', 'Độc Yêu Tà Vụ': 'Venom Demons in Wicked Mist',
  'Hắc Y Thích Khách': 'Black-Clad Assassins', 'Nội Ứng Trong Doanh': 'The Mole in the Camp',
  'Cắt Đứt Tai Mắt': 'Severing Eyes and Ears', 'Phá Cung Thủ Trận': 'Breaking the Archer Line',
  'Hắc Kỵ Phong Ba': 'Storm of the Dark Riders', 'Trấn Ải Chi Binh': 'Soldiers of the Pass Guardians',
  'Cuồng Binh Xung Trận': 'Berserkers Charge the Line', 'Liệt Hỏa Kỳ Lân': 'The Fire Qilin',
  'Huyễn Ảnh Chí Tôn': 'Phantom Supreme',
  // ── 50 phụ tuyến Kim Dung — tên ──
  'Lễ Vật Đầu Xuân': 'New Year Tribute', 'Phương Thuốc Cứu Dịch': 'Plague-Remedy Prescription',
  'Sói Dữ Vây Làng': 'Wolves at the Gates', 'Hồ Ly Trộm Thuốc': 'The Medicine-Thieving Foxes',
  'Truy Kích Hắc Phong Dư Đảng': 'Hunt the Black Wind Remnants', 'Phá Trận Hồn': 'Breaking the Formation Souls',
  'Thuốc Cho Bà Cụ': 'Medicine for the Old Dame', 'Kẻ Đứng Sau Vụ Cướp': 'The Mastermind Behind the Raid',
  'Dọn Đường Lương Thực': 'Clear the Grain Road', 'Sói Hoành Ngoại Ô': 'Wolves Ravage the Outskirts',
  'Truy Nã Hắc Phong': 'Black Wind Wanted', 'Điểm Danh Nghĩa Sĩ': 'Muster of the Righteous',
  'Trận Nhân Thất Thủ': 'Runaway Sentinels', 'Quân Nhu Dược Liệu': 'Medicine for the Army',
  'Tà Đồ Giang Hồ': 'Heretics of the Jianghu', 'Lễ Vật Bái Sơn': 'Gifts for the Mountain',
  'Tru Di Phản Đồ': 'Purge the Traitors', 'Cướp Bóc Đạo Sĩ': 'Robbers of Taoists',
  'Bạch Xà Tà Tông': 'The White Serpent Cult', 'Kiếm Khách Lạc Bước': 'Swordsmen Led Astray',
  'Thử Kiếm Thái Hư': 'Trial of the Taixu Sword', 'Đạo Tặc Giả Danh': 'Impostors in Taoist Robes',
  'Thăm Hỏi Cổ Mộ': 'Visit to the Ancient Tomb', 'Ngọc Nữ Thất Tung': 'The Jade Maidens Astray',
  'Cơ Quan Thất Khống': 'Mechanisms Gone Wild', 'Dơi Máu Ùa Về': 'The Blood Bat Swarm',
  'Kẻ Dòm Ngó Mộ Địa': 'Tomb Robbers', 'Tổ Sư Tỉnh Giấc': 'The Ancestor Awakens',
  'Bức Thư Tuyệt Tình': 'A Letter to Passionless Valley', 'Đệ Tử Mất Lý Trí': 'Disciples Driven Mad',
  'Tình Hoa Nở Máu': 'Passion Flowers in Blood Bloom', 'Sát Thủ Của Cốc Chủ': 'The Valley Lord\'s Assassins',
  'Tình Địch': 'Rivals in Love', 'Cốc Chủ Thịnh Nộ': 'The Valley Lord\'s Wrath',
  'Mật Tín Thảo Nguyên': 'Secret Letter to the Steppe', 'Mắt Tai Kim Luân': 'Eyes and Ears of the Golden Wheel',
  'Đoạt Cung Xạ': 'Seize the Bows', 'Thiết Kỵ Đột Kích': 'Iron Cavalry Charge',
  'Nội Gián Bại Lộ': 'The Exposed Traitors', 'Đại Hãn Xuất Trận': 'The Khan Takes the Field',
  'Biên Quan Huyết Chiến': 'Bloodbath at the Border', 'Tu La Đạo': 'The Asura Path',
  'Kỳ Lân Cuồng Hỏa': 'Qilins of Raging Fire', 'Giang Hồ Đại Loạn': 'The Jianghu in Turmoil',
  'Quan Chủ Tử Thủ': 'The Pass Lord\'s Last Stand', 'Báo Tin Thắng Trận': 'News of Victory',
  'Lông Cáo Nhuộm Dược': 'Fox Fur for Dyeing', 'Thuốc Cho Thương Binh': 'Medicine for the Wounded',
  'Tuấn Mã Cho Tân Binh': 'Steeds for New Recruits', 'Nghiệt Kỵ': 'The Remnant Riders',
  // ── 50 phụ tuyến Kim Dung — mô tả ──
  'Dân làng sắp đón khách quý từ Tương Dương — cần 12 Dã Trư làm thịt đãi tiệc.': 'The village expects honored guests from Xiangyang — hunt 12 Wild Boars for the feast.',
  'Bệnh dịch lan trong làng. Hái 8 Thảo Dược giúp Dược Sư chế thuốc cứu người.': 'An illness spreads through the village. Gather 8 Herbs so the Herbalist can brew a cure.',
  'Bầy Tàn Lang từ rừng Đào kéo xuống cắn gia súc. Diệt 10 con bảo vệ làng.': 'Fierce Wolves from the peach woods are killing livestock. Slay 10 to protect the village.',
  'Cáo Đỏ thành tinh trộm dược liệu quý. Diệt 8 con đoạt lại thuốc.': 'Red Foxes turned uncanny steal rare ingredients. Slay 8 to take the medicine back.',
  'Dư đảng đạo tặc đêm trước lẩn vào rừng. Diệt 10 tên Sơn Tặc trừ hậu họa.': 'Remnants of last night\'s raiders hide in the woods. Slay 10 Mountain Bandits to end the threat.',
  'Đào Hoa Trận Nhân cuồng hóa tấn công dân làng — gợi nhớ trận pháp thất truyền của Đảo Chủ. Phá 6 tượng.': 'Peach Blossom Formation Sentinels have gone berserk — echoes of the Island Master\'s lost formations. Destroy 6.',
  'Bà cụ đầu làng lâm bệnh nặng. Đến gặp Dược Sư xin thuốc cứu người gấp.': 'The old dame at the village entrance is gravely ill. Beg the Herbalist for medicine at once.',
  'Tên Hắc Phong Sát tinh nhuệ còn phục trên đảo. Diệt hắn, giang hồ mới yên.': 'An elite Black Wind Slayer still lurks on the island. Slay him, and the jianghu may rest.',
  'Sơn Tặc ngoại ô chặn đoàn xe lương vào thành. Diệt 12 tên mở đường.': 'Outskirts bandits block the grain carts bound for the city. Slay 12 to open the road.',
  'Tàn Lang ngoại ô quấy phá nông dân. Diệt 12 con.': 'Fierce Wolves harass farmers outside the city. Slay 12.',
  'Quách Đại Hiệp treo thưởng 2 tên Hắc Phong Sát tinh nhuệ ngoài thành.': 'Hero Guo offers a bounty on 2 elite Black Wind Slayers outside the walls.',
  'Đến gặp Môn Khách ghi danh nghĩa sĩ thủ thành — Quách Đại Hiệp cần biết ai còn ai mất.': 'See the Retainer to enlist as a city defender — Hero Guo must know who yet stands.',
  'Trận Nhân trôi lạc ngoại ô hóa cuồng. Phá 8 tượng thu hồi trận cơ.': 'Stray Formation Sentinels in the outskirts have gone berserk. Destroy 8 and recover the formation cores.',
  'Thương binh đầy doanh trại. Về Đào Hoa Đảo hái 10 Thảo Dược gấp.': 'The camp overflows with wounded. Return to Peach Blossom Island and gather 10 Herbs at once.',
  'Ba tên du hiệp tà đạo lẫn trên Chung Nam bức hiếp lữ khách. Trừng trị 3 tên.': 'Three wicked wandering heroes prey on travelers at Mt. Zhongnan. Punish all 3.',
  'Đem lễ vật của Quách Đại Hiệp lên Chung Nam giao cho Đạo Sĩ Toàn Chân — đáp lễ nghĩa cử năm xưa.': 'Deliver Hero Guo\'s gifts to the Quanzhen Taoist on Mt. Zhongnan — repaying an old debt of honor.',
  'Phản đồ Toàn Chân còn lẩn trong núi. Diệt 10 tên thanh tẩy môn phái.': 'Quanzhen traitors still hide in the mountains. Slay 10 to cleanse the sect.',
  'Sơn Tặc chặn cướp đạo sĩ hành lễ. Diệt 8 tên trả lại thanh danh.': 'Bandits waylay pilgrim Taoists. Slay 8 to restore their honor.',
  'Xà Nữ theo tà phái phương Tây kéo đến gieo độc. Diệt 10 con.': 'Serpent Women of a western heresy arrive spreading venom. Slay 10.',
  'Kiếm Khách Bán Đảo luyện tà công tẩu hỏa nhập ma — hóa giải 6 người bằng võ.': 'Islet Swordsmen practicing wicked arts have succumbed to qi deviation — save 6 by force of arms.',
  'Thái Hư Kiếm Thánh trấn ải Chung Nam chờ đối thủ. Thắng ải để chứng tỏ kiếm đạo.': 'The Taixu Sword Saint guarding Zhongnan\'s pass awaits a challenger. Defeat him to prove your sword dao.',
  'Kẻ giả danh đạo sĩ lừa đảo tín đồ quanh Chung Nam. Diệt 4 tên mạo danh.': 'Impostors posing as Taoists swindle believers around Zhongnan. Slay 4 of them.',
  'Cổ Mộ phái truyền nhân mất tích nhiều năm — sang thăm Thủ Mộ Nhân hỏi thăm sức khỏe.': 'The Ancient Tomb heir vanished years ago — visit the Tomb Keeper and ask after her health.',
  'Thị Nữ Cổ Mộ mất phương hướng tấn công khách lạ. Siêu độ 10 người.': 'Tomb Maidens who lost their way now attack strangers. Lay 10 of them to rest.',
  'Cơ Quan Mộc Nhân thời xây mộ nổi điên. Phá 8 cỗ máy.': 'The tomb\'s old Wooden Mechanisms have run amok. Destroy 8 machines.',
  'Huyết Biên Bức ùa ra khỏi mật thất mỗi đêm. Diệt 10 con.': 'Blood Bats pour from the crypt each night. Slay 10.',
  'Du hiệp tham bảo vật lẻn vào đào trộm mộ địa. Trừng trị 3 tên.': 'Greedy wandering heroes sneak in to rob the tomb. Punish 3 of them.',
  'Cổ Mộ Tổ Sư trấn ải thức tỉnh. Thắng ải để chứng minh tư cách kế thừa.': 'The Ancient Tomb Ancestor stirs from slumber. Best her to prove yourself the rightful heir.',
  'Thủ Mộ Nhân có thư gửi Tuyệt Tình Môn Nhân — chuyện xưa chưa đoạn.': 'The Tomb Keeper has a letter for the Passionless Disciple — some old tales never end.',
  'Đệ tử trong cốc trúng Tình Hoa độc hóa cuồng. Giải thoát 10 người.': 'Valley disciples poisoned by the Passion Flower run mad. Free 10 of them.',
  'Tình Hoa Độc Yêu nở rộ khắp cốc. Diệt 8 con lấy nhụy hoa giải độc.': 'Passion Flower Demons bloom across the valley. Slay 8 for their antidote stamens.',
  'Cốc Chủ phái Hắc Y Sát Thủ thanh trừ dị nghị. Diệt 8 tên tự vệ.': 'The Valley Lord sent Black-Clad Assassins to purge dissent. Slay 8 in self-defense.',
  'Du hiệp lỡ tình vào cốc quấy nhiễu đệ tử tu luyện. Đuổi diệt 4 tên.': 'Jilted wandering heroes storm the valley to harass disciples. Drive off 4 of them.',
  'Tuyệt Tình Cốc Chủ trấn ải giận dữ. Thắng ải để cốc được yên.': 'The Passionless Valley Lord rages behind the pass. Defeat him to calm the valley.',
  'Đưa mật tín cho Nội Ứng trong doanh địch — đường đi ngàn dặm, cẩn thận.': 'Carry a secret letter to the Mole inside the enemy camp — a thousand li of peril. Be careful.',
  'Thám Tử Mông Cổ — mắt tai của quốc sư — rình mò quân tình. Diệt 10 tên.': 'Mongol Scouts — eyes and ears of the Imperial Preceptor — spy on our army. Slay 10.',
  'Cung Thủ thảo nguyên bắn tỉa dân lành. Diệt 10 tên đoạt cung.': 'Steppe Archers snipe innocent folk. Slay 10 and take their bows.',
  'Hắc Ám Kỵ Binh xung quanh doanh địa. Diệt 8 kỵ.': 'Dark Riders raid around the camp. Slay 8 riders.',
  'Ba đại hiệp đầu quân cho người Mông — nghĩa tử vi tình, diệt 3 tên phản bội.': 'Three great heroes defected to the Mongols — duty before sentiment. Slay the 3 traitors.',
  'Đột Thông Đại Hãn thân chinh. Thắng ải lay động cả thảo nguyên.': 'The Dothong Great Khan rides to war himself. Defeat him and shake the steppe.',
  'Đột Quyết Cuồng Binh ép sát quan ải. Diệt 10 tên giữ trận tuyến.': 'Turkic Berserkers press upon the pass. Slay 10 to hold the line.',
  'Tu La Đao Khách — đạo tặc từng đồ sát cả trại — lộ diện Nhạn Môn. Diệt 8 tên.': 'Asura Blade Guests — brigands who once massacred a whole camp — surface at Yanmen. Slay 8.',
  'Liệt Hỏa Kỳ Lân cuồng nộ thiêu rụi lương thảo. Thu phục 5 con.': 'Fire Qilins run wild, burning the fodder stores. Subdue 5.',
  'Đại hiệp các phái tụ tập Nhạn Môn tranh đoạt bí kíp. Dẹp loạn 4 kẻ.': 'Heroes of every sect brawl at Yanmen over a secret manual. Quell 4 of them.',
  'Nhạn Môn Quan Chủ trấn ải cuối cùng. Thắng ải — thiên hạ thái bình.': 'The Lord of Yanmen Pass — the final guardian. Defeat him, and the realm knows peace.',
  'Về Tương Dương báo cho Quách Đại Hiệp tin biên quan đại thắng.': 'Return to Xiangyang and bring Hero Guo word of the border victory.',
  'Dược Sư cần lông Cáo Đỏ nhuộm dược tán. Săn 12 con.': 'The Herbalist needs Red Fox fur for dye tinctures. Hunt 12.',
  'Hái 12 Thảo Dược về Tương Dương cứu thương binh nặng.': 'Gather 12 Herbs for Xiangyang\'s gravely wounded soldiers.',
  'Bắt 3 Tuấn Mã Hoang ngoại ô trang bị cho tân binh thủ thành (rượt kiệt sức rồi bấm E).': 'Catch 3 Wild Steeds in the outskirts for the city\'s new recruits (chase them to exhaustion, then press E).',
  'Hắc Ám Kỵ Binh tàn dư còn rảo quanh doanh trại cũ. Diệt 12 kỵ quét sạch.': 'Remnant Dark Riders still prowl the old camp. Slay 12 to sweep it clean.',
  // ── Intro story (4 trang, text-node fragments) ──
  'GIANG HỒ HUYỄN ẢNH': 'PHANTOM JIANGHU',
  'Nam Tống niên hiệu Thiệu Hưng — thiên hạ đại loạn.': 'Southern Song, Shaoxing era — the realm in chaos.',
  'Quân Mông Cổ từ thảo nguyên phương Bắc kéo xuống như vũ bão, vây chặt': 'The Mongol host sweeps down from the northern steppe like a storm, besieging',
  '— cánh cửa cuối cùng của Trung Nguyên.': '— the last gate of the Central Plains.',
  'Giang hồ chấn động. Ngũ Tuyệt tàn lụi, anh hùng các phái đổ về Tương Dương nghĩa cử cao đẹp... hoặc ẩn mình chờ thời.': 'The jianghu trembles. The Five Greats fade; heroes of every sect flock to Xiangyang for noble deeds... or lie low, biding their time.',
  'THỜI VẬN CỦA NGƯƠI': 'YOUR TIME HAS COME',
  'Ngươi — một thiếu niên mồ côi — được': 'You — an orphaned youth — were raised by',
  'Trưởng Làng Thanh Ngưu': 'Village Chief Thanh Ngưu',
  'nuôi dưỡng ở': 'on',
  ', hòn đảo hoa đào nở quanh năm giữa biển Đông.': ', an isle of year-round peach blossoms in the East Sea.',
  'Đêm qua, đạo tặc': 'Last night, the raiders of',
  'đã đổ bộ lên đảo, cướp phá làng chài...': 'stormed ashore, pillaging the fishing village...',
  'Buổi sáng nay, lão nhân giao cho ngươi một thanh kiếm cũ:': 'This morning, the old man pressed an old sword into your hands:',
  '"Con à... giang hồ này, sớm muộn cũng cần người đứng ra. Hãy đến': '"Child... this jianghu will need someone to stand up, sooner or later. Go to',
  'Tương Dương': 'Xiangyang', 'bái kiến': 'and seek an audience with',
  '— và bước đi."': '— and walk your path."',
  'THẤT ĐẠI MÔN PHÁI': 'THE SEVEN GREAT SECTS',
  'Bảy môn phái lớn đang chiêu mộ đệ tử:': 'Seven great sects are recruiting disciples:',
  'Mỗi phái một hệ': 'Each sect commands one element of the',
  'Ngũ Hành': 'Five Elements',
  '— khắc hệ sẽ gây thêm': '— countering an element deals an extra',
  'lên quái bị khắc.': 'to countered monsters.',
  'Ngươi sẽ khởi đầu làm': 'You begin as a free',
  'tự do — tới': '— at',
  'cấp 10': 'Lv 10',
  'đủ danh tiếng, 7 môn phái sẽ mở cửa cho ngươi bái sư.': 'with enough renown, the 7 sects will open their doors to you.',
  'Con đường võ học:': 'The martial path:',
  'Rèn trang bị +11': 'Forge gear to +11', 'Đan Điền 9 cảnh giới': 'Dantian — 9 realms',
  '8 Kinh Mạch': '8 Meridians', 'Tuyệt Học 7 tầng': 'Ultimate Arts — 7 tiers',
  '— và cuối cùng,': '— and finally,',
  'Tương Dương Đệ Nhất Hiệp': 'Xiangyang\'s Greatest Hero',
  'HÀNH TRÌNH BẮT ĐẦU': 'THE JOURNEY BEGINS',
  '"Từ Đào Hoa Đảo, qua Chung Nam Sơn, vào Cổ Mộ, lên Tuyệt Tình Cốc, ra Mông Cổ Đại Doanh... cho tới Nhạn Môn Quan đẫm máu."': '"From Peach Blossom Island, across Mt. Zhongnan, into the Ancient Tomb, up Heartbreak Valley, out to the Mongol War Camp... to blood-soaked Yanmen Pass."',
  'Phía trước là': 'Ahead lie',
  '100 cấp tu luyện': '100 levels of cultivation',
  ', vạn quân thảo phạt, và danh hiệp cao nhất giang hồ.': ', ten thousand foes to vanquish, and the highest title in the jianghu.',
  'Từ thành Tương Dương, bước vào': 'From Xiangyang City, step into',
  'Giang Hồ Huyễn Ảnh.': 'the Phantom Jianghu.',
  'Bỏ qua ▸▸': 'Skip ▸▸', 'Tiếp ▸': 'Next ▸',
  '⚔ Bắt Đầu Hành Trình': '⚔ Begin the Journey', 'Bắt Đầu Hành Trình': 'Begin the Journey',
  'Tiếp Tục Hành Trình': 'Continue the Journey',
  // ── Sect select / ceremony ──
  'Giang Hồ Huyễn Ảnh': 'Phantom Jianghu',
  'Huyễn Ảnh Chí Tôn · PvE': 'Phantom Supreme · PvE',
  'Chọn môn phái để bắt đầu hành trình — 7 môn phái ngũ hành · Đan Điền · Kinh Mạch · Tuyệt Học · Thú Chiến': 'Choose a sect to begin your journey — 7 elemental sects · Dantian · Meridians · Ultimate Arts · Beast Wars',
  '🎬 Xem Video Giới Thiệu Bát Phái (90s)': '🎬 Watch the Eight Sects Intro Video (90s)',
  'Chế độ thử nghiệm — bắt đầu cấp 60, đầy đủ trang bị & vật liệu': 'Test mode — start at Lv 60 with full gear & materials',
  '🧪 Chế độ thử nghiệm — vào game cấp 100, full trang bị & mọi tính năng mở sẵn': '🧪 Test mode — enter at Lv 100, full gear & all features unlocked',
  'Bái Sư Nhập Phái': 'Pledge to a Sect',
  'Mười cấp lang bạt đã đủ danh tiếng — 7 môn phái cùng mở cửa thu nhận.': 'Ten levels of wandering have earned you renown — all 7 sects open their doors.',
  'Chọn một, con đường võ học của ngươi sẽ đổi thay mãi mãi.': 'Choose one — your martial path will change forever.',
  'Để Sau — Ta Còn Muốn Lang Bạt': 'Later — I Wish to Wander On',
  // ── Quẻ Tiên Thiên ──
  '☯ Quẻ Tiên Thiên': '☯ Innate Fortunes',
  'Trời sinh tính, đất dưỡng tài — mười sáu quẻ úp sấp giữa càn khôn.': 'Heaven grants nature, earth nurtures talent — sixteen fortunes lie face-down between heaven and earth.',
  'Bấm để lật quẻ': 'Tap to flip a fortune',
  ', đọc vận mệnh kiếp này, rồi': ', read the fate of this life, then',
  'chọn đúng 3 quẻ': 'choose exactly 3 fortunes',
  'mang vào đời!': 'to carry into the world!',
  '🀄 Xáo Lại Bàn Quẻ': '🀄 Reshuffle the Board',
  '— Chọn tính cách —': '— Choose your nature —',
  '— Danh Tính Giang Hồ —': '— Your Jianghu Name —',
  'Tên nhân vật của bạn...': 'Your character name...',
  'Gieo quẻ đặt tên': 'Roll a random name',
  '/help — lenh playtest': '/help — playtest commands',
  '✨ 3 quẻ HUYỀN trở lên — sẽ mở danh hiệu ẩn 【Thiên Mệnh Sở Quy】!': '✨ 3 MYSTIC fortunes or better — unlocks the hidden title 【Fated by Heaven】!',
  'LINH': 'SPIRIT',
  'Hắc Phong Sát': 'Black Wind Slayer', 'Hắc Phong Sát Thủ': 'Black Wind Chief',
  // ── 16 trait Quẻ Tiên Thiên ──
  'Thần Lực': 'Divine Strength', 'Nhục Thân Cường Tráng': 'Stalwart Body',
  'Ăn May': 'Born Lucky', 'Chân Khí Dồi Dào': 'Abundant True Qi',
  'Túc Trí Đa Mưu': 'Cunning Mind', 'Thiên Tài Luyện Khí': 'Forging Prodigy',
  'Bách Bộ Thần Hành': 'Hundred-Step Swiftness', 'Thiên Nhãn': 'Heavenly Eye',
  'Long Tích Hổ Bộ': 'Dragon Stride, Tiger Step', 'Đoạn Ngọc Thủ': 'Jade-Sundering Hand',
  'Sát Tâm': 'Killing Heart', 'Dược Thể': 'Herbal Body',
  'Võ Hồn': 'Martial Soul', 'Thiên Mệnh': 'Heaven\'s Mandate',
  'Kỳ Mạch Đại Thông': 'Open Meridians', 'Vạn Vật Hữu Duyên': 'Fortune\'s Favorite',
  '+8 Tấn Công': '+8 Attack', '+55 Sinh Lực tối đa': '+55 Max HP',
  '+5% tỉ lệ quái rớt đồ': '+5% monster drop rate', '+15 Nội Lực tối đa': '+15 Max Qi',
  'Ám Khí +15% ST · phá khiên lâu thêm 4s': 'Hidden Weapons +15% DMG · shield-break lasts 4s longer',
  'Giết Du Hiệp không tăng Tội Ác': 'Slaying Wandering Heroes grants no Sin',
  'Chiêu thức +12% Sát Thương': 'Skills +12% Damage', '+15% Bạc rơi': '+15% silver drops',
  // ── Tính cách ──
  'Chính Trực': 'Righteous', 'Tà Khí': 'Heretical', 'Trung Dung': 'Balanced',
  'Khí chất hiệp nghĩa, đi đâu cũng được người đời kính nể.': 'A chivalrous bearing — respected wherever you go.',
  'Đường tà đạo — Du Hiệp kiêng kị, dân thường e ngại.': 'The heretic path — wandering heroes shun you, commoners fear you.',
  'Hài hòa âm dương, không thiên vị bên nào.': 'Yin and yang in harmony, favoring neither side.',
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
  // ── Side-quest panel dynamic strings ──
  [/^Thưởng: (.+)$/, (m, a) => `Reward: ${a}`],
  [/^Tiến độ: (.*?) · Thưởng: (.+)$/, (m, a, b) => `Progress: ${a} · Reward: ${b}`],
  [/^Cần cấp (\d+) · Tiến độ chính tuyến chưa đủ$/, 'Requires Lv $1 · Main story progress not reached'],
  [/^◈ (.+)$/, (m, a) => `◈ ${tr(a)}`],
  [/^✔ (.+)$/, (m, a) => `✔ ${tr(a)}`],
  [/^🔒 (.+)$/, (m, a) => `🔒 ${tr(a)}`],
  [/^(.+) — Hoàn thành!$/, (m, a) => `${tr(a)} — Completed!`],
  [/^★ Chính tuyến (\d+): (.+)$/, (m, a, b) => `★ Main Quest ${a}: ${tr(b)}`],
  [/^★ Chính tuyến hiện tại: "(.+)" — hãy đến$/, (m, a) => `★ Current main quest: "${tr(a)}" — go to`],
  [/^Phụ tuyến hoàn thành — về gặp (.+)$/, (m, a) => `Side quest complete — return to ${tr(a)}`],
  [/^Hoàn thành phụ tuyến: (.+)!$/, (m, a) => `Side quest complete: ${tr(a)}!`],
  [/^(.+?) (\d+)\/(\d+)$/, (m, a, b, c) => `${tr(a)} ${b}/${c}`],
  // ── Quẻ Tiên Thiên dynamic ──
  [/^— Quẻ (\d+) —$/, '— Fortune $1 —'],
  [/^🀄 Xáo Lại Bàn Quẻ \(còn (\d+)\)$/, '🀄 Reshuffle the Board ($1 left)'],
  [/^Đã chọn (\d+)\/3 quẻ$/, 'Picked $1/3 fortunes'],
  [/^☯ Quẻ Tiên Thiên: (.+)$/, (m, a) => `☯ Innate Fortunes: ${a.split(' · ').map(tr).join(' · ')}`],
  [/^☯ Trời ban Quẻ Tiên Thiên cho người cũ — xem ở panel Nhân Vật!$/, '☯ Heaven grants returning heroes Innate Fortunes — see the Character panel!'],
];

/* ---- core translate ---- */
function tr(s) {
  if (lang !== 'en' || !s || typeof s !== 'string') return s;
  if (Object.prototype.hasOwnProperty.call(EXACT, s)) return EXACT[s];
  const t2 = s.trim();
  if (t2 !== s && Object.prototype.hasOwnProperty.call(EXACT, t2)) return s.replace(t2, EXACT[t2]);
  // Text node trải nhiều đoạn (template literal HTML — đoạn văn cách nhau bằng dòng trống): dịch từng đoạn
  if (/\n\s*\n/.test(s)) {
    const joined = s.split(/(\n\s*\n)/).map(p => (/^\n/.test(p) ? p : tr(p))).join('');
    if (joined !== s) return joined;
  }
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
