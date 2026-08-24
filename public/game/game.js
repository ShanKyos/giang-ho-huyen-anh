'use strict';
/* =========================================================
   GIANG HỒ HUYỄN ẢNH — HUYỄN ẢNH CHÍ TÔN (PvE Webgame v1)
   Core loop: farm → mission → level 1→10 → gear (10 slots ×
   6 attributes) → Rèn Luyện → Ám Khí / Trấn Phái / Điểm Huyệt
   ========================================================= */

// ---------- Canvas ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// Minimap
const miniCvs = document.getElementById('minimap');
const miniCtx = miniCvs ? miniCvs.getContext('2d') : null;
let W = 0, H = 0;
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// ---------- Balance data ----------
const MAX_LV = 120; // max cấp theo cấp boss endgame (GDD: 120)
const XP_TABLE = [200,450,800,1300,1900,2600,3400,4300,5400]; // xp to next level (index = lv-1)
for (let l = 10; l < 120; l++) XP_TABLE.push(Math.round(5400 * Math.pow(1.08, l - 9))); // GDD 120 cấp: dốc 1.08 cho hành trình dài
const MAP = { w: 2600, h: 1900 };

const ELEMENTS = ['Kim','Mộc','Thủy','Hỏa','Thổ'];

const RARITIES = [
  { name:'Phàm',    color:'#b9b9b9', cls:'r0', mult:1.0, w:52 },
  { name:'Tinh',    color:'#5fc96e', cls:'r1', mult:1.3, w:27 },
  { name:'Linh',    color:'#5ea0e8', cls:'r2', mult:1.65,w:14 },
  { name:'Thần',    color:'#c07fe0', cls:'r3', mult:2.1, w:6  },
  { name:'Chí Tôn', color:'#f39c3d', cls:'r4', mult:2.7, w:1  },
];

// ── Drop v2.0 (GDD Trang Bị v2.0): Thập Giai Binh Khí + drop theo nguồn ──
// Giai = thời đại của món đồ (theo map), Phẩm = chất lượng rèn (Phàm→Chí Tôn)
const GIAI_NAMES = ['Nhập Môn','Hành Hiệp','Giang Hồ','Danh Môn','Tông Sư','Tuyệt Thế','Khai Sơn','Chấn Phái','Tiêu Dao','Thiên Nhân'];
function giaiName(t){ return GIAI_NAMES[clamp((t||1)-1, 0, 9)]; }
// Quái thường chỉ rơi fodder Phàm + vật liệu; đồ dùng được (Tinh+) chỉ từ tinh anh/boss
const DROP_SRC = {
  mob:    { chance:0.06, rar:[80,19,1,0,0],  perfect:0    },
  elite:  { chance:0.35, rar:[0,70,28,2,0],  perfect:0.02 },
  thuve:  { chance:1,    rar:[0,28,52,18,2], perfect:0.08, drops:2 },
  tranai: { chance:1,    rar:[0,0,38,52,10], perfect:0.15, drops:3 },
};
function rollRaritySrc(srcK){
  const w = DROP_SRC[srcK].rar; let tot = 0; for (const x of w) tot += x;
  let roll = Math.random()*tot;
  for (let i = 0; i < w.length; i++){ roll -= w[i]; if (roll <= 0) return i; }
  return 0;
}
const RARITY_SUBS = [0,1,2,3,4]; // số dòng phụ mở theo phẩm Phàm..Chí Tôn
// Roll lại tên + chỉ số gốc + dòng phụ khi phẩm đổi (Tấn Phẩm / pity đai)
function rerollItemRarity(it){
  it.name = (it.perfect ? 'Hoàn Hảo ' : '') + ITEM_NAMES[it.slot][it.rarity];
  const slot = SLOTS.find(s => s.id === it.slot);
  if (slot && it.main) it.main.v = slot.base(it.tier, it.rarity);
  const pool = (ARMOR_SLOTS.includes(it.slot) ? ARMOR_SUBS : WEAPON_SUBS).slice();
  const nn = Math.min(pool.length, it.perfect ? 4 : RARITY_SUBS[it.rarity]);
  it.subs = [];
  for (let i = 0; i < nn; i++){
    const idx = Math.floor(Math.random()*pool.length);
    const def = pool.splice(idx,1)[0];
    const v = (it.perfect || def.fixed) ? def.max : Math.round((def.min + Math.random()*(def.max-def.min))*10)/10;
    it.subs.push({ k:def.k, name:def.name, v, pct:true });
  }
}
const ATTR_INFO = {
  str:{ name:'Lực Lượng', desc:'Công kích, sát thương ám khí' },
  agi:{ name:'Mẫn Tiệp',  desc:'Tốc đánh, bạo kích, né tránh' },
  def:{ name:'Phòng Ngự', desc:'Giảm sát thương nhận vào' },
  vit:{ name:'Sinh Lực',  desc:'HP tối đa, hồi phục' },
};
// Phụ phẩm theo GDD: Trang bị giáp & Nhẫn (thường/hoàn hảo)
const ARMOR_SUBS = [
  { k:'dmgred',    name:'Giảm Sát Thương',  min:1,  max:5  },
  { k:'hpPct',     name:'Sinh Lực Tối Đa',  min:1,  max:5  },
  { k:'qiPct',     name:'Nội Lực Tối Đa',   min:1,  max:4  },
  { k:'evaPct',    name:'Tránh Đòn',        min:5,  max:10 },
  { k:'silverPct', name:'Đồng Rơi Thêm',    min:10, max:30 },
  { k:'reflectPct',name:'Phản Sát Thương',  min:1,  max:5  },
];
// Phụ phẩm theo GDD: Dây Chuyền & Vũ Khí
const WEAPON_SUBS = [
  { k:'perfect',   name:'ST Hoàn Hảo',      min:10, max:10, fixed:true },
  { k:'atkPct',    name:'Thêm Sát Thương',  min:2,  max:5  },
  { k:'qiLeech',   name:'Hút Nội Lực',      min:1,  max:3  },
  { k:'hpLeech',   name:'Hút Sinh Lực',     min:1,  max:3  },
  { k:'aspdPct',   name:'Tốc Độ Đánh',      min:2,  max:5  },
];
const AWAKENED = [
  { k:'crit', v:5,  name:'Bạo Kích +5%' },
  { k:'eva',  v:5,  name:'Né Tránh +5%' },
  { k:'atk',  v:25, name:'Công Kích +25' },
  { k:'hp',   v:200,name:'Sinh Lực +200' },
  { k:'qireg',v:3,  name:'Hồi Chân Khí +3' },
  { k:'str',  v:8,  name:'Lực Lượng +8' },
];

// 12 ô trang bị theo GDD (base tính theo CẤP trang bị t=1..10, mỗi 10 level = 1 cấp)
const SLOTS = [
  { id:'vukhi',     name:'Vũ Khí',     main:'atk', base:(t,r)=>Math.round((10+t*20)*RARITIES[r].mult) },
  { id:'non',       name:'Nón',        main:'def', base:(t,r)=>Math.round((5+t*10)*RARITIES[r].mult) },
  { id:'ao',        name:'Áo',         main:'def', base:(t,r)=>Math.round((7+t*13)*RARITIES[r].mult) },
  { id:'tay',       name:'Tay',        main:'def', base:(t,r)=>Math.round((5+t*10)*RARITIES[r].mult) },
  { id:'quan',      name:'Quần',       main:'def', base:(t,r)=>Math.round((6+t*11)*RARITIES[r].mult) },
  { id:'chan',      name:'Chân',       main:'agi', base:(t,r)=>Math.round((4+t*7)*RARITIES[r].mult) },
  { id:'daychuyen', name:'Dây Chuyền', main:'atk', base:(t,r)=>Math.round((6+t*12)*RARITIES[r].mult) },
  { id:'nhan1',     name:'Nhẫn 1',     main:'crit',base:(t,r)=>+(1.5+r*1+t*0.5).toFixed(1) },
  { id:'nhan2',     name:'Nhẫn 2',     main:'eva', base:(t,r)=>+(1.5+r*1+t*0.5).toFixed(1) },
  { id:'aochoang',  name:'Áo Choàng',  special:true }, // 2 cấp, chỉ từ Luyện Bảo Các
  { id:'pet',       name:'Pet',        special:true }, // rơi từ tinh anh/boss
  { id:'canh',      name:'Cánh',       special:true }, // Thiên Thần / Tiểu Quỷ — ngoài 10 cấp
];
const ARMOR_SLOTS = ['non','ao','tay','quan','chan','nhan1','nhan2']; // có thể Hoàn Hảo
const ITEM_NAMES = {
  vukhi:['Mộc Kiếm','Thanh Phong Kiếm','Liệt Dương Đao','Huyền Thiết Trọng Kiếm','Du Long Thần Kiếm'],
  non:['Bố Mạo','Thiết Diện','Ngân Quan','Hổ Đầu Khôi','Thiên Tôn Miện'],
  ao:['Bố Y','Tinh Giáp','Lân Giáp','Kim Lân Giáp','Chí Tôn Long Giáp'],
  tay:['Bố Uyển','Thiết Uyển','Ngân Uyển','Kim Uyển','Long Uyển'],
  quan:['Ma Khố','Cẩm Khố','Ngọc Khố','Lân Khố','Thần Khố'],
  chan:['Thảo Hài','Vân Hài','Truy Phong Hài','Lăng Ba Hài','Phi Thiên Hài'],
  daychuyen:['Mộc Liên','Ngân Liên','Ngọc Liên','Lân Liên','Thánh Liên'],
  nhan1:['Đồng Giới','Ngân Giới','Ngọc Giới','Linh Giới','Chí Tôn Giới'],
  nhan2:['Phổ Giới','Mỹ Giới','Huyền Giới','Thần Giới','Tứ Linh Giới'],
};
// Áo Choàng — 2 cấp, chỉ luyện chế tại Luyện Bảo Các (Rèn)
const CLOAK_TIERS = [ null,
  { name:'Huyền Vũ Phi Phong', color:'#5ea0e8', req:1,  atkPct:5,  pierce:3, defPct:0, cost:{ tuLa:5,  hon:2, silver:2000 } },
  { name:'Thánh Vũ Phi Phong', color:'#f0d68a', req:60, atkPct:10, pierce:6, defPct:5, cost:{ tuLa:10, hon:5, silver:6000 } },
];
// Pet — rơi từ tinh anh (12%) / boss (40%)
const PET_DEFS = [
  { id:'holy',   name:'Linh Hồ Ly',     color:'#e8a0c0', expPct:10, silverPct:5,                desc:'+10% EXP · +5% đồng rơi' },
  { id:'hulan',  name:'Huyền Băng Lang', color:'#7ab0d8', expPct:15, silverPct:10, hpLeech:2,   desc:'+15% EXP · +10% đồng · hút 2% sinh lực' },
  { id:'hothan', name:'Kim Thân Hổ',    color:'#f0d68a', expPct:20, silverPct:15, hpLeech:3, atkPct:3, desc:'+20% EXP · +15% đồng · hút 3% sinh lực · +3% ST' },
];
// Cánh — boss 12%, ngoài hệ 10 cấp trang bị
const WING_DEFS = [
  { id:'thienthan', name:'Cánh Thiên Thần', color:'#dfe8ff', hpPct:12, evaPct:6, silverPct:20, desc:'+12% HP · +6% né · +20% đồng rơi' },
  { id:'tieuquy',   name:'Cánh Tiểu Quỷ',   color:'#b08ae8', atkPct:12, crit:5,  aspdPct:6,    desc:'+12% ST · +5% bạo · +6% tốc đánh' },
];
// Linh Dực Cấp 2 — luyện tại Hỗn Độn Lò (LV80+), thăng từ cánh cấp 1
const WING2_DEFS = [
  { id:'phuongduc', name:'Phượng Hoàng Linh Dực', color:'#ff8a3a', atkPct:20, hpPct:15, crit:8, aspdPct:10, desc:'+20% ST · +15% HP · +8% bạo · +10% tốc đánh' },
  { id:'hacma',     name:'Hắc Ma Linh Dực',       color:'#c07fe0', atkPct:24, pierce:8, hpLeech:5, crit:10, desc:'+24% ST · +8% xuyên giáp · +5% hút sinh lực · +10% bạo' },
];

// Ngũ hành tương khắc: Kim > Mộc > Thổ > Thủy > Hỏa > Kim (khắc chế +20% sát thương)
const NGU_HANH = {
  Kim:  { color:'#e8c84a', beats:'Mộc',  glyph:'金' },
  'Mộc':{ color:'#5db86a', beats:'Thổ',  glyph:'木' },
  'Thổ':{ color:'#c08a4a', beats:'Thủy', glyph:'土' },
  'Thủy':{ color:'#5aa0e8', beats:'Hỏa', glyph:'水' },
  'Hỏa':{ color:'#e8552a', beats:'Kim',  glyph:'火' },
};
// Tương sinh: Kim→Thủy→Mộc→Hỏa→Thổ→Kim (dùng cho hướng dẫn / mở rộng)
const TUONG_SINH = { Kim:'Thủy', 'Thủy':'Mộc', 'Mộc':'Hỏa', 'Hỏa':'Thổ', 'Thổ':'Kim' };
const SECTS = {
  thieulam: { name:'Thiếu Lâm', role:'Tank / Khống chế', element:'Kim', color:'#c9a227', glow:'#ffe9a0', bonus:{vit:3,def:2,str:1,agi:0},
    glyph:'拳', desc:'Thân pháp cứng cỏi như kim cang, chưởng lực trấn áp quần hùng.',
    skillA:{ name:'Kim Cương Chưởng', type:'cone',  cd:5, qi:20, mult:1.6 },
    tp:{ name:'Đại Lực Kim Cương Chưởng', mult:3.0 } },
  toanchan: { name:'Toàn Chân', role:'Kiếm khí / Hỗ trợ', element:'Thủy', color:'#3a9d8b', glow:'#a0ffe9', bonus:{vit:0,def:0,str:2,agi:2},
    glyph:'劍', desc:'Kiếm khí chính tông, xuyên vân phá vụ, công thủ toàn diện.',
    skillA:{ name:'Kiếm Khí Xuyên Vân', type:'proj', cd:5, qi:20, mult:1.5 },
    tp:{ name:'Thất Tinh Hội Kiếm', mult:2.8 } },
  comoc: { name:'Cổ Mộ', role:'Đột kích / Linh hoạt', element:'Mộc', color:'#9a86d8', glow:'#d8c8ff', bonus:{vit:0,def:0,str:1,agi:3},
    glyph:'影', desc:'Ngọc nữ song hoàn, xuất quỷ nhập thần, săn mồi trong bóng tối.',
    skillA:{ name:'Song Hoàn Trảm', type:'dash', cd:5, qi:18, mult:1.8 },
    tp:{ name:'Ngọc Nữ Tố Tâm Kiếm', mult:3.0 } },
  baidasan: { name:'Bạch Đà Sơn', role:'Độc công / Tầm xa', element:'Thủy', color:'#7ec850', glow:'#c8ffa0', bonus:{vit:1,def:0,str:3,agi:1},
    glyph:'蛇', desc:'Âu Dương độc công, xà trượng xuất hồn, thiên hạ đệ nhất độc.',
    skillA:{ name:'Linh Xà Độc Tiêu', type:'proj', cd:5, qi:20, mult:1.5 },
    tp:{ name:'Hà Mô Công', mult:3.2 } },
  minhgiao: { name:'Minh Giáo', role:'Bộc phát / Hỏa diệm', element:'Hỏa', color:'#e8552a', glow:'#ffb060', bonus:{vit:2,def:0,str:3,agi:0},
    glyph:'焰', desc:'Thánh hỏa phần nguyên, càn khôn đại na di, uy áp bát phương.',
    skillA:{ name:'Thánh Hỏa Liên Nguyên', type:'cone', cd:5, qi:22, mult:1.6 },
    tp:{ name:'Càn Khôn Đại Na Di', mult:3.2 } },
  doanthi: { name:'Đoàn Thị', role:'Chỉ lực / Chuẩn xác', element:'Thổ', color:'#e8b04a', glow:'#ffe0a0', bonus:{vit:1,def:1,str:2,agi:2},
    glyph:'指', desc:'Nhất dương chỉ phá vạn pháp, lục mạch thần kiếm xuất kỳ bất ý.',
    skillA:{ name:'Nhất Dương Chỉ', type:'proj', cd:4, qi:18, mult:1.4 },
    tp:{ name:'Lục Mạch Thần Kiếm', mult:3.0 } },
  daohoa: { name:'Đào Hoa', role:'Bộc phát / Tầm xa', element:'Mộc', color:'#e0779a', glow:'#ffc0d8', bonus:{vit:0,def:0,str:3,agi:1},
    glyph:'花', desc:'Lạc anh phân phân, kiếm vũ đầy trời, hủy diệt từ phía sau trận tuyến.',
    skillA:{ name:'Lạc Anh Kiếm Vũ', type:'selfaoe', cd:6, qi:24, mult:1.4 },
    tp:{ name:'Bích Hải Triều Sinh Khúc', mult:3.2 } },
  // Tán Nhân — phái khởi đầu cấp 1-10, chưa bái sư. Không hệ ngũ hành (không khắc cũng không bị khắc).
  vophai: { name:'Tán Nhân', role:'Lang bạt / Tự do', element:null, color:'#b8a888', glow:'#e8dcc0', bonus:{vit:1,def:1,str:1,agi:1},
    glyph:'侠', desc:'Không môn không phái — một thân một kiếm lang bạt thiên hạ. Tới cấp 10 hãy bái sư nhập phái!',
    skillA:{ name:'Du Hiệp Quyền', type:'cone', cd:5, qi:18, mult:1.4 },
    tp:{ name:'Tứ Hải Giai Phục', mult:2.5 } },
};
const AMKHI = { name:'Ám Khí', cd:6, qi:15, mult:1.2 };
const TP_CD = 20, TP_QI = 50, TP_RADIUS = 185;

const MOBS = {
  boar:    { name:'Dã Trư',    lv:1, hp:55,  atk:7,  def:0, xp:28,  silver:[4,9],   speed:52, aggro:130, range:30, atkCd:1.4, size:15, color:'#6b5b4a', eye:'#e8d9b0', drop:0.14, el:'Thổ', img:'assets/mobs/boar.png' },
  wolf:    { name:'Tàn Lang',  lv:3, hp:110, atk:13, def:2, xp:55,  silver:[8,15],  speed:86, aggro:170, range:30, atkCd:1.2, size:15, color:'#5a5f6b', eye:'#ffd76a', drop:0.17, el:'Mộc', img:'assets/mobs/wolf.png' },
  bandit:  { name:'Sơn Tặc',   lv:5, hp:210, atk:20, def:6, xp:105, silver:[14,24], speed:66, aggro:190, range:32, atkCd:1.3, size:16, color:'#4a3a30', eye:'#ff6a5a', sash:'#a03028', drop:0.20, el:'Kim', img:'assets/mobs/bandit.png' },
  assassin:{ name:'Hắc Phong Sát', lv:8, hp:520, atk:30, def:10, xp:320, silver:[40,70], speed:96, aggro:230, range:34, atkCd:1.1, size:17, color:'#1d1a24', eye:'#c07fe0', elite:true, drop:0.55, el:'Thủy', img:'assets/mobs/assassin.png' },
  boss:    { name:'Hắc Phong Sát Thủ', lv:10, hp:2600, atk:44, def:16, xp:2500, silver:[300,420], speed:78, aggro:480, range:38, atkCd:1.2, size:26, color:'#120f18', eye:'#ff3a3a', boss:true, elite:true, drop:1, el:'Hỏa', img:'assets/mobs/boss.png' },
};
// Quái theo tuyến bản đồ GDD (cấp 1 → 100+)
Object.assign(MOBS, {
  hautu:    { name:'Hầu Tử', lv:2, hp:70, atk:8, def:1, xp:36, silver:[5,10], speed:95, aggro:150, range:26, atkCd:1.1, size:13, color:'#7a6248', eye:'#ffe9a0', drop:0.14, el:'Mộc', img:'assets/mobs/hautu.png' },
  caodo:    { name:'Cáo Đỏ', lv:6, hp:150, atk:16, def:3, xp:75, silver:[9,16], speed:100, aggro:180, range:26, atkCd:1.1, size:13, color:'#b05030', eye:'#ffd76a', drop:0.18, el:'Hỏa', img:'assets/mobs/caodo.png' },
  trannhan: { name:'Đào Hoa Trận Nhân', lv:9, hp:300, atk:22, def:8, xp:150, silver:[16,26], speed:55, aggro:160, range:34, atkCd:1.5, size:17, color:'#c88aa8', eye:'#ffffff', drop:0.22, el:'Mộc', img:'assets/mobs/trannhan.png'},
  phando:   { name:'Toàn Chân Phản Đồ', lv:22, hp:800, atk:45, def:14, xp:520, silver:[40,60], speed:80, aggro:200, range:34, atkCd:1.2, size:16, color:'#3a9d8b', eye:'#a0ffe9', sash:'#2a6a5c', drop:0.25, el:'Thủy', img:'assets/mobs/phando.png'},
  xanu:     { name:'Xà Nữ', lv:28, hp:1100, atk:58, def:16, xp:720, silver:[55,80], speed:88, aggro:210, range:30, atkCd:1.15, size:16, color:'#5c8a3a', eye:'#c8ffa0', drop:0.27, el:'Mộc', img:'assets/mobs/xanu.png' },
  bandao:   { name:'Kiếm Khách Bán Đảo', lv:35, hp:1600, atk:75, def:22, xp:1050, silver:[80,120], speed:92, aggro:230, range:36, atkCd:1.1, size:17, color:'#2d3a55', eye:'#9fd0ff', elite:true, drop:0.4, el:'Kim', img:'assets/mobs/bandao.png'},
  thinu:    { name:'Cổ Mộ Thị Nữ', lv:45, hp:2400, atk:95, def:28, xp:1600, silver:[110,150], speed:78, aggro:200, range:34, atkCd:1.2, size:15, color:'#d8d0e8', eye:'#9a86d8', drop:0.28, el:'Mộc', img:'assets/mobs/thinu.png'},
  mocnhan:  { name:'Cơ Quan Mộc Nhân', lv:50, hp:3600, atk:105, def:45, xp:2000, silver:[130,180], speed:50, aggro:170, range:36, atkCd:1.5, size:19, color:'#8a6a42', eye:'#e8b04a', drop:0.3, el:'Thổ', img:'assets/mobs/mocnhan.png'},
  huyetbat: { name:'Huyết Biên Bức', lv:55, hp:2800, atk:120, def:26, xp:2400, silver:[150,210], speed:115, aggro:240, range:28, atkCd:0.95, size:14, color:'#6a1a24', eye:'#ff3a3a', drop:0.32, el:'Hỏa', img:'assets/mobs/huyetbat.png' },
  ttdetu:   { name:'Tuyệt Tình Đệ Tử', lv:65, hp:4600, atk:150, def:38, xp:3400, silver:[200,280], speed:84, aggro:210, range:34, atkCd:1.15, size:16, color:'#e0779a', eye:'#ffc0d8', sash:'#a04868', drop:0.3, el:'Thổ', img:'assets/mobs/ttdetu.png'},
  docyeu:   { name:'Tình Hoa Độc Yêu', lv:72, hp:5600, atk:170, def:42, xp:4200, silver:[240,330], speed:74, aggro:220, range:38, atkCd:1.3, size:18, color:'#4a7a2a', eye:'#7ec850', drop:0.34, el:'Mộc', poisonHit:true, img:'assets/mobs/docyeu.png'},
  satthuhy: { name:'Hắc Y Sát Thủ', lv:78, hp:6800, atk:200, def:48, xp:5200, silver:[300,400], speed:100, aggro:240, range:34, atkCd:1.0, size:16, color:'#16121e', eye:'#c07fe0', elite:true, drop:0.45, el:'Thủy', img:'assets/mobs/assassin.png' },
  thamtu:   { name:'Thám Tử Mông Cổ', lv:85, hp:8200, atk:230, def:55, xp:6800, silver:[380,500], speed:96, aggro:230, range:33, atkCd:1.05, size:15, color:'#4a4238', eye:'#ffd76a', drop:0.34, el:'Thổ', img:'assets/mobs/thamtu.png'},
  cungthu:  { name:'Cung Thủ Thảo Nguyên', lv:88, hp:7600, atk:260, def:50, xp:7400, silver:[400,540], speed:70, aggro:260, range:230, atkCd:1.6, size:15, color:'#7a5a30', eye:'#ffe9a0', drop:0.36, el:'Mộc', ranged:true, img:'assets/mobs/cungthu.png'},
  kybinh:   { name:'Hắc Ám Kỵ Binh', lv:105, hp:11000, atk:290, def:80, xp:9500, silver:[500,700], speed:90, aggro:220, range:40, atkCd:1.3, size:21, color:'#1c1c24', eye:'#ff6a5a', elite:true, drop:0.5, el:'Kim', img:'assets/mobs/kybinh.png'},
  kylan:    { name:'Liệt Hỏa Kỳ Lân', lv:115, hp:15000, atk:340, def:90, xp:14000, silver:[700,950], speed:94, aggro:240, range:42, atkCd:1.2, size:22, color:'#8a1a10', eye:'#ffd76a', elite:true, drop:0.55, el:'Hỏa', img:'assets/mobs/kylan.png' },
  cuongbinh:{ name:'Đột Quyết Cuồng Binh', lv:110, hp:13000, atk:360, def:70, xp:12500, silver:[650,880], speed:98, aggro:230, range:36, atkCd:1.0, size:17, color:'#5a2a1a', eye:'#ff9a3a', drop:0.42, el:'Thổ', img:'assets/mobs/cuongbinh.png'},
  daokhach: { name:'Tu La Đao Khách', lv:120, hp:14000, atk:380, def:75, xp:15000, silver:[750,1000], speed:102, aggro:250, range:38, atkCd:0.9, size:17, color:'#3a1010', eye:'#ff3a3a', elite:true, drop:0.6, el:'Hỏa', img:'assets/mobs/daokhach.png'},
  // Giang Hồ Du Hiệp — "người chơi" NPC trung lập để PK (3 cấp theo map)
  duhiep1:  { name:'Giang Hồ Du Hiệp', lv:30, hp:1800, atk:70, def:20, xp:900, silver:[90,140], speed:88, aggro:0, range:34, atkCd:1.2, size:16, color:'#4a5a7a', eye:'#dfe8ff', drop:0.5, el:'Kim', duHiep:true, img:'assets/mobs/duhiep.png'},
  duhiep2:  { name:'Giang Hồ Du Hiệp', lv:60, hp:5200, atk:160, def:42, xp:3600, silver:[260,360], speed:90, aggro:0, range:34, atkCd:1.15, size:16, color:'#5a4a6a', eye:'#dfe8ff', drop:0.55, el:'Thủy', duHiep:true, img:'assets/mobs/duhiep.png'},
  duhiep3:  { name:'Giang Hồ Đại Hiệp', lv:115, hp:12000, atk:300, def:75, xp:10000, silver:[600,850], speed:94, aggro:0, range:36, atkCd:1.05, size:17, color:'#6a3a3a', eye:'#ffe0a0', elite:true, drop:0.7, el:'Hỏa', duHiep:true, img:'assets/mobs/duhiep.png'},
});
const MOB_IMGS = {};

// Nền bản đồ vẽ tay (thủy mặc sơn thủy) — nạp lười, fallback màu phẳng khi chưa tải xong
const MAP_BG_SRC = {
  daohoa:'assets/maps/bg_daohoa.jpg', tuongduong:'assets/maps/bg_tuongduong.jpg',
  ngoai:'assets/maps/bg_ngoai.jpg', chungnam:'assets/maps/bg_chungnam.jpg',
  comoc:'assets/maps/bg_comoc.jpg', tuyettinh:'assets/maps/bg_tuyettinh.jpg',
  mongco:'assets/maps/bg_mongco.jpg', nhanmon:'assets/maps/bg_nhanmon.jpg',
  pb_daohoa:'assets/maps/bg_dungeon_stone.jpg', pb_ngoai:'assets/maps/bg_dungeon_stone.jpg',
  pb_chungnam:'assets/maps/bg_dungeon_stone.jpg', pb_comoc:'assets/maps/bg_dungeon_stone.jpg',
  pb_mongco:'assets/maps/bg_dungeon_stone.jpg',
  pb_tuyettinh:'assets/maps/bg_dungeon_fire.jpg', pb_nhanmon:'assets/maps/bg_dungeon_fire.jpg',
};
const MAP_BG = {};
for (const k in MAP_BG_SRC){ const im = new Image(); im.src = MAP_BG_SRC[k]; MAP_BG[k] = im; }
for (const k in MOBS){ const im = new Image(); im.src = MOBS[k].img || ''; MOB_IMGS[k] = im; }
const SLASH_IMG = new Image(); SLASH_IMG.src = 'assets/skills/slash.png';
// Bản phát hành: khóa toàn bộ playtest/cheat — ngườ​i chơi tự trải nghiệm từ đầu
const RELEASE_BUILD = window.RELEASE_BUILD === true;
// Cây cối & đá theo từng bản đồ (phong cách thủy mặc võ lâm)
const TREE_IMGS = {};
for (const k of ['daohoa','tuongduong','ngoai','chungnam','comoc','tuyettinh','mongco','nhanmon']){
  const im = new Image(); im.src = 'assets/trees/' + k + '.png'; TREE_IMGS[k] = im;
}
const ROCK_IMGS = [];
for (let i = 1; i <= 3; i++){ const im = new Image(); im.src = 'assets/trees/rock' + i + '.png'; ROCK_IMGS.push(im); }

// ---------- Bản đồ thế giới (GDD): 3 loại khu vực ----------
const ZONE_TYPES = {
  safe:   { name:'An Toàn', color:'#7ec850', desc:'Không thể PK — giao dịch, nhận nhiệm vụ, Ngồi Thiền.' },
  pk:     { name:'Dã Ngoại · PK', color:'#e8b04a', desc:'Bãi train — bật PK cướp bãi được, nhưng giết Du Hiệp bị Tội Ác (đỏ tên), chết rớt đồ.' },
  freepk: { name:'Huyết Chiến · Free PK', color:'#e84a3a', desc:'PK tự do, không Tội Ác — giết thoải mái.' },
  dungeon:{ name:'Phó Bản', color:'#b08ae8', desc:'Phó bản 3 đợt quái + Boss — farm Tiến Cấp Đan & nguyên liệu tiến cấp kỹ năng.' },
};
// packs: quái đứng thành cụm 5-7 con, đánh 1 con cả cụm lao vào (GDD Mob Mechanics)
const MAPS = {
  daohoa: { name:'Đào Hoa Đảo', min:1, range:'1 - 20', type:'safe', ground:'#ece2c8', patch:'#8a7a58',
    spawn:{ x:460, y:460 }, spawnFrom:{ pb_daohoa:{ x:2250, y:1040 } }, village:true, spring:true, herbs:true, boss:true, trees:70, rocks:26,
    desc:'Quê hương Thanh Ngưu Thôn — bãi săn tân thủ. Quái yếu, rớt đồ khởi đầu, làm quen hệ thống.',
    packs: [
      { mob:'boar', x:800, y:520, n:6 }, { mob:'boar', x:1000, y:1000, n:5 },
      { mob:'hautu', x:640, y:860, n:6 }, { mob:'caodo', x:1250, y:1300, n:6 },
      { mob:'trannhan', x:1500, y:560, n:5 },
      { mob:'wolf', x:1650, y:760, n:7 }, { mob:'wolf', x:1400, y:1450, n:6 },
      { mob:'bandit', x:800, y:1550, n:7 }, { mob:'bandit', x:2050, y:1250, n:7 },
      { mob:'assassin', x:1900, y:420, n:1 }, // P0: 1 con (trước 5 — NV8 thành bức tường, bot chết 16 lần liên tiếp)
    ], duhiep: null },
  tuongduong: { name:'Tương Dương Thành', min:1, range:'—', type:'safe', ground:'#d8ccb0', patch:'#7a6a4a',
    spawn:{ x:1300, y:1100 }, spawnFrom:{ ngoai:{ x:1300, y:1460 } }, city:true, trees:24, rocks:10,
    desc:'Thành chính trung tâm — Chợ Đấu Giá, Lò Bát Quái, Dược Phường, Trà Quán. Khu an toàn: quái không thể vào thành. Ra Cổng Nam để săn quái ngoại ô.',
    packs: [], duhiep: null },
  ngoai: { name:'Ngoại Ô Tương Dương', min:10, range:'10 - 20', type:'safe', ground:'#ddd2ae', patch:'#7a7048',
    spawn:{ x:1300, y:330 }, spawnFrom:{ pb_ngoai:{ x:2000, y:1040 } }, reqMain:10, trees:56, rocks:22,
    desc:'Vùng ngoài thành — sơn tặc lập trại chặn đường, lang sói hoành hành. Không PK, an toàn cho tân thủ rèn luyện.',
    packs: [
      { mob:'boar', x:700, y:600, n:6 }, { mob:'hautu', x:1900, y:560, n:6 },
      { mob:'wolf', x:900, y:1200, n:7 }, { mob:'caodo', x:1750, y:1150, n:6 },
      { mob:'bandit', x:1300, y:860, n:7 }, { mob:'bandit', x:600, y:1550, n:7 },
      { mob:'trannhan', x:2050, y:1500, n:5 }, { mob:'assassin', x:2000, y:820, n:1 },
    ], duhiep: null },
  chungnam: { name:'Chung Nam Sơn', min:20, range:'20 - 40', type:'pk', ground:'#d4d0ac', patch:'#6a7a52',
    spawn:{ x:400, y:1500 }, spawnFrom:{ pb_chungnam:{ x:2200, y:890 } }, trees:80, rocks:34,
    desc:'Xích mích nhỏ lẻ bắt đầu. Quái rớt bí kíp cơ bản & bạc vụn.',
    packs: [
      { mob:'phando', x:700, y:600, n:6 }, { mob:'phando', x:1500, y:1200, n:6 },
      { mob:'bandit', x:1100, y:900, n:7 }, { mob:'xanu', x:2000, y:600, n:6 },
      { mob:'xanu', x:800, y:1400, n:6 }, { mob:'bandao', x:2100, y:1400, n:5 },
    ], duhiep:'duhiep1' },
  comoc: { name:'Cổ Mộ Mật Thất', min:40, range:'40 - 60', type:'pk', ground:'#a89f86', patch:'#4a4436',
    spawn:{ x:400, y:400 }, spawnFrom:{ pb_comoc:{ x:2200, y:990 } }, dark:true, trees:30, rocks:46,
    desc:'Bản đồ hẹp, nhiều ngõ ngách. Quái đông, rớt nguyên liệu tiến cấp Tọa Kỵ. Tranh bãi khốc liệt.',
    packs: [
      { mob:'thinu', x:700, y:700, n:7 }, { mob:'thinu', x:1900, y:600, n:7 },
      { mob:'mocnhan', x:1300, y:1100, n:5 }, { mob:'mocnhan', x:600, y:1400, n:5 },
      { mob:'huyetbat', x:2000, y:1400, n:7 }, { mob:'huyetbat', x:1200, y:500, n:6 },
    ], duhiep:'duhiep2' },
  tuyettinh: { name:'Tuyệt Tình Cốc', min:60, range:'60 - 80', type:'pk', ground:'#ddc9a8', patch:'#8a5a6a',
    spawn:{ x:400, y:950 }, spawnFrom:{ pb_tuyettinh:{ x:2200, y:790 } }, trees:60, rocks:24,
    desc:'Bãi EXP khổng lồ. Cần Cương Khí chống sát thương độc của quái.',
    packs: [
      { mob:'ttdetu', x:800, y:600, n:7 }, { mob:'ttdetu', x:1800, y:1300, n:7 },
      { mob:'docyeu', x:1400, y:900, n:6 }, { mob:'docyeu', x:700, y:1500, n:6 },
      { mob:'satthuhy', x:2100, y:500, n:5 }, { mob:'satthuhy', x:1100, y:1450, n:5 },
    ], duhiep:'duhiep2' },
  mongco: { name:'Mông Cổ Đại Doanh', min:80, range:'80 - 100', type:'pk', ground:'#cfc09a', patch:'#7a6a42',
    spawn:{ x:400, y:950 }, spawnFrom:{ pb_mongco:{ x:1720, y:680 } }, trees:36, rocks:30,
    desc:'Bản đồ rộng, quái trâu & ST cao. Rớt nguyên liệu tiến cấp Cung Tiễn, Ám Khí.',
    packs: [
      { mob:'thamtu', x:700, y:600, n:7 }, { mob:'thamtu', x:1900, y:1400, n:7 },
      { mob:'cungthu', x:1400, y:1000, n:6 }, { mob:'cungthu', x:800, y:1500, n:6 },
      { mob:'kybinh', x:2100, y:600, n:5 }, { mob:'kybinh', x:1300, y:400, n:5 },
    ], duhiep:'duhiep3' },
  nhanmon: { name:'Nhạn Môn Quan', min:100, range:'100+', type:'freepk', ground:'#b8a68a', patch:'#6a3a2a',
    spawn:{ x:400, y:950 }, spawnFrom:{ pb_nhanmon:{ x:2200, y:890 } }, trees:44, rocks:38,
    desc:'Bãi train end-game. PK không Tội Ác. Quái rớt đồ Hoàng kim, ST chí mạng.',
    packs: [
      { mob:'kylan', x:900, y:700, n:5 }, { mob:'kylan', x:2250, y:1100, n:5 },
      { mob:'cuongbinh', x:1475, y:1250, n:7 }, { mob:'cuongbinh', x:700, y:1400, n:7 },
      { mob:'daokhach', x:2100, y:500, n:5 }, { mob:'daokhach', x:1450, y:1600, n:5 },
    ], duhiep:'duhiep3' },
  // ---------- PHÓ BẢN: mỗi map một phó bản + boss tương ứng cấp — chỉ vào qua cổng dịch chuyển ----------
  pb_daohoa: { name:'Phó Bản · Hắc Phong Trại', min:12, range:'12+', type:'dungeon', ground:'#8a8272', patch:'#3a342a',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:20, rocks:34,
    desc:'Phó bản của Đào Hoa Đảo — 3 đợt quái rồi Boss Hắc Phong Trại Chủ. Farm Tiến Cấp Đan & Huyền Thiết.',
    packs: [], duhiep: null },
  pb_ngoai: { name:'Phó Bản · Sơn Tặc Doanh', min:14, range:'14+', type:'dungeon', ground:'#8a8272', patch:'#3a342a',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:24, rocks:30,
    desc:'Phó bản của Ngoại Ô — Boss Sơn Tặc Đại Đầu Lĩnh trấn giữ. Farm Tiến Cấp Đan & Huyền Thiết.',
    packs: [], duhiep: null },
  pb_chungnam: { name:'Phó Bản · Phản Đồ Mật Thất', min:26, range:'26+', type:'dungeon', ground:'#7e7a68', patch:'#332e24',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:18, rocks:38,
    desc:'Phó bản của Chung Nam Sơn — Boss Phản Đồ Đại Tướng. Farm Tiến Cấp Đan, Huyền Thiết & Tu La.',
    packs: [], duhiep: null },
  pb_comoc: { name:'Phó Bản · Mộ Chủ Địa Cung', min:46, range:'46+', type:'dungeon', ground:'#6e6a58', patch:'#2a2620',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:12, rocks:44,
    desc:'Phó bản của Cổ Mộ — Boss Cổ Mộ Mộ Chủ. Farm nguyên liệu tiến cấp Tọa Kỵ & Tuyệt Học.',
    packs: [], duhiep: null },
  pb_tuyettinh: { name:'Phó Bản · Tình Hỏa Luyện Ngục', min:66, range:'66+', type:'dungeon', ground:'#7a6a62', patch:'#38222a',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:22, rocks:26,
    desc:'Phó bản của Tuyệt Tình Cốc — Boss Tình Hỏa Ma Quân (đòn độc). Farm Tu La & Hỗn Nguyên.',
    packs: [], duhiep: null },
  pb_mongco: { name:'Phó Bản · Hãn Vương Trướng', min:86, range:'86+', type:'dungeon', ground:'#7e725a', patch:'#332a1e',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:16, rocks:32,
    desc:'Phó bản của Mông Cổ Đại Doanh — Boss Đột Thông Hãn Vương. Farm nguyên liệu tiến cấp Cung Tiễn, Ám Khí.',
    packs: [], duhiep: null },
  pb_nhanmon: { name:'Phó Bản · Thiên Binh Đài', min:100, range:'100+', type:'dungeon', ground:'#8a7a66', patch:'#3a241a',
    spawn:{ x:1300, y:1560 }, dungeon:true, dark:true, trees:14, rocks:36,
    desc:'Phó bản của Nhạn Môn Quan — Boss Thiên Binh Thống Soái. Thử thách cuối cùng, thưởng cực hậu.',
    packs: [], duhiep: null },
};
let curMap = 'daohoa';
let zoneBanner = null; // { text, sub, color, t }

// ---------- Tường thành & Cổng thành — Tương Dương / Ngoại Ô ----------
// Thành là khu an toàn tuyệt đối: quái không spawn trong thành, tường chặn mọi lối đi,
// chỉ có Cổng Nam dẫn ra Ngoại Ô (có quái). Ngoại Ô có cổng ngược để quay về.
const CITY_WALL = { map:'tuongduong', x1:950, y1:760, x2:1720, y2:1560, t:24, gateX1:1236, gateX2:1364 };
const GATES = [
  { map:'tuongduong', x:1300, y:1560, to:'ngoai',      name:'Qua Cổng Nam → Ngoại Ô' },
  { map:'ngoai',      x:1300, y:240,  to:'tuongduong', name:'Qua Cổng Thành → Tương Dương' },
];
let nearGate = null;
function cityWallRects(){
  const w = CITY_WALL;
  return [
    { x:w.x1,    y:w.y1-w.t, wd:w.x2-w.x1,       ht:w.t },              // bắc
    { x:w.x1,    y:w.y2,     wd:w.gateX1-w.x1,   ht:w.t },              // nam-trái
    { x:w.gateX2,y:w.y2,     wd:w.x2-w.gateX2,   ht:w.t },              // nam-phải
    { x:w.x1-w.t,y:w.y1-w.t, wd:w.t, ht:w.y2-w.y1+w.t*2 },              // tây
    { x:w.x2,    y:w.y1-w.t, wd:w.t, ht:w.y2-w.y1+w.t*2 },              // đông
  ];
}
function collideCityWalls(){
  if (!player || curMap !== CITY_WALL.map) return;
  const r = 13;
  for (const rc of cityWallRects()){
    const cx = clamp(player.x, rc.x, rc.x+rc.wd), cy = clamp(player.y, rc.y, rc.y+rc.ht);
    const d = dist(player.x, player.y, cx, cy);
    if (d < r){
      if (d === 0){ player.y = rc.y - r; continue; }
      player.x = cx + (player.x-cx)/d*r;
      player.y = cy + (player.y-cy)/d*r;
    }
  }
}
// ═══════════ GDD Đợt 2 — A: ĐỊA HÌNH CẢN ĐƯỜNG + ẢI CẤP ═══════════
// Chỉ chặn địa hình LỚN (hồ/sông/núi/tường), đường đi để rộng; rect {x,y,wd,ht} hoặc ellipse {x,y,rx,ry}
const MAP_OBSTACLES = {
  daohoa: [
    { x:110, y:260, rx:250, ry:300 },   // hồ tây-bắc
    { x:100, y:1560, rx:240, ry:400 },  // hồ tây-nam
    { x:1950, y:620, wd:650, ht:530 },  // hồ đông (chừa hành lang lên đài Bình Cảnh)
    { x:2450, y:150, rx:230, ry:220 },  // góc đông-bắc
    { x:0, y:1660, wd:1700, ht:240 },   // hồ nam (chừa đảo Trấn Ải)
  ],
  ngoai: [
    { x:2250, y:350, rx:400, ry:310 },  // sông đông-bắc
    { x:2380, y:820, rx:330, ry:360 },  // sông đông
    { x:140, y:160, rx:360, ry:270 },   // núi tây-bắc
  ],
  chungnam: [
    { x:0, y:0, wd:1050, ht:540 },      // núi tây-bắc
    { x:2050, y:0, wd:550, ht:250 },    // núi đông-bắc
    { x:0, y:0, wd:320, ht:1000 },      // dốc tây
  ],
  comoc: [
    { x:0, y:0, wd:1150, ht:260 },      // tường bắc trái (chừa cổng giữa)
    { x:1450, y:0, wd:1150, ht:260 },   // tường bắc phải
    { x:0, y:0, wd:300, ht:1200 },      // tường tây
    { x:2350, y:0, wd:250, ht:1300 },   // tường đông
    { x:0, y:1780, wd:2600, ht:120 },   // tường nam
  ],
  tuyettinh: [
    { x:0, y:0, wd:2600, ht:280 },      // vách bắc
    { x:0, y:0, wd:160, ht:1400 },      // vách tây
    { x:2420, y:0, wd:180, ht:1900 },   // vách đông
    { x:542, y:704, rx:240, ry:195 },   // suối băng 1
    { x:948, y:1231, rx:255, ry:215 },  // suối băng 2
    { x:1422, y:1671, rx:275, ry:225 }, // suối băng 3
  ],
  mongco: [
    { x:1900, y:830, rx:150, ry:110 },  // lều 1
    { x:2130, y:950, rx:160, ry:120 },  // lều 2
    { x:2300, y:1050, rx:140, ry:100 }, // lều 3
    { x:2380, y:1250, wd:220, ht:650 }, // đá đông-nam
  ],
  nhanmon: [
    { x:850, y:800, wd:560, ht:350 },   // tường thành trái (chừa cổng giữa x1410-1540)
    { x:1540, y:800, wd:560, ht:350 },  // tường thành phải
    { x:850, y:1150, wd:400, ht:610 },  // chân thành tây
    { x:1700, y:1150, wd:400, ht:610 }, // chân thành đông
    { x:0, y:0, wd:1400, ht:380 },      // núi bắc
    { x:0, y:0, wd:260, ht:1200 },      // vách tây
  ],
  tuongduong: [
    { x:0, y:0, wd:2600, ht:340 },      // núi bắc
    { x:1850, y:1100, wd:400, ht:380 }, // cung điện đông-nam
    { x:0, y:1640, wd:1200, ht:260 },   // rừng nam trái (chừa cổng thành)
    { x:1400, y:1640, wd:1200, ht:260 },// rừng nam phải
  ],
};
const DGN_OBSTACLES = [ // 7 phó bản dùng chung: khung tường đá + cửa nam ở giữa
  { x:0, y:0, wd:2600, ht:280 },
  { x:0, y:1700, wd:1120, ht:200 },
  { x:1480, y:1700, wd:1120, ht:200 },
  { x:0, y:0, wd:330, ht:1900 },
  { x:2270, y:0, wd:330, ht:1900 },
];
function obstaclesOf(mapId){
  const md = MAPS[mapId];
  if (md && md.dungeon) return DGN_OBSTACLES;
  return MAP_OBSTACLES[mapId] || [];
}
function inObstacle(mapId, x, y, r){
  for (const o of obstaclesOf(mapId)){
    if (o.wd){
      const cx = clamp(x, o.x, o.x + o.wd), cy = clamp(y, o.y, o.y + o.ht);
      if ((x-cx)*(x-cx) + (y-cy)*(y-cy) < r*r) return true;
    } else {
      const dx = (x - o.x)/(o.rx + r), dy = (y - o.y)/(o.ry + r);
      if (dx*dx + dy*dy < 1) return true;
    }
  }
  return false;
}
function collideObstacles(ent, r){
  for (const o of obstaclesOf(curMap)){
    if (o.wd){
      const cx = clamp(ent.x, o.x, o.x + o.wd), cy = clamp(ent.y, o.y, o.y + o.ht);
      const dx = ent.x - cx, dy = ent.y - cy, d2 = dx*dx + dy*dy;
      if (d2 < r*r){
        if (d2 > 0.01){ const d = Math.sqrt(d2); ent.x = cx + dx/d*r; ent.y = cy + dy/d*r; }
        else { // tâm lọt hẳn trong rect — đẩy ra cạnh gần nhất
          const l = ent.x - o.x, rr = o.x + o.wd - ent.x, t = ent.y - o.y, bb = o.y + o.ht - ent.y;
          const m = Math.min(l, rr, t, bb);
          if (m === l) ent.x = o.x - r; else if (m === rr) ent.x = o.x + o.wd + r;
          else if (m === t) ent.y = o.y - r; else ent.y = o.y + o.ht + r;
        }
      }
    } else {
      const dx = ent.x - o.x, dy = ent.y - o.y, ax = o.rx + r, ay = o.ry + r;
      const n = (dx*dx)/(ax*ax) + (dy*dy)/(ay*ay);
      if (n < 1){
        if (n > 0.0001){ const s = 1/Math.sqrt(n); ent.x = o.x + dx*s; ent.y = o.y + dy*s; }
        else ent.x = o.x + ax;
      }
    }
  }
  ent.x = clamp(ent.x, 20, MAP.w - 20); ent.y = clamp(ent.y, 20, MAP.h - 20); // không đẩy quá mép map
}
function nearestFree(mapId, x, y){
  if (!inObstacle(mapId, x, y, 16)) return { x, y };
  for (let rad = 60; rad <= 900; rad += 60){
    for (let k = 0; k < 12; k++){
      const a = k/12 * Math.PI*2;
      const nx = clamp(x + Math.cos(a)*rad, 30, MAP.w - 30), ny = clamp(y + Math.sin(a)*rad, 30, MAP.h - 30);
      if (!inObstacle(mapId, nx, ny, 16)) return { x:nx, y:ny };
    }
  }
  const sp = MAPS[mapId] && MAPS[mapId].spawn;
  return sp ? { x:sp.x, y:sp.y } : { x:MAP.w/2, y:MAP.h/2 };
}
// Ải cấp: vòng trấn áp chặn tân thủ vào khu quái mạnh — đủ cấp mới qua
const AI_PASSES = [
  { map:'ngoai',     x:1650, y:1450, r:95,  reqLv:14,  name:'Sào Huyệt Giang Phi' },
  { map:'chungnam',  x:1620, y:640,  r:100, reqLv:26,  name:'Cổng Lăng Cổ Tích' },
  { map:'comoc',     x:2100, y:400,  r:90,  reqLv:50,  name:'Cửa Mộ Sâu' },
  { map:'tuyettinh', x:1750, y:1100, r:100, reqLv:68,  name:'Cổng Cốc Sâu' },
  { map:'mongco',    x:1800, y:520,  r:100, reqLv:88,  name:'Vòng Vây Kỵ Binh' },
  { map:'nhanmon',   x:1475, y:1000, r:110, reqLv:104, name:'Cổng Thành Nhạn Môn' },
];
function collideAiPass(){
  for (const a of AI_PASSES){
    if (a.map !== curMap || player.level >= a.reqLv) continue;
    const d = dist(player.x, player.y, a.x, a.y);
    if (d < a.r){
      const ang = Math.atan2(player.y - a.y, player.x - a.x);
      player.x = a.x + Math.cos(ang)*a.r; player.y = a.y + Math.sin(ang)*a.r;
      if (!player._aiPassT || performance.now() - player._aiPassT > 4000){
        player._aiPassT = performance.now();
        addFloat(player.x, player.y - 50, `⛔ ${a.name} — cần cấp ${a.reqLv} mới qua được!`, '#f0a03a', 14);
        AudioSys.sfx('ui', 0.4);
      }
    }
  }
}
function drawAiPasses(){
  if (!player) return;
  for (const a of AI_PASSES){
    if (a.map !== curMap || player.level >= a.reqLv) continue;
    const t = performance.now()/600;
    ctx.save();
    ctx.strokeStyle = 'rgba(240,100,60,.55)'; ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t*12;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(240,140,80,.95)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`⛔ ${a.name} · cấp ${a.reqLv}`, a.x, a.y - a.r - 8);
    ctx.restore();
  }
}

function updateGate(){
  nearGate = null;
  if (!player || dead) return;
  for (const g of GATES){
    if (g.map !== curMap) continue;
    if (dist(player.x, player.y, g.x, g.y) < 90){ nearGate = g; break; }
  }
}
function drawCityWalls(){
  for (const rc of cityWallRects()){
    ctx.fillStyle = '#8a7a5e'; ctx.fillRect(rc.x, rc.y, rc.wd, rc.ht);
    ctx.fillStyle = '#6e6046'; ctx.fillRect(rc.x, rc.y + rc.ht - 6, rc.wd, 6);
    ctx.strokeStyle = 'rgba(60,48,30,.5)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(rc.x+.5, rc.y+.5, rc.wd-1, rc.ht-1);
    ctx.strokeStyle = 'rgba(60,48,30,.28)'; ctx.lineWidth = 1;
    for (let bx = rc.x + 22; bx < rc.x + rc.wd; bx += 44){
      ctx.beginPath(); ctx.moveTo(bx, rc.y+2); ctx.lineTo(bx, rc.y + rc.ht - 2); ctx.stroke();
    }
  }
}
function drawPortal(g){
  const t = performance.now()/1000;
  // đài phát sáng dưới chân
  ctx.fillStyle = 'rgba(120,80,180,.30)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y + 6, 46, 13, 0, 0, 7); ctx.fill();
  // vòng xoáy tím ma mị
  ctx.fillStyle = 'rgba(50,26,80,.5)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y - 34, 24, 38, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 3; i++){
    ctx.strokeStyle = `rgba(176,138,232,${0.8 - i*0.22})`; ctx.lineWidth = 3 - i*0.6;
    ctx.beginPath();
    ctx.ellipse(g.x, g.y - 34, 26 + i*9 + Math.sin(t*2 + i)*3, 40 + i*12 + Math.cos(t*1.6 + i)*4, t*0.7 + i, 0, 7);
    ctx.stroke();
  }
  drawCalligraphy(g.label || 'Phó Bản', g.x, g.y - 96, '#b08ae8', 15);
  if (nearGate === g){
    ctx.strokeStyle = 'rgba(216,186,255,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(g.x, g.y, 58 + Math.sin(t*3)*6, 20, 0, 0, 7); ctx.stroke();
    ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 3; ctx.fillStyle = '#d8baff';
    const txt = 'G — ' + g.name;
    ctx.strokeText(txt, g.x, g.y - 114); ctx.fillText(txt, g.x, g.y - 114);
  }
}
function drawGates(){
  for (const g of GATES){
    if (g.map !== curMap) continue;
    if (g.portal){ drawPortal(g); continue; }
    // hai cột trụ + xà ngang
    ctx.fillStyle = '#4a3826';
    ctx.fillRect(g.x - 73, g.y - 96, 18, 96);
    ctx.fillRect(g.x + 55, g.y - 96, 18, 96);
    ctx.fillStyle = '#5a4630'; ctx.fillRect(g.x - 86, g.y - 106, 172, 16);
    ctx.fillStyle = '#2e2418'; ctx.fillRect(g.x - 78, g.y - 90, 156, 8);
    // đèn lồng hai bên
    for (const s of [-1, 1]){
      ctx.strokeStyle = '#3a2c1e'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.x + s*64, g.y - 90); ctx.lineTo(g.x + s*64, g.y - 78); ctx.stroke();
      ctx.fillStyle = '#d84a2a'; ctx.beginPath(); ctx.ellipse(g.x + s*64, g.y - 70, 6, 8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(240,214,138,.85)'; ctx.beginPath(); ctx.ellipse(g.x + s*64, g.y - 70, 2.5, 3.5, 0, 0, 7); ctx.fill();
    }
    drawCalligraphy('Cổng Thành', g.x, g.y - 118, '#6a4a2a', 15);
    if (nearGate === g){
      ctx.strokeStyle = 'rgba(240,214,138,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, 58 + Math.sin(performance.now()/300)*6, 20, 0, 0, 7); ctx.stroke();
      ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 3; ctx.fillStyle = '#f0d68a';
      const txt = 'G — ' + g.name;
      ctx.strokeText(txt, g.x, g.y - 136); ctx.fillText(txt, g.x, g.y - 136);
    }
  }
}
const NPCS = [
  { id:'truonglang', name:'Trưởng Làng', map:'daohoa', x:400, y:400, img:'assets/npcs/truonglang.png', talk:'quest' },
  { id:'thuongnhan', name:'Thương Nhân · Chợ Đấu Giá', map:'tuongduong', x:1150, y:1000, img:'assets/npcs/thuongnhan.png', talk:'shop' },
  { id:'thoren', name:'Thợ Rèn · Lò Bát Quái', map:'tuongduong', x:1480, y:1180, img:'assets/npcs/thoren.png', talk:'forge' },
];
const NPC_IMGS = {};
for (const n of NPCS){ const im = new Image(); im.src = n.img; NPC_IMGS[n.id] = im; }
function mapDef(){ return MAPS[curMap]; }
function zoneType(){ return ZONE_TYPES[mapDef().type]; }

// ---------- Sổ tay kỹ năng: mọi chiêu thức gán vào taskbar 5 ô ----------
const SKILL_DEFS = {
  a:       { unlock:2,  kind:'sectA',  icon:s=>SECT_ART[s].iconA,  desc:s=>`${s.skillA.name} — chiêu thức nhập môn ${s.name}.` },
  amkhi:   { unlock:4,  kind:'amkhi',  name:'Ám Khí', cd:6, qi:15, mult:1.2, icon:()=>'assets/skills/amkhi.png', desc:()=>'Phóng ám khí độc — theo tầng Tuyệt Học Ám Khí.' },
  tp:      { unlock:7,  kind:'sectTP', icon:s=>SECT_ART[s].iconTP, desc:s=>`${s.tp.name} — Trấn Phái tuyệt kỹ ${s.name}, sát thương lan.` },
  gangkhi: { unlock:10, kind:'gangkhi', name:'Cương Khí Hộ Thể', cd:20, qi:30, icon:()=>'assets/skills/gangkhi.png',
             req:()=>player.gangkhi.tier>0, reqTxt:'Cương Khí tầng 1 (Tuyệt Học)', desc:()=>'6s giảm 30% sát thương gánh chịu — tụ cương khí hộ thể.' },
  danchi:  { unlock:20, kind:'danchi', name:'Đạn Chỉ Thần Thông', cd:12, qi:35, mult:2.0, icon:()=>'assets/skills/danchi.png',
             req:()=>player.dantian.realm>=4, reqTxt:'Đan Điền cảnh 4 (Luyện Khí Tầng 4)', desc:()=>'Chỉ lực xuyên huyệt — sát thương ×2 và phong mạch địch 2.5s.' },
  bow:     { unlock:30, kind:'bow',    name:'Linh Tiễn Xạ', cd:9, qi:28, mult:1.3, icon:()=>'assets/skills/bow.png',
             req:()=>player.bow.tier>0, reqTxt:'Cung Tiễn tầng 1 (Tuyệt Học)', desc:()=>'Bắn 3 linh tiễn xuyên thấu quạt trước mặt.' },
  tieuhon: { unlock:20, kind:'tieuhon', name:'Ám Nhiên Tiêu Hồn Chưởng', cd:26, qi:60, mult:3.2, icon:()=>'assets/skills/tieuhon.png',
             req:()=>player.dantian.realm>=6, reqTxt:'Đan Điền cảnh 6 (Kim Đan Cảnh)', desc:()=>'Chưởng lực âm nhu quét sạch quanh người (AoE lớn).' },
};
const PASSIVE_SKILLS = [
  { name:'Cung Tiễn (bị động)', req:()=>player.bow.tier>0, desc:'Đòn đánh thường có tỉ lệ bắn linh tiễn — theo tầng Cung Tiễn.' },
  { name:'Lăng Ba Vi Bộ (J)', req:()=>player.canJump, desc:'Nhảy 2 lần trên không, lướt né mọi đòn — Đan Điền cảnh 7.' },
  { name:'Đạn Chỉ phong mạch (bị động)', req:()=>player.stunProc>0, desc:'5% đòn đánh phong mạch địch — Đan Điền cảnh 4.' },
  { name:'Thái Cực phản đòn (bị động)', req:()=>player.reflect>0, desc:'Phản lại một phần sát thương — Đan Điền cảnh 5 / trang bị.' },
  { name:'Bất Tử (bị động)', req:()=>player.batTu, desc:'Chặn 1 đòn chí mạng, hồi 30% HP — Đan Điền cảnh 8.' },
  { name:'Huyết Ma Thôn Phệ', req:()=>player.bikip && player.bikip.hmtp, desc:'Hút 10% sát thương thành sinh lực + tuyệt chiêu chủ động Huyết Ma Phệ Hồn Chưởng (gán ở bảng K) — bí kíp giang hồ.' },
];

// ═══════════ VÕ HỌC PHỔ — võ học tự do, người chơi tự chọn tuyệt chiêu & hướng đi ═══════════
// phai: võ học môn phái — tự ngộ khi đạt cấp · phai:null = giang hồ — học bằng Bí Kíp (rơi từ tinh anh/boss)
const VH_TIER = {
  so:   { name:'Sơ Cấp',   color:'#c8c8c8', cost:1 },
  trung:{ name:'Trung Cấp',color:'#7ec850', cost:2 },
  cao:  { name:'Cao Cấp',  color:'#b08ae8', cost:3 },
  than: { name:'Thần Cấp', color:'#ffd76a', cost:5 },
};
const VOHOC_DEFS = {
  // ── Thiếu Lâm ──
  lahanquan:   { name:'La Hán Quyền', school:'Thiếu Lâm', phai:'thieulam', tier:'so', cat:'Quyền', type:'cone', unlock:5, cd:5, qi:10, mult:1.35, color:'#e8b84a', icon:'assets/skills/vh_lahanquan.png', glyph:'拳', fx:{ kb:26 }, desc:'Quyền pháp nhập môn — quạt trước mặt, hất văng nhẹ.' },
  tlnoicong:   { name:'Thiếu Lâm Nội Công', school:'Thiếu Lâm', phai:'thieulam', tier:'so', cat:'Tâm Pháp', type:'passive', unlock:5, color:'#d8c86a', icon:'assets/skills/vh_tlnoicong.png', glyph:'功', desc:'Bị động: +12% HP, +8% giảm sát thương.' },
  longtraothu: { name:'Long Trảo Thủ', school:'Thiếu Lâm', phai:'thieulam', tier:'trung', cat:'Trảo', type:'cone', unlock:20, cd:9, qi:18, mult:1.7, color:'#f0c04a', icon:'assets/skills/vh_longtraothu.png', glyph:'爪', fx:{ stun:1.5, pierce:true }, desc:'Trảo kình phá giáp — xuyên phòng thủ, khống chế 1.5s.' },
  niemhoachi:  { name:'Niêm Hoa Chỉ', school:'Thiếu Lâm', phai:'thieulam', tier:'trung', cat:'Chỉ', type:'proj', unlock:20, cd:7, qi:14, mult:1.6, color:'#ffd76a', icon:'assets/skills/vh_niemhoachi.png', glyph:'指', fx:{ stun:1.2 }, desc:'Chỉ lực tầm xa — trúng địch choáng 1.2s.' },
  dichcankinh: { name:'Dịch Cân Kinh', school:'Thiếu Lâm', phai:'thieulam', tier:'than', cat:'Tâm Pháp', type:'passive', unlock:60, color:'#ffe9a8', icon:'assets/skills/vh_dichcankinh.png', glyph:'易', desc:'Bị động: hồi 0.8% HP mỗi giây, kháng độc 50%.' },
  taytykinh:   { name:'Tẩy Tủy Kinh', school:'Thiếu Lâm', phai:'thieulam', tier:'than', cat:'Tâm Pháp', type:'passive', unlock:60, color:'#a8e8c8', icon:'assets/skills/vh_taytykinh.png', glyph:'洗', desc:'Bị động: mọi chiêu thức hồi nhanh hơn 30%.' },
  // ── Võ Đang (thất truyền — giang hồ) ──
  vodangkiem:  { name:'Võ Đang Kiếm Pháp', school:'Võ Đang', phai:null, tier:'so', cat:'Kiếm', type:'cone', unlock:8, cd:5, qi:10, mult:1.4, color:'#7ec8e8', icon:'assets/skills/vh_vodangkiem.png', glyph:'劍', fx:{}, desc:'Kiếm ý liên miên như nước chảy — quạt trước mặt.' },
  batquaichuong:{ name:'Bát Quái Chưởng', school:'Võ Đang', phai:null, tier:'so', cat:'Chưởng', type:'cone', unlock:8, cd:8, qi:12, mult:1.2, color:'#6ab8d8', icon:'assets/skills/vh_batquai.png', glyph:'卦', fx:{ selfEva:{ pct:30, t:3 } }, desc:'Chưởng theo quẻ Bát Quái — tung chiêu xong +30% né trong 3s.' },
  thanhanh:    { name:'Thần Hành Bách Biến', school:'Võ Đang', phai:null, tier:'trung', cat:'Thân Pháp', type:'dash', unlock:15, cd:10, qi:14, color:'#a0e8ff', icon:'assets/skills/vh_thanhanh.png', glyph:'行', fx:{ dist:150, eva:{ pct:50, t:3 } }, desc:'Lướt đi như thần hành — +50% né trong 3s.' },
  thaicuckiem: { name:'Thái Cực Kiếm', school:'Võ Đang', phai:null, tier:'cao', cat:'Kiếm', type:'buff', unlock:30, cd:20, qi:25, color:'#8ad8c8', icon:'assets/skills/vh_thaicuckiem.png', glyph:'極', fx:{ shieldPct:35, t:6 }, desc:'Khiên kiếm khí — hấp thụ sát thương bằng 35% HP tối đa trong 6s.' },
  thaicucquan: { name:'Thái Cực Quyền', school:'Võ Đang', phai:null, tier:'than', cat:'Quyền', type:'aoe', unlock:45, cd:22, qi:35, mult:2.6, color:'#5ac8b8', icon:'assets/skills/vh_thaicucquan.png', glyph:'極拳', fx:{ r:200, kb:60, slow:{ pct:0.5, t:3 }, big:true }, desc:'Tứ lưỡng bát thiên cân — bạo phát AoE hất văng & làm chậm.' },
  thuanduong:  { name:'Thuần Dương Vô Cực Công', school:'Võ Đang', phai:null, tier:'than', cat:'Nội Công', type:'buff', unlock:50, cd:30, qi:30, color:'#e8a03a', icon:'assets/skills/vh_thuanduong.png', glyph:'陽', fx:{ dmgPct:50, t:8 }, desc:'Dương hỏa bùng nổ — +50% sát thương trong 8s.' },
  // ── Cái Bang (giang hồ) ──
  lienhoaquyen:{ name:'Liên Hoa Quyền', school:'Cái Bang', phai:null, tier:'so', cat:'Quyền', type:'cone', unlock:8, cd:3, qi:8, mult:1.15, color:'#b89a5a', icon:'assets/skills/vh_lienhoa.png', glyph:'連', fx:{}, desc:'Liên hoàn quyền cực nhanh — hồi chiêu chỉ 3s.' },
  thaikhacong: { name:'Thái Hà Công', school:'Cái Bang', phai:null, tier:'trung', cat:'Tâm Pháp', type:'passive', unlock:15, color:'#7ab86a', icon:'assets/skills/vh_thaiha.png', glyph:'河', desc:'Bị động: +4 Nội Lực hồi mỗi giây.' },
  dacau:       { name:'Đả Cẩu Bổng Pháp', school:'Cái Bang', phai:null, tier:'cao', cat:'Bổng', type:'aoe', unlock:30, cd:14, qi:22, mult:1.9, color:'#c8aa4a', icon:'assets/skills/vh_dacau.png', glyph:'棒', fx:{ r:170, slow:{ pct:0.5, t:3 } }, desc:'Bổng pháp tứ tung — AoE làm chậm 50% trong 3s.' },
  hanglong:    { name:'Hàng Long Thập Bát Chưởng', school:'Cái Bang', phai:null, tier:'than', cat:'Chưởng', type:'aoe', unlock:50, cd:28, qi:45, mult:3.6, color:'#f0c04a', icon:'assets/skills/vh_hanglong.png', glyph:'龍', fx:{ r:230, kb:80, stun:1, big:true }, desc:'Thập bát chưởng giáng long — chấn động toàn trường, hất văng & choáng.' },
  // ── Tiêu Dao (thất truyền — giang hồ) ──
  tieusi:      { name:'Tiểu Sĩ Thần Công', school:'Tiêu Dao', phai:null, tier:'so', cat:'Tâm Pháp', type:'passive', unlock:8, color:'#a0e8d8', icon:'assets/skills/vh_tieusi.png', glyph:'逍', desc:'Bị động: +12% tốc chạy, +5% né.' },
  sinhtuphu:   { name:'Sinh Tử Phù', school:'Tiêu Dao', phai:null, tier:'trung', cat:'Ám Khí', type:'proj', unlock:18, cd:8, qi:15, mult:1.3, color:'#7ac86a', icon:'assets/skills/vh_sinhtuphu.png', glyph:'符', fx:{ poison:{ t:5 }, pierce:true }, desc:'Phù độc đoạt mệnh — trúng địch trúng kịch độc, xuyên giáp.' },
  langba:      { name:'Lăng Ba Vi Bộ', school:'Tiêu Dao', phai:null, tier:'cao', cat:'Thân Pháp', type:'dash', unlock:30, cd:16, qi:20, color:'#a0ffe9', icon:'assets/skills/vh_langba.png', glyph:'波', fx:{ dist:180, eva:{ pct:100, t:2.5 } }, desc:'Bước trên sóng — lướt xuyên quái, né tuyệt đối 2.5s.' },
  bacminh:     { name:'Bắc Minh Thần Công', school:'Tiêu Dao', phai:null, tier:'than', cat:'Nội Công', type:'buff', unlock:45, cd:26, qi:30, color:'#4ac8e8', icon:'assets/skills/vh_bacminh.png', glyph:'冥', fx:{ leechPct:25, t:8 }, desc:'Thôn phệ nội lực — hút 25% sát thương thành sinh lực trong 8s.' },
  tieuvotuong: { name:'Tiểu Vô Tướng Công', school:'Tiêu Dao', phai:null, tier:'than', cat:'Tâm Pháp', type:'buff', unlock:55, cd:60, qi:40, color:'#b8e8ff', icon:'assets/skills/vh_tieuvotuong.png', glyph:'相', fx:{ resetCd:true, dmgPct:20, t:10 }, desc:'Biến hóa vô tướng — lập tức hồi toàn bộ chiêu, +20% ST 10s.' },
  // ── Toàn Chân · Cổ Mộ ──
  tckiemphap:  { name:'Toàn Chân Kiếm Pháp', school:'Toàn Chân · Cổ Mộ', phai:'toanchan', tier:'so', cat:'Kiếm', type:'proj', unlock:5, cd:5, qi:10, mult:1.5, color:'#c8d8ff', icon:'assets/skills/vh_tckiem.png', glyph:'真', fx:{ pierce:true }, desc:'Kiếm quang một đường — xuyên thấu mọi địch trên đường bay.' },
  ngocnu:      { name:'Ngọc Nữ Tâm Kinh', school:'Toàn Chân · Cổ Mộ', phai:'toanchan', tier:'trung', cat:'Tâm Pháp', type:'passive', unlock:20, color:'#e8c8d8', icon:'assets/skills/vh_ngocnu.png', glyph:'玉', desc:'Bị động: +10% tốc đánh, +8% né.' },
  songthu:     { name:'Song Thủ Hỗ Bác', school:'Toàn Chân · Cổ Mộ', phai:'toanchan', tier:'cao', cat:'Tâm Pháp', type:'passive', unlock:40, color:'#d8d8f0', icon:'assets/skills/vh_songthu.png', glyph:'雙', desc:'Bị động: 30% chiêu vừa tung không tốn hồi chiêu.' },
  tienthiencong:{ name:'Tiên Thiên Công', school:'Toàn Chân · Cổ Mộ', phai:'toanchan', tier:'than', cat:'Tâm Pháp', type:'passive', unlock:60, color:'#ffe9a8', icon:'assets/skills/vh_tienthien.png', glyph:'先', desc:'Bị động: chết tự hồi sinh 50% HP — mỗi 300s một lần.' },
  // ── Tán Tu gia truyền (12 môn — CHỈ lĩnh hội qua Luận Đạo với tán tu, Nhân Mạch phím L) ──
  tp_xuantam:   { name:'Huyền Tâm Thông',       school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#b8e8ff', icon:'assets/skills/vh_tlnoicong.png', glyph:'玄', desc:'Bị động: +10% kinh nghiệm.' },
  tp_linhcam:   { name:'Linh Cảm Thông Thiên',  school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#a8ffd8', icon:'assets/skills/vh_taytykinh.png', glyph:'靈', desc:'Bị động: +8% né tránh.' },
  tp_vanhanh:   { name:'Vân Hành Chu Thiên',    school:'Tán Tu', phai:null, npcOnly:true, tier:'trung',cat:'Tâm Pháp', type:'passive', unlock:1, color:'#c8d8ff', icon:'assets/skills/vh_thaiha.png', glyph:'雲', desc:'Bị động: +4 chân khí hồi mỗi giây.' },
  tp_thietbo:   { name:'Thiết Bố Sam',          school:'Tán Tu', phai:null, npcOnly:true, tier:'trung',cat:'Tâm Pháp', type:'passive', unlock:1, color:'#d8c8a8', icon:'assets/skills/vh_tlnoicong.png', glyph:'衫', desc:'Bị động: +10% phòng ngự.' },
  tp_thuathien: { name:'Thuận Thiên Giả',       school:'Tán Tu', phai:null, npcOnly:true, tier:'so',   cat:'Tâm Pháp', type:'passive', unlock:1, color:'#ffe9a8', icon:'assets/skills/vh_thaiha.png', glyph:'順', desc:'Bị động: +15% bạc rơi.' },
  tp_bachhop:   { name:'Bách Hợp Tâm Pháp',     school:'Tán Tu', phai:null, npcOnly:true, tier:'trung',cat:'Tâm Pháp', type:'passive', unlock:1, color:'#ffb8d0', icon:'assets/skills/vh_ngocnu.png', glyph:'合', desc:'Bị động: hồi 0.4% HP mỗi giây.' },
  tp_hoigiang:  { name:'Hồi Giang Tứ Hải',      school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#8ad8e8', icon:'assets/skills/vh_thaiha.png', glyph:'海', desc:'Bị động: +10% sát thương.' },
  tp_nhatnguyet:{ name:'Nhật Nguyệt Giao Hội',  school:'Tán Tu', phai:null, npcOnly:true, tier:'trung',cat:'Tâm Pháp', type:'passive', unlock:1, color:'#ffd0a0', icon:'assets/skills/vh_ngocnu.png', glyph:'月', desc:'Bị động: +6% tốc đánh.' },
  tp_thancong:  { name:'Thần Công Tâm Kinh',    school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#e8b8ff', icon:'assets/skills/vh_tienthien.png', glyph:'神', desc:'Bị động: +8% bạo kích.' },
  tp_votuong:   { name:'Vô Tướng Tâm Chú',      school:'Tán Tu', phai:null, npcOnly:true, tier:'trung',cat:'Tâm Pháp', type:'passive', unlock:1, color:'#d8d8d8', icon:'assets/skills/vh_tlnoicong.png', glyph:'相', desc:'Bị động: +15% chân khí tối đa.' },
  tp_lietdiem:  { name:'Liệt Diễm Chân Quyết',  school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#ff9a7a', icon:'assets/skills/vh_tienthien.png', glyph:'焰', desc:'Bị động: +12% ST bạo kích.' },
  tp_huyenamtp: { name:'Huyền Âm Tâm Pháp',     school:'Tán Tu', phai:null, npcOnly:true, tier:'cao',  cat:'Tâm Pháp', type:'passive', unlock:1, color:'#9a8ad8', icon:'assets/skills/vh_taytykinh.png', glyph:'陰', desc:'Bị động: kháng độc 60%.' },
  // ── Đào Hoa Đảo ──
  bichbochuong:{ name:'Bích Ba Chưởng', school:'Đào Hoa Đảo', phai:'daohoa', tier:'so', cat:'Chưởng', type:'cone', unlock:5, cd:5, qi:10, mult:1.3, color:'#e87a9a', icon:'assets/skills/vh_bichbo.png', glyph:'碧', fx:{ kb:34 }, desc:'Chưởng lực như sóng biển — đẩy lùi địch.' },
  // ── Minh Giáo / Ma Phái ──
  thanhhoa:    { name:'Thánh Hỏa Lệnh Pháp', school:'Minh Giáo', phai:'minhgiao', tier:'trung', cat:'Binh Khí', type:'dash', unlock:20, cd:9, qi:14, color:'#e86a2a', icon:'assets/skills/vh_thanhhoa.png', glyph:'火', fx:{ dist:140, strikeMult:1.5, pierce:true }, desc:'Lệnh bài quỹ đạo — lướt tới chém địch gần nhất, xuyên giáp.' },
  capmocong:   { name:'Cáp Mô Công', school:'Ma Phái', phai:'minhgiao', tier:'cao', cat:'Chưởng', type:'buff', unlock:40, cd:24, qi:28, color:'#d84a3a', icon:'assets/skills/vh_capmo.png', glyph:'蟆', fx:{ reflect:true, t:5 }, desc:'Côn phục xuất kích — phản 100% sát thương trong 5s.' },
  tichta:      { name:'Tịch Tà Kiếm Pháp', school:'Ma Phái', phai:'minhgiao', tier:'than', cat:'Kiếm', type:'buff', unlock:60, cd:30, qi:35, color:'#c03a5a', icon:'assets/skills/vh_tichta.png', glyph:'邪', fx:{ aspdPct:60, crit:true, t:6 }, desc:'Kiếm pháp tà mị — tốc đánh +60%, mọi đòn bạo kích trong 6s.' },
  // ── Giang Hồ Tuyệt Học ──
  cuuamtrao:   { name:'Cửu Âm Bạch Cốt Trảo', school:'Giang Hồ Tuyệt Học', phai:null, tier:'trung', cat:'Trảo', type:'cone', unlock:18, cd:8, qi:16, mult:1.8, color:'#9a6ac8', icon:'assets/skills/vh_cuuamtrao.png', glyph:'骨', fx:{ bleed:{ t:6 }, pierce:true }, desc:'Trảo pháp âm độc — xé giáp, gây chảy máu 6s.' },
  lucmach:     { name:'Lục Mạch Thần Kiếm', school:'Giang Hồ Tuyệt Học', phai:null, tier:'than', cat:'Kiếm Khí', type:'proj', unlock:45, cd:16, qi:32, mult:1.0, color:'#6ae8d8', icon:'assets/skills/vh_lucmach.png', glyph:'脈', fx:{ multi:6, pierce:true }, desc:'Sáu đạo kiếm khí từ đầu ngón tay — xuyên thấu 100% giáp.' },
  docco:       { name:'Độc Cô Cửu Kiếm', school:'Giang Hồ Tuyệt Học', phai:null, tier:'than', cat:'Kiếm', type:'proj', unlock:50, cd:18, qi:30, mult:3.0, color:'#e8e8f0', icon:'assets/skills/vh_docco.png', glyph:'孤', fx:{ pierce:true, stun:1, speed:720 }, desc:'Phá kiếm thức — một kiếm bỏ qua phòng thủ, cắt đứt chiêu địch.' },
  cuuamkinh:   { name:'Cửu Âm Chân Kinh', school:'Giang Hồ Tuyệt Học', phai:null, tier:'than', cat:'Tâm Pháp', type:'passive', unlock:50, color:'#b08ae8', icon:'assets/skills/vh_cuuamkinh.png', glyph:'陰', desc:'Bị động: +8% công, +8% phòng, +8% HP — mở giới hạn thuộc tính.' },
  cuuduongkinh:{ name:'Cửu Dương Chân Kinh', school:'Giang Hồ Tuyệt Học', phai:null, tier:'than', cat:'Tâm Pháp', type:'passive', unlock:50, color:'#f0a03a', icon:'assets/skills/vh_cuuduong.png', glyph:'陽', desc:'Bị động: kháng độc 70%, +5% HP.' },
};
// GDD §5.1: mọi chiêu khóa theo cảnh giới — võ học giang hồ cần tu tiên (Thăng Linh)
const VH_REALM_REQ  = { so:5, trung:5, cao:6, than:7 };
const VH_REALM_NAME = { 5:'Kim Đan Cảnh', 6:'Nguyên Anh · Trung Kỳ', 7:'Nguyên Anh · Hậu Kỳ' };
function vhRealmReq(v){ return v.phai ? 0 : (VH_REALM_REQ[v.tier] || 5); }
function vhLearned(id){ return !!(player && player.vohoc && player.vohoc[id]); }
// Đăng ký võ học chủ động vào SKILL_DEFS — dùng chung taskbar 5 ô & phím 1-5
for (const _vid in VOHOC_DEFS){
  const _v = VOHOC_DEFS[_vid];
  if (_v.type === 'passive') continue;
  SKILL_DEFS[_vid] = { unlock:_v.unlock, kind:'vh', icon:_v.icon, desc:_v.desc,
    req:()=>vhLearned(_vid),
    reqTxt:_v.phai ? 'Võ học môn phái — tự ngộ khi đạt cấp' : `Cần ${VH_REALM_NAME[VH_REALM_REQ[_v.tier]]} + ${VH_TIER[_v.tier].cost} 📜 Bí Kíp (bấm K)` };
}
// ═══════════ DUNG HỢP THẦN CÔNG — 30 tuyệt chiêu kết hợp liên phái ═══════════
// Danh pháp chuẩn Kim Dung (15) & Tiên Hiệp (15). Học đủ 2 môn tiền trệ + Nguyên Anh Trung Kỳ + 3 📜 Bí Kíp.
const FS_TIER = { name:'Dung Hợp', color:'#ff9ae0', cost:3 };
const FUSION_DEFS = {
  // ── Kim Dung ──
  fs_haptinh:    { name:'Hấp Tinh Đại Pháp', origin:'Kim Dung · Tiếu Ngạo Giang Hồ', req:['bacminh','capmocong'], tier:'than', cat:'Nội Công', type:'buff', unlock:60, cd:1, qi:40, color:'#3ac8a8', icon:'assets/skills/fs_haptinh.png', glyph:'吸', fx:{ leechPct:40, reflect:true, t:8 }, desc:'Hắc động thôn phệ — hút 40% sát thương thành sinh lực & phản đòn trong 8s.' },
  fs_thatthuong: { name:'Thất Thương Quyền', origin:'Kim Dung · Ỷ Thiên Đồ Long Ký', req:['lienhoaquyen','thaicucquan'], tier:'than', cat:'Quyền', type:'cone', unlock:60, cd:1, qi:30, mult:3.4, color:'#c86a5a', icon:'assets/skills/fs_thatthuong.png', glyph:'傷', fx:{ stun:1.2, kb:40 }, desc:'Thất thương tẫn hại — quyền kính 7 lớp chấn nát địch, choáng & hất văng.' },
  fs_huyenminh:  { name:'Huyền Minh Thần Chưởng', origin:'Kim Dung · Ỷ Thiên Đồ Long Ký', req:['batquaichuong','cuuamtrao'], tier:'than', cat:'Chưởng', type:'cone', unlock:60, cd:1, qi:32, mult:2.6, color:'#5a8ac8', icon:'assets/skills/fs_huyenminh.png', glyph:'冥', fx:{ slow:{ pct:0.7, t:4 }, bleed:{ t:6 } }, desc:'Âm hàn nhập cốt — chưởng lực đông cứng gân cốt, chảy máu & chậm 70%.' },
  fs_cuuduongthan:{ name:'Cửu Dương Thần Công', origin:'Kim Dung · Ỷ Thiên Đồ Long Ký', req:['cuuduongkinh','thuanduong'], tier:'than', cat:'Nội Công', type:'buff', unlock:60, cd:1, qi:45, color:'#ffb03a', icon:'assets/skills/fs_cuuduongthan.png', glyph:'陽', fx:{ dmgPct:70, t:8 }, desc:'Cửu dương tề tựu — nội lực vô biên, +70% sát thương trong 8s.' },
  fs_longtuong:  { name:'Long Tượng Ban Nhược Công', origin:'Kim Dung · Thần Điêu Hiệp Lữ', req:['lahanquan','dichcankinh'], tier:'than', cat:'Nội Công', type:'aoe', unlock:60, cd:1, qi:48, mult:4.2, color:'#d8a03a', icon:'assets/skills/fs_longtuong.png', glyph:'象', fx:{ r:220, kb:100, big:true }, desc:'Long tượng hiện hình — mười tầng lực đạo nghiền nát toàn trường.' },
  fs_hogiadao:   { name:'Hồ Gia Đao Pháp', origin:'Kim Dung · Tuyết Sơn Phi Hồ', req:['vodangkiem','docco'], tier:'than', cat:'Đao', type:'proj', unlock:60, cd:1, qi:28, mult:1.4, color:'#c8d8e8', icon:'assets/skills/fs_hogiadao.png', glyph:'胡', fx:{ multi:3, pierce:true, speed:680 }, desc:'Đao pháp truyền đời — ba đạo đao quang băng hàn xuyên thấu.' },
  fs_kimxa:      { name:'Kim Xà Kiếm Pháp', origin:'Kim Dung · Bích Huyết Kiếm', req:['tckiemphap','tichta'], tier:'than', cat:'Kiếm', type:'proj', unlock:60, cd:1, qi:30, mult:2.2, color:'#d8b83a', icon:'assets/skills/fs_kimxa.png', glyph:'蛇', fx:{ pierce:true, poison:{ t:6 } }, desc:'Kim xà phóng độc — kiếm quang như rắn vàng cắn xé, trúng kịch độc.' },
  fs_chietmai:   { name:'Thiên Sơn Chiết Mai Thủ', origin:'Kim Dung · Thiên Long Bát Bộ', req:['tieuvotuong','longtraothu'], tier:'than', cat:'Cầm Nã', type:'cone', unlock:60, cd:1, qi:30, mult:2.8, color:'#e8a8c0', icon:'assets/skills/fs_chietmai.png', glyph:'梅', fx:{ stun:2, pierce:true }, desc:'Chiết mai trong hư không — cánh hoa hóa thủ ấn, choáng 2s xuyên giáp.' },
  fs_lucduong:   { name:'Thiên Sơn Lục Dương Chưởng', origin:'Kim Dung · Thiên Long Bát Bộ', req:['hanglong','thaicuckiem'], tier:'than', cat:'Chưởng', type:'aoe', unlock:60, cd:1, qi:42, mult:3.8, color:'#f0d05a', icon:'assets/skills/fs_lucduong.png', glyph:'日', fx:{ r:230, stun:1, kb:70, big:true }, desc:'Lục dương luân chuyển — sáu vầng thái dương nổ tung quanh người.' },
  fs_truyenam:   { name:'Truyền Âm Sưu Hồn Đại Pháp', origin:'Kim Dung · Thiên Long Bát Bộ', req:['sinhtuphu','bacminh'], tier:'than', cat:'Âm Công', type:'proj', unlock:60, cd:1, qi:30, mult:1.1, color:'#8a5ac8', icon:'assets/skills/fs_truyenam.png', glyph:'魂', fx:{ multi:4, poison:{ t:5 }, pierce:true }, desc:'Âm ba sưu hồn — bốn đạo tử khí xuyên thấu, đoạt mệnh vô thanh.' },
  fs_bathoang:   { name:'Bát Hoang Lục Hợp Duy Ngã Độc Tôn Công', origin:'Kim Dung · Thiên Long Bát Bộ', req:['bacminh','tieuvotuong'], tier:'than', cat:'Nội Công', type:'buff', unlock:60, cd:1, qi:50, color:'#b8e8ff', icon:'assets/skills/fs_bathoang.png', glyph:'尊', fx:{ dmgPct:40, leechPct:20, t:10 }, desc:'Duy ngã độc tôn — +40% ST & hút 20% sinh lực trong 10s.' },
  fs_hoacot:     { name:'Hóa Cốt Miên Chưởng', origin:'Kim Dung · Lộc Đỉnh Ký', req:['cuuamtrao','ngocnu'], tier:'than', cat:'Chưởng', type:'cone', unlock:60, cd:1, qi:26, mult:2.4, color:'#a87ab8', icon:'assets/skills/fs_hoacot.png', glyph:'綿', fx:{ bleed:{ t:8 }, slow:{ pct:0.5, t:3 } }, desc:'Miên chưởng hóa cốt — trúng chưởng xương cốt nhũn ra, chảy máu 8s.' },
  fs_huyenam:    { name:'Huyễn Âm Chỉ', origin:'Kim Dung · Ỷ Thiên Đồ Long Ký', req:['niemhoachi','tienthiencong'], tier:'than', cat:'Chỉ', type:'proj', unlock:60, cd:1, qi:34, mult:4.0, color:'#7ab8e8', icon:'assets/skills/fs_huyenam.png', glyph:'幻', fx:{ stun:1.5, speed:760 }, desc:'Chỉ phong huyễn ảnh — một chỉ xuyên thấu ảo ảnh, choáng 1.5s.' },
  fs_kimcang:    { name:'Kim Cang Bất Hoại Thần Công', origin:'Kim Dung · Ỷ Thiên Đồ Long Ký', req:['tlnoicong','dichcankinh'], tier:'than', cat:'Hộ Thể', type:'buff', unlock:60, cd:1, qi:40, color:'#e8c84a', icon:'assets/skills/fs_kimcang.png', glyph:'剛', fx:{ shieldPct:60, dmgPct:20, t:6 }, desc:'Kim cang bất hoại — khiên 60% HP & +20% ST trong 6s.' },
  fs_thaihuyen:  { name:'Thái Huyền Kinh', origin:'Kim Dung · Hiệp Khách Hành', req:['cuuamkinh','cuuduongkinh'], tier:'than', cat:'Tâm Pháp', type:'buff', unlock:60, cd:1, qi:60, color:'#ffd76a', icon:'assets/skills/fs_thaihuyen.png', glyph:'玄', fx:{ dmgPct:100, shieldPct:30, t:10 }, desc:'Đệ nhất thần công — đốn ngộ thái huyền: +100% ST & khiên 30% HP trong 10s.' },
  // ── Tiên Hiệp ──
  fs_ngukiem:    { name:'Ngự Kiếm Phi Tiên', origin:'Tiên Hiệp', req:['langba','lucmach'], tier:'than', cat:'Kiếm Thuật', type:'dash', unlock:60, cd:1, qi:30, color:'#9ad8ff', icon:'assets/skills/fs_ngukiem.png', glyph:'御', fx:{ dist:220, strikeMult:2.2, pierce:true }, desc:'Ngự kiếm mà đi — hóa thành kiếm quang xé gió, chém xuyên địch cuối đường.' },
  fs_vankiem:    { name:'Vạn Kiếm Quy Tông', origin:'Tiên Hiệp', req:['lucmach','docco'], tier:'than', cat:'Kiếm Trận', type:'proj', unlock:60, cd:1, qi:45, mult:0.8, color:'#e8f0ff', icon:'assets/skills/fs_vankiem.png', glyph:'萬', fx:{ multi:9, pierce:true, speed:640 }, desc:'Vạn kiếm triều tông — chín đạo phi kiếm quét ngang, xuyên thấu tuyệt đối.' },
  fs_cuuthien:   { name:'Cửu Thiên Huyền Lôi', origin:'Tiên Hiệp', req:['hanglong','lucmach'], tier:'than', cat:'Lôi Pháp', type:'aoe', unlock:60, cd:1, qi:55, mult:4.5, color:'#8ab8ff', icon:'assets/skills/fs_cuuthien.png', glyph:'雷', fx:{ r:250, stun:1.2, big:true }, desc:'Cửu thiên giáng lôi — lôi trụ tử điện đánh xuống, choáng toàn trường.' },
  fs_hoaphuong:  { name:'Hỏa Phượng Niết Bàn', origin:'Tiên Hiệp', req:['thanhhoa','thuanduong'], tier:'than', cat:'Hỏa Pháp', type:'aoe', unlock:60, cd:1, qi:45, mult:3.6, color:'#ff7a3a', icon:'assets/skills/fs_hoaphuong.png', glyph:'鳳', fx:{ r:240, kb:50, big:true }, desc:'Phượng hoàng dục hỏa — liệt diễm trùm trời, niết bàn trùng sinh.' },
  fs_huyenbang:  { name:'Huyền Băng Thần Chưởng', origin:'Tiên Hiệp', req:['batquaichuong','sinhtuphu'], tier:'than', cat:'Băng Pháp', type:'cone', unlock:60, cd:1, qi:30, mult:2.8, color:'#a8e8ff', icon:'assets/skills/fs_huyenbang.png', glyph:'冰', fx:{ slow:{ pct:0.8, t:4 }, stun:1 }, desc:'Huyền băng phong ấn — hàn khí đóng băng tứ chi, chậm 80% & choáng.' },
  fs_nguhanh:    { name:'Ngũ Hành Độn Thuật', origin:'Tiên Hiệp', req:['thanhanh','langba'], tier:'than', cat:'Độn Pháp', type:'dash', unlock:60, cd:1, qi:24, color:'#c8e8a8', icon:'assets/skills/fs_nguhanh.png', glyph:'遁', fx:{ dist:260, eva:{ pct:100, t:3 } }, desc:'Độn hình ngũ hành — lướt xa 260px, né tuyệt đối 3s.' },
  fs_thienma:    { name:'Thiên Ma Giải Thể Đại Pháp', origin:'Tiên Hiệp · Ma Đạo', req:['tichta','capmocong'], tier:'than', cat:'Ma Công', type:'buff', unlock:60, cd:1, qi:40, color:'#c03a6a', icon:'assets/skills/fs_thienma.png', glyph:'魔', fx:{ aspdPct:80, crit:true, t:6 }, desc:'Giải thể bộc phát — tốc đánh +80%, mọi đòn bạo kích trong 6s.' },
  fs_huyetma:    { name:'Huyết Ma Phệ Hồn Chưởng', origin:'Tiên Hiệp · Ma Đạo', req:['cuuamtrao','bacminh'], tier:'than', cat:'Ma Chưởng', type:'cone', unlock:60, cd:1, qi:32, mult:2.6, color:'#c02a3a', icon:'assets/skills/fs_huyetma.png', glyph:'噬', fx:{ bleed:{ t:6 }, kb:20 }, desc:'Huyết ma phệ hồn — trảo huyết xé hồn phách, chảy máu 6s.' },
  fs_thaiat:     { name:'Thái Ất Thần Kiếm', origin:'Tiên Hiệp', req:['tckiemphap','docco'], tier:'than', cat:'Tiên Kiếm', type:'proj', unlock:60, cd:1, qi:36, mult:4.2, color:'#ffe9a8', icon:'assets/skills/fs_thaiat.png', glyph:'乙', fx:{ pierce:true, speed:800 }, desc:'Thái Ất huyền quang — một kiếm phá vạn pháp, tốc độ cực hạn.' },
  fs_tutuong:    { name:'Tứ Tượng Trấn Ma Ấn', origin:'Tiên Hiệp', req:['dacau','thaicuckiem'], tier:'than', cat:'Pháp Ấn', type:'aoe', unlock:60, cd:1, qi:40, mult:3.2, color:'#d8c86a', icon:'assets/skills/fs_tutuong.png', glyph:'印', fx:{ r:210, stun:1.5, big:true }, desc:'Tứ tượng tề giáng — Thanh Long Bạch Hổ Chu Tước Huyền Vũ trấn áp, choáng 1.5s.' },
  fs_bangphong:  { name:'Băng Phong Vạn Lý', origin:'Tiên Hiệp', req:['vodangkiem','sinhtuphu'], tier:'than', cat:'Băng Pháp', type:'aoe', unlock:60, cd:1, qi:38, mult:3.0, color:'#b8e0f0', icon:'assets/skills/fs_bangphong.png', glyph:'凍', fx:{ r:250, slow:{ pct:0.6, t:5 } }, desc:'Vạn lý giao băng — sóng băng phủ toàn trường, chậm 60% trong 5s.' },
  fs_loidinh:    { name:'Lôi Đình Vạn Quân', origin:'Tiên Hiệp', req:['lahanquan','hanglong'], tier:'than', cat:'Lôi Pháp', type:'aoe', unlock:60, cd:1, qi:42, mult:3.4, color:'#e8d86a', icon:'assets/skills/fs_loidinh.png', glyph:'霆', fx:{ r:220, stun:1, kb:60, big:true }, desc:'Lôi quân vạn mã — sấm sét như thiên binh quét sạch bát phương.' },
  fs_phethien:   { name:'Phệ Thiên Ma Công', origin:'Tiên Hiệp · Ma Đạo', req:['cuuamkinh','bacminh'], tier:'than', cat:'Ma Công', type:'buff', unlock:60, cd:1, qi:45, color:'#9a4a8a', icon:'assets/skills/fs_phethien.png', glyph:'吞', fx:{ leechPct:35, dmgPct:30, t:8 }, desc:'Thôn thiên phệ địa — hút 35% sinh lực & +30% ST trong 8s.' },
  fs_dalat:      { name:'Đại La Tiên Kiếm', origin:'Tiên Hiệp', req:['thaicuckiem','lucmach'], tier:'than', cat:'Tiên Kiếm', type:'proj', unlock:60, cd:1, qi:34, mult:1.0, color:'#a8f0e0', icon:'assets/skills/fs_dalat.png', glyph:'仙', fx:{ multi:5, pierce:true, speed:700 }, desc:'Đại la kiếm trận — năm thanh tiên kiếm đồng loạt xuất kích.' },
  fs_nietban:    { name:'Niết Bàn Phật Ấn', origin:'Tiên Hiệp · Phật Môn', req:['lahanquan','tienthiencong'], tier:'than', cat:'Phật Ấn', type:'aoe', unlock:60, cd:1, qi:50, mult:4.0, color:'#f0e8c8', icon:'assets/skills/fs_nietban.png', glyph:'槃', fx:{ r:240, stun:1, big:true }, desc:'Phật ấn giáng thế — kim chưởng niết bàn trấn áp chư ma.' },
};
for (const _fid in FUSION_DEFS){
  const _f = FUSION_DEFS[_fid];
  SKILL_DEFS[_fid] = { unlock:_f.unlock, kind:'vh', icon:_f.icon, desc:_f.desc,
    req:()=>vhLearned(_fid),
    reqTxt:`Dung hợp: ${_f.req.map(r => (VOHOC_DEFS[r] || {}).name || r).join(' + ')} — Nguyên Anh Trung Kỳ + 3 📜 (bấm K)` };
}

// ═══════════ CẤP KỸ NĂNG 1-120 — cooldown chỉ 0-1s, sức mạnh dồn vào cấp chiêu (+2.5% ST/cấp) ═══════════
function skLv(id){ return (player && player.skillLv && player.skillLv[id]) || 1; }
function skLvMult(id){ return 1 + (skLv(id) - 1) * 0.025; }
function skUpCost(id){ return Math.round(150 * Math.pow(skLv(id), 1.45)); }

// GDD Đợt 2 B6: mốc cảnh giới chiêu 20-120 (nhân dồn với +2.5% ST/cấp)
const SK_MILESTONES = [
  { lv:20,  name:'Tiểu Thành', dmg:0.08 },
  { lv:40,  name:'Trung Thành', cd:0.10 },
  { lv:60,  name:'Đại Thành',   dmg:0.12 },
  { lv:80,  name:'Viên Dung',   qi:0.12 },
  { lv:100, name:'Xuất Thần',   dmg:0.15 },
  { lv:120, name:'Hóa Cảnh',    dmg:0.20 },
];
function skMile(id){
  const lv = skLv(id); let dmg = 1, cd = 1, qi = 1;
  for (const m of SK_MILESTONES){
    if (lv >= m.lv){ if (m.dmg) dmg *= 1 + m.dmg; if (m.cd) cd *= 1 - m.cd; if (m.qi) qi *= 1 - m.qi; }
  }
  return { dmg, cd, qi };
}
function milestoneTxt(m){ return m.dmg ? `+${m.dmg*100}% sát thương` : m.cd ? `−${m.cd*100}% hồi chiêu` : `−${m.qi*100}% tiêu hao Nội Lực`; }
window.upgradeSkillUI = function(id){
  const lv = skLv(id);
  if (lv >= 120){ addFloat(player.x, player.y-40, 'Kỹ năng đã viên mãn (Lv 120)!', '#8a8a8a', 12); return; }
  if (lv >= player.level){ addFloat(player.x, player.y-40, `Cấp kỹ năng ≤ cấp nhân vật (${player.level})`, '#8a8a8a', 12); return; }
  const cost = skUpCost(id);
  if (player.silver < cost){ addFloat(player.x, player.y-40, `Cần ${cost.toLocaleString()} bạc`, '#8a8a8a', 12); return; }
  player.silver -= cost;
  if (!player.skillLv) player.skillLv = {};
  player.skillLv[id] = lv + 1;
  const _ms = SK_MILESTONES.find(x => x.lv === lv + 1); // GDD Đợt 2 B6: đạt mốc cảnh giới chiêu
  if (_ms){
    zoneBanner = { text:'☯ ' + skillInfo(id).name, sub:`Đạt mốc ${_ms.name} (cấp ${lv+1}) — ${milestoneTxt(_ms)}`, color:'#e8c84a', t:3.5 };
    AudioSys.sfx('quest', 0.8);
    addEffect({ type:'ring', x:player.x, y:player.y, r:80, color:'#e8c84a', big:true });
  }
  addFloat(player.x, player.y-52, `⬆ ${skillInfo(id).name} → Lv ${lv + 1}!`, '#6ae88a', 13);
  AudioSys.sfx('levelup', 0.4);
  saveGame(); renderSkillPanel();
};
function upBtnHtml(id){
  const lv = skLv(id);
  if (lv >= 120) return `<span style="font-size:10px;color:#ffd76a;margin-right:4px">VIÊN MÃN · HÓA CẢNH</span>`;
  const nm = SK_MILESTONES.find(x => x.lv > lv);
  const cur = [...SK_MILESTONES].reverse().find(x => lv >= x.lv);
  return `<button class="mini-btn vh-learn-btn" style="margin-right:3px" title="Cấp ${lv}/120${cur ? ' · ' + cur.name : ''} — nâng: ${skUpCost(id).toLocaleString()} bạc, +2,5% ST${nm ? ` · mốc kế ${nm.name} (cấp ${nm.lv}): ${milestoneTxt(nm)}` : ''} · cấp kỹ năng ≤ cấp nhân vật" onclick="window.upgradeSkillUI('${id}')">⬆${lv}</button>`;
}
function fsCanLearn(id){ const f = FUSION_DEFS[id]; return f && !vhLearned(id) && f.req.every(r => vhLearned(r)); }
window.learnFusionUI = function(id){
  const f = FUSION_DEFS[id]; if (!f || vhLearned(id)) return;
  if (player.level < f.unlock){ addFloat(player.x, player.y-40, `Cần cấp ${f.unlock}`, '#8a8a8a', 12); return; }
  if (((player.dantian && player.dantian.realm) || 0) < 6){ addFloat(player.x, player.y-40, 'Dung hợp cần Nguyên Anh · Trung Kỳ', '#b08ae8', 12); return; }
  if (!f.req.every(r => vhLearned(r))){ addFloat(player.x, player.y-40, 'Chưa lĩnh ngộ đủ 2 môn tiền trệ', '#8a8a8a', 12); return; }
  if ((player.bikipVH || 0) < FS_TIER.cost){ addFloat(player.x, player.y-40, `Cần ${FS_TIER.cost} 📜 Bí Kíp`, '#8a8a8a', 12); return; }
  player.bikipVH -= FS_TIER.cost;
  player.vohoc[id] = true;
  calcDerived(); saveGame();
  addFloat(player.x, player.y-66, `☯ DUNG HỢP THÀNH CÔNG: ${f.name}!`, FS_TIER.color, 17);
  zoneBanner = { text:'☯ DUNG HỢP THẦN CÔNG', sub:`${f.name} — ${f.origin} · bấm K gán vào taskbar`, color:FS_TIER.color, t:4 };
  AudioSys.sfx('quest', 1);
  addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:FS_TIER.color, big:true });
  for (let i = 0; i < 12; i++) addEffect({ type:'ink', x:player.x+rnd(-40,40), y:player.y+rnd(-40,40), vx:rnd(-50,50), vy:rnd(-90,-30), color:FS_TIER.color });
  renderSkillPanel();
};
function vhLearned(id){ return !!(player && player.vohoc && player.vohoc[id]); }
function learnVohoc(id){
  const v = VOHOC_DEFS[id];
  if (!v || vhLearned(id)) return;
  player.vohoc[id] = true;
  calcDerived(); saveGame();
  addFloat(player.x, player.y-66, `✦ Ngộ được: ${v.name}!`, VH_TIER[v.tier].color, 16);
  zoneBanner = { text:'VÕ HỌC PHỔ', sub:`${v.school} · ${v.name} — bấm K gán vào taskbar`, color:VH_TIER[v.tier].color, t:3.5 };
  AudioSys.sfx('quest', 0.9);
}
window.learnVohocUI = function(id){
  const v = VOHOC_DEFS[id];
  if (!v || vhLearned(id) || v.phai) return;
  if (v.npcOnly){ addFloat(player.x, player.y-40, 'Tâm pháp gia truyền — chỉ lĩnh hội qua Luận Đạo với tán tu (phím L)', '#b8e8ff', 12); return; }
  const cost = VH_TIER[v.tier].cost;
  if (player.level < v.unlock){ addFloat(player.x, player.y-40, `Cần cấp ${v.unlock}`, '#8a8a8a', 12); return; }
  const _rReq = vhRealmReq(v);
  if (((player.dantian && player.dantian.realm) || 0) < _rReq){
    addFloat(player.x, player.y-40, `Chưa ngộ nổi — cần ${VH_REALM_NAME[_rReq]}`, '#b08ae8', 13);
    addFloat(player.x, player.y-56, 'Đột phá Đan Điền (N) rồi đến vách Té Núi cầu cơ duyên!', '#9a8a68', 11);
    return;
  }
  if ((player.bikipVH || 0) < cost){ addFloat(player.x, player.y-40, `Thiếu Bí Kíp (cần ${cost})`, '#e8c84a', 12); return; }
  player.bikipVH -= cost;
  learnVohoc(id);
  renderSkillPanel();
};
function vhAutoLearn(){ // võ học môn phái tự ngộ khi đạt cấp (Cổ Mộ học chung võ Toàn Chân)
  for (const _vid in VOHOC_DEFS){
    const _v = VOHOC_DEFS[_vid];
    if (!_v.phai || vhLearned(_vid) || player.level < _v.unlock) continue;
    if (!player.ascended && _v.phai !== player.sect && !(_v.phai === 'toanchan' && player.sect === 'comoc')) continue; // Phi Thăng: môn phái phá bỏ — võ học toàn tự do
    learnVohoc(_vid);
  }
}
function vhKnockback(m, ang, px){
  if (m.def.bossKind) px *= 0.35; // boss nặng cân — khó hất văng
  m.x = clamp(m.x + Math.cos(ang)*px, 30, MAP.w-30);
  m.y = clamp(m.y + Math.sin(ang)*px, 30, MAP.h-30);
}

// ═══════════ VFX TUYỆT CHIÊU — mỗi thần công một hình ảnh riêng, không trùng lặp ═══════════
// FS_VFX: 30 dung hợp · VH_VFX: 24 võ học chủ động. style → drawVfx, proj → drawProjStyled.
// SECT_VFX: 16 tuyệt chiêu môn phái (8 chiêu chính sx_*_a + 8 trấn phái sx_*_c) — hình ảnh riêng từng phái
const SECT_VFX = {
  sx_thieulam_a: { style:'vajra',        c2:'#fff4c8', spin:1.2 },            // Kim Cương Chưởng — ấn chưởng kim cang
  sx_thieulam_c: { style:'fist',         c2:'#ffe9a0' },                      // Đại Lực Kim Cương Chưởng — chưởng ấn khổng lồ
  sx_toanchan_a: { style:'flash',        c2:'#d8f4ff', proj:'sword' },        // Kiếm Khí Xuyên Vân — kiếm khí bạch quang
  sx_toanchan_c: { style:'hexa',         c2:'#c8ecff', spin:1.5 },            // Thất Tinh Hội Kiếm — trận Bắc Đẩu thất tinh
  sx_comoc_a:    { style:'crescents',    c2:'#e8dcff', proj:'blade' },        // Song Hoàn Trảm — nguyệt hoàn đôi
  sx_comoc_c:    { style:'petals',       c2:'#f0e8ff' },                      // Ngọc Nữ Tố Tâm Kiếm — song kiếm ngọc
  sx_baidasan_a: { style:'flash',        c2:'#b8ff9a', proj:'serpent' },      // Linh Xà Độc Tiêu — xà tiêu độc
  sx_baidasan_c: { style:'bonemist',     c2:'#d8ffb8' },                      // Hà Mô Công — cóc kình độc khí
  sx_minhgiao_a: { style:'phoenix',      c2:'#ffb35a' },                      // Thánh Hỏa Liên Nguyên — liên hỏa
  sx_minhgiao_c: { style:'vortex',       c2:'#ff9a5a', spin:2.8 },            // Càn Khôn Đại Na Di — vòng xoáy càn khôn
  sx_doanthi_a:  { style:'flash',        c2:'#fff0b8', proj:'beam' },         // Nhất Dương Chỉ — chỉ lực xuyên thấu
  sx_doanthi_c:  { style:'suns',         c2:'#ffe9a0', spin:2.0 },            // Lục Mạch Thần Kiếm — lục mạch kiếm quang
  sx_daohoa_a:   { style:'petals',       c2:'#ffd8e8' },                      // Lạc Anh Kiếm Vũ — hoa đào cuồn vũ
  sx_daohoa_c:   { style:'dragonwave',   c2:'#a8e0d8' },                      // Bích Hải Triều Sinh Khúc — sóng triều âm luật
  sx_vophai_a:   { style:'fist',         c2:'#e8d8a8' },                      // Du Hiệp Quyền — quyền kình
  sx_vophai_c:   { style:'stormhost',    c2:'#e8dcc0' },                      // Tứ Hải Giai Phục — sóng chưởng tứ hải
};
const FS_VFX = {
  fs_haptinh:    { style:'vortex',       c2:'#0e4a3e', spin:3.2 },
  fs_thatthuong: { style:'fist',         c2:'#ffb35a' },
  fs_huyenminh:  { style:'frost',        c2:'#bfeaff' },
  fs_cuuduongthan:{ style:'sunwheel',    c2:'#ff8a3a', spin:2.4 },
  fs_longtuong:  { style:'dragonwave',   c2:'#fff0b8' },
  fs_hogiadao:   { style:'crescents',    c2:'#dff4ff', proj:'blade' },
  fs_kimxa:      { style:'flash',        c2:'#ffec9e', proj:'serpent' },
  fs_chietmai:   { style:'petals',       c2:'#ffffff' },
  fs_lucduong:   { style:'suns',         c2:'#ffd76a', spin:2.0 },
  fs_truyenam:   { style:'flash',        c2:'#c09aff', proj:'note' },
  fs_bathoang:   { style:'hexa',         c2:'#ffd76a', spin:1.5 },
  fs_hoacot:     { style:'bonemist',     c2:'#e8e8e8' },
  fs_huyenam:    { style:'flash',        c2:'#e0c8ff', proj:'beam' },
  fs_kimcang:    { style:'vajra',        c2:'#fff4c8', spin:1.2 },
  fs_thaihuyen:  { style:'galaxy',       c2:'#8ab8ff', spin:1.8 },
  fs_ngukiem:    { style:'swordride',    c2:'#eaf6ff' },
  fs_vankiem:    { style:'flash',        c2:'#cfe8ff', proj:'sword' },
  fs_cuuthien:   { style:'thunderpillar',c2:'#fff2a8' },
  fs_hoaphuong:  { style:'phoenix',      c2:'#ff9a5a' },
  fs_huyenbang:  { style:'icecage',      c2:'#ffffff' },
  fs_nguhanh:    { style:'wuxing',       c2:'#8ae8c8' },
  fs_thienma:    { style:'demonburst',   c2:'#ff5a3a' },
  fs_huyetma:    { style:'bloodclaw',    c2:'#ff8a8a' },
  fs_thaiat:     { style:'flash',        c2:'#ffffff', proj:'beam2' },
  fs_tutuong:    { style:'seal4',        c2:'#ffe8a8' },
  fs_bangphong:  { style:'icefield',     c2:'#e8f6ff' },
  fs_loidinh:    { style:'stormhost',    c2:'#fff8c0' },
  fs_phethien:   { style:'devourmaw',    c2:'#3a0a4a', spin:2.6 },
  fs_dalat:      { style:'flash',        c2:'#fff8e0', proj:'sword' },
  fs_nietban:    { style:'buddhapalm',   c2:'#fff8d8' },
};
const VH_VFX = {
  lahanquan:   { style:'fist',       c2:'#ffe8b0' },
  longtraothu: { style:'bloodclaw',  c2:'#ffd0a0' },
  niemhoachi:  { style:'flash',      c2:'#ffffff', proj:'shard' },
  vodangkiem:  { style:'crescents',  c2:'#dff0ff' },
  batquaichuong:{ style:'hexa',      c2:'#a8ffd8', spin:1.0 },
  thanhanh:    { style:'wuxing',     c2:'#8ad8ff' },
  thaicuckiem: { style:'vajra',      c2:'#b8d8ff', spin:0.9 },
  thaicucquan: { style:'dragonwave', c2:'#c8d8ff' },
  thuanduong:  { style:'sunwheel',   c2:'#ff6a3a', spin:2.0 },
  lienhoaquyen:{ style:'fist',       c2:'#ffb0a0' },
  dacau:       { style:'suns',       c2:'#c8e8a0', spin:2.6 },
  hanglong:    { style:'dragonwave', c2:'#ffb060' },
  sinhtuphu:   { style:'flash',      c2:'#b0ff90', proj:'serpent' },
  langba:      { style:'wuxing',     c2:'#90ffe0' },
  bacminh:     { style:'vortex',     c2:'#2a3a6a', spin:2.8 },
  tieuvotuong: { style:'galaxy',     c2:'#e8e8ff', spin:1.2 },
  tckiemphap:  { style:'flash',      c2:'#d8e8ff', proj:'sword' },
  bichbochuong:{ style:'petals',     c2:'#ffd0e0' },
  thanhhoa:    { style:'phoenix',    c2:'#ff8a50' },
  capmocong:   { style:'demonburst', c2:'#ffa050' },
  tichta:      { style:'bloodclaw',  c2:'#d8a0ff' },
  cuuamtrao:   { style:'bloodclaw',  c2:'#f0f0e8' },
  lucmach:     { style:'flash',      c2:'#ffffff', proj:'beam', rainbow:true },
  docco:       { style:'flash',      c2:'#e0b0ff', proj:'blade' },
};
function _vxLine(x1, y1, x2, y2){ ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function _vxBolt(x, y, ang, len, w, col){
  ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.globalAlpha = Math.min(1, ctx.globalAlpha);
  ctx.beginPath(); ctx.moveTo(x, y);
  const n = 6;
  for (let i = 1; i <= n; i++){
    const t = i / n, off = (i < n ? rnd(-w, w) : 0);
    ctx.lineTo(x + Math.cos(ang)*len*t + Math.cos(ang + Math.PI/2)*off, y + Math.sin(ang)*len*t + Math.sin(ang + Math.PI/2)*off);
  }
  ctx.stroke();
  ctx.lineWidth = 1.1; ctx.strokeStyle = '#fff'; ctx.stroke();
}
function _vxSword(x, y, ang, len, col, al){
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = al;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len*0.78, -3.2); ctx.lineTo(len, 0); ctx.lineTo(len*0.78, 3.2); ctx.closePath(); ctx.fill();
  ctx.fillRect(-7, -1.6, 9, 3.2); ctx.fillRect(-1.5, -6.5, 3, 13);
  ctx.restore();
}
function _vxPetal(x, y, rot, s, col, al){
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = al; ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 0, s, s*0.45, 0, 0, 7); ctx.fill(); ctx.restore();
}
function _vxFlake(x, y, s, col, al){
  ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.globalAlpha = al;
  for (let i = 0; i < 3; i++){ const a = i*Math.PI/3; _vxLine(x - Math.cos(a)*s, y - Math.sin(a)*s, x + Math.cos(a)*s, y + Math.sin(a)*s); }
}
function _vxGlyph(x, y, ch, s, col, al){
  ctx.globalAlpha = al; ctx.font = `bold ${Math.round(s)}px "Noto Serif", serif`; ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3; ctx.strokeText(ch, x, y + s*0.35);
  ctx.fillStyle = col; ctx.fillText(ch, x, y + s*0.35);
}
function drawVfx(e, k, a){
  const S = e.style, X = e.x, Y = e.y, F = e.face || 0, R = e.r || 100, C1 = e.c1 || '#fff', C2 = e.c2 || '#fff', G = e.glyph || '氣';
  const spin = e.ang || 0;
  ctx.save(); ctx.lineCap = 'round';
  const arc  = (x, y, r, a0, a1, c, w, al) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, Math.max(1, r), a0, a1); ctx.stroke(); };
  const disc = (x, y, r, c, al) => { ctx.fillStyle = c; ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, 7); ctx.fill(); };
  const poly = (x, y, r, n, rot, c, w, al) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = al; ctx.beginPath(); for (let i = 0; i <= n; i++){ const aa = rot + i*2*Math.PI/n; i ? ctx.lineTo(x + Math.cos(aa)*r, y + Math.sin(aa)*r) : ctx.moveTo(x + Math.cos(aa)*r, y + Math.sin(aa)*r); } ctx.stroke(); };
  if (S === 'flash'){ // tia sáng xuất chiêu (proj)
    arc(X, Y, R*(0.4 + k*0.7), F - 1, F + 1, C1, 5*(1-k) + 2, a*0.9);
    _vxGlyph(X + Math.cos(F)*R*0.5, Y + Math.sin(F)*R*0.5, G, 20, C2, a*0.9);
  } else if (S === 'shock'){ // vòng đệm chung
    arc(X, Y, R*(0.2 + k*0.8), 0, 7, C1, 4, a*0.8);
    arc(X, Y, R*0.55*(0.3 + k*0.7), 0, 7, C2, 2.5, a*0.6);
  } else if (S === 'vortex'){ // Hấp Tinh / Bắc Minh — hắc động xoáy hút vào
    const rr = R*(1.05 - k*0.5);
    disc(X, Y, R*0.32*(1 - k*0.4), C2, a*0.55);
    for (let i = 0; i < 5; i++){ const a0 = i*1.2566 + spin + k*6; arc(X, Y, rr, a0, a0 + 1.4, C1, 4.5, a*0.9); }
    arc(X, Y, rr*0.6, spin - k*8, spin - k*8 + 4, C2, 2.5, a*0.7);
    _vxGlyph(X, Y, G, 24, C1, a*0.9);
  } else if (S === 'fist'){ // Thất Thương / La Hán / Liên Hoa — sóng quyền đứt quãng chồng lớp
    for (let i = 0; i < 4; i++){ const kk = k*1.3 - i*0.12; if (kk <= 0) continue;
      ctx.setLineDash([10, 7]); arc(X, Y, R*(0.25 + Math.min(1, kk)*0.75)*(1 - i*0.12), F - 0.7, F + 0.7, i%2 ? C2 : C1, 6 - i, a*0.85); }
    ctx.setLineDash([]);
    _vxGlyph(X + Math.cos(F)*R*0.55, Y + Math.sin(F)*R*0.55, G, 30, C2, a);
  } else if (S === 'frost'){ // Huyền Minh — mảnh băng nhọn xé không khí
    for (let i = 0; i < 9; i++){ const ang = F + (i-4)*0.22; const L = R*(0.35 + k*0.65)*(0.75 + ((i*37)%10)/22);
      const tx = X + Math.cos(ang)*L, ty = Y + Math.sin(ang)*L;
      ctx.fillStyle = i%2 ? C1 : C2; ctx.globalAlpha = a*0.85; ctx.beginPath();
      ctx.moveTo(tx + Math.cos(ang)*12, ty + Math.sin(ang)*12);
      ctx.lineTo(tx + Math.cos(ang + 2.4)*7, ty + Math.sin(ang + 2.4)*7);
      ctx.lineTo(tx + Math.cos(ang - 2.4)*7, ty + Math.sin(ang - 2.4)*7); ctx.closePath(); ctx.fill(); }
    arc(X, Y, R*(0.3 + k*0.5), F - 1, F + 1, C2, 2.5, a*0.7);
  } else if (S === 'sunwheel'){ // Cửu Dương / Thuần Dương — mặt trời tia sáng quay
    const rr = R*(0.55 + k*0.3);
    arc(X, Y, rr, 0, 7, C1, 5, a*0.9);
    for (let i = 0; i < 12; i++){ const aa = i*0.5236 + spin; ctx.strokeStyle = C2; ctx.lineWidth = 3; ctx.globalAlpha = a*0.8;
      _vxLine(X + Math.cos(aa)*(rr + 6), Y + Math.sin(aa)*(rr + 6), X + Math.cos(aa)*(rr + 16*(1-k) + 8), Y + Math.sin(aa)*(rr + 16*(1-k) + 8)); }
    _vxGlyph(X, Y, G, 30, C2, a);
  } else if (S === 'dragonwave'){ // Long Tượng / Thái Cực / Hàng Long — long ảnh cuộn sóng
    for (let j = 0; j < 3; j++){ ctx.strokeStyle = j ? C2 : C1; ctx.lineWidth = 5 - j*1.3; ctx.globalAlpha = a*0.85; ctx.beginPath();
      for (let i = 0; i <= 20; i++){ const t = i/20; const xx = X - R*0.9 + t*R*1.8; const yy = Y + Math.sin(t*9 + j*1.3 + k*7)*R*0.28*(1 + t*0.4);
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
    _vxGlyph(X, Y - R*0.4, G, 30, C2, a*0.9);
  } else if (S === 'crescents'){ // Hồ Gia / Võ Đang — trăng lưỡi liềm chồng nhau
    for (let i = 0; i < 3; i++){ arc(X, Y, R*(0.35 + k*0.6) + i*14, F - 0.85, F + 0.85, i%2 ? C2 : C1, 6 - i*1.5, a*0.9); }
  } else if (S === 'petals'){ // Chiết Mai / Bích Ba — cánh hoa cuốn thành chưởng ấn
    for (let i = 0; i < 10; i++){ const ang = F + (i - 4.5)*0.19; const L = R*(0.2 + k*0.75)*(0.7 + ((i*53)%10)/20);
      _vxPetal(X + Math.cos(ang)*L, Y + Math.sin(ang)*L, ang + k*5, 5.5, i%2 ? C1 : C2, a*0.85); }
    _vxGlyph(X + Math.cos(F)*R*0.5, Y + Math.sin(F)*R*0.5, G, 22, C2, a*0.7);
  } else if (S === 'suns'){ // Lục Dương / Đả Cẩu — quang cầu li hoan quanh người
    for (let i = 0; i < 6; i++){ const aa = i*1.0472 + spin + k*4; const rr = R*(0.25 + k*0.55);
      const ox = X + Math.cos(aa)*rr, oy = Y + Math.sin(aa)*rr*0.8;
      disc(ox, oy, 9*(1-k) + 4, i%2 ? C1 : C2, a*0.9); disc(ox, oy, 3, '#fff', a); }
    arc(X, Y, R*(0.3 + k*0.65), 0, 7, C1, 3.5, a*0.6);
  } else if (S === 'hexa'){ // Bát Hoang / Bát Quái — trận đồ lục tinh
    const rr = R*(0.5 + k*0.35);
    poly(X, Y, rr, 3, spin, C1, 3.5, a*0.9); poly(X, Y, rr, 3, spin + Math.PI/3, C2, 3.5, a*0.9);
    for (let i = 0; i < 6; i++){ const aa = i*1.0472 + spin; disc(X + Math.cos(aa)*rr, Y + Math.sin(aa)*rr, 3.5, C2, a*0.8); }
    _vxGlyph(X, Y, G, 22, C1, a);
  } else if (S === 'bonemist'){ // Hóa Cốt — miên chưởng sương xương trắng xám
    for (let i = 0; i < 7; i++){ const ang = F + (i-3)*0.3; const L = R*(0.25 + k*0.6)*(0.8 + ((i*29)%10)/25);
      disc(X + Math.cos(ang)*L, Y + Math.sin(ang)*L, 10*(1-k) + 4, i%2 ? C1 : C2, a*0.4); }
    for (let i = 0; i < 3; i++){ const ang = F + (i-1)*0.5; ctx.strokeStyle = C2; ctx.lineWidth = 2.5; ctx.globalAlpha = a*0.8;
      _vxLine(X + Math.cos(ang)*R*0.2, Y + Math.sin(ang)*R*0.2, X + Math.cos(ang)*R*(0.4 + k*0.5), Y + Math.sin(ang)*R*(0.4 + k*0.5)); }
  } else if (S === 'vajra'){ // Kim Cang / Thái Cực Kiếm — kim cang phạn ấn quay
    poly(X, Y, R*(0.45 + k*0.2), 4, spin, C1, 4, a*0.9);
    poly(X, Y, R*(0.45 + k*0.2), 4, spin + Math.PI/4, C2, 2.5, a*0.7);
    disc(X, Y, 8, C2, a*0.8); _vxGlyph(X, Y, G, 22, C1, a);
  } else if (S === 'galaxy'){ // Thái Huyền / Vô Tướng — tinh hà vận chuyển
    for (let i = 0; i < 14; i++){ const aa = i*0.4488 + spin; const rr = R*(0.2 + ((i*31)%10)/10*0.7)*(0.6 + k*0.4);
      disc(X + Math.cos(aa)*rr, Y + Math.sin(aa)*rr, 1.8 + ((i*17)%3), i%3 ? C2 : C1, a*0.9); }
    arc(X, Y, R*0.5, spin, spin + 4.5, C1, 3, a*0.7);
    _vxGlyph(X, Y, G, 26, C2, a);
  } else if (S === 'demonburst'){ // Thiên Ma / Cáp Mô — ma hỏa phóng từ mặt đất
    for (let i = 0; i < 8; i++){ const aa = i*0.7854; const L = R*(0.35 + k*0.6)*(i%2 ? 1 : 0.7);
      ctx.fillStyle = i%2 ? C2 : C1; ctx.globalAlpha = a*0.85; ctx.beginPath();
      ctx.moveTo(X + Math.cos(aa - 0.14)*R*0.25, Y + Math.sin(aa - 0.14)*R*0.25);
      ctx.lineTo(X + Math.cos(aa)*L, Y + Math.sin(aa)*L);
      ctx.lineTo(X + Math.cos(aa + 0.14)*R*0.25, Y + Math.sin(aa + 0.14)*R*0.25); ctx.closePath(); ctx.fill(); }
    _vxGlyph(X, Y, G, 26, C2, a);
  } else if (S === 'devourmaw'){ // Phệ Thiên — ma khẩu thôn phệ
    disc(X, Y, R*(0.4 + k*0.15), C2, a*0.6);
    for (let i = 0; i < 10; i++){ const aa = i*0.628 + spin + k*3; const rr = R*(0.42 + k*0.1);
      const tx = X + Math.cos(aa)*rr, ty = Y + Math.sin(aa)*rr;
      ctx.fillStyle = '#fff'; ctx.globalAlpha = a*0.85; ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(aa + 0.3)*7, ty + Math.sin(aa + 0.3)*7); ctx.lineTo(tx + Math.cos(aa - 0.3)*7, ty + Math.sin(aa - 0.3)*7); ctx.closePath(); ctx.fill(); }
    arc(X, Y, R*(0.55 + k*0.15), spin, spin + 5, C1, 4, a*0.8);
  } else if (S === 'bloodclaw'){ // Huyết Ma / Cửu Âm Trảo / Tịch Tà — trảo huyết 3 nhát
    for (let i = 0; i < 3; i++){ const off = (i-1)*0.35; arc(X, Y, R*(0.4 + k*0.55) + i*12, F + off - 0.55, F + off + 0.55, i === 1 ? C2 : C1, 5, a*0.9); }
    for (let i = 0; i < 6; i++){ const ang = F + (i - 2.5)*0.4; const L = R*(0.3 + k*0.6); disc(X + Math.cos(ang)*L, Y + Math.sin(ang)*L, 2.5, C1, a*0.8); }
  } else if (S === 'swordride'){ // Ngự Kiếm — kiếm quang xé gió + tàn ảnh
    const x0 = e.x0 != null ? e.x0 : X, y0 = e.y0 != null ? e.y0 : Y;
    for (let i = 0; i < 3; i++){ const t = i/3; _vxSword(x0 + (X-x0)*t, y0 + (Y-y0)*t, F, 30, i ? C2 : C1, a*(1 - t*0.5)); }
    ctx.strokeStyle = C1; ctx.lineWidth = 6; ctx.globalAlpha = a*0.9; _vxLine(x0, y0, X, Y);
    ctx.strokeStyle = C2; ctx.lineWidth = 2; _vxLine(x0, y0, X, Y);
  } else if (S === 'wuxing'){ // Ngũ Hành / Thần Hành / Lăng Ba — ngũ sắc độn quang
    const x0 = e.x0 != null ? e.x0 : X, y0 = e.y0 != null ? e.y0 : Y;
    const cols = [C1, C2, '#ffd76a', '#8ae8c8', '#ff9ae0'];
    for (let i = 1; i <= 5; i++){ const t = i/5; arc(x0 + (X-x0)*t, y0 + (Y-y0)*t, 10 + 6*(1-k), F - 0.9, F + 0.9, cols[i-1], 4, a*0.85); }
  } else if (S === 'thunderpillar'){ // Cửu Thiên Huyền Lôi — lôi trụ giáng thế
    for (let i = 0; i < 3; i++){ const aa = F + i*2.094 + 0.5; const px = X + Math.cos(aa)*R*0.55, py = Y + Math.sin(aa)*R*0.55;
      _vxBolt(px, py - R*0.7, Math.PI/2, R*0.7, R*0.14, i%2 ? C2 : C1); }
    arc(X, Y, R*(0.3 + k*0.6), 0, 7, C1, 3, a*0.6);
  } else if (S === 'phoenix'){ // Hỏa Phượng / Thánh Hỏa — song dực liệt hỏa + tro lửa
    arc(X - R*0.25, Y, R*(0.3 + k*0.5), Math.PI*0.95, Math.PI*1.85, C1, 6, a*0.9);
    arc(X + R*0.25, Y, R*(0.3 + k*0.5), Math.PI*1.15, Math.PI*2.05, C1, 6, a*0.9);
    for (let i = 0; i < 10; i++){ const t = ((i*37)%10)/10; disc(X + Math.sin(i*2.3 + k*8)*R*0.4, Y + R*0.3 - t*R*(0.6 + k*0.4), 2.5, i%2 ? C1 : C2, a*0.8); }
    _vxGlyph(X, Y, G, 24, C2, a);
  } else if (S === 'icecage'){ // Huyền Băng — hàn khí kết tinh
    ctx.fillStyle = C2; ctx.globalAlpha = a*0.25; ctx.beginPath(); ctx.moveTo(X, Y); ctx.arc(X, Y, R*(0.4 + k*0.55), F - 0.9, F + 0.9); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++){ const ang = F + (i - 2.5)*0.3; const L = R*(0.3 + k*0.6); _vxFlake(X + Math.cos(ang)*L, Y + Math.sin(ang)*L, 6*(1-k) + 3, i%2 ? C1 : C2, a*0.9); }
  } else if (S === 'seal4'){ // Tứ Tượng — vuông ấn + tứ linh tứ phương
    poly(X, Y, R*(0.45 + k*0.25), 4, Math.PI/4, C1, 4, a*0.9);
    const bs = ['龍', '虎', '雀', '武'];
    for (let i = 0; i < 4; i++){ const aa = i*Math.PI/2 - Math.PI/2; _vxGlyph(X + Math.cos(aa)*R*0.5, Y + Math.sin(aa)*R*0.5, bs[i], 18, C2, a*(1 - k*0.5)); }
    disc(X, Y, 6, C1, a*0.9);
  } else if (S === 'icefield'){ // Băng Phong — băng nguyên phủ sóng
    disc(X, Y, R*(0.4 + k*0.6), C2, a*0.18);
    arc(X, Y, R*(0.4 + k*0.6), 0, 7, C1, 4, a*0.85);
    for (let i = 0; i < 8; i++){ const aa = i*0.7854 + 0.4; _vxFlake(X + Math.cos(aa)*R*(0.5 + k*0.4), Y + Math.sin(aa)*R*(0.5 + k*0.4), 5, i%2 ? C1 : C2, a*0.8); }
  } else if (S === 'stormhost'){ // Lôi Đình — vạn quân sấm tỏa
    for (let i = 0; i < 7; i++){ _vxBolt(X, Y, i*0.8976 + 0.3, R*(0.35 + k*0.6), R*0.1, i%2 ? C1 : C2); }
    arc(X, Y, R*0.4*(1 + k), 0, 7, C2, 2.5, a*0.5);
  } else if (S === 'buddhapalm'){ // Niết Bàn — phật chưởng giáng thế
    const pr = R*(0.4 + k*0.5);
    ctx.fillStyle = C1; ctx.globalAlpha = a*0.85;
    ctx.beginPath(); ctx.ellipse(X, Y, pr*0.42, pr*0.5, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 5; i++){ const fx = X + (i-2)*pr*0.2; const fl = pr*(0.34 + (i === 2 ? 0.12 : (i%2 ? 0.04 : 0)));
      ctx.beginPath(); ctx.ellipse(fx, Y - pr*0.5 - fl*0.5, pr*0.085, fl*0.55, 0, 0, 7); ctx.fill(); }
    _vxGlyph(X, Y, '卍', pr*0.5, C2, a);
  }
  ctx.restore();
}
function drawProjStyled(p){
  const s = p.style || 'dart', dx = Math.cos(p.ang), dy = Math.sin(p.ang);
  ctx.save(); ctx.lineCap = 'round';
  if (s === 'beam' || s === 'beam2'){ // chỉ lực / kiếm khí xuyên thấu
    const w = s === 'beam2' ? 8 : 5, L = s === 'beam2' ? 34 : 26;
    ctx.strokeStyle = p.color; ctx.lineWidth = w; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(p.x - dx*L, p.y - dy*L); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s === 'beam2' ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(p.x - dx*L*0.7, p.y - dy*L*0.7); ctx.lineTo(p.x, p.y); ctx.stroke();
  } else if (s === 'blade'){ // đao quang trăng lưỡi liềm
    ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x - dx*10, p.y - dy*10, 14, p.ang - 1.2, p.ang + 1.2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x - dx*10, p.y - dy*10, 10, p.ang - 1, p.ang + 1); ctx.stroke();
  } else if (s === 'shard'){ // mảnh băng/chỉ khí
    ctx.fillStyle = p.color; ctx.beginPath();
    ctx.moveTo(p.x + dx*10, p.y + dy*10); ctx.lineTo(p.x - dx*8 - dy*5, p.y - dy*8 + dx*5); ctx.lineTo(p.x - dx*8 + dy*5, p.y - dy*8 - dx*5); ctx.closePath(); ctx.fill();
  } else if (s === 'serpent'){ // kim xà uốn lượn
    ctx.strokeStyle = p.color; ctx.lineWidth = 3.5; ctx.beginPath();
    for (let i = 0; i <= 6; i++){ const t = i/6; const off = Math.sin(t*6 + (p.seed || 0))*7;
      const px = p.x - dx*26*t - dy*off, py = p.y - dy*26*t + dx*off; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
  } else if (s === 'note'){ // âm ba sưu hồn — vòng sóng âm
    ctx.strokeStyle = p.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 5 + ((p.seed || 0)%3), 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x - dx*12, p.y - dy*12, 3.5, 0, 7); ctx.stroke();
  } else if (s === 'sword'){ // phi kiếm
    _vxSword(p.x, p.y, p.ang, 24, p.color, 0.95);
  } else if (s === 'orb'){ // quang cầu
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    g.addColorStop(0, '#fff'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.fill();
  } else { // dart — kiểu cũ mặc định
    ctx.strokeStyle = p.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x - dx*16, p.y - dy*16); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function spawnSkillVfx(id, v, phase, ang, R, x0, y0){
  const c = FS_VFX[id] || VH_VFX[id] || SECT_VFX[id] || null;
  const col = v.color || '#f0d68a', c2 = (c && c.c2) || '#ffffff', glyph = v.glyph || '氣';
  const style = (c && c.style) || ({ cone:'crescents', cast:'flash', aoe:'suns', dash:'wuxing', buff:'vajra' })[phase] || 'flash';
  if (phase === 'cone'){
    addEffect({ type:'vfx', style, x:player.x, y:player.y, face:ang, r:R, c1:col, c2, glyph, dur:0.55, spin:(c && c.spin) || 0 });
    for (let i = 0; i < 5; i++) addEffect({ type:'ink', x:player.x + Math.cos(ang)*rnd(30,90), y:player.y + Math.sin(ang)*rnd(30,90), vx:rnd(-30,30), vy:rnd(-60,-10), color:c2 });
  } else if (phase === 'cast'){
    addEffect({ type:'vfx', style:'flash', x:player.x, y:player.y, face:ang, r:R, c1:col, c2, glyph, dur:0.4 });
  } else if (phase === 'aoe'){
    addEffect({ type:'vfx', style, x:player.x, y:player.y, face:ang, r:R, c1:col, c2, glyph, dur:0.7, big:true, spin:(c && c.spin) || 0 });
    addEffect({ type:'vfx', style:'shock', x:player.x, y:player.y, face:0, r:R, c1:col, c2, glyph, dur:0.5 });
  } else if (phase === 'dash'){
    addEffect({ type:'vfx', style, x:player.x, y:player.y, face:ang, r:R, c1:col, c2, glyph, dur:0.6, x0, y0 });
    addEffect({ type:'vfx', style:'shock', x:player.x, y:player.y, face:0, r:80, c1:col, c2, glyph, dur:0.45 });
  } else if (phase === 'buff'){
    addEffect({ type:'vfx', style, x:player.x, y:player.y, face:0, r:R, c1:col, c2, glyph, dur:1.0, big:true, spin:(c && c.spin) || 0 });
  }
}

function castVohoc(id){
  const v = VOHOC_DEFS[id] || FUSION_DEFS[id]; if (!v) return;
  const tierC = VH_TIER[v.tier].color, col = v.color || tierC;
  const fx = v.fx || {};
  const _mul = 1 + (player.skillDmgPct || 0);
  addFloat(player.x, player.y-46, `《${v.name}》`, col, 14);
  const hitMob = (m, mult) => {
    let dmg = player.atk * mult * _mul * rnd(0.92, 1.08);
    if (fx.pierce) dmg *= 1.3; // xuyên giáp
    const crit = Math.random() < player.crit;
    if (crit) dmg *= (player.critDmgMult || 2);
    hurtMob(m, Math.round(dmg), crit ? 'crit' : 'tp');
    if (m.dead) return;
    if (fx.stun){ m.stunT = Math.max(m.stunT || 0, fx.stun * (m.def.bossKind ? 0.4 : 1)); addFloat(m.x, m.y-m.def.size-24, 'CHOÁNG!', '#ffe9a8', 11); }
    if (fx.slow){ m.slowT = Math.max(m.slowT || 0, fx.slow.t); m.slowPct = 1 - fx.slow.pct; addFloat(m.x, m.y-m.def.size-24, 'CHẬM!', '#7ab0d8', 11); }
    if (fx.bleed){ m.bleedT = fx.bleed.t; m.bleedDps = Math.max(1, Math.round(player.atk * 0.35)); addFloat(m.x, m.y-m.def.size-24, 'CHẢY MÁU!', '#c03a4a', 11); }
    if (fx.kb) vhKnockback(m, Math.atan2(m.y - player.y, m.x - player.x), fx.kb);
  };
  if (v.type === 'cone'){
    const t = nearestMob(220);
    if (t) player.face = Math.atan2(t.y - player.y, t.x - player.x);
    const R = 135;
    spawnSkillVfx(id, v, 'cone', player.face, R);
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) >= R + m.def.size) continue;
      let da = Math.atan2(m.y - player.y, m.x - player.x) - player.face;
      while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI;
      if (Math.abs(da) < 1.05) hitMob(m, v.mult);
    }
    if (fx.selfEva){ player.vhEvaT = fx.selfEva.t; player.vhEvaPct = fx.selfEva.pct; addFloat(player.x, player.y-60, `+${fx.selfEva.pct}% né (${fx.selfEva.t}s)`, '#a0ffe9', 12); }
  }
  else if (v.type === 'proj'){
    const t = nearestMob(560);
    const base = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.face;
    player.face = base;
    const n = fx.multi || 1, spd = fx.speed || 540;
    const _vc = FS_VFX[id] || VH_VFX[id] || null;
    for (let i = 0; i < n; i++){
      const off = n > 1 ? (i - (n-1)/2) * 0.18 : 0;
      projectiles.push({ x:player.x, y:player.y, ang:base + off, speed:spd, dmg:player.atk * v.mult * _mul, kind:'skill', life:0.95, color:(_vc && _vc.rainbow) ? `hsl(${Math.round(i*360/Math.max(n,1))},85%,66%)` : col, pierce:!!fx.pierce, vhfx:fx, style:(_vc && _vc.proj) || undefined, seed:i });
    }
    spawnSkillVfx(id, v, 'cast', base, 56);
  }
  else if (v.type === 'aoe'){
    const R = fx.r || 160;
    spawnSkillVfx(id, v, 'aoe', player.face, R);
    shakeT = Math.max(shakeT, 0.2); shakeMag = Math.max(shakeMag, fx.big ? 7 : 4);
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) < R + m.def.size) hitMob(m, v.mult);
    }
  }
  else if (v.type === 'dash'){
    const t = nearestMob(240);
    const ang = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.face;
    player.face = ang;
    const D = fx.dist || 140;
    const _dx0 = player.x, _dy0 = player.y;
    player.x = clamp(player.x + Math.cos(ang)*D, 20, MAP.w-20);
    player.y = clamp(player.y + Math.sin(ang)*D, 20, MAP.h-20);
    spawnSkillVfx(id, v, 'dash', ang, D, _dx0, _dy0);
    if (fx.eva){ player.vhEvaT = fx.eva.t; player.vhEvaPct = fx.eva.pct; addFloat(player.x, player.y-60, `+${fx.eva.pct}% né (${fx.eva.t}s)`, '#a0ffe9', 12); }
    if (fx.strikeMult){ const t2 = nearestMob(120); if (t2) hitMob(t2, fx.strikeMult); }
  }
  else if (v.type === 'buff'){
    spawnSkillVfx(id, v, 'buff', 0, 95);
    if (fx.dmgPct){ player.vhDmgT = fx.t; player.vhDmgPct = fx.dmgPct; addFloat(player.x, player.y-60, `+${fx.dmgPct}% ST (${fx.t}s)`, col, 13); }
    if (fx.shieldPct){ player.vhShield = Math.round(player.maxHp * fx.shieldPct / 100); addFloat(player.x, player.y-60, `🛡 KHIÊN ${player.vhShield}`, '#8ad8c8', 13); }
    if (fx.reflect){ player.vhReflT = fx.t; addFloat(player.x, player.y-60, `PHẢN ĐÒN ${fx.t}s!`, col, 13); }
    if (fx.aspdPct){ player.vhAspdT = fx.t; player.vhAspdPct = fx.aspdPct; addFloat(player.x, player.y-60, `TỐC ĐÁNH +${fx.aspdPct}%`, col, 13); }
    if (fx.crit){ player.vhCritT = fx.t; addFloat(player.x, player.y-74, `BẠO KÍCH ${fx.t}s!`, '#ff6a5a', 13); }
    if (fx.leechPct){ player.vhLeechT = fx.t; addFloat(player.x, player.y-60, `HÚT SINH LỰC ${fx.t}s`, col, 13); }
    if (fx.resetCd){ for (const k in player.cd) player.cd[k] = 0; player.cd[id] = v.cd; addFloat(player.x, player.y-74, 'VÔ TƯỚNG — toàn bộ chiêu đã hồi!', '#b8e8ff', 13); }
    calcDerived();
  }
}

// ============================================================
// LỊCH TU TIÊN — đồng hồ thế giới kiểu Quỷ Cốc Bát Hoang + Tứ Quý
// 12 canh/ngày · 30 ngày/tháng · 3 tháng/mùa · 4 mùa/năm
// 1 ngày game = 10 phút thật → 1 tháng ≈ 5 giờ, 1 năm ≈ 20 giờ chơi
// ============================================================
const CANH_NAMES = ['Tý','Sửu','Dần','Mão','Thìn','Tỵ','Ngọ','Mùi','Thân','Dậu','Tuất','Hợi'];
const GT_DAY = 600; // giây thật cho 1 ngày game
const SEASONS = [
  { id:'xuan', name:'Xuân', icon:'🌸', color:'#f0a8c0', buffTxt:'+5% EXP',         amb:{ kind:'petal', color:'#f5b8cc', n:26 }, dawn:0.25, dusk:0.75 },
  { id:'ha',   name:'Hạ',   icon:'☀',  color:'#ffd76a', buffTxt:'+5% hồi Nội Lực', amb:{ kind:'rain',  color:'#9ec8e8', n:34 }, dawn:0.23, dusk:0.77 },
  { id:'thu',  name:'Thu',  icon:'🍂', color:'#e8944a', buffTxt:'+8% bạc rơi',      amb:{ kind:'leaf',  color:'#d87a3a', n:26 }, dawn:0.25, dusk:0.75 },
  { id:'dong', name:'Đông', icon:'❄',  color:'#bfe0f0', buffTxt:'+5% phòng thủ',    amb:{ kind:'snow',  color:'#eef4ff', n:32 }, dawn:0.27, dusk:0.73 },
];
function gameClock(){ if (!player.gt) player.gt = { t: GT_DAY*0.30 }; return player.gt; }
function gameTimeInfo(){
  const gt = gameClock();
  const totalDays = Math.floor(gt.t / GT_DAY);
  const year  = Math.floor(totalDays / 360) + 1;
  const doy   = totalDays % 360;
  const month = Math.floor(doy / 30) + 1;
  const day   = doy % 30 + 1;
  const frac  = (gt.t % GT_DAY) / GT_DAY;       // 0 = 0h, 0.5 = 12h
  const canh  = Math.floor(frac * 12) % 12;      // 12 canh giờ
  const season = SEASONS[Math.floor((month - 1) / 3)] || SEASONS[0];
  return { year, month, day, canh, frac, season };
}
function isNightGame(){
  const i = gameTimeInfo();
  return i.frac < i.season.dawn - 0.02 || i.frac > i.season.dusk + 0.02;
}
function skyDarkness(){ // 0 = trưa sáng, 1 = đêm khuya — mùa quyết định ngày dài/ngắn
  const i = gameTimeInfo(), f = i.frac, w = 0.06;
  const dawn = i.season.dawn, dusk = i.season.dusk;
  if (f >= dawn && f <= dusk) return 0;
  if (f > dusk && f < dusk + w) return (f - dusk)/w;
  if (f < dawn && f > dawn - w) return (dawn - f)/w;
  return 1;
}

// ---------- Thoi tiet dong theo Lich Tu Tien (Goi B) — roll theo NGAY, deterministic ----------
const WX_TABLE = {
  xuan:[['sun',0.55],['drizzle',0.30],['fog',0.15]],
  ha:  [['sun',0.45],['storm',0.35],['sunhot',0.20]],
  thu: [['sun',0.55],['fog',0.30],['drizzle',0.15]],
  dong:[['sun',0.40],['snow',0.42],['fog',0.18]],
};
const WX_INFO = {
  sun:{icon:'☀', name:'Nắng đẹp'}, sunhot:{icon:'🌞', name:'Nắng gắt'},
  drizzle:{icon:'🌦', name:'Mưa phùn'}, storm:{icon:'⛈', name:'Mưa rào giông'},
  fog:{icon:'🌫', name:'Sương mù'}, snow:{icon:'❄', name:'Tuyết rơi'},
};
function weatherNow(){
  if (typeof player === 'undefined' || !player || !player.gt) return null;
  if (!curMap || curMap.startsWith('pb_')) return null; // phó bản không có thời tiết
  const g = gameTimeInfo();
  const h = Math.abs(Math.sin((g.year*4096 + g.month*97 + g.day*13 + 7) * 12.9898) * 43758.5453) % 1;
  const tbl = WX_TABLE[g.season.id] || WX_TABLE.xuan;
  let acc = 0, pick = 'sun';
  for (const [id, w] of tbl){ acc += w; if (h <= acc){ pick = id; break; } }
  return Object.assign({ id: pick }, WX_INFO[pick]);
}
let wxFlashT = 0, wxLightningT = 9;
function tickWeather(dt){ // sấm chớp khi giông (Gói B)
  const wx = weatherNow();
  if (!wx || wx.id !== 'storm'){ wxFlashT = Math.max(0, wxFlashT - dt); return; }
  wxLightningT -= dt;
  if (wxLightningT <= 0){ wxFlashT = 0.22; wxLightningT = rnd(8, 20); }
  wxFlashT = Math.max(0, wxFlashT - dt);
}

// ---------- Tia nắng & đèn lồng (Gói C) — screen-space ----------
function drawSunRays(){
  const t = performance.now()/1000;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++){
    const bx = ((i*0.29 + t*0.008) % 1.3 - 0.15) * W;
    const g = ctx.createLinearGradient(bx, -40, bx + H*0.55, H);
    g.addColorStop(0, 'rgba(255,240,190,0.17)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx, -40); ctx.lineTo(bx + 60 + i*18, -40);
    ctx.lineTo(bx + H*0.55 + 150 + i*18, H); ctx.lineTo(bx + H*0.55, H);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawLanternGlow(dk){ // đèn lồng Tương Dương về đêm — neo tọa độ thế giới
  const t = performance.now()/1000;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 12; i++){
    const sx = ((Math.sin(i*37.7)*0.5+0.5) * 0.86 + 0.07) * MAP.w - camera.x;
    const sy = ((Math.sin(i*53.3+7)*0.5+0.5) * 0.80 + 0.10) * MAP.h - camera.y;
    if (sx < -80 || sx > W+80 || sy < -80 || sy > H+80) continue;
    const fl = 0.75 + 0.25*Math.sin(t*6 + i*1.7);
    const r = 62 * fl;
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
    g.addColorStop(0, 'rgba(255,178,80,' + (0.44*dk*fl).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(255,140,50,' + (0.18*dk*fl).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,140,50,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,130,' + (0.85*dk).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- Vùng nước theo map (tỉ lệ ảnh nền) — gợn sóng + lấp lánh (Gói F) ----------
const WATER_ZONES = {
  daohoa:    [ {fx:0.13, fy:0.20, frx:0.09, fry:0.10}, {fx:0.86, fy:0.24, frx:0.10, fry:0.11}, {fx:0.14, fy:0.82, frx:0.10, fry:0.11}, {fx:0.83, fy:0.80, frx:0.11, fry:0.12} ],
  tuyettinh: [ {fx:0.30, fy:0.33, frx:0.07, fry:0.05}, {fx:0.42, fy:0.45, frx:0.09, fry:0.06}, {fx:0.58, fy:0.66, frx:0.10, fry:0.07}, {fx:0.74, fy:0.88, frx:0.11, fry:0.08} ],
};
function drawWaterFx(){
  if (SETTINGS.lowFx) return;
  const zs = WATER_ZONES[curMap]; if (!zs) return;
  const t = performance.now()/1000;
  ctx.save();
  for (const z of zs){
    const zx = z.fx*MAP.w, zy = z.fy*MAP.h, zrx = z.frx*MAP.w, zry = z.fry*MAP.h;
    if (zx + zrx < camera.x || zx - zrx > camera.x+W || zy + zry < camera.y || zy - zry > camera.y+H) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.ellipse(zx, zy, zrx, zry, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 3; i++){
      const ph = ((t*0.35 + i/3) % 1);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.16*(1-ph)).toFixed(3) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(zx + Math.sin(t*0.6+i*2)*14, zy + Math.cos(t*0.5+i)*10, zrx*ph*0.9+6, zry*ph*0.9+4, 0, 0, 7); ctx.stroke();
    }
    for (let i = 0; i < 5; i++){
      const sx2 = zx + Math.sin(i*37.3 + zx)*zrx*0.7, sy2 = zy + Math.cos(i*51.7 + zy)*zry*0.6;
      const tw = Math.abs(Math.sin(t*2.2 + i*1.9));
      ctx.strokeStyle = 'rgba(255,255,240,' + (0.28*tw).toFixed(3) + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx2-7*tw, sy2); ctx.lineTo(sx2+7*tw, sy2); ctx.stroke();
    }
  }
  ctx.restore();
}

function tickGameClock(dt){
  const before = gameTimeInfo();
  player.gt.t += dt;
  const after = gameTimeInfo();
  if (after.season.id !== before.season.id || after.year !== before.year){
    calcDerived(); spawnAmbients();
    if (after.season.id !== before.season.id)
      zoneBanner = { text:`${after.season.icon} ${after.season.name.toUpperCase()} ĐẾN`, sub:`Tháng ${after.month} · Năm ${after.year} — phúc trạch Tứ Quý: ${after.season.buffTxt}`, color:after.season.color, t:4 };
    else
      zoneBanner = { text:`✦ THIÊN NIÊN KỶ — NĂM ${after.year}`, sub:'Giang hồ lại trôi qua một vòng tuế nguyệt', color:'#f0d68a', t:4 };
    AudioSys.sfx('quest', 0.6);
  } else if (after.canh !== before.canh) calcDerived(); // qua canh: nhịp ngày/đêm đổi
  if (after.day !== before.day || after.month !== before.month) spawnAmbients(); // sang ngày mới: roll lại thời tiết (Gói B)
}
function seasonAmbientCfg(cfg){ // hạt mùa phủ lên map ngoài trời — phó bản giữ than hồng
  if (typeof player === 'undefined' || !player || !player.gt) return cfg;
  if (curMap && curMap.startsWith('pb_')) return cfg;
  const sa = gameTimeInfo().season.amb;
  return { kind: sa.kind, color: sa.color, n: Math.max(cfg.n, sa.n) };
}
function drawSkyOverlay(){ // screen-space — gọi sau vignette, trước zone banner
  if (!player || !player.gt) return;
  const gti = gameTimeInfo();
  const dk = skyDarkness();
  if (dk > 0){ // đêm xanh mực, khuya có ánh trăng nhạt
    ctx.fillStyle = `rgba(8,10,32,${(0.36*dk).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    if (dk > 0.85){ ctx.fillStyle = `rgba(150,170,255,${(0.05*dk).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (gti.frac > gti.season.dusk - 0.05 && gti.frac < gti.season.dusk + 0.06){ // hoàng hôn cam
    const k = 1 - Math.abs(gti.frac - gti.season.dusk)/0.06;
    ctx.fillStyle = `rgba(255,130,50,${(0.14*Math.max(0,k)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  }
  if (gti.frac > gti.season.dawn - 0.06 && gti.frac < gti.season.dawn + 0.05){ // bình minh vàng nhạt
    const k2 = 1 - Math.abs(gti.frac - gti.season.dawn)/0.06;
    ctx.fillStyle = `rgba(255,200,110,${(0.10*Math.max(0,k2)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  }
  if (dk === 0 && gti.season.id === 'ha'){ ctx.fillStyle = 'rgba(255,225,130,0.06)'; ctx.fillRect(0, 0, W, H); }   // nắng hạ gắt
  if (dk === 0 && gti.season.id === 'dong'){ ctx.fillStyle = 'rgba(190,215,240,0.05)'; ctx.fillRect(0, 0, W, H); } // trời đông lạnh
  // ── Thời tiết động (Gói B) ──
  const wx = weatherNow();
  if (wx){
    if (wx.id === 'storm' || wx.id === 'drizzle'){ ctx.fillStyle = 'rgba(26,34,52,' + (wx.id === 'storm' ? 0.16 : 0.09) + ')'; ctx.fillRect(0, 0, W, H); }
    else if (wx.id === 'snow'){ ctx.fillStyle = 'rgba(225,235,245,0.07)'; ctx.fillRect(0, 0, W, H); }
    else if (wx.id === 'sunhot' && dk === 0){ ctx.fillStyle = 'rgba(255,214,120,0.08)'; ctx.fillRect(0, 0, W, H); }
    if (wx.id === 'fog'){
      ctx.fillStyle = 'rgba(214,216,210,0.10)'; ctx.fillRect(0, 0, W, H);
      if (!SETTINGS.lowFx){
        const ft = performance.now()/1000;
        for (let i = 0; i < 3; i++){
          const fx0 = ((ft*16 + i*470) % (W + 800)) - 400, fy0 = H*(0.22 + i*0.26);
          const fg = ctx.createRadialGradient(fx0, fy0, 0, fx0, fy0, 360);
          fg.addColorStop(0, 'rgba(226,228,220,0.15)'); fg.addColorStop(1, 'rgba(226,228,220,0)');
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx0, fy0, 360, 0, 7); ctx.fill();
        }
      }
    }
    if (wxFlashT > 0){ ctx.fillStyle = 'rgba(235,240,255,' + Math.min(0.5, wxFlashT*2.6).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); } // chớp giông
  }
  // ── Ánh sáng động (Gói C) ──
  if (dk === 0 && !SETTINGS.lowFx && (!wx || wx.id === 'sun' || wx.id === 'sunhot')) drawSunRays();
  if (dk > 0.15 && curMap === 'tuongduong' && !SETTINGS.lowFx && typeof camera !== 'undefined') drawLanternGlow(dk);
}

function skillInfo(id){
  const sect = SECTS[player.sect];
  const d = SKILL_DEFS[id];
  if (!d) return null;
  const out = { id, icon: typeof d.icon==='function' ? d.icon(player.sect) : d.icon, desc: typeof d.desc==='function' ? d.desc(sect) : d.desc };
  if (d.kind==='sectA'){ out.name = sect.skillA.name; out.cd = sect.skillA.cd; out.qi = sect.skillA.qi; }
  else if (d.kind==='sectTP'){ out.name = sect.tp.name; out.cd = TP_CD; out.qi = player.level < 20 ? Math.round(TP_QI*0.7) : TP_QI; } // tân thủ <20: trấn phái -30% chân khí
  else if (d.kind==='vh'){ const _v = VOHOC_DEFS[id] || FUSION_DEFS[id]; out.name = _v.name; out.cd = _v.cd; out.qi = _v.qi; }
  else { out.name = d.name; out.cd = d.cd; out.qi = d.qi; }
  out.unlocked = player.level >= d.unlock && (!d.req || d.req());
  out.lockTxt = player.level < d.unlock ? `Mở khóa ở cấp ${d.unlock}` : (d.reqTxt || '');
  if (out.cd != null) out.cd = Math.min(1, out.cd); // GDD mới: mọi chiêu hồi 0-1s — sức mạnh dồn vào cấp kỹ năng 1-120
  return out;
}

// ---------- Thú Chiến: 8-giai chiến thú đồng hành ----------
// Không cưỡi — chiến thú đi theo và tự tấn công quái quanh người chơi.
// Upgrade = spend silver + Tinh Thạch, roll against success rate; fail keeps tier.
const MOUNT_TIERS = [ null,
  { name:'Bạch Mã',    img:'assets/mounts/1_hacma.png',    color:'#d8d8d8', dmg:12,  str:2,  agi:2,  def:0,  vit:2,  hp:0,    crit:0, qireg:0, reqLv:5,  cost:{silver:200,   mat:2},   rate:100 },
  { name:'Ô Tôn',      img:'assets/mounts/2_hoangma.png',  color:'#6a6a75', dmg:20,  str:4,  agi:4,  def:2,  vit:4,  hp:80,   crit:0, qireg:0, reqLv:10, cost:{silver:500,   mat:5},   rate:90 },
  { name:'Đích Lô',    img:'assets/mounts/3_satlang.png',  color:'#7ab0d8', dmg:32,  str:8,  agi:8,  def:2,  vit:4,  hp:120,  crit:3, qireg:0, reqLv:20, cost:{silver:1100,  mat:10},  rate:80 },
  { name:'Xích Thố',   img:'assets/mounts/6_viembao.png',  color:'#d84a2a', dmg:50,  str:14, agi:10, def:6,  vit:8,  hp:300,  crit:3, qireg:0, reqLv:30, cost:{silver:2200,  mat:18},  rate:70 },
  { name:'Bạch Hổ',    img:'assets/mounts/4_thanho.png',   color:'#e8e8e8', dmg:75,  str:22, agi:10, def:14, vit:16, hp:450,  crit:4, qireg:1, reqLv:40, cost:{silver:3800,  mat:30},  rate:60 },
  { name:'Kim Sư',     img:'assets/mounts/5_sutu.png',     color:'#b8862e', dmg:105, str:26, agi:28, def:14, vit:16, hp:600,  crit:6, qireg:1, reqLv:55, cost:{silver:6500,  mat:48},  rate:50 },
  { name:'Hỏa Kỳ Lân', img:'assets/mounts/7_kylan.png',   color:'#e86a2a', dmg:145, str:35, agi:35, def:35, vit:35, hp:900,  crit:6, qireg:3, reqLv:70, cost:{silver:10000, mat:75},  rate:40 },
  { name:'Thanh Long', img:'assets/mounts/8_longlan.png', color:'#e8c84a', dmg:200, str:55, agi:55, def:55, vit:55, hp:1500, crit:8, qireg:6, reqLv:85, cost:{silver:15000, mat:110}, rate:30 },
];
const MOUNT_IMGS = {};
for (let i=1;i<MOUNT_TIERS.length;i++){
  const im = new Image(); im.src = MOUNT_TIERS[i].img; MOUNT_IMGS[i] = im;
}

// ---------- Sect art (portraits + skill icons) ----------
const SECT_ART = {
  thieulam: { portrait:'assets/sects/thieulam.png', iconA:'assets/skills/tl_a.png', iconTP:'assets/skills/tl_tp.png' },
  toanchan: { portrait:'assets/sects/toanchan.png', iconA:'assets/skills/tc_a.png', iconTP:'assets/skills/tc_tp.png' },
  comoc:    { portrait:'assets/sects/comoc.png',    iconA:'assets/skills/cm_a.png', iconTP:'assets/skills/cm_tp.png' },
  baidasan: { portrait:'assets/sects/baidasan.png', iconA:'assets/skills/bd_a.png', iconTP:'assets/skills/bd_tp.png' },
  minhgiao: { portrait:'assets/sects/minhgiao.png', iconA:'assets/skills/mg_a.png', iconTP:'assets/skills/mg_tp.png' },
  doanthi:  { portrait:'assets/sects/doanthi.png',  iconA:'assets/skills/dt_a.png', iconTP:'assets/skills/dt_tp.png' },
  daohoa:   { portrait:'assets/sects/daohoa.png',   iconA:'assets/skills/dh_a.png', iconTP:'assets/skills/dh_tp.png' },
  vophai:   { portrait:'assets/sects/vophai.png',   iconA:'assets/skills/slash.png', iconTP:'assets/skills/basic.png' },
};
const SECT_IMGS = {};
for (const k in SECT_ART){ const im = new Image(); im.src = SECT_ART[k].portrait; SECT_IMGS[k] = im; }
// Phi Thăng: sprite 3D tiên nhân (nam/nữ × 6 skin) — vẽ sẵn, nền trong suốt
const TIEN_IMGS = {};
for (const g of ['nam','nu']) for (const sk of ['bach','thanh','kim','huyen','hong','lam']){
  const im = new Image(); im.src = 'assets/tien/' + g + '_' + sk + '.png'; TIEN_IMGS[g + '_' + sk] = im;
}
// Sprite tán tu Nhân Mạch — mỗi (phái, giới) một hình 3D riêng, cố định theo NPC
const TT_IMGS = {};
for (const g of ['nam','nu']) for (const ph in SECTS){
  const im = new Image(); im.src = 'assets/tantu/' + ph + '_' + g + '.png'; TT_IMGS[ph + '_' + g] = im;
}
function ttImg(n){ const im = TT_IMGS[n.phai + '_' + n.gender]; return (im && im.complete && im.naturalWidth) ? im : null; }

// ---------- Đan Điền: cultivation realms (Đột Phá upgrades) ----------
// Bonus values are TOTAL at that realm. Đột phá consumes Tu Vi + silver + mats;
// on failure: silver/mats lost, 50% Tu Vi lost, realm kept.
const REALM_ICONS = ['r0_phan_nhan','r1_khi_hai','r2_chu_thien','r3_tu_phu','r4_quy_nguyen','r5_luong_nghi','r6_thai_hu','r7_tien_thien','r8_hon_nguyen','r8_hon_nguyen'];
// GDD Lấy Võ Nhập Đạo §3 — Giai đoạn 1: cảnh giới tu tiên.
// Luyện Khí (1-4): đột phá vận công theo tỉ lệ. Trúc Cơ trở lên (5-9): LÔI KIẾP 3-9 đợt thiên lôi,
// mỗi tia gây % maxHP, thất bại mất 30% Tu Vi tiến độ — KHÔNG tụt cảnh giới.
const DANTIAN_REALMS = [
  { name:'Phàm Nhân',            atk:0,    hp:0,    qireg:0,  cost:null },
  { name:'Luyện Khí · Tầng 1',   atk:0.05, hp:0.05, qireg:1,  cost:{tuvi:150,   silver:300,   mat:3},   rate:100 },
  { name:'Luyện Khí · Tầng 2',   atk:0.10, hp:0.10, qireg:2,  cost:{tuvi:400,   silver:700,   mat:6},   rate:85 },
  { name:'Luyện Khí · Tầng 3',   atk:0.16, hp:0.16, qireg:3,  cost:{tuvi:900,   silver:1400,  mat:15},  rate:70 },
  { name:'Luyện Khí · Tầng 4',   atk:0.24, hp:0.24, qireg:4,  cost:{tuvi:1800,  silver:2600,  mat:24},  rate:55, unlock:'Đạn Chỉ Thần Thông (5% phong mạch đối thủ)' },
  { name:'Trúc Cơ Cảnh',         atk:0.35, hp:0.35, qireg:5,  cost:{tuvi:3600,  silver:5000,  mat:42},  trib:3, unlock:'Thái Cực hộ thể — phản 5% sát thương' },
  { name:'Kim Đan Cảnh',         atk:0.45, hp:0.45, qireg:6,  cost:{tuvi:6000,  silver:8000,  mat:55},  trib:4, unlock:'Ám Nhiên Tiêu Hồn Chưởng' },
  { name:'Nguyên Anh · Trung Kỳ',atk:0.55, hp:0.55, qireg:7,  cost:{tuvi:9000,  silver:12000, mat:80},  trib:6, unlock:'Lăng Ba Vi Bộ (nhảy 2 lần trên không)' },
  { name:'Nguyên Anh · Hậu Kỳ',  atk:0.70, hp:0.70, qireg:8,  cost:{tuvi:13000, silver:18000, mat:110}, trib:8, unlock:'Bất Tử — chặn 1 đòn chí mạng, hồi 30% HP (180s)' },
  { name:'Hóa Thần Cảnh',        atk:0.88, hp:0.88, qireg:10, cost:{tuvi:20000, silver:28000, mat:160}, trib:9, unlock:'Hóa Thần — nhục thân thăng hoa, toàn thuộc tính vượt cực hạn' },
];

// ═══════════ TRACK HT (GDD §13) — trang bị MU Online S2 phong cách kiếm hiệp ═══════════
// Tứ Tượng Cổ Thần: 5 món/bộ (Nón/Giáp/Tay/Quần/Giày) — CHỈ mở từ Bảo Hạp, không pity.
// Hiệu ứng bộ ẨN — người chơi tự khám phá khi mặc đủ 2/3/5 món.
const ANCIENT_SETS = {
  thanhlong: { name:'Thanh Long', color:'#3ac88a',
    b2:{ atkPct:10 }, b3:{ critDmg:20 }, b5:{ aspdPct:8, hpLeech:3 },
    hint:'gió xanh cuồn cuộn — công kích cuồng bạo' },
  bachho:    { name:'Bạch Hổ', color:'#e8e8f0',
    b2:{ crit:6 }, b3:{ atkPct:8 }, b5:{ pierce:10, perfect:5 },
    hint:'sát khí trắng toát — xuyên phá hộ thể' },
  chutuoc:   { name:'Chu Tước', color:'#ff6a3a',
    b2:{ hpPct:10 }, b3:{ reflectPct:8 }, b5:{ dmgred:8, hpPct:6 },
    hint:'hỏa diễm thiêu đốt — sinh mệnh bền bỉ' },
  huyenvu:   { name:'Huyền Vũ', color:'#5aa0e8',
    b2:{ dmgred:6 }, b3:{ hpPct:12 }, b5:{ evaPct:8, reflectPct:5 },
    hint:'quy xà hộ thể — phòng ngự tuyệt đối' },
};
// Tứ Châu: ◎ Chúc Phúc (+1..+6 miễn phí 100%) · ◉ Linh Hồn (+1 bất kỳ, 50%, xịt tụt 1)
//          ❤ Sinh Mệnh (+4%→+28% HP theo bậc, xịt về 0) · ● Hỗn Độn (luyện Linh Dực / đổi Cổ Thần)
const JEWEL_NAMES = { chucPhuc:'◎ Chúc Phúc Châu', linhHon:'◉ Linh Hồn Châu', sinhMenh:'❤ Sinh Mệnh Châu', honDon:'● Hỗn Độn Châu' };
const JEWEL_COLORS = { chucPhuc:'#7ec850', linhHon:'#b08ae8', sinhMenh:'#e84a6a', honDon:'#f0d68a' };
// Bảo Hạp 7 tầng — rơi từ Ma Tôn Giáng Thế (4 giờ/lần). Cổ Thần chỉ từ tầng IV+, 5-8%, KHÔNG pity.
const BAOHAP_TIERS = [ null,
  { name:'Bảo Hạp I',   min:1,  max:14,  ancient:0,    color:'#b8a878' },
  { name:'Bảo Hạp II',  min:15, max:29,  ancient:0,    color:'#7ec850' },
  { name:'Bảo Hạp III', min:30, max:44,  ancient:0,    color:'#5aa0e8' },
  { name:'Bảo Hạp IV',  min:45, max:59,  ancient:0.05, color:'#b08ae8' },
  { name:'Bảo Hạp V',   min:60, max:74,  ancient:0.06, color:'#e8b04a' },
  { name:'Bảo Hạp VI',  min:75, max:89,  ancient:0.07, color:'#ff6a3a' },
  { name:'Bảo Hạp VII', min:90, max:999, ancient:0.08, color:'#f0d68a' },
];
// Ma Tôn Giáng Thế: 0h/4h/8h/12h/16h/20h — Hạ Giới & Thượng Giới luân phiên
const MATON_HA = ['daohoa','ngoai','chungnam'];
const MATON_THUONG = ['comoc','tuyettinh','mongco','nhanmon'];
// Truy Nã Lệnh — boss săn ngày theo vùng cấp (NPC Bổ Đầu · Tương Dương)
const TRUYNA_BANDS = [
  { max:14,  map:'daohoa',    name:'Hắc Phong Phân Đà Chủ' },
  { max:29,  map:'ngoai',     name:'Sơn Tặc Đại Đầu Mục' },
  { max:44,  map:'chungnam',  name:'Toàn Chân Phản Đồ Thủ Lĩnh' },
  { max:59,  map:'comoc',     name:'Cổ Mộ Thi Vương' },
  { max:74,  map:'tuyettinh', name:'Tình Hoa Độc Yêu Vương' },
  { max:89,  map:'mongco',    name:'Mông Cổ Tàn Tướng' },
  { max:999, map:'nhanmon',   name:'Đột Quyết Sát Thần' },
];
// Vạn Duyên Các — gacha NPC Thần Toán Tử: 5% bí kíp hiếm / 15% châu / 25% trang bị / 30% vật liệu / 25% bạc·tu vi (KHÔNG pity)
const VANDUYEN_RATES = [ { k:'bikip', w:5 }, { k:'chau', w:15 }, { k:'trangbi', w:25 }, { k:'vatlieu', w:30 }, { k:'bac', w:25 } ];
// ---------- Hệ thống mới theo GDD Dream of Wuxia ----------
// Kinh Mạch: 8 mạch × 20 đốt, tiêu hao Chân Khí (tích lũy thụ động)
const MERIDIANS = [
  { id:'thaiam',   name:'Thái Âm Mạch',  stat:'hp',    per:40,  color:'#e8e8e8', label:'Sinh Lực', img:'k0_thaiam'},
  { id:'thieuduong',name:'Thiếu Dương Mạch', stat:'qi', per:6,   color:'#5db86a', label:'Nội Lực', img:'k1_thieuduong'},
  { id:'thaiduong',name:'Thái Dương Mạch', stat:'atk',  per:3,   color:'#5aa0e8', label:'Tấn Công', img:'k2_thaiduong'},
  { id:'thieuam',  name:'Thiếu Âm Mạch', stat:'def',   per:3,   color:'#b08ae8', label:'Phòng Thủ', img:'k3_thieuam'},
  { id:'duongminh',name:'Dương Minh Mạch', stat:'eva', per:0.4, color:'#e8c84a', label:'Né Tránh', img:'k4_duongminh'},
  { id:'quyetam',  name:'Quyết Âm Mạch', stat:'crit',  per:0.4, color:'#e84a3a', label:'Bạo Kích', img:'k5_quyetam'},
  { id:'nham',     name:'Nhâm Mạch',     stat:'aspd',  per:0.4, color:'#3a9d8b', label:'Tốc Độ Đánh', img:'k6_nham'},
  { id:'doc',      name:'Đốc Mạch',      stat:'all',   per:1,   color:'#f0d68a', label:'Toàn Thuộc Tính', img:'k7_doc'},
];
// Ám Khí 7 tầng (điểm Chúc Phúc: đập xịt +1, đủ 10 điểm chắc chắn thành công)
const AMKHI_TIERS = [ null,
  { name:'Tinh Thiết Tiêu', color:'#5db86a', crit:2, eff:'Độc: 10% gây 500 ST/s trong 3s' },
  { name:'Mai Hoa Châm',    color:'#d8d8e8', crit:3, eff:'Làm chậm: 25% giảm 35% tốc chạy địch 2s' },
  { name:'Xuyên Tâm Đao',   color:'#b06ae8', crit:4, eff:'Phá Huyệt: phá hộ thể tinh anh/boss' },
  { name:'Phù Dung Nhẫn',   color:'#e0779a', crit:5, eff:'Thiên Hủ Độc: độc mạnh gấp đôi' },
  { name:'Diệt Hồn Sa',     color:'#c0b090', crit:6, eff:'Mù Lòa: 12% khiến địch đánh trượt 2s' },
  { name:'Khổng Tước Linh', color:'#3a9d8b', crit:8, eff:'Vạn Độc: độc lan AoE quanh mục tiêu' },
  { name:'Bạo Vũ Lê Hoa',   color:'#f0d68a', crit:10, eff:'Quỷ Kiến Sầu: 3% kết liễu địch dưới 20% HP' },
];
// Cung Tiễn 7 tầng — vũ khí phụ trợ lơ lửng sau lưng (mở ở cấp 30)
const BOW_TIERS = [ null,
  { name:'Linh Mộc Cung',    color:'#8ab86a', crit:3, pierce:0,    proc:12, pdmg:0.5 },
  { name:'Tinh Thiết Cung',  color:'#c0c8d8', crit:5, pierce:0.02, proc:14, pdmg:0.55 },
  { name:'Phá Phong Cung',   color:'#7ab0d8', crit:7, pierce:0.04, proc:16, pdmg:0.6 },
  { name:'Xuyên Vân Cung',   color:'#5aa0e8', crit:9, pierce:0.06, proc:18, pdmg:0.7, double:0.08 },
  { name:'Lạc Nhật Cung',    color:'#e8552a', crit:11, pierce:0.08, proc:20, pdmg:0.8, burn:true },
  { name:'Kinh Lôi Cung',    color:'#e8c84a', crit:13, pierce:0.10, proc:22, pdmg:0.9, stun:0.05 },
  { name:'Tru Tiên Thần Cung', color:'#f0d68a', crit:16, pierce:0.14, proc:26, pdmg:1.1, double:0.12, stun:0.06, burn:true },
];
// Cương Khí 7 tầng — kháng ám khí / giải khống chế, mỗi tầng kháng 20% hiệu ứng ám khí
const GANGKHI_TIERS = [ null,
  { name:'Sơ Nguyên Khí',     color:'#e8e8e8', hp:0.05, def:0.04 },
  { name:'Lăng Ba Khí',       color:'#5db86a', hp:0.08, def:0.07 },
  { name:'Kim Chung Trạo',    color:'#c9a227', hp:0.12, def:0.10 },
  { name:'Lưu Ly Hộ Thể',     color:'#7ab0d8', hp:0.16, def:0.14 },
  { name:'Thái Cực Chân Khí', color:'#3a9d8b', hp:0.21, def:0.18 },
  { name:'Vô Tướng Thần Công', color:'#b08ae8', hp:0.27, def:0.23 },
  { name:'Bất Diệt Kim Thân', color:'#f0d68a', hp:0.35, def:0.30 },
];
// Danh hiệu — chỉ số cộng dồn vĩnh viễn, chọn 1 để hiển thị
const TITLES = [
  { id:'sonhap',  name:'Sơ Nhập Giang Hồ',    color:'#7ec850', cond:p=>p.level>=30,              desc:'Đạt cấp 30',           stats:{hp:500},        vfx:'' },
  { id:'bachtram',name:'Bách Quái Trảm',      color:'#d8d8d8', cond:p=>p.kills>=100,             desc:'Tiêu diệt 100 quái',   stats:{atkPct:0.05},   vfx:'' },
  { id:'thientram',name:'Thiên Quái Trảm',    color:'#e84a3a', cond:p=>p.kills>=1000,            desc:'Tiêu diệt 1.000 quái', stats:{crit:10},       vfx:'máu' },
  { id:'thoren',  name:'Thợ Rèn Truyền Thuyết', color:'#5aa0e8', cond:p=>p.forged11,             desc:'Rèn thành công +11',   stats:{forgeRate:5},   vfx:'lửa' },
  { id:'honnguyen',name:'Nguyên Anh Chân Quân', color:'#f0d68a', cond:p=>p.dantian.realm>=8,     desc:'Đan Điền cảnh 8 (Nguyên Anh Hậu Kỳ)', stats:{allPct:0.10}, vfx:'long' },
  { id:'hoathan', name:'Hóa Thần Chân Nhân',   color:'#fff2b0', cond:p=>p.dantian.realm>=9,     desc:'Độ kiếp thành Hóa Thần', stats:{allPct:0.15},   vfx:'long' },
  { id:'tuongduong',name:'Tương Dương Đệ Nhất Hiệp', color:'#ffd76a', cond:p=>p.dantian.realm>=8 && p.mount.tier>=8 && p.level>=60, desc:'Đỉnh cao mọi hệ thống', stats:{allPct:0.15}, vfx:'long' },
];
const TAN_QUYEN = ['Thượng','Trung','Hạ']; // Mảnh bí kíp Huyết Ma Thôn Phệ (boss drop)

const QUESTS = [
  { id:1, lv:1, name:'Gõ Cửa Giang Hồ',  desc:'Tán nhân mới vào đời — đến bái kiến Quách Đại Hiệp giữa thành Tương Dương để ghi danh giang hồ.',
    type:'talk', targetNpc:'quachtinh', need:1, rew:{xp:130, silver:50} },
  { id:2, lv:2, name:'Thử Tài Tân Thủ', desc:'Quách Đại Hiệp muốn thử bản lĩnh ngươi — về Đào Hoa Đảo (bản đồ M → Dịch Chuyển) diệt 5 Dã Trư đang quấy phá làng Thanh Ngưu, rồi báo lại cho Trưởng Làng.',
    type:'kill', mob:'boar', need:5, rew:{xp:190, silver:60} },
  { id:3, lv:3, name:'Thảo Dược Cứu Người', desc:'Trưởng Làng Thanh Ngưu cần 4 Thảo Dược trong rừng phía đông đảo để chữa bệnh cho dân làng.',
    type:'collect', need:4, rew:{xp:360, silver:90} },
  { id:4, lv:4, name:'Sói Dữ Quấy Phá', desc:'Bầy Tàn Lang trong rừng ngày càng hung hãn. Diệt 6 con để bảo vệ người đi rừng.',
    type:'kill', mob:'wolf', need:6, rew:{xp:470, silver:110, mat:3, item:'vukhi'} },
  { id:5, lv:5, name:'Rèn Luyện Sơ Nhập', desc:'Mang trang bị đến lò rèn (phím F) và Tăng Cường một món bất kỳ lên +3.',
    type:'enhance', need:3, rew:{xp:520, silver:130, mat:3} }, // P0: lò rèn mở ở cấp 4 — NV4 thưởng sẵn vũ khí + 3 huyền thiết để rèn ngay
  { id:6, lv:6, name:'Sơn Tặc Hoành Hành', desc:'Sơn tặc trên đồi phía nam cướp bóc khách qua đường. Diệt 8 tên.',
    type:'kill', mob:'bandit', need:8, rew:{xp:1200, silver:170} }, // QA bot: tăng XP giữ nhịp cấp với chuỗi NV
  { id:7, lv:7, name:'Tĩnh Tâm Nhập Định', desc:'Đến Tịnh Tâm Tuyền cạnh làng, đứng trong suối tĩnh tâm 8 giây để ngưng tụ Chân Khí.',
    type:'meditate', need:8, rew:{xp:920, mat:3} },
  { id:8, lv:8, name:'Điểm Huyệt Phá Thế', desc:'Hắc Phong Sát ẩn trong rừng có hộ thể chân khí — sát thương thường giảm 70%. Dùng Ám Khí (phím 2) điểm huyệt phá thế rồi tiêu diệt hắn.',
    type:'kill', mob:'assassin', need:1, rew:{xp:1900, silver:220} }, // QA bot: tăng XP giữ nhịp cấp
  { id:9, lv:9, name:'Trấn Phái Truyền Thừa', desc:'Chưởng môn truyền thụ Trấn Phái (phím 3). Dùng tuyệt chiêu này kết liễu 5 Sơn Tặc.',
    type:'tpkill', mob:'bandit', need:5, rew:{xp:1600, silver:320} },
  { id:10, lv:10, name:'Bình Cảnh Chi Chiến', desc:'Hắc Phong Sát Thủ đã xuất hiện tại đài phía đông. Đánh bại hắn để đột phá Bình Cảnh!',
    type:'boss', mob:'boss', need:1, rew:{xp:2500, silver:500} },
];

// ---------- State ----------
let player = null;
let mobs = [], pickups = [], projectiles = [], effects = [], floats = [], decor = [], mists = [];
let questIdx = 0, questProg = 0, questState = 'none'; // none | active | done | all
let springTimer = 0, victory = false, dead = false;
let camera = { x:0, y:0 };
// Feel mượt (kiểu VLTK Mobile): hit-stop khựng hình khi chém trúng, camera bám có gia tốc
// (lắc màn hình dùng hệ thống shakeT/shakeMag có sẵn — áp dụng trong render)
let hitStop = 0;
function snapCamera(){
  if (!player) return;
  camera.x = clamp(player.x - W/2, 0, Math.max(0, MAP.w - W));
  camera.y = clamp(player.y - H/2, 0, Math.max(0, MAP.h - H));
}
function lerpAng(a, b, t){ // nội suy góc theo đường ngắn nhất (tránh xoay ngược vòng)
  let d = (b - a) % (Math.PI*2);
  if (d > Math.PI) d -= Math.PI*2; else if (d < -Math.PI) d += Math.PI*2;
  return a + d*t;
}
let shakeT = 0, shakeMag = 0; // rung màn hình khi bị đánh trúng
let keys = {};
let joyVec = { x:0, y:0 };
let mouseWorld = { x:0, y:0 };
let lastTime = performance.now();
let saveTimer = 0;

const SPRING = { x: 500, y: 620, r: 70 };
const NPC = { x: 400, y: 400, name:'Trưởng Làng' };
const BOSS_ARENA = { x: 2300, y: 500 };

const ZONES = [
  { mob:'boar',    x: 800,  y: 520, r: 260, count: 6 },
  { mob:'boar',    x: 1000, y: 1000, r: 240, count: 5 },
  { mob:'wolf',    x: 1650, y: 700,  r: 300, count: 7 },
  { mob:'wolf',    x: 1400, y: 1400, r: 260, count: 6 },
  { mob:'bandit',  x: 800,  y: 1550, r: 260, count: 7 },
  { mob:'bandit',  x: 2050, y: 1250, r: 280, count: 7 },
  { mob:'assassin',x: 1900, y: 420,  r: 140, count: 1 }, // P0: cụm 1 con (trước 2 — NV8 thành bức tường ở cấp 6)
];
// QA bot playtest: NV3 (cấp 3) bắt nhặt thảo dược giữa bầy Tàn Lang (cấp 3) & Trận Nhân (cấp 9)
// khiến tân thủ chết liên tục — dời bụi thuốc về rừng phía đông GẦN làng, ngoài tầm aggro của cụm quái mạnh
const HERB_SPOTS = [
  { x:620, y:560 }, { x:760, y:700 }, { x:950, y:640 }, { x:1080, y:820 },
  { x:900, y:1180 }, { x:1200, y:900 }, { x:1350, y:1050 }, { x:1550, y:950 },
];

// ---------- Item generation ----------
let itemSeq = 1;
function rollRarity(bias){
  let pool = RARITIES.map((r,i)=>({ i, w: Math.max(0.1, r.w * (1 + bias * i * 0.35)) }));
  let tot = pool.reduce((s,p)=>s+p.w,0), roll = Math.random()*tot;
  for (const p of pool){ roll -= p.w; if (roll <= 0) return p.i; }
  return 0;
}
// Cấp trang bị: mỗi 10 level = 1 cấp, tổng 10 cấp (cánh/áo choàng/pet ngoài hệ này)
function itemTier(level){ return clamp(Math.ceil(level / 10), 1, 10); }
function itemReqLv(it){ return it.tier ? (it.tier - 1) * 10 + 1 : (it.cloakTier === 2 ? 60 : 1); }
function subName(k){
  return { atkPct:'Thêm Sát Thương', pierce:'Xuyên Giáp', defPct:'Phòng Ngự', hpPct:'Sinh Lực Tối Đa',
           qiPct:'Nội Lực Tối Đa', evaPct:'Tránh Đòn', silverPct:'Đồng Rơi Thêm', reflectPct:'Phản Sát Thương',
           dmgred:'Giảm Sát Thương', perfect:'ST Hoàn Hảo', hpLeech:'Hút Sinh Lực', qiLeech:'Hút Nội Lực',
           aspdPct:'Tốc Độ Đánh', expPct:'EXP Thêm', crit:'Bạo Kích' }[k] || k;
}
function genItem(level, bias, srcK){
  const dropSlots = SLOTS.filter(s => !s.special);
  const slot = dropSlots[Math.floor(Math.random()*dropSlots.length)];
  // Drop v2.0: nguồn boss/tinh anh dùng bảng phẳng — xóa bias lv/10 thổi phồng Chí Tôn
  const r = srcK ? rollRaritySrc(srcK) : rollRarity(bias || 0);
  const tier = itemTier(level);
  const ilvl = (tier-1)*10 + Math.ceil(Math.random()*10);
  const armorGroup = ARMOR_SLOTS.includes(slot.id);
  const perfect = armorGroup && Math.random() < (srcK ? DROP_SRC[srcK].perfect : 0.08 + (bias||0)*0.06); // Hoàn Hảo: quái thường không roll
  const pool = (armorGroup ? ARMOR_SUBS : WEAPON_SUBS).slice();
  const nSubs = Math.min(pool.length, perfect ? 4 : RARITY_SUBS[r]);
  const subs = [];
  for (let i = 0; i < nSubs; i++){
    const idx = Math.floor(Math.random()*pool.length);
    const def = pool.splice(idx,1)[0];
    const v = (perfect || def.fixed) ? def.max : Math.round((def.min + Math.random()*(def.max-def.min))*10)/10;
    subs.push({ k:def.k, name:def.name, v, pct:true });
  }
  // Vận (Luck) — chỉ xuất hiện khi rơi, không rèn được: +5% ST bạo kích/món, +5% tỉ lệ rèn (tối đa +25%)
  const luck = Math.random() < 0.06 + r*0.025 + (srcK ? 0 : (bias||0)*0.04);
  return {
    uid: itemSeq++, slot: slot.id, slotName: slot.name,
    name: (perfect ? 'Hoàn Hảo ' : '') + ITEM_NAMES[slot.id][r],
    rarity: r, level: ilvl, tier, perfect, luck, life: 0, ancient: null,
    main: { k: slot.main, v: slot.base(tier, r), name: mainName(slot.main) },
    element: ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)],
    subs, plus: 0,
    awakened: AWAKENED[Math.floor(Math.random()*AWAKENED.length)],
  };
}
// Cổ Thần (Tứ Tượng) — chỉ mở từ Bảo Hạp: giáp Thần cấp 4 dòng Hoàn Hảo + ấn bộ ẩn
function genAncient(setId, slotId, level){
  const set = ANCIENT_SETS[setId];
  const slot = SLOTS.find(s => s.id === slotId);
  const r = 4, tier = itemTier(level);
  const ilvl = (tier-1)*10 + 10;
  const pool = ARMOR_SUBS.slice();
  const subs = [];
  for (let i = 0; i < 4; i++){
    const idx = Math.floor(Math.random()*pool.length);
    const def = pool.splice(idx,1)[0];
    subs.push({ k:def.k, name:def.name, v:def.max, pct:true });
  }
  return {
    uid: itemSeq++, slot: slot.id, slotName: slot.name,
    name: set.name + ' · ' + ITEM_NAMES[slot.id][r],
    rarity: r, level: ilvl, tier, perfect: true, luck: Math.random() < 0.1, life: 0, ancient: setId,
    main: { k: slot.main, v: slot.base(tier, r), name: mainName(slot.main) },
    element: ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)],
    subs, plus: 0,
    awakened: AWAKENED[Math.floor(Math.random()*AWAKENED.length)],
  };
}
// Trang bị đặc biệt (Áo Choàng / Pet / Cánh): chỉ số cố định, không rèn
function specialItem(slot, def, extra){
  const subs = [];
  for (const k in def){
    if (['atkPct','pierce','defPct','hpPct','evaPct','silverPct','expPct','hpLeech','crit','aspdPct'].includes(k))
      subs.push({ k, name: subName(k), v: def[k], pct: true });
  }
  return Object.assign({
    uid: itemSeq++, slot, slotName: (SLOTS.find(s=>s.id===slot) || {}).name || slot,
    name: def.name, rarity: 4, level: 1, tier: 0, special: true, noForge: true,
    main: null, element: 'Kim', subs, plus: 0, awakened: AWAKENED[0],
  }, extra || {});
}
function genCloak(t){ return specialItem('aochoang', CLOAK_TIERS[t], { cloakTier: t }); }
function genPet(i){ return specialItem('pet', PET_DEFS[i], { pet: PET_DEFS[i].id }); }
function genWing(i){ return specialItem('canh', WING_DEFS[i], { wing: WING_DEFS[i].id }); }
function mainName(k){
  return { atk:'Công Kích', def:'Phòng Ngự', vit:'Sinh Lực', str:'Lực Lượng',
           agi:'Mẫn Tiệp', hp:'Sinh Lực tối đa', crit:'Bạo Kích %', qireg:'Hồi Chân Khí' }[k] || k;
}
function itemPower(it){
  const m = 1 + it.plus * 0.08;
  let p = it.main ? it.main.v * m * 10 : 0;
  for (const s of it.subs) p += s.pct ? s.v * 22 : s.v * 8;
  if (it.plus >= 10) p += it.awakened.v * 12;
  return Math.round(p);
}

// ---------- GDD Đợt 2 B6/B7: giá bán theo Lực chiến · bán lẻ · tự mặc đồ ----------
function itemSellPrice(it){ return 20 + (it.tier || 1)*15 + it.rarity*40 + Math.round(itemPower(it)*0.8); }
window.sellItem = function(i){
  const it = player.inv[i];
  if (!it) return;
  const precious = it.rarity >= 2 || it.perfect || it.ancient; // xác nhận 2 lớp với đồ quý
  if (precious && window._sellArm !== i){
    window._sellArm = i;
    addFloat(player.x, player.y-40, `Bấm Bán lần nữa để xác nhận bán ${it.name}`, '#ffb066', 12);
    AudioSys.sfx('ui', 0.4);
    return;
  }
  window._sellArm = -1;
  const v = itemSellPrice(it);
  player.silver += v; player.inv.splice(i, 1);
  addFloat(player.x, player.y-40, `Bán ${it.name} +${v}◈`, '#f0d68a', 12);
  AudioSys.sfx('quest', 0.3);
  if (window.bagSel >= player.inv.length) window.bagSel = -1;
  try{ renderInv(); renderBag(); }catch(e){}
  saveGame();
};
// B7: tự mặc đồ mạnh hơn khi nhặt — ≥105% lực chiến, đồ quý (Hoàn Hảo/Cổ Thần/☘Vận) cần ≥115%
function tryAutoEquip(it){
  if (!player.autoEquip || !it.slot || it.special) return;
  if (player.level < itemReqLv(it)) return;
  const cur = player.equip[it.slot];
  const cp = cur ? itemPower(cur) : 0, np = itemPower(it);
  if (np < Math.max(cp*1.05, cp + 1)) return;
  if (cur && (cur.perfect || cur.ancient || cur.luck) && np < cp*1.15) return;
  const idx = player.inv.indexOf(it);
  if (idx < 0) return;
  player.inv.splice(idx, 1);
  if (cur) player.inv.push(cur);
  player.equip[it.slot] = it;
  addFloat(player.x, player.y-62, `⚡ Tự mặc ${it.name} (+${np-cp} LC)`, '#6ae88a', 12);
  calcDerived();
};
window.autoEquipBest = function(){
  let swapped = 0, gained = 0;
  for (const sl of SLOTS){
    let bi = -1, bp = player.equip[sl.id] ? itemPower(player.equip[sl.id]) : 0;
    for (let i2 = 0; i2 < player.inv.length; i2++){
      const it2 = player.inv[i2];
      if (it2.slot !== sl.id || it2.special || player.level < itemReqLv(it2)) continue;
      const p2 = itemPower(it2);
      if (p2 > bp){ bp = p2; bi = i2; }
    }
    if (bi >= 0){
      const it2 = player.inv[bi];
      gained += bp - (player.equip[sl.id] ? itemPower(player.equip[sl.id]) : 0);
      player.inv.splice(bi, 1);
      if (player.equip[sl.id]) player.inv.push(player.equip[sl.id]);
      player.equip[sl.id] = it2;
      swapped++;
    }
  }
  calcDerived(); try{ renderInv(); renderBag(); }catch(e){} saveGame();
  addFloat(player.x, player.y-56, swapped ? `⚡ Mặc đồ tốt nhất: thay ${swapped} món, +${gained} lực chiến!` : 'Trang bị đã tối ưu!', swapped ? '#6ae88a' : '#8a8a8a', 14);
  AudioSys.sfx('quest', 0.5);
};
window.toggleAutoEquip = function(v){ player.autoEquip = v; saveGame(); };

// ---------- Derived stats ----------
// ---------- THẦN BINH MÔN PHÁI (GDD §5) ----------
// Vũ khí danh tính theo phái — lơ lửng theo người, 10 tầng, buff chiêu môn phái.
const THANBINH = {
  vophai:   { name:'Túy Tiên Hồ Lô',      kind:'holu',   color:'#c8a86a', lore:'Hồ lô rượu lang bạt — Tứ Hải Giai Phục' },
  thieulam: { name:'Kim Cương Quyền',     kind:'quyen',  color:'#e8c84a', lore:'Quyền sáo bọc kim — Thiếu Lâm quyền cước' },
  toanchan: { name:'Thất Tinh Cổ Kiếm',   kind:'kiem',   color:'#9fd0ff', lore:'Kiếm khí chính tông, bảy sao hội tụ' },
  comoc:    { name:'Ngọc Nữ Thiết Quạt',  kind:'quat',   color:'#b08ae8', lore:'Quạt sắt xuất quỷ nhập thần' },
  daohoa:   { name:'Lạc Anh Thần Thương', kind:'thuong', color:'#ffb7c5', lore:'Thương ra hoa rụng, địch thủ vẫn lạc' },
  baidasan: { name:'Linh Xà Trượng',      kind:'truong', color:'#7fe0a8', lore:'Xà trượng ngậm độc của Bạch Đà Sơn' },
  minhgiao: { name:'Thánh Hỏa Đao',       kind:'dao',    color:'#ff9a5a', lore:'Thánh Hỏa Lệnh — đao lửa phần nguyên' },
  doanthi:  { name:'Phật Châu Niệm',      kind:'chau',   color:'#e8d8a8', lore:'Tràng hạt phật môn, chỉ lực ngưng tụ' },
};
const TB_MAX_TIER = 10;
const TB_TIER_NAMES = ['Luyện Khí','Trúc Cơ','Kết Đan','Nguyên Anh','Hóa Thần','Luyện Hư','Hợp Thể','Đại Thừa','Độ Kiếp','Thức Tỉnh'];
const TB_TIER_COLORS = ['#9a7a4a','#9a7a4a','#9a7a4a','#c8c8d8','#c8c8d8','#c8c8d8','#f0d68a','#f0d68a','#f0d68a','#ffe9a8'];
function tbCost(t){ return { noidan: t*2, mat: t*15 }; } // nâng từ tầng t → t+1
function tbDef(){ return THANBINH[player.sect] || THANBINH.vophai; }
function tbNoidanTotal(){ let n = 0; for (const e in (player.noidan || {})) n += player.noidan[e] || 0; return n; }
function tbConsumeNoidan(n){ // trừ dần từ hành đang có nhiều nhất
  const els = ['Kim','Mộc','Thổ','Thủy','Hỏa'].sort((a,b)=>((player.noidan[b]||0)-(player.noidan[a]||0)));
  for (const e of els){ if (n <= 0) break; const take = Math.min(player.noidan[e] || 0, n); player.noidan[e] -= take; n -= take; }
}
window.upgradeThanBinh = function(){
  if (!player) return;
  const tb = player.thanbinh;
  if (tb.tier >= TB_MAX_TIER){ addFloat(player.x, player.y-56, 'Thần Binh đã THỨC TỈNH — tối đa!', '#ffe9a8', 13); return; }
  const c = tbCost(tb.tier);
  if (tbNoidanTotal() < c.noidan || player.mat < c.mat){
    addFloat(player.x, player.y-56, `Thiếu nguyên liệu: cần ${c.noidan} Nội Đan + ${c.mat} Tinh Thạch`, '#ff9a6a', 12);
    AudioSys.sfx('ui', 0.4); return;
  }
  tbConsumeNoidan(c.noidan); player.mat -= c.mat;
  tb.tier++;
  calcDerived();
  const def = tbDef();
  addFloat(player.x, player.y-64, `⚔ ${def.name} — tầng ${tb.tier}【${TB_TIER_NAMES[tb.tier-1]}】`, TB_TIER_COLORS[tb.tier-1], 15);
  addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:def.color, big:true });
  addEffect({ type:'ring', x:player.x, y:player.y, r:55, color:TB_TIER_COLORS[tb.tier-1], big:true });
  AudioSys.sfx('levelup', 0.8);
  saveGame();
  if (!el('panel-char').classList.contains('hidden')) renderCharPanel();
};

function calcDerived(){
  const b = SECTS[player.sect].bonus;
  const s = { str:player.str+b.str, agi:player.agi+b.agi, def:player.def+b.def, vit:player.vit+b.vit };
  // P: tích lũy từ trang bị — flat + chỉ số % theo GDD
  const P = { atk:8 + player.level*2, hp:0, crit:0, eva:0, qireg:0,
    hpPct:0, qiPct:0, atkPct:0, dmgred:0, evaPct:0, silverPct:0, reflectPct:0,
    perfect:0, hpLeech:0, qiLeech:0, aspdPct:0, pierce:0, expPct:0, defPct:0, critDmg:0 };
  let luckN = 0;
  const setCount = {};
  for (const slotId in player.equip){
    const it = player.equip[slotId];
    if (!it) continue;
    const m = 1 + it.plus * 0.08;
    if (it.main) applyLine(s, it.main.k, it.main.v * m, P);
    for (const sub of it.subs) applyLine(s, sub.k, sub.k === 'perfect' ? sub.v : sub.v * m, P);
    if (it.plus >= 10 && it.awakened) applyLine(s, it.awakened.k, it.awakened.v, P);
    if (it.luck){ luckN++; P.critDmg += 5; }                 // Vận: +5% ST bạo/món
    if (it.life) P.hpPct += it.life * 4;                     // Sinh Mệnh: +4% HP/bậc (tối đa +28%)
    if (it.ancient && ANCIENT_SETS[it.ancient]) setCount[it.ancient] = (setCount[it.ancient] || 0) + 1;
  }
  // Tứ Tượng Cổ Thần — hiệu ứng bộ ẩn kích hoạt ở 2/3/5 món
  player.setActive = {};
  for (const sid in setCount){
    const n = setCount[sid], set = ANCIENT_SETS[sid];
    const act = [];
    if (n >= 2 && set.b2){ for (const k in set.b2) (P[k] !== undefined ? P[k] += set.b2[k] : 0); act.push(2); }
    if (n >= 3 && set.b3){ for (const k in set.b3) (P[k] !== undefined ? P[k] += set.b3[k] : 0); act.push(3); }
    if (n >= 5 && set.b5){ for (const k in set.b5) (P[k] !== undefined ? P[k] += set.b5[k] : 0); act.push(5); }
    player.setActive[sid] = { n, act };
  }
  // Thú Chiến gia trì (always active once owned — the beast's blessing)
  const mt = MOUNT_TIERS[(player.mount && player.mount.tier) || 0];
  if (mt){
    s.str += mt.str; s.agi += mt.agi; s.def += mt.def; s.vit += mt.vit;
    P.hp += mt.hp; P.crit += mt.crit; P.qireg += mt.qireg;
  }
  // Thần Binh môn phái: mỗi tầng +chỉ số nhỏ; %ST chiêu môn phái (tbDmg) áp trong castSkill
  const tbTier = (player.thanbinh && player.thanbinh.tier) || 0;
  if (tbTier > 0){ s.str += tbTier*3; s.agi += tbTier*2; s.def += tbTier*2; s.vit += tbTier*3; }
  player.tbDmg = tbTier * 0.025;
  // Đan Điền realm multipliers (8 cảnh giới)
  const realm = Math.min((player.dantian && player.dantian.realm) || 0, DANTIAN_REALMS.length - 1);
  const dr = DANTIAN_REALMS[realm];
  player.dStr = s.str; player.dAgi = s.agi; player.dDef = s.def; player.dVit = s.vit;
  player.atk = Math.round((P.atk + s.str * 2) * (1 + dr.atk));
  player.maxHp = Math.round((100 + player.level*15 + s.vit*12 + P.hp) * (1 + dr.hp));
  player.maxQi = 50 + player.level*5;
  player.crit = Math.min(0.45, s.agi*0.003 + P.crit/100);
  // Cương Khí aura: +HP% +DEF%
  const gk = GANGKHI_TIERS[(player.gangkhi && player.gangkhi.tier) || 0];
  if (gk){ P.hp += Math.round((100 + player.level*15) * gk.hp); s.def += Math.round(s.def * gk.def); }
  // Cung Tiễn: +bạo kích + xuyên giáp
  const bw = BOW_TIERS[(player.bow && player.bow.tier) || 0];
  if (bw) P.crit += bw.crit;
  // Kinh Mạch bonuses
  let merAtk = 0, merHp = 0, merDef = 0, merCrit = 0, merEva = 0, merAspd = 0, merQi = 0;
  if (player.meridians){
    for (const md of MERIDIANS){
      const n = player.meridians[md.id] || 0;
      if (!n) continue;
      if (md.stat==='hp') merHp += n * md.per;
      else if (md.stat==='qi') merQi += n * md.per;
      else if (md.stat==='atk') merAtk += n * md.per;
      else if (md.stat==='def') merDef += n * md.per;
      else if (md.stat==='eva') merEva += n * md.per;
      else if (md.stat==='crit') merCrit += n * md.per;
      else if (md.stat==='aspd') merAspd += n * md.per;
      else if (md.stat==='all'){ merAtk += n*2; merHp += n*25; merDef += n*2; merCrit += n*0.3; }
    }
  }
  player.eva  = Math.min(0.40, s.agi*0.0025 + P.eva/100 + merEva/100);
  player.aspd = Math.max(0.30, 0.85 - s.agi*0.004 - merAspd/100);
  player.defRed = s.def/(s.def + 60);
  player.qireg = 4 + P.qireg + dr.qireg; // GDD Đợt 2 B1: hồi cơ bản 2.5 -> 4.0
  // Lăng Ba Vi Bộ (Tiên Thiên Cảnh, tầng 7): nhảy 2 lần trên không + thân pháp +10%
  player.canJump = realm >= 7;
  player.maxJumps = realm >= 7 ? 2 : 1;
  player.speed = Math.round(190 * (realm >= 7 ? 1.10 : 1));
  if (player.ascended) player.speed = Math.round(player.speed * 1.25); // Phi Thăng: ngự kiếm phi hành
  // ── Võ Học Phổ: tâm pháp bị động ──
  player.vhCdMult = 1; player.vhRegen = 0; player.vhPoisonRes = 0;
  if (player.vohoc){
    const VH = player.vohoc;
    if (VH.tlnoicong){ P.hpPct += 12; P.defPct += 8; }
    if (VH.dichcankinh){ player.vhRegen = 0.008; player.vhPoisonRes = 0.5; }
    if (VH.taytykinh) player.vhCdMult = 0.7;
    if (VH.thaikhacong) player.qireg += 4;
    if (VH.tieusi){ player.speed = Math.round(player.speed * 1.12); player.eva = Math.min(0.5, player.eva + 0.05); }
    if (VH.ngocnu){ P.aspdPct += 10; P.evaPct += 8; }
    if (VH.cuuamkinh){ P.atkPct += 8; P.defPct += 8; P.hpPct += 8; }
    if (VH.cuuduongkinh){ player.vhPoisonRes = Math.max(player.vhPoisonRes, 0.7); P.hpPct += 5; }
    // Tán Tu gia truyền (Luận Đạo — Nhân Mạch)
    if (VH.tp_xuantam) P.expPct += 10;
    if (VH.tp_linhcam) P.evaPct += 8;
    if (VH.tp_vanhanh) player.qireg += 4;
    if (VH.tp_thietbo) P.defPct += 10;
    if (VH.tp_thuathien) P.silverPct += 15;
    if (VH.tp_bachhop) player.vhRegen += 0.004;
    if (VH.tp_hoigiang) P.atkPct += 10;
    if (VH.tp_nhatnguyet) P.aspdPct += 6;
    if (VH.tp_thancong) P.crit += 8;
    if (VH.tp_votuong) P.qiPct += 15;
    if (VH.tp_lietdiem) P.critDmg += 12;
    if (VH.tp_huyenamtp) player.vhPoisonRes = Math.max(player.vhPoisonRes, 0.6);
  }
  // ── Nhân Mạch: buff theo quan hệ ──
  if (player.relations){
    let _kb = 0;
    for (const _rid in player.relations){
      const _rb = player.relations[_rid].bond;
      if (_rb === 'ketbai') _kb++;
      else if (_rb === 'daolu'){ player.qireg *= 1.08; P.hpPct += 5; }   // Đạo lữ song tu
      else if (_rb === 'suphu') P.expPct += 10;                          // Sư phụ chỉ điểm
    }
    if (_kb) P.atkPct += Math.min(_kb, 5) * 2;                           // Kết bái: +2% ST/người (tối đa 5)
  }
  // Đan điền passives: Quy Nguyên (t4) phong mạch, Lưỡng Nghi (t5) phản đòn, Hỗn Nguyên (t8) bất tử
  player.stunProc = realm >= 4 ? 0.05 : 0;
  player.reflect = realm >= 5 ? 0.05 : 0;
  player.batTu = realm >= 8;
  player.atk = Math.round(player.atk + merAtk);
  player.maxHp = Math.round(player.maxHp + merHp);
  player.dDef = s.def + merDef;
  player.crit = Math.min(0.60, player.crit + merCrit/100);
  player.maxQi += merQi;
  // Danh hiệu: chỉ số cộng dồn từ TẤT CẢ danh hiệu đã mở khóa
  let tAtkPct = 0, tAllPct = 0, tHp = 0, tCrit = 0, tForge = 0;
  for (const t of TITLES){
    if (!player.titles.unlocked.includes(t.id)) continue;
    if (t.stats.hp) tHp += t.stats.hp;
    if (t.stats.atkPct) tAtkPct += t.stats.atkPct;
    if (t.stats.crit) tCrit += t.stats.crit;
    if (t.stats.allPct) tAllPct += t.stats.allPct;
    if (t.stats.forgeRate) tForge += t.stats.forgeRate;
  }
  player.forgeBonus = tForge + Math.min(25, luckN * 5); // Vận: +5% tỉ lệ rèn/món, tối đa +25%
  player.luckN = luckN;
  player.critDmgMult = 2 + P.critDmg/100; // Vận + bộ Cổ Thần: sát thương bạo kích ×2 → ×2.x
  player.atk = Math.round(player.atk * (1 + tAtkPct + tAllPct));
  player.maxHp = Math.round((player.maxHp + tHp) * (1 + tAllPct));
  player.crit = Math.min(0.65, player.crit + tCrit/100);
  // Chỉ số % từ trang bị theo GDD (áp cuối, nhân/cộng độc lập)
  player.maxHp = Math.round(player.maxHp * (1 + P.hpPct/100));
  player.maxQi = Math.round(player.maxQi * (1 + P.qiPct/100));
  player.atk = Math.round(player.atk * (1 + P.atkPct/100));
  player.defRed = Math.min(0.78, player.defRed + P.dmgred/100 + P.defPct/100);
  player.eva = Math.min(0.45, player.eva + P.evaPct/100);
  player.aspd = Math.max(0.25, player.aspd * (1 - P.aspdPct/100));
  player.reflect = (player.reflect || 0) + P.reflectPct/100;
  player.pierce = (bw ? bw.pierce : 0) + P.pierce/100;
  player.silverPct = P.silverPct;
  player.expPct = P.expPct;
  // Lịch Tu Tiên: phúc trạch Tứ Quý
  if (player.gt){
    const _gti = gameTimeInfo();
    player.seasonId = _gti.season.id;
    if (_gti.season.id === 'xuan') player.expPct += 5;
    else if (_gti.season.id === 'ha') player.qireg *= 1.05;
    else if (_gti.season.id === 'thu') player.silverPct += 8;
    else if (_gti.season.id === 'dong') player.defRed = Math.min(0.80, player.defRed + 0.05);
  }
  if (player.level < 20) player.qireg *= 1.5; // tân thủ hồi chân khí nhanh hơn — đỡ chết nhịp farm đầu game
  player.perfectProc = Math.min(0.5, P.perfect/100);
  player.hpLeech = P.hpLeech/100;
  player.qiLeech = P.qiLeech/100;
  // ── Quẻ Tiên Thiên: reset rồi áp trait (mọi hiệu ứng trait đều qua đây) ──
  player.dropBonus = 0; player.amkhiPct = 0; player.shieldBonus = 0; player.traitSatTam = false;
  player.potionPct = 0.4; player.skillDmgPct = 0; player.traitRevive = false; player.traitMerRate = 1; player.traitHerb = false;
  if (player.traits) for (const tid of player.traits){
    const tr = TRAITS.find(t => t.id === tid);
    if (tr && tr.late) tr.late(player);
  }
  // Nội Đan thôn phệ — chỉ số vĩnh viễn cộng thẳng
  const ndB = player.ndBonus || {};
  if (ndB.atk) player.atk += ndB.atk;
  if (ndB.hp) player.maxHp += ndB.hp;
  if (ndB.qi) player.maxQi += ndB.qi;
  if (ndB.def) player.defRed = Math.min(0.78, player.defRed + ndB.def*0.002);
  if (ndB.crit) player.crit = Math.min(0.65, player.crit + ndB.crit/100);
  if (player.maDao) player.atk = Math.round(player.atk * 1.15); // Sa Đọa — ma công tà ác
  if ((player.buffAtkT || 0) > 0) player.atk = Math.round(player.atk * 1.12); // Rượu Hổ Cốt
  // Võ Học Phổ: buff chủ động
  if ((player.vhDmgT || 0) > 0) player.atk = Math.round(player.atk * (1 + (player.vhDmgPct || 0)/100));
  if ((player.vhCritT || 0) > 0) player.crit = 1; // Tịch Tà Kiếm Pháp
  if ((player.vhEvaT || 0) > 0) player.eva = Math.min(1, player.eva + (player.vhEvaPct || 0)/100);
  if ((player.vhAspdT || 0) > 0) player.aspd = Math.max(0.2, player.aspd * (1 - (player.vhAspdPct || 0)/100));
  if ((player.vhReflT || 0) > 0) player.reflect = (player.reflect || 0) + 1; // Cáp Mô Công: phản 100%
  player.hp = Math.min(player.hp, player.maxHp);
  player.qi = Math.min(player.qi, player.maxQi);
}
function applyLine(s, k, v, P){
  if (k==='str'||k==='agi'||k==='def'||k==='vit') s[k] += Math.round(v);
  else if (P && k in P) P[k] += v;
}

// ---------- New game / save ----------
let sideStates = {}; // { [id]: { st:'active'|'done'|'claimed', prog } } — khai báo sớm để quick-start (?sect=) không dính TDZ
function newPlayer(sectKey){
  const sect = SECTS[sectKey];
  player = {
    sect: sectKey, x: 1300, y: 1040, face: 0,  // xuất phát: Tương Dương Thành, gần Quách Đại Hiệp
    level: 1, xp: 0, str: 5, agi: 5, def: 5, vit: 5, free: 0,
    hp: 130, qi: 55, silver: 30, mat: 0,
    equip: {}, inv: [], cd: { basic:0, a:0, amkhi:0, tp:0, jump:0 },
    skillBar: ['a','amkhi','tp',null,null],   // taskbar 5 ô kỹ năng
    pk: false, toiac: 0, toiacT: 0,           // PK & Tội Ác (đỏ tên)
    gkBuffT: 0, poisonT: 0, autoSell: false,
    autoCfg: { skill:true, potion:true, potionPct:40, range:430, boss:false }, // Cài đặt Auto Farm (panel O)
    vohoc: {}, bikipVH: 0,
    skillLv: {},                                 // cấp từng kỹ năng 1-120                       // Võ Học Phổ: võ học đã học + Bí Kíp
    tenuiTT: 0,                                    // Té Núi: hết hạn Trọng Thương (timestamp)
    gt: { t: GT_DAY*0.30 },                          // Lịch Tu Tiên: đồng hồ thế giới (giây game) — mở màn canh Thìn
    ascended: false,                               // Phi Thăng: độ kiếp Hóa Thần thành công → phá bỏ môn phái, thần tiên hóa cảnh
    relations: {},                                 // Nhân Mạch: quan hệ tán tu { score, love, bond, ... }
    gender: 'nam',                                 // hình dáng tiên nhân: nam / nu
    tienSkin: 'bach',                              // skin tiên y — xem TIEN_SKINS
    vhDmgT:0, vhDmgPct:0, vhEvaT:0, vhEvaPct:0, vhReflT:0, vhAspdT:0, vhAspdPct:0,
    vhCritT:0, vhLeechT:0, vhShield:0, vhReviveCd:0,
    shieldBroken: 0, atkAnim: 0, dashT: 0,
    jumpT: 0, jumpDur: 0.6, jumpDir: { x: 0, y: 1 },
    tutStep: 0, tutDist: 0,                     // hướng dẫn tân thủ từng bước
    mount: { tier: 0, out: false },           // Thú Chiến: xuất trận đánh cùng, không cưỡi
    dantian: { realm: 0, tuvi: 0 },
    jewels: { chucPhuc: 0, linhHon: 0, sinhMenh: 0, honDon: 0 }, // Tứ Châu (Track HT)
    congHuan: 0,                           // Công Huân Lệnh — tiền tệ Vạn Duyên Các
    baohap: {},                            // Bảo Hạp Ma Tôn Giáng Thế { tier: số lượng }
    truyna: { day:'', state:'none', map:null }, // Truy Nã Lệnh ngày
    // Dream of Wuxia systems
    khi: 0,                                    // Chân Khí đả thông kinh mạch
    meridians: {},                             // { thaiam: 0..20, ... }
    gems: { tuLa: 0, honNguyen: 0 },           // Tu La Tinh Thạch / Hỗn Nguyên Thạch
    thanbinh: { tier: 1 },                     // Thần Binh môn phái — theo người từ đầu
    mats: { manh:0, tichMa:0, anTranAi:0, manhCoThan:0 }, // Vật liệu Drop v2.0
    bossPity: 0,                               // Pity đai: đếm Thủ Vệ không ra Thần
    chinhPhat: { date:'', count:0 },           // Chinh Phạt Trấn Ải 1 lần/ngày
    bossKills: {},                             // { mapId: [bossId...] } — mở cổng ải
    storySeen: {}, clues: [], storyFlags: {},  // Cốt truyện Ngũ Ấn
    charms: 0,                                 // Thiên Mệnh Phù (bảo hiểm rèn đồ)
    potions: 3, potionCd: 0,                   // P0: Hồ Lô Thuốc — hồi 40% máu, cd 20s, tối đa 5 lọ
    buffAtkT: 0,                             // Rượu Hổ Cốt — +12% công lực có thời hạn
    loidonT: 0,                              // Lôi Độn Phù — giảm 40% ST thiên lôi có thời hạn
    dotpha: 0,                               // Đan Đột Phá — bảo mệnh độ kiếp (chịu 4 tia lôi, thất bại chỉ tổn 25% Tu Vi)
    noidan: {},                              // Nội Đan yêu thú theo hành { Kim, Mộc, Thổ, Thủy, Hỏa }
    ndBonus: { atk:0, hp:0, def:0, qi:0, crit:0 }, // chỉ số vĩnh viễn từ thôn phệ nội đan
    ndDay: '', ndCount: 0,                   // giới hạn thôn phệ 3 viên/ngày
    doNgo: 0,                                // Đối Ngộ — lần đột phá kế giảm 30% Tu Vi tiêu hao
    pet: null,                               // Linh Thú đồng hành { type, name, lv, el, feed }
    phongphu: 0,                             // Phong Linh Phù — thu phục linh thú
    abode: { tulinh:0, garden:[null,null,null] }, // Động Phủ: Tụ Linh Trận + Dược Viên
    maDao: false,                            // Sa Đọa — Tội Ác cao hắc hóa thành Ma Tu
    daily: { day:'', kills:0, noidan:0, dungeon:0, forge:0, claimed:false }, // Mục Tiêu Hôm Nay
    sectOffered: false,                      // đã mời bái sư ở cấp 10 chưa (chỉ dành cho Tán Nhân)
    traits: [], personality: 'trung',          // Quẻ Tiên Thiên: 3 trait + tính cách
    dhHate: {}, revengeKills: 0,                 // A3: thù hận Du Hiệp (nemesis-lite)
    reviveUsed: false, quzeTitle: false,
    tienDan: 0,                                // Tiến Cấp Đan (ám khí/cung tiễn/cương khí)
    amkhiX: { tier: 0, bless: 0 },             // Ám Khí 7 tầng + Chúc Phúc
    bow: { tier: 0, bless: 0 },                // Cung Tiễn (mở cấp 30)
    gangkhi: { tier: 0, bless: 0 },            // Cương Khí (kháng ám khí)
    titles: { unlocked: [], equipped: null },  // Danh hiệu
    kills: 0, forged11: false,
    bikip: { pieces: [0,0,0], hmtp: false },   // Tàn quyển Huyết Ma Thôn Phệ
    battuCd: 0,                                // Hỗn Nguyên Bất Tử cooldown
    maxJumps: 1,
  };
  for (const m of MERIDIANS) player.meridians[m.id] = 0;
  for (const sl of SLOTS) player.equip[sl.id] = null;
  // starter weapon
  const w = genItem(1, 0); w.slot='weapon'; w.slotName='Vũ Khí';
  player.inv.push(w);
  questIdx = 0; questProg = 0; questState = 'active'; // quest 1 auto-accepted
  sideStates = {};
  victory = false; dead = false;
  curMap = 'tuongduong'; // tân thủ bắt đầu trong thành an toàn — không quái
  calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
  buildWorld();
}
function saveGame(){
  if (!player) return;
  try {
    const payload = JSON.stringify({
      player, questIdx, questProg, questState, victory, curMap, sideStates,
      savedAt: Date.now()
    });
    localStorage.setItem('vlcm_save', payload);
    // Đồng bộ lên cloud nếu game đang nhúng trong shell React (đã đăng nhập)
    if (window.parent && window.parent !== window){
      try { window.parent.postMessage({ type: 'vlcm:save', data: payload }, window.location.origin); } catch(e){}
    }
  } catch(e){}
}
function loadGame(){
  try {
    const raw = localStorage.getItem('vlcm_save');
    if (!raw) return false;
    const d = JSON.parse(raw);
    player = d.player; questIdx = d.questIdx; questProg = d.questProg;
    questState = d.questState; victory = !!d.victory;
    sideStates = d.sideStates || {};
    if (!player.mount) player.mount = { tier: 0, out: false };
    player.mount.out = !!player.mount.out; delete player.mount.riding; // bỏ cơ chế cưỡi
    if (!player.dantian) player.dantian = { realm: 0, tuvi: 0 };
    if (!player.cd) player.cd = { basic:0, a:0, b:0, c:0, jump:0 };
    if (player.cd.jump == null) player.cd.jump = 0;
    if (player.jumpT == null){ player.jumpT = 0; player.jumpDur = 0.6; player.jumpDir = { x:0, y:1 }; }
    // realm cap may have grown — clamp into range
    player.dantian.realm = Math.min(player.dantian.realm, DANTIAN_REALMS.length - 1);
    // Dream of Wuxia backfill
    if (player.khi == null) player.khi = 0;
    if (!player.meridians) player.meridians = {};
    for (const m of MERIDIANS) if (player.meridians[m.id] == null) player.meridians[m.id] = 0;
    if (!player.gems) player.gems = { tuLa: 0, honNguyen: 0 };
    if (player.charms == null) player.charms = 0;
    if (player.tienDan == null) player.tienDan = 0;
    if (!player.amkhiX) player.amkhiX = { tier: 0, bless: 0 };
    if (!player.bow) player.bow = { tier: 0, bless: 0 };
    if (!player.gangkhi) player.gangkhi = { tier: 0, bless: 0 };
    if (!player.titles) player.titles = { unlocked: [], equipped: null };
    if (player.kills == null) player.kills = 0;
    if (player.forged11 == null) player.forged11 = false;
    if (!player.bikip) player.bikip = { pieces: [0,0,0], hmtp: false };
    if (player.battuCd == null) player.battuCd = 0;
    // Phase C backfill: thanh kỹ năng, PK, tội ác, buff, độc, auto-sell
    if (!player.skillBar) player.skillBar = ['a','amkhi','tp',null,null];
    if (!player.skillBar.length) player.skillBar = ['a','amkhi','tp',null,null];
    if (player.pk == null) player.pk = false;
    if (player.toiac == null) player.toiac = 0;
    if (player.toiacT == null) player.toiacT = 0;
    if (player.gkBuffT == null) player.gkBuffT = 0;
    if (!player.vohoc) player.vohoc = {};
    if (!player.skillLv) player.skillLv = {};
    if (player.bikipVH == null) player.bikipVH = 0;
    if (!player.gt) player.gt = { t: GT_DAY*0.30 }; // Lịch Tu Tiên backfill
    if (player.poisonT == null) player.poisonT = 0;
    if (player.autoSell == null) player.autoSell = false;
    if (player.autoEquip == null) player.autoEquip = true;  // GDD Đợt 2 B7: mặc định bật tự mặc đồ
    if (player.maThau == null) player.maThau = 0;           // GDD Đợt 2 B5: Mã Thầu (Trại Ngựa)
    if (player.mountPity == null) player.mountPity = 0;     // GDD Đợt 2 B4: tích lũy thăng giai thú
    if (!player.horseDay) player.horseDay = { d:'', n:0 };  // giới hạn bắt ngựa 5 con/ngày
    if (!player.hintCd) player.hintCd = {};                 // GDD Đợt 2 B3: Nhắc Việc cooldown
    if (!player.hintOff) player.hintOff = {};               // Nhắc Việc: đã tắt (reset khi qua map)
    if (player.auto == null) player.auto = false; // auto farm (treo máy)
    if (!player.autoCfg) player.autoCfg = { skill:true, potion:true, potionPct:40, range:430, boss:false }; // Auto Farm cfg backfill
    if (player.ascended == null) player.ascended = false; // Phi Thăng backfill
    if (!player.gender) player.gender = 'nam';
    if (!player.tienSkin) player.tienSkin = 'bach';
    // Save cũ đã đứng ở Hóa Thần Cảnh trước khi có Phi Thăng → tự thăng khi nạp game
    if (!player.ascended && player.dantian && player.dantian.realm >= DANTIAN_REALMS.length - 1) ascendToImmortal();
    if (!player.relations) player.relations = {}; // Nhân Mạch backfill
    if (!player.thanbinh) player.thanbinh = { tier: 1 }; // Thần Binh môn phái
    if (!player.mats) player.mats = { manh:0, tichMa:0, anTranAi:0, manhCoThan:0 };
    if (player.bossPity == null) player.bossPity = 0;
    if (!player.chinhPhat) player.chinhPhat = { date:'', count:0 };
    if (!player.bossKills) player.bossKills = {};
    if (!player.storySeen) player.storySeen = {};
    if (!player.clues) player.clues = [];
    if (!player.storyFlags) player.storyFlags = {};
    if (player.tutStep == null) player.tutStep = -1; // save cũ: bỏ qua hướng dẫn
    if (player.potions == null) player.potions = 3; // P0: Hồ Lô Thuốc
    if (!player.dhHate) player.dhHate = {};
    if (player.revengeKills == null) player.revengeKills = 0;
    if (player.potionCd == null) player.potionCd = 0;
    if (player.buffAtkT == null) player.buffAtkT = 0;
    if (player.loidonT == null) player.loidonT = 0;
    if (player.dotpha == null) player.dotpha = 0;
    if (!player.noidan) player.noidan = {};
    if (!player.ndBonus) player.ndBonus = { atk:0, hp:0, def:0, qi:0, crit:0 };
    if (player.ndDay == null){ player.ndDay = ''; player.ndCount = 0; }
    if (player.doNgo == null) player.doNgo = 0;
    if (player.pet === undefined) player.pet = null;
    if (player.phongphu == null) player.phongphu = 0;
    if (!player.abode) player.abode = { tulinh:0, garden:[null,null,null] };
    if (!player.abode.garden) player.abode.garden = [null,null,null];
    if (player.maDao == null) player.maDao = false;
    if (!player.daily) player.daily = { day:'', kills:0, noidan:0, dungeon:0, forge:0, claimed:false };
    // Track HT + vòng lặp ngày backfill
    if (!player.jewels) player.jewels = { chucPhuc:0, linhHon:0, sinhMenh:0, honDon:0 };
    if (player.congHuan == null) player.congHuan = 0;     // Công Huân Lệnh (Vạn Duyên Các)
    if (!player.baohap) player.baohap = {};               // Bảo Hạp Ma Tôn: { tier: count }
    if (!player.truyna) player.truyna = { day:'', state:'none', map:null }; // Truy Nã Lệnh ngày
    if (player.sectOffered == null) player.sectOffered = false;
    if (!SECTS[player.sect]) player.sect = 'vophai'; // save lỗi phái → về Tán Nhân
    if (!player.traits || !player.traits.length){ // save cũ: trời ban quẻ bù một lần
      player.traits = rollTraitsSilent();
      player.personality = player.personality || 'trung';
      setTimeout(()=>{ if (player) addFloat(player.x, player.y-56, '☯ Trời ban Quẻ Tiên Thiên cho người cũ — xem ở panel Nhân Vật!', '#f0a03a', 14); }, 1200);
    }
    if (player.tutDist == null) player.tutDist = 0;
    if (d.curMap && MAPS[d.curMap]) curMap = d.curMap;
    // Migrate trang bị cũ (10 ô) sang hệ 12 ô GDD
    const SLOT_MIGRATE = { weapon:'vukhi', helm:'non', armor:'ao', bracer:'tay', belt:'quan',
                           boots:'chan', neck:'daychuyen', ring:'nhan1', jade:'nhan2', amkhi:null };
    const migrateItem = (it) => {
      if (!it) return null;
      if (SLOT_MIGRATE.hasOwnProperty(it.slot)){
        const ns = SLOT_MIGRATE[it.slot];
        if (!ns){ player.mat += 3; return null; } // ô Ám Khí cũ → đổi 3 Huyền Thiết
        it.slot = ns;
        it.slotName = (SLOTS.find(x=>x.id===ns) || {}).name || ns;
      }
      if (it.tier == null) it.tier = itemTier(it.level || 1);
      if (it.perfect == null) it.perfect = false;
      if (it.luck == null) it.luck = false;
      if (it.life == null) it.life = 0;
      if (it.ancient === undefined) it.ancient = null;
      if (!it.subs) it.subs = [];
      return it;
    };
    const newEquip = {};
    for (const s2 in player.equip){
      const it = migrateItem(player.equip[s2]);
      if (!it) continue;
      if (!newEquip[it.slot]) newEquip[it.slot] = it; else player.inv.push(it);
    }
    player.equip = newEquip;
    player.inv = player.inv.map(migrateItem).filter(Boolean).slice(0, 30);
    // clamp old +12..+15 gear to the new +11 cap
    for (const s in player.equip) if (player.equip[s] && player.equip[s].plus > 11) player.equip[s].plus = 11;
    for (const it of player.inv) if (it.plus > 11) it.plus = 11;
    let maxUid = 0;
    for (const s in player.equip) if (player.equip[s]) maxUid = Math.max(maxUid, player.equip[s].uid);
    for (const it of player.inv) maxUid = Math.max(maxUid, it.uid);
    itemSeq = maxUid + 1;
    calcDerived();
    buildWorld();
    DGN = null; if (mapDef().dungeon) startDungeonRun(curMap); // vào lại phó bản = một lượt mới
    grantOfflineGains(d.savedAt || 0); // Bế quan offline — thưởng Chân Khí/Tu Vi theo thời gian vắng mặt
    return true;
  } catch(e){ return false; }
}

// ---------- World ----------
function rnd(a,b){ return a + Math.random()*(b-a); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

let packSeq = 1;
// ---------- Đai cấp trong map: Ngoại Vi → Trung Tâm → Hạt Nhân ----------
// Quái yếu xếp gần cửa vào, mạnh dần vào sâu — người chơi nhìn là biết đường farm
const BAND_NAMES = ['Ngoại Vi', 'Trung Tâm', 'Hạt Nhân'];
const BAND_COLORS = ['#7ec850', '#e8b04a', '#ff6a5a'];
let curBand = -1;
function mapMobLvRange(md){
  if (!md.packs || !md.packs.length) return null;
  let lo = 999, hi = 0;
  for (const pk of md.packs){ const l = MOBS[pk.mob].lv; if (l < lo) lo = l; if (l > hi) hi = l; }
  return [lo, hi];
}
function bandOfDist(md, x, y){ // đai theo khoảng cách từ điểm vào map
  if (!md.packs || !md.packs.length) return -1;
  let maxD = 1;
  for (const pk of md.packs){ const d = dist(pk.x, pk.y, md.spawn.x, md.spawn.y); if (d > maxD) maxD = d; }
  const t = dist(x, y, md.spawn.x, md.spawn.y) / maxD;
  return t < 0.45 ? 0 : t < 0.8 ? 1 : 2;
}
function bandLvText(md, b){
  const lvs = md.packs.map(pk => MOBS[pk.mob].lv).sort((a,c)=>a-c);
  const n = lvs.length; if (!n) return '';
  const pick = b === 0 ? lvs.slice(0, Math.ceil(n/3)) : b === 1 ? lvs.slice(Math.floor(n/3), Math.ceil(2*n/3)) : lvs.slice(Math.floor(2*n/3));
  return `C${pick[0]}–${pick[pick.length-1]}`;
}
function bandSummaryHtml(md){
  if (!md.packs || !md.packs.length) return '';
  return `<div class="m-desc" style="opacity:.85;margin-top:2px">` +
    BAND_NAMES.map((n,b)=>`<span style="color:${BAND_COLORS[b]}">●</span> ${n} ${bandLvText(md,b)}`).join(' · ') + `</div>`;
}
function buildWorld(){
  const md = mapDef();
  mobs = []; pickups = []; projectiles = []; effects = []; floats = [];
  petObj = null; mountObj = null; // Linh Thú & Thú Chiến xuất hiện lại ở map mới
  decor = []; mists = []; springTimer = 0;
  // quái đứng thành cụm 5-7 con (GDD Mob Mechanics) — xếp theo đai cấp:
  // cụm yếu nhất gần cửa vào nhất, cụm mạnh nhất sâu nhất (ghép cặp level↔khoảng cách đã sắp xếp)
  const _packs = [...md.packs].sort((a,b) => MOBS[a.mob].lv - MOBS[b.mob].lv);
  const _spots = md.packs.map(p => ({ x:p.x, y:p.y }))
    .sort((a,b) => dist(a.x,a.y,md.spawn.x,md.spawn.y) - dist(b.x,b.y,md.spawn.x,md.spawn.y));
  for (let i = 0; i < _packs.length; i++){
    const pk = _packs[i], s = _spots[i];
    const packId = packSeq++;
    for (let j = 0; j < pk.n; j++) spawnMob(pk.mob, { x:s.x, y:s.y, r:115, count:pk.n }, packId); // dàn trải cụm quái, tránh chồng hình
  }
  curBand = -1; // đổi map → tính lại đai, không bắn banner ngay lúc vào
  // Giang Hồ Du Hiệp — mục tiêu PK trong map dã ngoại/huyết chiến
  if (md.duhiep){
    const nDH = md.type === 'freepk' ? 6 : 4;
    const hate = (player.dhHate && player.dhHate[md.duhiep]) || 0;
    for (let i = 0; i < nDH; i++){
      const dh = spawnMob(md.duhiep, { x:rnd(400,MAP.w-400), y:rnd(400,MAP.h-400), r:60 }, null);
      dh.wanderT = 0; dh.wanderAng = rnd(0, Math.PI*2);
      // A3: có thù → hắn truy thù: chủ động săn người chơi, mạnh hơn, đánh được không cần PK
      if (hate >= 1 && i === 0){
        dh.revenge = true; dh.provoked = true; dh.packAlert = 9999;
        dh.hp = dh.maxHp = Math.round(dh.maxHp * 1.2);
        dh.atkMul = 1.15;
        addFloat(player.x, player.y-80, '⚔ CÓ KẺ TRUY THÙ NGƯƠI TRONG VÙNG NÀY!', '#e84a6a', 16);
      }
    }
  }
  if (md.boss && questIdx >= 9 && questState !== 'all' && !victory) spawnBoss();
  if (md.herbs) for (const s of HERB_SPOTS) pickups.push({ type:'herb', x:s.x, y:s.y, respawn:0 });
  // decor: ink trees, rocks theo địa hình map
  for (let i = 0; i < (md.trees ?? 70); i++)
    decor.push({ type:'tree', x:rnd(60,MAP.w-60), y:rnd(60,MAP.h-60), s:rnd(0.7,1.5) });
  for (let i = 0; i < (md.rocks ?? 26); i++)
    decor.push({ type:'rock', x:rnd(60,MAP.w-60), y:rnd(60,MAP.h-60), s:rnd(0.6,1.4) });
  for (let i = 0; i < 14; i++) mists.push({ x:rnd(0,W), y:rnd(0,H), r:rnd(120,300), v:rnd(4,14), a:rnd(0.04,0.1) });
  // giữ khu làng & suối thiền trống
  if (md.village) decor = decor.filter(d => dist(d.x,d.y,NPC.x,NPC.y) > 160 && dist(d.x,d.y,SPRING.x,SPRING.y) > 120);
  decor = decor.filter(d => !NPCS.some(n => n.map === curMap && dist(d.x,d.y,n.x,n.y) < 150));
  spawnAmbients(); // hạt môi trường + cỏ mặt đất theo chủ đề bản đồ
  spawnHorses(); // GDD Đợt 2 B5: Tuấn Mã Hoang
  // Ma Tôn Giáng Thế & Truy Nã Lệnh: tái xuất hiện khi người chơi vào đúng bản đồ
  if (typeof MATON !== 'undefined' && MATON.active && curMap === MATON.map && !mobs.some(m => m.type === 'maton' && !m.dead)) spawnMaTonMob();
  if (player && player.truyna && player.truyna.state === 'hunting' && curMap === player.truyna.map && !mobs.some(m => m.truyna && !m.dead)) spawnTruyNaMob();
  spawnZoneBosses(); // GDD Boss v2.1: Thủ Vệ & Trấn Ải theo map
}
function spawnMob(type, zone, pack){
  const def = MOBS[type];
  const m = {
    type, def, name: def.name,
    x: zone ? zone.x + rnd(-zone.r, zone.r) : rnd(200, MAP.w-200),
    y: zone ? zone.y + rnd(-zone.r, zone.r) : rnd(200, MAP.h-200),
    zone, pack: pack ?? null, hp: def.hp, maxHp: def.hp, atkT: rnd(0,1), dead:false, face: 0,
    shield: def.elite ? 1 : 0, shieldT: 0, hitT: 0, wob: Math.random()*10, packAlert: 0,
  };
  if (inObstacle(curMap, m.x, m.y, 16)){ const _f = nearestFree(curMap, m.x, m.y); m.x = _f.x; m.y = _f.y; } // GDD Đợt 2 A: không spawn vào vùng cấm
  m.homeX = m.x; m.homeY = m.y; // lãnh địa — điểm boss canh giữ, leash sẽ kéo về đây
  mobs.push(m); return m;
}
function spawnBoss(){
  if (mobs.some(m=>m.type==='boss'&&!m.dead)) return;
  spawnMob('boss', { x:BOSS_ARENA.x, y:BOSS_ARENA.y, r:40, count:1 });
  AudioSys.playBgm(BGM_BOSS); // Hoa Địa Li Lao vang lên — trận chiến sinh tử
}

// ═══════════ HỆ BOSS VÙNG & TRẤN ẢI (GDD Boss v2.1 + Cốt truyện Ngũ Ấn Phong Ma) ═══════════
// Mỗi map: 3 Thủ Vệ (canh 3 Trận Nhãn) + 1 Trấn Ải (canh Tế Đàn, mở khi phá đủ 3 nhãn)
// Moveset cố định 3-4 chiêu, telegraph 1.0-1.6s (vùng đỏ), đánh xong lộ cửa sổ trừng phạt 2.5s
const BOSS_MOVES = {
  vach:  { tele:1.4, r:150, arc:1.1,  name:'Trảm Kích' },  // quạt trước mặt
  vong:  { tele:1.6, r:175,           name:'Bộc Phát' },   // nổ quanh boss
  xung:  { tele:1.2, len:340, w:64,   name:'Xung Phong' }, // lao tuyến thẳng tới vị trí người chơi
  goi:   { tele:1.0,                  name:'Triệu Hồi' },  // gọi 2 tùy tùng
  cuong: { tele:1.0,                  name:'Cuồng Hóa' },  // buff công ×1.3 trong 8s (dưới 50% HP)
};
const BOSS_DEFS = {
  daohoa: { thuve:[
      { id:'dh1', name:'Dã Trư Vương',       lv:6,  el:'Thổ',  img:'boar',     x:.30, y:.30, moves:['vach','xung','cuong'] },
      { id:'dh2', name:'Sói Đầu Đàn',        lv:9,  el:'Mộc',  img:'wolf',     x:.64, y:.56, moves:['xung','goi','vach'] },
      { id:'dh3', name:'Hắc Phong Chấp Sự',  lv:12, el:'Thủy', img:'assassin', x:.42, y:.80, moves:['vach','vong','cuong'] } ],
    tranai: { id:'dh4', name:'Hắc Phong Trại Chủ', lv:14, el:'Hỏa', img:'boss_hacphong', x:.86, y:.80, moves:['vong','vach','goi','cuong'] } },
  ngoai: { thuve:[
      { id:'ng1', name:'Sơn Tặc Đầu Mục',    lv:13, el:'Kim',  img:'bandit',   x:.28, y:.34, moves:['vach','xung','cuong'] },
      { id:'ng2', name:'Độc Nhãn Lang Vương',lv:16, el:'Mộc',  img:'wolf',     x:.62, y:.62, moves:['xung','vong','goi'] },
      { id:'ng3', name:'Hắc Y Sát Thủ',      lv:19, el:'Thủy', img:'assassin', x:.40, y:.80, moves:['vach','xung','cuong'] } ],
    tranai: { id:'ng4', name:'Bạch Diện Ma Quân', lv:22, el:'Hỏa', img:'boss_sontac', x:.85, y:.78, moves:['vach','vong','goi','cuong'] } },
  chungnam: { thuve:[
      { id:'cn1', name:'Phản Đồ Đạo Sĩ',     lv:23, el:'Thủy', img:'phando',   x:.30, y:.32, moves:['vach','xung','goi'] },
      { id:'cn2', name:'Huyền Giáp Thần Quy',lv:26, el:'Thổ',  img:'mocnhan',  x:.64, y:.58, moves:['vong','vach','cuong'] },
      { id:'cn3', name:'Phản Đồ Chân Nhân',  lv:29, el:'Thủy', img:'boss_phando', x:.44, y:.80, moves:['xung','vach','vong'] } ],
    tranai: { id:'cn4', name:'Thái Hư Kiếm Thánh', lv:32, el:'Thủy', img:'bandao', x:.86, y:.80, moves:['vach','xung','vong','cuong'] } },
  comoc: { thuve:[
      { id:'cm1', name:'Thi Binh Thống Lĩnh',lv:43, el:'Thổ',  img:'kybinh',   x:.30, y:.32, moves:['xung','vach','goi'] },
      { id:'cm2', name:'Âm Dương Táng Giả',  lv:46, el:'Thủy', img:'thinu',    x:.62, y:.58, moves:['vong','xung','cuong'] },
      { id:'cm3', name:'Thi Vương Bất Tử',   lv:49, el:'Thổ',  img:'mocnhan',  x:.42, y:.80, moves:['vach','vong','goi'] } ],
    tranai: { id:'cm4', name:'Cổ Mộ Tổ Sư', lv:52, el:'Mộc', img:'boss_mochu', x:.85, y:.80, moves:['vong','xung','goi','cuong'] } },
  tuyettinh: { thuve:[
      { id:'tt1', name:'Tình Nhi Tuyệt Vọng',lv:63, el:'Thổ',  img:'ttdetu',   x:.30, y:.32, moves:['vach','goi','cuong'] },
      { id:'tt2', name:'Hồ Ly Cửu Vĩ',       lv:66, el:'Hỏa',  img:'caodo',    x:.64, y:.58, moves:['xung','vong','goi'] },
      { id:'tt3', name:'Tuyệt Tình Ma Nữ',   lv:69, el:'Mộc',  img:'boss_tinhhoa', x:.42, y:.80, moves:['vach','xung','vong'] } ],
    tranai: { id:'tt4', name:'Tuyệt Tình Cốc Chủ', lv:72, el:'Mộc', img:'boss_tinhhoa', x:.86, y:.80, moves:['vong','vach','xung','cuong'] } },
  mongco: { thuve:[
      { id:'mc1', name:'Thiết Kỵ Bách Phu Trưởng', lv:83, el:'Kim', img:'kybinh',  x:.30, y:.32, moves:['xung','vach','cuong'] },
      { id:'mc2', name:'Thần Tiễn Hãn Tử',  lv:86, el:'Mộc',  img:'cungthu',  x:.64, y:.58, moves:['vong','xung','goi'] },
      { id:'mc3', name:'Hãn Vương Thiết Kỵ',lv:89, el:'Kim',  img:'cuongbinh',x:.42, y:.80, moves:['vach','xung','vong'] } ],
    tranai: { id:'mc4', name:'Đột Thông Đại Hãn', lv:92, el:'Kim', img:'boss_dothong', x:.86, y:.80, moves:['xung','vong','goi','cuong'] } },
  nhanmon: { thuve:[
      { id:'nm1', name:'Liêu Quốc Dũng Tướng',lv:103, el:'Kim', img:'daokhach', x:.30, y:.32, moves:['vach','xung','cuong'] },
      { id:'nm2', name:'Sa Trường Huyết Sát',lv:106, el:'Hỏa',  img:'cuongbinh',x:.64, y:.58, moves:['vong','vach','goi'] },
      { id:'nm3', name:'Cô Thành Tướng Quân',lv:109, el:'Thổ',  img:'boss_thienbinh', x:.42, y:.80, moves:['xung','vong','vach'] } ],
    tranai: { id:'nm4', name:'Nhạn Môn Quan Chủ', lv:112, el:'Hỏa', img:'boss_thienbinh', x:.86, y:.80, moves:['vach','xung','vong','cuong'] } },
};
// Đồng Môn Trợ Uy (Cốt truyện × Tông môn §4): map "chạm nhà" của từng phái
const SECT_HOOK_MAP = { daohoa:'daohoa', ngoai:'baidasan', chungnam:'toanchan', comoc:'comoc', tuyettinh:'thieulam', mongco:'doanthi', nhanmon:'minhgiao' };
function bossScale(lv){
  return { hp: Math.round(2600*Math.pow(lv/10, 1.7)), atk: Math.round(44*lv/10), def: Math.round(16*lv/10),
    xp: Math.round(2500*lv/10), silver:[Math.round(280*lv/10), Math.round(400*lv/10)] };
}
function spawnZoneBosses(){
  const bd = BOSS_DEFS[curMap];
  if (!bd || mobs.some(m => m.def.bossKind)) return;
  for (const tv of bd.thuve) spawnZoneBoss(tv, 'thuve');
  spawnZoneBoss(bd.tranai, 'tranai');
}
function spawnZoneBoss(bd, kind){
  const s = bossScale(bd.lv);
  const hpMul = kind === 'tranai' ? 1.7 : 1, atkMul = kind === 'tranai' ? 1.15 : 1;
  const def = { name: bd.name, lv: bd.lv, hp: Math.round(s.hp*hpMul), atk: Math.round(s.atk*atkMul), def: s.def,
    xp: s.xp*(kind === 'tranai' ? 3 : 1), silver: s.silver, speed: 60, aggro: 420, range: 42, atkCd: 1.5,
    size: kind === 'tranai' ? 30 : 24, color:'#241a2e', eye:'#ff3a3a', boss:true, elite:true, drop:0, el: bd.el,
    img:'assets/mobs/' + bd.img + '.png', bossKind: kind, bossId: bd.id, moves: bd.moves, _bdRef: bd };
  const m = { type:'zb_' + bd.id, def, name: bd.name, x: bd.x*MAP.w, y: bd.y*MAP.h,
    zone:{ x: bd.x*MAP.w, y: bd.y*MAP.h, r: 130, count: 1 },
    pack: null, hp: def.hp, maxHp: def.hp, atkT: 1, dead:false, face: 0,
    shield: 0, shieldT: 0, hitT: 0, wob: Math.random()*10, packAlert: 0,
    moveT: 4, moveIdx: 0, tele: null, punishT: 0, introduced: false };
  if (inObstacle(curMap, m.x, m.y, 16)){ const _f2 = nearestFree(curMap, m.x, m.y); m.x = _f2.x; m.y = _f2.y; m.zone.x = _f2.x; m.zone.y = _f2.y; } // GDD Đợt 2 A
  if (!MOB_IMGS[m.type]){ const im = new Image(); im.src = def.img; MOB_IMGS[m.type] = im; }
  mobs.push(m); return m;
}
const BOSS_MINION = { daohoa:'bandit', ngoai:'bandit', chungnam:'phando', comoc:'thinu', tuyettinh:'ttdetu', mongco:'cuongbinh', nhanmon:'daokhach' };
function bossStartTele(m, mvId){
  const mv = BOSS_MOVES[mvId]; if (!mv) return;
  if (mvId === 'cuong' && m.hp > m.maxHp*0.5){ m.moveT = 2; return; } // Cuồng Hóa chỉ khi dưới nửa máu
  m.tele = { mvId, t: mv.tele, max: mv.tele, x: m.x, y: m.y,
    ang: Math.atan2(player.y - m.y, player.x - m.x), px: player.x, py: player.y };
  addFloat(m.x, m.y - m.def.size - 22, mv.name + '!', '#ff7a5a', 14);
  AudioSys.sfx('quest', 0.3);
}
function bossExecMove(m){
  const mvId = m.tele.mvId, mv = BOSS_MOVES[mvId], tele = m.tele;
  m.tele = null;
  m.punishT = 2.5; // cửa sổ trừng phạt — người chơi gây thêm ST
  if (mvId === 'goi'){
    for (let i = 0; i < 2; i++){
      const a = spawnMob(BOSS_MINION[curMap] || 'bandit', null, null);
      a.x = clamp(m.x + rnd(-70,70), 40, MAP.w-40); a.y = clamp(m.y + rnd(-70,70), 40, MAP.h-40);
      a.packAlert = 8;
    }
    addFloat(m.x, m.y-40, 'Tùy tùng xuất hiện!', '#c07fe0', 13);
    return;
  }
  if (mvId === 'cuong'){
    m.atkMul = (m.atkMul || 1) * 1.3; m.cuongT = 8;
    addFloat(m.x, m.y-40, 'CUỒNG HÓA!', '#ff3a3a', 16);
    addEffect({ type:'ring', x:m.x, y:m.y, r:60, color:'#ff3a3a', big:true });
    return;
  }
  let hit = false;
  if (mvId === 'vong'){
    addEffect({ type:'ring', x:tele.x, y:tele.y, r:mv.r, color:'#ff5a3a', big:true });
    hit = dist(player.x, player.y, tele.x, tele.y) < mv.r;
  } else if (mvId === 'vach'){
    addEffect({ type:'arc', x:m.x, y:m.y, face:tele.ang, r:mv.r, color:'#ff5a3a' });
    const d2 = dist(player.x, player.y, m.x, m.y);
    let da = Math.abs((Math.atan2(player.y - m.y, player.x - m.x) - tele.ang) % (Math.PI*2));
    if (da > Math.PI) da = Math.PI*2 - da;
    hit = d2 < mv.r && da < mv.arc;
  } else if (mvId === 'xung'){
    m.x = clamp(tele.px, 40, MAP.w-40); m.y = clamp(tele.py, 40, MAP.h-40);
    addEffect({ type:'ring', x:m.x, y:m.y, r:70, color:'#ff5a3a', big:true });
    hit = dist(player.x, player.y, m.x, m.y) < mv.w + 26;
  }
  if (hit){
    if (player.jumpT > 0){ addFloat(player.x, player.y-28, 'Né!', '#a0ffe9', 14); } // J i-frames
    else {
      let dmg = Math.round(m.def.atk * 2.2 * (1 - player.defRed));
      const gapB = m.def.lv - player.level; // Áp Bức chiều ngược
      if (gapB > 10) dmg = Math.round(dmg*1.6); else if (gapB >= 6) dmg = Math.round(dmg*1.3);
      player.hp -= dmg; player.hurtT = 0.3; player.combatT = 4;
      addFloat(player.x, player.y-30, dmg, '#ff5a3a', 17);
      addEffect({ type:'ring', x:player.x, y:player.y-10, r:26, color:'#ff5a3a' });
      AudioSys.sfx('hurt', 0.8);
      if (player.hp <= 0){ player.hp = 0; player._killedByBoss = m.def.name; onDeath(); }
    }
  }
}
// Telegraph vẽ trên mặt đất (world space, dưới chân thực thể)
function drawBossTele(m){
  const t = m.tele, mv = BOSS_MOVES[t.mvId];
  const prog = 1 - t.t / t.max;
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.3*prog;
  ctx.fillStyle = '#ff3a2a';
  ctx.strokeStyle = 'rgba(255,80,50,.9)'; ctx.lineWidth = 2;
  if (t.mvId === 'vong'){
    ctx.beginPath(); ctx.arc(t.x, t.y, mv.r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
  } else if (t.mvId === 'vach'){
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.arc(m.x, m.y, mv.r, t.ang - mv.arc, t.ang + mv.arc); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (t.mvId === 'xung'){
    ctx.translate(t.x, t.y); ctx.rotate(t.ang);
    ctx.fillRect(0, -mv.w/2, mv.len, mv.w); ctx.strokeRect(0, -mv.w/2, mv.len, mv.w);
  } else { // goi/cuong: vòng tụ nhỏ quanh boss
    ctx.beginPath(); ctx.arc(m.x, m.y, 46, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
  // vòng đếm tụ chiêu trên đầu boss
  ctx.save();
  ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(m.x, m.y - m.def.size - 30, 12, -Math.PI/2, -Math.PI/2 + prog*Math.PI*2); ctx.stroke();
  ctx.restore();
}
// Dịch chuyển giữa các bản đồ
window.travelTo = function(mapId){
  const md = MAPS[mapId];
  if (!md || !player) return;
  if (player.level < md.min){
    addFloat(player.x, player.y-40, `Cần cấp ${md.min} để vào ${md.name}!`, '#ff7a6a', 14);
    return;
  }
  curMap = mapId;
  closePanels();
  tutAdvance('map'); // hướng dẫn tân thủ: dịch chuyển lần đầu
  AudioSys.playBgm(BGM_TRACKS[mapId]);
  buildWorld();
  player.x = md.spawn.x; player.y = md.spawn.y;
  if (md.type === 'safe') player.pk = false; // khu an toàn: không thể bật PK
  const zt = zoneType();
  zoneBanner = { text: md.name, sub: `${zt.name} — ${md.desc}`, color: zt.color, t: 3.2 };
  addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:zt.color, big:true });
  calcDerived(); saveGame();
};

// ---------- Cài đặt (lưu localStorage) ----------
// shake mặc định TẮT (chống chóng mặt) — save cũ không có key này nên tự migrate sang tắt
const SETTINGS = Object.assign({ bgm:35, sfx:60, lowFx:false, mobName:true, minimap:true, shake:false },
  (()=>{ try { return JSON.parse(localStorage.getItem('vlcm_settings') || '{}'); } catch(e){ return {}; } })());
function saveSettings(){ try { localStorage.setItem('vlcm_settings', JSON.stringify(SETTINGS)); } catch(e){} }

// ---------- Âm thanh kiếm hiệp: BGM theo map + SFX ----------
// Nhạc nền: bgm_safe (làng/thành) · bgm_field (dã ngoại) · bgm_tomb (mật thất) · bgm_war (chiến trường)
// Mỗi map có nhạc nền riêng; map chưa có bản riêng dùng nhạc nền chung
const BGM_TRACKS = { daohoa:'bgm_daohoa_ost', tuongduong:'bgm_tuongduong_ost', ngoai:'bgm_ngoai', chungnam:'bgm_chungnam_ost',
  tuyettinh:'bgm_tuyettinh_ost', comoc:'bgm_comoc', mongco:'bgm_mongco', nhanmon:'bgm_nhanmon' };
const BGM_INTRO = 'bgm_kiemhiep'; // Kiếm Hiệp Tình — màn mở đầu & chọn phái (hào hiệp chính khí)
const BGM_BOSS = 'bgm_boss_nguan';   // Hoa Địa Li Lao — boss Trấn Ải / Ngũ Ấn (bi kịch bùng nổ)
const BGM_ROMANCE = 'bgm_romance';   // Tiếu Vấn Tình Duyên — song ca khi kết Đạo Lữ
const AudioSys = {
  bgm: null, bgmName: '', started: false, cache: {}, last: {},
  bgmVol(){ return (SETTINGS.bgm/100) * 0.85; },
  sfxVol(){ return SETTINGS.sfx/100; },
  playBgm(name){
    if (!name || this.bgmName === name) return;
    this.bgmName = name;
    if (this.started) this._startTrack();
  },
  _startTrack(){
    if (this.bgm) this.bgm.pause();
    const a = new Audio('assets/music/' + this.bgmName + '.mp3');
    a.loop = true; a.volume = this.bgmVol();
    a.play().catch(()=>{ /* autoplay bị chặn — chờ tương tác */ });
    this.bgm = a;
  },
  tryStart(){
    if (this.started) return;
    this.started = true;
    if (!this.bgmName) this.bgmName = BGM_TRACKS[curMap] || 'bgm_safe';
    this._startTrack();
  },
  refreshBgmVol(){ if (this.bgm){ this.bgm.volume = this.bgmVol(); if (SETTINGS.bgm <= 0) this.bgm.pause(); else this.bgm.play().catch(()=>{}); } },
  sfx(name, vol){
    if (SETTINGS.sfx <= 0) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 70) return; // chống spam âm
    this.last[name] = now;
    let a = this.cache[name];
    if (!a){ a = new Audio('assets/music/sfx_' + name + '.mp3'); this.cache[name] = a; }
    const inst = a.cloneNode();
    inst.volume = Math.min(1, (vol ?? 1) * this.sfxVol());
    inst.play().catch(()=>{});
  },
};
window.addEventListener('pointerdown', ()=>AudioSys.tryStart());
window.addEventListener('keydown', ()=>AudioSys.tryStart());
document.getElementById('btn-music').addEventListener('click', ()=>{
  SETTINGS.bgm = SETTINGS.bgm > 0 ? 0 : 35;
  saveSettings(); AudioSys.refreshBgmVol();
  const b = document.getElementById('btn-music');
  if (b) b.style.opacity = SETTINGS.bgm > 0 ? '1' : '0.4';
});

// ---------- Input ----------
window.addEventListener('keydown', e=>{
  if (e.target && e.target.tagName === 'INPUT') return; // đang gõ console playtest
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') { e.preventDefault(); doBasic(); }
  if (e.key >= '1' && e.key <= '5' && player){ // taskbar 5 ô kỹ năng
    const id = player.skillBar[+e.key - 1];
    if (id) castSkill(id); else togglePanel('skill');
  }
  if (e.key.toLowerCase()==='e'){ if (!window.tryCatchHorse || !tryCatchHorse()) tryTalk(); } // GDD Đợt 2 B5: E bắt Tuấn Mã kiệt sức trước
  if (e.key.toLowerCase()==='j') doJump();
  if (e.key.toLowerCase()==='c') togglePanel('char');
  if (e.key.toLowerCase()==='i') togglePanel('inv');
  if (e.key.toLowerCase()==='b') togglePanel('bag');
  if (e.key.toLowerCase()==='k') togglePanel('skill');
  if (e.key.toLowerCase()==='m') togglePanel('map');
  if (e.key.toLowerCase()==='q') togglePanel('qlog');
  if (e.key.toLowerCase()==='l') togglePanel('relation'); // Nhân Mạch
  if (e.key.toLowerCase()==='u'){ SETTINGS.minimap = !SETTINGS.minimap; saveSettings(); }
  if (e.key.toLowerCase()==='o') togglePanel('settings');
  if (e.key.toLowerCase()==='f') togglePanel('forge');
  // Phím T dành riêng cho thu phục Linh Thú — Thú Chiến mở qua C → Thú Chiến, xuất trận/thu hồi bằng V
  if (e.key.toLowerCase()==='v') toggleMountOut();
  if (e.key.toLowerCase()==='z' && player && !dead) toggleAuto();
  if (e.key === '`' && window.TEST_MODE){ e.preventDefault(); window.toggleCheatConsole(); }
  if (e.key.toLowerCase()==='n') togglePanel('dantian');
  if (e.key.toLowerCase()==='h') togglePanel('tuyethoc');
  if (e.key.toLowerCase()==='r') usePotion();
  if (e.key.toLowerCase()==='g' && nearGate && player && !dead) travelTo(nearGate.to, curMap);
  if (e.key.toLowerCase()==='t' && player && !dead) tryTame(); // Phong Linh Phù — thu phục tinh anh suy yếu
  if (e.key === 'Escape') closePanels();
});
window.addEventListener('keyup', e=> keys[e.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', e=>{
  mouseWorld.x = e.clientX + camera.x; mouseWorld.y = e.clientY + camera.y;
});
canvas.addEventListener('mousedown', e=>{
  if (!player || dead) return;
  closePanels(); // click the world = close any open window
  mouseWorld.x = e.clientX + camera.x; mouseWorld.y = e.clientY + camera.y;
  player.face = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);
  doBasic();
});

// touch joystick
const joy = document.getElementById('joystick'), knob = document.getElementById('joy-knob');
let joyId = null, joyCenter = null;
joy.addEventListener('touchstart', e=>{
  const t = e.changedTouches[0]; joyId = t.identifier;
  joyCenter = { x: t.clientX, y: t.clientY }; e.preventDefault();
}, {passive:false});
window.addEventListener('touchmove', e=>{
  for (const t of e.changedTouches){
    if (t.identifier === joyId && joyCenter){
      const dx = t.clientX - joyCenter.x, dy = t.clientY - joyCenter.y;
      const d = Math.hypot(dx,dy), max = 38;
      const k = d > max ? max/d : 1;
      knob.style.left = (35 + dx*k) + 'px'; knob.style.top = (35 + dy*k) + 'px';
      joyVec.x = (dx*k)/max; joyVec.y = (dy*k)/max;
    }
  }
}, {passive:true});
window.addEventListener('touchend', e=>{
  for (const t of e.changedTouches){
    if (t.identifier === joyId){
      joyId = null; joyVec.x = 0; joyVec.y = 0;
      knob.style.left = '35px'; knob.style.top = '35px';
    }
  }
});
if ('ontouchstart' in window) joy.classList.remove('hidden');

document.getElementById('sk-basic').addEventListener('click', doBasic);
document.querySelectorAll('.sk-slot').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id = player && player.skillBar[+b.dataset.slot];
    if (id) castSkill(id); else togglePanel('skill');
  });
});
document.getElementById('sk-jump').addEventListener('click', doJump);

// ---------- Combat ----------
function addFloat(x,y,text,color,size){
  if (floats.length >= 70) floats.shift(); // chống tràn số bay
  floats.push({ x, y, text, color, t:1, size:size||13 });
}
// ── Gộp số sát thương: đòn thường vào cùng 1 mục tiêu cộng dồn thành 1 số ──
function addDmgFloat(target, x, y, dmg, color, size){
  const now = performance.now();
  const f = target._dmgF;
  if (f && f.t > 0.2 && now - (target._dmgFT || 0) < 900){
    target._dmgSum = (target._dmgSum || 0) + dmg;
    f.text = String(target._dmgSum);
    f.t = 1; target._dmgFT = now;
    f.x = x; f.y = y; f.color = color;
    f.size = Math.min(19, (f.size || 13) + 0.6); // cộng dồn càng lâu số càng to
    return f;
  }
  target._dmgSum = dmg; target._dmgFT = now;
  const nf = { x, y, text:String(dmg), color, t:1, size:size||13 };
  floats.push(nf);
  target._dmgF = nf;
  return nf;
}
function addEffect(e){ effects.push(Object.assign({ t:0 }, e)); }

function hurtMob(m, dmg, source){
  if (m.dead) return;
  player.combatT = 4; // P0: gây sát thương cũng tính là vào combat
  // LIÊN TRẢM: trong cửa sổ — mọi đòn/chiêu của người chơi +30% ST; chí mạng duy trì cửa sổ
  if ((player.ltT || 0) > 0 && (source === 'hit' || source === 'crit' || source === 'tp' || source === 'amkhi')){
    dmg *= 1.3;
    if (source === 'crit') player.ltT = 2.5;
  }
  // Du Hiệp trung lập: chỉ đánh được khi bật PK (khu an toàn tuyệt đối cấm)
  if (m.def.duHiep && !player.pk && !m.revenge){
    addFloat(m.x, m.y - m.def.size - 16, 'Bật PK để tấn công Du Hiệp!', '#8a8a8a', 11);
    return;
  }
  // Aggro cụm: đánh 1 con, cả cụm 5-7 con lao vào (GDD Mob Mechanics)
  // QA: map An Toàn (tân thủ) chỉ tối đa 3 con cùng lao vào để tránh chết oan lúc LV1-5
  if (m.pack != null){
    const cap = mapDef().type === 'safe' ? 3 : 99;
    let alerted = 0;
    const mates = mobs.filter(m2 => !m2.dead && m2 !== m && m2.pack === m.pack && dist(m.x, m.y, m2.x, m2.y) < 340)
      .sort((a,b) => dist(m.x,m.y,a.x,a.y) - dist(m.x,m.y,b.x,b.y));
    for (const m2 of mates){ if (++alerted > cap) break; m2.packAlert = 8; }
  }
  if (m.def.duHiep) m.provoked = true; // bị đánh → phản kích
  let final = dmg;
  let shieldNote = false, counterNote = false, counteredNote = false, perfectNote = false;
  // Ngũ hành tương khắc: môn phái khắc hệ quái → +20% sát thương; bị quái khắc → -12%
  const sectEl = SECTS[player.sect].element;
  if (sectEl && m.def.el){
    if (NGU_HANH[sectEl].beats === m.def.el){ final *= 1.2; counterNote = true; }
    else if (NGU_HANH[m.def.el] && NGU_HANH[m.def.el].beats === sectEl){ final *= 0.88; counteredNote = true; }
  }
  // Áp Bức Võ Công (GDD Boss v2.1): boss cao hơn người chơi → ST bị áp chế theo chênh cấp (tường level mềm)
  if (m.def.bossKind){
    const gap = m.def.lv - player.level;
    let abMul = 1;
    if (gap > 10) abMul = 0.35; else if (gap >= 6) abMul = 0.6; else if (gap >= 1) abMul = 0.85;
    if (abMul < 1){
      final *= abMul;
      if (Math.random() < 0.12) addFloat(m.x, m.y - m.def.size - 36, 'ÁP BỨC VÕ CÔNG — công kích bị áp chế!', '#c07fe0', 11);
    }
    if (m.punishT > 0) final *= 1.15; // cửa sổ trừng phạt sau khi boss ra chiêu
  }
  // Đồng Môn Trợ Uy (Cốt truyện × Tông môn): đánh trên map "chạm nhà" của phái mình +5% ST
  if (SECT_HOOK_MAP[curMap] === player.sect) final *= 1.05;
  // Sát thương hoàn hảo (vũ khí/dây chuyền): tỉ lệ % gây ×2 sát thương
  if (player.perfectProc && Math.random() < player.perfectProc){
    final *= 2; perfectNote = true;
  }
  // Xuyên giáp (áo choàng/cung tiễn): tăng sát thương theo %
  if (player.pierce) final *= 1 + player.pierce;
  if (m.shield > 0){
    if (source === 'amkhi'){
      m.shield = 0; m.shieldT = 10 + (player.shieldBonus || 0); // P0: cửa sổ phá khiên 10s · Đoạn Ngọc Thủ +4s
      addFloat(m.x, m.y-24, 'PHÁ HUYỆT!', '#c07fe0', 16);
      addEffect({ type:'ring', x:m.x, y:m.y, r:50, color:'#c07fe0' });
    } else {
      final *= 0.3; shieldNote = true;
    }
  }
  // Giáp quái: giảm sát thương theo công thức mềm (trước đây chỉ số def của quái không được dùng)
  if (m.def.def) final *= 1 - m.def.def / (m.def.def + 250);
  final = Math.max(1, Math.round(final));
  m.hp -= final; m.hitT = 0.15;
  // phản hồi lực đòn: chỉ đòn tay (Space) mới khựng hình + lắc camera — DoT/kỹ năng/pet không spam
  if (source === 'crit'){ hitStop = Math.max(hitStop, 0.08); shakeT = Math.max(shakeT, 0.2); shakeMag = Math.max(shakeMag, 5); addEffect({ type:'critflash', x:m.x, y:m.y, r:(m.def.size||14)+22 }); }
  else if (source === 'hit'){ hitStop = Math.max(hitStop, 0.04); shakeT = Math.max(shakeT, 0.14); shakeMag = Math.max(shakeMag, 2.4); }
  AudioSys.sfx(source === 'crit' || perfectNote ? 'crit' : 'hit', source === 'crit' ? 0.8 : 0.5);
  // đòn thường vào cùng 1 quái → cộng dồn 1 số duy nhất (đỡ rối màn hình); đòn đặc biệt vẫn bay riêng
  if (!perfectNote && !counterNote && !counteredNote && !shieldNote){
    addDmgFloat(m, m.x + rnd(-8,8), m.y - m.def.size - 6, final, source==='crit' ? '#ffd76a' : '#fff', source==='crit' ? 17 : 13);
  } else {
    addFloat(m.x + rnd(-8,8), m.y - m.def.size - 6,
      (perfectNote ? 'HOÀN HẢO! ' : '') + (counterNote ? 'KHẮC HỆ! ' : '') + (counteredNote ? 'bị khắc ' : '') + (shieldNote ? final+' (chống)' : String(final)),
      perfectNote ? '#ff9df0' : counterNote ? '#5db86a' : counteredNote ? '#8a94a8' : (shieldNote ? '#8a8a8a' : (source==='crit' ? '#ffd76a' : '#fff')),
      source==='crit'||perfectNote ? 17 : (counterNote?15:13));
  }
  // tương khắc: tia hào quang hệ thắng bao quanh quái
  if (counterNote) addEffect({ type:'ring', x:m.x, y:m.y, r:26 + m.def.size, color:NGU_HANH[sectEl].color });
  // Hút sinh lực / nội lực (vũ khí · dây chuyền · pet)
  if (player.hpLeech) player.hp = Math.min(player.maxHp, player.hp + final * player.hpLeech);
  if (player.qiLeech) player.qi = Math.min(player.maxQi, player.qi + final * player.qiLeech);
  // Đạn Chỉ Thần Thông (Đan Điền tầng 4): 5% phong mạch — địch không thể tấn công 2s
  if (player.stunProc && Math.random() < player.stunProc && !m.def.boss){
    m.atkT = Math.max(m.atkT, 2.0);
    addFloat(m.x, m.y-34, 'PHONG MẠCH!', '#9fd0ff', 12);
    addEffect({ type:'ring', x:m.x, y:m.y, r:34, color:'#9fd0ff' });
  }
  // Huyết Ma Thôn Phệ (bí kíp giang hồ): hút 10% sát thương gây ra
  if (player.bikip && player.bikip.hmtp){
    player.hp = Math.min(player.maxHp, player.hp + final * 0.10);
  }
  // Bắc Minh Thần Công (Võ Học Phổ): hút 25% sát thương thành sinh lực khi buff còn
  if ((player.vhLeechT || 0) > 0){
    player.hp = Math.min(player.maxHp, player.hp + final * 0.25);
  }
  if (m.hp <= 0) killMob(m, source);
}
function killMob(m, source){
  m.dead = true; m.deadT = 0.45; // xác tan dần thành mực thay vì biến mất tức thì
  shakeT = Math.max(shakeT, 0.2); shakeMag = Math.max(shakeMag, m.def.boss ? 8 : m.def.elite ? 5 : 3); // hạ quái có lực
  AudioSys.sfx('die', 0.6);
  AudioSys.sfx('coin', 0.5);
  tutAdvance('kill'); // hướng dẫn tân thủ: hạ quái đầu tiên
  // GDD Mob Mechanics: hồi sinh cực nhanh 3-5s để treo auto không đứt combo
  m.respawnT = m.type === 'boss' ? 0 : (m.def.bossKind ? 60 : rnd(3, 5)); // Boss Vùng/Trấn Ải hồi 60s
  // Giết Du Hiệp: PK dã ngoại bị Tội Ác (đỏ tên); Huyết Chiến thì thoải mái
  if (m.def.duHiep){
    // A3: Du Hiệp ghi thù — nemesis-lite
    player.dhHate[m.type] = (player.dhHate[m.type] || 0) + 1;
    if (m.revenge){
      player.revengeKills = (player.revengeKills || 0) + 1;
      player.silver += 120; player.mat += 2;
      addFloat(m.x, m.y-70, `TÚC THÙ ĐÃ TRẢ (${player.revengeKills}) — thưởng thêm 120◈ 2✦`, '#f0a03a', 14);
      checkTitles();
    } else {
      addFloat(m.x, m.y-70, player.dhHate[m.type] >= 2 ? 'Thù hận sâu thêm — lần sau gặp, hắn sẽ TRUY THÙ!' : 'Du Hiệp sẽ ghi nhớ mối thù này...', '#e84a6a', 13);
    }
    if (mapDef().type === 'pk'){
      if (player.traitSatTam){ addFloat(player.x, player.y-64, 'Sát Tâm — giết không lưu Tội Ác!', '#b08ae8', 13); }
      else {
      player.toiac = (player.toiac || 0) + 1;
      addFloat(player.x, player.y-64, `TỘI ÁC +1 (${player.toiac}) — tên ngươi đỏ lên!`, '#ff3a3a', 16);
      }
      addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:'#ff3a3a', big:true });
    } else {
      addFloat(player.x, player.y-64, 'Hạ Du Hiệp — Huyết Chiến không Tội Ác!', '#e8b04a', 13);
    }
  }
  const _kb = (m.def.boss || m.def.bossKind) ? 2 : m.def.elite ? 1.4 : 1; // juice hạ quái theo phẩm (Gói E)
  addEffect({ type:'ring', x:m.x, y:m.y, r:m.def.size*3*_kb, color:'#3a332a' });
  if (_kb > 1) addEffect({ type:'ring', x:m.x, y:m.y, r:m.def.size*4.5*_kb, color:m.def.color, big:true });
  for (let i=0;i<Math.round(8*_kb);i++) addEffect({ type:'ink', x:m.x, y:m.y, vx:rnd(-70,70)*_kb, vy:rnd(-90,-20)*_kb, color:m.def.color });
  // xp & silver (Pet: +EXP% · trang bị: +đồng rơi%)
  // luật chênh cấp: quái thấp hơn mình >5 cấp → EXP giảm dần 15%/cấp (tối thiểu 10%) — phạt farm vùng thấp, drop giữ nguyên
  const _diff = player.level - m.def.lv;
  const _xpMul = _diff <= 5 ? 1 : Math.max(0.1, 1 - 0.15*(_diff - 5));
  const _xp = Math.round(m.def.xp * _xpMul);
  gainXp(_xp);
  const sil = Math.round(rnd(m.def.silver[0], m.def.silver[1]) * (1 + (player.silverPct || 0)/100));
  player.silver += sil;
  addFloat(player.x, player.y-30, `+${_xp} EXP${_xpMul < 1 ? ` (-${Math.round((1-_xpMul)*100)}% chênh cấp)` : ''}  +${sil}◈`, _xpMul < 1 ? '#c8b888' : '#f0d68a', 12);
  // Pet rơi từ tinh anh (12%) / boss (40%); Cánh từ boss (12%)
  if (!m.def.boss && m.def.elite && Math.random() < 0.12 && player.inv.length < 30){
    const pi = Math.random() < 0.7 ? 0 : Math.random() < 0.8 ? 1 : 2;
    player.inv.push(genPet(pi));
    addFloat(m.x, m.y-88, `Pet: ${PET_DEFS[pi].name}!`, PET_DEFS[pi].color, 13);
  }
  if (m.def.boss){
    if (Math.random() < 0.4 && player.inv.length < 30){
      const pi = Math.floor(Math.random()*3);
      player.inv.push(genPet(pi));
      addFloat(m.x, m.y-102, `Pet: ${PET_DEFS[pi].name}!`, PET_DEFS[pi].color, 14);
    }
    if (Math.random() < 0.12 && player.inv.length < 30){
      const wi = Math.floor(Math.random()*2);
      player.inv.push(genWing(wi));
      addFloat(m.x, m.y-114, `${WING_DEFS[wi].name}!`, WING_DEFS[wi].color, 15);
    }
  }
  if (Math.random() < 0.3){ player.mat++; addFloat(m.x, m.y-40, '+1 ✦ Huyền Thiết', '#9fd0ff', 11); }
  player.kills++;
  player.khi += 10; // Chân Khí từ chiến đấu
  player.dantian.tuvi += 2; // Tu Vi từ chiến đấu — giảm thời gian ngồi thiền thuần túy (QA)
  dailyTrack('kills'); // Mục Tiêu Hôm Nay
  // gem drops: Tu La (sói+), Hỗn Nguyên (tinh anh/boss), Tiến Cấp Đan (sơn tặc+)
  if (m.def.lv >= 3 && Math.random() < 0.15){ player.gems.tuLa++; addFloat(m.x, m.y-52, '+1 ◆ Tu La Tinh Thạch', '#e84a6a', 11); }
  if (m.def.elite && Math.random() < 0.35){ player.gems.honNguyen++; addFloat(m.x, m.y-64, '+1 ❖ Hỗn Nguyên Thạch', '#b08ae8', 11); }
  if (m.def.lv >= 5 && Math.random() < 0.22){ player.tienDan++; addFloat(m.x, m.y-76, '+1 ◈ Tiến Cấp Đan', '#7ec850', 11); }
  // Tinh anh & boss rớt thêm Tiến Cấp Đan (Drop v2.0 — gắn vòng farm boss vào Tuyệt Học)
  const _tdB = m.def.bossKind === 'tranai' ? 8 : (m.def.bossKind === 'thuve' ? 3 : (m.type === 'boss' || m.def.boss) ? 5 : m.def.elite ? 1 : 0);
  if (_tdB){ player.tienDan += _tdB; addFloat(m.x, m.y-88, `+${_tdB} ◈ Tiến Cấp Đan`, '#7ec850', 11); }
  // Võ Học Phổ: Bí Kíp rơi từ tinh anh/boss — học võ học giang hồ (bấm K)
  const _bkR = m.def.bossKind === 'tranai' ? 0.35 : (m.def.bossKind === 'thuve' || m.def.boss) ? 0.12 : m.def.elite ? 0.03 : 0;
  if (_bkR && Math.random() < _bkR){ player.bikipVH = (player.bikipVH || 0) + 1; addFloat(m.x, m.y-100, '+1 📜 Bí Kíp', '#e8c84a', 13); }
  // Nội Đan yêu thú theo hành — tinh anh 30%, boss 100%
  if (m.def.el && (m.def.boss || (m.def.elite && Math.random() < 0.3))){
    player.noidan[m.def.el] = (player.noidan[m.def.el] || 0) + 1;
    addFloat(m.x, m.y-88, `+1 ● Nội Đan hệ ${m.def.el}`, NGU_HANH[m.def.el].color, 12);
    dailyTrack('noidan'); // Mục Tiêu Hôm Nay
  }
  // ── Drop v2.0: bảng rơi theo nguồn — quái thường chỉ fodder, đồ tốt từ tinh anh/boss ──
  const _dsrc = m.def.bossKind === 'tranai' ? 'tranai' : (m.def.boss || m.def.bossKind) ? 'thuve' : (m.def.elite ? 'elite' : 'mob');
  const _tbl = DROP_SRC[_dsrc];
  let _gotThan = false;
  for (let _di = 0; _di < (_tbl.drops || 1); _di++){
    if (Math.random() >= _tbl.chance + (player.dropBonus || 0)) continue;
    const it = genItem(Math.max(1, m.def.lv + (Math.random()<0.3?1:0)), 0, _dsrc);
    // Pity đai: Thủ Vệ 8 lần liên tiếp không ra Thần+ → bảo đảm 1 món Thần
    if (_dsrc === 'thuve' && m.def.bossKind === 'thuve' && (player.bossPity || 0) >= 8 && it.rarity < 3){
      it.rarity = 3; rerollItemRarity(it);
      addFloat(m.x, m.y-110, '☘ VẬN MAY TÍCH LŨY — bảo đảm Thần phẩm!', '#7fd8e0', 13);
    }
    if (it.rarity >= 3) _gotThan = true;
    // Tự động bán đồ Phàm đổi lấy bạc (bật trong Túi Đồ)
    if (player.autoSell && it.rarity <= 0){
      const v = 20 + it.rarity*30 + (it.tier||1)*15;
      player.silver += v;
      addFloat(m.x, m.y-54, `Tự bán ${it.name} +${v}◈`, '#b8a878', 11);
    }
    else if (player.inv.length < 30){ player.inv.push(it); addFloat(m.x, m.y-54, it.name, RARITIES[it.rarity].color, 12);
      if (it.rarity >= 2) addEffect({ type:'spark', x:m.x, y:m.y-12, r:32 + it.rarity*8, color:RARITIES[it.rarity].color }); tryAutoEquip(it); } // GDD Đợt 2 B7: tự mặc đồ mạnh hơn
  }
  if (m.def.bossKind === 'thuve') player.bossPity = _gotThan ? 0 : (player.bossPity || 0) + 1;
  // Vật liệu Drop v2.0: Mảnh Trang Bị (quái 8%, tinh anh 100%)
  if (!m.def.boss && !m.def.bossKind && Math.random() < (m.def.elite ? 1 : 0.08)){
    player.mats.manh++;
    addFloat(m.x, m.y-66, '+1 ❖ Mảnh Trang Bị', '#7ec8d8', 11);
  }
  // Tịch Ma Thạch từ Thủ Vệ (vé Tấn Phẩm) · Ấn Trấn Ải (Chinh Phạt ngày) + Mảnh Cổ Thần từ Trấn Ải
  if (m.def.bossKind === 'thuve'){
    const _tm = 1 + (Math.random() < 0.5 ? 1 : 0);
    player.mats.tichMa += _tm;
    addFloat(m.x, m.y-92, `+${_tm} ◆ Tịch Ma Thạch`, '#e84a6a', 13);
  }
  if (m.def.bossKind === 'tranai'){
    player.mats.manhCoThan += 2;
    addFloat(m.x, m.y-92, '+2 ◈ Mảnh Cổ Thần', '#f0d68a', 13);
    const _today = new Date().toDateString();
    if (!player.chinhPhat || player.chinhPhat.date !== _today) player.chinhPhat = { date:_today, count:0 };
    if (player.chinhPhat.count < 1){
      player.chinhPhat.count++;
      player.mats.anTranAi++;
      addFloat(m.x, m.y-106, '☬ ẤN TRẤN ẢI — Chinh Phạt hoàn thành (1/ngày)!', '#e8c84a', 15);
    }
  }
  // quests
  const q = QUESTS[questIdx];
  if (q && questState==='active'){
    if (q.type==='kill' && q.mob===m.type) questProg++;
    if (q.type==='tpkill' && q.mob===m.type && source==='tp') questProg++;
    if (q.type==='boss' && m.type==='boss') questProg++;
    if (questProg >= q.need && (q.type==='kill'||q.type==='tpkill'||q.type==='boss')){
      questState = 'done';
      if (q.type==='boss'){ victory = true; showVictory(); }
      else addFloat(player.x, player.y-46, `Nhiệm vụ hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13);
    }
  }
  sideOnKill(m.type, source);
  if (m.def.boss) AudioSys.playBgm(BGM_TRACKS[curMap]); // hạ boss — trở lại nhạc map
  // Boss: Tàn Quyển bí kíp Huyết Ma Thôn Phệ (Thượng 40% / Trung 40% / Hạ 20%)
  if (m.def.boss && player.bikip && !player.bikip.hmtp){
    const roll = Math.random();
    const piece = roll < 0.4 ? 0 : roll < 0.8 ? 1 : 2;
    player.bikip.pieces[piece]++;
    addFloat(m.x, m.y-90, `Tàn Quyển · ${TAN_QUYEN[piece]}!`, '#e84a6a', 14);
  }
  // Tứ Châu (Track HT): boss 41% rơi châu, tinh anh 3% Chúc Phúc
  if (m.def.boss && player.jewels){
    const jr = Math.random();
    let jk = null;
    if (jr < 0.20) jk = 'chucPhuc'; else if (jr < 0.32) jk = 'linhHon';
    else if (jr < 0.38) jk = 'sinhMenh'; else if (jr < 0.41) jk = 'honDon';
    if (jk){ player.jewels[jk]++; addFloat(m.x, m.y-104, `+1 ${JEWEL_NAMES[jk]}`, JEWEL_COLORS[jk], 13); }
  } else if (m.def.elite && player.jewels && Math.random() < 0.03){
    player.jewels.chucPhuc++; addFloat(m.x, m.y-104, `+1 ${JEWEL_NAMES.chucPhuc}`, JEWEL_COLORS.chucPhuc, 12);
  }
  // Ma Tôn Giáng Thế: hạ boss nhận Bảo Hạp theo vùng cấp
  if (m.type === 'maton') matonKilled(m);
  // Truy Nã Lệnh: mục tiêu ngày bị hạ
  if (m.truyna && player.truyna && player.truyna.state === 'hunting'){
    player.truyna.state = 'killed';
    zoneBanner = { text:'⚖ TRUY NÃ HOÀN THÀNH', sub:'Mục tiêu đã phục pháp — về Tương Dương gặp Bổ Đầu nhận Công Huân Lệnh!', color:'#e8b04a', t:5 };
    AudioSys.sfx('quest', 0.85); saveGame();
  }
  // ── Boss Vùng/Trấn Ải: mở ải + manh mối + cờ cốt truyện (GDD Boss v2.1 / Ngũ Ấn Phong Ma) ──
  if (m.def.bossKind){
    const _bk = (player.bossKills[curMap] = player.bossKills[curMap] || []);
    if (!_bk.includes(m.def.bossId)) _bk.push(m.def.bossId);
    const _bd = BOSS_DEFS[curMap];
    if (_bd){
      const doneTv = _bd.thuve.filter(tv => _bk.includes(tv.id)).length;
      if (m.def.bossKind === 'thuve'){
        zoneBanner = { text:`⚔ THỦ VỆ BỊ HẠ — TRẬN NHÃN ${doneTv}/3`,
          sub: doneTv >= 3 ? '☬ Tế Đàn đã mở! Trấn Ải chờ ở góc đông nam bản đồ.' : 'Hạ nốt Thủ Vệ còn lại để mở Tế Đàn.',
          color:'#c07fe0', t:3.5 };
        AudioSys.sfx('quest', 0.8);
      } else {
        zoneBanner = { text:`☬ TRẤN ẢI ${m.def.name.toUpperCase()} ĐÃ BỊ ĐÁNH BẠI!`,
          sub:'Phong ấn ngũ hành vùng này tạm được giữ vững — phần thưởng Chinh Phạt đã trao.', color:'#e8c84a', t:4.5 };
        AudioSys.sfx('levelup', 0.9);
        player.storyFlags['ta_' + curMap] = true;
        if (curMap === 'nhanmon' && !player.storyFlags.ketMo){ player.storyFlags.ketMo = true; setTimeout(showKetMo, 1400); }
      }
    }
    const clueId = CLUE_DROPS[m.def.bossId];
    if (clueId && !player.clues.includes(clueId)){
      player.clues.push(clueId);
      addFloat(m.x, m.y-120, `📜 Manh mối: ${CLUES[clueId].name}`, '#e8dcb0', 13);
      AudioSys.sfx('quest', 0.6);
    }
    saveGame();
  }
  checkTitles();
}
function gainXp(amount){
  if (player.level >= MAX_LV) return;
  if (isNightGame()) amount *= 1.1; // Lịch Tu Tiên: tu luyện ban đêm +10% EXP
  player.xp += Math.round(amount * 1.5 * (1 + (player.expPct || 0)/100)); // EXP ×1.5 (đẩy nhịp farm) · Pet: +EXP% · QA F6: XP luôn nguyên
  while (player.level < MAX_LV && player.xp >= XP_TABLE[player.level-1]){
    player.xp -= XP_TABLE[player.level-1];
    player.level++; player.free += 5;
    AudioSys.sfx('levelup', 0.9);
    calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
    addFloat(player.x, player.y-52, `THĂNG CẤP ${player.level}!`, '#ffd76a', 20);
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:'#ffd76a' });
    unlockNotices();
    saveGame(); // QA F6: autosave ngay khi thăng cấp — tránh mất tiến trình
  }
  if (player.level >= MAX_LV) player.xp = 0;
}
function unlockNotices(){
  // QA bot playtest: NV đang khóa cấp (vd. Bình Cảnh Chi Chiến cần cấp 10) — mở lại khi thăng cấp đủ
  const cq0 = currentQuest();
  if (cq0 && questState === 'locked' && player.level >= cq0.lv){
    questState = 'active';
    if (cq0.type === 'boss') spawnBoss();
    addFloat(player.x, player.y-64, `Đủ sức đột phá! Nhiệm vụ mở: ${cq0.name}`, '#ffd76a', 15);
    AudioSys.sfx('quest', 0.8);
  }
  // Mở khóa theo tầng — mỗi cấp chỉ giới thiệu 1-2 hệ thống để tân thủ không bị ngợp
  const msgs = {
    2:['Mở khóa: Chiêu thức (phím 1)'],
    3:['Mở khóa: Mục Tiêu Hôm Nay — xem góc trái màn hình, xong hết nhận thưởng lớn!'],
    4:['Mở khóa: Ám Khí (phím 2)','Mở khóa: Tuyệt Học — tấn chức Ám Khí (phím H)'],
    5:['Mở khóa: Rèn Luyện (phím F)'],
    6:['Mở khóa: Thú Chiến — chiến thú đồng hành tự đánh quái (C → Thú Chiến)'],
    7:['Mở khóa: Tuyệt kỹ (phím 3)','Mở khóa: Đan Điền tu luyện (phím N)'],
    10:['Mở khóa: Bái Sư Nhập Phái — 7 môn phái chờ ngươi chọn!','Mở khóa: Cương Khí (Tuyệt Học — phím H)','Mở khóa: Truy Nã Lệnh & Vạn Duyên Các — Bổ Đầu và Thần Toán Tử ở Tương Dương'],
    15:['Mở khóa: Linh Thú — mua Phong Linh Phù ở Vũ Khí Phường, đánh tinh anh còn <40% máu rồi bấm T'],
    40:['Mở khóa: Hỗn Độn Lò luyện Linh Dực Cấp 1 — Lò Bát Quái, Tương Dương'],
    45:['Bảo Hạp IV trở lên từ Ma Tôn có 5-8% mở ra trang bị CỔ THẦN Tứ Tượng — Ma Tôn giáng thế mỗi 4 giờ!'],
    20:['Mở khóa: Kinh Mạch (Đan Điền — phím N)'],
    30:['Mở khóa: Cung Tiễn (Tuyệt Học — phím H)','Mở khóa: Động Phủ — gặp Quản Gia ở Tương Dương'],
  };
  const list = msgs[player.level];
  if (list) list.forEach((m, i)=> setTimeout(()=>{ if (player) addFloat(player.x, player.y-70, m, '#a0ffe9', 14); }, i*700));
  // Tán Nhân đạt cấp 10 → mở lễ Bái Sư một lần (sau đó tự chọn ở panel Nhân Vật)
  if (player.level >= 10 && player.sect === 'vophai' && !player.sectOffered){
    player.sectOffered = true;
    setTimeout(()=>{ try{ openSectCeremony(); }catch(e){} }, 1800);
  }
  vhAutoLearn(); // Võ Học Phổ: võ học môn phái tự ngộ khi đạt cấp
  checkTitles();
}

// ---------- Danh hiệu: tự động mở khóa khi đạt điều kiện ----------
function checkTitles(){
  if (!player || !player.titles) return;
  let changed = false;
  for (const t of TITLES){
    if (player.titles.unlocked.includes(t.id)) continue;
    let ok = false;
    try { ok = t.cond(player); } catch(e){ ok = false; }
    if (ok){
      player.titles.unlocked.push(t.id);
      if (!player.titles.equipped) player.titles.equipped = t.id;
      changed = true;
      addFloat(player.x, player.y-92, `★ DANH HIỆU: ${t.name}!`, t.color, 16);
      addEffect({ type:'ring', x:player.x, y:player.y, r:80, color:t.color, big:true });
    }
  }
  if (changed){ calcDerived(); saveGame(); }
}

function nearestMob(range){
  let best = null, bd = range;
  for (const m of mobs){
    if (m.dead) continue;
    if (m.def.duHiep && !player.pk && !m.revenge) continue; // Du Hiệp chỉ đánh được khi bật PK (trừ kẻ truy thù)
    const d = dist(player.x, player.y, m.x, m.y);
    if (d < bd){ bd = d; best = m; }
  }
  return best;
}
function spawnSlash(x, y, face, s){ addEffect({ type:'slash', x, y, face, s: s || 110 }); }
// P0: Hồ Lô Thuốc — hồi 40% max HP, cooldown 20s (phím R)
function usePotion(){
  if (!player || dead) return;
  if (player.potions <= 0){ addFloat(player.x, player.y-40, 'Hết Hồ Lô Thuốc — mua ở Thương Nhân!', '#8a8a8a', 12); AudioSys.sfx('ui', 0.4); return; }
  if (player.potionCd > 0){ addFloat(player.x, player.y-40, `Thuốc còn hồi ${Math.ceil(player.potionCd)}s`, '#8a8a8a', 11); return; }
  if (player.hp >= player.maxHp){ addFloat(player.x, player.y-40, 'Máu đã đầy!', '#8a8a8a', 11); return; }
  player.potions--; player.potionCd = 20;
  const heal = Math.round(player.maxHp * (player.potionPct || 0.4));
  player.hp = Math.min(player.maxHp, player.hp + heal);
  addFloat(player.x, player.y-40, `+${heal}`, '#6ae88a', 16);
  addEffect({ type:'ring', x:player.x, y:player.y, r:46, color:'#6ae88a' });
  for (let i=0;i<5;i++) addEffect({ type:'ink', x:player.x, y:player.y-10, vx:rnd(-40,40), vy:rnd(-70,-20), color:'#6ae88a' });
  AudioSys.sfx('quest', 0.5);
  saveGame();
}
function doBasic(){
  if (!player || dead || player.cd.basic > 0) return;
  const t = nearestMob(90);
  if (t) player.face = Math.atan2(t.y-player.y, t.x-player.x);
  player.cd.basic = player.aspd; player.atkAnim = 0.22;
  AudioSys.sfx('slash', 0.55);
  addEffect({ type:'arc', x:player.x, y:player.y, face:player.face, r:60, color:'#2b2620' });
  spawnSlash(player.x + Math.cos(player.face)*36, player.y + Math.sin(player.face)*36 - 12, player.face, 95);
  if (t){
    let dmg = player.atk * rnd(0.9,1.12);
    let src = 'hit';
    if (Math.random() < player.crit){ dmg *= (player.critDmgMult || 2); src = 'crit'; }
    hurtMob(t, dmg, src);
    // Cung Tiễn: đòn đánh thường có tỉ lệ phóng linh tiễn theo sau
    const bowT = BOW_TIERS[(player.bow && player.bow.tier) || 0];
    if (bowT && !t.dead && Math.random()*100 < bowT.proc){
      const arrows = (bowT.double && Math.random() < bowT.double) ? 2 : 1;
      for (let i = 0; i < arrows; i++){
        const ang = Math.atan2(t.y-player.y, t.x-player.x) + rnd(-0.09, 0.09);
        projectiles.push({ x:player.x, y:player.y-12, ang, speed:520, dmg:player.atk*bowT.pdmg, kind:'bow', life:0.9, color:bowT.color });
      }
      addEffect({ type:'arc', x:player.x, y:player.y, face:player.face, r:30, color:bowT.color });
    }
  }
}
// Lăng Ba Vi Bộ — jump (unlocked at Đan Điền cảnh 7, nhảy 2 lần trên không)
function doJump(){
  if (!player || dead) return;
  if (!player.canJump){ addFloat(player.x, player.y-34, 'Cần Nguyên Anh Trung Kỳ (Đan Điền cảnh 7)', '#8a8a8a', 12); return; }
  const airborne = player.jumpT > 0;
  if (!airborne && player.cd.jump > 0) return; // cooldown chỉ chặn cú nhảy từ mặt đất
  if (airborne && (player.jumpsLeft || 0) <= 0) return;
  // jump toward current movement input, else facing
  let dx = 0, dy = 0;
  if (keys['w']||keys['arrowup']) dy -= 1;
  if (keys['s']||keys['arrowdown']) dy += 1;
  if (keys['a']||keys['arrowleft']) dx -= 1;
  if (keys['d']||keys['arrowright']) dx += 1;
  dx += joyVec.x; dy += joyVec.y;
  const l = Math.hypot(dx, dy);
  if (l > 0.01){ dx /= l; dy /= l; } else { dx = Math.cos(player.face); dy = Math.sin(player.face); }
  player.jumpDir = { x: dx, y: dy };
  player.jumpT = player.jumpDur;
  if (airborne){
    player.jumpsLeft--;
    addFloat(player.x, player.y-60, 'Không Trung Túc Ảnh!', '#c8e8ff', 12);
    addEffect({ type:'ring', x:player.x, y:player.y+20, r:30, color:'#c8e8ff' });
  } else {
    player.jumpsLeft = (player.maxJumps || 1) - 1;
    player.cd.jump = 0; // QA: Lăng Ba Vi Bộ không thời gian chờ
  }
  AudioSys.sfx('jump', 0.7);
  addEffect({ type:'ring', x:player.x, y:player.y, r:46, color:'#9fd8ff' });
  addFloat(player.x, player.y-44, 'Lăng Ba Vi Bộ!', '#9fd8ff', 13);
  flashSkill('sk-jump');
}
function castSkill(which){
  if (!player || dead) return;
  const sect = SECTS[player.sect];
  let def, key = which;
  if (which==='a'){ if (player.level<2) return lockedMsg(2); def = sect.skillA; }
  else if (which==='b'){ if (player.level<4) return lockedMsg(4); def = AMKHI; }
  else { if (player.level<9) return lockedMsg(9); def = { cd:TP_CD, qi: player.level < 20 ? Math.round(TP_QI*0.7) : TP_QI, mult:sect.tp.mult }; }
  if (player.cd[key] > 0) return;
  if (player.qi < def.qi){ addFloat(player.x, player.y-34, 'Không đủ Chân Khí!', '#7fa8e0', 12); return; }
  player.qi -= def.qi; player.cd[key] = def.cd;

  if (which==='b'){ // ám khí projectile
    const t = nearestMob(360);
    const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = ang;
    projectiles.push({ x:player.x, y:player.y, ang, speed:460, dmg:player.atk*def.mult*(1+(player.amkhiPct||0)+(player.skillDmgPct||0)), kind:'amkhi', life:0.85, color:'#e8e8ff' });
    addEffect({ type:'arc', x:player.x, y:player.y, face:ang, r:40, color:'#aab' });
    spawnSlash(player.x + Math.cos(ang)*30, player.y + Math.sin(ang)*30 - 12, ang, 80);
    return;
  }
  if (which==='c'){ // Trấn Phái — big AoE
    spawnSkillVfx('sx_' + player.sect + '_c', { color:sect.color, glyph:'鎮' }, 'aoe', player.face, TP_RADIUS);
    addEffect({ type:'ring', x:player.x, y:player.y, r:TP_RADIUS, color:sect.color, big:true });
    addEffect({ type:'ring', x:player.x, y:player.y, r:TP_RADIUS*0.6, color:sect.glow, big:true });
    // kiếm khí quét quanh người — 6 đạo tỏa ra mọi hướng
    for (let i = 0; i < 6; i++){
      const a = i * Math.PI/3 + player.face;
      spawnSlash(player.x + Math.cos(a)*70, player.y + Math.sin(a)*70 - 10, a, 170);
    }
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) < TP_RADIUS + m.def.size){
        let dmg = player.atk * def.mult * rnd(0.95,1.1) * (1 + (player.skillDmgPct || 0));
        let src = 'tp';
        if (Math.random() < player.crit){ dmg *= 2; }
        hurtMob(m, dmg, src);
      }
    }
    flashSkill('sk-c');
    return;
  }
  // skill A by sect type
  const type = sect.skillA.type;
  const _sva = 'sx_' + player.sect + '_a';
  if (type==='cone'){
    const t = nearestMob(160);
    if (t) player.face = Math.atan2(t.y-player.y, t.x-player.x);
    spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'cone', player.face, 120);
    addEffect({ type:'cone', x:player.x, y:player.y, face:player.face, r:120, color:sect.color });
    spawnSlash(player.x + Math.cos(player.face)*62, player.y + Math.sin(player.face)*62 - 12, player.face, 160);
    for (const m of mobs){
      if (m.dead) continue;
      const d = dist(player.x, player.y, m.x, m.y);
      if (d < 125 + m.def.size){
        let da = Math.atan2(m.y-player.y, m.x-player.x) - player.face;
        while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI;
        if (Math.abs(da) < 1.0) hurtMob(m, player.atk*def.mult*rnd(0.9,1.1), Math.random()<player.crit?'crit':'hit');
      }
    }
  } else if (type==='proj'){
    const t = nearestMob(420);
    const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = ang;
    const _svc = SECT_VFX[_sva];
    projectiles.push({ x:player.x, y:player.y, ang, speed:420, dmg:player.atk*def.mult, kind:'skill', life:1.0, color:sect.color, pierce:true, style:(_svc && _svc.proj) || undefined });
    spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'cast', ang, 60);
    spawnSlash(player.x + Math.cos(ang)*34, player.y + Math.sin(ang)*34 - 12, ang, 120);
  } else if (type==='selfaoe'){
    spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'aoe', player.face, 135);
    addEffect({ type:'ring', x:player.x, y:player.y, r:135, color:sect.color });
    for (let i = 0; i < 4; i++){
      const a = i * Math.PI/2 + Math.PI/4;
      spawnSlash(player.x + Math.cos(a)*52, player.y + Math.sin(a)*52 - 10, a, 130);
    }
    for (let i=0;i<10;i++) addEffect({ type:'ink', x:player.x+rnd(-90,90), y:player.y+rnd(-90,90), vx:rnd(-30,30), vy:rnd(-60,-10), color:sect.color });
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) < 140 + m.def.size)
        hurtMob(m, player.atk*def.mult*rnd(0.9,1.1), Math.random()<player.crit?'crit':'hit');
    }
  } else if (type==='dash'){
    spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'dash', player.face, 150, player.x, player.y);
    const t = nearestMob(220);
    const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = ang;
    player.x = clamp(player.x + Math.cos(ang)*130, 20, MAP.w-20);
    player.y = clamp(player.y + Math.sin(ang)*130, 20, MAP.h-20);
    addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:sect.color });
    spawnSlash(player.x + Math.cos(ang)*40, player.y + Math.sin(ang)*40 - 12, ang, 140);
    const t2 = nearestMob(110);
    if (t2) hurtMob(t2, player.atk*def.mult*rnd(0.95,1.15), Math.random()<player.crit?'crit':'hit');
  }
  flashSkill('sk-a');
}
function lockedMsg(lv){ addFloat(player.x, player.y-34, `Mở khóa ở cấp ${lv}`, '#8a8a8a', 12); }
function flashSkill(id){
  const el = document.getElementById(id);
  el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 180);
}

// ---------- Quests / NPC ----------
function currentQuest(){ return questIdx < QUESTS.length ? QUESTS[questIdx] : null; }

// ---------- GDD Đợt 2 B3: Nhắc Việc Bấm Ngay ----------
function anyPanelOpen(){
  return ['panel-char','panel-inv','panel-bag','panel-skill','panel-map','panel-quest','panel-settings','panel-qlog','panel-relation']
    .some(id => { const e2 = document.getElementById(id); return e2 && !e2.classList.contains('hidden'); });
}
function hintCandidates(){
  const out = [];
  const realm = (player.dantian && player.dantian.realm) || 0;
  const dr = DANTIAN_REALMS[realm + 1];
  if (dr && dr.cost && player.dantian.tuvi >= dr.cost.tuvi && player.silver >= dr.cost.silver && player.mat >= dr.cost.mat)
    out.push({ id:'dotpha', pri:1, txt:'☯ Đã đủ tư lương <b>Đột Phá</b> cảnh giới kế tiếp — sức mạnh bước ngoặt!', btn:'Đột Phá Ngay', act:"togglePanel('dantian')" });
  if ((player.free || 0) >= 10)
    out.push({ id:'tiemnang', pri:2, txt:`💠 Còn <b>${player.free}</b> điểm Tiềm Năng chưa phân — cộng ngay cho khỏi phí!`, btn:'Phân Ngay', act:"togglePanel('char')" });
  if (player.mount.tier === 0 && player.level >= 6)
    out.push({ id:'mount0', pri:3, txt:'🐎 Cấp 6+ đã có thể nhận <b>Bạch Mã</b> tại Trại Ngựa (Ngoại Ô) — đi bộ mãi làm gì!', btn:'Xem Ngay', act:'hintGoStable()' });
  else {
    const nx = MOUNT_TIERS[player.mount.tier + 1];
    if (nx && nx.cost && player.level >= (nx.reqLv || 1) && player.silver >= nx.cost.silver && player.mat >= Math.max(0, nx.cost.mat - Math.min(player.maThau || 0, 3)*4))
      out.push({ id:'mountup', pri:4, txt:`🐎 Đủ tư lương thăng giai thú cưỡi → <b style="color:${nx.color}">${nx.name}</b>!`, btn:'Thăng Giai', act:"togglePanel('mount')" });
  }
  if (questIdx >= 4 && player.mat >= 3){
    const weak = Object.values(player.equip).some(it => it && !it.special && (it.plus || 0) < 3);
    if (weak) out.push({ id:'forge', pri:5, txt:'⚒ Đang dư Huyền Thiết mà trang bị chưa +3 — đi rèn ngay!', btn:'Đi Rèn', act:'hintGoForge()' });
  }
  return out;
}
window.hintGoStable = function(){
  const n = NPCS.find(x => x.id === 'traichu');
  if (n){ player.beacon = { map:n.map, x:n.x, y:n.y, label:'Trại Ngựa' }; if (n.map !== curMap) travelTo(n.map); }
  hintHide();
};
window.hintGoForge = function(){
  const n = NPCS.find(x => x.talk === 'forge');
  if (n){ player.beacon = { map:n.map, x:n.x, y:n.y, label:'Lò Bát Quái' }; if (n.map !== curMap) travelTo(n.map); }
  hintHide();
};
window.hintHide = function(){ const t = el('hint-toast'); if (t) t.classList.add('hidden'); window._hintId = null; };
window.hintDismiss = function(id){ player.hintOff[id] = true; hintHide(); saveGame(); };
function updateHints(dt){
  window._hintT = (window._hintT || 0) - dt;
  if (window._hintT > 0) return;
  window._hintT = 1.2; // quét 1.2s/lần — khỏi tốn hiệu năng
  const t = el('hint-toast'); if (!t) return;
  if (DGN || !player || dead || player.combatT > 0 || anyPanelOpen()){
    if (!t.classList.contains('hidden')) t.classList.add('hidden');
    return;
  }
  const now = performance.now();
  const c = hintCandidates()
    .filter(x => !player.hintOff[x.id] && (!player.hintCd[x.id] || now - player.hintCd[x.id] > 300000))
    .sort((a, b) => a.pri - b.pri)[0];
  if (!c){ if (!t.classList.contains('hidden')){ t.classList.add('hidden'); window._hintId = null; } return; }
  if (window._hintId !== c.id){
    window._hintId = c.id;
    player.hintCd[c.id] = now;
    t.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start"><span style="flex:1">${c.txt}</span><span style="cursor:pointer;opacity:.7;flex:none" onclick="hintDismiss('${c.id}')">✕</span></div>
      <button class="hint-btn" onclick="${c.act};hintHide()">${c.btn}</button>`;
    t.classList.remove('hidden');
  }
}


// ---------- GDD Đợt 2 B2: đích đến nhiệm vụ + ghim dẫn đường ----------
function questTarget(q){
  if (!q) return null;
  const npcId = q.targetNpc || q.npc;
  if (q.type === 'talk' || questState === 'done'){
    const n = NPCS.find(x => x.id === npcId);
    if (n) return { map:n.map, x:n.x, y:n.y, label:'Gặp ' + n.name };
  }
  if (q.type === 'meditate' && typeof SPRING !== 'undefined') return { map:'daohoa', x:SPRING.x, y:SPRING.y, label:'Tịnh Tâm Tuyền' };
  if (q.type === 'enhance'){ const n = NPCS.find(x => x.talk === 'forge'); if (n) return { map:n.map, x:n.x, y:n.y, label:'Lò Bát Quái' }; }
  if (q.type === 'collect' && typeof HERB_SPOTS !== 'undefined') return { map:'daohoa', x:HERB_SPOTS[0].x, y:HERB_SPOTS[0].y, label:'Bãi Thảo Dược' };
  if (q.type === 'boss' && typeof BOSS_ARENA !== 'undefined') return { map:'daohoa', x:BOSS_ARENA.x, y:BOSS_ARENA.y, label:'Đài Bình Cảnh' };
  if (q.mob){
    let best = null;
    for (const id in MAPS){
      const md = MAPS[id];
      if (md.dungeon || !md.packs) continue;
      const pk = md.packs.find(p => p.mob === q.mob);
      if (pk && (!best || id === q.map)){ best = { map:id, x:pk.x, y:pk.y }; if (id === q.map) break; }
    }
    if (best){
      const mdef = (typeof MOBS !== 'undefined') && MOBS[q.mob];
      best.label = 'Săn ' + (mdef ? mdef.name : q.mob);
      return best;
    }
  }
  if (npcId){ const n = NPCS.find(x => x.id === npcId); if (n) return { map:n.map, x:n.x, y:n.y, label:'Gặp ' + n.name }; }
  return null;
}
function sideQuestTarget(sq){
  const st = sideStates[sq.id];
  const n = NPCS.find(x => x.id === sq.npc);
  if (!st || st.st === 'done' || st.st === 'claimed' || !sq.mob){
    if (n) return { map:n.map, x:n.x, y:n.y, label:(st && st.st === 'done' ? 'Trả NV: ' : 'Nhận NV: ') + (n ? n.name : '') };
  }
  if (sq.type === 'catch'){
    const hz = (typeof HORSE_ZONES !== 'undefined') && HORSE_ZONES[sq.map];
    if (hz) return { map:sq.map, x:hz[0].x, y:hz[0].y, label:'Đồng Tuấn Mã' };
  }
  if (sq.type === 'collect' && typeof HERB_SPOTS !== 'undefined') return { map:sq.map, x:HERB_SPOTS[0].x, y:HERB_SPOTS[0].y, label:'Bãi Thảo Dược' };
  if (sq.mob){
    const md = MAPS[sq.map];
    const pk = md && md.packs ? md.packs.find(p => p.mob === sq.mob) : null;
    if (pk){
      const mdef = (typeof MOBS !== 'undefined') && MOBS[sq.mob];
      return { map:sq.map, x:pk.x, y:pk.y, label:'Săn ' + (mdef ? mdef.name : sq.mob) };
    }
  }
  if (n) return { map:n.map, x:n.x, y:n.y, label:'Gặp ' + n.name };
  return null;
}
window.goQuest = function(){
  const t = questTarget(currentQuest());
  if (!t){ addFloat(player.x, player.y - 40, 'Chưa rõ đích đến — đọc kỹ mô tả nhiệm vụ nhé!', '#f0a03a', 12); return; }
  player.beacon = { map:t.map, x:t.x, y:t.y, label:t.label };
  closePanels();
  if (t.map !== curMap) travelTo(t.map);
  else addFloat(player.x, player.y - 56, '🧭 Đã ghim: ' + t.label + ' — theo cột sáng!', '#8fd18f', 13);
  saveGame();
};
window.goQuestSide = function(id){
  const sq = SIDE_QUESTS.find(x => x.id === id);
  const t = sq && sideQuestTarget(sq);
  if (!t){ addFloat(player.x, player.y - 40, 'Chưa rõ đích đến!', '#f0a03a', 12); return; }
  player.beacon = { map:t.map, x:t.x, y:t.y, label:t.label };
  closePanels();
  if (t.map !== curMap) travelTo(t.map);
  else addFloat(player.x, player.y - 56, '🧭 Đã ghim: ' + t.label, '#7fd4ff', 13);
  saveGame();
};
function drawBeacon(){
  const b = player && player.beacon;
  if (!b || b.map !== curMap) return;
  const t = performance.now()/300;
  const pulse = 1 + Math.sin(t)*0.15;
  ctx.save();
  const grd = ctx.createLinearGradient(b.x, b.y - 220, b.x, b.y);
  grd.addColorStop(0, 'rgba(240,214,138,0)');
  grd.addColorStop(1, 'rgba(240,214,138,.45)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(b.x - 15*pulse, b.y); ctx.lineTo(b.x - 4, b.y - 220);
  ctx.lineTo(b.x + 4, b.y - 220); ctx.lineTo(b.x + 15*pulse, b.y);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(240,214,138,.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(b.x, b.y, 26*pulse, 9*pulse, 0, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f0d68a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🚩 ' + b.label, b.x, b.y - 230);
  ctx.restore();
}
function drawBeaconArrow(){
  const b = player && player.beacon;
  if (!b || b.map !== curMap || !camera) return;
  const sx = b.x - camera.x, sy = b.y - camera.y;
  if (sx > 40 && sx < W - 40 && sy > 40 && sy < H - 40) return; // đã thấy trên màn hình
  const ang = Math.atan2(sy - H/2, sx - W/2);
  const ex = clamp(sx, 50, W - 50), ey = clamp(sy, 70, H - 60);
  const d = Math.round(dist(player.x, player.y, b.x, b.y));
  ctx.save();
  ctx.translate(ex, ey); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(240,214,138,.95)';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f0d68a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(d + ' bước', ex, ey - 16);
}

// ---------- GDD Đợt 2 B5: Trại Ngựa — Tuấn Mã Hoang & Mã Thầu ----------
const HORSE_ZONES = {
  ngoai:  [{ x:900, y:950 }, { x:1500, y:620 }, { x:800, y:1400 }],
  mongco: [{ x:900, y:500 }, { x:1600, y:1350 }],
};
let horses = [];
function spawnHorses(){
  horses = [];
  const zones = HORSE_ZONES[curMap];
  if (!zones || DGN) return;
  for (const z of zones){
    for (let k = 0; k < 2; k++){
      const p = nearestFree(curMap, z.x + (k ? 70 : -35), z.y + (k ? 50 : -25));
      horses.push({ x:p.x, y:p.y, hx:p.x, hy:p.y, state:'graze', t:Math.random()*3, face:Math.random()*6.28 });
    }
  }
}
window.tryCatchHorse = function(){
  if (!horses.length || DGN) return false;
  const g = gameTimeInfo(), tk = g.day + '/' + g.month;
  if (!player.horseDay || player.horseDay.d !== tk) player.horseDay = { d:tk, n:0 };
  let best = null, bd = 70;
  for (const h of horses){
    if (h.state !== 'tired') continue;
    const d = dist(player.x, player.y, h.x, h.y);
    if (d < bd){ bd = d; best = h; }
  }
  if (!best) return false;
  if (player.horseDay.n >= 5){
    addFloat(player.x, player.y - 46, 'Hôm nay đã bắt đủ 5 Tuấn Mã — ngựa cũng cần nghỉ!', '#f0a03a', 13);
    return true;
  }
  player.horseDay.n++;
  player.maThau = (player.maThau || 0) + 1;
  addFloat(best.x, best.y - 30, '🪢 +1 Mã Thầu!', '#7fd8e0', 15);
  addFloat(player.x, player.y - 52, `Bắt được Tuấn Mã! (${player.horseDay.n}/5 hôm nay) — Mã Thầu: +7% tỉ lệ hoặc −4✦ khi thăng giai thú`, '#8fd18f', 13);
  AudioSys.sfx('quest', 0.7);
  sideOnEvent('catch');
  horses.splice(horses.indexOf(best), 1);
  saveGame();
  return true;
};
function updateHorses(dt){
  if (!horses.length) { window._horseRespawnT = 0; }
  for (const h of horses){
    const d = dist(player.x, player.y, h.x, h.y);
    if (h.state === 'graze'){
      h.t -= dt;
      if (h.t <= 0){ h.t = 2 + Math.random()*3; h.face = Math.random()*6.28; }
      h.x += Math.cos(h.face)*8*dt; h.y += Math.sin(h.face)*8*dt;
      if (dist(h.x, h.y, h.hx, h.hy) > 120){ const a = Math.atan2(h.hy - h.y, h.hx - h.x); h.x += Math.cos(a)*24*dt; h.y += Math.sin(a)*24*dt; }
      if (d < 150){ h.state = 'flee'; h.t = 3; h.face = Math.atan2(h.y - player.y, h.x - player.x); }
    } else if (h.state === 'flee'){
      h.t -= dt;
      if (d < 260){
        const want = Math.atan2(h.y - player.y, h.x - player.x);
        let da = want - h.face;
        while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
        h.face += clamp(da, -2.6*dt, 2.6*dt);
        h.x += Math.cos(h.face)*170*dt; h.y += Math.sin(h.face)*170*dt;
      } else {
        h.x += Math.cos(h.face)*40*dt; h.y += Math.sin(h.face)*40*dt;
      }
      if (h.t <= 0){ h.state = 'tired'; h.t = 2.5; } // kiệt sức 2.5s — cửa sổ bắt
    } else if (h.state === 'tired'){
      h.t -= dt;
      if (h.t <= 0){ h.state = 'graze'; h.t = 2; }
    }
    h.x = clamp(h.x, 40, MAP.w - 40); h.y = clamp(h.y, 40, MAP.h - 40);
    collideObstacles(h, 12);
  }
  const zones = HORSE_ZONES[curMap];
  if (zones && !DGN && horses.length < zones.length*2){
    window._horseRespawnT = (window._horseRespawnT || 0) + dt;
    if (window._horseRespawnT > 90){ // 90s hồi một con
      window._horseRespawnT = 0;
      const z = zones[Math.floor(Math.random()*zones.length)];
      const p = nearestFree(curMap, z.x, z.y);
      horses.push({ x:p.x, y:p.y, hx:p.x, hy:p.y, state:'graze', t:2, face:0 });
    }
  }
}
function drawHorse(h){
  const img = MOUNT_IMGS[1]; // Bạch Mã — Tuấn Mã Hoang dùng tạm hình ngựa giai 1
  const bob = Math.sin(performance.now()/300 + h.hx)*2;
  ctx.save(); ctx.translate(h.x, h.y + bob);
  if (h.state === 'tired') ctx.globalAlpha = 0.75 + Math.sin(performance.now()/150)*0.2;
  if (img && img.complete && img.naturalWidth){
    const hh = 52, hw = hh * (img.naturalWidth/img.naturalHeight);
    ctx.drawImage(img, -hw/2, -hh + 8, hw, hh);
  } else {
    ctx.fillStyle = '#c8a878'; ctx.beginPath(); ctx.ellipse(0, -14, 16, 10, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(-3, -32, 7, 12);
  }
  ctx.restore();
  if (h.state === 'tired'){
    ctx.fillStyle = '#7fd8e0'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🪢 Bấm E để bắt!', h.x, h.y - 48);
  } else if (h.state === 'flee'){
    ctx.fillStyle = '#f0a03a'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('💨', h.x, h.y - 46);
  }
}
window.renderStable = function(){
  const p = el('panel-quest');
  const nx = MOUNT_TIERS[player.mount.tier + 1];
  const g = gameTimeInfo(), tk = g.day + '/' + g.month;
  const caught = player.horseDay && player.horseDay.d === tk ? player.horseDay.n : 0;
  let html = `<h3>Trại Ngựa — Mục Đồng</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">"Tuấn mã hoang chạy ngoài đồng kia — lại gần nó sẽ vùng chạy, rượt đến khi <b style="color:#7fd8e0">kiệt sức</b> rồi bấm <b>E</b> mà bắt. Mỗi con cho một cuộn <b style="color:#7fd8e0">Mã Thầu</b>: khi thăng giai thú cưỡi, dùng <b>+7% tỉ lệ</b> hoặc <b>−4✦ phí</b> mỗi cuộn (tối đa 3 cuộn/lần). Ngày chỉ bắt 5 con thôi — ngựa cũng cần nghỉ!"</div>`;
  html += `<div class="mat-row"><span style="width:20px;text-align:center">🪢</span><span style="flex:1">Mã Thầu đang có</span><b style="color:#7fd8e0">${player.maThau || 0}</b></div>`;
  html += `<div class="mat-row"><span style="width:20px;text-align:center">🐎</span><span style="flex:1">Tuấn Mã đã bắt hôm nay</span><b>${caught}/5</b></div>`;
  html += `<div class="stat-sec">THÚ CƯỠI: ${MOUNT_TIERS[player.mount.tier].name} (Giai ${player.mount.tier})${nx ? ` — kế tiếp: <b style="color:${nx.color}">${nx.name}</b> · cần cấp ${nx.reqLv} · ${nx.cost.silver}◈ + ${nx.cost.mat}✦ · tỉ lệ ${nx.rate}%` : ' — TỐI THƯỢNG'}</div>`;
  html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:7px 16px" onclick="closePanels();togglePanel('mount')">Mở Trại Thú Cưỡi</button></div>`;
  html += `<div style="font-size:11.5px;opacity:.65;margin-top:8px">Tuấn Mã Hoang ở ba đồng cỏ Ngoại Ô (và thảo nguyên Mông Cổ — phụ tuyến «Tuấn Mã Thảo Nguyên» cấp 80).</div>`;
  p.innerHTML = html;
  closePanels(); p.classList.remove('hidden');
};


function tryTalkQuest(){
  if (!player || dead) return;
  if (dist(player.x, player.y, NPC.x, NPC.y) > 90) return;
  tutAdvance('npc'); // hướng dẫn tân thủ: nói chuyện Trưởng Làng
  const q = currentQuest();
  const panel = document.getElementById('panel-quest');
  let html = `<h3>Trưởng Làng Thanh Ngưu</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  if (!q){
    html += `<div class="qd-quest">Giang hồ rộng lớn, Bình Cảnh đã phá. Hành trình Huyễn Ảnh Chí Tôn còn ở phiên bản sau!</div>`;
  } else if (questState === 'done'){
    html += `<div class="qd-quest"><div class="q-name">${q.name} — Hoàn thành!</div>${q.desc}
      <div class="q-rew">Thưởng: ${q.rew.xp} EXP · ${q.rew.silver||0}◈ ${q.rew.mat?('· '+q.rew.mat+'✦'):''}</div>
      <div style="text-align:center;margin-top:8px"><button class="mini-btn" onclick="turnInQuest()">Nhận Thưởng</button></div></div>`;
  } else {
    html += `<div class="qd-quest"><div class="q-name">Nhiệm vụ ${q.id}: ${q.name}</div>${q.desc}
      <div class="q-rew">Thưởng: ${q.rew.xp} EXP · ${q.rew.silver||0}◈ ${q.rew.mat?('· '+q.rew.mat+'✦'):''}</div></div>`;
  }
  // Bí kíp giang hồ: Huyết Ma Thôn Phệ — gom đủ 3 tàn quyển từ boss để dung hợp
  if (player.bikip){
    if (player.bikip.hmtp){
      html += `<div class="qd-quest" style="border-color:#e84a6a"><div class="q-name" style="color:#e84a6a">☠ Huyết Ma Thôn Phệ — Đã Luyện Thành</div>
        Mỗi đòn đánh hút 10% sát thương gây ra thành sinh lực.</div>`;
    } else {
      const pcs = player.bikip.pieces;
      html += `<div class="qd-quest"><div class="q-name" style="color:#e84a6a">Bí Kíp Giang Hồ — Huyết Ma Thôn Phệ</div>
        Tàn quyển: <b>Thượng ×${pcs[0]}</b> · <b>Trung ×${pcs[1]}</b> · <b>Hạ ×${pcs[2]}</b><br>
        <span style="opacity:.7;font-size:12px">Đánh bại Hắc Phong Sát Thủ để thu thập tàn quyển (Thượng 40% · Trung 40% · Hạ 20%).</span>`;
      if (pcs[0] > 0 && pcs[1] > 0 && pcs[2] > 0){
        html += `<div style="text-align:center;margin-top:8px"><button class="mini-btn" style="border-color:#e84a6a;color:#e84a6a" onclick="fuseBikip()">Dung Hợp Bí Kíp (30%)</button></div>
          <div style="font-size:11px;opacity:.65;text-align:center">Thất bại không mất tàn quyển — có thể thử lại vô hạn.</div><div id="bikip-msg" style="text-align:center;font-size:12px"></div>`;
      }
      html += `</div>`;
    }
  }
  panel.innerHTML = html;
  panel.classList.remove('hidden');
}
window.fuseBikip = function(){
  const pcs = player.bikip.pieces;
  if (player.bikip.hmtp || !(pcs[0]>0 && pcs[1]>0 && pcs[2]>0)) return;
  const msg = document.getElementById('bikip-msg');
  if (Math.random() < 0.3){
    pcs[0]--; pcs[1]--; pcs[2]--;
    player.bikip.hmtp = true;
    player.vohoc['fs_huyetma'] = true; // thần công tàn quyển — học thẳng chiêu chủ động, dùng ngay
    calcDerived();
    if (msg){ msg.textContent = '✔ Dung hợp thành công — HUYẾT MA THÔN PHỆ + tuyệt chiêu HUYẾT MA PHỆ HỒN CHƯỞNG (bấm K gán)!'; msg.style.color = '#e84a6a'; }
    addFloat(player.x, player.y-52, '☠ HUYẾT MA THÔN PHỆ — hút huyết 10%!', '#e84a6a', 17);
    addFloat(player.x, player.y-74, '《Huyết Ma Phệ Hồn Chưởng》đã nhập thể — bấm K gán vào taskbar!', '#ff8a8a', 15);
    addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#e84a6a', big:true });
    for (let i=0;i<12;i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-80,80), vy:rnd(-100,-20), color:'#e84a6a' });
    saveGame();
  } else {
    if (msg){ msg.textContent = '✘ Dung hợp thất bại — kinh mạch chấn động, tàn quyển vẫn còn.'; msg.style.color = '#ff7a6a'; }
    addFloat(player.x, player.y-40, 'Dung hợp thất bại (30%)', '#ff7a6a', 13);
  }
  setTimeout(()=>{ try{ tryTalk(); }catch(e){} }, 900);
};
window.turnInQuest = function(){
  AudioSys.sfx('quest', 0.9);
  const q = currentQuest();
  if (!q || questState !== 'done') return;
  player.silver += q.rew.silver || 0;
  player.mat += q.rew.mat || 0;
  // QA fix: thưởng kèm trang bị (Q4 tặng Tân Thủ Kiếm để Q5 rèn +3 không bao giờ kẹt)
  if (q.rew.item && player.inv.length < 30){
    const gi = genSpecific(q.rew.item, 0, Math.max(1, player.level));
    player.inv.push(gi);
    addFloat(player.x, player.y-64, `Nhận được: ${gi.name}!`, '#9fd0ff', 14);
  }
  gainXp(q.rew.xp);
  questIdx++;
  questProg = 0;
  questState = questIdx < QUESTS.length ? 'active' : 'all';
  if (questIdx === 9) spawnBoss(); // quest 10
  closePanels(); saveGame();
};
function closePanels(){
  for (const id of ['panel-char','panel-inv','panel-forge','panel-quest','panel-mount','panel-dantian','panel-tuyethoc']){
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
}
window.closePanels = closePanels;
// bulletproof close: delegated handler works even if a panel re-rendered mid-session
document.addEventListener('click', e=>{
  if (e.target && e.target.classList && e.target.classList.contains('close-x')) closePanels();
});

// ---------- Update ----------
function update(dt){
  if (!player) return;
  if (hitStop > 0){ hitStop -= dt; dt *= 0.08; } // hit-stop: thế giới khựng lại 1 nhịp khi chém trúng — đòn có lực
  // cooldowns
  for (const k in player.cd) player.cd[k] = Math.max(0, player.cd[k] - dt);
  player.comboT = Math.max(0, (player.comboT || 0) - dt); // chuỗi combo — ám khí trúng lúc này mở Liên Trảm
  player.ltT = Math.max(0, (player.ltT || 0) - dt);       // cửa sổ Liên Trảm 2.5s
  player.atkAnim = Math.max(0, player.atkAnim - dt);
  player.castT = Math.max(0, (player.castT || 0) - dt);
  player.hurtT = Math.max(0, (player.hurtT || 0) - dt);
  shakeT = Math.max(0, shakeT - dt);
  updateTanNpcs(dt); // Nhân Mạch: tán tu lang bạt + cừu nhân phục kích
  player.battuCd = Math.max(0, (player.battuCd || 0) - dt);
  if ((player.buffAtkT || 0) > 0){ // Rượu Hổ Cốt hết men
    player.buffAtkT -= dt;
    if (player.buffAtkT <= 0){
      player.buffAtkT = 0; calcDerived();
      if (!dead) addFloat(player.x, player.y-46, 'Hết men Rượu Hổ Cốt…', '#8a8a8a', 12);
    }
  }
  if ((player.loidonT || 0) > 0){ // Lôi Độn Phù hết hiệu lực
    player.loidonT -= dt;
    if (player.loidonT <= 0){
      player.loidonT = 0;
      if (!dead) addFloat(player.x, player.y-46, 'Lôi Độn Phù đã tan…', '#8a8a8a', 12);
    }
  }
  player.khi = (player.khi || 0) + 3*dt*tulinhMult(); // Chân Khí tích lũy thụ động · Tụ Linh Trận tăng thêm
  tickGameClock(dt); // Lịch Tu Tiên: thời gian thế giới trôi theo thời gian thật
  if (dead) return;

  collideObstacles(player, 14); collideAiPass(); // GDD Đợt 2 A: đứng yên cũng bị đẩy ra khỏi vùng cấm/ải (save cũ/dịch chuyển)
  if (inObstacle(curMap, player.x, player.y, 12)){ const _nf = nearestFree(curMap, player.x, player.y); player.x = _nf.x; player.y = _nf.y; } // hiếm gặp: vùng cấm tràn mép map, đẩy mãi không ra
  if (player.beacon && player.beacon.map === curMap && dist(player.x, player.y, player.beacon.x, player.beacon.y) < 60){ // B2: đến nơi → tắt đèn
    addFloat(player.x, player.y - 60, '🚩 Đã đến: ' + player.beacon.label, '#8fd18f', 14);
    player.beacon = null; saveGame();
  }

  // movement
  let mx = 0, my = 0;
  if (keys['w']||keys['arrowup']) my -= 1;
  if (keys['s']||keys['arrowdown']) my += 1;
  if (keys['a']||keys['arrowleft']) mx -= 1;
  if (keys['d']||keys['arrowright']) mx += 1;
  mx += joyVec.x; my += joyVec.y;
  // AUTO FARM (phím Z): tự đuổi theo & đánh quái gần nhất — treo máy
  // nearestMob tự loại Du Hiệp trung lập (trừ khi bật PK) nên auto không bao giờ gây PK oan
  // GDD Boss v2.1: vào vùng boss (400px) auto tạm dừng — trận boss phải đánh tay
  const _ac = player.autoCfg || { skill:true, potion:true, potionPct:40, range:430, boss:false };
  const _bossNear = player.auto && !_ac.boss && mobs.some(b => !b.dead && (b.def.bossKind || b.type === 'boss') && dist(player.x, player.y, b.x, b.y) < 300);
  if (_bossNear){
    player._bossHintT = (player._bossHintT || 0) - dt;
    if (player._bossHintT <= 0){ addFloat(player.x, player.y-64, '⚠ Vùng Boss — auto tạm dừng, hãy tự chiến!', '#ff9a5a', 13); player._bossHintT = 6; }
  }
  if (player.auto && !dead && player.jumpT <= 0 && !_bossNear){
    if (player._autoAX == null){ player._autoAX = player.x; player._autoAY = player.y; }
    // Chỉ quét quanh điểm neo (bán kính 430 ≈ 1-2 bãi quái) — không rượt quái khắp map
    let _at = null, _bd = _ac.range;
    for (const m of mobs){
      if (m.dead) continue;
      if (!_ac.boss && (m.def.bossKind || m.type === 'boss')) continue; // auto không tự khơi trận boss — trừ khi bật trong Cài Đặt
      if (m.def.duHiep && !player.pk && !m.revenge) continue;
      const _dd = dist(player._autoAX, player._autoAY, m.x, m.y);
      if (_dd < _bd){ _bd = _dd; _at = m; }
    }
    if (_at){
      const _ad = dist(player.x, player.y, _at.x, _at.y);
      player.face = Math.atan2(_at.y - player.y, _at.x - player.x);
      if (_ad > 64){ mx += (_at.x - player.x)/_ad; my += (_at.y - player.y)/_ad; } // chạy tới bãi quái
      else if (player.cd.basic <= 0) doBasic(); // trong tầm tay: chém
      // tự tung kỹ năng trên taskbar khi hết hồi chiêu & đủ nội lực (im lặng, không spam thông báo)
      if (_ac.skill && _ad < 340){
        for (const _sid of player.skillBar){
          if (_sid == null) continue;
          const _inf = skillInfo(_sid);
          if (_inf.unlocked && (player.cd[_sid] || 0) <= 0 && player.qi >= _inf.qi) castSkill(_sid);
        }
      }
    } else {
      // hết quái quanh neo → quay về điểm neo chờ quái hồi sinh (không lang thang khắp map)
      const _hd = dist(player.x, player.y, player._autoAX, player._autoAY);
      if (_hd > 60){ mx += (player._autoAX - player.x)/_hd; my += (player._autoAY - player.y)/_hd; }
    }
    // tự uống Hồ Lô Thuốc khi máu dưới 40% (còn thuốc & hết hồi)
    if (_ac.potion && player.hp < player.maxHp*(_ac.potionPct/100) && player.potions > 0 && (player.potionCd || 0) <= 0) usePotion();
    if (player.potions <= 0 && player.hp < player.maxHp*0.5){
      player._autoWarnT = (player._autoWarnT || 0) - dt;
      if (player._autoWarnT <= 0){ player._autoWarnT = 30; addFloat(player.x, player.y-70, '⚠ Hết thuốc — auto farm không tự hồi máu được!', '#ff9a6a', 12); }
    }
  }
  const ml = Math.hypot(mx,my);
  player.moving = ml > 0.01;
  player.walkPh = (player.walkPh || 0) + dt * (player.moving ? 11 : 2.2);
  if (ml > 0.01){
    mx /= Math.max(1,ml); my /= Math.max(1,ml);
    let spd = player.speed || 190;
    player.x = clamp(player.x + mx*spd*dt, 20, MAP.w-20);
    player.y = clamp(player.y + my*spd*dt, 20, MAP.h-20);
    collideCityWalls();
    collideObstacles(player, 14); collideAiPass(); // GDD Đợt 2 A: địa hình + ải cấp
    // Cổng Ải (GDD Boss v2.1 §4): vùng Trấn Ải bị phong ấn tới khi hạ đủ 3 Thủ Vệ
    const _bd = BOSS_DEFS[curMap];
    if (_bd){
      const ta = _bd.tranai, ax = ta.x*MAP.w, ay = ta.y*MAP.h;
      const kills = player.bossKills[curMap] || [];
      const unlocked = _bd.thuve.every(tv => kills.includes(tv.id));
      if (!unlocked && dist(player.x, player.y, ax, ay) < 340){
        const ang = Math.atan2(player.y - ay, player.x - ax);
        player.x = ax + Math.cos(ang)*342; player.y = ay + Math.sin(ang)*342;
        player._gateT = (player._gateT || 0) - dt;
        if (player._gateT <= 0){
          const left = _bd.thuve.filter(tv => !kills.includes(tv.id)).length;
          zoneBanner = { text:'⛨ PHONG ẤN NGŨ HÀNH', sub:`Còn ${left}/3 Trận Nhãn chưa phá — hãy hạ các Thủ Vệ canh giữ!`, color:'#c07fe0', t:3 };
          AudioSys.sfx('hurt', 0.4);
          player._gateT = 4;
        }
      }
    }
    player.face = Math.atan2(my,mx);
    // hướng dẫn tân thủ bước 1: di chuyển một đoạn
    if (player.tutStep === 0){
      player.tutDist = (player.tutDist || 0) + spd*dt;
      if (player.tutDist > 150) tutAdvance('move');
    }
  }
  // hướng dẫn bước cuối: tự hoàn thành sau 12s
  if (player.tutStep === 4){
    player.tutTimer = (player.tutTimer || 0) + dt;
    if (player.tutTimer > 12) tutAdvance('quest');
  }
  updateTut();
  updateGate();
  // Lăng Ba Vi Bộ jump glide — fast airborne dash, evades all attacks
  if (player.jumpT > 0){
    player.jumpT -= dt;
    const jspd = 380;
    player.x = clamp(player.x + player.jumpDir.x*jspd*dt, 20, MAP.w-20);
    player.y = clamp(player.y + player.jumpDir.y*jspd*dt, 20, MAP.h-20);
    collideCityWalls(); collideObstacles(player, 14); // GDD Đợt 2 A
    // tàn ảnh thân pháp — afterimage trail
    player.jumpTrailT = (player.jumpTrailT || 0) - dt;
    if (!SETTINGS.lowFx && player.jumpTrailT <= 0){
      player.jumpTrailT = 0.055;
      addEffect({ type:'ring', x:player.x, y:player.y+2, r:16, color:'#bfe8ff' });
    }
    if (player.jumpT <= 0){
      player.jumpT = 0;
      addEffect({ type:'ring', x:player.x, y:player.y, r:38, color:'#9fd8ff' });
    }
  }

  // qi regen + hp regen (P0: hồi máu nhanh hơn — base ×3, ngoài combat thêm 5% max HP/s)
  player.combatT = Math.max(0, (player.combatT || 0) - dt);
  player.potionCd = Math.max(0, (player.potionCd || 0) - dt); // P0: Hồ Lô Thuốc cooldown
  if (TRIB.active) updateTrib(dt); // A1: Độ Kiếp
  if (player.hp <= 0 && !dead){ player.hp = 0; onDeath(); } // thiên lôi cũng giết được người
  updateKyngo(dt); // A2: Kỳ ngộ trên đường
  if (DGN) updateDungeon(); // Phó bản: đợt quái → boss → thưởng
  updatePet(dt); // Linh Thú đồng hành
  updateMount(dt); // Thú Chiến đồng hành
  updateHorses(dt); // GDD Đợt 2 B5
  player.qi = Math.min(player.maxQi, player.qi + (player.qireg + player.maxQi*(player.combatT <= 0 ? 0.01 : 0.0025))*dt); // GDD Đợt 2 B1: +1% maxQi/s ngoài combat, +0.25% trong combat
  const regenHp = player.dVit*0.75 + 3 + (player.combatT <= 0 ? player.maxHp*0.05 : 0);
  player.hp = Math.min(player.maxHp, player.hp + regenHp*dt);

  // Phase C timers: độc (không giết được — tối thiểu 1 HP), buff Cương Khí, Tội Ác decay, banner
  if (player.poisonT > 0){
    player.poisonT -= dt;
    player.hp = Math.max(1, player.hp - (player.poisonDps || 1) * dt);
    if (Math.random() < dt*4) addEffect({ type:'ink', x:player.x+rnd(-14,14), y:player.y-10, vx:0, vy:-30, color:'#7a4a9a' });
  }
  if (player.gkBuffT > 0){
    player.gkBuffT -= dt;
    if (Math.random() < dt*8) addEffect({ type:'ring', x:player.x, y:player.y, r:30, color:'#e8c86a' });
  }
  // Võ Học Phổ: buff timers + Dịch Cân Kinh hồi phục + khiên Thái Cực
  for (const _bk of ['vhDmgT','vhEvaT','vhReflT','vhAspdT','vhCritT','vhLeechT']) if ((player[_bk]||0) > 0) player[_bk] -= dt;
  player.vhReviveCd = Math.max(0, (player.vhReviveCd || 0) - dt);
  if ((player.vhRegen || 0) > 0 && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + player.maxHp * player.vhRegen * dt);
  if ((player.vhShield || 0) > 0 && Math.random() < dt*6) addEffect({ type:'ring', x:player.x, y:player.y, r:36, color:'#8ad8c8' });
  if (player.toiac > 0){
    player.toiacT += dt;
    if (player.toiacT >= 300){ player.toiac--; player.toiacT = 0; }
  }
  // Sa Đọa: Tội Ác ≥ 5 → hắc hóa Ma Tu; gột rửa hết tội → trở lại chính đạo
  if (!player.maDao && (player.toiac || 0) >= 5){
    player.maDao = true;
    zoneBanner = { text:'⚫ ĐỌA MA', sub:'Sát niệm xâm tâm — công lực +15% nhưng lôi kiếp sẽ khắc nghiệt hơn!', color:'#c07fe0', t:4 };
    addFloat(player.x, player.y-60, 'Ngươi đã bước vào Ma Đạo…', '#c07fe0', 15);
    AudioSys.sfx('crit', 0.8); saveGame();
  } else if (player.maDao && (player.toiac || 0) <= 0){
    player.maDao = false;
    zoneBanner = { text:'HỒI ĐẦU THỊ NGẠN', sub:'Tội nghiệt đã gột sạch — trở lại chính đạo.', color:'#7ec850', t:3.5 };
    saveGame();
  }
  if (zoneBanner){ zoneBanner.t -= dt; if (zoneBanner.t <= 0) zoneBanner = null; }
  // đai cấp: bước sang đai mới → báo banner (lần đầu vào map chỉ ghi nhận, không bắn banner)
  if (player && !dead){
    const _mdB = mapDef();
    if (_mdB.packs && _mdB.packs.length){
      const _b = bandOfDist(_mdB, player.x, player.y);
      if (curBand !== _b && curBand !== -1)
        zoneBanner = { text:`ĐAI ${BAND_NAMES[_b].toUpperCase()}`, sub:`Quái ${bandLvText(_mdB,_b)} — ${_b===2?'mạnh nhất vùng, cẩn thận!':_b===1?'cấp trung bình':'yếu nhất, hợp luyện công'}`, color:BAND_COLORS[_b], t:2.2 };
      curBand = _b;
    } else curBand = -1;
  }
  updateMaTon(); // Track HT: sự kiện Ma Tôn Giáng Thế — 4 giờ một lần

  // spirit spring: meditation quest + Tu Vi source (always active)
  const q = currentQuest();
  if (mapDef().spring && dist(player.x,player.y,SPRING.x,SPRING.y) < SPRING.r){
    player.dantian.tuvi += 6*dt*tulinhMult();
    player.khi += 6*dt*tulinhMult(); // Tịnh Tâm Tuyền: Chân Khí ×3 · Tụ Linh Trận tăng thêm
    if (player.toiac > 0){ // Ngồi Thiền gột rửa Tội Ác
      player.toiac = 0; player.toiacT = 0;
      addFloat(player.x, player.y-52, 'Tịnh Tâm Tuyền gột rửa Tội Ác!', '#3a9d8b', 14);
    }
    if (Math.random() < dt*6) addEffect({ type:'ink', x:player.x+rnd(-20,20), y:player.y, vx:0, vy:-40, color:'#3a9d8b' });
    if (q && q.type==='meditate' && questState==='active'){
      springTimer += dt;
      questProg = Math.min(q.need, springTimer);
      if (questProg >= q.need){
        questState='done';
        addFloat(player.x, player.y-46, `Nhiệm vụ hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13);
      }
    }
  }

  // herbs pickup
  for (const p of pickups){
    if (p.respawn > 0){ p.respawn -= dt; continue; }
    if (dist(player.x,player.y,p.x,p.y) < 26){
      p.respawn = 30;
      addEffect({ type:'spark', x:p.x, y:p.y-6, r:24, color:'#b8e87a' });
      if (q && q.type==='collect' && questState==='active'){
        questProg++;
        addFloat(p.x, p.y-20, `Thảo Dược ${questProg}/${q.need}`, '#8fd18f', 12);
        if (questProg >= q.need){ questState='done'; addFloat(player.x, player.y-46, `Nhiệm vụ hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13); }
        sideOnEvent('collect');
      } else {
        player.hp = Math.min(player.maxHp, player.hp + 25);
        addFloat(p.x, p.y-20, '+25 HP', '#8fd18f', 11);
      }
    }
  }

  // mobs AI
  for (const m of mobs){
    if (m.dead) continue;
    if (TRIB.active){ m.atkT = Math.max(m.atkT, 0.5); continue; } // lôi kiếp: quái đứng yên
    m.wob += dt*3; m.hitT = Math.max(0, m.hitT - dt);
    if (m.faceT != null) m.face = lerpAng(m.face, m.faceT, Math.min(1, dt*9)); // xoay người mượt, không giật hướng
    m.lungeT = Math.max(0, (m.lungeT || 0) - dt); // hiệu ứng lao tới khi ra đòn
    // Độc (ám khí) & thiêu đốt (cung tiễn) — sát thương theo thời gian
    if (m.poisonT > 0){
      m.poisonT -= dt; m.hp -= m.poisonDps * dt;
      if (Math.random() < dt*2.5) addEffect({ type:'ink', x:m.x+rnd(-8,8), y:m.y-6, vx:0, vy:-28, color:'#5db86a' });
      if (m.hp <= 0){ killMob(m, 'poison'); continue; }
    }
    if (m.burnT > 0){
      m.burnT -= dt; m.hp -= m.burnDps * dt;
      if (Math.random() < dt*2.5) addEffect({ type:'ink', x:m.x+rnd(-8,8), y:m.y-6, vx:0, vy:-36, color:'#e8552a' });
      if (m.hp <= 0){ killMob(m, 'burn'); continue; }
    }
    if (m.bleedT > 0){ // Cửu Âm Bạch Cốt Trảo: chảy máu
      m.bleedT -= dt; m.hp -= m.bleedDps * dt;
      if (Math.random() < dt*3) addEffect({ type:'ink', x:m.x+rnd(-8,8), y:m.y-6, vx:0, vy:-24, color:'#c03a4a' });
      if (m.hp <= 0){ killMob(m, 'bleed'); continue; }
    }
    m.slowT = Math.max(0, (m.slowT || 0) - dt);
    m.blindT = Math.max(0, (m.blindT || 0) - dt);
    m.stunT = Math.max(0, (m.stunT || 0) - dt);
    m.fearT = Math.max(0, (m.fearT || 0) - dt);
    if (m.stunT > 0) continue; // Phong Mạch: quái đứng hình hoàn toàn
    if (m.shield === 0 && m.def.elite){
      m.shieldT -= dt;
      if (m.shieldT <= 0){ m.shield = 1; addFloat(m.x, m.y-30, 'Hộ thể tái tụ!', '#c07fe0', 11); }
    }
    m.packAlert = Math.max(0, (m.packAlert || 0) - dt);
    // ── Lãnh địa Boss: boss chỉ chiến đấu quanh điểm canh giữ — người chơi TỰ QUYẾT ĐỊNH khi nào bước vào ──
    if (m.type === 'boss' || m.def.bossKind){
      const _hx = m.homeX ?? (m.zone ? m.zone.x : m.x), _hy = m.homeY ?? (m.zone ? m.zone.y : m.y);
      const _leashR = m.def.bossKind ? 470 : 540;
      if (m.leashBack){ // đang quay về post — không đánh, không tụ chiêu
        if (dist(m.x, m.y, _hx, _hy) < 50){
          m.leashBack = false; m.hp = m.maxHp; m.punishT = 0;
          addFloat(m.x, m.y - m.def.size - 26, 'Boss trở về lãnh địa — hồi phục toàn bộ!', '#c0b090', 12);
        } else {
          const _ah = Math.atan2(_hy - m.y, _hx - m.x);
          m.x += Math.cos(_ah) * m.def.speed * 1.35 * dt; m.y += Math.sin(_ah) * m.def.speed * 1.35 * dt; m.faceT = _ah;
          collideObstacles(m, 13); // GDD Đợt 2 A
        }
        continue;
      }
      const _dp0 = dist(m.x, m.y, player.x, player.y);
      if (_dp0 > m.def.aggro && m.hp < m.maxHp && !m.leashBack) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt); // thoát chiến — hồi phục dần tại post
      // vượt ranh giới lãnh địa HOẶC mất dấu người chơi giữa đường → hủy chiêu, quay về post
      if (dist(m.x, m.y, _hx, _hy) > _leashR || (_dp0 > m.def.aggro && dist(m.x, m.y, _hx, _hy) > 70 && !m.tele)){
        m.leashBack = true; m.tele = null; m.introduced = true;
        addFloat(m.x, m.y - m.def.size - 26, 'Boss quay về lãnh địa!', '#c0b090', 12);
        continue;
      }
    }
    // ── Boss Vùng/Trấn Ải: não moveset (GDD Boss v2.1) ──
    if (m.def.bossKind){
      m.punishT = Math.max(0, (m.punishT || 0) - dt);
      if (m.cuongT > 0){ m.cuongT -= dt; if (m.cuongT <= 0 && m.atkMul) m.atkMul = m.atkMul/1.3; }
      const bd0 = dist(m.x, m.y, player.x, player.y);
      if (!m.introduced && bd0 < m.def.aggro){ m.introduced = true; if (typeof bossIntro === 'function') bossIntro(m); }
      if (m.tele){
        m.tele.t -= dt;
        if (m.tele.t <= 0) bossExecMove(m);
        continue; // đang tụ chiêu — đứng yên, người chơi né
      }
      if (bd0 < m.def.aggro){
        m.moveT -= dt;
        if (m.moveT <= 0 && m.punishT <= 0){
          bossStartTele(m, m.def.moves[m.moveIdx % m.def.moves.length]);
          m.moveIdx++;
          m.moveT = 4.5 + Math.random()*1.5;
        }
      }
    }
    const d = dist(m.x,m.y,player.x,player.y);
    m.atkT -= dt;
    // Du Hiệp trung lập: không bao giờ đánh trước; lang thang quanh bãi
    if (m.def.duHiep && !m.provoked && m.packAlert <= 0){
      m.wanderT = (m.wanderT || 0) - dt;
      if (m.wanderT <= 0){ m.wanderT = rnd(2,5); m.wanderAng = Math.random() < 0.35 ? null : rnd(0, Math.PI*2); }
      if (m.wanderAng != null){
        m.x = clamp(m.x + Math.cos(m.wanderAng)*26*dt, 40, MAP.w-40);
        m.y = clamp(m.y + Math.sin(m.wanderAng)*26*dt, 40, MAP.h-40);
        m.faceT = m.wanderAng;
      }
      continue;
    }
    const aggroR = m.packAlert > 0 ? 9999 : m.def.aggro; // cả cụm truy đuổi
    if ((m.fearT || 0) > 0){ // hoảng sợ: bỏ chạy xa người chơi
      const fa = Math.atan2(m.y-player.y, m.x-player.x);
      m.x = clamp(m.x + Math.cos(fa)*m.def.speed*dt, 40, MAP.w-40);
      m.y = clamp(m.y + Math.sin(fa)*m.def.speed*dt, 40, MAP.h-40);
      m.faceT = fa;
    } else if (d < aggroR && d > m.def.range){
      const ang = Math.atan2(player.y-m.y, player.x-m.x);
      m.faceT = ang;
      const mspd = m.def.speed * (m.slowT > 0 ? (m.slowPct || 0.65) : 1); // chậm: Mai Hoa Châm 35%, võ học theo chiêu
      m.x += Math.cos(ang)*mspd*dt;
      m.y += Math.sin(ang)*mspd*dt;
      collideObstacles(m, 13); // GDD Đợt 2 A
    } else if (d <= m.def.range && m.atkT <= 0){
      m.atkT = m.def.atkCd;
      // hiệu ứng ra đòn: quái lao tới (lunge) + vệt chém màu ngũ hành
      m.lungeT = 0.22;
      const elC = (m.def.el && NGU_HANH[m.def.el]) ? NGU_HANH[m.def.el].color : m.def.color;
      addEffect({ type:'arc', x:m.x, y:m.y, face:Math.atan2(player.y-m.y,player.x-m.x), r:34, color:elC });
      if (m.def.ranged){ // Cung Thủ Thảo Nguyên: đạn bay từ xa (hình), sát thương tính trực tiếp
        projectiles.push({ cosmetic:true, x:m.x, y:m.y, ang:Math.atan2(player.y-m.y,player.x-m.x), speed:420, dmg:0, kind:'mobshot', life:d/420, color:'#d8b060' });
      }
      if (m.blindT > 0 && Math.random() < 0.5){
        addFloat(m.x, m.y-30, 'MÙ LÒA!', '#c0b090', 11); // Diệt Hồn Sa — đánh trượt
      } else if (player.jumpT > 0){
        addFloat(player.x, player.y-28, 'Né!', '#a0ffe9', 13); // airborne — Lăng Ba Vi Bộ auto-evade
      } else if (Math.random() < player.eva){
        addFloat(player.x, player.y-28, 'Né!', '#a0ffe9', 13);
      } else {
        let dmg = m.def.atk * rnd(0.85,1.15) * (m.atkMul || 1) * (isNightGame() ? 1.1 : 1) * (1 - player.defRed); // Lịch Tu Tiên: ban đêm quái +10% công
        // QA endgame F3: quái cao hơn 6+ cấp gây thêm sát thương (tối đa +120%) — lạc vào map cao là trả giá
        const lvGapM = (m.def.lv || 1) - player.level;
        if (lvGapM > 5) dmg *= 1 + Math.min(1.2, (lvGapM - 5) * 0.08);
        if (m.def.bossKind){ const gapB2 = m.def.lv - player.level; if (gapB2 > 10) dmg *= 1.6; else if (gapB2 >= 6) dmg *= 1.3; } // Áp Bức Võ Công chiều ngược
        // ngũ hành tương khắc chiều quái → người: hệ quái khắc phái +12%, bị phái khắc -10%
        const mobEl = m.def.el, sectEl2 = SECTS[player.sect].element;
        let mobCounter = false;
        if (mobEl && sectEl2){
          if (NGU_HANH[mobEl].beats === sectEl2){ dmg *= 1.12; mobCounter = true; }
          else if (NGU_HANH[sectEl2].beats === mobEl) dmg *= 0.9;
        }
        if (player.gkBuffT > 0) dmg *= 0.7; // Cương Khí Hộ Thể (chủ động): giảm 30% ST
        dmg = Math.max(1, Math.round(dmg));
        if ((player.vhShield || 0) > 0){ // Thái Cực Kiếm: khiên kiếm khí hấp thụ
          const absorbed = Math.min(player.vhShield, dmg);
          player.vhShield -= absorbed; dmg -= absorbed;
          if (absorbed > 0) addFloat(player.x, player.y-40, `🛡 -${absorbed}`, '#8ad8c8', 12);
        }
        player.hp -= dmg;
        // đòn đánh trúng: vụ nổ hào quang ngũ hành + rung màn hình
        const elC2 = (mobEl && NGU_HANH[mobEl]) ? NGU_HANH[mobEl].color : '#ff7a6a';
        addEffect({ type:'ring', x:player.x, y:player.y-10, r:22, color:elC2 });
        for (let i=0;i<4;i++) addEffect({ type:'ink', x:player.x, y:player.y-12, vx:rnd(-70,70), vy:rnd(-90,-20), color:elC2 });
        player.hurtT = 0.25; // viền đỏ nhấp khi trúng đòn
        player.combatT = 4; // P0: vào trạng thái combat — ngừng hồi máu nhanh
        shakeT = Math.max(shakeT, 0.16); shakeMag = Math.min(6, 2 + 30*dmg/Math.max(1,player.maxHp));
        // Tình Hoa Độc Yêu: đánh trúng gây độc — Cương Khí (tuyệt học) kháng độc
        if (m.def.poisonHit){
          const gkT = (player.gangkhi && player.gangkhi.tier) || 0;
          player.poisonT = 3;
          player.poisonDps = Math.max(1, Math.round(player.maxHp * 0.008 * (1 - Math.min(0.8, gkT*0.12)) * (1 - (player.vhPoisonRes || 0))));
        }
        AudioSys.sfx('hurt', 0.7);
        if (!mobCounter) addDmgFloat(player, player.x+rnd(-8,8), player.y-26, dmg, '#ff7a6a', 13);
        else addFloat(player.x+rnd(-8,8), player.y-26, 'KHẮC CHẾ! ' + dmg, '#ff9a3a', 15);
        // Thái Cực hộ thể (Lưỡng Nghi Cảnh): phản 5% sát thương
        if (player.reflect && !m.dead){
          const ref = Math.max(1, Math.round(dmg * player.reflect));
          m.hp -= ref; m.hitT = 0.15;
          addFloat(m.x + rnd(-6,6), m.y - m.def.size - 18, `PHẢN ${ref}`, '#ffd76a', 11);
          if (m.hp <= 0){ killMob(m, 'reflect'); continue; }
        }
        if (player.hp <= 0){
          // Hỗn Nguyên Bất Tử (Đan Điền cảnh 8): chặn 1 đòn chí mạng, hồi 30% HP
          if (player.batTu && player.battuCd <= 0){
            player.battuCd = 180;
            player.hp = Math.round(player.maxHp * 0.3);
            addFloat(player.x, player.y-58, 'BẤT TỬ — Hỗn Nguyên hộ thể!', '#f0d68a', 18);
            addEffect({ type:'ring', x:player.x, y:player.y, r:130, color:'#f0d68a', big:true });
            for (let i=0;i<16;i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-100,100), vy:rnd(-130,-30), color:'#f0d68a' });
          } else { if (m.def.bossKind) player._killedByBoss = m.def.name; player.hp = 0; onDeath(); }
        }
      }
    }
    // gentle zone leash
    if (m.zone && m.type!=='boss'){
      const dz = dist(m.x,m.y,m.zone.x,m.zone.y);
      if (dz > m.zone.r + 200 && d > m.def.aggro){
        const ang = Math.atan2(m.zone.y-m.y, m.zone.x-m.x);
        m.x += Math.cos(ang)*m.def.speed*dt; m.y += Math.sin(ang)*m.def.speed*dt;
        collideObstacles(m, 13); // GDD Đợt 2 A
      }
    }
  }
  // respawn dead mobs
  for (const m of mobs){
    if (!m.dead) continue;
    if (m.def && m.def.bossKind){ // Boss Vùng/Trấn Ải hồi lại sau 60s tại đúng vị trí canh giữ
      if (m.respawnT <= 0){ m.gone = true; spawnZoneBoss(m.def._bdRef, m.def.bossKind); }
      else m.respawnT -= dt;
      continue;
    }
    if (m.type === 'boss'){ // Sát Thủ trở lại sau 60s — farm tàn quyển Huyết Ma Thôn Phệ
      if (m.respawnT <= 0){ m.respawnT = 60; addFloat(m.x, m.y-40, 'Sát Thủ sẽ trở lại sau 60s...', '#ff7a6a', 12); }
      else {
        m.respawnT -= dt;
        if (m.respawnT <= 0){ m.gone = true; spawnBoss(); }
      }
      continue;
    }
    m.respawnT -= dt;
    if (m.respawnT <= 0 && m.zone){
      const alive = mobs.filter(x => x.zone === m.zone && !x.dead).length;
      if (alive < m.zone.count){ spawnMob(m.type, m.zone); m.gone = true; }
      else m.respawnT = 3;
    }
  }
  for (const m of mobs){ if (m.dead && m.deadT > 0) m.deadT -= dt; }
  mobs = mobs.filter(m => !m.dead || m.deadT > 0 || (m.type !== 'boss' && !m.gone));

  // projectiles
  for (const p of projectiles){
    p.life -= dt;
    p.x += Math.cos(p.ang)*p.speed*dt;
    p.y += Math.sin(p.ang)*p.speed*dt;
    if (p.cosmetic) continue; // đạn hình ảnh của quái tầm xa — ST đã tính
    for (const m of mobs){
      if (m.dead || p.hit && p.hit.has(m)) continue;
      if (m.def.duHiep && !player.pk && !m.revenge) continue; // đạn xuyên qua Du Hiệp khi chưa bật PK (trừ kẻ truy thù)
      if (dist(p.x,p.y,m.x,m.y) < m.def.size + 8){
        let dmg = p.dmg * rnd(0.9,1.1);
        let src = p.kind==='amkhi' ? 'amkhi' : 'hit';
        if (src==='hit' && Math.random() < player.crit){ dmg *= 2; src='crit'; }
        hurtMob(m, dmg, src);
        // Võ Học Phổ: hiệu ứng trúng đích của chiêu projectile (Niêm Hoa Chỉ, Sinh Tử Phù, Độc Cô…)
        if (p.vhfx && !m.dead){
          const _vf = p.vhfx;
          if (_vf.stun){ m.stunT = Math.max(m.stunT || 0, _vf.stun * (m.def.bossKind ? 0.4 : 1)); addFloat(m.x, m.y-m.def.size-22, 'CHOÁNG!', '#ffe9a8', 11); }
          if (_vf.poison){ m.poisonT = _vf.poison.t; m.poisonDps = Math.max(1, Math.round(player.atk * 0.3)); addFloat(m.x, m.y-m.def.size-22, 'SINH TỬ PHÙ!', '#7ac86a', 11); }
        }
        // LIÊN TRẢM (võ học kết hợp): ám khí trúng trong chuỗi combo chiêu thức → cửa sổ 2.5s
        if (p.kind === 'amkhi' && (player.comboT || 0) > 0 && (player.ltT || 0) <= 0){
          player.ltT = 2.5;
          addFloat(player.x, player.y-66, '⚡ LIÊN TRẢM — chiêu kế miễn phí Nội Lực, +30% ST!', '#ffd76a', 14);
          addEffect({ type:'ring', x:player.x, y:player.y, r:60, color:'#ffd76a', big:true });
          AudioSys.sfx('crit', 0.7);
        }
        // Hiệu ứng Ám Khí theo tầng tuyệt học
        if (p.kind==='amkhi' && !m.dead){
          const aTier = (player.amkhiX && player.amkhiX.tier) || 0;
          if (aTier >= 1){ // Tinh Thiết Tiêu: kịch độc
            m.poisonT = 3;
            m.poisonDps = Math.max(1, Math.round(player.atk * (aTier >= 4 ? 1.0 : 0.5))); // Phù Dung Nhẫn: độc ×2
            addFloat(m.x, m.y-m.def.size-20, 'TRÚNG ĐỘC', '#5db86a', 11);
          }
          if (aTier >= 2 && Math.random() < 0.25){ m.slowT = 2; addFloat(m.x, m.y-32, 'CHẬM!', '#7ab0d8', 11); }
          if (aTier >= 5 && Math.random() < 0.12){ m.blindT = 2; addFloat(m.x, m.y-44, 'MÙ LÒA!', '#c0b090', 11); }
          if (aTier >= 6){ // Khổng Tước Linh: vạn độc lan AoE
            addEffect({ type:'ring', x:m.x, y:m.y, r:70, color:'#5db86a' });
            for (const m2 of mobs){
              if (m2.dead || m2 === m) continue;
              if (dist(m.x, m.y, m2.x, m2.y) < 70){
                m2.poisonT = 3; m2.poisonDps = m.poisonDps;
              }
            }
          }
          if (aTier >= 7 && !m.def.boss && m.hp < m.maxHp*0.2 && Math.random() < 0.03){
            addFloat(m.x, m.y-40, 'QUỶ KIẾN SẦU!', '#f0d68a', 16);
            addEffect({ type:'ring', x:m.x, y:m.y, r:60, color:'#f0d68a', big:true });
            m.hp = 0; killMob(m, 'amkhi');
          }
        }
        // Linh tiễn cung: chặn đứng & thiêu đốt theo tầng
        if (p.kind==='bow' && !m.dead){
          const bwT = BOW_TIERS[(player.bow && player.bow.tier) || 0];
          if (bwT){
            if (bwT.stun && Math.random() < bwT.stun){ m.atkT = Math.max(m.atkT, 1.5); addFloat(m.x, m.y-32, 'CHẶN ĐỨNG!', '#e8c84a', 11); }
            if (bwT.burn){ m.burnT = 3; m.burnDps = Math.max(1, Math.round(player.atk*0.2)); }
          }
        }
        // Đạn Chỉ (đan điền LV20+): phong mạch — trúng là đứng hình
        if (p.kind==='danchi' && !m.dead){
          m.stunT = Math.max(m.stunT || 0, 2.5);
          m.atkT = Math.max(m.atkT, 2.5);
          addFloat(m.x, m.y-m.def.size-24, 'PHONG MẠCH!', '#9fd8ff', 13);
          addEffect({ type:'ring', x:m.x, y:m.y, r:44, color:'#9fd8ff' });
        }
        if (!p.pierce){ p.life = 0; break; }
        if (!p.hit) p.hit = new Set();
        p.hit.add(m);
      }
    }
  }
  projectiles = projectiles.filter(p=>p.life > 0);

  // effects & floats
  for (const e of effects){ e.t += dt; if (e.type==='ink' || e.vx || e.vy){ e.x += (e.vx||0)*dt; e.y += (e.vy||0)*dt; } if (e.spin) e.ang = (e.ang || 0) + e.spin*dt; }
  effects = effects.filter(e => e.t < (e.dur || (e.big?0.7:0.45)));
  for (const f of floats){ f.t -= dt*0.8; f.y -= 26*dt; }
  floats = floats.filter(f=>f.t > 0);
  for (const mi of mists){ mi.x += mi.v*dt; if (mi.x - mi.r > W) mi.x = -mi.r; }
  updateAmbients(dt); // hạt môi trường: hoa rơi, tuyết, than hồng…
  tickWeather(dt); // sấm chớp & thời tiết động (Gói B)
  updateHints(dt); // GDD Đợt 2 B3: Nhắc Việc thông minh

  // camera mềm: bám theo có gia tốc ease-out — đổi hướng không còn giật cứng
  const _ctx = clamp(player.x - W/2, 0, Math.max(0, MAP.w - W));
  const _cty = clamp(player.y - H/2, 0, Math.max(0, MAP.h - H));
  const _cf = Math.min(1, dt*7.5);
  camera.x += (_ctx - camera.x) * _cf;
  camera.y += (_cty - camera.y) * _cf;
  if (Math.abs(camera.x - _ctx) < 0.4) camera.x = _ctx;
  if (Math.abs(camera.y - _cty) < 0.4) camera.y = _cty;

  // save
  saveTimer += dt;
  if (saveTimer > 10){ saveTimer = 0; saveGame(); }

  updateHud();
}
function onDeath(){
  // Quẻ Tiên Thiên · THIÊN MỆNH: mỗi màn chơi 1 lần, chết hồi sinh tại chỗ
  if (player.traitRevive && !player.reviveUsed){
    player.reviveUsed = true;
    player.hp = Math.round(player.maxHp * 0.5);
    player.combatT = 0;
    addFloat(player.x, player.y-56, '☯ THIÊN MỆNH — Tử Lý Đào Sinh!', '#f0a03a', 18);
    addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#f0a03a', big:true });
    AudioSys.sfx('levelup', 0.9);
    return;
  }
  // Tiên Thiên Công (Võ Học Phổ): chết tự hồi sinh 50% HP — CD 300s
  if (vhLearned('tienthiencong') && (player.vhReviveCd || 0) <= 0){
    player.vhReviveCd = 300;
    player.hp = Math.round(player.maxHp * 0.5);
    player.combatT = 0;
    addFloat(player.x, player.y-56, '✦ TIÊN THIÊN CÔNG — Tái Tạo Nhục Thân!', '#ffe9a8', 18);
    addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:'#ffe9a8', big:true });
    AudioSys.sfx('levelup', 0.9);
    return;
  }
  TRIB.active = false; TRIB.strikes = []; // chết giữa lôi kiếp = thất bại
  dead = true;
  const ov = document.getElementById('overlay');
  const _kb = player._killedByBoss; player._killedByBoss = null;
  document.getElementById('overlay-inner').innerHTML = _kb ? `
    <h2 style="color:#ff6b6b">Bại Trận!</h2>
    <p>Ngươi bị <b style="color:#ff8f6b">${_kb}</b> đánh bại.<br><span style="color:#e8b060;font-size:12.5px">Mẹo: khi trấn thủ tụ chiêu (vùng đỏ), lùi ra hoặc nhảy (J) né — sau đó là 2.5 giây phản công tốt nhất.<br>Hoặc quay lại khi ngươi đã mạnh hơn.</span></p>
    <button class="big-btn" onclick="respawn()">Tái Chiến</button>` : `
    <h2>Trọng Thương!</h2>
    <p>Ngươi bị đánh bại... Nhưng giang hồ chưa hề bỏ rơi kẻ có chí.<br>Hồi sinh tại làng Thanh Ngưu với đầy đủ sinh lực.</p>
    <button class="big-btn" onclick="respawn()">Hồi Sinh</button>`;
  ov.classList.remove('hidden');
}
window.respawn = function(){
  // Hồi sinh về điểm an toàn: làng Đào Hoa nếu chết ở map PK, còn lại tại chỗ spawn của map
  const md = mapDef();
  if (md.type !== 'safe' && !md.dungeon){ curMap = 'daohoa'; buildWorld(); }
  const sp = mapDef().spawn;
  player.x = sp.x + 40; player.y = sp.y + 40;
  player.hp = player.maxHp; player.qi = player.maxQi;
  player.poisonT = 0;
  dead = false;
  document.getElementById('overlay').classList.add('hidden');
};
function showVictory(){
  const sect = SECTS[player.sect];
  const sectLine = player.sect === 'vophai'
    ? 'Một Tán Nhân vô danh — từ nay giang hồ sẽ nhớ mặt ngươi.'
    : `<span style="color:${sect.color}">${sect.name}</span> tự hào về đệ tử của mình.`;
  document.getElementById('overlay-inner').innerHTML = `
    <h2>ĐỘT PHÁ BÌNH CẢNH!</h2>
    <p>Hắc Phong Sát Thủ đã bại dưới tay ngươi.<br>
    Từ một võ sinh vô danh, ngươi đã bước qua cánh cửa đầu tiên của giang hồ.<br><br>
    ${sectLine}<br><br>
    <i>Giang hồ còn dài: rèn Khai Quang +11 · độ kiếp Hóa Thần Cảnh · săn Ma Tôn mở Bảo Hạp tìm Cổ Thần Tứ Tượng · thu thập tàn quyển Huyết Ma Thôn Phệ từ Sát Thủ · đạt danh hiệu Tương Dương Đệ Nhất Hiệp!</i></p>
    <button class="big-btn" onclick="document.getElementById('overlay').classList.add('hidden')">Tiếp Tục Lang Bạt</button>`;
  document.getElementById('overlay').classList.remove('hidden');
  saveGame();
}

// ---------- Render ----------
// Tịnh Tâm Tuyền — suối thiền giữa rừng đào: mặt nước ngọc, gợn lan, hoa đào trôi,
// đá cuội vây bờ, sương mỏng, bia đá khắc chữ. Vẽ thuần canvas, tôn trọng Low FX.
function drawSpring(){
  const t = performance.now();
  const { x, y, r } = SPRING;
  // mặt nước ngọc — tâm sáng dần ra viền
  const g = ctx.createRadialGradient(x, y - 8, 6, x, y, r);
  g.addColorStop(0, 'rgba(150,230,210,.48)');
  g.addColorStop(0.55, 'rgba(70,175,155,.36)');
  g.addColorStop(1, 'rgba(46,110,96,.30)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(40,95,84,.6)'; ctx.lineWidth = 2.5; ctx.stroke();
  if (!SETTINGS.lowFx){
    // gợn sóng lan tỏa — 3 vòng lệch pha, chu kỳ 2s
    for (let i = 0; i < 3; i++){
      const k = ((t/2000) + i/3) % 1;
      ctx.beginPath(); ctx.arc(x, y, 8 + k*(r-12), 0, 7);
      ctx.strokeStyle = `rgba(220,255,245,${(1-k)*0.35})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // phản quang lấp lánh chạy quanh mặt suối
    for (let i = 0; i < 5; i++){
      const a = t/1400 + i*1.256;
      const rr = r*0.55 + Math.sin(t/700 + i)*10;
      ctx.beginPath(); ctx.arc(x + Math.cos(a)*rr, y + Math.sin(a)*rr*0.6, 1.6, 0, 7);
      ctx.fillStyle = `rgba(240,255,250,${0.25 + 0.2*Math.sin(t/300 + i)})`; ctx.fill();
    }
    // cánh hoa đào trôi lênh đênh, xoay chậm — seed cố định
    for (let i = 0; i < 7; i++){
      const sd = Math.sin(i*127.1)*43758.5; const f = sd - Math.floor(sd);
      const a0 = f*6.283, rr0 = (0.15 + 0.7*((f*7.3)%1))*r;
      const px = x + Math.cos(a0 + t/9000*(i%2 ? 1 : -1))*rr0;
      const py = y + Math.sin(a0 + t/9000*(i%2 ? 1 : -1))*rr0*0.7;
      ctx.save(); ctx.translate(px, py); ctx.rotate(t/1600 + i);
      ctx.fillStyle = 'rgba(255,183,197,.85)';
      ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 2.6, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
    // sương mỏng bốc lên từ mặt nước
    for (let i = 0; i < 3; i++){
      const k = ((t/4200) + i/3) % 1;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(i*9)*r*0.4, y - k*46, 26 + k*20, 9 + k*7, 0, 0, 7);
      ctx.fillStyle = `rgba(235,250,245,${0.1*(1-k)})`; ctx.fill();
    }
  }
  // đá cuội mực xám vây quanh bờ — seed cố định
  for (let i = 0; i < 7; i++){
    const a = i/7*6.283 + 0.35;
    const sd = Math.sin(i*311.7)*24634.6; const f = sd - Math.floor(sd);
    const rx = x + Math.cos(a)*(r + 8 + f*6), ry = y + Math.sin(a)*(r*0.86 + 6 + f*5);
    const rs = 5 + f*6;
    ctx.beginPath(); ctx.ellipse(rx, ry, rs, rs*0.72, a, 0, 7);
    ctx.fillStyle = '#8d8d90'; ctx.fill();
    ctx.strokeStyle = 'rgba(40,40,44,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(rx - rs*0.25, ry - rs*0.28, rs*0.4, rs*0.24, a, 0, 7);
    ctx.fillStyle = 'rgba(230,230,235,.35)'; ctx.fill();
  }
  // bia đá khắc "Tịnh Tâm" cạnh bờ
  const bx = x + r + 34, by = y - r*0.5 - 18;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx-11, by-30, 22, 34, 4); else ctx.rect(bx-11, by-30, 22, 34);
  ctx.fillStyle = '#7f7f84'; ctx.fill();
  ctx.strokeStyle = 'rgba(35,35,40,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#5a5a60'; ctx.fillRect(bx-15, by+2, 30, 5); // đế bia
  ctx.save(); ctx.translate(bx, by-8); ctx.rotate(-0.03);
  ctx.fillStyle = '#2e3438'; ctx.font = '11px "Ma Shan Zheng", serif'; ctx.textAlign = 'center';
  ctx.fillText('Tịnh', 0, -4); ctx.fillText('Tâm', 0, 9);
  ctx.restore();
  drawCalligraphy('Tịnh Tâm Tuyền', x, y - r - 14, '#2e6e60', 15);
}

function render(){
  // paper background — màu nền theo bản đồ hiện tại
  const md = mapDef();
  ctx.fillStyle = md.ground; ctx.fillRect(0,0,W,H);
  if (!player){ drawTitleBackdrop(); return; }

  ctx.save();
  // rung màn hình khi trúng đòn — tôn trọng cài đặt (mặc định tắt, chống chóng mặt)
  if (shakeT > 0 && SETTINGS.shake){ ctx.translate(rnd(-shakeMag, shakeMag)*shakeT/0.16, rnd(-shakeMag, shakeMag)*shakeT/0.16); }
  ctx.translate(-camera.x, -camera.y);

  // nền bản đồ vẽ tay — phủ toàn bộ thế giới, nằm dưới mọi decor/thực thể
  const bg = MAP_BG[curMap];
  if (bg && bg.complete && bg.naturalWidth > 0) ctx.drawImage(bg, 0, 0, MAP.w, MAP.h);

  // ground texture: faint brush patches
  ctx.globalAlpha = 0.05; ctx.fillStyle = md.patch;
  for (let gx = Math.floor(camera.x/160)*160; gx < camera.x+W+160; gx += 160)
    for (let gy = Math.floor(camera.y/160)*160; gy < camera.y+H+160; gy += 160){
      ctx.beginPath(); ctx.ellipse(gx+80, gy+80, 55, 30, (gx*7+gy*13)%3, 0, 7); ctx.fill();
    }
  ctx.globalAlpha = 1;
  drawTufts(); // cỏ/vết mực trên mặt đất — phá sự phẳng của nền
  drawWaterFx(); // gợn sóng & lấp lánh mặt nước (Gói F)
  drawAiPasses(); drawBeacon(); // GDD Đợt 2 A/B2

  // Đào Hoa Đảo: cụm hoa đào tĩnh rụng dưới gốc cây (seed theo vị trí cây)
  if (curMap === 'daohoa'){
    ctx.fillStyle = 'rgba(255,183,197,.55)';
    for (const d of decor){
      if (d.type !== 'tree') continue;
      if (d.x < camera.x-60 || d.x > camera.x+W+60 || d.y < camera.y-60 || d.y > camera.y+H+60) continue;
      for (let i = 0; i < 4; i++){
        const sd = Math.sin(d.x*0.37 + i*97.3)*24634.6; const f = sd - Math.floor(sd);
        ctx.beginPath();
        ctx.ellipse(d.x + (f-0.5)*56, d.y + 10 + ((f*13.7)%1)*26, 3.2, 2, f*3, 0, 7);
        ctx.fill();
      }
    }
  }

  // map border ink
  ctx.strokeStyle = 'rgba(43,38,32,.5)'; ctx.lineWidth = 14;
  ctx.strokeRect(7,7,MAP.w-14,MAP.h-14);

  // spirit spring — Tịnh Tâm Tuyền, chỉ có ở Đào Hoa Đảo
  if (md.spring) drawSpring();

  // vùng hoạt động của AUTO FARM — vòng neo mờ quanh điểm bật auto
  if (player.auto && player._autoAX != null){
    ctx.beginPath(); ctx.arc(player._autoAX, player._autoAY, (player.autoCfg ? player.autoCfg.range : 430), 0, 7);
    ctx.strokeStyle = 'rgba(106,232,138,.28)'; ctx.setLineDash([10,10]); ctx.lineWidth = 2; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(player._autoAX, player._autoAY, 5, 0, 7);
    ctx.fillStyle = 'rgba(106,232,138,.5)'; ctx.fill();
  }

  // boss arena marker
  if (md.boss && questIdx >= 9 && !victory){
    ctx.beginPath(); ctx.arc(BOSS_ARENA.x, BOSS_ARENA.y, 90, 0, 7);
    ctx.strokeStyle = 'rgba(180,40,40,.5)'; ctx.setLineDash([8,8]); ctx.lineWidth = 3; ctx.stroke();
    ctx.setLineDash([]);
    drawCalligraphy('Sát Đài', BOSS_ARENA.x, BOSS_ARENA.y - 104, '#8a2020', 15);
  }

  // Vòng lãnh địa boss — ranh giới đứt nét đỏ: bước vào là tự nguyện giao chiến
  for (const m of mobs){
    if (m.dead || !(m.type === 'boss' || m.def.bossKind)) continue;
    const _hx = m.homeX ?? (m.zone ? m.zone.x : m.x), _hy = m.homeY ?? (m.zone ? m.zone.y : m.y);
    const _lr = m.def.bossKind ? 470 : 540;
    if (_hx < camera.x - _lr || _hx > camera.x + W + _lr || _hy < camera.y - _lr || _hy > camera.y + H + _lr) continue;
    ctx.beginPath(); ctx.arc(_hx, _hy, _lr, 0, 7);
    ctx.strokeStyle = 'rgba(200,60,40,.30)'; ctx.setLineDash([14, 10]); ctx.lineWidth = 2.5; ctx.stroke(); ctx.setLineDash([]);
    drawCalligraphy('⚠ Lãnh Địa Boss', _hx, _hy - _lr - 6, '#c05a4a', 13);
  }

  // village / city labels
  if (md.village) drawCalligraphy('Thanh Ngưu Thôn', 400, 310, '#6a5836', 18);
  if (md.city){
    drawCityWalls();
    drawCalligraphy('Tương Dương Thành', 1300, 880, '#6a5836', 20);
    drawCalligraphy('Chợ Đấu Giá', 1150, 950, '#2e5e8a', 14);
    drawCalligraphy('Lò Bát Quái', 1480, 1130, '#8a4a2e', 14);
    drawCalligraphy('Dược Phường', 1060, 1090, '#3a6a3e', 14);
    drawCalligraphy('Vũ Khí Phường', 1580, 950, '#5a5a6a', 14);
    drawCalligraphy('Trà Quán', 1230, 1240, '#8a6a2e', 14);
  }
  drawGates();

  // decor (behind entities)
  const sortedDecor = decor.filter(d=>d.x>camera.x-80&&d.x<camera.x+W+80&&d.y>camera.y-120&&d.y<camera.y+H+80);
  for (const d of sortedDecor){ if (d.type==='rock') drawRock(d); }

  // pickups (herbs) — bụi thuốc 5 lá + hoa, lấp lánh báo hái được; héo xám sau khi hái
  const _herbT = performance.now();
  for (const p of pickups){
    if (p.respawn > 0){ // đã hái — cành héo xám chờ hồi sinh
      ctx.strokeStyle = 'rgba(120,116,100,.6)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x-3, p.y-7, p.x-2, p.y-11); ctx.stroke();
      ctx.fillStyle = 'rgba(140,136,120,.5)';
      ctx.beginPath(); ctx.ellipse(p.x-2, p.y-9, 3, 1.8, -0.6, 0, 7); ctx.fill();
      continue;
    }
    ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x-4, p.y-10, p.x-1, p.y-16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x+5, p.y-9, p.x+3, p.y-15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x, p.y-12, p.x, p.y-18); ctx.stroke();
    ctx.fillStyle = '#5fc96e';
    ctx.beginPath(); ctx.ellipse(p.x-3, p.y-12, 4, 2.4, -0.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x+4, p.y-10, 4, 2.4, 0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x+1, p.y-15, 3.4, 2, -0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x-4, p.y-7, 3.2, 1.9, -0.9, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8d9b0'; ctx.beginPath(); ctx.arc(p.x, p.y-19, 2.5, 0, 7); ctx.fill();
    if (!SETTINGS.lowFx){ // lấp lánh báo "hái được"
      const tw = (Math.sin(_herbT/280 + p.x*0.7) + 1)/2;
      ctx.fillStyle = `rgba(190,255,170,${0.25 + tw*0.55})`;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(_herbT/500)*7, p.y - 22 + Math.sin(_herbT/600)*3, 1.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - Math.cos(_herbT/430)*6, p.y - 13, 1.2, 0, 7); ctx.fill();
    }
  }

  // NPC
  drawNpc();
  drawTanNpcs(); // Nhân Mạch: tán tu giang hồ

  // Boss telegraph: vùng cảnh báo chiêu trên mặt đất (GDD Boss v2.1)
  for (const m of mobs){ if (m.tele) drawBossTele(m); }
  // trees after npc but before mobs for depth — simple approach: draw all entities sorted by y
  const ents = [];
  for (const m of mobs){
    if (!m.dead) ents.push({ y:m.y, draw:()=>drawMob(m) });
    else if (m.deadT > 0) ents.push({ y:m.y, draw:()=>{ // xác quái tan dần thành vệt mực loang
      const k = Math.max(0, m.deadT/0.45);
      ctx.save(); ctx.globalAlpha = k*0.45;
      ctx.fillStyle = '#241f18';
      ctx.beginPath(); ctx.ellipse(m.x, m.y+4, m.def.size*(1+(1-k)*0.8), m.def.size*0.5*(1+(1-k)*0.4), 0, 0, 7); ctx.fill();
      ctx.restore();
    }});
  }
  ents.push({ y:player.y, draw:()=>{ drawPlayer();
    // vòng sáng tịnh tâm quanh người khi đang đứng trong suối hồi phục
    if (md.spring && dist(player.x, player.y, SPRING.x, SPRING.y) < SPRING.r){
      ctx.beginPath(); ctx.arc(player.x, player.y+2, 26 + Math.sin(performance.now()/300)*3, 0, 7);
      ctx.strokeStyle = 'rgba(120,230,200,.42)'; ctx.lineWidth = 2; ctx.stroke();
    }
  } });
  if (petObj) ents.push({ y:petObj.y, draw:drawPet });
  if (mountObj) ents.push({ y:mountObj.y, draw:drawMount });
  for (const h of horses) ents.push({ y:h.y, draw:(hh => () => drawHorse(hh))(h) }); // GDD Đợt 2 B5
  for (const d of sortedDecor) if (d.type==='tree') ents.push({ y:d.y, draw:()=>drawTree(d) });
  ents.sort((a,b)=>a.y-b.y);
  for (const e of ents) e.draw();

  if (TRIB.active) drawTrib(); // A1: vùng cảnh báo thiên lôi

  // projectiles — mỗi tuyệt chiêu một kiểu đạn riêng
  for (const p of projectiles){ drawProjStyled(p); }

  // effects
  for (const e of effects){
    const k = e.t / (e.dur || (e.big?0.7:0.45)), a = 1 - k;
    if (e.type==='arc'){
      ctx.strokeStyle = e.color; ctx.globalAlpha = a*0.85; ctx.lineWidth = 5*(1-k)+2; ctx.lineCap='round';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r*(0.6+k*0.6), e.face-0.9, e.face+0.9); ctx.stroke();
    } else if (e.type==='ring'){
      ctx.strokeStyle = e.color; ctx.globalAlpha = a*0.8; ctx.lineWidth = e.big?6:3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r*(0.25+k*0.85), 0, 7); ctx.stroke();
    } else if (e.type==='cone'){
      ctx.fillStyle = e.color; ctx.globalAlpha = a*0.4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, e.r*(0.4+k*0.7), e.face-1.0, e.face+1.0); ctx.closePath(); ctx.fill();
    } else if (e.type==='ink'){
      ctx.fillStyle = e.color; ctx.globalAlpha = a*0.7;
      ctx.beginPath(); ctx.arc(e.x, e.y, 3.5*(1-k)+1, 0, 7); ctx.fill();
    } else if (e.type==='critflash'){ // chớp trắng bạo kích (Gói E)
      ctx.globalAlpha = a*0.9;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3*(1-k)+1; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++){ const aa = i*Math.PI/4 + 0.4;
        const r0 = e.r*(0.3+k*0.5), r1 = e.r*(0.85+k*0.35);
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(aa)*r0, e.y + Math.sin(aa)*r0);
        ctx.lineTo(e.x + Math.cos(aa)*r1, e.y + Math.sin(aa)*r1); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,244,200,.9)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r*0.35*(1-k)+2, 0, 7); ctx.fill();
    } else if (e.type==='spark'){ // tia lấp lánh bắn lên (Gói E)
      ctx.globalAlpha = a*0.95; ctx.strokeStyle = e.color || '#ffd76a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++){ const aa = (i-2.5)*0.5;
        const L = (e.r||36)*(0.35+k*0.75);
        ctx.beginPath(); ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.sin(aa)*L*0.55, e.y - L); ctx.stroke(); }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y, 3*(1-k)+1, 0, 7); ctx.fill();
    } else if (e.type==='vfx'){
      drawVfx(e, k, a);
    } else if (e.type==='slash'){
      // Kiếm Khí — sword-qi crescent sweeping toward the target
      if (SLASH_IMG.complete && SLASH_IMG.naturalWidth){
        const w = (e.s || 110) * (0.75 + k*0.6);
        const h = w * (SLASH_IMG.naturalHeight / SLASH_IMG.naturalWidth);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
        ctx.globalAlpha = Math.min(1, a*1.4);
        ctx.drawImage(SLASH_IMG, -w*0.05, -h/2, w, h);
        ctx.restore(); ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  }

  // hạt môi trường bay trong thế giới (dưới chữ nổi, trên entities)
  drawAmbients();

  // floats
  ctx.textAlign = 'center';
  for (const f of floats){
    ctx.globalAlpha = Math.min(1, f.t*1.6);
    ctx.font = `bold ${f.size}px "Playfair Display", "Noto Serif", serif`;
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // mist (screen space, top) — tắt khi Giảm Hiệu Ứng
  if (!SETTINGS.lowFx){
    for (const mi of mists){
      const g = ctx.createRadialGradient(mi.x, mi.y, 0, mi.x, mi.y, mi.r);
      g.addColorStop(0, `rgba(236,226,200,${mi.a})`); g.addColorStop(1, 'rgba(236,226,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mi.x, mi.y, mi.r, 0, 7); ctx.fill();
    }
  }

  // ink mountains vignette top
  drawMountains();

  // bản đồ thu nhỏ góc phải
  drawMinimap();

  // bản đồ tối (Cổ Mộ Mật Thất) — phủ màn u ám
  if (md.dark){
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.28, W/2, H/2, H*0.75);
    vg.addColorStop(0, 'rgba(10,8,14,0)'); vg.addColorStop(1, 'rgba(10,8,14,.62)');
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
  } else if (!SETTINGS.lowFx){
    // vignette ấm rất nhẹ cho mọi bản đồ — tạo chiều sâu, xóa cảm giác "phẳng"
    const vg2 = ctx.createRadialGradient(W/2, H/2, H*0.44, W/2, H/2, H*0.88);
    vg2.addColorStop(0, 'rgba(24,16,8,0)'); vg2.addColorStop(1, 'rgba(24,16,8,.16)');
    ctx.fillStyle = vg2; ctx.fillRect(0,0,W,H);
  }

  // banner tên bản đồ khi vừa dịch chuyển
  // viền đỏ nhấp khi người chơi trúng đòn (screen-space)
  if (player && player.hurtT > 0){
    const ha = player.hurtT / 0.25 * 0.35;
    const hg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.75);
    hg.addColorStop(0, 'rgba(200,30,20,0)'); hg.addColorStop(1, `rgba(200,30,20,${ha})`);
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
  }
  // máu thấp <25%: viền đỏ nhấp nháy cảnh báo sinh tử (Gói E)
  if (player && player.hp > 0 && player.hp < player.maxHp*0.25){
    const lp = 0.5 + 0.5*Math.sin(performance.now()/260);
    const lg = ctx.createRadialGradient(W/2, H/2, H*0.34, W/2, H/2, H*0.78);
    lg.addColorStop(0, 'rgba(190,16,16,0)'); lg.addColorStop(1, 'rgba(190,16,16,' + (0.14 + 0.18*lp).toFixed(3) + ')');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  }
  drawBeaconArrow(); // GDD Đợt 2 B2: mũi tên chỉ hướng khi mục tiêu ngoài màn hình
  if (DGN) drawDungeonHUD(); // HUD phó bản: đợt quái + thanh máu boss

  // ☬ Cốt truyện: trời tối dần khi các Trấn Ải vỡ
  const _nTa = Object.keys(player.storyFlags || {}).filter(k => k.startsWith('ta_')).length;
  if (_nTa >= 3 && !SETTINGS.lowFx){ ctx.fillStyle = `rgba(8,6,20,${Math.min(0.18, 0.05 + _nTa * 0.018)})`; ctx.fillRect(0, 0, W, H); }

  drawSkyOverlay(); // Lịch Tu Tiên: bầu trời ngày/đêm theo canh giờ

  if (zoneBanner){
    const a = Math.min(1, zoneBanner.t / 0.6);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = 'bold 34px "Playfair Display", "Noto Serif", serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.65)'; ctx.lineWidth = 5;
    ctx.strokeText(zoneBanner.text, W/2, H*0.24);
    ctx.fillStyle = zoneBanner.color; ctx.fillText(zoneBanner.text, W/2, H*0.24);
    ctx.font = 'bold 15px "Playfair Display", "Noto Serif", serif';
    ctx.strokeText(zoneBanner.sub, W/2, H*0.24 + 26);
    ctx.fillStyle = '#e8dcc0'; ctx.fillText(zoneBanner.sub, W/2, H*0.24 + 26);
    ctx.globalAlpha = 1;
  }

  // interact hint — NPC gần nhất trong bản đồ
  let nearNpc = null;
  for (const n of NPCS){
    if (n.map !== curMap) continue;
    if (dist(player.x, player.y, n.x, n.y) < 95){ nearNpc = n; break; }
  }
  if (!nearNpc) for (const n of tanNpcs){ // Nhân Mạch
    if (n.map !== curMap) continue;
    if (dist(player.x, player.y, n.x, n.y) < 95){ nearNpc = n; break; }
  }
  if (nearNpc)
    drawCalligraphy(`Nhấn E — ${nearNpc.name}`, W/2, H-130, '#f0d68a', 15, true);
}

// ---------- Drawing helpers ----------
function drawCalligraphy(text, x, y, color, size, screenSpace){
  ctx.font = `bold ${size}px "Playfair Display", "Noto Serif", serif`;
  ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawTree(d){
  // cây đung đưa theo gió — xoay nhẹ quanh gốc, mỗi cây một pha riêng (tắt khi lowFx)
  const sway = SETTINGS.lowFx ? 0 : Math.sin(performance.now()/900 + d.x*0.013 + d.y*0.007) * 0.024;
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(sway); ctx.translate(-d.x, -d.y);
  const tim = (typeof TREE_IMGS !== 'undefined') && TREE_IMGS[curMap];
  if (tim && tim.complete && tim.naturalWidth){
    const h = 100*d.s, w = h * (tim.naturalWidth/tim.naturalHeight);
    ctx.drawImage(tim, d.x-w/2, d.y-h*0.94, w, h);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = '#3a3025'; ctx.lineWidth = 4*d.s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.quadraticCurveTo(d.x+4*d.s, d.y-18*d.s, d.x-2*d.s, d.y-34*d.s); ctx.stroke();
  const g = ctx.createRadialGradient(d.x, d.y-40*d.s, 2, d.x, d.y-40*d.s, 26*d.s);
  g.addColorStop(0, 'rgba(46,74,50,.85)'); g.addColorStop(1, 'rgba(46,74,50,.15)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(d.x, d.y-40*d.s, 26*d.s, 18*d.s, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(d.x-14*d.s, d.y-30*d.s, 14*d.s, 10*d.s, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(d.x+14*d.s, d.y-32*d.s, 13*d.s, 9*d.s, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawRock(d){
  const rim = (typeof ROCK_IMGS !== 'undefined') && ROCK_IMGS[Math.abs(((d.x*7+d.y*13)|0)) % ROCK_IMGS.length];
  if (rim && rim.complete && rim.naturalWidth){
    const w = 46*d.s, h = w * (rim.naturalHeight/rim.naturalWidth);
    ctx.drawImage(rim, d.x-w/2, d.y-h*0.75, w, h);
    return;
  }
  ctx.fillStyle = 'rgba(90,85,75,.5)';
  ctx.beginPath(); ctx.ellipse(d.x, d.y, 14*d.s, 9*d.s, 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(120,115,105,.4)';
  ctx.beginPath(); ctx.ellipse(d.x-3*d.s, d.y-3*d.s, 8*d.s, 5*d.s, 0.2, 0, 7); ctx.fill();
}
function drawNpc(){
  const x = NPC.x, y = NPC.y;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y+8, 14, 5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a4a30';
  ctx.beginPath(); ctx.ellipse(x, y-8, 11, 15, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(x, y-28, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x-4, y-22); ctx.quadraticCurveTo(x, y-14, x+4, y-22); ctx.stroke();
  ctx.fillStyle = '#f0d68a'; ctx.font = 'bold 13px \"Be Vietnam Pro\", sans-serif'; ctx.textAlign='center';
  ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3;
  const q = currentQuest();
  const mark = q && questState==='done' ? '!' : (q ? '…' : '');
  if (mark){ ctx.strokeText(mark, x, y-44); ctx.fillText(mark, x, y-44); }
  ctx.font = '12px \"Be Vietnam Pro\", sans-serif'; ctx.fillStyle = '#fff';
  ctx.strokeText(NPC.name, x, y-52); ctx.fillText(NPC.name, x, y-52);
}
function drawMob(m){
  const d = m.def;
  const bob = Math.sin(m.wob)*2;
  // hiệu ứng lao tới khi ra đòn (lunge)
  let lx = 0, ly = 0;
  if (m.lungeT > 0){
    const lp = Math.sin((0.22 - m.lungeT)/0.22 * Math.PI) * 11;
    lx = Math.cos(m.face || 0)*lp; ly = Math.sin(m.face || 0)*lp;
  }
  const dx = m.x + lx, dy = m.y + ly;
  const _mshI = gameTimeInfo(), _mshDx = (_mshI.frac - 0.5) * 14, _mshAl = 1 - skyDarkness()*0.35;
  ctx.fillStyle = 'rgba(0,0,0,' + (0.07*_mshAl).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(m.x + _mshDx, m.y+6, d.size*1.5, d.size*0.52, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,' + (0.16*_mshAl).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(m.x + _mshDx*0.45, m.y+6, d.size, d.size*0.35, 0, 0, 7); ctx.fill();
  // hào quang ngũ hành quanh quái (mờ, theo hệ)
  if (d.el && NGU_HANH[d.el]){
    ctx.save(); ctx.globalAlpha = 0.14 + 0.05*Math.sin(m.wob*1.3);
    ctx.strokeStyle = NGU_HANH[d.el].color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(dx, dy+4, d.size+6, (d.size+6)*0.4, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // shield aura
  if (m.shield > 0){
    ctx.strokeStyle = 'rgba(192,127,224,.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(dx, dy-6+bob*0.4, d.size+8, 0, 7); ctx.stroke();
  }
  // body — sprite art with ink-blob fallback
  let topY = dy - d.size;
  const img = MOB_IMGS[m.type];
  if (img && img.complete && img.naturalWidth){
    const mw = d.size * (d.boss ? 4.4 : 3.3); // vừa tầm nhìn — không chồng lấn khi đứng cụm
    const mh = mw * (img.naturalHeight / img.naturalWidth);
    topY = dy - mh*0.28 - mh/2 + bob;
    const flip = Math.cos(m.face || 0) < 0;
    ctx.save(); ctx.translate(dx, dy - mh*0.28 + bob);
    if (flip) ctx.scale(-1, 1);
    if (m.hitT > 0) ctx.filter = 'brightness(1.7) saturate(2) hue-rotate(-45deg)';
    ctx.drawImage(img, -mw/2, -mh/2, mw, mh);
    ctx.restore();
  } else {
    ctx.fillStyle = m.hitT > 0 ? '#8a2020' : d.color;
    ctx.beginPath(); ctx.ellipse(dx, dy-4+bob, d.size, d.size*0.85, 0, 0, 7); ctx.fill();
    // eyes
    ctx.fillStyle = d.eye;
    ctx.beginPath(); ctx.arc(dx-d.size*0.35, dy-10+bob, 2.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(dx+d.size*0.35, dy-10+bob, 2.2, 0, 7); ctx.fill();
    if (d.sash){ ctx.strokeStyle = d.sash; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx-d.size*0.7, dy+2+bob); ctx.lineTo(dx+d.size*0.7, dy-2+bob); ctx.stroke(); }
  }
  // hp bar (above the sprite)
  const bw = Math.max(d.size*2.2, 44);
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(dx-bw/2, topY-10, bw, 4);
  ctx.fillStyle = d.boss ? '#ff3a3a' : '#c0392b';
  ctx.fillRect(dx-bw/2, topY-10, bw*Math.max(0,m.hp/m.maxHp), 4);
  // huy hiệu ngũ hành (金木水火土) + tên quái
  if (!SETTINGS.mobName) return;
  const nameTxt = `${d.bossKind === 'tranai' ? '☬ TRẤN ẢI ' : d.bossKind === 'thuve' ? '⛨ THỦ VỆ ' : ''}${m.name}${m.revenge ? ' ⚔TRUY THÙ' : ''} · C${d.lv}`;
  ctx.font = '10px \"Be Vietnam Pro\", sans-serif'; ctx.textAlign='center';
  const eld = d.el && NGU_HANH[d.el];
  const nw = ctx.measureText(nameTxt).width;
  const nameX = eld ? dx + 8 : dx;
  if (eld){
    // vòng tròn hệ + chữ Hán
    ctx.beginPath(); ctx.arc(nameX - nw/2 - 10, topY-17, 7, 0, 7);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fill();
    ctx.strokeStyle = eld.color; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = eld.color; ctx.font = 'bold 9px \"Be Vietnam Pro\", sans-serif';
    ctx.fillText(eld.glyph, nameX - nw/2 - 10, topY-14);
    ctx.font = '10px \"Be Vietnam Pro\", sans-serif';
  }
  ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=2.5;
  ctx.strokeText(nameTxt, nameX, topY-14);
  ctx.fillStyle = d.boss ? '#c02020' : '#3a3226';
  ctx.fillText(nameTxt, nameX, topY-14);
}
// Thần Binh lơ lửng theo người chơi — dáng vũ khí riêng từng môn phái, sáng dần theo tầng
function drawThanBinh(p){
  const tb = p.thanbinh; if (!tb || tb.tier <= 0) return;
  const def = THANBINH[p.sect] || THANBINH.vophai;
  const tier = tb.tier;
  const col = TB_TIER_COLORS[tier-1];
  const now = performance.now();
  const backAng = p.face + Math.PI;
  const bob = Math.sin(now/420) * 2.2;
  ctx.save();
  const _tbRes = !SETTINGS.lowFx && typeof mobs !== 'undefined' && mobs.some(b => !b.dead && b.def.bossKind === 'tranai' && dist(p.x, p.y, b.x, b.y) < 520);
  if ((tier >= 4 || _tbRes) && !SETTINGS.lowFx){ ctx.shadowColor = _tbRes && tier < 4 ? '#c04848' : def.color; ctx.shadowBlur = 3 + Math.max(tier, 2) * 1.5 + (_tbRes ? 3 : 0); }
  ctx.lineCap = 'round';
  const bx = p.x + Math.cos(backAng)*15, by = p.y - 24 + Math.sin(backAng)*6 + bob;
  if (def.kind === 'kiem' || def.kind === 'dao' || def.kind === 'thuong' || def.kind === 'truong'){
    // bay sau lưng, mũi hơi chúc xuống
    const ang = backAng + 0.45;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const len = def.kind === 'kiem' ? 30 : def.kind === 'dao' ? 26 : 36;
    ctx.strokeStyle = def.kind === 'truong' ? '#6a5a42' : col; ctx.lineWidth = def.kind === 'thuong' || def.kind === 'truong' ? 2.4 : 3.4;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + ux*len, by + uy*len); ctx.stroke();
    if (def.kind === 'kiem' || def.kind === 'dao'){ // thanh kiếm/đao sáng
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(bx + ux*8, by + uy*8); ctx.lineTo(bx + ux*len, by + uy*len); ctx.stroke();
      // chuôi + quả chắn
      ctx.strokeStyle = '#5a4a30'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(bx - ux*6, by - uy*6); ctx.lineTo(bx + ux*6, by + uy*6); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + ux*5 - uy*5, by + uy*5 + ux*5); ctx.lineTo(bx + ux*5 + uy*5, by + uy*5 - ux*5); ctx.stroke();
    } else { // thương/trượng: đầu nhọn/đầu trượng màu phái
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(bx + ux*(len+2), by + uy*(len+2), def.kind === 'truong' ? 5 : 4, 0, 7); ctx.fill();
      if (def.kind === 'thuong'){
        ctx.beginPath();
        ctx.moveTo(bx + ux*(len+9), by + uy*(len+9));
        ctx.lineTo(bx + ux*len - uy*3.5, by + uy*len + ux*3.5);
        ctx.lineTo(bx + ux*len + uy*3.5, by + uy*len - ux*3.5);
        ctx.closePath(); ctx.fill();
      }
    }
  } else if (def.kind === 'quyen'){
    // quyền sáo bọc kim — hai nắm đấm phát sáng hai bên tay
    for (const s2 of [-1, 1]){
      const fx = p.x + Math.cos(p.face + s2*1.35)*11, fy = p.y - 14 + Math.sin(p.face + s2*1.35)*5 + bob*0.5;
      const pulse = p.castT > 0 ? 1.6 : 1; // ra đòn: nắm đấm bùng sáng
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(fx, fy, 4.6*pulse, 0, 7); ctx.fill();
      ctx.strokeStyle = def.color; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(fx, fy, 6.4*pulse, 0, 7); ctx.stroke();
    }
  } else if (def.kind === 'quat'){
    // quạt sắt xoay chậm ngang hông
    const qx = p.x + Math.cos(p.face + 2.3)*14, qy = p.y - 8 + Math.sin(p.face + 2.3)*5 + bob;
    const open = 0.9 + Math.sin(now/600)*0.25;
    ctx.save(); ctx.translate(qx, qy); ctx.rotate(now/1800);
    ctx.strokeStyle = col; ctx.lineWidth = 1.8;
    for (let i = -2; i <= 2; i++){
      const a = i*open/2 - Math.PI/2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a)*14, Math.sin(a)*14); ctx.stroke();
    }
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 14, -Math.PI/2 - open/2*2*0.5 - open/2, -Math.PI/2 + open/2 + open/2*2*0.5); ctx.stroke();
    ctx.restore();
  } else if (def.kind === 'chau'){
    // tràng hạt vòng quanh vai — 9 hạt xoay chậm
    const cr = 16;
    for (let i = 0; i < 9; i++){
      const a = now/1600 + i*(Math.PI*2/9);
      ctx.fillStyle = i === 0 ? def.color : col;
      ctx.beginPath(); ctx.arc(p.x + Math.cos(a)*cr, p.y - 22 + Math.sin(a)*cr*0.42 + bob*0.4, 2.2, 0, 7); ctx.fill();
    }
  } else { // holu — hồ lô rượu đong đưa bên hông
    const hx = p.x + Math.cos(p.face - 2.3)*14, hy = p.y - 4 + Math.sin(p.face - 2.3)*5;
    const sway = Math.sin(now/500)*0.18;
    ctx.save(); ctx.translate(hx, hy + bob*0.6); ctx.rotate(sway);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 4, 5.5, 0, 7); ctx.fill();   // thân dưới
    ctx.beginPath(); ctx.arc(0, -2.5, 3.4, 0, 7); ctx.fill(); // thân trên
    ctx.fillStyle = '#5a4a30'; ctx.fillRect(-1.6, -8, 3.2, 3.5); // nút
    ctx.strokeStyle = def.color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 4, 5.5, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // tầng 10 — Thức Tỉnh: quầng sáng đổi màu chạy quanh thần binh
  if (tier >= 10 && !SETTINGS.lowFx){
    ctx.globalAlpha = 0.5 + 0.3*Math.sin(now/180);
    ctx.strokeStyle = def.color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(bx, by, 20 + Math.sin(now/240)*3, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}


// ═══════════ PHI THĂNG · THẦN TIÊN HÓA CẢNH — tiên nhân vẽ bằng VFX thuần (nam/nữ + 6 skin) ═══════════
const TIEN_SKINS = {
  bach:  { name:'Bạch Y Tiên Tử',       robe:'#f2ecdc', trim:'#c9a227', ribbon:'#f0d68a', halo:'#fff2b0', metal:'#cfd8e8', hair:'#241c18' },
  thanh: { name:'Thanh Ngọc Chân Nhân', robe:'#8ad8c8', trim:'#2a6a5a', ribbon:'#c8f0e4', halo:'#a8ffe0', metal:'#b8d8d0', hair:'#1a2a26' },
  kim:   { name:'Kim Quang Thánh Quân', robe:'#e8c84a', trim:'#8a5a1a', ribbon:'#ffe8a0', halo:'#ffd76a', metal:'#f0e0b0', hair:'#3a2a12' },
  huyen: { name:'Huyền Ảnh Dạ Quân',    robe:'#4a3a6a', trim:'#b08ae8', ribbon:'#9a7ad8', halo:'#c09aff', metal:'#7a6a9a', hair:'#16121f' },
  hong:  { name:'Hồng Nhan Tiên Cơ',    robe:'#f0a8c0', trim:'#b03a5a', ribbon:'#ffd6e4', halo:'#ffb8d0', metal:'#f0d8e0', hair:'#2a1a20' },
  lam:   { name:'Thương Lam Kiếm Tiên', robe:'#5a8ad8', trim:'#1a3a6a', ribbon:'#a8ccff', halo:'#9fd0ff', metal:'#c0d8f0', hair:'#141c2a' },
};
function ascendToImmortal(){
  if (!player || player.ascended) return;
  player.ascended = true;
  player.oldSect = player.sect;
  // Môn phái phá bỏ hoàn toàn — mọi võ học môn phái tự ngộ, kết hợp không giới hạn
  let learned = 0;
  for (const _id in VOHOC_DEFS){ if (VOHOC_DEFS[_id].phai && !vhLearned(_id)){ player.vohoc[_id] = true; learned++; } }
  closePanels();
  zoneBanner = { text:'☁ PHI THĂNG · THẦN TIÊN HÓA CẢNH', sub:`Xuất thế khỏi ${SECTS[player.oldSect].name} — môn phái phá bỏ · ngự kiếm phi hành · võ học toàn tự do!`, color:'#fff2b0', t:6 };
  addFloat(player.x, player.y-86, '☁ PHI THĂNG!', '#fff2b0', 24);
  if (learned) addFloat(player.x, player.y-62, `Môn phái phá bỏ — tự ngộ thêm ${learned} môn võ học`, '#a0ffe9', 13);
  addFloat(player.x, player.y-42, 'Ngự Kiếm Phi Hành — tốc độ +25% · mở Cài Đặt (O) đổi hình dáng & tiên y', '#9fd0ff', 12);
  addEffect({ type:'vfx', style:'galaxy', x:player.x, y:player.y, r:150, c1:'#fff2b0', c2:'#9fd0ff', glyph:'仙', dur:1.4, big:true, spin:2.5 });
  addEffect({ type:'vfx', style:'thunderpillar', x:player.x, y:player.y, r:130, c1:'#fff2b0', c2:'#e8c84a', glyph:'仙', dur:1.0 });
  for (let i = 0; i < 20; i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-110,110), vy:rnd(-160,-40), color:'#fff2b0' });
  AudioSys.sfx('levelup', 1); AudioSys.sfx('quest', 0.9);
  calcDerived(); saveGame(); checkTitles();
}
function drawAscendedFigure(p, now, castK, atkK, maxed){
  const female = p.gender === 'nu';
  const sk = TIEN_SKINS[p.tienSkin] || TIEN_SKINS.bach;
  const flip = Math.cos(p.face) < 0 ? -1 : 1;
  const hover = 7 + Math.sin(now/450)*2.5 + (p.moving ? 3 : 0);
  const X = p.x, Y = p.y - hover;
  const sway = Math.sin(now/300), sway2 = Math.sin(now/350 + 1.3);
  ctx.save();
  // ── NGỰ KIẾM: phi kiếm dưới chân ──
  ctx.save(); ctx.translate(X, Y + 4); ctx.rotate(flip * (p.moving ? 0.10 : 0.03*sway));
  const sg = ctx.createRadialGradient(0, 0, 2, 0, 0, 28);
  sg.addColorStop(0, sk.halo); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35; ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, 1, 27, 7, 0, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = sk.metal; ctx.beginPath();
  ctx.moveTo(-24, 0); ctx.lineTo(14, -3.2); ctx.lineTo(27, 0); ctx.lineTo(14, 3.2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = sk.trim; ctx.fillRect(-27, -1.4, 4, 2.8); ctx.fillRect(-20, -4.5, 2.5, 9);
  ctx.restore();
  if (p.moving && !SETTINGS.lowFx && Math.random() < 0.45)
    addEffect({ type:'ink', x:X - Math.cos(p.face)*rnd(12,28), y:Y + rnd(2,7), vx:-Math.cos(p.face)*26, vy:rnd(-8,8), color:sk.halo });
  // ── hào quang thân ──
  const aura = ctx.createRadialGradient(X, Y-24, 4, X, Y-24, 44);
  aura.addColorStop(0, sk.halo); aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.16 + castK*0.25; ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(X, Y-24, 44, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  // ── quang hoàn sau đầu (xoay) ──
  ctx.save(); ctx.translate(X, Y-46); ctx.rotate(now/900);
  ctx.strokeStyle = sk.halo; ctx.globalAlpha = 0.75 + castK*0.25; ctx.lineWidth = 2.2; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.globalAlpha = 0.35; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, 16.5, 0, 7); ctx.stroke();
  ctx.restore();
  // ── hỗn thiên lăng: hai dải lụa phất sau lưng ──
  for (const side of [-1, 1]){
    ctx.strokeStyle = sk.ribbon; ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(X + side*5, Y - 36);
    ctx.bezierCurveTo(X - flip*(14 + side*3), Y - 44 + sway*3, X - flip*(26 + side*5), Y - 34 + sway2*5, X - flip*(38 + side*7), Y - 40 + sway*7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // ── thân: áo bào tiên ──
  const hem = female ? 13 : 10, hemY = Y - 1;
  ctx.fillStyle = sk.robe; ctx.beginPath();
  ctx.moveTo(X - 6, Y - 27);
  ctx.quadraticCurveTo(X - hem - sway*2, Y - 12, X - hem + sway*2, hemY);
  ctx.lineTo(X + hem + sway*2, hemY);
  ctx.quadraticCurveTo(X + hem + sway*2, Y - 12, X + 6, Y - 27);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.1; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
  if (!female){ ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(X, Y - 25); ctx.lineTo(X + sway*1.5, hemY - 1); ctx.stroke(); } // nam: xẻ tà
  ctx.fillStyle = sk.trim; ctx.fillRect(X - 7, Y - 28, 14, 3); // eo
  ctx.fillStyle = sk.robe; ctx.beginPath();
  ctx.moveTo(X - 6.5, Y - 25); ctx.lineTo(X - 7.5, Y - 39); ctx.lineTo(X + 7.5, Y - 39); ctx.lineTo(X + 6.5, Y - 25); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X - 4, Y - 39); ctx.lineTo(X, Y - 33); ctx.lineTo(X + 4, Y - 39); ctx.stroke(); // cổ áo V
  for (const side of [-1, 1]){ // tay áo rộng phất
    const wide = female ? 9 : 7;
    ctx.fillStyle = sk.robe; ctx.beginPath();
    ctx.moveTo(X + side*6, Y - 37);
    ctx.quadraticCurveTo(X + side*(8 + wide), Y - 30 + sway*side, X + side*(6 + wide), Y - 21 + sway2*2);
    ctx.quadraticCurveTo(X + side*8, Y - 24, X + side*5.5, Y - 28);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = sk.trim; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // ── đầu & tóc (phân nam/nữ) ──
  const hy = Y - 45;
  if (female){ // nữ: tóc dài phủ lưng bay mượt
    ctx.fillStyle = sk.hair; ctx.beginPath();
    ctx.moveTo(X - 5.5, hy - 2);
    ctx.quadraticCurveTo(X - 8, Y - 34 + sway, X - 4.5, Y - 30 + sway2*2);
    ctx.lineTo(X + 4.5, Y - 30 + sway*2);
    ctx.quadraticCurveTo(X + 8, Y - 34 + sway2, X + 5.5, hy - 2);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#f0d0b0'; ctx.beginPath(); ctx.arc(X, hy, 6.2, 0, 7); ctx.fill();
  ctx.fillStyle = sk.hair; ctx.beginPath(); ctx.arc(X, hy - 1.5, 6.2, Math.PI, 7); ctx.fill();
  if (female){ // búi đôi + trâm ngang
    ctx.fillStyle = sk.hair; ctx.beginPath(); ctx.arc(X - 3.5, hy - 7.5, 3, 0, 7); ctx.arc(X + 3.5, hy - 7.5, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X - 5, hy - 9); ctx.lineTo(X + 5, hy - 6); ctx.stroke();
  } else { // nam: búi + quan vàng
    ctx.fillStyle = sk.hair; ctx.beginPath(); ctx.arc(X, hy - 8, 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = sk.trim; ctx.fillRect(X - 3, hy - 12.5, 6, 3.2);
  }
  ctx.fillStyle = sk.halo; ctx.beginPath(); ctx.arc(X, hy - 2, 1.1, 0, 7); ctx.fill(); // hoa tinh giữa trán
  if (castK > 0) _vxGlyph(X, Y - 64, '仙', 22, sk.halo, castK); // xuất chiêu: ấn Tiên lóe sáng
  ctx.restore();
}

function drawPlayer(){
  const sect = SECTS[player.sect];
  const p = player;
  // ═══ LAYERING: đất → sau lưng → người → vũ khí → aura quỹ đạo → danh hiệu ═══
  const riding = false; // Thú Chiến không cưỡi — chiến thú là đồng đội riêng (drawMount)
  const now = performance.now();
  let yOff = 0;
  // Lăng Ba Vi Bộ jump arc
  let jumpK = 0;
  if (p.jumpT > 0){
    jumpK = Math.sin(Math.PI * (1 - p.jumpT / (p.jumpDur || 0.6)));
    yOff -= jumpK * 48;
  }
  if (p.moving && jumpK === 0) yOff -= Math.abs(Math.sin(now/95)) * 2.4; // nhịp bước chân khi chạy — người "sống" hơn
  // ── LỚP ĐẤT (không theo nhảy/cưỡi): bóng đổ ──
  const _shI = gameTimeInfo(), _shDx = (_shI.frac - 0.5) * 22, _shAl = 1 - skyDarkness()*0.35; // bóng xoay theo quỹ đạo mặt trời (Gói C)
  const _shRx = (riding?27:16)*(1-jumpK*0.45), _shRy = (riding?9:6)*(1-jumpK*0.45);
  ctx.fillStyle = 'rgba(0,0,0,' + (0.09*_shAl).toFixed(3) + ')'; ctx.beginPath();
  ctx.ellipse(p.x + _shDx, p.y+8, _shRx*1.5, _shRy*1.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,' + (0.20*_shAl).toFixed(3) + ')'; ctx.beginPath();
  ctx.ellipse(p.x + _shDx*0.45, p.y+8, _shRx, _shRy, 0, 0, 7); ctx.fill();
  // bụi gót chân khi chạy — tạo cảm giác chuyển động
  if (!SETTINGS.lowFx && p.moving && jumpK === 0 && !p.ascended && Math.random() < 0.08) // Phi Thăng: ngự kiếm không vấp bụi
    addEffect({ type:'ink', x:p.x - Math.cos(p.face)*10 + rnd(-4,4), y:p.y + 6 + rnd(-2,2), color:'rgba(150,135,105,.4)' });
  // Cương Khí hộ thể — vòng chân khí dưới chân, lớn theo tầng
  const gkT = GANGKHI_TIERS[(p.gangkhi && p.gangkhi.tier) || 0];
  if (gkT){
    const pulse = 0.16 + 0.08*Math.sin(performance.now()/280);
    ctx.save();
    ctx.strokeStyle = gkT.color; ctx.globalAlpha = pulse + p.gangkhi.tier*0.03;
    ctx.lineWidth = 2.5 + p.gangkhi.tier*0.4;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+5, 20 + p.gangkhi.tier*2.5, 8 + p.gangkhi.tier, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = pulse*0.6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+5, 26 + p.gangkhi.tier*3, 11 + p.gangkhi.tier*1.2, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // Liên Trảm đang mở — vòng vàng dao động dưới chân báo cửa sổ combo
  if ((p.ltT || 0) > 0){
    const lp = 0.3 + 0.15*Math.sin(now/120);
    ctx.save();
    ctx.strokeStyle = '#ffd76a'; ctx.globalAlpha = lp; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+5, 24, 10, 0, 0, 7); ctx.stroke();
    ctx.globalAlpha = lp*0.6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y+5, 30, 12.5, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // ── LỚP ĐẤT: ấn Thần Hiệp khi mọi hệ thống đã tối đa ──
  const maxed = isMaxed(p);
  if (maxed) drawThanHiepSeal(p, now);
  ctx.save(); ctx.translate(0, yOff);
  // Đan Điền aura — rotating orbs grow with realm
  drawDantianAura(p);
  // Tuyệt học max tầng: hào quang Ám Khí & Cung Tiễn
  drawMaxTuyetHocAura(p);
  // Cung Tiễn — linh cung lơ lửng sau lưng
  const bowT = BOW_TIERS[(p.bow && p.bow.tier) || 0];
  if (bowT){
    const backAng = p.face + Math.PI;
    const bx = p.x + Math.cos(backAng)*16, by = p.y - 22 + Math.sin(backAng)*7;
    const bob = Math.sin(performance.now()/350) * 2;
    ctx.save();
    ctx.strokeStyle = bowT.color; ctx.globalAlpha = 0.85; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(bx, by + bob, 13, backAng - 1.15, backAng + 1.15); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(backAng-1.15)*13, by + bob + Math.sin(backAng-1.15)*13);
    ctx.lineTo(bx + Math.cos(backAng+1.15)*13, by + bob + Math.sin(backAng+1.15)*13);
    ctx.stroke();
    // mũi tên nạp sẵn
    ctx.globalAlpha = 0.75; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(bx, by + bob);
    ctx.lineTo(bx + Math.cos(backAng)*15, by + bob + Math.sin(backAng)*15); ctx.stroke();
    ctx.restore();
  }
  // Thần Binh môn phái — lơ lửng theo người
  drawThanBinh(p);
  // Áo Choàng (Luyện Bảo Các) — tấm phi phong phất sau lưng, vẽ trước cánh & sprite
  const cloakIt = p.equip && p.equip.aochoang;
  if (cloakIt && cloakIt.cloakTier){
    const cd2 = CLOAK_TIERS[cloakIt.cloakTier];
    const sway = Math.sin(performance.now()/320) * 4;
    const backAng = p.face + Math.PI;
    const bx2 = Math.cos(backAng), by2 = Math.sin(backAng);
    ctx.save();
    ctx.fillStyle = cd2.color; ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y - 30);
    ctx.lineTo(p.x + 8, p.y - 30);
    ctx.quadraticCurveTo(p.x + bx2*20 + 12, p.y + by2*8 - 6 + sway, p.x + bx2*26 + sway, p.y + 10);
    ctx.quadraticCurveTo(p.x + bx2*14, p.y + 14 + sway*0.5, p.x - bx2*26 - sway, p.y + 10);
    ctx.quadraticCurveTo(p.x + bx2*20 - 12, p.y + by2*8 - 6 + sway, p.x - 8, p.y - 30);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = cd2.color; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.restore();
  }
  // Cánh (Thiên Thần / Tiểu Quỷ) — đôi cánh vỗ sau lưng, vẽ trước sprite
  const wingIt = p.equip && p.equip.canh;
  if (wingIt){
    const wd = WING_DEFS.find(w => w.id === wingIt.wing) || WING_DEFS[0];
    const lift = Math.sin(performance.now()/280) * 0.22 * 10; // vỗ cánh
    ctx.save();
    ctx.fillStyle = wd.color;
    for (const side of [-1, 1]){
      ctx.globalAlpha = 0.88; // thùy cánh chính — vươn rộng ra ngoài thân nhân vật
      ctx.beginPath();
      ctx.moveTo(p.x + side*6, p.y - 24);
      ctx.quadraticCurveTo(p.x + side*26, p.y - 44 - lift, p.x + side*46, p.y - 32 - lift);
      ctx.quadraticCurveTo(p.x + side*34, p.y - 16, p.x + side*8, p.y - 15);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.6; // thùy cánh phụ
      ctx.beginPath();
      ctx.moveTo(p.x + side*6, p.y - 18);
      ctx.quadraticCurveTo(p.x + side*22, p.y - 26 - lift*0.6, p.x + side*38, p.y - 16 - lift*0.6);
      ctx.quadraticCurveTo(p.x + side*26, p.y - 8, p.x + side*6, p.y - 10);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // character sprite (sect portrait art, đã cắt nền) — walk bob · idle breathing · cast pulse · attack lunge
  const img = SECT_IMGS[p.sect];
  const wph = p.walkPh || 0;
  const bob = p.moving ? Math.abs(Math.sin(wph))*4.2 : Math.sin(wph)*1.5;
  const rock = p.moving ? Math.sin(wph)*0.07 : 0;
  const castK = (p.castT || 0) / 0.38;
  const atkK = (p.atkAnim || 0) / 0.22; // lunge về phía chém
  const pulse = 1 + castK*0.12 + (p.moving ? Math.sin(wph*2)*0.025 : Math.sin(wph)*0.015);
  if (p.ascended){
    const _tKey = (p.gender === 'nu' ? 'nu' : 'nam') + '_' + (TIEN_SKINS[p.tienSkin] ? p.tienSkin : 'bach');
    const _tim = TIEN_IMGS[_tKey];
    if (_tim && _tim.complete && _tim.naturalWidth){
      const _tsk = TIEN_SKINS[p.tienSkin] || TIEN_SKINS.bach;
      const sh = 128, sw = sh * (_tim.naturalWidth/_tim.naturalHeight);
      const hover = Math.sin(now/520)*3.4; // ngự kiếm: lơ lửng trên phi kiếm
      ctx.save(); ctx.translate(p.x + Math.cos(p.face)*atkK*5, p.y + 6 - hover);
      ctx.scale(pulse, pulse);
      // hào quang tán tiên sau lưng (màu theo skin)
      const hg = ctx.createRadialGradient(0, -sh*0.52, 8, 0, -sh*0.52, 72);
      hg.addColorStop(0, _tsk.halo); hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.32 + 0.12*Math.sin(now/300); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, -sh*0.52, 72, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      // tuyệt chiêu: kim quang bùng khi thi triển
      if (castK > 0){
        const cg = ctx.createRadialGradient(0, -sh*0.4, 4, 0, -sh*0.4, 56);
        cg.addColorStop(0, _tsk.halo); cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = castK*0.5; ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(0, -sh*0.4, 56, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = _tsk.halo; ctx.shadowBlur = 14;
      }
      ctx.drawImage(_tim, -sw/2, -sh, sw, sh);
      ctx.restore();
    } else {
      drawAscendedFigure(p, now, castK, atkK, maxed); // fallback VFX khi sprite chưa tải xong
    }
  } else if (img && img.complete && img.naturalWidth){
    const sh = 104, sw = sh * (img.naturalWidth/img.naturalHeight);
    const flip = Math.cos(p.face) < 0;
    ctx.save(); ctx.translate(p.x + Math.cos(p.face)*atkK*7, p.y - 26 - bob + Math.sin(p.face)*atkK*3);
    if (flip) ctx.scale(-1, 1);
    ctx.rotate(rock + atkK*0.12); ctx.scale(pulse, pulse);
    // Thần Hiệp: hào quang vàng rực sau lưng + viền kim quang quanh thân
    if (maxed){
      const hg = ctx.createRadialGradient(0, -8, 6, 0, -8, 64);
      hg.addColorStop(0, 'rgba(255,228,150,.55)'); hg.addColorStop(0.55, 'rgba(232,200,74,.16)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.85 + 0.15*Math.sin(now/300); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, -8, 64, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 15;
    }
    // tuyệt chiêu: hào quang phái lóe sau lưng
    if (castK > 0){
      const cg = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
      cg.addColorStop(0, sect.glow); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = castK*0.55; ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(img, -sw/2, -sh/2, sw, sh);
    ctx.restore();
  } else {
    // fallback ink figure
    ctx.fillStyle = '#2b2620';
    ctx.beginPath(); ctx.ellipse(p.x, p.y-8, 11, 15, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = sect.color; ctx.lineWidth = 4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(p.x-9, p.y-6); ctx.lineTo(p.x+9, p.y-9); ctx.stroke();
    ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(p.x, p.y-27, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#1a1712'; ctx.beginPath(); ctx.arc(p.x, p.y-32, 4, 0, 7); ctx.fill();
  }
  // Vũ khí danh phái cầm tay — vung theo nhịp đánh
  drawSectWeapon(p, sect);
  // weapon arc while attacking
  if (p.atkAnim > 0){
    const k = p.atkAnim/0.22;
    ctx.strokeStyle = sect.glow; ctx.globalAlpha = k; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y-18, 26, p.face-1.1+(1-k)*1.6, p.face-0.2+(1-k)*1.6); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Khai Quang: vũ khí +9 rực sáng, +11 lôi quang cuốn quanh
  const wpn = p.equip && p.equip.vukhi;
  if (wpn && wpn.plus >= 9){
    const gx = p.x + Math.cos(p.face)*14, gy = p.y - 16 + Math.sin(p.face)*8;
    const g2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, 16);
    g2.addColorStop(0, wpn.plus >= 11 ? 'rgba(232,200,74,.85)' : 'rgba(240,214,138,.55)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(gx, gy, 16, 0, 7); ctx.fill();
    if (wpn.plus >= 11 && Math.random() < 0.3){
      ctx.strokeStyle = '#fff8d0'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(gx, gy);
      let lx = gx, ly = gy;
      for (let i=0;i<3;i++){ lx += rnd(-11,11); ly += rnd(-11,11); ctx.lineTo(lx, ly); }
      ctx.stroke();
    }
  }
  // Pet đồng hành — linh quang bay lượn phía sau lưng
  const petIt = p.equip && p.equip.pet;
  if (petIt){
    const pd = PET_DEFS.find(d => d.id === petIt.pet) || PET_DEFS[0];
    const side = Math.cos(p.face) >= 0 ? -1 : 1;
    const px = p.x + side*40, py = p.y - 34 + Math.sin(performance.now()/350)*4;
    const pg = ctx.createRadialGradient(px, py, 0, px, py, 11);
    pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.4, pd.color); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px, py, 11, 0, 7); ctx.fill();
    ctx.fillStyle = pd.color;
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
  }
  ctx.restore();
  // ── Danh hiệu trên đỉnh đầu (chọn trong bảng Nhân Vật → tab Thông Tin) ──
  drawOverheadTitle(p, yOff, riding, maxed);
}
// Đan Điền aura: rotating orbs + rings around the character, scaling with realm
function drawDantianAura(p){
  const realm = (p.dantian && p.dantian.realm) || 0;
  if (realm <= 0) return;
  const now = performance.now();
  const orbs = Math.min(2 + Math.floor(realm/2), 6); // 2 → 6 châu, không che người
  const radius = 26 + realm * 4;
  const colors = ['#5ea0e8','#6fb8f0','#8fd0ff','#c8e0ff','#f0d68a','#ffd76a'];
  const col = colors[Math.min(realm, 5)];
  const speed = now / (700 - realm * 60);
  // soft glow behind character
  const g = ctx.createRadialGradient(p.x, p.y-16, 4, p.x, p.y-16, radius + 12);
  g.addColorStop(0, realm >= 5 ? 'rgba(240,214,138,.13)' : 'rgba(94,160,232,.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(p.x, p.y-16, radius+12, 0, 7); ctx.fill();
  // rotating dashed ring (realm 3+)
  if (realm >= 3){
    ctx.save();
    ctx.strokeStyle = col; ctx.globalAlpha = 0.3 + realm*0.04;
    ctx.setLineDash([7, 11]); ctx.lineDashOffset = -now/40;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y-14, radius, radius*0.40, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // second counter-rotating ring at Hóa Thần
  if (realm >= 5){
    ctx.save();
    ctx.strokeStyle = '#ffd76a'; ctx.globalAlpha = 0.42;
    ctx.setLineDash([4, 8]); ctx.lineDashOffset = now/30;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y-14, radius+9, (radius+9)*0.44, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  // orbiting true-qi orbs — nhỏ gọn, sáng ở lõi
  for (let i = 0; i < orbs; i++){
    const ang = speed + i * (Math.PI*2/orbs);
    const ox = p.x + Math.cos(ang) * radius;
    const oy = p.y - 14 + Math.sin(ang) * radius * 0.40;
    const os = 1.7 + realm * 0.42;
    const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, os*2.1);
    og.addColorStop(0, 'rgba(255,255,255,.95)'); og.addColorStop(0.4, col); og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(ox, oy, os*2.1, 0, 7); ctx.fill();
  }
}
function drawMountains(){
  ctx.save();
  ctx.fillStyle = 'rgba(60,54,44,.28)';
  ctx.beginPath(); ctx.moveTo(0,0);
  for (let x=0;x<=W;x+=W/8) ctx.lineTo(x, 34 + Math.sin(x*0.01+2)*18 + (x%160===0?14:0));
  ctx.lineTo(W,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(60,54,44,.16)';
  ctx.beginPath(); ctx.moveTo(0,0);
  for (let x=0;x<=W;x+=W/6) ctx.lineTo(x, 52 + Math.cos(x*0.013)*20);
  ctx.lineTo(W,0); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawTitleBackdrop(){
  ctx.fillStyle = '#ece2c8'; ctx.fillRect(0,0,W,H);
  drawMountains();
  for (const mi of mists){
    const g = ctx.createRadialGradient(mi.x, mi.y, 0, mi.x, mi.y, mi.r);
    g.addColorStop(0, `rgba(236,226,200,${mi.a*2})`); g.addColorStop(1, 'rgba(236,226,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mi.x, mi.y, mi.r, 0, 7); ctx.fill();
    mi.x += mi.v*0.016; if (mi.x - mi.r > W) mi.x = -mi.r;
  }
}

// ---------- HUD ----------
const el = id => document.getElementById(id);
function updateHud(){
  el('hud-name').textContent = `${player.ascended ? '☁ Tán Tiên · xuất thế ' + SECTS[player.sect].name : SECTS[player.sect].name} — Cấp ${player.level}${player.level>=MAX_LV?' (Tối đa)':''}${player.maDao ? ' ⚫ MA ĐẠO' : ''}`;
  el('bar-hp').style.width = (100*player.hp/player.maxHp)+'%';
  el('txt-hp').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  el('bar-qi').style.width = (100*player.qi/player.maxQi)+'%';
  el('txt-qi').textContent = `Chân Khí ${Math.floor(player.qi)} / ${player.maxQi}`;
  if (player.level >= MAX_LV){ el('bar-xp').style.width='100%'; el('txt-xp').textContent='MAX'; }
  else { el('bar-xp').style.width = (100*player.xp/XP_TABLE[player.level-1])+'%';
         el('txt-xp').textContent = `${Math.floor(player.xp)} / ${XP_TABLE[player.level-1]} EXP`; }
  el('hud-silver').textContent = `◈ ${player.silver}`;
  el('hud-mat').textContent = `✦ ${player.mat} Tinh Thạch`;
  // quest tracker — chính tuyến + tối đa 2 phụ tuyến
  { const _th = trackerHtml(); if (window._lastTrack !== _th){ window._lastTrack = _th; el('quest-tracker').innerHTML = _th; } } // GDD Đợt 2 B2: cache để nút bấm không bị render đè
  // hint
  el('hint-bar').textContent = 'WASD di chuyển · Space đánh · E nói chuyện · R hồ lô thuốc · Q nhiệm vụ · M bản đồ · C nhân vật · B túi · K kỹ năng · O cài đặt · U minimap' + (player.canJump ? ' · J nhảy' : '');
  // skill buttons
  setSkillBtn('sk-a', player.level>=2, player.cd.a, SECTS[player.sect].skillA.cd, SECTS[player.sect].skillA.name);
  setSkillBtn('sk-b', player.level>=4, player.cd.b, AMKHI.cd, 'Ám Khí');
  setSkillBtn('sk-c', player.level>=9, player.cd.c, TP_CD, SECTS[player.sect].tp.name);
  setSkillBtn('sk-jump', !!player.canJump, player.cd.jump, 0.01, 'Lăng Ba Vi Bộ — không cooldown');
}
function setSkillBtn(id, unlocked, cd, max, name){
  const b = el(id);
  b.classList.toggle('locked', !unlocked);
  b.title = unlocked ? name : `${name} — mở khóa sau`;
  const cdEl = b.querySelector('.sk-cd');
  cdEl.style.height = (cd>0 ? (100*cd/max) : 0) + '%';
}
function setSkillIcon(id, url){
  const b = el(id);
  b.style.backgroundImage = `url(${url})`;
  b.classList.add('has-img');
}
function applySkillIcons(){
  const art = SECT_ART[player.sect];
  setSkillIcon('sk-basic', 'assets/skills/basic.png');
  setSkillIcon('sk-a', art.iconA);
  setSkillIcon('sk-b', 'assets/skills/amkhi.png');
  setSkillIcon('sk-c', art.iconTP);
}

// ---------- Panels ----------
function togglePanel(which){
  const map = { char:'panel-char', inv:'panel-inv', forge:'panel-forge', mount:'panel-mount', dantian:'panel-dantian', tuyethoc:'panel-tuyethoc' };
  const id = map[which];
  const p = el(id);
  const wasHidden = p.classList.contains('hidden');
  closePanels();
  if (wasHidden){ renderPanel(which); p.classList.remove('hidden'); }
}
function renderPanel(which){
  if (which==='char') renderChar();
  else if (which==='inv') renderInv();
  else if (which==='mount') renderMount();
  else if (which==='dantian') renderDantian();
  else if (which==='tuyethoc') renderTuyetHoc();
  else renderForge();
}
el('btn-char').addEventListener('click', ()=>togglePanel('char'));
el('btn-inv').addEventListener('click', ()=>togglePanel('inv'));
el('btn-bag').addEventListener('click', ()=>togglePanel('bag'));
el('btn-skill').addEventListener('click', ()=>togglePanel('skill'));
el('btn-map').addEventListener('click', ()=>togglePanel('map'));
const btnSet = el('btn-settings');
if (btnSet) btnSet.addEventListener('click', ()=>togglePanel('settings'));
const btnQlog = el('btn-qlog');
if (btnQlog) btnQlog.addEventListener('click', ()=>togglePanel('qlog'));
const btnMini = el('btn-minimap');
if (btnMini) btnMini.addEventListener('click', ()=>{
  SETTINGS.minimap = !SETTINGS.minimap; saveSettings();
  AudioSys.sfx('ui', 0.5);
});
el('btn-pk').addEventListener('click', ()=>{
  if (mapDef().type === 'safe') return;
  player.pk = !player.pk;
  addFloat(player.x, player.y-40, player.pk ? 'PK: BẬT — có thể tấn công Du Hiệp!' : 'PK: Tắt', player.pk ? '#ff5a4a' : '#8a8a8a', 13);
  saveGame();
});
// AUTO FARM — treo máy: tự đánh quái gần nhất, tự tung kỹ năng, tự uống thuốc
window.toggleAuto = function(){
  if (!player) return;
  player.auto = !player.auto;
  if (player.auto){ player._autoAX = player.x; player._autoAY = player.y; } // neo tại chỗ bật — auto chỉ ôm 1-2 bãi quái quanh neo
  addFloat(player.x, player.y-56, player.auto ? '⚔ AUTO FARM: BẬT — ôm 1-2 bãi quái quanh điểm neo, tự tung chiêu, tự uống thuốc' : 'AUTO FARM: TẮT — về chế độ thủ công',
    player.auto ? '#6ae88a' : '#b8a888', 13);
  AudioSys.sfx('ui', 0.5);
  updateAutoBtn();
  saveGame();
};
function updateAutoBtn(){
  const b = el('btn-auto');
  if (!b || !player) return;
  b.classList.toggle('auto-on', !!player.auto);
  b.classList.toggle('auto-off', !player.auto);
  b.textContent = player.auto ? '⚔ AUTO: BẬT' : '⚔ AUTO';
}
el('btn-auto').addEventListener('click', ()=>toggleAuto());

function renderChar(){
  const p = player, sect = SECTS[p.sect];
  let html = `<h3>Nhân Vật — ${sect.name} Cấp ${p.level}</h3>`;
  html += `<img class="char-portrait" src="${p.ascended ? 'assets/tien/' + (p.gender === 'nu' ? 'nu' : 'nam') + '_' + (TIEN_SKINS[p.tienSkin] ? p.tienSkin : 'bach') + '.png' : SECT_ART[p.sect].portrait}" alt="${sect.name}">${p.ascended ? `<div style="margin-top:4px;font-size:11.5px;color:#fff2b0">☁ Tán Tiên — xuất thế khỏi ${sect.name}, môn phái đã phá bỏ</div>` : ""}`;
  // Tán Nhân: lối vào lễ Bái Sư Nhập Phái (cấp 10)
  if (p.sect === 'vophai'){
    html += `<div style="margin:8px 0;padding:10px;border:1px dashed rgba(240,214,138,.45);border-radius:6px;text-align:center">
      <div style="font-size:12px;color:#b8a878;margin-bottom:6px">Tán Nhân lang bạt — chưa bái nhập môn phái nào</div>
      ${p.level >= 10
        ? `<button class="mini-btn" style="font-size:14px;padding:9px 22px;border-color:#f0d68a;color:#f0d68a" onclick="openSectCeremony()">⚔ BÁI SƯ NHẬP PHÁI</button>`
        : `<div style="font-size:12px;opacity:.7">Bái sư mở khóa ở <b style="color:#f0d68a">cấp 10</b> (hiện cấp ${p.level})</div>`}
    </div>`;
  }
  // Quẻ Tiên Thiên: 3 trait + tính cách
  if (p.traits && p.traits.length){
    const pers = PERSONALITIES[p.personality] || PERSONALITIES.trung;
    html += `<div style="margin:6px 0 2px;font-size:12px;color:#f0d68a;letter-spacing:1px">☯ QUẺ TIÊN THIÊN · ${pers.glyph} ${pers.name}</div>`;
    for (const tid of p.traits){
      const tr = TRAITS.find(t => t.id === tid);
      if (!tr) continue;
      const tier = TRAIT_TIERS[tr.tier];
      html += `<div class="trait-row"><span class="t-glyph">${tr.glyph}</span>
        <span class="t-name" style="color:${tier.color}">${tr.name} <small style="opacity:.6">[${tier.name}]</small></span>
        <span class="t-desc">${tr.desc}</span></div>`;
    }
  }
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:8px">Điểm tiềm năng còn: <b style="color:#f0d68a">${p.free}</b> (mỗi cấp +5)</div>`;
  const base = { str:p.str, agi:p.agi, def:p.def, vit:p.vit };
  const drv = { str:p.dStr, agi:p.dAgi, def:p.dDef, vit:p.dVit };
  for (const k of ['str','agi','def','vit']){
    const a = ATTR_INFO[k];
    html += `<div class="attr-row"><span>${a.name} <span style="opacity:.6;font-size:11px">(${a.desc})</span></span>
      <span><b>${drv[k]}</b>${drv[k]!==base[k]?` <span style="color:#5ea0e8;font-size:11px">(${base[k]}+${drv[k]-base[k]})</span>`:''}
      <button class="plus-btn" onclick="addAttr('${k}')" ${p.free<=0?'disabled':''}>+</button></span></div>`;
  }
  html += `<div class="stat-sec">THUỘC TÍNH CHIẾN ĐẤU</div>`;
  const stats = [
    ['Công Kích', p.atk], ['Sinh Lực', `${Math.ceil(p.hp)} / ${p.maxHp}`],
    ['Giảm Thương', Math.round(p.defRed*100)+'%'],
    ['Bạo Kích', Math.round(p.crit*100)+'%'], ['Né Tránh', Math.round(p.eva*100)+'%'],
    ['Tốc Đánh', p.aspd.toFixed(2)+'s'], ['Hồi Chân Khí', p.qireg.toFixed(1)+'/s'],
  ];
  for (const [n,v] of stats) html += `<div class="stat-row"><span>${n}</span><b>${v}</b></div>`;
  // Thần Binh môn phái — trục progression riêng, không chiếm slot Vũ Khí (GDD §5)
  const tbD = THANBINH[p.sect] || THANBINH.vophai;
  const tbTier = (p.thanbinh && p.thanbinh.tier) || 1;
  const tbMax = tbTier >= TB_MAX_TIER;
  const tbC = tbMax ? null : tbCost(tbTier);
  html += `<div class="stat-sec">⚔ THẦN BINH — ${tbD.name}</div>`;
  html += `<div style="margin:2px 0 6px;padding:8px 10px;border:1px solid ${tbD.color}55;border-radius:6px;background:rgba(0,0,0,.22)">
    <div style="font-size:13px;color:${TB_TIER_COLORS[tbTier-1]};font-weight:700">${tbD.name} · Tầng ${tbTier}【${TB_TIER_NAMES[tbTier-1]}】${tbMax ? ' — ĐÃ THỨC TỈNH ✦' : ''}</div>
    <div style="font-size:11px;color:#9a8a6a;font-style:italic;margin:2px 0">${tbD.lore}</div>
    <div class="stat-row"><span>ST chiêu môn phái</span><b>+${Math.round(tbTier*2.5)}%</b></div>
    <div class="stat-row"><span>Cộng thêm</span><b>+${tbTier*3} Lực · +${tbTier*2} Mẫn · +${tbTier*2} Cốt · +${tbTier*3} Thể</b></div>
    ${tbMax
      ? `<div style="font-size:11.5px;color:#ffe9a8;margin-top:4px">Hình thái cuối — thần binh rực rỡ tối đa ✦</div>`
      : `<button class="mini-btn" style="margin-top:6px;border-color:${tbD.color};color:${tbD.color}" onclick="upgradeThanBinh()">Luyện lên tầng ${tbTier+1}【${TB_TIER_NAMES[tbTier]}】</button>
         <div style="font-size:11px;color:#8a7a58;margin-top:3px">Cần: ${tbC.noidan} Nội Đan (có ${tbNoidanTotal()}) + ${tbC.mat} Tinh Thạch (có ${p.mat})</div>`}
  </div>`;
  html += `<div class="stat-sec">CHIÊU THỨC</div>`;
  html += `<div class="stat-row"><span>1 — ${sect.skillA.name}</span><b>${p.level>=2?'×'+sect.skillA.mult:'Cấp 2'}</b></div>`;
  const akT = AMKHI_TIERS[p.amkhiX && p.amkhiX.tier || 0];
  html += `<div class="stat-row"><span>2 — Ám Khí${akT?` · <span style="color:${akT.color}">${akT.name}</span>`:''}</span><b>${p.level>=4?'×'+AMKHI.mult:'Cấp 4'}</b></div>`;
  html += `<div class="stat-row"><span>3 — Trấn Phái: ${sect.tp.name}</span><b>${p.level>=9?'×'+sect.tp.mult:'Cấp 9'}</b></div>`;
  if (p.bikip && p.bikip.hmtp)
    html += `<div class="stat-row"><span style="color:#e84a6a">☠ Huyết Ma Thôn Phệ (bí kíp)</span><b>hút 10% ST</b></div>`;
  // Danh hiệu — chỉ số cộng dồn vĩnh viễn, chọn 1 hiển thị trên đầu
  html += `<div class="stat-sec">DANH HIỆU — bấm để chọn danh hiệu hiển thị trên đỉnh đầu</div>`;
  html += `<div style="font-size:11px;color:#b8a878;margin-bottom:6px">Mở khóa = cộng dồn chỉ số vĩnh viễn (không cần trang bị). Bấm lần nữa vào danh hiệu đang hiển thị để ẩn.</div>`;
  for (const t of TITLES){
    const un = p.titles.unlocked.includes(t.id);
    const eq = p.titles.equipped === t.id;
    html += `<div class="slot-row title-row${eq?' equipped':''}" style="${un?'cursor:pointer;':'opacity:.45;'}${eq?'border-color:'+t.color+';background:rgba(201,162,39,.10);':''}" ${un?`onclick="equipTitle('${t.id}')"`:''}>
      <span class="s-name"><b style="color:${un?t.color:'#8a8a8a'}">${un?'【'+t.name+'】':t.name}</b>
      <span style="opacity:.6;font-size:11px"> — ${un ? titleStatText(t.stats) : '🔒 '+t.desc}</span></span>
      ${eq?`<span style="color:${t.color};font-size:11px">✔ ĐANG HIỂN THỊ</span>`:`<span style="opacity:.4;font-size:11px">${un?'chọn':''}</span>`}</div>`;
  }
  CE().innerHTML = html;
}
function titleStatText(st){
  const parts = [];
  if (st.hp) parts.push(`+${st.hp} HP`);
  if (st.atkPct) parts.push(`+${Math.round(st.atkPct*100)}% Công`);
  if (st.crit) parts.push(`+${st.crit}% Bạo`);
  if (st.allPct) parts.push(`+${Math.round(st.allPct*100)}% Toàn TT`);
  if (st.forgeRate) parts.push(`+${st.forgeRate}% tỉ lệ rèn`);
  return parts.join(' · ');
}
window.equipTitle = function(id){
  if (!player.titles.unlocked.includes(id)) return;
  player.titles.equipped = (player.titles.equipped === id) ? null : id;
  saveGame(); renderChar();
};
window.addAttr = function(k){
  if (player.free <= 0) return;
  player.free--; player[k]++;
  calcDerived();
  renderChar(); saveGame();
};

function itemLineHtml(it){
  const r = RARITIES[it.rarity];
  const m = 1 + it.plus*0.08;
  let s = `<span class="${r.cls}">[${it.special ? it.name : r.name + (it.plus>0?' +'+it.plus:'')}]</span> `;
  if (it.special){
    for (const sub of it.subs) s += `${sub.name} +${Math.round(sub.v*10)/10}% · `;
    s = s.slice(0, -3);
    if (it.cloakTier) s += ` <span style="color:${CLOAK_TIERS[it.cloakTier].color}">(Cấp ${it.cloakTier}${it.cloakTier===2?' · yêu cầu LV60':''})</span>`;
    return s;
  }
  s += `<span style="opacity:.55;font-size:11px">【${giaiName(it.tier)} · C${it.tier}】${player && player.level < itemReqLv(it) ? ` · <span style="color:#ff7a6a">yêu cầu LV${itemReqLv(it)}</span>` : ''}</span> `;
  if (it.perfect) s += `<span style="color:#ffd76a">✦Hoàn Hảo✦</span> `;
  if (it.ancient && ANCIENT_SETS[it.ancient]){
    const set = ANCIENT_SETS[it.ancient];
    const act = player && player.setActive && player.setActive[it.ancient];
    s += `<span style="color:${set.color}">◈Cổ Thần ${set.name}${act ? ` (${act.n}/5)` : ''}</span> `;
  }
  if (it.luck) s += `<span style="color:#7fd8e0">☘Vận</span> `;
  if (it.life) s += `<span style="color:#e84a6a">❤Sinh Mệnh +${it.life*4}% HP</span> `;
  s += `${it.main.name} +${Math.round(it.main.v*m*10)/10}`;
  s += ` · ${it.element}`;
  for (const sub of it.subs) s += ` · ${sub.name} +${Math.round(sub.v*(sub.k==='perfect'?1:m)*10)/10}%`;
  if (it.plus>=10) s += ` · <span style="color:#f39c3d">☆ ${it.awakened.name}</span>`;
  else s += ` · <span style="opacity:.4">☆(+10)</span>`;
  return s;
}
function renderInv(){
  let html = `<h3>Hành Trang — 12 Ô Trang Bị</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div class="stat-sec">ĐANG MẶC (bấm để tháo)</div>`;
  for (const sl of SLOTS){
    const it = player.equip[sl.id];
    html += `<div class="slot-row" onclick="unequip('${sl.id}')">
      <span class="s-name"><b>${sl.name}</b><br>${it?itemLineHtml(it):'<span style="opacity:.35">— trống —</span>'}</span></div>`;
  }
  html += `<div class="stat-sec">TÚI ĐỒ (${player.inv.length}/30) — bấm để mặc, giữ phụ phẩm hoặc phân giải</div>`;
  if (!player.inv.length) html += `<div style="opacity:.5;font-size:12px;padding:6px">Chưa có vật phẩm — hãy đi farm quái!</div>`;
  player.inv.forEach((it,i)=>{
    html += `<div class="inv-item"><span class="s-name"><span class="${RARITIES[it.rarity].cls}">${it.name}</span>
      <span style="opacity:.6"> (${it.slotName} C${it.level})</span><br><span class="item-tip">${itemLineHtml(it)}</span></span>
      <span><button class="mini-btn" onclick="equipItem(${i})">Mặc</button><button class="mini-btn" onclick="salvage(${i})">Phân Giải</button></span></div>`;
  });
  el('panel-inv').innerHTML = html;
}
window.equipItem = function(i){
  const it = player.inv[i];
  if (!it) return;
  if (player.level < itemReqLv(it)){
    addFloat(player.x, player.y-30, `Cần LV${itemReqLv(it)} để mặc ${it.name}!`, '#ff7a6a', 13);
    return;
  }
  player.inv.splice(i,1);
  if (player.equip[it.slot]) player.inv.push(player.equip[it.slot]);
  player.equip[it.slot] = it;
  calcDerived(); renderInv(); saveGame();
};
window.unequip = function(slotId){
  const it = player.equip[slotId];
  if (!it || player.inv.length>=30) return;
  player.equip[slotId] = null; player.inv.push(it);
  calcDerived(); renderInv(); saveGame();
};
window.salvage = function(i){
  const it = player.inv[i];
  if (!it) return;
  const gain = 1 + it.rarity + Math.floor(it.plus/3);
  player.mat += gain;
  player.inv.splice(i,1);
  addFloat(player.x, player.y-30, `Phân giải +${gain}✦`, '#9fd0ff', 12);
  renderInv(); saveGame();
};

let forgeSel = null;
window.forgeUseCharm = false;
// GDD 3 giai đoạn: +1~6 an toàn 100% (Huyền Thiết) · +7~9 Đập Ngọc Tu La, xịt tụt 1 cấp · +10/+11 CHỈ tại Lò Bát Quái
function forgeRule(target){
  if (target <= 6)  return { rate:100, mat: 1 + Math.floor((target-1)/3), tuLa:0, hon:0, fail:'none' };
  if (target <= 9)  return { rate:{7:75, 8:65, 9:50}[target], mat:1, tuLa:1, hon:0, fail:'drop1' };
  // GDD Phá Thiên Kiếp: +10 = 50%, +11 = 45%, thất bại → HỦY DIỆT trang bị (Phù bảo hộ)
  if (target === 10) return { rate:50, mat:2, tuLa:3, hon:1, fail:'break', bagua:true };
  return { rate:45, mat:3, tuLa:5, hon:2, fail:'break', bagua:true };
}
// ── Drop v2.0: TẤN PHẨM (leo phẩm Phàm→Chí Tôn) · KẾ THỪA (leo giai) · ĐỔI HỆ ──
// 2 bậc đầu 100% bằng vật liệu quái (tân thủ học vòng lặp); 2 bậc sau khóa bằng vật liệu boss
const TANPHAM_RULES = {
  0:{ tinh:10, manh:0,  tichMa:0, an:0, silver:500,   rate:100 },
  1:{ tinh:20, manh:10, tichMa:0, an:0, silver:2000,  rate:100 },
  2:{ tinh:0,  manh:20, tichMa:3, an:0, silver:8000,  rate:80  },
  3:{ tinh:0,  manh:30, tichMa:8, an:1, silver:20000, rate:60  },
};
function findItemByUid(uid){
  for (const s in player.equip){ const it = player.equip[s]; if (it && it.uid === uid) return it; }
  for (let i = 0; i < player.inv.length; i++) if (player.inv[i].uid === uid) return player.inv[i];
  return null;
}
window.doTanPham = function(uid){
  const it = findItemByUid(uid);
  if (!it || it.special || it.rarity >= 4) return;
  const r = TANPHAM_RULES[it.rarity];
  if (!r) return;
  if (player.mat < r.tinh || player.mats.manh < r.manh || player.mats.tichMa < r.tichMa || player.mats.anTranAi < r.an || player.silver < r.silver) return;
  if (Math.random()*100 < r.rate){
    player.mat -= r.tinh; player.mats.manh -= r.manh; player.mats.tichMa -= r.tichMa; player.mats.anTranAi -= r.an; player.silver -= r.silver;
    it.rarity++; rerollItemRarity(it);
    addFloat(player.x, player.y-52, `✦ TẤN PHẨM — ${RARITIES[it.rarity].name}!`, RARITIES[it.rarity].color, 16);
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:RARITIES[it.rarity].color, big:true });
    AudioSys.sfx('levelup', 0.8);
  } else {
    // Xịt: giữ nguyên đồ & Ấn Trấn Ải — chỉ mất nửa vật liệu (không hardcore)
    player.mat -= Math.floor(r.tinh/2); player.mats.manh -= Math.floor(r.manh/2);
    player.mats.tichMa -= Math.floor(r.tichMa/2); player.silver -= Math.floor(r.silver/2);
    addFloat(player.x, player.y-52, 'Tấn phẩm thất bại — trang bị vẹn nguyên, mất nửa vật liệu', '#ff7a6a', 12);
    AudioSys.sfx('hurt', 0.5);
  }
  calcDerived(); saveGame(); renderForge();
};
// Kế Thừa: tăng 1 giai — giữ Phẩm/+N/dòng phụ, chỉ số gốc = 90% bản gốc giai mới
window.doKeThua = function(uid){
  const it = findItemByUid(uid);
  if (!it || it.special || it.tier >= 10) return;
  const cost = { manh:40, tichMa:4, silver:5000*it.tier };
  if (player.mats.manh < cost.manh || player.mats.tichMa < cost.tichMa || player.silver < cost.silver) return;
  player.mats.manh -= cost.manh; player.mats.tichMa -= cost.tichMa; player.silver -= cost.silver;
  it.tier++;
  it.level = (it.tier-1)*10 + 10;
  const slot = SLOTS.find(s => s.id === it.slot);
  if (slot && it.main) it.main.v = Math.max(1, Math.round(slot.base(it.tier, it.rarity) * 0.9));
  addFloat(player.x, player.y-52, `⚒ KẾ THỪA — lên giai【${giaiName(it.tier)}】!`, '#9fd0ff', 15);
  addEffect({ type:'ring', x:player.x, y:player.y, r:80, color:'#9fd0ff', big:true });
  AudioSys.sfx('levelup', 0.7);
  calcDerived(); saveGame(); renderForge();
};
// Đổi Hệ: 1 Hỗn Độn Châu — re-roll nguyên tố trang bị
window.doDoiHe = function(uid){
  const it = findItemByUid(uid);
  if (!it || it.special || !player.jewels || player.jewels.honDon < 1) return;
  player.jewels.honDon--;
  let el2 = it.element;
  while (el2 === it.element) el2 = ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)];
  it.element = el2;
  addFloat(player.x, player.y-52, `☯ ĐỔI HỆ — chuyển sang hệ ${el2}!`, NGU_HANH[el2].color, 14);
  calcDerived(); saveGame(); renderForge();
};
// Đổi 60 Mảnh Cổ Thần → 1 món Cổ Thần chọn bộ (pity Tứ Tượng — vá lỗi không pity)
window.doiCoThan = function(setId){
  if (!ANCIENT_SETS[setId] || player.mats.manhCoThan < 60) return;
  if (player.inv.length >= 30){ addFloat(player.x, player.y-40, 'Túi đồ đầy!', '#ff7a6a', 12); return; }
  player.mats.manhCoThan -= 60;
  const armorSlots = ['non','ao','tay','quan','chan'];
  const it = genAncient(setId, armorSlots[Math.floor(Math.random()*armorSlots.length)], player.level);
  player.inv.push(it);
  addFloat(player.x, player.y-52, `◈ CỔ THẦN ${ANCIENT_SETS[setId].name} hiện thế!`, ANCIENT_SETS[setId].color, 16);
  addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:ANCIENT_SETS[setId].color, big:true });
  AudioSys.sfx('quest', 0.9);
  saveGame(); renderForge();
};
function renderForge(){
  if (player.level < 4){ // P0: mở ở cấp 4 để NV5 "Rèn Luyện Sơ Nhập" không bị khóa
    CE().innerHTML = `<h3>Rèn Luyện</h3>
      <div style="padding:14px;font-size:13px">Lò rèn mở khóa ở <b style="color:#f0d68a">cấp 4</b>.<br>Hãy tiếp tục làm nhiệm vụ!</div>`;
    return;
  }
  const all = [];
  for (const s in player.equip) if (player.equip[s] && !player.equip[s].noForge) all.push({ it:player.equip[s], where:'equip', key:s });
  player.inv.forEach((it,i)=>{ if (!it.noForge) all.push({ it, where:'inv', key:i }); });
  let html = `<h3>Rèn Luyện — Tăng Cường Trang Bị</h3>`;
  html += `<div style="font-size:12px;color:#b8a878;line-height:1.7">◈ <b>${player.silver}</b> · ✦ Huyền Thiết <b style="color:#9fd0ff">${player.mat}</b> · ◆ Tu La <b style="color:#e84a6a">${player.gems.tuLa}</b> · ❖ Hỗn Nguyên <b style="color:#b08ae8">${player.gems.honNguyen}</b><br>
    ☂ Thiên Mệnh Phù <b style="color:#f0d68a">${player.charms}</b> <button class="mini-btn" onclick="buyCharm()" ${player.silver<500?'disabled':''}>Mua (500◈)</button>${player.forgeBonus?` · <span style="color:#5aa0e8">Thợ Rèn Truyền Thuyết: +${player.forgeBonus}% tỉ lệ</span>`:''}</div>`;
  if (!all.length){ html += `<div style="padding:12px;opacity:.6;font-size:12px">Chưa có trang bị nào.</div>`; }
  html += `<div class="stat-sec">CHỌN TRANG BỊ (tối đa +11 · +10 thức tỉnh)</div>`;
  all.forEach((e,i)=>{
    const sel = forgeSel && forgeSel.uid === e.it.uid;
    html += `<div class="slot-row" style="${sel?'border-color:#f0d68a;background:rgba(201,162,39,.12)':''}" onclick="forgeSelect(${i})">
      <span class="s-name"><span class="${RARITIES[e.it.rarity].cls}">${e.it.name}${e.it.plus?' +'+e.it.plus:''}</span>
      <span style="opacity:.55;font-size:11px"> (${e.where==='equip'?'đang mặc':'túi'})</span></span></div>`;
  });
  window._forgeList = all;
  const sel = forgeSel && all.find(e=>e.it.uid===forgeSel.uid);
  if (sel){
    const it = sel.it;
    html += `<div class="forge-lines"><b class="${RARITIES[it.rarity].cls}">${it.name} +${it.plus}</b>
      <span style="opacity:.6"> (Lực chiến ${itemPower(it)})</span><br>${itemLineHtml(it)}</div>`;
    if (it.plus >= 11){
      html += `<div id="forge-msg" style="color:#f39c3d">☀ Đã đạt Khai Quang tối thượng (+11) — danh hiệu Thợ Rèn Truyền Thuyết!</div>`;
    } else if (it.plus >= 9){
      // GDD: trang bị +9 trở lên không thể tự rèn — phải đến Lò Bát Quái
      html += `<div class="next-tier" style="border-color:#e8b04a"><b style="color:#e8b04a">☰ Phá Thiên Kiếp (+9 → +11)</b><br>
        <span style="font-size:12px;line-height:1.6">Trang bị từ +9 không thể tự rèn. Hãy mang đến <b>Lò Bát Quái</b> ở trung tâm <b>Tương Dương Thành</b>, nhờ <b>Tông Sư Thợ Rèn</b> vận công dung hợp.</span></div>
        <div class="forge-actions"><button class="mini-btn" onclick="closePanels(); travelTo('tuongduong')">Dịch Chuyển tới Tương Dương Thành</button></div>
        <div id="forge-msg"></div>`;
    } else {
      const target = it.plus + 1;
      const rule = forgeRule(target);
      const rate = Math.min(100, rule.rate + (player.forgeBonus||0));
      const costS = (20 + it.plus*15) * (it.tier || 1); // Drop v2.0: phí rèn theo giai
      const canPay = player.silver>=costS && player.mat>=rule.mat && player.gems.tuLa>=rule.tuLa && player.gems.honNguyen>=rule.hon;
      const failTxt = rule.fail === 'drop1' ? 'thất bại: TỤT 1 CẤP (tẩu hỏa nhập ma)' : 'thất bại chỉ mất vật liệu';
      // Đập Ngọc (+6 → +9): hiển thị rõ ngọc Tu La cần đập vào
      if (rule.tuLa){
        const enough = player.gems.tuLa >= rule.tuLa;
        html += `<div class="gem-socket">
          <img src="assets/items/mat_tula.png" onerror="this.style.display='none'" alt="Tu La">
          <div><b style="color:#e84a6a">ĐẬP NGỌC — Tu La Tinh Thạch</b><br>
          <span style="font-size:11.5px;opacity:.8">+6 trở lên bắt buộc đập ngọc để đột phá giới hạn (75% → 50%). Thất bại chỉ tụt 1 cấp.</span><br>
          <span style="color:${enough?'#8fd18f':'#ff7a6a'};font-size:12px">Đang có: ${player.gems.tuLa} / cần ${rule.tuLa} viên</span></div></div>`;
      } else {
        html += `<div class="gem-socket">
          <img src="assets/items/mat_huyenthiet.png" onerror="this.style.display='none'" alt="Huyền Thiết">
          <div><b style="color:#9fd0ff">BÌNH CHỈ NHƯ THỦY (+1 đến +6)</b><br>
          <span style="font-size:11.5px;opacity:.8">Huyền Thiết Thạch cường hóa an toàn tuyệt đối — tỉ lệ 100%.</span><br>
          <span style="color:#8fd18f;font-size:12px">Đang có: ${player.mat} / cần ${rule.mat} ✦ · ${costS}◈</span></div></div>`;
      }
      if (rule.fail !== 'none'){
        html += `<label style="display:block;font-size:12px;margin:6px 0;color:#f0d68a;cursor:pointer">
          <input type="checkbox" ${forgeUseCharm?'checked':''} onchange="forgeUseCharm=this.checked" ${player.charms>0?'':'disabled'}>
          Dùng Thiên Mệnh Phù — xịt vẫn giữ nguyên cấp (còn ${player.charms})</label>`;
      }
      html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px"
        onclick="doEnhance()" ${canPay?'':'disabled'}>
        ${rule.tuLa ? '◆ Đập Ngọc +' + target : 'Tăng Cường +' + target} (${rate}%)<br><span style="font-size:11px">${costS}◈ + ${rule.mat}✦${rule.tuLa ? ` + ${rule.tuLa}◆ Tu La` : ''}</span></button></div>
        <div style="font-size:11px;opacity:.7;text-align:center">${failTxt}</div>
        <div id="forge-msg"></div>`;
    }
    // ── Tứ Châu khảm phúc (Track HT — GDD §13) ──
    const J = player.jewels || { chucPhuc:0, linhHon:0, sinhMenh:0, honDon:0 };
    html += `<div class="stat-sec">TỨ CHÂU — ◎ Chúc Phúc <b style="color:#7ec850">${J.chucPhuc}</b> · ◉ Linh Hồn <b style="color:#b08ae8">${J.linhHon}</b> · ❤ Sinh Mệnh <b style="color:#e84a6a">${J.sinhMenh}</b> · ● Hỗn Độn <b style="color:#f0d68a">${J.honDon}</b></div>`;
    const canCP = J.chucPhuc > 0 && !it.noForge && it.plus <= 5;
    const canLH = J.linhHon > 0 && !it.noForge && it.plus < 11;
    const isArmor = ARMOR_SLOTS.includes(it.slot);
    const smRate = Math.max(25, 75 - (it.life || 0) * 8);
    const canSM = J.sinhMenh > 0 && isArmor && (it.life || 0) < 7;
    html += `<div class="forge-actions" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
      <button class="mini-btn" ${canCP?'':'disabled'} onclick="useJewel('chucPhuc',${it.uid})" title="Lên +1 miễn phí, 100% thành công (áp dụng +0 đến +5)">◎ Chúc Phúc +1</button>
      <button class="mini-btn" ${canLH?'':'disabled'} onclick="useJewel('linhHon',${it.uid})" title="Lên +1 với 50% — thất bại tụt 1 cấp (áp dụng đến +10, kể cả Phá Thiên Kiếp)">◉ Linh Hồn +1 (50%)</button>
      <button class="mini-btn" ${canSM?'':'disabled'} onclick="useJewel('sinhMenh',${it.uid})" title="${isArmor?`+4% HP mỗi bậc (tối đa 7 bậc = +28%) — thất bại về 0. Tỉ lệ hiện tại: ${smRate}%`:'Chỉ khảm lên giáp trụ (Nón/Giáp/Tay/Quần/Giày)'}">❤ Sinh Mệnh ${(it.life||0)}/7</button></div>
      <div id="jewel-msg" style="min-height:16px;font-size:12px;text-align:center"></div>`;
    // ── Drop v2.0: Tấn Phẩm / Kế Thừa / Đổi Hệ ──
    if (!it.special){
      if (it.rarity < 4 && !it.ancient){
        const tp = TANPHAM_RULES[it.rarity];
        const costTxt = [tp.tinh?`${tp.tinh}✦`:'', tp.manh?`${tp.manh}❖Mảnh`:'', tp.tichMa?`${tp.tichMa}◆TịchMa`:'', tp.an?`${tp.an}☬Ấn`:'', `${tp.silver}◈`].filter(Boolean).join(' + ');
        const canTp = player.mat>=tp.tinh && player.mats.manh>=tp.manh && player.mats.tichMa>=tp.tichMa && player.mats.anTranAi>=tp.an && player.silver>=tp.silver;
        html += `<div class="stat-sec">TẤN PHẨM — ${RARITIES[it.rarity].name} → <b style="color:${RARITIES[it.rarity+1].color}">${RARITIES[it.rarity+1].name}</b> (mở ${RARITY_SUBS[it.rarity+1]} dòng phụ)</div>
          <div class="forge-actions"><button class="mini-btn" ${canTp?'':'disabled'} onclick="doTanPham(${it.uid})">✦ Tấn Phẩm (${tp.rate}%)<br><span style="font-size:11px">${costTxt}</span></button></div>
          <div style="font-size:11px;opacity:.7;text-align:center">${tp.rate<100?'thất bại: giữ đồ & Ấn, mất nửa vật liệu':'an toàn tuyệt đối 100%'}</div>`;
      }
      if (it.tier < 10){
        const canKt = player.mats.manh>=40 && player.mats.tichMa>=4 && player.silver>=5000*it.tier;
        html += `<div class="stat-sec">KẾ THỪA —【${giaiName(it.tier)}】→【${giaiName(it.tier+1)}】giữ Phẩm/+${it.plus}/dòng phụ (gốc −10%)</div>
          <div class="forge-actions"><button class="mini-btn" ${canKt?'':'disabled'} onclick="doKeThua(${it.uid})">⚒ Kế Thừa<br><span style="font-size:11px">40❖Mảnh + 4◆TịchMa + ${5000*it.tier}◈</span></button></div>`;
      }
      const canDh = player.jewels && player.jewels.honDon >= 1;
      html += `<div class="forge-actions"><button class="mini-btn" ${canDh?'':'disabled'} onclick="doDoiHe(${it.uid})" title="Re-roll nguyên tố trang bị (hiện: ${it.element})">☯ Đổi Hệ (1● Hỗn Độn)</button></div>`;
    }
  }
  // Luyện Bảo Các — Áo Choàng (2 cấp, chỉ luyện chế tại đây, không rơi từ quái)
  const cloak = player.equip.aochoang || player.inv.find(x => x.slot === 'aochoang');
  html += `<div class="stat-sec">LUYỆN BẢO CÁC — ÁO CHOÀNG</div>`;
  if (!cloak){
    const c = CLOAK_TIERS[1];
    const can = player.gems.tuLa >= c.cost.tuLa && player.gems.honNguyen >= c.cost.hon && player.silver >= c.cost.silver;
    html += `<div class="next-tier"><b style="color:${c.color}">${c.name} (Cấp 1)</b><br>
      Thêm Sát Thương +${c.atkPct}% · Xuyên Giáp +${c.pierce}%<br>
      <span style="opacity:.75">Phí: ${c.cost.tuLa}◆ Tu La + ${c.cost.hon}❖ Hỗn Nguyên + ${c.cost.silver}◈</span></div>
      <div class="forge-actions"><button class="mini-btn" onclick="craftCloak(1)" ${can?'':'disabled'}>Luyện Chế Áo Choàng</button></div>
      <div id="cloak-msg" style="text-align:center;font-size:12px"></div>`;
  } else if (cloak.cloakTier === 1){
    const c = CLOAK_TIERS[2];
    const can = player.level >= 60 && player.gems.tuLa >= c.cost.tuLa && player.gems.honNguyen >= c.cost.hon && player.silver >= c.cost.silver;
    html += `<div class="next-tier"><b style="color:${c.color}">${c.name} (Cấp 2 — yêu cầu LV60)</b><br>
      Thêm Sát Thương +${c.atkPct}% · Xuyên Giáp +${c.pierce}% · Phòng Ngự +${c.defPct}%<br>
      <span style="opacity:.75">Phí: ${c.cost.tuLa}◆ Tu La + ${c.cost.hon}❖ Hỗn Nguyên + ${c.cost.silver}◈${player.level<60?' · <span style=\"color:#ff7a6a\">chưa đạt LV60</span>':''}</span></div>
      <div class="forge-actions"><button class="mini-btn" onclick="craftCloak(2)" ${can?'':'disabled'}>Thăng Cấp Áo Choàng 2</button></div>
      <div id="cloak-msg" style="text-align:center;font-size:12px"></div>`;
  } else {
    html += `<div style="text-align:center;color:#f0d68a;font-size:13px;padding:6px">☀ ${CLOAK_TIERS[2].name} — áo choàng tối thượng của Luyện Bảo Các!</div>`;
  }
  // ── Drop v2.0: pity Cổ Thần — 60 Mảnh Cổ Thần đổi 1 món chọn bộ ──
  html += `<div class="stat-sec">TỨ TƯỢNG CỔ THẦN — đổi ◈ Mảnh Cổ Thần (đang có <b style="color:#f0d68a">${(player.mats&&player.mats.manhCoThan)||0}</b>/60)</div>`;
  html += `<div class="forge-actions" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">`;
  for (const sid in ANCIENT_SETS){
    const st = ANCIENT_SETS[sid];
    html += `<button class="mini-btn" style="border-color:${st.color};color:${st.color}" ${(player.mats&&player.mats.manhCoThan>=60)?'':'disabled'} onclick="doiCoThan('${sid}')">◈ ${st.name} (60)</button>`;
  }
  html += `</div><div style="font-size:11px;opacity:.7;text-align:center">Mảnh Cổ Thần rơi từ Trấn Ải (×2/lần hạ) — bảo đảm Cổ Thần sau ~30 lần Chinh Phạt.</div>`;
  CE().innerHTML = html;
}
window.craftCloak = function(t){
  const c = CLOAK_TIERS[t];
  if (!c) return;
  if (player.level < c.req) return;
  if (player.gems.tuLa < c.cost.tuLa || player.gems.honNguyen < c.cost.hon || player.silver < c.cost.silver) return;
  player.gems.tuLa -= c.cost.tuLa; player.gems.honNguyen -= c.cost.hon; player.silver -= c.cost.silver;
  const it = genCloak(t);
  if (t === 2){
    if (player.equip.aochoang) player.equip.aochoang = it;
    else { const i = player.inv.findIndex(x => x.slot === 'aochoang'); if (i >= 0) player.inv[i] = it; else player.inv.push(it); }
  } else player.inv.push(it);
  addFloat(player.x, player.y-46, `Luyện thành: ${c.name}!`, c.color, 16);
  addEffect({ type:'ring', x:player.x, y:player.y, r:100, color:c.color, big:true });
  calcDerived(); saveGame();
  setTimeout(renderForge, 800);
};
window.buyCharm = function(){
  if (player.silver < 500) return;
  player.silver -= 500; player.charms++;
  addFloat(player.x, player.y-34, '+1 ☂ Thiên Mệnh Phù', '#f0d68a', 12);
  saveGame(); renderForge();
};
window.forgeSelect = function(i){
  forgeSel = window._forgeList[i].it;
  renderForge();
};
window.doEnhance = function(){
  const all = window._forgeList;
  const sel = forgeSel && all.find(e=>e.it.uid===forgeSel.uid);
  if (!sel) return;
  const it = sel.it;
  if (it.plus >= 11) return;
  const target = it.plus + 1;
  const rule = forgeRule(target);
  if (rule.bagua){
    const msg0 = document.getElementById('forge-msg');
    if (msg0){ msg0.textContent = '✘ Trang bị +9 trở lên chỉ rèn được tại Lò Bát Quái — Tương Dương Thành!'; msg0.style.color = '#ff9a6a'; }
    addFloat(player.x, player.y-40, 'Phải đến Lò Bát Quái!', '#ff9a6a', 13);
    return;
  }
  const rate = Math.min(100, rule.rate + (player.forgeBonus||0));
  const costS = (20 + it.plus*15) * (it.tier || 1); // Drop v2.0: phí rèn theo giai
  if (player.silver < costS || player.mat < rule.mat || player.gems.tuLa < rule.tuLa || player.gems.honNguyen < rule.hon) return;
  const useCharm = forgeUseCharm && player.charms > 0 && rule.fail !== 'none';
  player.silver -= costS; player.mat -= rule.mat;
  player.gems.tuLa -= rule.tuLa; player.gems.honNguyen -= rule.hon;
  const msg = document.getElementById('forge-msg');
  if (Math.random()*100 < rate){
    it.plus++;
    AudioSys.sfx('forge_ok', 0.85);
    if (msg){ msg.textContent = `✔ Thành công! ${it.name} +${it.plus}`; msg.style.color = '#8fd18f'; }
    addFloat(player.x, player.y-40, `Rèn thành công +${it.plus}!`, '#8fd18f', 14);
    addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:'#8fd18f' });
    // quest 5 check
    const q = currentQuest();
    if (q && q.type==='enhance' && questState==='active' && it.plus >= q.need){
      questProg = q.need; questState='done';
      addFloat(player.x, player.y-60, `Nhiệm vụ hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13);
    }
    if (it.plus === 10) addFloat(player.x, player.y-56, `☆ Thức tỉnh: ${it.awakened.name}`, '#f39c3d', 13);
    if (it.plus === 11){
      player.forged11 = true;
      addFloat(player.x, player.y-72, '☀ KHAI QUANG +11 — Thợ Rèn Truyền Thuyết!', '#ffd76a', 16);
      addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:'#ffd76a', big:true });
    }
    dailyTrack('forge'); // Mục Tiêu Hôm Nay
    checkTitles();
  } else if (useCharm){
    player.charms--;
    if (msg){ msg.textContent = `☂ Thiên Mệnh Phù đã bảo hộ — trang bị giữ nguyên +${it.plus}`; msg.style.color = '#f0d68a'; }
    addFloat(player.x, player.y-40, 'Thiên Mệnh Phù bảo hộ!', '#f0d68a', 13);
  } else {
    AudioSys.sfx('forge_fail', 0.8);
    if (rule.fail === 'drop1'){
      it.plus = Math.max(6, it.plus - 1);
      if (msg){ msg.textContent = `✘ Thất bại — tụt xuống +${it.plus}`; msg.style.color = '#ff7a6a'; }
      addFloat(player.x, player.y-40, `Rèn xịt! Tụt còn +${it.plus}`, '#ff7a6a', 13);
    } else if (rule.fail === 'zero'){
      it.plus = 0;
      if (msg){ msg.textContent = `✘ Thất bại thảm khốc — trang bị về +0!`; msg.style.color = '#ff7a6a'; }
      addFloat(player.x, player.y-40, 'Rèn xịt! Về +0!', '#ff7a6a', 14);
    } else if (rule.fail === 'break'){
      if (sel.where === 'equip') player.equip[sel.key] = null;
      else player.inv.splice(sel.key, 1);
      forgeSel = null;
      addFloat(player.x, player.y-40, `${it.name} đã VỠ VỤN!`, '#ff3a3a', 16);
      addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:'#ff3a3a', big:true });
      calcDerived(); saveGame();
      setTimeout(renderForge, 900);
      return;
    } else {
      if (msg){ msg.textContent = `✘ Thất bại... vật liệu đã mất`; msg.style.color = '#ff7a6a'; }
      addFloat(player.x, player.y-40, 'Rèn thất bại!', '#ff7a6a', 13);
    }
  }
  calcDerived(); saveGame();
  setTimeout(renderForge, 900);
};

// ---------- Tuyệt Học: Ám Khí / Cung Tiễn / Cương Khí (7 tầng, Chúc Phúc bảo đảm) ----------
const TH_SYSTEMS = {
  amkhi:   { name:'Ám Khí',   glyph:'暗', tiers:AMKHI_TIERS,   minLv:4,
             desc:'Tăng cường chiêu Ám Khí (phím 2) — mỗi tầng thêm bạo kích và hiệu ứng: độc, làm chậm, mù lòa, vạn độc, kết liễu.' },
  bow:     { name:'Cung Tiễn', glyph:'弓', tiers:BOW_TIERS,    minLv:30,
             desc:'Linh cung lơ lửng sau lưng — đòn đánh thường (Space) có tỉ lệ bắn thêm linh tiễn xuyên giáp.' },
  gangkhi: { name:'Cương Khí', glyph:'罡', tiers:GANGKHI_TIERS, minLv:10,
             desc:'Chân khí hộ thể vận chuyển quanh người — tăng Sinh Lực và Phòng Ngự theo %.' },
};
const TH_RATES = [0, 95, 85, 75, 62, 50, 38, 26]; // tỉ lệ thành công theo tầng đích (cân bằng lại: tầng đầu dễ, tầng cuối khốc liệt)
// Phí tấn chức theo tầng đích (cân bằng v2.0 — gắn vòng farm boss: tầng 4+ cần Mảnh Trang Bị, tầng 6+ cần Tịch Ma Thạch)
const TH_COST = [ null,
  { dan:2,  silver:400,  manh:0,  tichMa:0 },
  { dan:4,  silver:900,  manh:0,  tichMa:0 },
  { dan:7,  silver:1600, manh:0,  tichMa:0 },
  { dan:10, silver:2600, manh:12, tichMa:0 },
  { dan:14, silver:4000, manh:24, tichMa:0 },
  { dan:18, silver:5800, manh:40, tichMa:2 },
  { dan:24, silver:8000, manh:60, tichMa:4 },
];
function thIcon(sys, tier){ return `assets/skills/th_${sys}_${tier}.png`; }
// Hiệu ứng ăn mừng tấn chức — sprite bật to giữa màn hình
function showThCelebrate(sys, tier, t){
  const el = document.getElementById('th-celebrate');
  if (!el) return;
  const S = TH_SYSTEMS[sys];
  el.innerHTML = `<img src="${thIcon(sys, tier)}"><div class="thc-name" style="color:${t.color}">${t.name}</div><div class="thc-sub">${S.name} · Tầng ${tier}/7</div>`;
  el.classList.remove('hidden');
  el.classList.remove('thc-anim'); void el.offsetWidth; el.classList.add('thc-anim');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 1800);
  AudioSys.sfx('quest', 0.8);
}
function thState(sys){ return sys==='amkhi' ? player.amkhiX : sys==='bow' ? player.bow : player.gangkhi; }
window.thTab = 'amkhi';
function renderTuyetHoc(){
  const sys = window.thTab;
  const S = TH_SYSTEMS[sys];
  const st = thState(sys);
  let html = `<h3>Tuyệt Học — 7 Tầng Cảnh Giới</h3>`;
  html += `<div style="display:flex;gap:6px;margin-bottom:8px">`;
  for (const k in TH_SYSTEMS){
    const s2 = TH_SYSTEMS[k];
    const locked = player.level < s2.minLv;
    html += `<button class="mini-btn" style="flex:1;${k===sys?'border-color:#f0d68a;color:#f0d68a':''}${locked?';opacity:.45':''}"
      onclick="window.thTab='${k}';renderTuyetHoc()">${s2.glyph} ${s2.name}${locked?` (C${s2.minLv})`:''}</button>`;
  }
  html += `</div>`;
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:6px">◈ <b>${player.silver}</b> · ◈ Tiến Cấp Đan <b style="color:#7ec850">${player.tienDan}</b> (rơi từ Sơn Tặc trở lên — tinh anh & boss rớt nhiều hơn)</div>`;
  if (player.level < S.minLv){
    html += `<div style="padding:14px;font-size:13px">◆ ${S.name} mở khóa ở <b style="color:#f0d68a">cấp ${S.minLv}</b>.</div>`;
    CE().innerHTML = html; return;
  }
  html += `<div style="font-size:12px;opacity:.8;margin-bottom:8px">${S.desc}</div>`;
  html += `<div class="th-roster">${S.tiers.slice(1).map((t,i)=>`<img src="${thIcon(sys, i+1)}" title="Tầng ${i+1}: ${t.name}" class="${i<st.tier?'on':''}" style="${i<st.tier?`border-color:${t.color};box-shadow:0 0 8px ${t.color}55`:''}" onerror="this.style.visibility='hidden'">`).join('')}</div>`;
  if (st.tier > 0){
    const cur = S.tiers[st.tier];
    html += `<div class="mount-name" style="color:${cur.color}"><img src="${thIcon(sys, st.tier)}" class="th-cur-icon" style="filter:drop-shadow(0 0 12px ${cur.color})" onerror="this.style.display='none'"> ${S.glyph} ${cur.name} <span style="font-size:12px;opacity:.7">(Tầng ${st.tier}/7)</span></div>`;
    html += `<div class="bonus-list">${thStatLines(sys, cur).join('<br>')}</div>`;
  } else {
    html += `<div style="text-align:center;padding:6px;opacity:.65;font-size:13px">Chưa tu luyện — tấn chức tầng 1 để khai mở!</div>`;
  }
  if (st.tier < 7){
    const target = st.tier + 1;
    const nx = S.tiers[target];
    const cost = TH_COST[target];
    let rate = TH_RATES[target];
    const guaranteed = st.bless >= 10;
    if (guaranteed) rate = 100;
    const canPay = player.tienDan >= cost.dan && player.silver >= cost.silver &&
      player.mats.manh >= (cost.manh || 0) && player.mats.tichMa >= (cost.tichMa || 0);
    const costTxt = `${cost.dan}◈ Tiến Cấp Đan + ${cost.silver}◈` + (cost.manh ? ` + ${cost.manh}❖ Mảnh` : '') + (cost.tichMa ? ` + ${cost.tichMa}◆ Tịch Ma` : '');
    html += `<div class="next-tier"><img src="${thIcon(sys, target)}" class="th-next-icon" onerror="this.style.display='none'"><b style="color:${nx.color}">Tầng ${target}: ${nx.name}</b><br>
      ${thStatLines(sys, nx).join(' · ')}<br>
      <span style="opacity:.75">Phí: ${costTxt} · Tỉ lệ: <b>${rate}%</b>${guaranteed?' <span style="color:#f0d68a">(Chúc Phúc bảo đảm!)</span>':''}<br>
      (thất bại: mất vật liệu, Chúc Phúc +1 — đủ 10 điểm lần sau chắc chắn thành công)</span></div>
      <div class="tuvi-bar"><div class="fill" style="width:${st.bless*10}%;background:#f0d68a"></div><span>Chúc Phúc ${st.bless}/10</span></div>
      <div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px" onclick="upgradeTH('${sys}')" ${canPay?'':'disabled'}>
      Tấn Chức Tầng ${target}</button></div><div id="th-msg"></div>`;
  } else {
    html += `<div style="text-align:center;color:#f0d68a;margin-top:10px;font-size:13px">☯ ${S.name} đã đạt tầng tối thượng — ${S.tiers[7].name}!</div>`;
  }
  CE().innerHTML = html;
}
function thStatLines(sys, t){
  if (sys === 'amkhi') return [`Bạo Kích +${t.crit}%`, t.eff];
  if (sys === 'bow'){
    const parts = [`Bạo Kích +${t.crit}%`, `Xuyên Giáp +${Math.round(t.pierce*100)}%`, `Linh tiễn: ${t.proc}% gây ${Math.round(t.pdmg*100)}% ST`];
    if (t.double) parts.push(`${Math.round(t.double*100)}% bắn 2 mũi`);
    if (t.stun) parts.push(`${Math.round(t.stun*100)}% chặn đứng 1.5s`);
    if (t.burn) parts.push('Thiêu đốt 3s');
    return parts;
  }
  return [`Sinh Lực +${Math.round(t.hp*100)}%`, `Phòng Ngự +${Math.round(t.def*100)}%`, `Kháng hiệu ứng ám khí của địch`];
}
window.upgradeTH = function(sys){
  const S = TH_SYSTEMS[sys];
  const st = thState(sys);
  if (player.level < S.minLv || st.tier >= 7) return;
  const target = st.tier + 1;
  const cost = TH_COST[target];
  if (player.tienDan < cost.dan || player.silver < cost.silver ||
      player.mats.manh < (cost.manh || 0) || player.mats.tichMa < (cost.tichMa || 0)) return;
  player.tienDan -= cost.dan; player.silver -= cost.silver;
  player.mats.manh -= (cost.manh || 0); player.mats.tichMa -= (cost.tichMa || 0);
  let rate = TH_RATES[target];
  if (st.bless >= 10) rate = 100;
  const msg = document.getElementById('th-msg');
  if (Math.random()*100 < rate){
    st.tier++; st.bless = 0;
    const t = S.tiers[st.tier];
    if (msg){ msg.textContent = `✔ Tấn chức thành công — ${t.name}!`; msg.style.color = '#8fd18f'; }
    addFloat(player.x, player.y-46, `${S.name}: ${t.name}!`, t.color, 16);
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:t.color, big:true });
    showThCelebrate(sys, st.tier, t);
    dailyTrack('forge'); // Mục Tiêu Hôm Nay
  } else {
    st.bless = Math.min(10, st.bless + 1);
    if (msg){ msg.textContent = `✘ Tấn chức thất bại — Chúc Phúc +1 (${st.bless}/10)`; msg.style.color = '#ff7a6a'; }
    addFloat(player.x, player.y-46, `Tấn chức xịt — Chúc Phúc ${st.bless}/10`, '#ff7a6a', 13);
  }
  calcDerived(); saveGame();
  setTimeout(()=>{ try{ renderTuyetHoc(); }catch(e){ console.error(e); } }, 800);
};

// ---------- Test mode: max-level character ----------
function genSpecific(slotId, r, level){
  const slot = SLOTS.find(s => s.id === slotId);
  if (slot.special){
    if (slotId === 'aochoang') return genCloak(1);
    if (slotId === 'pet') return genPet(2);
    return genWing(0);
  }
  const tier = itemTier(level);
  const armorGroup = ARMOR_SLOTS.includes(slotId);
  const pool = (armorGroup ? ARMOR_SUBS : WEAPON_SUBS).slice();
  const subs = [];
  for (let i = 0; i < Math.min(4, pool.length); i++){
    const idx = Math.floor(Math.random()*pool.length);
    const def = pool.splice(idx,1)[0];
    subs.push({ k:def.k, name:def.name, v: def.max, pct:true }); // đồ test: chỉ số tối đa
  }
  return {
    uid: itemSeq++, slot: slot.id, slotName: slot.name,
    name: (armorGroup ? 'Hoàn Hảo ' : '') + ITEM_NAMES[slot.id][r],
    rarity: r, level, tier, perfect: armorGroup,
    main: { k: slot.main, v: slot.base(tier, r), name: mainName(slot.main) },
    element: ELEMENTS[Math.floor(Math.random()*ELEMENTS.length)],
    subs, plus: 0,
    awakened: AWAKENED[Math.floor(Math.random()*AWAKENED.length)],
  };
}
function applyTestBoost(){
  // ===== CHẾ ĐỘ THỬ NGHIỆM: MỌI TÍNH NĂNG TỐI ĐA =====
  player.level = MAX_LV; player.xp = 0;            // cấp 100 — mở hết mọi hệ thống & map
  player.str = 50; player.agi = 50; player.def = 50; player.vit = 50;
  player.free = 500;                               // điểm tiềm năng dư để cộng thử
  player.silver = 999999; player.mat = 999;        // Huyền Thiết
  player.khi = 999999;                             // Chân Khí — xung mạch thử
  player.gems = { tuLa: 99, honNguyen: 99 };       // rèn +7 trở lên
  player.tienDan = 99;                             // tấn chức tuyệt học
  player.charms = 99;                              // bảo hiểm rèn +10/+11
  // Đan Điền: cảnh giới cao nhất (Hỗn Nguyên Cảnh)
  player.dantian.realm = DANTIAN_REALMS.length - 1;
  player.dantian.tuvi = 999999;
  // Kinh Mạch: 8 mạch × 20 đốt — toàn bộ đã thông
  for (const m of MERIDIANS) player.meridians[m.id] = 20;
  // Thú Chiến: giai cao nhất, xuất trận sẵn
  player.mount.tier = MOUNT_TIERS.length - 1;
  player.mount.out = true;
  // Tuyệt học: Ám Khí / Cung Tiễn / Cương Khí đều tầng tối đa
  player.amkhiX = { tier: AMKHI_TIERS.length - 1, bless: 0 };
  player.bow = { tier: BOW_TIERS.length - 1, bless: 0 };
  player.gangkhi = { tier: GANGKHI_TIERS.length - 1, bless: 0 };
  // Bí kíp Huyết Ma Thôn Phệ: đã hợp thành
  player.bikip = { pieces: [1,1,1], hmtp: true };
  player.forged11 = true;
  // Full set 12 ô Thần-grade cấp 10, rèn +11 hoàn hảo
  for (const sl of SLOTS){
    const it = genSpecific(sl.id, 3, MAX_LV);
    it.plus = 11; it.perfect = true;
    player.equip[sl.id] = it;
  }
  // Đồ đặc biệt tối thượng: Áo Choàng cấp 2, Cánh & Pet tốt nhất
  player.equip.aochoang = genCloak(2);
  player.equip.canh = genWing(WING_DEFS.length - 1);
  player.equip.pet = genPet(PET_DEFS.length - 1);
  // Danh hiệu: mở hết, trang bị danh hiệu cuối cùng
  player.titles.unlocked = TITLES.map(t => t.id);
  player.titles.equipped = TITLES[TITLES.length - 1].id;
  // Thanh kỹ năng: 5 ô chiêu thức mạnh nhất
  player.skillBar = ['a', 'tp', 'gangkhi', 'bow', 'tieuhon'];
  // FULL SKILL (bản test): học hết Võ Học Phổ + 30 Dung Hợp, mọi kỹ năng Lv 120
  for (const _vid in VOHOC_DEFS) player.vohoc[_vid] = true;
  for (const _fid in FUSION_DEFS) player.vohoc[_fid] = true;
  player.bikipVH = 999;
  player.skillLv = {};
  for (const _sid in SKILL_DEFS) player.skillLv[_sid] = 120;
  // Túi đồ: loot mẫu để xem hình
  player.inv = [];
  for (let i=0;i<6;i++) player.inv.push(genItem(MAX_LV, 1.5));
  player.pk = false; player.toiac = 0; player.gkBuffT = 0; player.poisonT = 0;
  calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
}

// ---------- Thú Chiến panel & upgrade ----------
function mountAttrLines(t){
  const parts = [`Công Kích ${t.dmg} ST/đòn`];
  if (t.str) parts.push(`Lực Lượng +${t.str}`);
  if (t.agi) parts.push(`Mẫn Tiệp +${t.agi}`);
  if (t.def) parts.push(`Phòng Ngự +${t.def}`);
  if (t.vit) parts.push(`Sinh Lực +${t.vit}`);
  if (t.hp) parts.push(`HP +${t.hp}`);
  if (t.crit) parts.push(`Bạo Kích +${t.crit}%`);
  if (t.qireg) parts.push(`Hồi Chân Khí +${t.qireg}`);
  return parts;
}
function renderMount(){
  if (player.level < 6){
    CE().innerHTML = `<h3>Thú Chiến</h3>
      <div style="padding:14px;font-size:13px">Chuồng thú mở khóa ở <b style="color:#f0d68a">cấp 6</b>.</div>`;
    return;
  }
  const tier = player.mount.tier;
  const cur = MOUNT_TIERS[tier];
  const next = tier < MOUNT_TIERS.length - 1 ? MOUNT_TIERS[tier+1] : null;
  let html = `<h3>Thú Chiến — Thăng Giai</h3>`;
  html += `<div class="tier-pips">${MOUNT_TIERS.slice(1).map((t,i)=>`<span style="color:${i<tier?'#f0d68a':'rgba(232,217,176,.25)'}">●</span>`).join('')}</div>`;
  if (cur){
    html += `<img class="mount-img" src="${cur.img}" alt="${cur.name}">
      <div class="mount-name" style="color:${cur.color}">${cur.name} <span style="font-size:12px;opacity:.7">(Giai ${tier}/8)</span></div>
      <div class="bonus-list"><b>Thuộc tính gia trì:</b><br>${mountAttrLines(cur).join(' · ')}</div>
      <div style="font-size:12px;color:#b8a878;margin-top:6px">Chiến thú đi theo và <b style="color:#f0d68a">tự tấn công</b> quái quanh ngươi, mỗi 1.4s một đòn.</div>
      <div class="forge-actions"><button class="mini-btn" onclick="toggleMountOut()">${player.mount.out?'Thu Hồi (V)':'Xuất Chiến (V)'}</button></div>`;
  } else {
    html += `<div style="text-align:center;padding:8px;opacity:.65;font-size:13px">Ngươi chưa có chiến thú.<br>Thăng giai lần đầu để nhận <b style="color:#f0d68a">Bạch Mã</b> đồng hành!</div>`;
  }
  if (next){
    const _th = window.stableThau || { n:0, mode:'rate' };
    const _useN = Math.min(_th.n || 0, player.maThau || 0, 3);
    const _matNeed = Math.max(0, next.cost.mat - (_th.mode === 'mat' ? _useN*4 : 0));
    const _rate = Math.min(95, next.rate + (player.mountPity || 0) + (_th.mode === 'rate' ? _useN*7 : 0));
    const canPay = player.silver >= next.cost.silver && player.mat >= _matNeed && player.level >= (next.reqLv || 1);
    html += `<div class="next-tier"><b style="color:${next.color}">Giai ${tier+1}: ${next.name}</b><br>
      ${mountAttrLines(next).join(' · ')}<br>
      <span style="opacity:.75">Phí: ${next.cost.silver}◈ + ${_matNeed}✦${_matNeed < next.cost.mat ? ` <span style="color:#7fd8e0">(Mã Thầu −${next.cost.mat - _matNeed}✦)</span>` : ''} · Tỉ lệ: <b>${_rate}%</b>${(player.mountPity || 0) ? ` <span style="color:#7fd8e0">(+${player.mountPity}% tích lũy)</span>` : ''} · Yêu cầu: <b style="color:${player.level >= (next.reqLv || 1) ? '#8fd18f' : '#ff7a6a'}">cấp ${next.reqLv || 1}</b> (thất bại giữ nguyên giai, +8% tích lũy)</span></div>`;
    if ((player.maThau || 0) > 0){
      html += `<div style="font-size:12px;color:#b8a878;margin-top:6px">🪢 Mã Thầu: <b style="color:#7fd8e0">${player.maThau}</b> — dùng
        ${[0,1,2,3].map(n2 => `<button class="mini-btn" style="${(_th.n || 0) === n2 ? 'border-color:#7fd8e0;color:#7fd8e0' : ''}" onclick="stableThauSet(${n2})">${n2}</button>`).join('')}
        <button class="mini-btn" style="${_th.mode === 'rate' ? 'border-color:#7fd8e0;color:#7fd8e0' : ''}" onclick="stableThauMode('rate')">+7% tỉ lệ/thầu</button>
        <button class="mini-btn" style="${_th.mode === 'mat' ? 'border-color:#7fd8e0;color:#7fd8e0' : ''}" onclick="stableThauMode('mat')">−4✦ phí/thầu</button></div>`;
    }
    html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px" onclick="upgradeMount()" ${canPay?'':'disabled'}>
      Thăng Giai ${tier===0?'(Nhận Bạch Mã)':'→ '+next.name}</button></div><div id="mount-msg"></div>`;

  } else {
    html += `<div style="text-align:center;color:#f0d68a;margin-top:10px;font-size:13px">☯ Đã đạt Thanh Long — đỉnh cao chiến thú thiên hạ!</div>`;
  }
  CE().innerHTML = html;
}
window.stableThauSet = function(n){ window.stableThau = window.stableThau || { n:0, mode:'rate' }; window.stableThau.n = n; renderMount(); };
window.stableThauMode = function(m){ window.stableThau = window.stableThau || { n:0, mode:'rate' }; window.stableThau.mode = m; renderMount(); };
window.upgradeMount = function(){
  const tier = player.mount.tier;
  const next = MOUNT_TIERS[tier+1];
  if (!next || !next.cost) return;
  const msg = document.getElementById('mount-msg');
  if (player.level < (next.reqLv || 1)){ // GDD Đợt 2 B4: khóa cấp theo giai
    if (msg){ msg.textContent = `🔒 Cần đạt cấp ${next.reqLv} để thăng ${next.name}`; msg.style.color = '#ff7a6a'; }
    addFloat(player.x, player.y-46, `Cần cấp ${next.reqLv} mới thăng được!`, '#ff7a6a', 13);
    return;
  }
  const th = window.stableThau || { n:0, mode:'rate' }; // B5: Mã Thầu hỗ trợ
  const useN = Math.min(th.n || 0, player.maThau || 0, 3);
  const matNeed = Math.max(0, next.cost.mat - (th.mode === 'mat' ? useN*4 : 0));
  if (player.silver < next.cost.silver || player.mat < matNeed) return;
  player.silver -= next.cost.silver; player.mat -= matNeed;
  if (useN > 0) player.maThau -= useN;
  const rate = Math.min(95, next.rate + (player.mountPity || 0) + (th.mode === 'rate' ? useN*7 : 0)); // B4: pity +8%/lần trượt
  window.stableThau = { n:0, mode:'rate' };
  if (Math.random()*100 < rate){
    player.mount.tier++; player.mountPity = 0;
    if (msg){ msg.textContent = `✔ Thăng giai thành công — ${next.name}!`; msg.style.color = '#8fd18f'; }
    addFloat(player.x, player.y-46, `Thú Chiến: ${next.name}!`, next.color, 16);
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:next.color, big:true });
    player.mount.out = true;
    checkTitles();
  } else {
    player.mountPity = (player.mountPity || 0) + 8;
    const _nx2 = MOUNT_TIERS[player.mount.tier+1];
    const _nr = _nx2 ? Math.min(95, _nx2.rate + player.mountPity) : 0;
    if (msg){ msg.textContent = `✘ Thăng giai thất bại — +8% tích lũy (lần sau tối thiểu ${_nr}%)`; msg.style.color = '#ff7a6a'; }
    addFloat(player.x, player.y-46, 'Thất bại! +8% tỉ lệ tích lũy', '#ff7a6a', 13);
  }
  calcDerived(); saveGame();
  setTimeout(()=>{ try{ renderMount(); }catch(e){ console.error(e); } }, 800);
};
window.toggleMountOut = function(){
  if (!player || player.mount.tier === 0){
    if (player) addFloat(player.x, player.y-34, 'Chưa có chiến thú — mở C → Thú Chiến', '#8a8a8a', 12);
    return;
  }
  player.mount.out = !player.mount.out;
  mountObj = null; // triệu hồi lại ở vị trí mới
  addFloat(player.x, player.y-40, player.mount.out ? '⚔ Chiến thú xuất trận!' : 'Chiến thú thu hồi.', '#f0d68a', 13);
  AudioSys.sfx('ui', 0.5);
  refreshCharTab('mount');
};

// ---------- Đan Điền panel & đột phá ----------
window.dtTab = 'dantian';
function renderDantian(){
  if (player.level < 7){
    CE().innerHTML = `<h3>Đan Điền</h3>
      <div style="padding:14px;font-size:13px">Đan Điền mở khóa ở <b style="color:#f0d68a">cấp 7</b>.</div>`;
    return;
  }
  // tab Kinh Mạch
  if (window.dtTab === 'kinhmach'){ renderKinhMach(); return; }
  const realm = player.dantian.realm;
  const cur = DANTIAN_REALMS[realm];
  const next = DANTIAN_REALMS[realm+1];
  let html = `<h3>Đan Điền — Tu Luyện Nội Công</h3>`;
  html += `<div style="display:flex;gap:6px;margin-bottom:8px">
    <button class="mini-btn" style="flex:1;border-color:#f0d68a;color:#f0d68a">丹 Đan Điền</button>
    <button class="mini-btn" style="flex:1;${player.level<20?';opacity:.45':''}" onclick="window.dtTab='kinhmach';renderDantian()">脈 Kinh Mạch${player.level<20?' (C20)':''}</button></div>`;
  html += `<div class="realm-ring"><img src="assets/dantian/${REALM_ICONS[realm]}.png" alt="${cur.name}"
      style="width:64px;height:64px;filter:drop-shadow(0 0 10px rgba(94,160,232,.65))" onerror="this.outerHTML='<div style=&quot;font-size:34px;color:#5ea0e8&quot;>丹</div>'">
    <div class="realm-name">${cur.name} <span style="font-size:12px;opacity:.7">(Cảnh giới ${realm}/9)</span></div></div>`;
  if (realm > 0){
    html += `<div class="bonus-list"><b>Phúc lợi cảnh giới:</b><br>Công Kích +${Math.round(cur.atk*100)}% · HP +${Math.round(cur.hp*100)}% · Hồi Chân Khí +${cur.qireg}/s`;
    if (realm >= 7) html += `<br><b style="color:#9fd8ff">◆ Lăng Ba Vi Bộ</b> — mở khóa nhảy (phím J) · thân pháp +10%`;
    if (realm >= 8) html += `<br><b style="color:#f0d68a">◆ Bất Tử</b> — chặn 1 đòn chí mạng, hồi 30% HP (180s)`;
    if (realm >= 9) html += `<br><b style="color:#fff2b0">◆ Hóa Thần</b> — nhục thân thăng hoa, toàn thuộc tính vượt cực hạn`;
    html += `</div>`;
  }
  html += `<div style="font-size:12px;color:#b8a878;margin-top:6px">Tu Vi tích lũy: giết quái và tĩnh tọa tại Tịnh Tâm Tuyền.</div>`;
  if (next){
    const pct = Math.min(100, 100*player.dantian.tuvi/next.cost.tuvi);
    const canPay = player.dantian.tuvi >= next.cost.tuvi && player.silver >= next.cost.silver && player.mat >= next.cost.mat;
    html += `<div class="tuvi-bar"><div class="fill" style="width:${pct}%"></div><span>${Math.floor(player.dantian.tuvi)} / ${next.cost.tuvi} Tu Vi</span></div>
      <div class="next-tier"><img src="assets/dantian/${REALM_ICONS[realm+1]}.png" alt="" style="width:34px;height:34px;vertical-align:-10px;margin-right:6px" onerror="this.style.display='none'"><b style="color:#9fd0ff">Đột phá: ${next.name}</b><br>
      Công Kích +${Math.round(next.atk*100)}% · HP +${Math.round(next.hp*100)}% · Hồi Chân Khí +${next.qireg}/s
      ${next.unlock ? `<br><b style="color:#f0d68a">◆ Học được: ${next.unlock}${realm+1===7 ? ' (mở khóa nhảy — phím J)' : ''}</b>` : ''}<br>
      <span style="opacity:.75">Phí: ${next.cost.tuvi} Tu Vi + ${next.cost.silver}◈ + ${next.cost.mat}✦${next.trib
        ? `<br>⚡ <b style="color:#e8c84a">Lôi Kiếp ${next.trib} đợt thiên lôi</b> — né sấm! Trúng 3 tia là thất bại (Lôi Độn Phù -40% sát thương, Đan Đột Phá chịu thêm 1 tia).<br>(thất bại: mất bạc, vật liệu và 30% Tu Vi — giữ nguyên cảnh giới)`
        : ` · Tỉ lệ: <b>${next.rate}%</b><br>(thất bại: mất bạc, vật liệu và 50% Tu Vi — giữ nguyên cảnh giới)`}</span></div>
      <div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px" onclick="breakthrough()" ${canPay?'':'disabled'}>${next.trib ? '⚡ Độ Kiếp' : 'Đột Phá'}</button></div>
      <div id="dantian-msg"></div>`;
  } else {
    html += `<div class="tuvi-bar"><div class="fill" style="width:100%"></div><span>Tu Vi: ${Math.floor(player.dantian.tuvi)}</span></div>
      <div style="text-align:center;color:#f0d68a;margin-top:10px;font-size:13px">☯ Hóa Thần Cảnh — nội công đã đạt cảnh giới tối thượng!</div>`;
  }
  CE().innerHTML = html;
}
// ---------- Kinh Mạch: 8 mạch × 20 đốt, xung mạch tốn Chân Khí ----------
function renderKinhMach(){
  let html = `<h3>Kinh Mạch — Đả Thông Huyệt Đạo</h3>`;
  html += `<div style="display:flex;gap:6px;margin-bottom:8px">
    <button class="mini-btn" style="flex:1" onclick="window.dtTab='dantian';renderDantian()">丹 Đan Điền</button>
    <button class="mini-btn" style="flex:1;border-color:#f0d68a;color:#f0d68a">脈 Kinh Mạch</button></div>`;
  if (player.level < 20){
    html += `<div style="padding:14px;font-size:13px">Kinh Mạch mở khóa ở <b style="color:#f0d68a">cấp 20</b>.<br>Chân Khí tích lũy bằng chiến đấu và tĩnh tọa.</div>`;
    CE().innerHTML = html; return;
  }
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:6px">Chân Khí: <b style="color:#3a9d8b">${Math.floor(player.khi)}</b> <span style="opacity:.6">(+${Math.floor(3)}/s thụ động · ×3 tại Tịnh Tâm Tuyền · +10 mỗi quái tiêu diệt)</span></div>`;
  for (const md of MERIDIANS){
    const node = player.meridians[md.id] || 0;
    const pips = Array.from({length:20}, (_,i)=>`<span style="color:${i<node?md.color:'rgba(232,217,176,.22)'}">●</span>`).join('');
    let perTxt = '';
    if (md.stat==='hp') perTxt = `+${md.per} Sinh Lực/đốt`;
    else if (md.stat==='qi') perTxt = `+${md.per} Nội Lực/đốt`;
    else if (md.stat==='atk') perTxt = `+${md.per} Tấn Công/đốt`;
    else if (md.stat==='def') perTxt = `+${md.per} Phòng Thủ/đốt`;
    else if (md.stat==='eva') perTxt = `+${md.per}% Né/đốt`;
    else if (md.stat==='crit') perTxt = `+${md.per}% Bạo/đốt`;
    else if (md.stat==='aspd') perTxt = `+${md.per}% Tốc Đánh/đốt`;
    else perTxt = `toàn thuộc tính/đốt`;
    let btnHtml;
    if (node >= 20){
      btnHtml = `<span style="color:${md.color};font-size:11px">VIÊN MÃN</span>`;
    } else {
      let cost = 150 + node*80;
      if (player.dantian.realm >= 4) cost = Math.round(cost * 0.8); // Quy Nguyên giảm phí
      let rate = Math.max(35, 100 - node*3);
  if (player.traitMerRate) rate = Math.min(100, Math.round(rate * player.traitMerRate)); // Quẻ: Kỳ Mạch Đại Thông
      btnHtml = `<button class="mini-btn" onclick="openMeridianNode('${md.id}')" ${player.khi<cost?'disabled':''} style="font-size:11px">Xung (${cost} khí · ${rate}%)</button>`;
    }
    html += `<div class="slot-row" style="display:block">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b style="color:${md.color};font-size:12px"><img src="assets/dantian/${md.img}.png" alt="" style="width:26px;height:26px;vertical-align:-8px;margin-right:5px" onerror="this.style.display='none'">${md.name}</b>${btnHtml}</div>
      <div style="font-size:9px;letter-spacing:1px;margin:2px 0">${pips}</div>
      <div style="font-size:11px;opacity:.6">${md.label}: ${perTxt}</div></div>`;
  }
  html += `<div id="km-msg" style="text-align:center;font-size:12px;min-height:16px"></div>`;
  html += `<div style="font-size:11px;opacity:.6;margin-top:4px">Xung mạch thất bại chỉ mất Chân Khí, đốt đã thông không mất. Đan Điền cảnh 4 (Luyện Khí Tầng 4) trở lên giảm 20% phí xung mạch.</div>`;
  CE().innerHTML = html;
}
window.openMeridianNode = function(id){
  if (player.level < 20) return;
  const md = MERIDIANS.find(m=>m.id===id);
  const node = player.meridians[id] || 0;
  if (!md || node >= 20) return;
  let cost = 150 + node*80;
  if (player.dantian.realm >= 4) cost = Math.round(cost * 0.8); // Quy Nguyên: khí mạch tư thông
  if (player.khi < cost) return;
  player.khi -= cost;
  let rate = Math.max(35, 100 - node*3);
  if (player.traitMerRate) rate = Math.min(100, Math.round(rate * player.traitMerRate)); // Quẻ: Kỳ Mạch Đại Thông
  if (Math.random()*100 < rate){
    player.meridians[id] = node + 1;
    addFloat(player.x, player.y-40, `Đả thông ${md.name} — đốt ${node+1}/20!`, md.color, 13);
    addEffect({ type:'ring', x:player.x, y:player.y, r:44, color:md.color });
    dailyTrack('forge'); // Mục Tiêu Hôm Nay — xung mạch cũng tính tu luyện
  } else {
    addFloat(player.x, player.y-40, `Xung mạch thất bại! (${rate}%)`, '#ff7a6a', 12);
  }
  calcDerived(); saveGame(); renderDantian();
};
window.breakthrough = function(){
  const realm = player.dantian.realm;
  const next = DANTIAN_REALMS[realm+1];
  if (!next || !next.cost) return;
  if (player.dantian.tuvi < Math.floor(next.cost.tuvi * (player.doNgo ? 0.7 : 1)) || player.silver < next.cost.silver || player.mat < next.cost.mat) return;
  player.silver -= next.cost.silver; player.mat -= next.cost.mat;
  const msg = document.getElementById('dantian-msg');
  if (Math.random()*100 < next.rate){
    player.dantian.realm++;
    player.dantian.tuvi -= next.cost.tuvi;
    if (msg){ msg.textContent = `✔ Đột phá thành công — ${next.name}!` + (next.unlock ? ` Học được ${next.unlock}!` : ''); msg.style.color = '#8fd18f'; }
    addFloat(player.x, player.y-46, `ĐỘT PHÁ: ${next.name}!`, '#9fd0ff', 18);
    if (player.dantian.realm === 5){ // Thăng Linh — mở Té Núi & võ học giang hồ (GDD §5.4)
      zoneBanner = { text:'☁ THĂNG LINH — MỞ TÉ NÚI', sub:'3 vách cơ duyên: Vân Đài (Chung Nam) · Đoạn Trường Nhai (Tuyệt Tình) · Định Biên Nhai (Nhạn Môn) — võ học giang hồ đã có thể lĩnh ngộ!', color:'#e8c84a', t:6 };
    }
    if (next.unlock) addFloat(player.x, player.y-70, `Học được: ${next.unlock}!`, '#f0d68a', 15);
    addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#5ea0e8', big:true });
    for (let i=0;i<14;i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-90,90), vy:rnd(-120,-30), color:'#5ea0e8' });
    calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
  } else {
    player.dantian.tuvi = Math.floor(player.dantian.tuvi * 0.5);
    if (msg){ msg.textContent = `✘ Đột phá thất bại — tẩu hỏa, Tu Vi tổn hao một nửa!`; msg.style.color = '#ff7a6a'; }
    addFloat(player.x, player.y-46, 'Tẩu hỏa! Tu Vi tổn hao!', '#ff7a6a', 14);
  }
  calcDerived(); saveGame();
  setTimeout(()=>{ try{ renderDantian(); }catch(e){} }, 900);
};

// ---------- Sect select / boot ----------
function startGame(sectKey, quze){
  newPlayer(sectKey);
  player.name = (quze && quze.name) || genCharName(); // danh tính giang hồ (bước đặt tên)
  // Quẻ Tiên Thiên: từ màn roll (người chơi thật) hoặc roll ngầm (quick-start/test)
  if (quze && quze.traits){
    player.traits = quze.traits.slice(0, 3);
    player.personality = quze.pers || 'trung';
    player.quzeTitle = !!quze.title;
  } else {
    player.traits = rollTraitsSilent();
  }
  applySkillIcons();
  const maxMode = !RELEASE_BUILD && ((el('chk-max') && el('chk-max').checked) || (el('chk-max-quze') && el('chk-max-quze').checked) || (el('chk-max-intro') && el('chk-max-intro').checked) || /max=1/.test(location.search));
  if (maxMode){
    applyTestBoost();
    checkTitles();
    addFloat(player.x, player.y-50, 'CHẾ ĐỘ THỬ NGHIỆM — Cấp 100, MỌI TÍNH NĂNG TỐI ĐA!', '#f0d68a', 16);
    addFloat(player.x, player.y-72, 'Full +11 · Tuyệt học max · Đan Điền max · M bản đồ · K kỹ năng · 1-5 tung chiêu!', '#a0ffe9', 13);
  } else {
    addFloat(player.x, player.y-50, 'Tương Dương Thành — hãy bái kiến Quách Đại Hiệp (lại gần, nhấn E)!', '#f0d68a', 15);
  }
  el('intro-story').classList.add('hidden');
  el('sect-select').classList.add('hidden');
  el('hud').classList.remove('hidden');
  el('skillbar').classList.remove('hidden');
  if (maxMode) player.tutStep = -1; // chế độ thử nghiệm: bỏ qua hướng dẫn
  updateTut();
  snapCamera(); // vào game: camera đặt thẳng vào nhân vật, không pan từ góc (0,0)
  AudioSys.playBgm(BGM_TRACKS[curMap]); // chuyển từ nhạc intro sang nhạc map
  saveGame();
}
// Màn menu chỉ còn dành cho người cũ tiếp tục hành trình — chọn phái đã dời vào trong game (cấp 10)
function showMainMenu(){
  el('sect-cards').style.display = 'none';
  const mm = el('max-mode'); if (mm) mm.style.display = 'none';
  const sub = document.querySelector('#sect-select .ss-sub');
  if (sub) sub.textContent = 'Chào mừng trở lại giang hồ — hành trình của ngươi vẫn đang chờ.';
  el('sect-select').classList.remove('hidden');
  AudioSys.playBgm(BGM_INTRO); // nhạc Ái Đích Phế Khư vang lên ngay màn hình chính
}
const hasSave = !!localStorage.getItem('vlcm_save');
if (hasSave) showMainMenu(); // người cũ → thẳng màn Tiếp Tục
else setTimeout(showIntro, 0); // người mới → cốt truyện (defer: chờ module intro ở cuối file nạp xong)
{
  const btn = el('btn-continue');
  if (hasSave) btn.classList.remove('hidden');
  btn.addEventListener('click', ()=>{ // bind luôn: save cloud có thể đến sau khi menu đã hiện
    if (loadGame()){
      applySkillIcons();
      el('sect-select').classList.add('hidden');
      el('hud').classList.remove('hidden');
      el('skillbar').classList.remove('hidden');
      snapCamera(); // tiếp tục hành trình: camera đặt thẳng vào nhân vật
      AudioSys.playBgm(BGM_TRACKS[curMap]); // chuyển từ nhạc intro sang nhạc map
    }
  });
}
// 🎬 Video giới thiệu Bát Đại Môn Phái — mở từ menu chính & lễ bái sư
{
  const ov = el('sect-video-overlay'), vd = el('sect-video');
  const openV = ()=>{
    ov.classList.remove('hidden');
    if (AudioSys.bgm) AudioSys.bgm.pause();
    vd.currentTime = 0;
    vd.volume = Math.max(0.2, (SETTINGS.bgm/100));
    vd.play().catch(()=>{});
    AudioSys.sfx('ui', 0.6);
  };
  const closeV = ()=>{
    vd.pause();
    ov.classList.add('hidden');
    if (AudioSys.bgm && AudioSys.started) AudioSys.bgm.play().catch(()=>{});
  };
  const b1 = el('btn-sect-video'); if (b1) b1.addEventListener('click', openV);
  const b2 = el('btn-sect-video2'); if (b2) b2.addEventListener('click', openV);
  el('btn-sect-video-skip').addEventListener('click', closeV);
  vd.addEventListener('ended', closeV);
}
window.addEventListener('beforeunload', saveGame);

// quick-start via URL: ?sect=thieulam|toanchan|daohoa|comoc
// defer: chờ toàn bộ script nạp xong (TUT_STEPS, SIDE_QUESTS, intro... khai báo ở cuối file) tránh TDZ
// TEST_MODE (?test=1 hoặc ?max=1): playtest — dịch chuyển tự do mọi map/phó bản, bỏ qua điều kiện mở
window.TEST_MODE = !RELEASE_BUILD && /([?&])(test|max)=1/.test(location.search); // bản phát hành: luôn tắt
setTimeout(function(){
  const m = location.search.match(/sect=(\w+)/);
  if (m && SECTS[m[1]]){
    startGame(m[1]);
    // debug: &map=tuyettinh — xuất hiện thẳng ở map bất kỳ (kể cả phó bản)
    const mp = location.search.match(/map=(\w+)/);
    if (mp && MAPS[mp[1]] && window.TEST_MODE){
      curMap = mp[1]; DGN = null; buildWorld();
      const md0 = MAPS[mp[1]];
      if (md0.dungeon) startDungeonRun(mp[1]);
      const sp0 = md0.spawn || { x: MAP.w/2, y: MAP.h/2 };
      player.x = sp0.x; player.y = sp0.y;
      if (md0.type === 'safe') player.pk = false;
      snapCamera();
    }
    // debug params: &tier=8&realm=5&mount=1
    const tq = location.search.match(/tier=(\d)/);
    if (tq){ player.mount.tier = Math.min(8, +tq[1]); }
    const rq = location.search.match(/realm=(\d)/);
    if (rq){ player.dantian.realm = Math.min(8, +rq[1]); }
    if (/mount=1/.test(location.search)) player.mount.out = player.mount.tier > 0;
    if (tq || rq){ calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi; saveGame(); }
    const p = location.search.match(/panel=(\w+)/);
    if (p) setTimeout(()=>togglePanel(p[1]), 300);
  }
}, 0);

// ═══════════ PLAYTEST CHEAT CONSOLE — nhấn ` (dưới Esc) khi chạy ?test=1 ═══════════
window.toggleCheatConsole = function(){
  const c = document.getElementById('cheat-console');
  if (!c) return;
  const opening = c.classList.contains('hidden');
  c.classList.toggle('hidden');
  if (opening){ const inp = document.getElementById('cheat-input'); inp.value = ''; setTimeout(() => inp.focus(), 30); cheatLog('Console playtest — gõ /help để xem lệnh, Esc để đóng.', '#7fd4ff'); }
};
function cheatLog(t, color){
  const lg = document.getElementById('cheat-log');
  if (!lg) return;
  const d = document.createElement('div');
  d.textContent = t; if (color) d.style.color = color;
  lg.appendChild(d);
  while (lg.children.length > 9) lg.removeChild(lg.firstChild);
}
setInterval(() => { try { if (window.TEST_MODE && player && player._god){ player.hp = player.maxHp; player.qi = player.maxQi; } } catch(e){} }, 400);
const CHEAT_HELP = [
  '/max — mọi thứ tối đa (cấp 120, full đồ +11, full skill Lv 120)',
  '/lv <1-120> — đặt cấp',
  '/map <id> — dịch chuyển: ' + 'daohoa, tuongduong, ngoai, chungnam, comoc, tuyettinh, mongco, nhanmon',
  '/go <x> <y> — dịch chuyển tọa độ',
  '/silver /mat /dan /tuvi /khi /manh /tich /an /cothan <n> — tài nguyên (+n để cộng thêm)',
  '/item [phẩm 0-4] [giai 1-10] — tạo trang bị vào túi',
  '/god — bật/tắt bất tử',
  '/kill [bán kính=350] — hạ quái quanh mình',
  '/realm <0-9> — cảnh giới Đan Điền',
  '/th <amkhi|bow|gangkhi> <0-7> — tầng Tuyệt Học',
  '/tier <0-8> — tầng Thú Cưỡi',
  '/boss — mở phong ấn & tới Tế Đàn Trấn Ải của map',
  '/seal <0-7> — đặt tiến độ Ngũ Ấn (7 = Kết Mở)',
  '/speed <hệ số> — tốc chạy × hệ số',
  '/learn — học toàn bộ Võ Học Phổ',
  '/fullskill — học hết võ học + 30 dung hợp, mọi kỹ năng Lv 120',
  '/phi — Phi Thăng ngay: phá bỏ môn phái, ngự kiếm phi hành, skin tiên nhân',
    '/npc — Nhân Mạch test: triệu tán tu tới cạnh, hảo cảm 700 để thử Tán Gẫu/Tặng Quà/Tỷ Thí/Kết Bái/Tỏ Tình',
  '/bikip <n> — đặt số Bí Kíp',
  '/tenui — gỡ Trọng Thương (té núi lại ngay)',
  '/time [ngày=10] — nhảy thời gian thế giới (Lịch Tu Tiên)',
  '/wipe — xóa save & tải lại game',
];
window.cheatExec = function(raw){
  const parts = (raw || '').trim().split(/\s+/);
  if (!parts[0]) return;
  const cmd = parts[0].toLowerCase().replace(/^\//, '');
  const num = (i, d) => { const v = parseFloat(parts[i]); return isNaN(v) ? d : v; };
  try {
    switch (cmd){
      case 'help': CHEAT_HELP.forEach(l => cheatLog(l, '#cfe8ff')); return;
      case 'max': applyTestBoost(); cheatLog('MAX MODE — mọi tính năng tối đa!', '#f0d68a'); break;
      case 'lv': {
        const n = clamp(Math.round(num(1, 1)), 1, 120);
        player.level = n; player.xp = 0; calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
        cheatLog('Cấp → ' + n, '#8fd18f'); break;
      }
      case 'map': {
        const id = parts[1];
        if (!MAPS[id]){ cheatLog('Không có map "' + id + '". Xem /help', '#ff7a6a'); return; }
        curMap = id; DGN = null; buildWorld();
        const md = MAPS[id];
        if (md.dungeon) startDungeonRun(id);
        const sp = md.spawn || { x: MAP.w/2, y: MAP.h/2 };
        player.x = sp.x; player.y = sp.y; snapCamera();
        cheatLog('→ ' + md.name, '#8fd18f'); break;
      }
      case 'go': {
        player.x = clamp(num(1, player.x), 20, MAP.w - 20);
        player.y = clamp(num(2, player.y), 20, MAP.h - 20);
        snapCamera(); cheatLog('→ (' + Math.round(player.x) + ', ' + Math.round(player.y) + ')', '#8fd18f'); break;
      }
      case 'learn': {
        let _n = 0;
        for (const _vid in VOHOC_DEFS){ if (!vhLearned(_vid)){ player.vohoc[_vid] = true; _n++; } }
        calcDerived(); cheatLog('Đã học ' + _n + ' võ học — bấm K gán vào taskbar', '#e8c84a'); break;
      }
      case 'fullskill': {
        for (const _vid in VOHOC_DEFS) player.vohoc[_vid] = true;
        for (const _fid in FUSION_DEFS) player.vohoc[_fid] = true;
        player.skillLv = player.skillLv || {};
        for (const _sid in SKILL_DEFS) player.skillLv[_sid] = 120;
        player.bikipVH = Math.max(player.bikipVH || 0, 99);
        calcDerived(); cheatLog('FULL SKILL — 34 võ học + 30 dung hợp, mọi kỹ năng Lv 120 (bấm K gán)', '#ff9ae0'); break;
      }
      case 'bikip': {
        player.bikipVH = clamp(Math.round(num(1, 20)), 0, 999);
        cheatLog('Bí Kíp → ' + player.bikipVH, '#e8c84a'); break;
      }
      case 'tenui': {
        player.tenuiTT = 0;
        cheatLog('Đã gỡ Trọng Thương — có thể Té Núi ngay', '#8fd18f'); break;
      }
      case 'npc': // Nhân Mạch test: kéo tán tu tới cạnh + hảo cảm cao
        ensureTanNpcs();
        tanNpcs.forEach((n, i) => { n.x = player.x + 60 + i*40; n.y = player.y + 40; const r = ttRel(n); r.score = Math.max(r.score, 700); if (n.gender !== player.gender) r.love = Math.max(r.love, 80); });
        cheatLog(`🏮 ${tanNpcs.length} tán tu đã tề tựu — hảo cảm 700, tình cảm 80 (khác giới). Bấm E để giao tiếp, L xem Nhân Mạch.`);
        return;
      case 'phi': { // Phi Thăng ngay — test giai đoạn Thần Tiên Hóa Cảnh
        player.dantian.realm = DANTIAN_REALMS.length - 1;
        ascendToImmortal();
        cheatLog('☁ Phi Thăng — Thần Tiên Hóa Cảnh! Mở Cài Đặt (O) đổi Nam/Nữ & tiên y', '#fff2b0'); break;
      }
      case 'time': { // /time [ngày] — nhảy thời gian thế giới (mặc định +10 ngày)
        gameClock();
        player.gt.t += Math.max(0, num(1, 10)) * GT_DAY;
        const gti = gameTimeInfo(); calcDerived(); spawnAmbients();
        cheatLog(`Lịch Tu Tiên → ${gti.season.name} ${gti.day}/${gti.month} Năm ${gti.year} · Canh ${CANH_NAMES[gti.canh]}`, gti.season.color); break;
      }
      case 'silver': case 'mat': case 'tuvi': case 'khi': case 'manh': case 'tich': case 'an': case 'cothan': case 'dan': {
        const raw2 = parts[1] || '10000';
        const add = raw2.startsWith('+');
        const v = Math.abs(parseFloat(raw2)) || 0;
        const set = (get, put) => { const cur = get(); put(add ? cur + v : v); };
        if (cmd === 'silver') set(() => player.silver, x => player.silver = x);
        else if (cmd === 'mat') set(() => player.mat, x => player.mat = x);
        else if (cmd === 'dan') set(() => player.tienDan, x => player.tienDan = x);
        else if (cmd === 'tuvi') set(() => player.dantian.tuvi, x => player.dantian.tuvi = x);
        else if (cmd === 'khi') set(() => player.khi, x => player.khi = x);
        else if (cmd === 'manh') set(() => player.mats.manh, x => player.mats.manh = x);
        else if (cmd === 'tich') set(() => player.mats.tichMa, x => player.mats.tichMa = x);
        else if (cmd === 'an') set(() => player.mats.anTranAi, x => player.mats.anTranAi = x);
        else if (cmd === 'cothan') set(() => player.mats.manhCoThan, x => player.mats.manhCoThan = x);
        cheatLog('OK', '#8fd18f'); break;
      }
      case 'item': {
        const r = clamp(Math.round(num(1, 3)), 0, 4);
        const g = clamp(Math.round(num(2, 5)), 1, 10);
        const it = genItem(Math.min(100, (g-1)*10 + 10), 0, 'tranai');
        it.rarity = r; it.tier = g; it.level = (g-1)*10 + 10; it.perfect = false;
        rerollItemRarity(it);
        player.inv.push(it);
        cheatLog('+' + it.name + ' 【' + giaiName(g) + '】', RARITIES[r].color); break;
      }
      case 'god': player._god = !player._god; cheatLog(player._god ? 'BẤT TỬ: BẬT' : 'BẤT TỬ: TẮT', '#f0d68a'); break;
      case 'kill': {
        const r = num(1, 350);
        const list = mobs.filter(m => !m.dead && dist(player.x, player.y, m.x, m.y) <= r);
        list.forEach(m => { m.hp = 0; killMob(m, 'cheat'); });
        cheatLog('Đã hạ ' + list.length + ' mục tiêu trong ' + r + 'px.', '#8fd18f'); break;
      }
      case 'realm': {
        player.dantian.realm = clamp(Math.round(num(1, 0)), 0, DANTIAN_REALMS.length - 1);
        calcDerived(); player.hp = player.maxHp;
        cheatLog('Đan Điền → ' + DANTIAN_REALMS[player.dantian.realm].name, '#8fd18f'); break;
      }
      case 'th': {
        const sys = parts[1];
        const st = sys === 'amkhi' ? player.amkhiX : sys === 'bow' ? player.bow : sys === 'gangkhi' ? player.gangkhi : null;
        if (!st){ cheatLog('/th amkhi|bow|gangkhi <0-7>', '#ff7a6a'); return; }
        st.tier = clamp(Math.round(num(2, 1)), 0, 7); st.bless = 0;
        calcDerived(); cheatLog('Tuyệt Học ' + sys + ' → tầng ' + st.tier, '#8fd18f'); break;
      }
      case 'tier': {
        player.mount.tier = clamp(Math.round(num(1, 1)), 0, MOUNT_TIERS.length - 1);
        player.mount.out = player.mount.tier > 0;
        cheatLog('Thú Cưỡi → tầng ' + player.mount.tier, '#8fd18f'); break;
      }
      case 'boss': {
        const bd = BOSS_DEFS[curMap];
        if (!bd){ cheatLog('Map này không có trấn thủ.', '#ff7a6a'); return; }
        player.bossKills[curMap] = bd.thuve.map(t => t.id);
        player.x = bd.tranai.x * MAP.w - 380; player.y = bd.tranai.y * MAP.h; snapCamera();
        cheatLog('Đã mở phong ấn — dịch chuyển tới Tế Đàn Trấn Ải.', '#c07fe0'); break;
      }
      case 'seal': {
        const n = clamp(Math.round(num(1, 0)), 0, 7);
        const order = ['daohoa','ngoai','chungnam','comoc','tuyettinh','mongco','nhanmon'];
        player.storyFlags = {};
        for (let i = 0; i < n; i++) player.storyFlags['ta_' + order[i]] = true;
        if (n >= 7){ player.storyFlags.ketMo = true; showKetMo(); }
        cheatLog('Ngũ Ấn: ' + n + '/7 ấn đã vỡ.', '#e8b060'); break;
      }
      case 'speed': {
        const mul = num(1, 1);
        player.speed = 190 * mul;
        cheatLog('Tốc chạy ×' + mul, '#8fd18f'); break;
      }
      case 'wipe': localStorage.removeItem('vlcm_save'); location.reload(); return;
      default: cheatLog('Lệnh lạ "' + cmd + '" — gõ /help', '#ff7a6a'); return;
    }
    try { saveGame(); } catch(e){}
  } catch (e){ cheatLog('Lỗi: ' + e.message, '#ff7a6a'); }
};

// ---------- Main loop ----------
function loop(now){
  requestAnimationFrame(loop); // schedule first — an error can never freeze the game
  const dt = Math.min(0.05, (now - lastTime)/1000);
  lastTime = now;
  try { update(dt); render(); } catch(e){ console.error(e); }
}
requestAnimationFrame(loop);

// ============================================================
// V2 — UI/UX: khung Nhân Vật gộp tab · Taskbar 5 kỹ năng ·
// Túi Đồ có hình · Bản Đồ thế giới · NPC · PK/Tội Ác
// ============================================================
let _ceDummy = null;
function CE(){ return el('char-content') || (_ceDummy || (_ceDummy = document.createElement('div'))); }
window.charTab = 'info';
// lv = cấp mở khóa — tab khóa sẽ mờ đi, bấm vào chỉ hiện gợi ý (giảm quá tải tân thủ)
const CHAR_TABS = [
  { id:'info',     name:'Thông Tin',  lv:1 },
  { id:'forge',    name:'Rèn Luyện',  lv:5 },
  { id:'mount',    name:'Thú Chiến',  lv:6 },
  { id:'dantian',  name:'Đan Điền',   lv:7 },
  { id:'tuyethoc', name:'Tuyệt Học',  lv:4 },
  { id:'pet',      name:'🐾 Linh Thú', lv:15 },
];
function renderCharPanel(){
  let tab = window.charTab;
  if (!sysUnlocked(tab)) tab = window.charTab = 'info'; // tab đang chọn bị khóa → về Thông Tin
  let html = `<h3>Nhân Vật — mọi tu luyện trong một</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div class="char-tabs">`;
  for (const t of CHAR_TABS){
    const locked = !sysUnlocked(t.id);
    html += `<button class="${t.id===tab?'active':''}${locked?' locked':''}" ${locked?`title="Mở khóa ở cấp ${t.lv}"`:''} onclick="switchCharTab('${t.id}')">${locked?'🔒 ':''}${t.name}</button>`;
  }
  html += `</div><div id="char-content"></div>`;
  el('panel-char').innerHTML = html;
  if (tab==='info') renderChar();
  else if (tab==='mount') renderMount();
  else if (tab==='dantian') renderDantian();
  else if (tab==='tuyethoc') renderTuyetHoc();
  else if (tab==='pet') renderPet();
  else renderForge();
}
window.switchCharTab = function(t){
  const def = CHAR_TABS.find(x=>x.id===t);
  if (def && !sysUnlocked(t)){
    addFloat(player.x, player.y-56, `🔒 ${def.name} mở khóa ở cấp ${def.lv}!`, '#a0ffe9', 13);
    return;
  }
  window.charTab = t; renderCharPanel();
};
function refreshCharTab(tab){
  if (el('panel-char').classList.contains('hidden')) return;
  if (tab && window.charTab !== tab) return;
  renderCharPanel();
}
function refreshEqPanels(){
  if (!el('panel-inv').classList.contains('hidden')) renderInv();
  if (!el('panel-bag').classList.contains('hidden')) renderBag();
}

// ---------- Panel routing (override) ----------
function togglePanel(which){
  const tabbed = { forge:'forge', mount:'mount', dantian:'dantian', tuyethoc:'tuyethoc' };
  if (tabbed[which]){ // các hệ thống con → mở khung Nhân Vật đúng tab
    if (!sysUnlocked(tabbed[which])){ // hệ thống chưa mở theo tầng cấp
      const def = CHAR_TABS.find(x=>x.id===tabbed[which]);
      addFloat(player.x, player.y-56, `🔒 ${def ? def.name : 'Hệ thống'} mở khóa ở cấp ${def ? def.lv : '?'}!`, '#a0ffe9', 13);
      AudioSys.sfx('ui', 0.4);
      return;
    }
    const p = el('panel-char');
    const wasHidden = p.classList.contains('hidden');
    closePanels();
    if (wasHidden || window.charTab !== tabbed[which]){
      AudioSys.sfx('ui', 0.6);
      window.charTab = tabbed[which];
      renderCharPanel(); p.classList.remove('hidden');
      tutAdvance('panel');
    }
    return;
  }
  const map = { char:'panel-char', inv:'panel-inv', bag:'panel-bag', skill:'panel-skill', map:'panel-map', settings:'panel-settings', qlog:'panel-qlog', relation:'panel-relation' };
  const id = map[which];
  const p = el(id);
  const wasHidden = p.classList.contains('hidden');
  closePanels();
  if (wasHidden){ AudioSys.sfx('ui', 0.6); renderPanel(which); p.classList.remove('hidden'); if (which==='char') tutAdvance('panel'); }
}
function renderPanel(which){
  if (which==='settings'){ renderSettings(); return; }
  if (which==='qlog'){ renderQlog(); return; }
  if (which==='relation'){ renderRelationPanel(); return; }
  if (which==='char'){ window.charTab = 'info'; renderCharPanel(); }
  else if (which==='inv') renderInv();
  else if (which==='bag') renderBag();
  else if (which==='skill') renderSkillPanel();
  else if (which==='map') renderMapPanel();
  else renderCharPanel();
}
function closePanels(){
  for (const id of ['panel-char','panel-inv','panel-bag','panel-skill','panel-map','panel-quest','panel-settings','panel-qlog','panel-relation']){
    const e2 = document.getElementById(id);
    if (e2) e2.classList.add('hidden');
  }
}
window.closePanels = closePanels;

// ---------- Icon trang bị / vật liệu ----------
const SLOT_ICONS = {
  vukhi:'vukhi', non:'non', ao:'ao', tay:'tay', quan:'quan', chan:'chan',
  daychuyen:'daychuyen', nhan1:'nhan', nhan2:'nhan',
  aochoang:'aochoang', pet:'pet', canh:'canh',
};
function slotIcon(it, cls){
  const f = SLOT_ICONS[it.slot] || 'vukhi';
  // Drop v2.0: viền màu theo phẩm, xoay màu theo giai, huy hiệu số giai góc trái
  const hue = it.tier ? (it.tier-1)*22 : 0;
  const rcls = (it.rarity != null && !it.special) ? ' ic-r' + it.rarity : '';
  const badge = it.tier ? `<i class="ic-giai">${['I','II','III','IV','V','VI','VII','VIII','IX','X'][clamp(it.tier-1,0,9)]}</i>` : '';
  return `<span class="item-ic${rcls}"><img class="${cls||'slot-icon'}" style="filter:hue-rotate(${hue}deg)" src="assets/items/${f}.png" onerror="this.style.display='none'" alt="">${badge}</span>`;
}

// ---------- Trang Bị (override): chỉ 12 ô, có hình ----------
function renderInv(){
  let html = `<h3>Trang Bị — 12 Ô chuẩn GDD</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div class="stat-sec">ĐANG MẶC (bấm để tháo) — đồ đặc biệt không rèn được <button class="mini-btn" style="float:right" onclick="autoEquipBest()">⚡ Mặc Đồ Tốt Nhất</button></div>`;
  for (const sl of SLOTS){
    const it = player.equip[sl.id];
    html += `<div class="slot-row" onclick="unequip('${sl.id}')">
      <span class="s-name">${slotIcon(it || { slot: sl.id })}<span><b>${sl.name}</b><br>${it?itemLineHtml(it):'<span style="opacity:.35">— trống —</span>'}</span></span></div>`;
  }
  html += `<div style="font-size:11.5px;opacity:.6;margin-top:8px">Vật phẩm & vật liệu nằm trong <b>Túi Đồ (B)</b>.</div>`;
  el('panel-inv').innerHTML = html;
}

// ---------- Túi Đồ: lưới item có hình + vật liệu ----------
window.bagSel = -1;
const MAT_ROWS = [
  { icon:'huyenthiet', name:'Huyền Thiết', get:()=>player.mat, color:'#9fd0ff', desc:'rèn +1~+11' },
  { icon:'tula', name:'Tu La Tinh Thạch', get:()=>player.gems.tuLa, color:'#e84a6a', desc:'rèn +7 trở lên · Áo Choàng' },
  { icon:'honnguyen', name:'Hỗn Nguyên Thạch', get:()=>player.gems.honNguyen, color:'#b08ae8', desc:'rèn +10/+11 · Áo Choàng' },
  { icon:'tiendan', name:'Tiến Cấp Đan', get:()=>player.tienDan, color:'#7ec850', desc:'tấn chức Tuyệt Học' },
  { icon:'dotpha', name:'Đan Đột Phá', get:()=>player.dotpha || 0, color:'#e8c84a', desc:'bảo mệnh độ kiếp — chịu 4 tia lôi' },
  { icon:'phongphu', name:'Phong Linh Phù', get:()=>player.phongphu || 0, color:'#b08ae8', desc:'thu phục linh thú — bấm T' },
  { icon:'phu', name:'Thiên Mệnh Phù', get:()=>player.charms, color:'#f0d68a', desc:'bảo hiểm rèn' },
  { icon:'tanquyen', name:'Tàn Quyển (Thượng/Trung/Hạ)', get:()=>player.bikip ? player.bikip.pieces.join('/') : '0/0/0', color:'#e84a6a', desc:'dung hợp Huyết Ma Thôn Phệ' },
  { icon:'manhtrangbi', name:'Mảnh Trang Bị', get:()=>(player.mats&&player.mats.manh)||0, color:'#7ec8d8', desc:'Tấn Phẩm & Kế Thừa — rơi từ quái/tinh anh' },
  { icon:'tichma', name:'Tịch Ma Thạch', get:()=>(player.mats&&player.mats.tichMa)||0, color:'#e84a6a', desc:'đá lõi ấn — Tấn Phẩm Linh→Thần→Chí Tôn, rơi từ Thủ Vệ' },
  { icon:'antranai', name:'Ấn Trấn Ải', get:()=>(player.mats&&player.mats.anTranAi)||0, color:'#e8c84a', desc:'vé lên Chí Tôn — Chinh Phạt Trấn Ải 1 lần/ngày' },
  { icon:'manhcothan', name:'Mảnh Cổ Thần', get:()=>(player.mats&&player.mats.manhCoThan)||0, color:'#f0d68a', desc:'×60 đổi Bảo Hạp Cổ Thần chọn bộ (Lò Rèn)' },
];
function renderBag(){
  let html = `<h3>Túi Đồ (${player.inv.length}/30)</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div class="stat-sec">VẬT LIỆU QUÝ</div>`;
  for (const r of MAT_ROWS){
    html += `<div class="mat-row"><img src="assets/items/mat_${r.icon}.png" onerror="this.style.display='none'" alt="">
      <span style="flex:1">${r.name} <span style="opacity:.55;font-size:11px">— ${r.desc}</span></span>
      <b style="color:${r.color}">${r.get()}</b></div>`;
  }
  html += `<div class="mat-row"><img src="assets/items/mat_bac.png" onerror="this.style.display='none'" alt="">
    <span style="flex:1">Bạc <span style="opacity:.55;font-size:11px">— tiêu xài khắp giang hồ</span></span>
    <b style="color:#f0d68a">◈ ${player.silver}</b></div>`;
  html += `<div class="mat-row"><span style="width:20px;text-align:center">🎖</span>
    <span style="flex:1">Công Huân Lệnh <span style="opacity:.55;font-size:11px">— Truy Nã Lệnh mỗi ngày · quay Vạn Duyên Các</span></span>
    <b style="color:#e8c84a">${player.congHuan || 0}</b></div>`;
  // Tứ Châu — châu quý ép trang bị tại Lò Rèn
  const jw = player.jewels || {};
  html += `<div class="stat-sec">TỨ CHÂU — ép tại Lò Rèn / Hỗn Độn Lò</div>`;
  for (const jk of ['chucPhuc','linhHon','sinhMenh','honDon']){
    html += `<div class="mat-row"><span style="width:20px;text-align:center;font-size:13px;color:${JEWEL_COLORS[jk]}">◆</span>
      <span style="flex:1">${JEWEL_NAMES[jk]}</span>
      <b style="color:${JEWEL_COLORS[jk]}">${jw[jk] || 0}</b></div>`;
  }
  // Bảo Hạp từ Ma Tôn Giáng Thế — mở lấy trang bị, tầng IV+ có tỉ lệ ra Cổ Thần (không pity)
  const bh = player.baohap || {};
  const bhTiers = Object.keys(bh).filter(t => bh[t] > 0);
  if (bhTiers.length){
    html += `<div class="stat-sec">BẢO HẠP — Ma Tôn Giáng Thế</div>`;
    for (const t of bhTiers){
      const d = BAOHAP_TIERS[t];
      html += `<div class="inv-item"><span class="s-name"><b style="color:${d.color}">${d.name}</b> ×${bh[t]}<br>
        <span class="item-tip">LV${d.min}-${d.max === 999 ? '100+' : d.max} · trang bị cao cấp${d.ancient ? ` · <b style="color:#3ac88a">Cổ Thần ${Math.round(d.ancient*100)}%</b>` : ''} · châu quý</span></span>
        <span><button class="mini-btn" onclick="openBaoHap(${t})">Mở Hạp</button></span></div>`;
    }
  }
  // Nội Đan yêu thú — thôn phệ tăng chỉ số vĩnh viễn, tối đa 3 viên/ngày (bài học Phi Nguyệt Tiên Hành Lục)
  const ndUsed = ndToday();
  html += `<div class="stat-sec">NỘI ĐAN YÊU THÚ — Thôn Phệ (hôm nay còn ${Math.max(0, 3-ndUsed)}/3 lần)</div>`;
  for (const el2 of ['Kim','Mộc','Thổ','Thủy','Hỏa']){
    const cnt = (player.noidan && player.noidan[el2]) || 0;
    const nh = NGU_HANH[el2], ef = ND_EFFECT[el2];
    html += `<div class="mat-row"><span style="color:${nh.color};width:20px;text-align:center;font-size:13px">${nh.glyph}</span>
      <span style="flex:1">Nội Đan hệ ${el2} <span style="opacity:.55;font-size:11px">— ${ef.desc}</span></span>
      <b style="color:${nh.color};margin-right:8px">${cnt}</b>
      <button class="mini-btn" ${cnt > 0 && ndUsed < 3 ? '' : 'disabled'} onclick="swallowNoidan('${el2}')">Thôn Phệ</button></div>`;
  }
  html += `<div class="stat-sec">TRANG BỊ NHẶT ĐƯỢC — bấm ô để MẶC NGAY · ▲ xanh = mạnh hơn · ⋯ để Phân Giải/Bán</div>`;
  html += `<label style="font-size:12px;color:#b8a878;cursor:pointer"><input type="checkbox" ${player.autoSell?'checked':''} onchange="window.toggleAutoSell(this.checked)"> Tự động bán đồ trắng/xanh lá khi nhặt (đổi lấy bạc)</label>`;
  html += `<label style="font-size:12px;color:#b8a878;cursor:pointer"><input type="checkbox" ${player.autoEquip?'checked':''} onchange="window.toggleAutoEquip(this.checked)"> Tự mặc đồ mạnh hơn khi nhặt (≥105% lực chiến, giữ đồ quý)</label>`;
  html += `<div style="margin:6px 0"><button class="mini-btn" onclick="autoEquipBest()">⚡ Mặc Đồ Tốt Nhất (12 ô)</button></div>`;
  if (!player.inv.length) html += `<div style="opacity:.5;font-size:12px;padding:8px">Túi trống — hãy đi farm quái!</div>`;
  html += `<div class="bag-grid">`;
  player.inv.forEach((it, i)=>{
    const _eq2 = player.equip[it.slot], _bp2 = _eq2 ? itemPower(_eq2) : 0;
    const _up = !it.special && player.level >= itemReqLv(it) && itemPower(it) > _bp2;
    html += `<div class="bag-cell rar-${it.rarity}" style="position:relative" onclick="equipItem(${i})" title="${it.name} — bấm để MẶC NGAY${_up ? ' (mạnh hơn đang mặc!)' : ''} · ⋯ để chọn">
      ${slotIcon(it, '')}<span class="bc-plus">${it.plus?'+'+it.plus:''}</span>${_up ? '<span style="position:absolute;bottom:0;left:2px;color:#6ae88a;font-size:11px;font-weight:700;text-shadow:0 1px 2px #000">▲</span>' : ''}<span style="position:absolute;top:-3px;right:2px;font-size:12px;color:#c9b889;cursor:pointer;text-shadow:0 1px 2px #000" onclick="event.stopPropagation();window.selectBagItem(${i})">⋯</span></div>`;
  });
  html += `</div>`;
  if (window.bagSel >= 0 && player.inv[window.bagSel]){
    const it = player.inv[window.bagSel];
    html += `<div class="forge-lines" style="margin-top:10px"><b class="${RARITIES[it.rarity].cls}">${it.name}</b><br>${itemLineHtml(it)}</div>
      <div class="forge-actions"><button class="mini-btn" onclick="equipItem(${window.bagSel})">Mặc Vào</button>
      <button class="mini-btn" onclick="sellItem(${window.bagSel})">Bán (+${itemSellPrice(it)}◈)</button>
      <button class="mini-btn" onclick="salvage(${window.bagSel});window.bagSel=-1">Phân Giải (+${1+it.rarity+Math.floor(it.plus/3)}✦)</button></div>`;
  }
  el('panel-bag').innerHTML = html;
}
window.selectBagItem = function(i){ window.bagSel = (window.bagSel === i) ? -1 : i; renderBag(); };
window.toggleAutoSell = function(v){ player.autoSell = v; saveGame(); };
// hành động túi đồ → refresh cả 2 panel (override)
window.equipItem = function(i){
  const it = player.inv[i];
  if (!it) return;
  if (player.level < itemReqLv(it)){
    addFloat(player.x, player.y-30, `Cần LV${itemReqLv(it)} để mặc ${it.name}!`, '#ff7a6a', 13);
    return;
  }
  player.inv.splice(i,1);
  if (player.equip[it.slot]) player.inv.push(player.equip[it.slot]);
  player.equip[it.slot] = it;
  window.bagSel = -1;
  calcDerived(); refreshEqPanels(); saveGame();
};
window.unequip = function(slotId){
  const it = player.equip[slotId];
  if (!it || player.inv.length>=30) return;
  player.equip[slotId] = null; player.inv.push(it);
  calcDerived(); refreshEqPanels(); saveGame();
};
window.salvage = function(i){
  const it = player.inv[i];
  if (!it) return;
  const gain = 1 + it.rarity + Math.floor(it.plus/3);
  player.mat += gain;
  player.inv.splice(i,1);
  addFloat(player.x, player.y-30, `Phân giải +${gain}✦`, '#9fd0ff', 12);
  refreshEqPanels(); saveGame();
};

// ---------- Bản Đồ thế giới ----------
function renderMapPanel(){
  const zt = zoneType();
  let html = `<h3>Bản Đồ Giang Hồ</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:6px">Đang ở: <b style="color:${zt.color}">${mapDef().name}</b> · ${zt.name}</div>`;
  for (const id in MAPS){
    const m = MAPS[id], z2 = ZONE_TYPES[m.type];
    const locked = player.level < m.min, cur = id === curMap;
    html += `<div class="map-row" style="${cur?'border-color:#f0d68a;background:rgba(201,162,39,.1)':''}">
      <span style="flex:1"><span class="m-name">${m.name}</span>
        <span style="font-size:10.5px;opacity:.6"> · LV ${m.range}</span>
        <span class="zone-badge" style="color:${z2.color};border-color:${z2.color}">${z2.name}</span>
        <div class="m-desc">${m.desc}</div>${bandSummaryHtml(m)}</span>
      <span class="m-side">${cur ? '<span style="color:#f0d68a;font-size:11px">ĐANG Ở ĐÂY</span>'
        : locked ? `<span style="color:#ff7a6a;font-size:11px">Cần cấp ${m.min}</span>`
        : `<button class="mini-btn" onclick="travelTo('${id}')">Dịch Chuyển</button>`}</span></div>`;
  }
  el('panel-map').innerHTML = html;
}

// ---------- Kỹ Năng: gán vào taskbar 5 ô ----------
function renderSkillPanel(){
  let html = `<h3>Kỹ Năng — gán tối đa 5 ô (phím 1-5)</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:8px">Taskbar hiện tại: `;
  for (let i = 0; i < 5; i++){
    const id = player.skillBar[i];
    html += id ? `<button class="mini-btn" onclick="window.assignSkill(null,${i})" title="Bấm để gỡ">${i+1}: ${skillInfo(id).name} ✕</button> `
               : `<span style="opacity:.5;font-size:11px">[${i+1}: trống]</span> `;
  }
  html += `<div style="font-size:11px;color:#9a8a68;line-height:1.65;margin-bottom:6px">⬆ Mỗi cấp <b>+2,5% ST</b> (phí bạc tăng dần theo cấp) · Mốc cảnh giới chiêu: <b>20</b> Tiểu Thành +8% ST · <b>40</b> Trung Thành −10% hồi chiêu · <b>60</b> Đại Thành +12% ST · <b>80</b> Viên Dung −12% Nội Lực · <b>100</b> Xuất Thần +15% ST · <b>120</b> Hóa Cảnh +20% ST — farm quái & bán đồ lấy bạc để tu luyện!</div>`;
  html += `</div><div class="stat-sec">CHIÊU THỨC CHỦ ĐỘNG — bấm số ô để gán</div>`;
  for (const id in SKILL_DEFS){
    if (SKILL_DEFS[id].kind === 'vh') continue; // võ học phổ có mục riêng bên dưới
    const info = skillInfo(id);
    html += `<div class="skill-row${info.unlocked?'':' locked'}">
      <img src="${info.icon}" onerror="this.outerHTML='<span class=\\'sk-glyph\\'>${id==='a'?'壹':id==='tp'?'鎮':id==='amkhi'?'暗':id==='bow'?'弓':id==='gangkhi'?'罡':id==='danchi'?'弹':'魂'}</span>'" alt="">
      <span class="sk-info"><b style="color:${info.unlocked?'#f0d68a':'#8a8a8a'}">${info.name}</b>
        <span style="font-size:10.5px;opacity:.6"> · ${info.qi} nội lực · ${info.cd}s</span>
        <div class="sk-desc">${info.unlocked ? info.desc : '🔒 ' + info.lockTxt}</div></span>
      <span class="assign-btns">${info.unlocked ? upBtnHtml(id) : ''}${[0,1,2,3,4].map(s=>
        `<button class="mini-btn" ${info.unlocked?'':'disabled'} onclick="window.assignSkill('${id}',${s})">${s+1}</button>`).join('')}</span></div>`;
  }
  // ── VÕ HỌC PHỔ: tự do chọn tuyệt chiêu & hướng đi ──
  vhAutoLearn(); // save cũ / test mode: quét tự ngộ võ học phái
  html += `<div class="stat-sec">VÕ HỌC PHỔ — tự do chọn hướng đi · 📜 Bí Kíp: <b style="color:#e8c84a">${player.bikipVH||0}</b></div>`;
  html += `<div style="font-size:11px;color:#9a8a68;margin-bottom:4px;line-height:1.55">Võ học <b>giang hồ</b> yêu cầu cảnh giới tu tiên — <b style="color:#b08ae8">Kim Đan Cảnh</b> mở kết hợp tự do, Cao cấp cần Nguyên Anh Trung, Thần cấp cần Nguyên Anh Hậu. Bí Kíp chủ yếu từ <b style="color:#e8c84a">Té Núi</b>: Vân Đài (Chung Nam) · Đoạn Trường Nhai (Tuyệt Tình) · Định Biên Nhai (Nhạn Môn).</div>`;
  const _vhSchools = {};
  for (const _vid in VOHOC_DEFS){ const _v = VOHOC_DEFS[_vid]; (_vhSchools[_v.school] = _vhSchools[_v.school] || []).push(_vid); }
  for (const _sch in _vhSchools){
    html += `<div style="font-size:11px;color:#9a8a68;margin:7px 0 2px;letter-spacing:1px">— ${_sch} —</div>`;
    for (const _vid of _vhSchools[_sch]){
      const _v = VOHOC_DEFS[_vid], _t = VH_TIER[_v.tier];
      const learned = vhLearned(_vid), isPass = _v.type === 'passive';
      const canLv = player.level >= _v.unlock;
      const ownPhai = _v.phai && (_v.phai === player.sect || (_v.phai === 'toanchan' && player.sect === 'comoc'));
      const _rReq = vhRealmReq(_v);
      const canRealm = ((player.dantian && player.dantian.realm) || 0) >= _rReq;
      let right = '';
      if (learned && !isPass){
        right = `<span class="assign-btns">${upBtnHtml(_vid)}${[0,1,2,3,4].map(s=>
          `<button class="mini-btn" onclick="window.assignSkill('${_vid}',${s})">${s+1}</button>`).join('')}</span>`;
      } else if (learned){
        right = `<span style="font-size:10.5px;color:#a0ffe9">✓ đã lĩnh ngộ</span>`;
      } else if (!_v.phai && canLv && canRealm){
        right = `<button class="mini-btn vh-learn-btn" ${(player.bikipVH||0)>=_t.cost?'':'disabled'} onclick="window.learnVohocUI('${_vid}')">Học · ${_t.cost}📜</button>`;
      } else {
        right = `<span style="font-size:10.5px;opacity:.5">${!canRealm ? '🔒 ' + VH_REALM_NAME[_rReq] : !canLv ? '🔒 cấp '+_v.unlock : (_v.phai && !ownPhai ? 'võ học phái khác' : '🔒')}</span>`;
      }
      html += `<div class="skill-row${learned?'':' locked'}">
        <img src="${_v.icon}" onerror="this.style.display='none'" alt="">
        <span class="sk-info"><b style="color:${learned?_t.color:'#8a8a8a'}">${_v.name}</b>
          <span style="font-size:10px;color:${_t.color}"> · ${_t.name} · ${_v.cat}</span>
          ${!isPass?`<span style="font-size:10.5px;opacity:.6"> · ${_v.qi} nội lực · ${_v.cd}s</span>`:''}
          <div class="sk-desc">${_v.desc}</div></span>
        ${right}</div>`;
    }
  }
  // ── DUNG HỢP THẦN CÔNG: kết hợp liên phái mở tiềm năng mới (Kim Dung · Tiên Hiệp) ──
  html += `<div class="stat-sec" style="color:#ff9ae0">☯ DUNG HỢP THẦN CÔNG — kết hợp 2 môn khác phái, mở tuyệt chiêu mới</div>`;
  html += `<div style="font-size:11px;color:#9a8a68;margin-bottom:4px;line-height:1.55">Lĩnh ngộ đủ <b>cả 2 môn tiền trệ</b> + đạt <b style="color:#b08ae8">Nguyên Anh · Trung Kỳ</b> + <b>3 📜 Bí Kíp</b> để dung hợp. 30 tuyệt chiêu danh pháp chuẩn <b>Kim Dung</b> & <b>Tiên Hiệp</b>.</div>`;
  for (const _fid in FUSION_DEFS){
    const _f = FUSION_DEFS[_fid];
    const _fsLearned = vhLearned(_fid), _fsReqOk = _f.req.every(r => vhLearned(r));
    const _fsRealmOk = ((player.dantian && player.dantian.realm) || 0) >= 6;
    const _fsReqTxt = _f.req.map(r => { const rv = VOHOC_DEFS[r]; return `<span style="color:${vhLearned(r) ? '#7ec850' : '#8a8a8a'}">${rv ? rv.name : r}</span>`; }).join(' + ');
    let right = '';
    if (_fsLearned){
      right = `<span class="assign-btns">${upBtnHtml(_fid)}${[0,1,2,3,4].map(s=>
        `<button class="mini-btn" onclick="window.assignSkill('${_fid}',${s})">${s+1}</button>`).join('')}</span>`;
    } else if (_fsReqOk && _fsRealmOk){
      right = `<button class="mini-btn vh-learn-btn" style="border-color:#ff9ae0 !important;color:#ff9ae0 !important" ${(player.bikipVH||0)>=FS_TIER.cost?'':'disabled'} onclick="window.learnFusionUI('${_fid}')">☯ Dung Hợp · 3📜</button>`;
    } else {
      right = `<span style="font-size:10.5px;opacity:.5">${!_fsRealmOk ? '🔒 Nguyên Anh · Trung Kỳ' : '🔒 thiếu tiền trệ'}</span>`;
    }
    html += `<div class="skill-row${_fsLearned?'':' locked'}">
      <img src="${_f.icon}" onerror="this.style.display='none'" alt="">
      <span class="sk-info"><b style="color:${_fsLearned ? FS_TIER.color : '#8a8a8a'}">${_f.name}</b>
        <span style="font-size:10px;color:#c8a0c8"> · ${_f.origin} · ${_f.cat}</span>
        <span style="font-size:10.5px;opacity:.6"> · ${_f.qi} nội lực · 1s · Lv ${skLv(_fid)}</span>
        <div class="sk-desc">${_f.desc}</div>
        <div style="font-size:10px;opacity:.85">☯ ${_fsReqTxt}</div></span>
      ${right}</div>`;
  }
  html += `<div class="stat-sec">TÂM PHÁP BỊ ĐỘNG (tự kích hoạt, không cần gán)</div>`;
  for (const ps of PASSIVE_SKILLS){
    const on = ps.req();
    html += `<div class="skill-row${on?'':' locked'}"><span class="sk-glyph">心</span>
      <span class="sk-info"><b style="color:${on?'#a0ffe9':'#8a8a8a'}">${ps.name}</b>
      <div class="sk-desc">${on ? ps.desc : '🔒 chưa đạt điều kiện'}</div></span></div>`;
  }
  el('panel-skill').innerHTML = html;
}
window.assignSkill = function(id, slot){
  if (id){
    const info = skillInfo(id);
    if (!info.unlocked) return;
    // gỡ khỏi ô cũ nếu đang gán chỗ khác
    const old = player.skillBar.indexOf(id);
    if (old >= 0) player.skillBar[old] = null;
  }
  player.skillBar[slot] = id;
  saveGame(); renderSkillPanel();
};

// ---------- Chiêu thức (override): mọi kỹ năng qua SKILL_DEFS ----------
function castSkill(id){
  if (!player || dead || id == null) return;
  if (id === 'b') id = 'amkhi'; if (id === 'c') id = 'tp'; // legacy alias
  const d = SKILL_DEFS[id]; if (!d) return;
  const info = skillInfo(id);
  const _sm = skMile(id), _qiNeed = Math.max(1, Math.round(info.qi * _sm.qi)); // GDD Đợt 2 B6: mốc 80 −12% Nội Lực
  if (!info.unlocked){ addFloat(player.x, player.y-34, info.lockTxt, '#8a8a8a', 12); return; }
  if ((player.cd[id] || 0) > 0) return;
  // LIÊN TRẢM: trong cửa sổ 2.5s, chiêu kế tiếp theo miễn phí Nội Lực (ám khí không ăn cửa sổ)
  const _ltFree = (player.ltT || 0) > 0 && id !== 'amkhi';
  if (!_ltFree){
    if (player.qi < _qiNeed){ addFloat(player.x, player.y-34, 'Không đủ Nội Lực!', '#7fa8e0', 12); return; }
    player.qi -= _qiNeed;
  } else addFloat(player.x, player.y-48, '⚡ Liên Trảm — miễn phí Nội Lực!', '#ffd76a', 12);
  player.cd[id] = info.cd * (player.vhCdMult || 1) * _sm.cd; // GDD Đợt 2 B6: mốc 40 −10% hồi chiêu // Tẩy Tủy Kinh: -30% hồi chiêu
  const _atk0 = player.atk; player.atk = Math.round(player.atk * skLvMult(id) * _sm.dmg); // GDD Đợt 2 B6: mốc ST nhân dồn // cấp kỹ năng 1-120: +2.5% ST mỗi cấp
  player.comboT = 3; // mở/duy trì chuỗi combo — ám khí trúng trong lúc này sẽ kích Liên Trảm
  player.castT = 0.38; // animation tung tuyệt chiêu
  const sect = SECTS[player.sect];

  if (d.kind === 'amkhi'){ // ám khí projectile
    const t = nearestMob(360);
    const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = ang;
    projectiles.push({ x:player.x, y:player.y, ang, speed:460, dmg:player.atk*SKILL_DEFS.amkhi.mult*(1+(player.amkhiPct||0)+(player.skillDmgPct||0)), kind:'amkhi', life:0.85, color:'#e8e8ff' });
    addEffect({ type:'arc', x:player.x, y:player.y, face:ang, r:40, color:'#aab' });
    spawnSlash(player.x + Math.cos(ang)*30, player.y + Math.sin(ang)*30 - 12, ang, 80);
  }
  else if (d.kind === 'sectTP'){ // Trấn Phái — big AoE
    spawnSkillVfx('sx_' + player.sect + '_c', { color:sect.color, glyph:'鎮' }, 'aoe', player.face, TP_RADIUS);
    addEffect({ type:'ring', x:player.x, y:player.y, r:TP_RADIUS, color:sect.color, big:true });
    addEffect({ type:'ring', x:player.x, y:player.y, r:TP_RADIUS*0.6, color:sect.glow, big:true });
    for (let i = 0; i < 6; i++){
      const a = i * Math.PI/3 + player.face;
      spawnSlash(player.x + Math.cos(a)*70, player.y + Math.sin(a)*70 - 10, a, 170);
    }
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) < TP_RADIUS + m.def.size){
        let dmg = player.atk * sect.tp.mult * rnd(0.95,1.1);
        if (Math.random() < player.crit) dmg *= 2;
        hurtMob(m, dmg, 'tp');
      }
    }
  }
  else if (d.kind === 'gangkhi'){ // Cương Khí Hộ Thể — buff 6s giảm 30% ST
    player.gkBuffT = 6;
    addFloat(player.x, player.y-52, 'CƯƠNG KHÍ HỘ THỂ!', '#f0d68a', 16);
    addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:'#f0d68a', big:true });
    addEffect({ type:'ring', x:player.x, y:player.y, r:44, color:'#fff0c0', big:true });
  }
  else if (d.kind === 'danchi'){ // Đạn Chỉ Thần Thông — chỉ lực phong mạch
    const t = nearestMob(520);
    const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = ang;
    projectiles.push({ x:player.x, y:player.y, ang, speed:620, dmg:player.atk*SKILL_DEFS.danchi.mult, kind:'danchi', life:0.9, color:'#9fd0ff', pierce:false });
    addEffect({ type:'arc', x:player.x, y:player.y, face:ang, r:46, color:'#9fd0ff' });
  }
  else if (d.kind === 'bow'){ // Linh Tiễn Xạ — 3 mũi tên quạt xuyên thấu
    const t = nearestMob(460);
    const base = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
    player.face = base;
    const bwT = BOW_TIERS[player.bow.tier] || BOW_TIERS[1];
    for (const off of [-0.2, 0, 0.2])
      projectiles.push({ x:player.x, y:player.y, ang:base+off, speed:520, dmg:player.atk*SKILL_DEFS.bow.mult, kind:'bow', life:0.95, color:bwT.color, pierce:true });
    addEffect({ type:'arc', x:player.x, y:player.y, face:base, r:50, color:bwT.color });
  }
  else if (d.kind === 'tieuhon'){ // Ám Nhiên Tiêu Hồn Chưởng — AoE lớn
    const R = 230;
    addEffect({ type:'ring', x:player.x, y:player.y, r:R, color:'#7a5a9a', big:true });
    addEffect({ type:'ring', x:player.x, y:player.y, r:R*0.6, color:'#b08ae8', big:true });
    for (let i=0;i<14;i++) addEffect({ type:'ink', x:player.x+rnd(-R,R)*0.7, y:player.y+rnd(-R,R)*0.7, vx:rnd(-30,30), vy:rnd(-70,-20), color:'#6a4a8a' });
    for (const m of mobs){
      if (m.dead) continue;
      if (dist(player.x, player.y, m.x, m.y) < R + m.def.size){
        let dmg = player.atk * SKILL_DEFS.tieuhon.mult * rnd(0.95,1.1);
        if (Math.random() < player.crit) dmg *= 2;
        hurtMob(m, dmg, 'tp');
      }
    }
  }
  else if (d.kind === 'vh'){ castVohoc(id); }
  else { // sectA — 4 loại theo môn phái
    const def = sect.skillA, type = def.type, _tbMul = 1 + (player.tbDmg || 0); // Thần Binh buff chiêu phái
    const _sva = 'sx_' + player.sect + '_a';
    if (type==='cone'){
      const t = nearestMob(160);
      if (t) player.face = Math.atan2(t.y-player.y, t.x-player.x);
      spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'cone', player.face, 120);
      addEffect({ type:'cone', x:player.x, y:player.y, face:player.face, r:120, color:sect.color });
      spawnSlash(player.x + Math.cos(player.face)*62, player.y + Math.sin(player.face)*62 - 12, player.face, 160);
      for (const m of mobs){
        if (m.dead) continue;
        const dd = dist(player.x, player.y, m.x, m.y);
        if (dd < 125 + m.def.size){
          let da = Math.atan2(m.y-player.y, m.x-player.x) - player.face;
          while (da > Math.PI) da -= 2*Math.PI; while (da < -Math.PI) da += 2*Math.PI;
          if (Math.abs(da) < 1.0) hurtMob(m, player.atk*def.mult*_tbMul*rnd(0.9,1.1), Math.random()<player.crit?'crit':'hit');
        }
      }
    } else if (type==='proj'){
      const t = nearestMob(420);
      const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
      player.face = ang;
      const _svc = SECT_VFX[_sva];
      projectiles.push({ x:player.x, y:player.y, ang, speed:420, dmg:player.atk*def.mult*_tbMul, kind:'skill', life:1.0, color:sect.color, pierce:true, style:(_svc && _svc.proj) || undefined });
      spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'cast', ang, 60);
      spawnSlash(player.x + Math.cos(ang)*34, player.y + Math.sin(ang)*34 - 12, ang, 120);
    } else if (type==='selfaoe'){
      spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'aoe', player.face, 135);
      addEffect({ type:'ring', x:player.x, y:player.y, r:135, color:sect.color });
      for (let i = 0; i < 4; i++){
        const a = i * Math.PI/2 + Math.PI/4;
        spawnSlash(player.x + Math.cos(a)*52, player.y + Math.sin(a)*52 - 10, a, 130);
      }
      for (let i=0;i<10;i++) addEffect({ type:'ink', x:player.x+rnd(-90,90), y:player.y+rnd(-90,90), vx:rnd(-30,30), vy:rnd(-60,-10), color:sect.color });
      for (const m of mobs){
        if (m.dead) continue;
        if (dist(player.x, player.y, m.x, m.y) < 140 + m.def.size)
          hurtMob(m, player.atk*def.mult*_tbMul*rnd(0.9,1.1), Math.random()<player.crit?'crit':'hit');
      }
    } else if (type==='dash'){
      spawnSkillVfx(_sva, { color:sect.color, glyph:'絕' }, 'dash', player.face, 150, player.x, player.y);
      const t = nearestMob(220);
      const ang = t ? Math.atan2(t.y-player.y, t.x-player.x) : player.face;
      player.face = ang;
      player.x = clamp(player.x + Math.cos(ang)*130, 20, MAP.w-20);
      player.y = clamp(player.y + Math.sin(ang)*130, 20, MAP.h-20);
      addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:sect.color });
      spawnSlash(player.x + Math.cos(ang)*40, player.y + Math.sin(ang)*40 - 12, ang, 140);
      const t2 = nearestMob(110);
      if (t2) hurtMob(t2, player.atk*def.mult*_tbMul*rnd(0.95,1.15), Math.random()<player.crit?'crit':'hit');
    }
  }
  AudioSys.sfx('skill', 0.6);
  flashSkillSlot(id);
  // Song Thủ Hỗ Bác (Võ Học Phổ): 30% chiêu vừa tung không tốn hồi chiêu
  if (id !== 'tieuvotuong' && vhLearned('songthu') && Math.random() < 0.3){
    player.cd[id] = 0;
    addFloat(player.x, player.y-62, '✦ SONG THỦ HỖ BÁC — chiêu không hồi!', '#d8d8f0', 13);
  }
  player.atk = _atk0; // trả công lực gốc — buff cấp kỹ năng chỉ áp trong lúc tung chiêu
}
function flashSkillSlot(skillId){
  const i = (player.skillBar || []).indexOf(skillId);
  const b = i >= 0 ? el('sk-'+i) : null;
  if (b){ b.classList.add('flash'); setTimeout(()=>b.classList.remove('flash'), 220); }
}

// ---------- HUD (override): mana thay chân khí · danh hiệu/phái/cấp trên thanh ----------
function updateHud(){
  const sect = SECTS[player.sect];
  const tt = player.titles && player.titles.equipped && TITLES.find(x=>x.id===player.titles.equipped);
  const nameEl = el('hud-name');
  nameEl.innerHTML = `${tt?`<span class="title-tag">【${tt.name}】</span> `:''}${player.name ? `<span class="char-name">${player.name}</span> · ` : ''}${player.ascended ? `<span style="color:#fff2b0">☁ Tán Tiên</span><span style="opacity:.55;font-size:10px"> · xuất thế ${sect.name}</span>` : sect.name} · Cấp ${player.level}${player.level>=MAX_LV?' (Tối đa)':''}${player.toiac>0?` · <b>TỘI ÁC ${player.toiac}</b>`:''}`;
  nameEl.classList.toggle('toiac', (player.toiac||0) > 0);
  el('bar-hp').style.width = (100*player.hp/player.maxHp)+'%';
  el('txt-hp').textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  el('bar-qi').style.width = (100*player.qi/player.maxQi)+'%';
  el('txt-qi').textContent = `Nội Lực ${Math.floor(player.qi)} / ${player.maxQi}`;
  if (player.level >= MAX_LV){ el('bar-xp').style.width='100%'; el('txt-xp').textContent='MAX'; }
  else { el('bar-xp').style.width = (100*player.xp/XP_TABLE[player.level-1])+'%';
         el('txt-xp').textContent = `${Math.floor(player.xp)} / ${XP_TABLE[player.level-1]} EXP`; }
  el('hud-khi').textContent = `Chân Khí: ${Math.floor(player.khi || 0)}${player.poisonT>0 ? ' · ☠ TRÚNG ĐỘC' : ''}${player.gkBuffT>0 ? ` · 罡 ${player.gkBuffT.toFixed(1)}s` : ''}`;
  const potEl = el('hud-potion');
  if (potEl){ potEl.textContent = `🧪 x${player.potions || 0} (R)${player.potionCd > 0 ? ` · ${Math.ceil(player.potionCd)}s` : ''}`; potEl.style.opacity = (player.potions > 0 && player.potionCd <= 0) ? 1 : 0.45; }
  const buffEl = el('hud-buff');
  if (buffEl){
    if ((player.buffAtkT || 0) > 0){
      buffEl.style.display = '';
      buffEl.textContent = `🍶 +12% công · ${Math.floor(player.buffAtkT/60)}:${String(Math.floor(player.buffAtkT%60)).padStart(2,'0')}`;
    } else buffEl.style.display = 'none';
  }
  const loiEl = el('hud-loidon');
  if (loiEl){
    if ((player.loidonT || 0) > 0){
      loiEl.style.display = '';
      loiEl.textContent = `⚡ -40% lôi · ${Math.floor(player.loidonT/60)}:${String(Math.floor(player.loidonT%60)).padStart(2,'0')}`;
    } else loiEl.style.display = 'none';
  }
  el('hud-silver').textContent = `◈ ${player.silver}`;
  el('hud-mat').textContent = `✦ ${player.mat} Tinh Thạch`;
  // Lịch Tu Tiên: chip đồng hồ thế giới (mùa · ngày/tháng/năm · canh giờ)
  const gtEl = el('hud-time');
  if (gtEl && player.gt){
    const gti = gameTimeInfo();
    const _wxn = weatherNow();
    gtEl.innerHTML = `${gti.season.icon} <b>${gti.season.name}</b> · ${gti.day}/${gti.month} N${gti.year} · ${CANH_NAMES[gti.canh]}${_wxn ? ` · <span title="Thời tiết: ${_wxn.name}">${_wxn.icon}</span>` : ''}${isNightGame() ? ' · <span style="color:#8ab8e8">☾</span>' : ''}`;
    gtEl.style.color = gti.season.color;
    gtEl.title = `Lịch Tu Tiên — mùa ${gti.season.name}: ${gti.season.buffTxt} · ban đêm quái +10% công nhưng +10% EXP`;
  }
  // bản đồ + loại khu vực + đai cấp đang đứng
  const md = mapDef(), zt = zoneType();
  const _hb = bandOfDist(md, player.x, player.y);
  el('hud-map').innerHTML = `${md.name}<span class="zone-badge" style="color:${zt.color};border-color:${zt.color}">${zt.name}</span>`
    + (_hb >= 0 ? `<span class="zone-badge" style="color:${BAND_COLORS[_hb]};border-color:${BAND_COLORS[_hb]}">Đai ${BAND_NAMES[_hb]} · ${bandLvText(md,_hb)}</span>` : '');
  // nút PK: chỉ ở map Dã Ngoại / Huyết Chiến
  const pkBtn = el('btn-pk');
  if (md.type === 'safe') pkBtn.classList.add('hidden');
  else {
    pkBtn.classList.remove('hidden');
    pkBtn.textContent = player.pk ? 'PK: BẬT' : 'PK: Tắt';
    pkBtn.classList.toggle('pk-on', !!player.pk);
    pkBtn.classList.toggle('pk-off', !player.pk);
  }
  const autoBtn = el('btn-auto');
  if (autoBtn){ autoBtn.classList.remove('hidden'); updateAutoBtn(); }
  // quest tracker — chính tuyến + tối đa 2 phụ tuyến
  { const _th = trackerHtml(); if (window._lastTrack !== _th){ window._lastTrack = _th; el('quest-tracker').innerHTML = _th; } } // GDD Đợt 2 B2: cache để nút bấm không bị render đè
  // hint — theo tầng cấp, tân thủ chỉ thấy phím cốt lõi
  el('hint-bar').textContent = hintText();
  // taskbar: 5 ô kỹ năng
  for (let i = 0; i < 5; i++){
    const b = el('sk-'+i); if (!b) continue;
    const id = (player.skillBar || [])[i];
    if (!id){
      b.classList.add('sk-empty'); b.classList.remove('locked','has-img');
      b.style.backgroundImage = '';
      b.querySelector('.sk-ico').textContent = '+';
      b.title = 'Ô trống — bấm để gán kỹ năng (K)';
      b.querySelector('.sk-cd').style.height = '0%';
      continue;
    }
    const info = skillInfo(id);
    b.classList.remove('sk-empty');
    b.classList.toggle('locked', !info.unlocked);
    b.classList.add('has-img');
    b.style.backgroundImage = `url(${info.icon})`;
    b.title = info.unlocked ? `${info.name} — ${info.qi} nội lực · ${info.cd}s` : `${info.name} — ${info.lockTxt}`;
    const cd = player.cd[id] || 0;
    b.querySelector('.sk-cd').style.height = (cd>0 ? (100*cd/info.cd) : 0) + '%';
  }
  setSkillBtn('sk-jump', !!player.canJump, player.cd.jump, 0.01, 'Lăng Ba Vi Bộ — không cooldown');
}
function applySkillIcons(){
  setSkillIcon('sk-basic', 'assets/skills/basic.png');
}

// ---------- NPC (override): nhiều NPC, mỗi map, có hình riêng ----------
function drawNpc(){
  for (const n of NPCS){
    if (n.map !== curMap) continue;
    const im = NPC_IMGS[n.id];
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(n.x, n.y+8, 14, 5, 0, 0, 7); ctx.fill();
    if (im && im.complete && im.naturalWidth){
      const nh = 64, nw = nh * (im.naturalWidth/im.naturalHeight);
      ctx.drawImage(im, n.x - nw/2, n.y - nh + 10, nw, nh);
    } else {
      ctx.fillStyle = '#5a4a30';
      ctx.beginPath(); ctx.ellipse(n.x, n.y-8, 11, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(n.x, n.y-28, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(n.x-4, n.y-22); ctx.quadraticCurveTo(n.x, n.y-14, n.x+4, n.y-22); ctx.stroke();
    }
    ctx.font = '12px \"Be Vietnam Pro\", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=3;
    if (n.talk === 'quest'){
      const q = currentQuest();
      const mark = q && questState==='done' ? '!' : (q ? '…' : '');
      if (mark){ ctx.font = 'bold 13px \"Be Vietnam Pro\", sans-serif'; ctx.fillStyle = '#f0d68a';
        ctx.strokeText(mark, n.x, n.y-64); ctx.fillText(mark, n.x, n.y-64); ctx.font = '12px \"Be Vietnam Pro\", sans-serif'; }
    }
    ctx.fillStyle = '#fff';
    ctx.strokeText(n.name, n.x, n.y-52); ctx.fillText(n.name, n.x, n.y-52);
  }
}
// Nói chuyện: NPC gần nhất trong map
function tryTalk(){
  let best = null, bd = 95;
  for (const n of NPCS){
    if (n.map !== curMap) continue;
    const d = dist(player.x, player.y, n.x, n.y);
    if (d < bd){ bd = d; best = n; }
  }
  if (!best) return;
  if (best.talk === 'quest') return tryTalkQuest();
  if (best.talk === 'forge'){ renderBaGua(); return; }
  if (best.talk === 'shop') return renderShop(best);
  if (best.talk === 'abode'){ renderAbode(); return; }
}
// ---------- Hệ thống cửa hàng — mỗi NPC một quầy hàng riêng ----------
const SHOPS = {
  thuongnhan: { quote:'"Giang hồ lợi lớn nhất là <b style=\'color:#f0d68a\'>bạc</b> — có bạc là có tất cả!"', junk:true, rows:[
    { id:'thuoc',   name:'🧪 Hồ Lô Thuốc',     price:150, desc:'Hồi 40% máu tức thì (phím R) — túi đựng tối đa 5 lọ' },
    { id:'phu',     name:'☂ Thiên Mệnh Phù',   price:500, desc:'Bảo hiểm rèn +7 trở lên — xịt giữ nguyên cấp' },
    { id:'tiendan', name:'◈ Tiến Cấp Đan ×3',  price:900, desc:'Tấn chức Tuyệt Học (Ám Khí/Cung Tiễn/Cương Khí)' },
  ]},
  duoclao: { quote:'"Thuốc bổ hay thuốc độc — khác nhau ở liều lượng thôi, khách quân ạ."', rows:[
    { id:'thuoc',     name:'🧪 Hồ Lô Thuốc',        price:150, desc:'Hồi 40% máu tức thì (phím R) — túi đựng tối đa 5 lọ' },
    { id:'trithuong', name:'✚ Trị Thương Toàn Phần', price:100, desc:'Dược Lão tự tay bốc thuốc — hồi đầy HP ngay lập tức' },
    { id:'tukhi',     name:'◎ Tụ Khí Công',          price:80,  desc:'Vận chuyển chân khí — hồi đầy Chân Khí ngay lập tức' },
    { id:'loidon',    name:'⚡ Lôi Độn Phù',           price:600, desc:'5 phút giảm 40% sát thương thiên lôi — vật bất ly thân khi độ kiếp' },
    { id:'dotpha',    name:'◈ Đan Đột Phá',            price:800, desc:'Bảo mệnh độ kiếp: chịu được 4 tia lôi thay vì 3, thất bại chỉ tổn 25% Tu Vi (tự dùng khi đột phá)' },
  ]},
  binhkhi: { quote:'"Binh khí nhà ta ba đời rèn giũa — mở rương là biết liền."', rows:[
    { id:'ruongvk', name:'⚔ Rương Binh Khí',  price:800, desc:'Vũ khí ngẫu nhiên theo cấp của ngươi — có thể ra hàng hiếm' },
    { id:'ruongpc', name:'🛡 Rương Phòng Cụ', price:700, desc:'Giáp trụ ngẫu nhiên theo cấp — có thể ra trang bị Hoàn Hảo' },
    { id:'phongphu', name:'🐾 Phong Linh Phù', price:1500, desc:'Thu phục quái tinh anh suy yếu (dưới 40% máu) làm Linh Thú — đứng gần bấm T' },
  ]},
  trachu: { quote:'"Vào đây uống chén trà nóng đã — chuyện giang hồ để sau hẵng hay."', rows:[
    { id:'nghitro', name:'🛏 Nghỉ Trọ',      price:120, desc:'Nghỉ ngơi dưỡng thần — hồi đầy HP và Chân Khí' },
    { id:'ruou',    name:'🍶 Rượu Hổ Cốt',   price:200, desc:'3 phút +12% công lực — men say bừng bừng sát khí' },
  ]},
};
let curShopNpc = null;
function renderShop(n){
  const shop = SHOPS[n.id];
  if (!shop) return;
  curShopNpc = n;
  let html = `<h3>${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">${shop.quote}</div>`;
  for (const r of shop.rows){
    html += `<div class="npc-shop-row"><span><b style="color:#f0d68a">${r.name}</b><br>
      <span style="font-size:11px;opacity:.7">${r.desc}</span></span>
      <button class="mini-btn" ${player.silver<r.price?'disabled':''} onclick="buyFromShop('${r.id}')">${r.price}◈</button></div>`;
  }
  // Vật Phẩm Quý — làm mới 2 giờ/lần, mỗi tiệm một món khác nhau (bài học Phường Thị NNTD)
  const RARE_POOL = (window.RARE_POOL = window.RARE_POOL || [
    { id:'r_ruongvk2', name:'⚔ Rương Binh Khí Tinh Tuyển', price:1400, desc:'Tỉ lệ ra hàng hiếm gấp 3 — vũ khí theo cấp của ngươi' },
    { id:'r_tiendan5', name:'◈ Tiến Cấp Đan ×5 (giá hời)', price:1200, desc:'Gói tiết kiệm — chỉ bán theo đợt' },
    { id:'r_dotpha',   name:'◈ Đan Đột Phá (giá hời)',     price:650,  desc:'Bảo mệnh độ kiếp — chịu 4 tia thiên lôi' },
    { id:'r_mat5',     name:'✦ Huyền Thiết ×5',            price:750,  desc:'Nguyên liệu rèn & đột phá Đan Điền' },
    { id:'r_tula',     name:'◆ Tu La Tinh Thạch',          price:1800, desc:'Khảm trang bị, rèn +7 trở lên — hiếm có' },
    { id:'r_hon',      name:'❖ Hỗn Nguyên Thạch',          price:2600, desc:'Rèn +10/+11 — cực hiếm' },
  ]);
  const cycle = Math.floor(Date.now()/7200000);
  const rare = RARE_POOL[(cycle*7 + n.id.length*3) % RARE_POOL.length];
  const nextIn = 7200 - Math.floor((Date.now() % 7200000)/1000);
  html += `<div class="stat-sec">VẬT PHẨM QUÝ — đổi sau ${Math.floor(nextIn/60)}:${String(nextIn%60).padStart(2,'0')}</div>`;
  html += `<div class="npc-shop-row" style="border-color:rgba(176,138,232,.55)"><span><b style="color:#d8baff">${rare.name}</b><br>
    <span style="font-size:11px;opacity:.7">${rare.desc}</span></span>
    <button class="mini-btn" ${player.silver<rare.price?'disabled':''} onclick="buyFromShop('${rare.id}')">${rare.price}◈</button></div>`;
  if (shop.junk){
    const junk = player.inv.filter(it => !it.special && it.rarity <= 1);
    const junkVal = junk.reduce((s2,it)=>s2 + 20 + it.rarity*30 + (it.tier||1)*15, 0);
    html += `<div class="npc-shop-row"><span><b style="color:#9fd0ff">Bán hết đồ trắng/xanh (${junk.length} món)</b><br>
      <span style="font-size:11px;opacity:.7">Dọn túi nhanh — nhận bạc ngay</span></span>
      <button class="mini-btn" ${junk.length?'':'disabled'} onclick="sellJunk()">+${junkVal}◈</button></div>`;
  }
  // GDD Đợt 2 B6: thu mua lẻ đồ phẩm Lam trở lên — giá theo Lực chiến
  const _sellable = player.inv.map((it2, i2) => ({ it:it2, i:i2 })).filter(x => !x.it.special && x.it.rarity >= 2).slice(0, 6);
  if (_sellable.length){
    html += `<div class="stat-sec">THU MUA — đồ phẩm cao trong túi (bán 2 lần để xác nhận)</div>`;
    for (const x of _sellable){
      html += `<div class="npc-shop-row"><span><b class="${RARITIES[x.it.rarity].cls}">${x.it.name}</b><br>
        <span style="font-size:11px;opacity:.7">Lực chiến ${itemPower(x.it)}</span></span>
        <button class="mini-btn" onclick="sellItem(${x.i});renderShop(curShopNpc)">+${itemSellPrice(x.it)}◈</button></div>`;
    }
  }
  html += aiChatBlock(n.id);
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.buyFromShop = function(what){
  if (!curShopNpc) return;
  const shop = SHOPS[curShopNpc.id];
  const row = shop && (shop.rows.find(r => r.id === what) || (window.RARE_POOL || []).find(r => r.id === what));
  if (!row || player.silver < row.price) return;
  if (what==='thuoc'){
    if (player.potions >= 5){ addFloat(player.x, player.y-34, 'Túi thuốc đã đầy (tối đa 5 lọ)!', '#8a8a8a', 12); return; }
    player.silver -= row.price; player.potions++;
  }
  else if (what==='phu'){ player.silver -= row.price; player.charms++; }
  else if (what==='tiendan'){ player.silver -= row.price; player.tienDan += 3; }
  else if (what==='trithuong'){
    if (player.hp >= player.maxHp){ addFloat(player.x, player.y-34, 'Vẫn khỏe mạnh — không cần thuốc!', '#8a8a8a', 12); return; }
    player.silver -= row.price; player.hp = player.maxHp;
    addEffect({ type:'ring', x:player.x, y:player.y, r:60, color:'#6ae88a' });
  }
  else if (what==='tukhi'){
    if (player.qi >= player.maxQi){ addFloat(player.x, player.y-34, 'Chân khí đã sung mãn!', '#8a8a8a', 12); return; }
    player.silver -= row.price; player.qi = player.maxQi;
    addEffect({ type:'ring', x:player.x, y:player.y, r:60, color:'#7fd8e0' });
  }
  else if (what==='nghitro'){
    player.silver -= row.price; player.hp = player.maxHp; player.qi = player.maxQi;
    addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:'#f0d68a', big:true });
  }
  else if (what==='ruou'){
    player.silver -= row.price; player.buffAtkT = 180; calcDerived();
    zoneBanner = { text:'🍶 RƯỢU HỔ CỐT', sub:'3 phút +12% công lực — men say bừng bừng sát khí!', color:'#e8a04a', t:2.6 };
    AudioSys.sfx('quest', 0.5);
  }
  else if (what==='loidon'){
    player.silver -= row.price; player.loidonT = 300;
    zoneBanner = { text:'⚡ LÔI ĐỘN PHÙ', sub:'5 phút giảm 40% sát thương thiên lôi — cứ yên tâm độ kiếp!', color:'#e8c84a', t:2.6 };
    AudioSys.sfx('quest', 0.5);
  }
  else if (what==='dotpha'){
    player.silver -= row.price; player.dotpha = (player.dotpha || 0) + 1;
    addFloat(player.x, player.y-50, '+1 Đan Đột Phá — sẽ tự dùng khi độ kiếp', '#e8c84a', 13);
    AudioSys.sfx('quest', 0.5);
  }
  else if (what==='phongphu'){ player.silver -= row.price; player.phongphu = (player.phongphu || 0) + 1; addFloat(player.x, player.y-50, '+1 Phong Linh Phù — bấm T gần tinh anh suy yếu', '#b08ae8', 13); }
  else if (what==='r_tiendan5'){ player.silver -= row.price; player.tienDan += 5; }
  else if (what==='r_dotpha'){ player.silver -= row.price; player.dotpha = (player.dotpha || 0) + 1; addFloat(player.x, player.y-50, '+1 Đan Đột Phá', '#e8c84a', 13); }
  else if (what==='r_mat5'){ player.silver -= row.price; player.mat += 5; }
  else if (what==='r_tula'){ player.silver -= row.price; player.gems.tuLa++; }
  else if (what==='r_hon'){ player.silver -= row.price; player.gems.honNguyen++; }
  else if (what==='r_ruongvk2'){
    if (player.inv.length >= 30){ addFloat(player.x, player.y-34, 'Túi đồ đã đầy!', '#ff7a6a', 12); return; }
    player.silver -= row.price;
    let it = null;
    for (let i = 0; i < 40; i++){ const g2 = genItem(player.level, 0.25); if (g2.slot === 'vukhi'){ it = g2; break; } }
    if (!it) it = genItem(player.level, 0.25);
    player.inv.push(it);
    addFloat(player.x, player.y-50, `Nhận được ${it.name}!`, RARITIES[it.rarity].color, 13);
    AudioSys.sfx('quest', 0.5);
  }
  else if (what==='ruongvk' || what==='ruongpc'){
    if (player.inv.length >= 30){ addFloat(player.x, player.y-34, 'Túi đồ đã đầy!', '#ff7a6a', 12); return; }
    player.silver -= row.price;
    const wantWeapon = what === 'ruongvk';
    let it = null;
    for (let i = 0; i < 40; i++){
      const g2 = genItem(player.level, 0.08);
      if (wantWeapon ? g2.slot === 'vukhi' : ARMOR_SLOTS.includes(g2.slot)){ it = g2; break; }
    }
    if (!it) it = genItem(player.level, 0.08);
    player.inv.push(it);
    addFloat(player.x, player.y-50, `Nhận được ${it.name}!`, RARITIES[it.rarity].color, 13);
    AudioSys.sfx('quest', 0.5);
  }
  addFloat(player.x, player.y-34, 'Mua thành công!', '#f0d68a', 12);
  saveGame(); renderShop(curShopNpc);
};
window.sellJunk = function(){
  const keep = [], junk = [];
  for (const it of player.inv) (it.special || it.rarity > 1 ? keep : junk).push(it);
  if (!junk.length) return;
  const val = junk.reduce((s2,it)=>s2 + 20 + it.rarity*30 + (it.tier||1)*15, 0);
  player.inv = keep; player.silver += val;
  addFloat(player.x, player.y-34, `Bán ${junk.length} món +${val}◈`, '#f0d68a', 13);
  saveGame(); if (curShopNpc) renderShop(curShopNpc);
};

// ═══════════ LÒ BÁT QUÁI — Phá Thiên Kiếp (+9 → +11) ═══════════
// GDD: chỉ Tông Sư Thợ Rèn tại Lò Bát Quái (Tương Dương Thành) mới rèn được +10/+11.
// +10 = 50%, +11 = 45%. Thất bại → trang bị VỠ NÁT (Thiên Mệnh Phù bảo hộ).
function renderBaGua(){
  let html = `<h3>☰ Lò Bát Quái — Tông Sư Thợ Rèn</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">"Lò này nung bằng <b style="color:#e8b04a">Tứ Hải Càn Khôn</b> — chỉ trang bị <b style="color:#e8b04a">+9</b> mới đủ tư cách bước vào <b style="color:#ff7a6a">Phá Thiên Kiếp</b>. Nhớ kỹ: <b style="color:#ff7a6a">thất bại là thần binh vỡ nát</b>, trừ khi có Thiên Mệnh Phù bảo mệnh."</div>`;
  html += `<div style="font-size:12px;color:#b8a878;line-height:1.7">◈ <b>${player.silver}</b> · ✦ Huyền Thiết <b style="color:#9fd0ff">${player.mat}</b> · ◆ Tu La <b style="color:#e84a6a">${player.gems.tuLa}</b> · ❖ Hỗn Nguyên <b style="color:#b08ae8">${player.gems.honNguyen}</b> · ☂ Phù <b style="color:#f0d68a">${player.charms}</b></div>`;
  const all = [];
  for (const s in player.equip) if (player.equip[s] && !player.equip[s].noForge && player.equip[s].plus >= 9 && player.equip[s].plus < 11) all.push({ it:player.equip[s], where:'equip', key:s });
  player.inv.forEach((it,i)=>{ if (!it.noForge && it.plus >= 9 && it.plus < 11) all.push({ it, where:'inv', key:i }); });
  if (!all.length){
    html += `<div style="padding:14px;font-size:12.5px;line-height:1.7;opacity:.75">Ngươi chưa có trang bị nào đạt <b style="color:#e8b04a">+9</b>.<br>Hãy tự rèn và đập ngọc đến +9 rồi quay lại đây.</div>`;
  } else {
    for (const e of all){
      const it = e.it;
      const target = it.plus + 1;
      const rule = forgeRule(target);
      const rate = Math.min(100, rule.rate + (player.forgeBonus||0));
      const costS = (20 + it.plus*15) * (it.tier || 1); // Drop v2.0: phí rèn theo giai
      const canPay = player.silver>=costS && player.mat>=rule.mat && player.gems.tuLa>=rule.tuLa && player.gems.honNguyen>=rule.hon;
      html += `<div class="bagua-item">
        <div class="bagua-item-info"><b class="${RARITIES[it.rarity].cls}">${it.name} +${it.plus}</b>
          <span style="opacity:.55;font-size:11px"> (${e.where==='equip'?'đang mặc':'túi'})</span><br>
          <span style="font-size:11px;opacity:.8">Phá Thiên Kiếp <b style="color:#e8b04a">+${target}</b> — tỉ lệ <b style="color:${rate>=50?'#f0d68a':'#ff9a6a'}">${rate}%</b> · ${costS}◈ + ${rule.mat}✦ + ${rule.tuLa}◆ + ${rule.hon}❖</span></div>
        <button class="mini-btn" ${canPay?'':'disabled'} onclick="doBaGua('${it.uid}')">☰ Đột Phá<br>+${target}</button></div>`;
    }
    html += `<label style="display:block;font-size:12px;margin:8px 0;color:#f0d68a;cursor:pointer">
      <input type="checkbox" ${forgeUseCharm?'checked':''} onchange="forgeUseCharm=this.checked" ${player.charms>0?'':'disabled'}>
      Dùng Thiên Mệnh Phù — thất bại KHÔNG bị vỡ trang bị (còn ${player.charms})</label>
      <div style="font-size:11px;opacity:.7;line-height:1.6">+10 thức tỉnh thuộc tính ẩn · +11 Khai Quang <b style="color:#9fd0ff">Thiên Lôi Cương Khí</b> (sét xanh bao quanh thân)</div>`;
  }
  // ── Hỗn Độn Lò: Linh Dực & đổi Cổ Thần (Track HT — GDD §13) ──
  const J2 = player.jewels || { honDon:0 };
  html += `<div class="stat-sec" style="border-color:rgba(240,214,138,.5)">◈ HỖN ĐỘN LÒ — ● Hỗn Độn Châu: <b style="color:#f0d68a">${J2.honDon}</b></div>`;
  const wing1 = player.equip.canh || player.inv.find(x=>x.slot==='canh');
  if (player.level >= 40){
    const fodder = [];
    for (const s3 in player.equip){ const t2 = player.equip[s3]; if (t2 && t2.perfect && t2.plus >= 4 && !t2.noForge) fodder.push(t2); }
    player.inv.forEach(t2=>{ if (t2.perfect && t2.plus >= 4 && !t2.noForge) fodder.push(t2); });
    const canW1 = J2.honDon >= 1 && fodder.length > 0 && player.gems.honNguyen >= 10 && player.silver >= 5000;
    html += `<div class="next-tier"><b style="color:#9fd0ff">Linh Dực Cấp 1</b> (LV40+) — Thiên Thần / Tiểu Quỷ ngẫu nhiên<br>
      <span style="font-size:11.5px;opacity:.8">Phí: 1 ● Hỗn Độn + 1 trang bị Hoàn Hảo +4 hiến tế (${fodder.length ? fodder[0].name+' +'+fodder[0].plus : 'chưa có'}) + 10❖ + 5000◈</span></div>
      <div class="forge-actions"><button class="mini-btn" ${canW1?'':'disabled'} onclick="craftWing(1)">Luyện Linh Dực</button></div>`;
  }
  if (player.level >= 80 && wing1 && !wing1.wing2){
    const canW2 = J2.honDon >= 1 && player.gems.honNguyen >= 20 && player.silver >= 10000;
    html += `<div class="next-tier"><b style="color:#d8baff">Linh Dực Cấp 2</b> (LV80+) — Phượng Dực / Hắc Ma Dực, thăng từ cánh đang có<br>
      <span style="font-size:11.5px;opacity:.8">Phí: 1 ● Hỗn Độn + cánh cấp 1 hiện tại + 20❖ + 10000◈</span></div>
      <div class="forge-actions"><button class="mini-btn" ${canW2?'':'disabled'} onclick="craftWing(2)">Thăng Linh Dực 2</button></div>`;
  }
  // Đổi Cổ Thần: 3 món trùng + 1 Hỗn Độn = 1 món TỰ CHỌN (con đường song song thay pity)
  const ancients = player.inv.filter(x=>x.ancient);
  html += `<div class="next-tier" style="border-color:rgba(58,200,138,.5)"><b style="color:#3ac88a">Đổi Cổ Thần — Tứ Tượng tự chọn</b><br>
    <span style="font-size:11.5px;opacity:.8">Hiến tế 3 món Cổ Thần trong túi + 1 ● Hỗn Độn Châu → nhận 1 món Cổ Thần theo ý muốn.</span></div>`;
  if (ancients.length){
    const selN = Object.keys(window._hdSel || {}).length;
    html += `<div style="font-size:11.5px;margin:4px 0;opacity:.85">Chọn 3 món hiến tế (${selN}/3):</div>`;
    ancients.forEach(a=>{
      const on = window._hdSel && window._hdSel[a.uid];
      html += `<div class="slot-row" style="${on?'border-color:#3ac88a;background:rgba(58,200,138,.12)':''}" onclick="hdToggle(${a.uid})">
        <span class="s-name"><span style="color:${ANCIENT_SETS[a.ancient].color}">◈ ${a.name}${a.plus?' +'+a.plus:''}</span></span></div>`;
    });
    const selCss = 'background:#2a2418;color:#e8d9b0;border:1px solid #7a6a4a;border-radius:4px;padding:4px;font-size:12px';
    html += `<div class="forge-actions" style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
      <select onchange="window._hdSet=this.value" style="${selCss}">` +
      Object.keys(ANCIENT_SETS).map(k=>`<option value="${k}" ${window._hdSet===k?'selected':''}>${ANCIENT_SETS[k].name}</option>`).join('') + `</select>
      <select onchange="window._hdSlot=this.value" style="${selCss}">` +
      ARMOR_SLOTS.map(sl=>{ const sd = SLOTS.find(x=>x.id===sl); return `<option value="${sl}" ${window._hdSlot===sl?'selected':''}>${sd ? sd.name : sl}</option>`; }).join('') + `</select></div>`;
    const canEx = J2.honDon >= 1 && selN === 3 && player.inv.length < 30;
    html += `<div class="forge-actions"><button class="mini-btn" ${canEx?'':'disabled'} onclick="hdExchange()">◈ Đổi Lấy Cổ Thần</button></div>`;
  } else {
    html += `<div style="font-size:11.5px;opacity:.6;padding:4px">Chưa có món Cổ Thần nào trong túi — săn Ma Tôn lấy Bảo Hạp IV trở lên (tỉ lệ 5-8%, không pity).</div>`;
  }
  html += `<div id="bagua-msg" style="min-height:18px;font-size:12.5px;margin-top:6px"></div>`;
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.doBaGua = function(uid){
  let entry = null;
  for (const s in player.equip) if (player.equip[s] && player.equip[s].uid === uid) entry = { it:player.equip[s], where:'equip', key:s };
  if (!entry) player.inv.forEach((it,i)=>{ if (it.uid === uid) entry = { it, where:'inv', key:i }; });
  if (!entry) return;
  const it = entry.it;
  if (it.plus < 9 || it.plus >= 11) return;
  const target = it.plus + 1;
  const rule = forgeRule(target);
  const rate = Math.min(100, rule.rate + (player.forgeBonus||0));
  const costS = (20 + it.plus*15) * (it.tier || 1); // Drop v2.0: phí rèn theo giai
  if (player.silver < costS || player.mat < rule.mat || player.gems.tuLa < rule.tuLa || player.gems.honNguyen < rule.hon) return;
  const useCharm = forgeUseCharm && player.charms > 0;
  player.silver -= costS; player.mat -= rule.mat;
  player.gems.tuLa -= rule.tuLa; player.gems.honNguyen -= rule.hon;
  const msg = document.getElementById('bagua-msg');
  if (Math.random()*100 < rate){
    it.plus++;
    AudioSys.sfx('forge_ok', 0.9);
    if (msg){ msg.textContent = `✔ Phá Thiên Kiếp thành công! ${it.name} +${it.plus}`; msg.style.color = '#8fd18f'; }
    addFloat(player.x, player.y-40, `☰ PHÁ THIÊN KIẾP +${it.plus}!`, '#e8b04a', 15);
    addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#e8b04a', big:true });
    addEffect({ type:'ring', x:player.x, y:player.y, r:70, color:'#9fd0ff' });
    if (it.plus === 10) addFloat(player.x, player.y-58, `☆ Thức tỉnh: ${it.awakened.name}`, '#f39c3d', 13);
    if (it.plus === 11){
      player.forged11 = true;
      addFloat(player.x, player.y-76, '☀ KHAI QUANG +11 — Thiên Lôi Cương Khí!', '#ffd76a', 16);
      addEffect({ type:'ring', x:player.x, y:player.y, r:150, color:'#7fd0ff', big:true });
      addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#ffd76a', big:true });
    }
    checkTitles(); updateHud();
  } else if (useCharm){
    player.charms--;
    if (msg){ msg.textContent = `☂ Thiên Mệnh Phù đã bảo hộ — ${it.name} giữ nguyên +${it.plus}`; msg.style.color = '#f0d68a'; }
    addFloat(player.x, player.y-40, '☂ Thiên Mệnh Phù bảo hộ!', '#f0d68a', 13);
  } else {
    // GDD: thất bại → HỦY DIỆT trang bị
    AudioSys.sfx('forge_fail', 0.9);
    if (entry.where === 'equip') player.equip[entry.key] = null;
    else player.inv.splice(entry.key, 1);
    if (msg){ msg.textContent = `✘ Hỏa hầu chưa đạt — ${it.name} đã VỠ NÁT!`; msg.style.color = '#ff5a4a'; }
    addFloat(player.x, player.y-40, '✘ HỎA HẦU CHƯA ĐẠT — THẦN BINH VỠ NÁT!', '#ff5a4a', 15);
    addFloat(player.x, player.y-60, `${it.name} +${it.plus} đã hóa thành tro bụi...`, '#ff7a6a', 12);
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:'#ff5a4a', big:true });
    updateHud();
  }
  saveGame();
  renderBaGua();
};

// ═══════════ VŨ KHÍ DANH PHÁI — mỗi môn phái một binh khí riêng ═══════════
const SECT_WEAPONS = { thieulam:'con', toanchan:'kiem', comoc:'songhoan', baidasan:'xatruong', minhgiao:'daidao', doanthi:'quat', daohoa:'ngoctieu' };
function drawSectWeapon(p, sect){
  const kind = SECT_WEAPONS[p.sect] || 'kiem';
  const k = p.atkAnim > 0 ? p.atkAnim/0.22 : 0;          // 1 → 0 khi chém
  const swing = k > 0 ? (1-k)*2.5 : 0;                    // quạt mạnh theo đòn đánh
  const castK = (p.castT || 0) / 0.38;
  const idleSway = Math.sin(p.walkPh || 0) * (p.moving ? 0.16 : 0.06);
  const wph = p.walkPh || 0;
  const bob = p.moving ? Math.abs(Math.sin(wph))*3.2 : Math.sin(wph)*1.2;
  const hx = p.x + Math.cos(p.face)*5;
  const hy = p.y - 20 - bob + Math.sin(p.face)*3;
  const ang = p.face + 1.05 - swing + idleSway - castK*0.8; // nghỉ: xếch xuống · chiêu: giơ cao
  const wpn = p.equip && p.equip.vukhi;
  const glowBoost = wpn && wpn.plus >= 9 ? (wpn.plus >= 11 ? 2 : 1.4) : 1;
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
  ctx.lineCap = 'round';
  // hào quang quanh vũ khí theo màu phái
  ctx.shadowColor = sect.glow; ctx.shadowBlur = 4*glowBoost + castK*10;
  if (kind === 'con'){ // Thiếu Lâm — côn
    ctx.strokeStyle = '#7a5a30'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.strokeStyle = sect.color; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-10, 0); ctx.moveTo(26, 0); ctx.lineTo(30, 0); ctx.stroke();
  } else if (kind === 'kiem'){ // Toàn Chân — thanh kiếm
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-2, 0); ctx.stroke(); // chuôi
    ctx.strokeStyle = sect.color; ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(-3.5, -3.4); ctx.lineTo(-3.5, 3.4); ctx.stroke(); // chẩn
    const bl = ctx.createLinearGradient(0, 0, 32, 0);
    bl.addColorStop(0, '#d8e8e8'); bl.addColorStop(1, '#f8ffff');
    ctx.strokeStyle = bl; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.strokeStyle = sect.glow; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(2, -1.2); ctx.lineTo(28, -1.2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 'songhoan'){ // Cổ Mộ — song hoàn
    for (const off of [-5, 5]){
      ctx.strokeStyle = sect.color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(14, off, 7, 0, 7); ctx.stroke();
      ctx.strokeStyle = sect.glow; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(14, off, 5, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  } else if (kind === 'xatruong'){ // Bạch Đà Sơn — xà trượng
    ctx.strokeStyle = '#3a3028'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.quadraticCurveTo(10, 1.5, 26, 0); ctx.stroke();
    ctx.strokeStyle = sect.color; ctx.lineWidth = 2.6; // đầu rắn cuộn
    ctx.beginPath(); ctx.arc(27, -1, 4.5, -2.4, 2.2); ctx.stroke();
    ctx.fillStyle = '#c8ffa0';
    ctx.beginPath(); ctx.arc(28.5, -3.4, 1.2, 0, 7); ctx.fill(); // mắt rắn
  } else if (kind === 'daidao'){ // Minh Giáo — đại đao
    ctx.strokeStyle = '#6a2a1a'; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(2, 0); ctx.stroke(); // cán đỏ
    ctx.fillStyle = '#d8d8e0';
    ctx.beginPath(); // lưỡi đao cong lớn
    ctx.moveTo(2, -2.5); ctx.quadraticCurveTo(22, -7, 32, -3);
    ctx.quadraticCurveTo(26, 2.5, 4, 2.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = sect.glow; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(4, -2.8); ctx.quadraticCurveTo(22, -7.2, 31, -3.2); ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 'quat'){ // Đoàn Thị — thiết quạt
    ctx.fillStyle = sect.color; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, -0.62, 0.62); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = sect.glow; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++){
      const a = i*0.28;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a)*15, Math.sin(a)*15); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 16, -0.62, 0.62); ctx.stroke();
  } else { // Đào Hoa — ngọc tiêu
    const fl = ctx.createLinearGradient(0, 0, 24, 0);
    fl.addColorStop(0, '#7ec8a0'); fl.addColorStop(1, '#c8f0d8');
    ctx.strokeStyle = fl; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(22, 0); ctx.stroke();
    ctx.fillStyle = '#3a7a58';
    for (let i = 0; i < 4; i++){ ctx.beginPath(); ctx.arc(2 + i*5, 0, 1.1, 0, 7); ctx.fill(); }
    ctx.strokeStyle = sect.color; ctx.lineWidth = 1.6; // tua hồng
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-9, 4, -8, 8 + Math.sin(wph)*1.5); ctx.stroke();
  }
  // tuyệt chiêu: vệt sáng chói dọc binh khí
  if (castK > 0){
    ctx.globalAlpha = castK; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 0); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ═══════════ HÀO QUANG TUYỆT HỌC MAX TẦNG (Ám Khí 7 · Cung Tiễn 7) ═══════════
function drawMaxTuyetHocAura(p){
  const t = performance.now()/1000;
  const akTier = (p.amkhiX && p.amkhiX.tier) || 0;
  const bowTier = (p.bow && p.bow.tier) || 0;
  // Ám Khí tầng 7 — Bạo Vũ Lê Hoa: 7 lưỡi phi đao vàng bay quanh thân
  if (akTier >= 7){
    const n = 7;
    for (let i = 0; i < n; i++){
      const a = t*1.7 + i*(Math.PI*2/n);
      const rx = 48 + Math.sin(t*2.3 + i)*5, ry = 15 + Math.cos(t*1.9 + i)*2.5;
      const bx = p.x + Math.cos(a)*rx, by = p.y - 16 + Math.sin(a)*ry;
      const depth = Math.sin(a); // lưỡi phía sau mờ hơn
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(a + Math.PI/2);
      ctx.globalAlpha = depth < -0.2 ? 0.55 : 1;
      ctx.shadowColor = '#f0d68a'; ctx.shadowBlur = 10;
      const bg = ctx.createLinearGradient(-6, 0, 6, 0);
      bg.addColorStop(0, '#fff4cc'); bg.addColorStop(0.5, '#f0d68a'); bg.addColorStop(1, '#c9982e');
      ctx.fillStyle = bg;
      ctx.beginPath(); // lưỡi phi đao hình thoi
      ctx.moveTo(0, -8); ctx.lineTo(3.2, 0); ctx.lineTo(0, 8); ctx.lineTo(-3.2, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // quỹ đạo lửa vàng mờ
    ctx.save(); ctx.globalAlpha = 0.3 + 0.1*Math.sin(t*3);
    ctx.strokeStyle = '#f0d68a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y-16, 48, 15, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // Cung Tiễn tầng 7 — Thần Nỏ Quang: quầng sáng + 3 mũi tên sáng lượn trên đỉnh đầu
  if (bowTier >= 7){
    const bt = BOW_TIERS[7];
    // quầng hào quang
    ctx.save();
    const pulse = 0.3 + 0.14*Math.sin(t*2.6);
    ctx.globalAlpha = pulse;
    const gg = ctx.createRadialGradient(p.x, p.y-24, 4, p.x, p.y-24, 44);
    gg.addColorStop(0, bt.color); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(p.x, p.y-24, 44, 0, 7); ctx.fill();
    ctx.restore();
    // 3 mũi tên sáng bay vòng trên đỉnh đầu
    for (let i = 0; i < 3; i++){
      const a = -t*1.3 + i*(Math.PI*2/3);
      const ax = p.x + Math.cos(a)*22, ay = p.y - 48 + Math.sin(a)*6;
      ctx.save();
      ctx.translate(ax, ay); ctx.rotate(a + Math.PI);
      ctx.globalAlpha = 0.9; ctx.shadowColor = bt.color; ctx.shadowBlur = 7;
      ctx.strokeStyle = '#fff8e0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
      ctx.fillStyle = bt.color;
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.6); ctx.lineTo(3, 2.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // tia sáng xung từ linh cung sau lưng
    ctx.save(); ctx.globalAlpha = 0.5 + 0.2*Math.sin(t*4);
    ctx.strokeStyle = bt.color; ctx.lineWidth = 1.4;
    const backAng = p.face + Math.PI;
    const bx2 = p.x + Math.cos(backAng)*16, by2 = p.y - 22 + Math.sin(backAng)*7;
    for (let i = 0; i < 5; i++){
      const ra = backAng - 0.9 + i*0.45;
      ctx.beginPath(); ctx.moveTo(bx2, by2);
      ctx.lineTo(bx2 + Math.cos(ra)*(18 + Math.sin(t*5+i)*4), by2 + Math.sin(ra)*(18 + Math.sin(t*5+i)*4));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ═══════════ CỐT TRUYỆN DẪN NHẬP — trước khi chọn môn phái ═══════════
const INTRO_PAGES = [
  `<span class="is-title">GIANG HỒ HUYỄN ẢNH</span>
<i>Nam Tống niên hiệu Thiệu Hưng — thiên hạ đại loạn.</i>

Quân Mông Cổ từ thảo nguyên phương Bắc kéo xuống như vũ bão, vây chặt <b>Tương Dương Thành</b> — cánh cửa cuối cùng của Trung Nguyên.

Giang hồ chấn động. Ngũ Tuyệt tàn lụi, anh hùng các phái đổ về Tương Dương nghĩa cử cao đẹp... hoặc ẩn mình chờ thời.`,
  `<span class="is-title">THƠI VẬN CỦA NGƯƠI</span>
Ngươi — một thiếu niên mồ côi — được <b>Trưởng Làng Thanh Ngưu</b> nuôi dưỡng ở <b>Đào Hoa Đảo</b>, hòn đảo hoa đào nở quanh năm giữa biển Đông.

Đêm qua, đạo tặc <b>Hắc Phong Sát</b> đã đổ bộ lên đảo, cướp phá làng chài...

Buổi sáng nay, lão nhân giao cho ngươi một thanh kiếm cũ:
<i>"Con à... giang hồ này, sớm muộn cũng cần người đứng ra. Hãy đến <b>Tương Dương</b> bái kiến <b>Quách Đại Hiệp</b> — và bước đi."</i>`,
  `<span class="is-title">THẤT ĐẠI MÔN PHÁI</span>
Bảy môn phái lớn đang chiêu mộ đệ tử:

<b>Thiếu Lâm</b> 金 · <b>Toàn Chân</b> 水 · <b>Cổ Mộ</b> 木 · <b>Bạch Đà Sơn</b> 水 · <b>Minh Giáo</b> 火 · <b>Đoàn Thị</b> 土 · <b>Đào Hoa</b> 木

Mỗi phái một hệ <b>Ngũ Hành</b> — khắc hệ sẽ gây thêm <b>+20% sát thương</b> lên quái bị khắc.

Ngươi sẽ khởi đầu làm <b>Tán Nhân</b> tự do — tới <b>cấp 10</b> đủ danh tiếng, 7 môn phái sẽ mở cửa cho ngươi bái sư.

Con đường võ học: <b>Rèn trang bị +11</b> · <b>Đan Điền 9 cảnh giới</b> · <b>8 Kinh Mạch</b> · <b>Tuyệt Học 7 tầng</b> — và cuối cùng, <b>Tương Dương Đệ Nhất Hiệp</b>.`,
  `<span class="is-title">HÀNH TRÌNH BẮT ĐẦU</span>
<i>"Từ Đào Hoa Đảo, qua Chung Nam Sơn, vào Cổ Mộ, lên Tuyệt Tình Cốc, ra Mông Cổ Đại Doanh... cho tới Nhạn Môn Quan đẫm máu."</i>

Phía trước là <b>100 cấp tu luyện</b>, vạn quân thảo phạt, và danh hiệp cao nhất giang hồ.

Từ thành Tương Dương, bước vào <b>Giang Hồ Huyễn Ảnh.</b>`,
];
let introPage = 0;
function showIntro(){
  introPage = 0;
  el('intro-story').classList.remove('hidden');
  el('sect-select').classList.add('hidden');
  AudioSys.playBgm(BGM_INTRO); // tân thủ mở game — giai điệu hoài niệm dẫn vào cốt truyện
  renderIntroPage();
}
function renderIntroPage(){
  const pg = el('is-page');
  pg.innerHTML = INTRO_PAGES[introPage];
  pg.style.animation = 'none'; void pg.offsetWidth; pg.style.animation = ''; // restart fade
  el('is-next').textContent = introPage >= INTRO_PAGES.length - 1 ? '⚔ Bắt Đầu Hành Trình' : 'Tiếp ▸';
}
function closeIntro(){
  el('intro-story').classList.add('hidden');
  openQuze('vophai'); // người mới: vào thẳng Quẻ Tiên Thiên, khởi đầu làm Tán Nhân — cấp 10 mới bái sư
}
el('is-next').addEventListener('click', ()=>{
  if (introPage < INTRO_PAGES.length - 1){ introPage++; renderIntroPage(); }
  else closeIntro();
});
el('is-skip').addEventListener('click', closeIntro);

// ═══════════ HƯỚNG DẪN TÂN THỦ TỪNG BƯỚC ═══════════
const TUT_STEPS = [
  { key:'move',  txt:'<b>W A S D</b> hoặc phím mũi tên để di chuyển — hãy đi một đoạn', },
  { key:'npc',   txt:'Đến gần <b>Quách Đại Hiệp</b> giữa thành và nhấn <b>E</b> để trò chuyện, nhận nhiệm vụ đầu tiên' },
  { key:'map',   txt:'Nhấn <b>M</b> mở bản đồ → <b>Dịch Chuyển</b> tới <b>Đào Hoa Đảo</b> để săn quái' },
  { key:'kill',  txt:'Nhấn <b>SPACE</b> để đánh quái gần nhất — hãy hạ 1 con <b>Dã Trư</b>' },
  { key:'quest', txt:'Làm theo nhiệm vụ ở <b>góc phải màn hình</b> · <b>C</b> nhân vật · <b>K</b> kỹ năng · <b>B</b> túi đồ' },
];
function updateTut(){
  const box = el('tut-hint');
  if (!box) return;
  const cur = (!player || player.tutStep == null || player.tutStep < 0 || player.tutStep >= TUT_STEPS.length) ? -99 : player.tutStep;
  // ẩn hướng dẫn khi đang mở bảng — tránh đè nội dung
  const anyPanel = ['panel-char','panel-inv','panel-bag','panel-skill','panel-map','panel-quest','panel-settings','panel-qlog'].some(id => { const e2 = document.getElementById(id); return e2 && !e2.classList.contains('hidden'); });
  const key = cur * 10 + (anyPanel ? 1 : 0);
  if (window._tutShown === key) return; // chỉ vẽ lại khi đổi bước/trạng thái — tránh reset nút ✕
  window._tutShown = key;
  if (cur === -99 || anyPanel){ box.classList.add('hidden'); return; }
  const s = TUT_STEPS[cur];
  box.innerHTML = `<span class="tut-step">HƯỚNG DẪN ${cur+1}/${TUT_STEPS.length}</span>
    <span class="tut-x" onclick="player.tutStep=-1; window._tutShown=-99; updateTut()">Đã biết ✕</span>${s.txt}`;
  box.classList.remove('hidden');
}
function tutAdvance(stepKey){
  if (!player || player.tutStep < 0) return;
  if (TUT_STEPS[player.tutStep].key === stepKey){
    player.tutStep++;
    if (player.tutStep >= TUT_STEPS.length){
      player.tutStep = -1;
      addFloat(player.x, player.y-70, 'Hướng dẫn hoàn tất — chúc hiệp khách phi nước đại!', '#f0d68a', 14);
    }
    updateTut(); saveGame();
  }
}

// ═══════════ THẦN HIỆP — trạng thái mọi hệ thống tối đa ═══════════
function isMaxed(p){
  return p.level >= MAX_LV
    && p.dantian && p.dantian.realm >= DANTIAN_REALMS.length - 1
    && p.mount && p.mount.tier >= MOUNT_TIERS.length - 1
    && p.amkhiX && p.amkhiX.tier >= AMKHI_TIERS.length - 1
    && p.bow && p.bow.tier >= BOW_TIERS.length - 1
    && p.gangkhi && p.gangkhi.tier >= GANGKHI_TIERS.length - 1;
}
// Ấn pháp ấn vàng xoay dưới chân + trụ quang hoa — vẽ ở lớp đất, trước thú cưỡi
function drawThanHiepSeal(p, now){
  const t = now/1000;
  ctx.save();
  // trụ ánh sáng vàng từ trời đổ xuống
  const beam = ctx.createLinearGradient(p.x, p.y - 210, p.x, p.y + 6);
  beam.addColorStop(0, 'rgba(255,224,138,0)');
  beam.addColorStop(0.75, 'rgba(255,224,138,.14)');
  beam.addColorStop(1, 'rgba(255,224,138,.30)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(p.x - 20, p.y + 4); ctx.lineTo(p.x - 40, p.y - 210);
  ctx.lineTo(p.x + 40, p.y - 210); ctx.lineTo(p.x + 20, p.y + 4);
  ctx.closePath(); ctx.fill();
  // đế ấn: hào quang nền
  const base = ctx.createRadialGradient(p.x, p.y + 5, 4, p.x, p.y + 5, 64);
  base.addColorStop(0, 'rgba(255,224,138,.30)'); base.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 5, 64, 22, 0, 0, 7); ctx.fill();
  // vòng ngoài: nét đứt xoay thuận
  ctx.strokeStyle = '#ffd76a'; ctx.globalAlpha = 0.6 + 0.15*Math.sin(t*2.2);
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t*38; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 5, 58, 20, 0, 0, 7); ctx.stroke();
  // vòng trong: nét đứt xoay nghịch
  ctx.globalAlpha = 0.5; ctx.lineDashOffset = t*30; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 5, 42, 14, 0, 0, 7); ctx.stroke();
  ctx.setLineDash([]);
  // bát quái quanh ấn
  const glyphs = ['乾','兌','離','震','巽','坎','艮','坤'];
  ctx.font = 'bold 10px "Playfair Display", "Noto Serif", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 8; i++){
    const a = t*0.55 + i*(Math.PI/4);
    const gx = p.x + Math.cos(a)*50, gy = p.y + 5 + Math.sin(a)*17;
    ctx.globalAlpha = 0.55 + 0.3*Math.sin(t*3 + i);
    ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(glyphs[i], gx, gy);
  }
  ctx.shadowBlur = 0;
  // tia sáng tách lên
  if (!SETTINGS.lowFx) for (let i = 0; i < 4; i++){
    const sp = (t*0.5 + i*0.25) % 1;
    const sy = p.y + 4 - sp*150;
    const sx = p.x + Math.sin(t*1.4 + i*2.2)*12;
    ctx.globalAlpha = (1 - sp)*0.55;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 3.5);
    sg.addColorStop(0, '#fff8d8'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// ── Danh hiệu hiển thị trên đỉnh đầu nhân vật ──
function drawOverheadTitle(p, yOff, riding, maxed){
  const tdef = p.titles && p.titles.equipped && TITLES.find(t => t.id === p.titles.equipped);
  if (!tdef) return;
  const ty = p.y + yOff - (riding ? 92 : 88);
  ctx.save();
  ctx.font = 'bold 12px "Playfair Display", "Noto Serif", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = `【${tdef.name}】`;
  const tw = ctx.measureText(label).width;
  // nền trầm + viền màu danh hiệu
  ctx.fillStyle = 'rgba(8,6,4,.48)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(p.x - tw/2 - 8, ty - 10, tw + 16, 18, 9);
  else ctx.rect(p.x - tw/2 - 8, ty - 10, tw + 16, 18);
  ctx.fill();
  ctx.globalAlpha = 0.8; ctx.strokeStyle = tdef.color; ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowColor = tdef.color; ctx.shadowBlur = maxed ? 12 : 8;
  ctx.fillStyle = tdef.color;
  ctx.fillText(label, p.x, ty + 1);
  ctx.restore();
}

// ---------- Minimap ----------
function drawMinimap(){
  if (!miniCtx || !miniCvs) return;
  miniCvs.style.display = SETTINGS.minimap ? 'block' : 'none';
  const btnMini = el('btn-minimap');
  if (btnMini) btnMini.classList.toggle('off', !SETTINGS.minimap);
  if (!SETTINGS.minimap) return;
  const mw = miniCvs.width, mh = miniCvs.height;
  const sx = mw / MAP.w, sy = mh / MAP.h;
  const md = mapDef();
  const mc = miniCtx;
  // nền: ưu tiên ảnh map vẽ tay (thu nhỏ + phủ tối 40%), fallback màu đất phẳng
  const _bg = MAP_BG[curMap];
  if (_bg && _bg.complete && _bg.naturalWidth > 0){
    mc.drawImage(_bg, 0, 0, mw, mh);
    mc.fillStyle = 'rgba(22,18,12,.40)';
    mc.fillRect(0, 0, mw, mh);
  } else {
    mc.fillStyle = md.ground || '#d8ccb0';
    mc.fillRect(0, 0, mw, mh);
    mc.fillStyle = 'rgba(22,18,12,.30)';
    mc.fillRect(0, 0, mw, mh);
  }
  // vòng đai cấp đồng tâm từ cửa vào map (xanh lá/vàng/đỏ)
  if (md.packs && md.packs.length && md.spawn){
    let _maxD = 1;
    for (const pk of md.packs){ const d = dist(pk.x, pk.y, md.spawn.x, md.spawn.y); if (d > _maxD) _maxD = d; }
    const _radii = [0.45*_maxD, 0.8*_maxD, _maxD];
    for (let b = 0; b < 3; b++){
      mc.beginPath(); mc.arc(md.spawn.x*sx, md.spawn.y*sy, _radii[b]*sx, 0, 7);
      mc.strokeStyle = BAND_COLORS[b]; mc.globalAlpha = 0.32; mc.lineWidth = 1.4; mc.stroke();
      mc.globalAlpha = 1;
    }
    // chú thích cấp đai ở mép vòng
    mc.font = '7px "Be Vietnam Pro", sans-serif'; mc.textAlign = 'center';
    for (let b = 0; b < 3; b++){
      mc.fillStyle = BAND_COLORS[b]; mc.globalAlpha = 0.9;
      mc.fillText(bandLvText(md, b), (md.spawn.x + _radii[b]*0.72)*sx, (md.spawn.y - _radii[b]*0.72)*sy);
      mc.globalAlpha = 1;
    }
  }
  // Tiên Tuyền
  if (md.spring){
    mc.fillStyle = '#7fd8e0';
    mc.beginPath(); mc.arc(SPRING.x*sx, SPRING.y*sy, 3, 0, 7); mc.fill();
  }
  // điểm thảo dược — hiện mặc định trên mọi map có thuốc (không cần Quẻ Thiên Nhãn)
  if (md.herbs){
    mc.fillStyle = '#6ae88a';
    for (const h of HERB_SPOTS){ mc.beginPath(); mc.arc(h.x*sx, h.y*sy, 1.8, 0, 7); mc.fill(); }
  }
  // Tường thành + cổng thành
  if (curMap === CITY_WALL.map){
    mc.strokeStyle = 'rgba(168,118,58,.85)'; mc.lineWidth = 1.5;
    mc.strokeRect(CITY_WALL.x1*sx, CITY_WALL.y1*sy, (CITY_WALL.x2-CITY_WALL.x1)*sx, (CITY_WALL.y2-CITY_WALL.y1)*sy);
  }
  for (const g of GATES){
    if (g.map !== curMap) continue;
    mc.fillStyle = g.portal ? '#b08ae8' : '#d8963a';
    mc.fillRect(g.x*sx-3, g.y*sy-3, 6, 6);
    mc.strokeStyle = 'rgba(0,0,0,.6)'; mc.lineWidth = 1;
    mc.strokeRect(g.x*sx-3, g.y*sy-3, 6, 6);
  }
  // NPC — chấm vàng viền trắng + tên + dấu nhiệm vụ (! vàng = trả được, … xanh = có NV)
  const qNow = (typeof currentQuest === 'function') ? currentQuest() : null;
  const mapNpcs = NPCS.filter(n => n.map === curMap);
  const placedLabels = []; // chống chồng nhãn khi NPC đứng gần nhau
  for (const n of mapNpcs){
    const nx = n.x*sx, ny = n.y*sy;
    // dấu nhiệm vụ (đồng bộ logic với drawNpc)
    let mark = '';
    if (n.talk === 'quest'){
      if ((qNow && qNow.npc === n.id && questState === 'done') ||
          (typeof SIDE_QUESTS !== 'undefined' && SIDE_QUESTS.some(sq => sq.npc === n.id && sideStates[sq.id] && sideStates[sq.id].st === 'done')))
        mark = '!';
      else if ((qNow && qNow.npc === n.id) ||
               (typeof SIDE_QUESTS !== 'undefined' && SIDE_QUESTS.some(sq => sq.npc === n.id && (sideAvail(sq) === 'avail' || sideAvail(sq) === 'active'))))
        mark = '…';
    }
    mc.fillStyle = '#ffd76a';
    mc.strokeStyle = 'rgba(0,0,0,.65)'; mc.lineWidth = 1;
    mc.beginPath(); mc.arc(nx, ny, 3, 0, 7); mc.fill(); mc.stroke();
    // nhãn tên — thử bên phải, bên trái, bên dưới; bỏ qua nếu vẫn đụng nhãn khác
    mc.font = '8px "Be Vietnam Pro", sans-serif';
    const lw = mc.measureText(n.name).width;
    const spots = [
      { x: nx + 5, y: ny + 3, align: 'left' },
      { x: nx - 5, y: ny + 3, align: 'right' },
      { x: nx, y: ny + 11, align: 'center' },
    ];
    for (const sp of spots){
      const lx = sp.align === 'left' ? sp.x : sp.align === 'right' ? sp.x - lw : sp.x - lw/2;
      const hit = placedLabels.some(r => lx < r.x + r.w && lx + lw > r.x && Math.abs(sp.y - 4 - r.y) < 9);
      if (hit) continue;
      placedLabels.push({ x: lx, y: sp.y - 4, w: lw });
      mc.textAlign = sp.align;
      mc.strokeStyle = 'rgba(0,0,0,.75)'; mc.lineWidth = 2;
      mc.strokeText(n.name, sp.x, sp.y);
      mc.fillStyle = '#ffe9a8';
      mc.fillText(n.name, sp.x, sp.y);
      break;
    }
    if (mark){
      mc.font = 'bold 11px "Be Vietnam Pro", sans-serif'; mc.textAlign = 'center';
      mc.fillStyle = mark === '!' ? '#ffd76a' : '#9fd0ff';
      mc.shadowColor = mc.fillStyle; mc.shadowBlur = 4;
      mc.fillText(mark, nx, ny - 5);
      mc.shadowBlur = 0;
    }
  }
  // quái vật — thường đỏ nhỏ, tinh anh cam, boss tím nhấp nháy, Du Hiệp lam viền trắng
  const _blink = Math.sin(performance.now()/260) > 0;
  for (const m of mobs){
    if (m.dead) continue;
    const d = m.def;
    if (d.duHiep){
      mc.fillStyle = '#4a90e0';
      mc.beginPath(); mc.arc(m.x*sx, m.y*sy, 2.4, 0, 7); mc.fill();
      mc.strokeStyle = 'rgba(255,255,255,.8)'; mc.lineWidth = 0.8; mc.stroke();
      continue;
    }
    if (d.boss && !_blink) continue; // boss nhấp nháy báo hiệu
    mc.fillStyle = d.boss ? '#c04ae8' : d.elite ? '#ffb84a' : '#e05a4a';
    mc.beginPath(); mc.arc(m.x*sx, m.y*sy, d.boss ? 3.5 : d.elite ? 2.6 : 1.6, 0, 7); mc.fill();
    if (d.boss){ mc.strokeStyle = 'rgba(255,255,255,.85)'; mc.lineWidth = 1; mc.stroke(); }
  }
  // pet / thú chiến — chấm xanh cyan
  mc.fillStyle = '#4ad8e0';
  if (petObj && !petObj.dead){ mc.beginPath(); mc.arc(petObj.x*sx, petObj.y*sy, 2, 0, 7); mc.fill(); }
  if (mountObj){ mc.beginPath(); mc.arc(mountObj.x*sx, mountObj.y*sy, 2, 0, 7); mc.fill(); }
  // khung nhìn camera
  mc.strokeStyle = 'rgba(255,255,255,.5)';
  mc.lineWidth = 1;
  mc.strokeRect(camera.x*sx, camera.y*sy, Math.min(W, MAP.w)*sx, Math.min(H, MAP.h)*sy);
  // người chơi — mũi tên trắng chỉ hướng mặt
  mc.save();
  mc.translate(player.x*sx, player.y*sy);
  mc.rotate(player.face);
  mc.shadowColor = '#fff'; mc.shadowBlur = 4;
  mc.fillStyle = '#fff';
  mc.beginPath();
  mc.moveTo(4.5, 0); mc.lineTo(-3, -2.8); mc.lineTo(-1.5, 0); mc.lineTo(-3, 2.8);
  mc.closePath(); mc.fill();
  mc.restore();
  // tên map
  mc.font = '9px "Be Vietnam Pro", sans-serif';
  mc.fillStyle = 'rgba(255,240,200,.9)';
  mc.fillText(md.name, 6, mh - 6);
}

// ---------- Bảng Cài Đặt ----------
function renderSettings(){
  const p = el('panel-settings'); if (!p) return;
  const slider = (key, val) => `<input type="range" min="0" max="100" value="${val}" oninput="setOpt('${key}', this.value, true)" onchange="setOpt('${key}', this.value)">`;
  const tog = (key) => `<button class="mini-btn ${SETTINGS[key] ? '' : 'danger'}" onclick="toggleOpt('${key}')">${SETTINGS[key] ? 'BẬT' : 'TẮT'}</button>`;
  const _acS = (typeof player !== 'undefined' && player && player.autoCfg) ? player.autoCfg : { skill:true, potion:true, potionPct:40, range:430, boss:false };
  const togA = (key) => `<button class="mini-btn ${_acS[key] ? '' : 'danger'}" onclick="toggleAutoCfg('${key}')">${_acS[key] ? 'BẬT' : 'TẮT'}</button>`;
  const sldA = (key, min, max, step, txt) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${_acS[key]}" oninput="setAutoCfg('${key}', this.value, true)" onchange="setAutoCfg('${key}', this.value)"><span style="font-size:11px;color:#e8c84a">${txt}</span>`;
  p.innerHTML = `<h3>Cài Đặt</h3><button class="close-x" onclick="closePanels()">✕</button>
    <div class="set-row"><span>🎵 Nhạc nền</span>${slider('bgm', SETTINGS.bgm)}</div>
    <div class="set-row"><span>🔔 Hiệu ứng âm thanh</span>${slider('sfx', SETTINGS.sfx)}</div>
    <div class="set-row"><span>🗺 Bản đồ thu nhỏ <i>(phím U)</i></span>${tog('minimap')}</div>
    <div class="set-row"><span>🏷 Tên quái vật</span>${tog('mobName')}</div>
    <div class="set-row"><span>📳 Rung màn hình <i>(mặc định tắt)</i></span>${tog('shake')}</div>
    <div class="set-row"><span>🍃 Giảm hiệu ứng <i>(máy yếu)</i></span>${tog('lowFx')}</div>
    <div class="set-row" style="border-bottom:none;justify-content:center"><b style="color:#6ae88a;font-size:12px">— ⚔ AUTO FARM (phím Z) —</b></div>
    <div class="set-row"><span>🗡 Tự tung kỹ năng trên taskbar</span>${togA('skill')}</div>
    <div class="set-row"><span>🧪 Tự uống Hồ Lô Thuốc</span>${togA('potion')}</div>
    <div class="set-row"><span>❤ Uống thuốc khi HP dưới</span>${sldA('potionPct', 10, 80, 5, _acS.potionPct + '%')}</div>
    <div class="set-row"><span>🎯 Tầm quét quanh điểm neo</span>${sldA('range', 200, 700, 10, _acS.range + 'px')}</div>
    <div class="set-row"><span>👹 Auto đánh cả Boss <i>(nguy hiểm — mặc định tắt, boss tự mình quyết!)</i></span>${togA('boss')}</div>
    ${(typeof player !== 'undefined' && player && player.ascended) ? `
    <div class="set-row" style="border-bottom:none;justify-content:center"><b style="color:#fff2b0;font-size:12px">— ☁ PHI THĂNG · TÁN TIÊN —</b></div>
    <div class="set-row"><span>⚥ Hình dáng tiên nhân</span><span><button class="mini-btn ${player.gender !== 'nu' ? '' : 'danger'}" onclick="setGender('nam')">NAM</button> <button class="mini-btn ${player.gender === 'nu' ? '' : 'danger'}" onclick="setGender('nu')">NỮ</button></span></div>
    <div class="set-row"><span>🎨 Tiên Y (skin)</span><span>${Object.keys(TIEN_SKINS).map(k => `<button class="mini-btn" style="color:${TIEN_SKINS[k].halo} !important;border-color:${TIEN_SKINS[k].halo} !important" title="${TIEN_SKINS[k].name}" onclick="setTienSkin('${k}')">${player.tienSkin === k ? '◉' : '●'}</button>`).join('')}</span></div>
    <div style="font-size:10.5px;color:#9a8a6a;line-height:1.5">Đang mặc: <b style="color:${(TIEN_SKINS[player.tienSkin] || TIEN_SKINS.bach).halo}">${(TIEN_SKINS[player.tienSkin] || TIEN_SKINS.bach).name}</b> — môn phái đã phá bỏ, võ học toàn tự do, ngự kiếm phi hành +25% tốc độ.</div>` : ''}
    <div class="set-row" style="border-bottom:none"><span style="color:#c05a4a">⚠ Xóa dữ liệu & tu luyện lại</span><button class="mini-btn danger" onclick="wipeSave()">XÓA SAVE</button></div>
    <div style="font-size:11px;color:#9a8a6a;margin-top:8px;line-height:1.5">Âm thanh sẽ phát sau thao tác đầu tiên của bạn (quy định trình duyệt). Mọi cài đặt được lưu tự động.</div>`;
}
window.setGender = function(g){ if (!player) return; player.gender = (g === 'nu') ? 'nu' : 'nam'; saveGame(); renderSettings(); };
window.setTienSkin = function(id){ if (!player || !TIEN_SKINS[id]) return; player.tienSkin = id; saveGame(); renderSettings(); };
window.setOpt = function(key, v, quiet){
  SETTINGS[key] = clamp(parseInt(v, 10) || 0, 0, 100);
  saveSettings();
  if (key === 'bgm') AudioSys.refreshBgmVol();
  if (!quiet) renderSettings();
};
window.toggleOpt = function(key){
  SETTINGS[key] = !SETTINGS[key];
  saveSettings();
  renderSettings();
};
window.toggleAutoCfg = function(key){
  if (!player.autoCfg) player.autoCfg = { skill:true, potion:true, potionPct:40, range:430, boss:false };
  player.autoCfg[key] = !player.autoCfg[key];
  saveGame(); renderSettings();
};
window.setAutoCfg = function(key, v, quiet){
  if (!player.autoCfg) player.autoCfg = { skill:true, potion:true, potionPct:40, range:430, boss:false };
  player.autoCfg[key] = clamp(parseInt(v, 10) || 0, 10, 800);
  saveGame();
  if (!quiet) renderSettings();
};
window.wipeSave = function(){
  if (!confirm('Xóa toàn bộ dữ liệu tu luyện và bắt đầu lại từ đầu?')) return;
  try { localStorage.removeItem('vlcm_save'); localStorage.removeItem('vlcm_settings'); } catch (e) {}
  location.reload();
};

/* ═══════════════════════════════════════════════════════════════
   P1 — NHIỆM VỤ THEO VÙNG: chính tuyến Xạ Điêu + phụ tuyến + NPC vùng
   Chính tuyến = chuỗi tuyến tính (QUESTS), mỗi chương gắn 1 vùng + 1 NPC.
   Phụ tuyến = SIDE_QUESTS, nhận/trả tại NPC vùng, tối đa 3 active.
   Mở khóa map = đủ cấp (md.min) + hoàn thành chương trước (md.reqMain).
   ═══════════════════════════════════════════════════════════════ */

// ---------- NPC mới theo vùng ----------
NPCS.push(
  { id:'duocsu',    name:'Dược Sư',              map:'daohoa',     x:560,  y:430,  img:'assets/npcs/duocsu.png',    talk:'quest',
    lore:'"Thuốc hay cứu người, thuốc độc cũng cứu người — tùy ai dùng."' },
  { id:'quachtinh', name:'Quách Đại Hiệp',       map:'tuongduong', x:1250, y:950,  img:'assets/npcs/quachtinh.png', talk:'quest',
    lore:'"Vì quốc vì dân, hiệp giả đại giả. Tương Dương còn, ta còn."' },
  { id:'monkhach',  name:'Môn Khách',            map:'tuongduong', x:1420, y:1050, img:'assets/npcs/monkhach.png',  talk:'quest',
    lore:'"Giang hồ này, tin tức còn quý hơn bạc."' },
  { id:'daosi',     name:'Đạo Sĩ Toàn Chân',     map:'chungnam',   x:520,  y:1420, img:'assets/npcs/daosi.png',     talk:'quest',
    lore:'"Đạo pháp tự nhiên — nhưng phản đồ thì không thể dung tha."' },
  { id:'thumo',     name:'Thủ Mộ Nhân',          map:'comoc',      x:520,  y:480,  img:'assets/npcs/thumo.png',     talk:'quest',
    lore:'"Mộ này… có thứ không nên bị đánh thức. Ngươi nghe thấy gì không?"' },
  { id:'ttmon',     name:'Tuyệt Tình Môn Nhân',  map:'tuyettinh',  x:520,  y:950,  img:'assets/npcs/ttmon.png',     talk:'quest',
    lore:'"Vào cốc này rồi, chữ Tình hãy để ngoài cửa."' },
  { id:'noiung',    name:'Nội Ứng',              map:'mongco',     x:520,  y:950,  img:'assets/npcs/noiung.png',    talk:'quest',
    lore:'"Suỵt… ta là người của Quách Đại Hiệp cắm trong doanh địch đã ba năm."' },
  { id:'laotuong',  name:'Lão Tướng',            map:'nhanmon',    x:520,  y:950,  img:'assets/npcs/laotuong.png',  talk:'quest',
    lore:'"Bốn mươi năm trấn ải, xương già này chưa từng lùi một bước."' },
  { id:'traichu',   name:'Trại Chủ Mục Đồng',      map:'ngoai',      x:1050, y:700,  img:'assets/npcs/truonglang.png', talk:'stable',
    lore:'"Tuấn mã hoang ngoài đồng kia đấy — rượt cho nó kiệt sức rồi bấm E mà bắt. Mã Thầu thu được dùng khi thăng giai thú cưỡi!"' }, // GDD Đợt 2 B5
);
NPCS.push(
  { id:'duoclao', name:'Dược Lão · Dược Phường', map:'tuongduong', x:1060, y:1140, img:'assets/npcs/duoclao.png', talk:'shop',
    lore:'"Thuốc hay cứu người — nhưng không trả tiền thì thuốc cũng hóa độc đấy."' },
  { id:'binhkhi', name:'Binh Khí Chủ · Vũ Khí Phường', map:'tuongduong', x:1580, y:1000, img:'assets/npcs/binhkhi.png', talk:'shop',
    lore:'"Kiếm tốt không chờ người — ngươi chậm thì người khác cầm mất."' },
  { id:'trachu',  name:'Trà Quán Chủ', map:'tuongduong', x:1230, y:1290, img:'assets/npcs/trachu.png', talk:'shop',
    lore:'"Giang hồ hiểm ác — nhưng trà trong quán này lúc nào cũng nóng."' },
  { id:'quangia', name:'Quản Gia · Động Phủ', map:'tuongduong', x:1450, y:1350, img:'assets/npcs/truonglang.png', talk:'abode',
    lore:'"Động phủ của đạo hữu đã dọn sạch — Tụ Linh Trận và Dược Viên chờ chủ nhân."' },
  { id:'bodau', name:'Bổ Đầu · Truy Nã Lệnh', map:'tuongduong', x:1420, y:1010, img:'assets/npcs/quachtinh.png', talk:'trunya',
    lore:'"Triều đình treo thưởng tà đạo — mỗi ngày một tên. Làm xong, đến Vạn Duyên Các thử vận."' },
  { id:'thantoan', name:'Thần Toán Tử · Vạn Duyên Các', map:'tuongduong', x:1120, y:1300, img:'assets/npcs/trachu.png', talk:'vanduyen',
    lore:'"Một lệnh một duyên — năm phần trăm gặp bí kíp hiếm, không gom đủ cũng chẳng thành."' },
  { id:'vandai', name:'Vân Đài · Vách Té Núi', map:'chungnam', x:2300, y:350, img:'assets/npcs/vachda.png', talk:'tenui',
    lore:'"Vách mây ngàn trượng — người cầu đạo nhảy xuống, kẻ sợ chết quay đầu."' },
  { id:'doantruongnhai', name:'Đoạn Trường Nhai · Vách Té Núi', map:'tuyettinh', x:350, y:1550, img:'assets/npcs/vachda.png', talk:'tenui',
    lore:'"Nhai này đoạn trường tình — dưới vực sâu, kẻ hữu duyên sẽ đổi đời."' },
  { id:'dinhbiennhai', name:'Định Biên Nhai · Vách Té Núi', map:'nhanmon', x:2250, y:1500, img:'assets/npcs/vachda.png', talk:'tenui',
    lore:'"Gió biên thùy cắt thịt — cơ duyên chỉ dành cho kẻ dám té."' },
);
for (const n of NPCS){ if (!NPC_IMGS[n.id]){ const im = new Image(); im.src = n.img; NPC_IMGS[n.id] = im; } }
function npcName(id){ const n = NPCS.find(x => x.id === id); return n ? n.name : 'Trưởng Làng'; }

// ---------- Chính tuyến: gắn chương I cho 10 NV cũ ----------
QUESTS.forEach(q => {
  // QA regression: chỉ NV1 ở Tương Dương — NV2 trả tại Trưởng Làng, vì cổng thành khóa (reqMain 10)
  // sau khi rời thành, nếu trả NV2 cho Quách Đại Hiệp thì tân thủ bị kẹt cứng không thể vào lại thành.
  if (q.id <= 1){ q.npc = 'quachtinh'; q.map = 'tuongduong'; q.chapter = 'Chương I · Nhập Thế'; }
  else { q.npc = 'truonglang'; q.map = 'daohoa'; q.chapter = 'Chương I · Thanh Ngưu Thôn'; }
});
// Chương II — Tương Dương Phong Vân (mở sau khi phá Bình Cảnh)
QUESTS.push(
  { id:11, lv:10, name:'Phá Cảnh Nhập Thành', chapter:'Chương II · Tương Dương Phong Vân', npc:'quachtinh', map:'tuongduong',
    desc:'Bình Cảnh đã phá, danh tiếng vọng đến Tương Dương. Đến thành bái kiến Quách Đại Hiệp.',
    type:'talk', targetNpc:'quachtinh', need:1, rew:{xp:2000, silver:300} },
  { id:12, lv:11, name:'Quân Nhu Thiếu Hụt', chapter:'Chương II · Tương Dương Phong Vân', npc:'quachtinh', map:'tuongduong',
    desc:'Quân nhu trong thành cạn kiệt. Quay về Đào Hoa Đảo hái 6 Thảo Dược đem về đây.',
    type:'collect', need:6, rew:{xp:2600, silver:350, mat:2} },
  { id:13, lv:12, name:'Thổ Phỉ Ngoại Ô', chapter:'Chương II · Tương Dương Phong Vân', npc:'quachtinh', map:'tuongduong',
    desc:'Sơn tặc ngoại ô Đào Hoa chặn đường lương thực. Diệt 8 tên để dọn đường.',
    type:'kill', mob:'bandit', need:8, rew:{xp:3200, silver:420} },
  { id:14, lv:13, name:'Triệu Tập Anh Hùng', chapter:'Chương II · Tương Dương Phong Vân', npc:'quachtinh', map:'tuongduong',
    desc:'Quách Đại Hiệp cần nhân thủ. Đến gặp Môn Khách trong thành để ghi danh.',
    type:'talk', targetNpc:'monkhach', need:1, rew:{xp:2800, silver:300} },
  { id:15, lv:14, name:'Lập Uy Trước Giặc', chapter:'Chương II · Tương Dương Phong Vân', npc:'quachtinh', map:'tuongduong',
    desc:'Hắc Phong Sát dòm ngó thành trì. Diệt 3 tên ở Đào Hoa Đảo để lập uy — rồi đường lên Chung Nam sẽ mở.',
    type:'kill', mob:'assassin', need:3, rew:{xp:4200, silver:500, mat:2} },
);
// Chương III — Chung Nam Vân Vụ
QUESTS.push(
  { id:16, lv:20, name:'Bái Sơn Môn', chapter:'Chương III · Chung Nam Vân Vụ', npc:'daosi', map:'chungnam',
    desc:'Lên Chung Nam Sơn bái kiến Đạo Sĩ Toàn Chân ngay cổng sơn môn.',
    type:'talk', targetNpc:'daosi', need:1, rew:{xp:5500, silver:600} },
  { id:17, lv:22, name:'Phản Đồ Loạn Đạo', chapter:'Chương III · Chung Nam Vân Vụ', npc:'daosi', map:'chungnam',
    desc:'Phản đồ trốn môn phái chiếm giữ sơn đạo. Diệt 6 Toàn Chân Phản Đồ.',
    type:'kill', mob:'phando', need:6, rew:{xp:6500, silver:700} },
  { id:18, lv:26, name:'Xà Nữ Mê Tâm Thuật', chapter:'Chương III · Chung Nam Vân Vụ', npc:'daosi', map:'chungnam',
    desc:'Xà Nữ dùng mê tâm thuật hại đạo đồng tu luyện. Diệt 6 Xà Nữ.',
    type:'kill', mob:'xanu', need:6, rew:{xp:8000, silver:800, mat:2} },
  { id:19, lv:30, name:'Kiếm Khách Bán Đảo', chapter:'Chương III · Chung Nam Vân Vụ', npc:'daosi', map:'chungnam',
    desc:'Kiếm Khách Bán Đảo thuê tay chặn đường lên Cổ Mộ. Diệt 3 tên — đường xuống Cổ Mộ sẽ mở.',
    type:'kill', mob:'bandao', need:3, rew:{xp:10000, silver:1000, mat:3} },
);
// Chương IV — Cổ Mộ U Ảnh
QUESTS.push(
  { id:20, lv:40, name:'Người Thủ Mộ', chapter:'Chương IV · Cổ Mộ U Ảnh', npc:'thumo', map:'comoc',
    desc:'Trong Cổ Mộ Mật Thất u ám, tìm Thủ Mộ Nhân — người duy nhất còn giữ được lẽ sống nơi này.',
    type:'talk', targetNpc:'thumo', need:1, rew:{xp:14000, silver:1200} },
  { id:21, lv:43, name:'Thị Nữ Dạ Khúc', chapter:'Chương IV · Cổ Mộ U Ảnh', npc:'thumo', map:'comoc',
    desc:'Cổ Mộ Thị Nữ đêm đêm khóc than, quấy nhiễu vong linh yên nghỉ. Siêu độ 7 Thị Nữ.',
    type:'kill', mob:'thinu', need:7, rew:{xp:17000, silver:1400} },
  { id:22, lv:47, name:'Phá Mộc Nhân Trận', chapter:'Chương IV · Cổ Mộ U Ảnh', npc:'thumo', map:'comoc',
    desc:'Cơ Quan Mộc Nhân trấn giữ mộ đạo vẫn vận hành sau trăm năm. Phá hủy 5 Mộc Nhân.',
    type:'kill', mob:'mocnhan', need:5, rew:{xp:21000, silver:1600, mat:3} },
  { id:23, lv:52, name:'Huyết Bát Tẫu Loạn', chapter:'Chương IV · Cổ Mộ U Ảnh', npc:'thumo', map:'comoc',
    desc:'Bầy Huyết Biên Bức hút máu kẻ lỡ bước. Diệt 6 con — lối vào Tuyệt Tình Cốc sẽ mở.',
    type:'kill', mob:'huyetbat', need:6, rew:{xp:26000, silver:1800, mat:3} },
);
// Chương V — Tuyệt Tình Tình Chướng
QUESTS.push(
  { id:24, lv:60, name:'Tình Hoa Độc', chapter:'Chương V · Tuyệt Tình Tình Chướng', npc:'ttmon', map:'tuyettinh',
    desc:'Đến Tuyệt Tình Cốc gặp Tuyệt Tình Môn Nhân — cẩn thận, hoa nơi đây có độc.',
    type:'talk', targetNpc:'ttmon', need:1, rew:{xp:34000, silver:2000} },
  { id:25, lv:63, name:'Đệ Tử Thất Lạc', chapter:'Chương V · Tuyệt Tình Tình Chướng', npc:'ttmon', map:'tuyettinh',
    desc:'Đệ tử môn phái bị tình hoa làm mê hoặc, trở mặt thành thù. Diệt 7 Tuyệt Tình Đệ Tử.',
    type:'kill', mob:'ttdetu', need:7, rew:{xp:40000, silver:2200} },
  { id:26, lv:68, name:'Độc Yêu Tà Vụ', chapter:'Chương V · Tuyệt Tình Tình Chướng', npc:'ttmon', map:'tuyettinh',
    desc:'Tình Hoa Độc Yêu là nguồn của tà độc. Diệt 6 Độc Yêu — nhớ Cương Khí hộ thể.',
    type:'kill', mob:'docyeu', need:6, rew:{xp:48000, silver:2600, mat:4} },
  { id:27, lv:73, name:'Hắc Y Thích Khách', chapter:'Chương V · Tuyệt Tình Tình Chướng', npc:'ttmon', map:'tuyettinh',
    desc:'Hắc Y Sát Thủ mai phục chặn đường ra thảo nguyên. Diệt 4 tên — đường đến Mông Cổ Đại Doanh sẽ mở.',
    type:'kill', mob:'satthuhy', need:4, rew:{xp:58000, silver:3000, mat:4} },
);
// Chương VI — Mông Cổ Phong Sa
QUESTS.push(
  { id:28, lv:80, name:'Nội Ứng Trong Doanh', chapter:'Chương VI · Mông Cổ Phong Sa', npc:'noiung', map:'mongco',
    desc:'Tìm Nội Ứng của Quách Đại Hiệp ngay rìa Mông Cổ Đại Doanh. Hành động lặng lẽ.',
    type:'talk', targetNpc:'noiung', need:1, rew:{xp:68000, silver:3200} },
  { id:29, lv:83, name:'Cắt Đứt Tai Mắt', chapter:'Chương VI · Mông Cổ Phong Sa', npc:'noiung', map:'mongco',
    desc:'Thám Tử Mông Cổ rải khắp thảo nguyên. Diệt 7 tên để bịt mắt quân địch.',
    type:'kill', mob:'thamtu', need:7, rew:{xp:78000, silver:3600} },
  { id:30, lv:88, name:'Phá Cung Thủ Trận', chapter:'Chương VI · Mông Cổ Phong Sa', npc:'noiung', map:'mongco',
    desc:'Cung Thủ Thảo Nguyên bắn từ xa cực nguy hiểm. Diệt 6 Cung Thủ.',
    type:'kill', mob:'cungthu', need:6, rew:{xp:90000, silver:4000, mat:5} },
  { id:31, lv:93, name:'Hắc Kỵ Phong Ba', chapter:'Chương VI · Mông Cổ Phong Sa', npc:'noiung', map:'mongco',
    desc:'Hắc Ám Kỵ Binh là mũi nhọn xung kích. Diệt 4 tên — đường ra Nhạn Môn Quan sẽ mở.',
    type:'kill', mob:'kybinh', need:4, rew:{xp:105000, silver:4500, mat:5} },
);
// Chương VII — Nhạn Môn Huyết Chiến (chung kết)
QUESTS.push(
  { id:32, lv:100, name:'Trấn Ải Chi Binh', chapter:'Chương VII · Nhạn Môn Huyết Chiến', npc:'laotuong', map:'nhanmon',
    desc:'Ra Nhạn Môn Quan gặp Lão Tướng — trận chiến cuối cùng đang chờ.',
    type:'talk', targetNpc:'laotuong', need:1, rew:{xp:120000, silver:5000} },
  { id:33, lv:100, name:'Cuồng Binh Xung Trận', chapter:'Chương VII · Nhạn Môn Huyết Chiến', npc:'laotuong', map:'nhanmon',
    desc:'Đột Quyết Cuồng Binh ào ạt như thủy triều. Diệt 6 tên giữ vững phòng tuyến.',
    type:'kill', mob:'cuongbinh', need:6, rew:{xp:140000, silver:5500} },
  { id:34, lv:100, name:'Liệt Hỏa Kỳ Lân', chapter:'Chương VII · Nhạn Môn Huyết Chiến', npc:'laotuong', map:'nhanmon',
    desc:'Liệt Hỏa Kỳ Lân cháy rụi chiến trường. Thuần diệt 4 con.',
    type:'kill', mob:'kylan', need:4, rew:{xp:165000, silver:6000, mat:6} },
  { id:35, lv:100, name:'Huyễn Ảnh Chí Tôn', chapter:'Chương VII · Nhạn Môn Huyết Chiến', npc:'laotuong', map:'nhanmon',
    desc:'Tu La Đao Khách — đao khách đứng đầu bách chiến. Diệt 5 tên để định đoạt thiên hạ, thành danh Huyễn Ảnh Chí Tôn!',
    type:'kill', mob:'daokhach', need:5, rew:{xp:200000, silver:8000, mat:8} },
);

// ---------- Phụ tuyến theo vùng (tối đa 3 active cùng lúc) ----------
const SIDE_QUESTS = [
  { id:'s_dh1', npc:'duocsu',   map:'daohoa',     reqLv:2,  reqMain:0,  name:'Thảo Dược Quý',        desc:'Dược Sư cần 6 Thảo Dược để chế thuốc chữa dịch cho làng.', type:'collect', need:6, rew:{xp:300, silver:120, mat:2} },
  { id:'s_dh2', npc:'duocsu',   map:'daohoa',     reqLv:2,  reqMain:0,  name:'Dã Trư Phá Vườn',      desc:'Dã Trư phá nát vườn thuốc. Diệt 10 con.', type:'kill', mob:'boar', need:10, rew:{xp:400, silver:150} },
  { id:'s_td1', npc:'monkhach', map:'tuongduong', reqLv:10, reqMain:10, name:'Án Mạng Trong Thành',  desc:'Hắc Phong Sát trà trộn gây án. Diệt 5 tên ở Đào Hoa Đảo.', type:'kill', mob:'assassin', need:5, rew:{xp:3000, silver:400} },
  { id:'s_td2', npc:'monkhach', map:'tuongduong', reqLv:10, reqMain:10, name:'Tân Binh Tập Luyện',   desc:'Luyện tay với 10 Hầu Tử tinh quái trên Đào Hoa Đảo.', type:'kill', mob:'hautu', need:10, rew:{xp:2200, silver:350} },
  { id:'s_cn1', npc:'daosi',    map:'chungnam',   reqLv:22, reqMain:15, name:'Hộ Sơn Pháp Trận',     desc:'Thanh lý 8 Toàn Chân Phản Đồ để tái lập hộ sơn pháp trận.', type:'kill', mob:'phando', need:8, rew:{xp:7500, silver:700} },
  { id:'s_cn2', npc:'daosi',    map:'chungnam',   reqLv:24, reqMain:15, name:'Thanh Tâm Tịnh Dục',   desc:'Diệt 8 Xà Nữ để đạo đồng khỏi mê tâm tà thuật.', type:'kill', mob:'xanu', need:8, rew:{xp:8500, silver:800, mat:2} },
  { id:'s_cm1', npc:'thumo',    map:'comoc',      reqLv:42, reqMain:19, name:'Yên Tĩnh Cho Người Khuất', desc:'Siêu độ 8 Cổ Mộ Thị Nữ để vong linh được an nghỉ.', type:'kill', mob:'thinu', need:8, rew:{xp:17000, silver:1100} },
  { id:'s_cm2', npc:'thumo',    map:'comoc',      reqLv:45, reqMain:19, name:'Dọn Dẹp Mộ Đạo',       desc:'Diệt 8 Huyết Biên Bức để mộ đạo không còn máu tanh.', type:'kill', mob:'huyetbat', need:8, rew:{xp:19000, silver:1300, mat:3} },
  { id:'s_tt1', npc:'ttmon',    map:'tuyettinh',  reqLv:62, reqMain:23, name:'Giải Độc Tình Hoa',    desc:'Diệt 8 Tình Hoa Độc Yêu để lấy giải dược cho đệ tử.', type:'kill', mob:'docyeu', need:8, rew:{xp:42000, silver:1900} },
  { id:'s_tt2', npc:'ttmon',    map:'tuyettinh',  reqLv:65, reqMain:23, name:'Trừng Phạt Phản Đồ',   desc:'Diệt 6 Hắc Y Sát Thủ phục kích trong cốc.', type:'kill', mob:'satthuhy', need:6, rew:{xp:47000, silver:2100, mat:3} },
  { id:'s_mc1', npc:'noiung',   map:'mongco',     reqLv:82, reqMain:27, name:'Cắt Đứt Tiếp Tế',      desc:'Diệt 8 Thám Tử Mông Cổ chặn tuyến tiếp tế của địch.', type:'kill', mob:'thamtu', need:8, rew:{xp:82000, silver:2900} },
  { id:'s_mc2', npc:'noiung',   map:'mongco',     reqLv:85, reqMain:27, name:'Đốt Lương Thảo',       desc:'Diệt 8 Cung Thủ canh giữ kho lương để đốt phá.', type:'kill', mob:'cungthu', need:8, rew:{xp:92000, silver:3300, mat:4} },
  { id:'s_nm1', npc:'laotuong', map:'nhanmon',    reqLv:100, reqMain:31, name:'Biên Ải Vệ Binh',     desc:'Diệt 8 Đột Quyết Cuồng Binh giữ vững trận tuyến.', type:'kill', mob:'cuongbinh', need:8, rew:{xp:165000, silver:4800} },
  { id:'s_nm2', npc:'laotuong', map:'nhanmon',    reqLv:100, reqMain:31, name:'Săn Kỳ Lân',          desc:'Thu phục 4 Liệt Hỏa Kỳ Lân — chúng phá hủy cả quân doanh.', type:'kill', mob:'kylan', need:4, rew:{xp:185000, silver:5200, mat:5} },
  { id:'s_ng3', npc:'traichu', map:'ngoai',      reqLv:10, reqMain:10, name:'Trại Ngựa Ngoại Ô',    desc:'Bắt 3 Tuấn Mã Hoang ngoài đồng cho Mục Đồng (rượt đến kiệt sức rồi bấm E).', type:'catch', need:3, rew:{xp:1500, silver:300, mat:2, thau:1} },
  { id:'s_mc3', npc:'noiung',  map:'mongco',     reqLv:80, reqMain:27, name:'Tuấn Mã Thảo Nguyên', desc:'Bắt 4 Tuấn Mã Hoang trên thảo nguyên Mông Cổ giúp quân doanh.', type:'catch', need:4, rew:{xp:85000, silver:3200, thau:3} }, // GDD Đợt 2 B5
];

function sideActive(){ return Object.keys(sideStates).filter(id => sideStates[id].st === 'active' || sideStates[id].st === 'done'); }
function sideAvail(q){
  const st = sideStates[q.id];
  if (st) return st.st; // active | done | claimed
  if (player.level < q.reqLv || questIdx < q.reqMain) return 'locked';
  if (sideActive().length >= 3) return 'full';
  return 'avail';
}
function sideOnKill(mobType, source){
  for (const q of SIDE_QUESTS){
    const st = sideStates[q.id];
    if (!st || st.st !== 'active' || q.type !== 'kill' || q.mob !== mobType) continue;
    st.prog++;
    if (st.prog >= q.need){
      st.st = 'done';
      addFloat(player.x, player.y-60, `Phụ tuyến hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13);
      AudioSys.sfx('quest', 0.7);
    }
  }
}
function sideOnEvent(type){
  for (const q of SIDE_QUESTS){
    const st = sideStates[q.id];
    if (!st || st.st !== 'active' || q.type !== type) continue;
    if (type === 'catch' && q.map && q.map !== curMap) continue; // GDD Đợt 2 B5: ngựa phải đúng vùng
    st.prog++;
    addFloat(player.x, player.y-40, `${q.name} ${st.prog}/${q.need}`, '#8fd18f', 12);
    if (st.prog >= q.need){
      st.st = 'done';
      addFloat(player.x, player.y-60, `Phụ tuyến hoàn thành — về gặp ${npcName(q.npc)}`, '#8fd18f', 13);
      AudioSys.sfx('quest', 0.7);
    }
  }
}
window.acceptSide = function(id){
  const q = SIDE_QUESTS.find(x => x.id === id);
  if (!q || sideAvail(q) !== 'avail') return;
  sideStates[id] = { st:'active', prog:0 };
  AudioSys.sfx('quest', 0.8);
  addFloat(player.x, player.y-40, `Nhận phụ tuyến: ${q.name}`, '#9fd0ff', 13);
  saveGame();
  const n = NPCS.find(x => x.id === q.npc); if (n) renderQuestNpc(n);
};
window.turnInSide = function(id){
  const q = SIDE_QUESTS.find(x => x.id === id);
  if (!q || !sideStates[id] || sideStates[id].st !== 'done') return;
  player.silver += q.rew.silver || 0;
  player.mat += q.rew.mat || 0;
  if (q.rew.thau){ player.maThau = (player.maThau || 0) + q.rew.thau; addFloat(player.x, player.y-62, `+${q.rew.thau} 🪢 Mã Thầu`, '#7fd8e0', 13); } // GDD Đợt 2 B5
  gainXp(q.rew.xp || 0);
  sideStates[id] = { st:'claimed', prog:q.need };
  AudioSys.sfx('quest', 0.9);
  addFloat(player.x, player.y-46, `Hoàn thành phụ tuyến: ${q.name}!`, '#f0d68a', 14);
  closePanels(); saveGame();
};

// ---------- Khóa map: đủ cấp + xong chương trước ----------
MAPS.tuongduong.reqMain = 10; // xong Chương I (phá Bình Cảnh)
MAPS.chungnam.reqMain   = 15; // xong Chương II
MAPS.comoc.reqMain      = 19; // xong Chương III
MAPS.tuyettinh.reqMain  = 23; // xong Chương IV
MAPS.mongco.reqMain     = 27; // xong Chương V
MAPS.nhanmon.reqMain    = 31; // xong Chương VI
// BẢN THỬ NGHIỆM: mở toàn bộ map (đặt false để bật lại khóa theo cấp + nhiệm vụ)
let OPEN_ALL_MAPS = false; // QA endgame F1: cổng map phải có hiệu lực — cấp/điều kiện NV kiểm soát tiến trình (true chỉ dùng khi dev test)
function mapGate(id){
  if (OPEN_ALL_MAPS) return { ok:true };
  const md = MAPS[id];
  if (player.level < md.min) return { ok:false, why:'lv', need:md.min };
  // QA regression: NV1 (gặp Quách Đại Hiệp) diễn ra trong thành — tân thủ chưa xong NV1
  // thì không thể bị khóa ngoài cổng thành, tránh kẹt cứng chính tuyến ngay từ đầu.
  if (id === 'tuongduong' && questIdx < 1) return { ok:true };
  if (md.reqMain && questIdx < md.reqMain){
    const rq = QUESTS[md.reqMain - 1];
    return { ok:false, why:'quest', quest: rq ? rq.name : '', chapter: rq ? rq.chapter : '' };
  }
  return { ok:true };
}
window.travelTo = function(mapId, from){
  const md = MAPS[mapId];
  if (!md || !player) return;
  const g = mapGate(mapId);
  if (!g.ok && !window.TEST_MODE){
    const msg = g.why === 'lv' ? `Cần cấp ${g.need} để vào ${md.name}!`
      : `Chưa rõ đường đến ${md.name} — hãy hoàn thành "${g.quest}"!`;
    addFloat(player.x, player.y-40, msg, '#ff7a6a', 14);
    AudioSys.sfx('hurt', 0.4);
    return;
  }
  curMap = mapId;
  closePanels();
  tutAdvance('map'); // hướng dẫn tân thủ: dịch chuyển lần đầu
  AudioSys.playBgm(BGM_TRACKS[mapId]);
  buildWorld();
  DGN = null;
  if (md.dungeon) startDungeonRun(mapId);
  const sp = (from && md.spawnFrom && md.spawnFrom[from]) || md.spawn;
  player.x = sp.x; player.y = sp.y;
  collideCityWalls(); // chắc chắn không spawn lọt tường
  const _fp = nearestFree(curMap, player.x, player.y); player.x = _fp.x; player.y = _fp.y; // GDD Đợt 2 A: không spawn vào vùng cấm
  player.hintOff = {}; // B3: qua map mới → các Nhắc Việc đã tắt hiện lại
  snapCamera(); // đổi map: camera đặt thẳng vào vị trí mới, không pan từ map cũ
  if (md.type === 'safe') player.pk = false;
  const zt = zoneType();
  zoneBanner = { text: md.name, sub: `${zt.name} — ${md.desc}`, color: zt.color, t: 3.2 };
  addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:zt.color, big:true });
  calcDerived(); saveGame();
};

// ---------- Map panel: vùng chưa mở = ??? ----------
function renderMapPanel(){
  const zt = zoneType();
  let html = `<h3>Bản Đồ Giang Hồ</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12px;color:#b8a878;margin-bottom:6px">Đang ở: <b style="color:${zt.color}">${mapDef().name}</b> · ${zt.name} · <span style="opacity:.7">Nhiệm vụ: phím Q</span>${window.TEST_MODE ? ' · <span style="color:#7fd4ff">[CHẾ ĐỘ TEST — dịch chuyển tự do]</span>' : ''}</div>`;
  // GDD Đợt 2 B2: badge mục tiêu NV trên từng vùng
  const _qt = questTarget(currentQuest());
  const _sqMaps = {};
  for (const sq of SIDE_QUESTS){
    const _st = sideStates[sq.id];
    if (_st && _st.st !== 'claimed'){ const _t2 = sideQuestTarget(sq); if (_t2) _sqMaps[_t2.map] = true; }
  }
  const _badge = (mid) => `${_qt && _qt.map === mid ? ' <span title="Mục tiêu nhiệm vụ chính tuyến" style="color:#ffd76a;font-weight:700">❗</span>' : ''}${_sqMaps[mid] ? ' <span title="Mục tiêu phụ tuyến đang làm" style="color:#7fd4ff;font-weight:700">◈</span>' : ''}`;

  for (const id in MAPS){
    const m = MAPS[id], z2 = ZONE_TYPES[m.type];
    if (m.dungeon && !window.TEST_MODE) continue; // phó bản chỉ vào qua cổng dịch chuyển — không hiện ở đây (trừ chế độ test)
    const g = mapGate(id), cur = id === curMap;
    if (window.TEST_MODE){
      // playtest: hiện đủ tên mọi map + phó bản, dịch chuyển tự do
      html += `<div class="map-row" style="${cur?'border-color:#f0d68a;background:rgba(201,162,39,.1)':''}">
        <span style="flex:1"><span class="m-name">${m.name}</span>${_badge(id)}
          <span style="font-size:10.5px;opacity:.6"> · LV ${m.range}</span>
          <span class="zone-badge" style="color:${z2.color};border-color:${z2.color}">${m.dungeon ? 'PHÓ BẢN' : z2.name}</span>
          <div class="m-desc">${m.desc}</div>${bandSummaryHtml(m)}</span>
        <span class="m-side">${cur ? '<span style="color:#f0d68a;font-size:11px">ĐANG Ở ĐÂY</span>'
          : `<button class="mini-btn" onclick="travelTo('${id}')">Dịch Chuyển</button>`}</span></div>`;
      continue;
    }
    if (!g.ok){
      // vùng chưa mở — che giấu tên thật, chỉ gợi ý điều kiện mở khóa (đủ cả 2)
      const hints = [];
      if (player.level < m.min) hints.push(`Cần đạt cấp ${m.min}`);
      if (m.reqMain && questIdx < m.reqMain){
        const rq = QUESTS[m.reqMain - 1];
        hints.push(`Hoàn thành "${rq.name}" (${rq.chapter})`);
      }
      html += `<div class="map-row map-locked">
        <span style="flex:1"><span class="m-name" style="color:#6a6255">??? Vùng Đất Chưa Biết</span>
          <span class="zone-badge" style="color:#6a6255;border-color:#6a6255">CHƯA MỞ</span>
          <div class="m-desc" style="opacity:.55">Giang hồ chưa ai kể về vùng này với ngươi…<br>🔒 ${hints.join('<br>🔒 ')}</div></span>
        <span class="m-side"><span style="font-size:16px;opacity:.5">🔒</span></span></div>`;
      continue;
    }
    html += `<div class="map-row" style="${cur?'border-color:#f0d68a;background:rgba(201,162,39,.1)':''}">
      <span style="flex:1"><span class="m-name">${m.name}</span>${_badge(id)}
        <span style="font-size:10.5px;opacity:.6"> · LV ${m.range}</span>
        <span class="zone-badge" style="color:${z2.color};border-color:${z2.color}">${z2.name}</span>
        <div class="m-desc">${m.desc}</div>${bandSummaryHtml(m)}</span>
      <span class="m-side">${cur ? '<span style="color:#f0d68a;font-size:11px">ĐANG Ở ĐÂY</span>'
        : `<button class="mini-btn" onclick="travelTo('${id}')">Dịch Chuyển</button>`}</span></div>`;
  }
  el('panel-map').innerHTML = html;
}

// ---------- Danh hiệu kết thúc chính tuyến ----------
TITLES.push({ id:'mochiton', name:'Huyễn Ảnh Chí Tôn', color:'#ffd76a',
  cond: p => !!p.mongChiTon, desc:'Hoàn thành toàn bộ chính tuyến', stats:{ allPct:0.20 }, vfx:'long' });

// ---------- Nói chuyện: hoàn thành NV loại "talk" trước khi mở dialog ----------
function questOnTalk(npc){
  const q = currentQuest();
  if (q && questState === 'active' && q.type === 'talk' && q.targetNpc === npc.id){
    questProg = 1; questState = 'done';
    AudioSys.sfx('quest', 0.8);
    addFloat(player.x, player.y-46, 'Nhiệm vụ hoàn thành!', '#8fd18f', 14);
  }
  for (const sq of SIDE_QUESTS){
    const st = sideStates[sq.id];
    if (st && st.st === 'active' && sq.type === 'talk' && sq.targetNpc === npc.id){
      st.prog = 1; st.st = 'done';
      AudioSys.sfx('quest', 0.8);
    }
  }
}

// ═══════════ AI NPC — trò chuyện tự do bằng LLM (GĐ1: 3 NPC thí điểm) ═══════════
// Fallback tuyệt đối: server/LLM không khả dụng → ẩn ô chat hoặc báo bận, game không vỡ.
const AI_NPCS = { truonglang:1, duoclao:1, quachtinh:1 };
let aiNpcOn = null; // null = đang kiểm tra · true/false
(function aiNpcPing(){
  if (!window.fetch){ aiNpcOn = false; return; }
  fetch('/api/trpc/npc.status?input=' + encodeURIComponent('{"json":null}'))
    .then(r => r.json())
    .then(d => { aiNpcOn = !!(d && d.result && d.result.data && d.result.data.json && d.result.data.json.enabled); })
    .catch(() => { aiNpcOn = false; });
})();
function aiEsc(s){ return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])); }
function aiChatBlock(npcId){
  if (!AI_NPCS[npcId] || aiNpcOn === false) return '';
  return `<div style="margin-top:10px;border-top:1px dashed rgba(201,162,39,.3);padding-top:8px">
    <div style="font-size:11.5px;color:#9a8a6a;margin-bottom:5px">💬 TRÒ CHUYỆN TỰ DO <span style="opacity:.6">— hỏi gì cũng được, họ sẽ đáp theo cách riêng của mình</span></div>
    <div id="ai-chat-reply" style="font-size:12.5px;color:#e8dcc0;line-height:1.6"></div>
    <div style="display:flex;gap:6px;margin-top:5px">
      <input id="ai-chat-input" maxlength="200" placeholder="Nói gì đó…" autocomplete="off"
        style="flex:1;background:rgba(0,0,0,.35);border:1px solid #6a5a3a;border-radius:6px;color:#e8dcc0;padding:6px 8px;font-size:12.5px;outline:none"
        onkeydown="if(event.key==='Enter'){event.preventDefault();aiChatSend('${npcId}');}">
      <button class="mini-btn" id="ai-chat-btn" onclick="aiChatSend('${npcId}')">Gửi</button>
    </div></div>`;
}
function aiNpcCtx(){
  const p = player;
  const sect = SECTS[p.sect] ? SECTS[p.sect].name : 'Tán Nhân';
  const realm = (p.dantian && DANTIAN_REALMS[p.dantian.realm]) ? DANTIAN_REALMS[p.dantian.realm].name : 'Phàm Nhân';
  const traits = (p.traits || []).map(tid => { const t = TRAITS.find(x => x.id === tid); return t ? t.name : String(tid); });
  const pers = PERSONALITIES[p.personality] ? PERSONALITIES[p.personality].name : 'Trung Dung';
  const q = currentQuest();
  const g = gameTimeInfo();
  const wx = weatherNow();
  const _hpV = Math.round((p.hp / p.maxHp) * 100); // NaN/Infinity (player chưa init xong) → mặc định 100
  return {
    level: p.level || 1, sect, realm,
    hpPct: Number.isFinite(_hpV) ? Math.max(0, Math.min(100, _hpV)) : 100,
    sin: p.toiac || 0, traits, pers,
    mapName: MAPS[curMap].name, questName: q ? q.name : '',
    season: g.season.name || g.season.id, weather: wx ? wx.name : 'Không rõ',
  };
}
window.aiChatSend = async function(npcId){
  const inp = el('ai-chat-input'), box = el('ai-chat-reply'), btn = el('ai-chat-btn');
  if (!inp || !box) return;
  const msg = inp.value.trim();
  if (!msg) return;
  inp.disabled = true; if (btn) btn.disabled = true;
  box.innerHTML = `<div style="font-size:12px;color:#b8a878;font-style:italic;margin-bottom:4px">» ${aiEsc(msg)}</div><div style="opacity:.55;font-size:12px">…</div>`;
  try {
    const res = await fetch('/api/trpc/npc.chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { npcId, message: msg, ctx: aiNpcCtx() } }),
    });
    const data = await res.json();
    const out = data && data.result && data.result.data && data.result.data.json;
    if (!out || !out.reply) throw new Error('bad reply');
    box.innerHTML = `<div style="font-size:12px;color:#b8a878;font-style:italic;margin-bottom:4px">» ${aiEsc(msg)}</div>
      <div style="font-style:italic;color:#e8dcc0;line-height:1.65;background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px">“${aiEsc(out.reply)}”</div>
      ${typeof out.remaining === 'number' && out.remaining <= 5 ? `<div style="font-size:11px;color:#9a8a6a;margin-top:3px">Hôm nay còn ${out.remaining} lượt trò chuyện.</div>` : ''}`;
    AudioSys.sfx('ui', 0.5);
  } catch (e) {
    box.innerHTML = `<div style="font-size:12px;opacity:.55;font-style:italic">(Đang bận — hãy quay lại sau.)</div>`;
  }
  inp.disabled = false; if (btn) btn.disabled = false;
  inp.value = ''; inp.focus();
};

// ---------- Dialog NPC quest giver (chính + phụ theo vùng) ----------
function renderQuestNpc(n){
  questOnTalk(n);
  const panel = el('panel-quest');
  let html = `<h3>${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  if (n.lore) html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6;font-style:italic">${n.lore}</div>`;
  const _nsl = typeof npcStoryLine === 'function' ? npcStoryLine() : null;
  if (_nsl) html += `<div style="font-size:12.5px;color:#e8b060;margin-bottom:8px;line-height:1.6;font-style:italic">📜 ${_nsl}</div>`;

  // — Chính tuyến —
  const q = currentQuest();
  if (q && q.npc === n.id){
    if (questState === 'done'){
      html += `<div class="qd-quest" style="border-color:#f0d68a"><div class="q-name" style="color:#f0d68a">★ ${q.name} — Hoàn thành!</div>${q.desc}
        <div class="q-rew">Thưởng: ${q.rew.xp} EXP · ${q.rew.silver||0}◈ ${q.rew.mat?('· '+q.rew.mat+'✦'):''}</div>
        <div style="text-align:center;margin-top:8px"><button class="mini-btn" onclick="turnInQuest()">Nhận Thưởng</button></div></div>`;
    } else {
      const prog = q.type==='talk' ? '—' : (q.type==='meditate' ? `${Math.floor(questProg)}/${q.need}s` : `${questProg}/${q.need}`);
      html += `<div class="qd-quest"><div class="q-name">★ Chính tuyến ${q.id}: ${q.name}</div>${q.desc}
        <div class="q-rew">Tiến độ: ${prog} · Thưởng: ${q.rew.xp} EXP · ${q.rew.silver||0}◈</div></div>`;
    }
  } else if (q){
    const giver = NPCS.find(x => x.id === q.npc);
    html += `<div style="font-size:12px;opacity:.65;margin-bottom:8px">★ Chính tuyến hiện tại: "${q.name}" — hãy đến <b>${MAPS[q.map].name}</b> gặp <b>${giver ? giver.name : ''}</b>.</div>`;
  } else {
    html += `<div style="font-size:12px;opacity:.65;margin-bottom:8px">★ Chính tuyến đã hoàn tất — ngươi chính là Huyễn Ảnh Chí Tôn!</div>`;
  }

  // — Phụ tuyến của NPC này —
  const mine = SIDE_QUESTS.filter(sq => sq.npc === n.id);
  if (mine.length){
    html += `<div style="font-size:11.5px;color:#9a8a6a;margin:6px 0 4px;border-top:1px dashed rgba(201,162,39,.3);padding-top:6px">PHỤ TUYẾN — ${MAPS[n.map].name.toUpperCase()}</div>`;
    for (const sq of mine){
      const st = sideAvail(sq);
      const sts = sideStates[sq.id];
      const prog = sts ? ` ${sts.prog}/${sq.need}` : '';
      const rew = `${sq.rew.xp} EXP · ${sq.rew.silver||0}◈ ${sq.rew.mat?('· '+sq.rew.mat+'✦'):''}`;
      if (st === 'claimed')
        html += `<div class="qd-quest" style="opacity:.55"><div class="q-name" style="color:#8fd18f">✔ ${sq.name}</div>${sq.desc}</div>`;
      else if (st === 'done')
        html += `<div class="qd-quest" style="border-color:#8fd18f"><div class="q-name" style="color:#8fd18f">${sq.name} — Hoàn thành!</div>${sq.desc}
          <div class="q-rew">Thưởng: ${rew}</div>
          <div style="text-align:center;margin-top:6px"><button class="mini-btn" onclick="turnInSide('${sq.id}')">Nhận Thưởng</button></div></div>`;
      else if (st === 'active')
        html += `<div class="qd-quest"><div class="q-name">${sq.name}${prog}</div>${sq.desc}
          <div class="q-rew">Thưởng: ${rew}</div></div>`;
      else if (st === 'avail')
        html += `<div class="qd-quest"><div class="q-name" style="color:#9fd0ff">◈ ${sq.name}</div>${sq.desc}
          <div class="q-rew">Thưởng: ${rew}</div>
          <div style="text-align:center;margin-top:6px"><button class="mini-btn" onclick="acceptSide('${sq.id}')">Nhận Nhiệm Vụ</button></div></div>`;
      else if (st === 'full')
        html += `<div class="qd-quest" style="opacity:.55"><div class="q-name">◈ ${sq.name}</div>${sq.desc}
          <div class="q-rew">Đang nhận tối đa 3 phụ tuyến — hoàn thành bớt rồi quay lại.</div></div>`;
      else
        html += `<div class="qd-quest" style="opacity:.45"><div class="q-name">🔒 ${sq.name}</div>
          <div class="q-rew">Cần cấp ${sq.reqLv} · Tiến độ chính tuyến chưa đủ</div></div>`;
    }
  }

  // — Bí kíp Huyết Ma Thôn Phệ (Trưởng Làng) —
  if (n.id === 'truonglang' && player.bikip){
    if (player.bikip.hmtp){
      html += `<div class="qd-quest" style="border-color:#e84a6a"><div class="q-name" style="color:#e84a6a">☠ Huyết Ma Thôn Phệ — Đã Luyện Thành</div>
        Mỗi đòn đánh hút 10% sát thương gây ra thành sinh lực.</div>`;
    } else {
      const pcs = player.bikip.pieces;
      html += `<div class="qd-quest"><div class="q-name" style="color:#e84a6a">Bí Kíp Giang Hồ — Huyết Ma Thôn Phệ</div>
        Tàn quyển: <b>Thượng ×${pcs[0]}</b> · <b>Trung ×${pcs[1]}</b> · <b>Hạ ×${pcs[2]}</b><br>
        <span style="opacity:.7;font-size:12px">Đánh bại Hắc Phong Sát Thủ để thu thập tàn quyển (Thượng 40% · Trung 40% · Hạ 20%).</span>`;
      if (pcs[0] > 0 && pcs[1] > 0 && pcs[2] > 0){
        html += `<div style="text-align:center;margin-top:8px"><button class="mini-btn" style="border-color:#e84a6a;color:#e84a6a" onclick="fuseBikip()">Dung Hợp Bí Kíp (30%)</button></div>
          <div style="font-size:11px;opacity:.65;text-align:center">Thất bại không mất tàn quyển — có thể thử lại vô hạn.</div><div id="bikip-msg" style="text-align:center;font-size:12px"></div>`;
      }
      html += `</div>`;
    }
  }
  html += aiChatBlock(n.id);
  panel.innerHTML = html;
  closePanels(); panel.classList.remove('hidden');
}

// ---------- Trả nhiệm vụ chính tuyến (override — thêm mở khóa map) ----------
window.turnInQuest = function(){
  AudioSys.sfx('quest', 0.9);
  const q = currentQuest();
  if (!q || questState !== 'done') return;
  player.silver += q.rew.silver || 0;
  player.mat += q.rew.mat || 0;
  if (q.rew.item && player.inv.length < 30){
    const gi = genSpecific(q.rew.item, 0, Math.max(1, player.level));
    player.inv.push(gi);
    addFloat(player.x, player.y-64, `Nhận được: ${gi.name}!`, '#9fd0ff', 14);
  }
  gainXp(q.rew.xp);
  questIdx++;
  questProg = 0;
  questState = questIdx < QUESTS.length ? 'active' : 'all';
  // QA endgame F2: mọi NV chính đều khóa theo cấp yêu cầu (q.lv) — chặn rush cốt truyện vượt cấp
  const nq = currentQuest();
  if (nq && player.level < nq.lv){
    questState = 'locked';
    addFloat(player.x, player.y-64, `"${nq.name}" cần cấp ${nq.lv} (hiện tại ${player.level}) — hãy rèn luyện thêm!`, '#f0a03a', 14);
  }
  if (questIdx === 9 && questState === 'active') spawnBoss(); // quest 10 — boss Đào Hoa
  // thông báo mở khóa vùng mới
  for (const id in MAPS){
    if (MAPS[id].reqMain === questIdx){
      zoneBanner = { text:'ĐÃ MỞ VÙNG MỚI', sub: `${MAPS[id].name} — bấm M để dịch chuyển`, color:'#ffd76a', t: 4 };
      addFloat(player.x, player.y-70, `🗺 Đã mở vùng: ${MAPS[id].name}!`, '#ffd76a', 16);
      AudioSys.sfx('levelup', 0.9);
    }
  }
  if (questState === 'all'){
    player.mongChiTon = true;
    zoneBanner = { text:'HUYỄN ẢNH CHÍ TÔN', sub:'Chính tuyến hoàn tất — danh hiệu tối thượng đã mở (bấm C chọn danh hiệu)', color:'#ffd76a', t: 5 };
    AudioSys.sfx('levelup', 1);
  }
  closePanels(); saveGame();
};

// ---------- Nói chuyện NPC (override — định tuyến theo loại) ----------
function tryTalk(){
  let best = null, bd = 95;
  for (const n of NPCS){
    if (n.map !== curMap) continue;
    const d = dist(player.x, player.y, n.x, n.y);
    if (d < bd){ bd = d; best = n; }
  }
  for (const n of tanNpcs){ // Nhân Mạch: tán tu
    if (n.map !== curMap) continue;
    const d = dist(player.x, player.y, n.x, n.y);
    if (d < bd){ bd = d; best = n; }
  }
  if (!best) return;
  tutAdvance('npc');
  questOnTalk(best);
  if (best.talk === 'quest'){ renderQuestNpc(best); return; }
  if (best.talk === 'forge'){ renderBaGua(); return; }
  if (best.talk === 'shop') return renderShop(best);
  if (best.talk === 'abode'){ renderAbode(); return; }
  if (best.talk === 'stable'){ renderStable(); return; } // GDD Đợt 2 B5
  if (best.talk === 'trunya'){ renderTruyNa(); return; }
  if (best.talk === 'vanduyen'){ renderVanDuyen(); return; }
  if (best.talk === 'tenui'){ renderTeNui(best); return; }
  if (best.talk === 'tantu'){ window.ttLine = ''; renderTanTuDlg(best); return; } // Nhân Mạch
}

// ═════════════ GIANG HỒ NHÂN MẠCH — Tán Tu & Quan Hệ (Quỷ Cốc Bát Hoang style) ═════════════
let tanNpcs = []; let tanKey = '';
function ttSeed(str){ let h = 2166136261; for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ttRng(seed){ let a = seed; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tanDay(){ return Math.floor(gameClock().t / GT_DAY); }
function tanWeek(){ return Math.floor(gameClock().t / (GT_DAY*7)); }
const TT_HO = ['Vân','Thẩm','Âu Dương','Đoan Mộc','Tư Mã','Nam Cung','Tiếu','Lệ','Mạc','Diệp','Tần','Cổ','Bạch','Lãnh','Sở','Phong'];
const TT_TEN_NAM = ['Thiên Hành','Vấn Đạo','Trường Không','Tịch Diệt','Cô Thành','Vô Song','Tử Khiên','Hàn Tinh','Phá Quân','Thương Minh','Khai Sơn','Mạc Ly'];
const TT_TEN_NU = ['Lăng Tuyết','Khuynh Thành','Mộng Dao','Thanh Nhi','Tiểu Thất','Tố Vấn','Nhược Thủy','Linh San','Bích Hà','Nguyệt Nghi','Hàn Y','Thiền Tâm'];
const TT_TRAITS = {
  chinh:{ name:'Chính Trực', chat:12, gift:1.0, love:1.0, duelHate:false, desc:'ngay thẳng, trọng nghĩa khí' },
  hao:  { name:'Hào Sảng',   chat:15, gift:1.3, love:1.0, duelHate:false, desc:'cởi mở, thích kết giao bằng hữu' },
  ngao: { name:'Ngạo Mạn',   chat:6,  gift:1.0, love:0.8, duelHate:true,  desc:'kiêu ngạo — thắng họ nhiều sẽ sinh thù hận' },
  ta:   { name:'Tà Mị',      chat:8,  gift:1.5, love:1.0, duelHate:true,  desc:'tà khí âm u, trọng lợi lạc, dễ ghi thù' },
  am:   { name:'Âm Hiểm',    chat:8,  gift:1.2, love:0.7, duelHate:false, desc:'khó lường, ít để lộ tâm tư' },
  on:   { name:'Ôn Hòa',     chat:12, gift:1.0, love:1.5, duelHate:false, desc:'ôn nhu dễ gần, tình cảm dễ nảy nở' },
  si:   { name:'Si Tình',    chat:10, gift:1.1, love:2.0, duelHate:false, desc:'đa tình, dễ rung động' },
  tham: { name:'Tham Lam',   chat:4,  gift:2.0, love:0.9, duelHate:false, desc:'tham tài — quà càng quý càng trọng ngươi' },
};
const HC_TIERS = [
  { min:0,   name:'Xa Lạ',            color:'#b8b0a0' },
  { min:100, name:'Quen Biết',        color:'#9fd0ff' },
  { min:250, name:'Hảo Hữu',          color:'#8ad88a' },
  { min:400, name:'Tri Kỷ',           color:'#5ac8b8' },
  { min:600, name:'Chí Giao',         color:'#e8c84a' },
  { min:800, name:'Sinh Tử Chi Giao', color:'#ff9a5a' },
];
function hcTier(s){ if (s <= -30) return { name:'Kết Thù', color:'#ff5a4a' }; let t = HC_TIERS[0]; for (const x of HC_TIERS) if (s >= x.min) t = x; return t; }
const TT_BOND_NAME = { ketbai:'⚑ Kết Bái', daolu:'❤ Đạo Lữ', suphu:'☯ Sư Phụ', dode:'☯ Đồ Đệ', cuthu:'⚔ Cừu Nhân' };
const TT_TP_POOL = ['tp_xuantam','tp_linhcam','tp_vanhanh','tp_thietbo','tp_thuathien','tp_bachhop','tp_hoigiang','tp_nhatnguyet','tp_thancong','tp_votuong','tp_lietdiem','tp_huyenamtp'];
const TT_LINES = {
  chinh:['Giang hồ loạn lạc, kẻ sĩ nên lấy nghĩa làm đầu.','Nghe nói Ngũ Ấn lại xao động — ngươi định xông pha chứ?','Đao kiếm vô tình, nhân tâm hữu nghĩa.'],
  hao:['Ha ha! Gặp ngươi là thấy hợp nhãn duyên!','Rượu ngon gặp tri âm, nâng chén nào!','Ngày mai ta định lên Võ Đương ngắm tuyết, ngươi thế nào?'],
  ngao:['Hừ, ngươi cũng xứng nói chuyện với ta sao... nhưng thôi, miễn cưỡng nghe.','Võ công của ta, cả giang hồ mấy ai địch nổi.','Đừng tưởng vài lễ vật mà mua được lòng ta.'],
  ta:['Chính đạo? Tà đạo? Thắng mới là đạo, hắc hắc.','Ta nghe nói vách Té Núi giờ Thìn có cơ duyên lớn đấy...','Ngươi có vẻ... rất có tiền đồ. Ta thích kẻ có tiền đồ.'],
  am:['...Ngươi tìm ta có việc gì?','Biết nhiều quá, không phải chuyện tốt đâu.','Giang hồ này, lợi ích mới là thật.'],
  on:['Trăng hôm nay thật đẹp, ngồi lại uống trà với ta không?','Tu luyện gấp gáp chi, tâm an vạn sự an.','Ngươi đến là ta vui rồi, không cần lễ vật chi.'],
  si:['Từ khi gặp ngươi, ta tu luyện cứ phân tâm...','Đêm qua ta mơ thấy... thôi, không nói đâu.','Nếu có kiếp sau, mong sớm gặp ngươi hơn.'],
  tham:['Ngươi mang theo gì quý không? Cho ta xem chút!','Bạc không phải vạn năng, nhưng không bạc thì... ngươi hiểu mà.','Ta thu mọi thứ — trừ lừa gạt.'],
};
const TT_GIFTS = [
  { id:'silver',    name:'Lễ Bạc 500◈',      val:14, can:() => player.silver >= 500,        pay:() => { player.silver -= 500; } },
  { id:'mat',       name:'Huyền Thiết ×5',   val:26, can:() => player.mat >= 5,             pay:() => { player.mat -= 5; } },
  { id:'tiendan',   name:'Tiên Đan ×2',      val:38, can:() => player.tienDan >= 2,         pay:() => { player.tienDan -= 2; } },
  { id:'tula',      name:'Tu La Tinh Thạch', val:60, can:() => player.gems.tuLa >= 1,       pay:() => { player.gems.tuLa--; } },
  { id:'honnguyen', name:'Hỗn Nguyên Thạch', val:85, can:() => player.gems.honNguyen >= 1,  pay:() => { player.gems.honNguyen--; } },
];
function genTanTu(mapId, idx, rng){
  const gender = rng() < 0.5 ? 'nam' : 'nu';
  const name = TT_HO[Math.floor(rng()*TT_HO.length)] + ' ' + (gender === 'nam' ? TT_TEN_NAM[Math.floor(rng()*TT_TEN_NAM.length)] : TT_TEN_NU[Math.floor(rng()*TT_TEN_NU.length)]);
  const sectKeys = Object.keys(SECTS);
  const traitKeys = Object.keys(TT_TRAITS);
  const pr = (player.dantian && player.dantian.realm) || 0;
  return {
    id:`tt_${mapId}_${tanWeek()}_${idx}`, name, gender,
    phai: sectKeys[Math.floor(rng()*sectKeys.length)],
    trait: traitKeys[Math.floor(rng()*traitKeys.length)],
    realm: clamp(Math.round(pr + (rng()*4 - 1.5)), 2, DANTIAN_REALMS.length - 1),
    tp: TT_TP_POOL[(idx*2 + tanWeek()) % TT_TP_POOL.length],
    map: mapId, talk:'tantu',
    x: rnd(260, MAP.w-260), y: rnd(260, MAP.h-260), tx: null, ty: null, waitT: 0, face: 0, wob: Math.random()*10,
  };
}
function ensureTanNpcs(){
  if (!player || typeof curMap === 'undefined' || !curMap) return;
  const key = curMap + '_' + tanWeek();
  if (tanKey === key && tanNpcs.length) return;
  tanKey = key;
  const rng = ttRng(ttSeed('tantu_' + key));
  const n = 3 + Math.floor(rng()*2); // 3-4 tán tu mỗi bản đồ, luân phiên theo tuần (Lịch Tu Tiên)
  tanNpcs = [];
  for (let i=0;i<n;i++) tanNpcs.push(genTanTu(curMap, i, rng));
}
function ttRel(n){
  if (!player.relations) player.relations = {};
  if (!player.relations[n.id]) player.relations[n.id] = { score:0, love:0, bond:'none', name:n.name, phai:n.phai, gender:n.gender, realm:n.realm, trait:n.trait, met:tanDay(), chatDay:-1, duelW:0, duelL:0, luandao:false, ambWeek:-1 };
  return player.relations[n.id];
}
function updateTanNpcs(dt){
  ensureTanNpcs();
  for (const n of tanNpcs){
    // Neo vị trí cố định — tán tu đứng một chỗ quen thuộc, chỉ khẽ đung đưa (±18px) để ngườ​i chơi dễ nhớ
    if (n.hx == null){ n.hx = n.x; n.hy = n.y; n.tx = n.x; n.ty = n.y; }
    n.waitT -= dt;
    if (n.waitT <= 0){ n.tx = n.hx + rnd(-18, 18); n.ty = n.hy + rnd(-18, 18); n.waitT = rnd(3, 8); }
    if (n.tx != null && dist(n.x, n.y, n.tx, n.ty) > 5){ const ang = Math.atan2(n.ty - n.y, n.tx - n.x); n.x += Math.cos(ang)*10*dt; n.y += Math.sin(ang)*10*dt; n.face = ang; }
    // Cừu nhân phục kích — mỗi tuần một lần khi chạm mặt
    const rel = player.relations && player.relations[n.id];
    if (rel && rel.bond === 'cuthu' && rel.ambWeek !== tanWeek() && dist(player.x, player.y, n.x, n.y) < 250){
      rel.ambWeek = tanWeek();
      zoneBanner = { text:'⚔ PHỤC KÍCH!', sub:`${n.name} dẫn môn khả đến trả thù — chống đỡ!`, color:'#ff5a4a', t:4 };
      for (let i=0;i<2;i++) spawnMob('assassin', { x:player.x, y:player.y, r:130 });
      AudioSys.sfx('hurt', 0.7); saveGame();
    }
  }
}
function drawTanNpcs(){
  for (const n of tanNpcs){
    if (n.map !== curMap) continue;
    const sc = SECTS[n.phai], rel = player.relations && player.relations[n.id];
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(n.x, n.y+8, 13, 5, 0, 0, 7); ctx.fill();
    const bob = Math.sin(Date.now()/500 + n.wob)*1.5;
    const _tim = ttImg(n);
    if (_tim){
      const sh = 62, sw = sh * _tim.naturalWidth / _tim.naturalHeight;
      ctx.drawImage(_tim, n.x - sw/2, n.y - sh + 10 + bob*0.5, sw, sh);
    } else {
      ctx.fillStyle = sc.color; ctx.beginPath(); ctx.ellipse(n.x, n.y-8+bob*0.3, 10, 14, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(n.x, n.y-15, 5, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(n.x, n.y-26, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1712';
      if (n.gender === 'nu'){ ctx.beginPath(); ctx.arc(n.x, n.y-30, 5.5, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(n.x-5, n.y-28, 2.4, 0, 7); ctx.arc(n.x+5, n.y-28, 2.4, 0, 7); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(n.x, n.y-30, 4.2, Math.PI, 0); ctx.fill(); ctx.fillRect(n.x-1, n.y-37, 2, 5); }
    }
    if (rel && rel.score >= 400 && rel.bond !== 'cuthu'){ ctx.strokeStyle = 'rgba(255,215,106,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y-12, 17 + Math.sin(Date.now()/400)*2, 0, 7); ctx.stroke(); }
    ctx.font = '11px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
    const tag = rel && TT_BOND_NAME[rel.bond] ? ' ' + TT_BOND_NAME[rel.bond].split(' ')[0] : '';
    ctx.fillStyle = rel && rel.bond === 'cuthu' ? '#ff7a6a' : rel && rel.score >= 250 ? '#ffd76a' : '#fff';
    ctx.strokeText(n.name + tag, n.x, n.y-56); ctx.fillText(n.name + tag, n.x, n.y-56);
    if (rel){ const t2 = hcTier(rel.score); ctx.font = '9.5px "Be Vietnam Pro", sans-serif'; ctx.fillStyle = t2.color; ctx.strokeText(t2.name, n.x, n.y-45); ctx.fillText(t2.name, n.x, n.y-45); }
  }
}

// ---------- Đối thoại tán tu ----------
window.ttCur = null; window.ttLine = '';
function renderTanTuDlg(n){
  window.ttCur = n.id;
  const rel = ttRel(n), tr = TT_TRAITS[n.trait], tier = hcTier(rel.score), sc = SECTS[n.phai];
  const opp = n.gender !== player.gender;
  let html = `<h3>${n.gender === 'nu' ? '🌸' : '🗡'} ${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="text-align:center;margin:-4px 0 4px"><img src="assets/tantu/${n.phai}_${n.gender}.png" alt="${n.name}" style="height:150px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));border-radius:8px" onerror="this.style.display='none'"></div>`;
  html += `<div style="font-size:12px;color:#b8a878;line-height:1.7;margin-bottom:6px">
    <b style="color:${sc.color}">${sc.name}</b> · ${DANTIAN_REALMS[n.realm].name} · Tính cách: <b style="color:#f0d68a">${tr.name}</b> <span style="opacity:.65">(${tr.desc})</span></div>`;
  html += `<div style="font-size:11.5px;margin-bottom:2px">Hảo cảm: <b style="color:${tier.color}">${tier.name}</b> (${rel.score})${rel.bond !== 'none' ? ` · <b style="color:#ffd76a">${TT_BOND_NAME[rel.bond] || ''}</b>` : ''}</div>`;
  html += `<div style="height:6px;background:rgba(0,0,0,.4);border-radius:3px;margin-bottom:6px"><div style="height:100%;width:${clamp(rel.score/10, 0, 100)}%;background:${tier.color};border-radius:3px"></div></div>`;
  if (opp) html += `<div style="font-size:11.5px;margin-bottom:6px;color:#ffb8d0">❤ Tình cảm: ${rel.love}/100${player.daolu ? (player.daolu === n.id ? ' — đạo lữ của ngươi' : ' (ngươi đã có đạo lữ)') : ''}</div>`;
  if (window.ttLine) html += `<div style="font-size:12.5px;font-style:italic;color:#e8dcc0;background:rgba(0,0,0,.25);padding:8px 10px;border-radius:8px;margin-bottom:8px;line-height:1.6">“${window.ttLine}”</div>`;
  const chatted = rel.chatDay === tanDay();
  const btns = [];
  btns.push(`<button class="mini-btn" ${chatted ? 'disabled' : ''} onclick="ttAct('chat')">💬 Tán Gẫu${chatted ? ' (hôm nay rồi)' : ''}</button>`);
  btns.push(`<button class="mini-btn" onclick="ttAct('giftmenu')">🎁 Tặng Quà</button>`);
  btns.push(`<button class="mini-btn" onclick="ttAct('duel')">⚔ Tỷ Thí</button>`);
  if (rel.bond !== 'cuthu'){
    if (!rel.luandao && (rel.score >= 400 || rel.bond === 'suphu')) btns.push(`<button class="mini-btn" style="border-color:#5ac8b8" onclick="ttAct('luandao')">📖 Luận Đạo — truyền thụ ${VOHOC_DEFS[n.tp].name}</button>`);
    if (rel.bond === 'none' && rel.score >= 600) btns.push(`<button class="mini-btn" style="border-color:#e8c84a" onclick="ttAct('ketbai')">⚑ Kết Bái huynh đệ / tỷ muội</button>`);
    if (opp && !player.daolu && (rel.bond === 'none' || rel.bond === 'ketbai') && rel.score >= 250 && rel.love >= 60) btns.push(`<button class="mini-btn" style="border-color:#ffb8d0" onclick="ttAct('totinh')">❤ Tỏ Tình — cầu đạo lữ</button>`);
    const pr = (player.dantian && player.dantian.realm) || 0;
    if (rel.bond === 'none' && n.realm >= pr + 2 && rel.score >= 400 && !player.suphu) btns.push(`<button class="mini-btn" style="border-color:#b08ae8" onclick="ttAct('baisu')">☯ Bái Sư — ${sc.name} ${n.name}</button>`);
  } else {
    btns.push(`<div style="font-size:11.5px;color:#ff7a6a">⚔ Cừu nhân — hắn sẽ phục kích ngươi khi chạm mặt! Tặng lễ quý để hòa giải.</div>`);
  }
  html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">${btns.join('')}</div>`;
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
function ttFind(){ return tanNpcs.find(x => x.id === window.ttCur); }
window.ttAct = function(act, arg){
  const n = ttFind(); if (!n){ closePanels(); return; }
  const rel = ttRel(n), tr = TT_TRAITS[n.trait], opp = n.gender !== player.gender;
  const say = t => { window.ttLine = t; };
  if (act === 'chat'){
    if (rel.chatDay === tanDay()){ say('Hôm nay nói nhiều rồi, ngày mai ghé lại nhé.'); }
    else {
      rel.chatDay = tanDay();
      const gain = tr.chat + Math.floor(rnd(0, 7));
      rel.score = clamp(rel.score + gain, -100, 1000);
      if (opp) rel.love = clamp(rel.love + Math.round(2*tr.love), 0, 100);
      say(TT_LINES[n.trait][Math.floor(Math.random()*TT_LINES[n.trait].length)] + ` (+${gain} hảo cảm)`);
      AudioSys.sfx('ui', 0.6);
    }
  } else if (act === 'giftmenu'){
    let g = `<div style="margin-top:8px">`;
    for (const gf of TT_GIFTS) g += `<div class="npc-shop-row"><span><b style="color:#f0d68a">${gf.name}</b><br><span style="font-size:11px;opacity:.7">+${Math.round(gf.val*tr.gift)} hảo cảm${opp ? ` · +${Math.round(gf.val*0.3*tr.love)} tình cảm` : ''}</span></span><button class="mini-btn" ${gf.can() ? '' : 'disabled'} onclick="ttAct('gift','${gf.id}')">Tặng</button></div>`;
    g += `</div>`;
    el('panel-quest').innerHTML = `<h3>🎁 Tặng quà cho ${n.name}</h3><button class="close-x" onclick="renderTanTuDlg(ttFind())">←</button>` + g;
    return;
  } else if (act === 'gift'){
    const gf = TT_GIFTS.find(x => x.id === arg); if (!gf || !gf.can()) return;
    gf.pay();
    const gain = Math.round(gf.val * tr.gift);
    rel.score = clamp(rel.score + gain, -100, 1000);
    if (opp) rel.love = clamp(rel.love + Math.round(gf.val*0.3*tr.love), 0, 100);
    say(`${n.name} nhận ${gf.name} — ${rel.bond === 'cuthu' ? 'sắc mặt dịu hẳn.' : 'rất hài lòng!'} (+${gain} hảo cảm)`);
    if (rel.bond === 'cuthu' && rel.score >= -10){ rel.bond = 'none'; zoneBanner = { text:'🕊 HÒA GIẢI', sub:`${n.name} chấp nhận lễ bồi — mối thù xem như xóa nhòa`, color:'#8ad88a', t:4 }; }
    AudioSys.sfx('ui', 0.7);
  } else if (act === 'duel'){
    const pr = (player.dantian && player.dantian.realm) || 0;
    const pPow = player.atk + player.maxHp/8 + pr*80, nPow = n.realm*150 + 200 + rnd(0, 160);
    const win = Math.random() < pPow/(pPow + nPow);
    if (win){
      rel.duelW++;
      if (tr.duelHate){
        rel.score = clamp(rel.score - 30, -100, 1000);
        say(`Ngươi thắng rồi... nhưng mối nhục này ${n.name} GHI NHỚ! (-30 hảo cảm)`);
        if (rel.duelW >= 2 && rel.bond !== 'cuthu'){ rel.bond = 'cuthu'; rel.score = Math.min(rel.score, -50); zoneBanner = { text:'⚔ KẾT THÙ GIANG HỒ', sub:`${n.name} thề sẽ trả mối nhục này — coi chừng phục kích!`, color:'#ff5a4a', t:4.5 }; }
      } else { rel.score = clamp(rel.score + 18, -100, 1000); if (opp) rel.love = clamp(rel.love + Math.round(4*tr.love), 0, 100); say(`Hay lắm! ${n.name} thua tâm phục khẩu phục — võ công của ngươi thật xuất thần! (+18 hảo cảm)`); }
    } else {
      rel.duelL++; player.hp = Math.max(1, Math.round(player.hp * 0.85));
      rel.score = clamp(rel.score + 5, -100, 1000);
      say(`${n.name} thắng nhưng vẫn dừng tay đúng lúc — "võ công ngươi cũng có chút ý tứ". (+5 hảo cảm, mất ít HP)`);
    }
    AudioSys.sfx('crit', 0.7);
  } else if (act === 'luandao'){
    rel.luandao = true;
    const tp = VOHOC_DEFS[n.tp];
    if (vhLearned(n.tp)){ player.bikipVH = (player.bikipVH || 0) + 2; say(`Hai ngườ​i luận đạo suốt đêm — tâm pháp đã thông, ${n.name} tặng thêm 2 📜 Bí Kíp.`); }
    else { player.vohoc[n.tp] = true; say(`${n.name} truyền thụ gia bảo: 【${tp.name}】— ${tp.desc}`); zoneBanner = { text:'📖 LUẬN ĐẠO NGỘ PHÁP', sub:`Lĩnh hội ${tp.name} — tâm pháp gia truyền của ${n.name}`, color:'#5ac8b8', t:4.5 }; }
    rel.score = clamp(rel.score + 10, -100, 1000);
    calcDerived(); AudioSys.sfx('levelup', 0.9);
  } else if (act === 'ketbai'){
    rel.bond = 'ketbai'; player.bikipVH = (player.bikipVH || 0) + 3; player.tienDan = (player.tienDan || 0) + 2;
    zoneBanner = { text:'⚑ KIM LAN KẾT NGHĨA', sub:`${n.name} — từ nay phúc cùng hưởng, họa cùng chia (+2% ST vĩnh viễn, +3📜)`, color:'#e8c84a', t:5 };
    say(`Hoàng thiên hậu thổ chứng giám — từ nay ta là huynh đệ/tỷ muội một nhà!`);
    calcDerived(); AudioSys.sfx('levelup', 1);
  } else if (act === 'totinh'){
    const chance = 0.5 + rel.love/200;
    if (Math.random() < chance){
      rel.bond = 'daolu'; player.daolu = n.id;
      zoneBanner = { text:'❤ ĐẠO LỮ ĐỊNH TAM SINH', sub:`${n.name} nhận lỡi — song tu chi lộ bắt đầu (+8% hồi chân khí, +5% HP)`, color:'#ffb8d0', t:5 };
      say(`${n.name} đỏ mặt gật đầu... từ nay non sông cùng đi, sinh tử cùng gánh.`);
      calcDerived(); AudioSys.sfx('levelup', 1);
      AudioSys.playBgm(BGM_ROMANCE); // Tiếu Vấn Tình Duyên — song ca chúc phúc đạo lữ
    } else { rel.score = clamp(rel.score - 20, -100, 1000); rel.love = clamp(rel.love - 15, 0, 100); say(`${n.name} lắc đầu: "Duyên phận... chưa tới." (-20 hảo cảm, -15 tình cảm)`); }
  } else if (act === 'baisu'){
    rel.bond = 'suphu'; player.suphu = n.id;
    zoneBanner = { text:'☯ BÁI SƯ THỤ NGHIỆP', sub:`${n.name} nhận ngươi làm đồ đệ — +10% kinh nghiệm, Luận Đạo không cần Tri Kỷ`, color:'#b08ae8', t:5 };
    say(`${n.name} đỡ ngươi dậy: "Đồ nhi, từ nay chăm chỉ tu luyện."`);
    calcDerived(); AudioSys.sfx('levelup', 1);
  }
  saveGame(); renderTanTuDlg(n);
};
// ---------- Bảng Nhân Mạch (phím L) ----------
function renderRelationPanel(){
  const rels = player.relations || {};
  let html = `<h3>🏮 Giang Hồ Nhân Mạch</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:11.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">Tán tu lang bạt giang hồ — Tán Gẫu mỗi ngày, Tặng Quà, Tỷ Thí để tăng hảo cảm. Đến <b style="color:#5ac8b8">Tri Kỷ</b> có thể <b>Luận Đạo</b> nhận tâm pháp gia truyền; <b style="color:#e8c84a">Chí Giao</b> mở Kết Bái. Danh sách luân phiên theo tuần (Lịch Tu Tiên).</div>`;
  const ids = Object.keys(rels).sort((a, b) => (rels[b].score) - (rels[a].score));
  if (!ids.length) html += `<div style="opacity:.6;font-size:12px">Chưa quen biết ai — đi ra ngoài tìm các tán tu đang lang bạt, lại gần bấm E.</div>`;
  for (const id of ids){
    const r = rels[id], tier = hcTier(r.score), sc = SECTS[r.phai] || { color:'#aaa', name:'?' };
    const live = tanNpcs.find(x => x.id === id);
    const _av = `<img src="assets/tantu/${r.phai}_${r.gender}.png" style="height:40px;vertical-align:top;margin-right:6px;border-radius:5px;float:left" onerror="this.style.display='none'">`;
    const bondTxt = r.bond !== 'none' ? ` · <b style="color:#ffd76a">${TT_BOND_NAME[r.bond] || ''}</b>` : '';
    html += `<div class="npc-shop-row" style="align-items:flex-start"><span style="flex:1">
      ${_av}<b style="color:${sc.color}">${r.gender === 'nu' ? '🌸' : '🗡'} ${r.name}</b> <span style="font-size:10.5px;opacity:.65">${sc.name} · ${DANTIAN_REALMS[r.realm] ? DANTIAN_REALMS[r.realm].name : ''} · ${TT_TRAITS[r.trait] ? TT_TRAITS[r.trait].name : ''}</span><br>
      <span style="font-size:11px;color:${tier.color}">${tier.name} (${r.score})</span>${bondTxt}${r.love > 0 ? ` <span style="font-size:11px;color:#ffb8d0">· ❤ ${r.love}</span>` : ''}<br>
      <div style="height:4px;background:rgba(0,0,0,.4);border-radius:2px;margin:3px 0;max-width:220px"><div style="height:100%;width:${clamp(r.score/10, 0, 100)}%;background:${tier.color};border-radius:2px"></div></div>
      <span style="font-size:10px;opacity:.55">${live ? '📍 Đang ở ' + (MAPS[curMap] ? MAPS[curMap].name : curMap) + ' — lại gần bấm E' : '☁ Vân du bất định — gặp lại theo tuần'}</span>
    </span>${live ? `<button class="mini-btn" onclick="renderTanTuDlg(tanNpcs.find(x=>x.id==='${id}'))">Gặp</button>` : ''}</div>`;
  }
  el('panel-relation').innerHTML = html;
}

// ---------- Vẽ NPC (override — dấu ! / … theo từng NPC) ----------
function drawNpc(){
  for (const n of NPCS){
    if (n.map !== curMap) continue;
    const im = NPC_IMGS[n.id];
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(n.x, n.y+8, 14, 5, 0, 0, 7); ctx.fill();
    if (im && im.complete && im.naturalWidth){
      const nh = 64, nw = nh * (im.naturalWidth/im.naturalHeight);
      ctx.drawImage(im, n.x - nw/2, n.y - nh + 10, nw, nh);
    } else {
      ctx.fillStyle = '#5a4a30';
      ctx.beginPath(); ctx.ellipse(n.x, n.y-8, 11, 15, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8cfa8'; ctx.beginPath(); ctx.arc(n.x, n.y-28, 7, 0, 7); ctx.fill();
    }
    ctx.font = '12px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
    if (n.talk === 'quest'){
      const q = currentQuest();
      let mark = '';
      if ((q && q.npc === n.id && questState === 'done') ||
          SIDE_QUESTS.some(sq => sq.npc === n.id && sideStates[sq.id] && sideStates[sq.id].st === 'done'))
        mark = '!';
      else if ((q && q.npc === n.id) ||
               SIDE_QUESTS.some(sq => sq.npc === n.id && (sideAvail(sq) === 'avail' || sideAvail(sq) === 'active')))
        mark = '…';
      if (mark){
        ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif';
        ctx.fillStyle = mark === '!' ? '#ffd76a' : '#9fd0ff';
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6;
        ctx.strokeText(mark, n.x, n.y-64); ctx.fillText(mark, n.x, n.y-64);
        ctx.shadowBlur = 0;
        ctx.font = '12px "Be Vietnam Pro", sans-serif';
      }
    }
    if (n.talk === 'trunya' && player.truyna && player.truyna.state === 'killed'){
      ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif';
      ctx.fillStyle = '#ffd76a'; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 6;
      ctx.strokeText('!', n.x, n.y-64); ctx.fillText('!', n.x, n.y-64);
      ctx.shadowBlur = 0; ctx.font = '12px "Be Vietnam Pro", sans-serif';
    }
    ctx.fillStyle = '#fff';
    ctx.strokeText(n.name, n.x, n.y-52); ctx.fillText(n.name, n.x, n.y-52);
  }
}

// ---------- Quest tracker (HUD) ----------
function trackerHtml(){
  const q = currentQuest();
  let qt = '';
  if (q){
    const prog = q.type === 'meditate' ? `${Math.floor(questProg)}/${q.need}s`
      : q.type === 'talk' ? '' : `${questProg}/${q.need}`;
    qt += `<div class="q-title">★ ${q.name}</div>`;
    qt += questState === 'done'
      ? `<div class="q-done">✔ Hoàn thành — về gặp ${npcName(q.npc)} (E)</div>`
      : questState === 'locked'
      ? `<div style="color:#f0a03a">🔒 "${q.name}" cần cấp ${q.lv} (hiện tại cấp ${player.level}).<br>Hãy săn quái rèn luyện thêm rồi quay lại!</div>`
      : `<div>${q.desc}</div>${prog ? `<div style="margin-top:4px;color:#f0d68a">${prog}</div>` : ''}`;
    qt += `<div style="margin-top:5px"><button class="mini-btn" style="font-size:11px;padding:2px 10px" onclick="goQuest()">🧭 Tới Ngay</button></div>`; // GDD Đợt 2 B2
  } else {
    qt += `<div class="q-title">★ Chính tuyến hoàn tất!</div><div>Ngươi là Huyễn Ảnh Chí Tôn — tự do rèn luyện & làm phụ tuyến…</div>`;
  }
  const act = SIDE_QUESTS.filter(sq => sideStates[sq.id] && sideStates[sq.id].st !== 'claimed').slice(0, 2);
  for (const sq of act){
    const st = sideStates[sq.id];
    qt += `<div class="q-side">◈ ${sq.name} — ${st.st === 'done'
      ? `<span style="color:#8fd18f">✔ về gặp ${npcName(sq.npc)}</span>`
      : `<span style="color:#f0d68a">${st.prog}/${sq.need}</span>`}</div>`;
    qt += `<button class="mini-btn" style="font-size:10px;padding:1px 8px;margin-top:2px" onclick="goQuestSide('${sq.id}')">🧭 Tới</button>`; // GDD Đợt 2 B2
  }
  // Mục Tiêu Hôm Nay — checklist nhỏ, định hướng ngày chơi cho tân thủ
  qt += dailyHtml();
  return qt;
}

// ---------- Nhật Ký Nhiệm Vụ (phím Q) — phân theo vùng ----------
window.qlogTab = 'main';
// ═══════════ CỐT TRUYỆN NGŨ ẤN × TÔNG MÔN — manh mối, lời thoại trấn thủ, kết mở ═══════════
const CLUES = {
  manh_lenh:   { name:'Mảnh Lệnh Bài Đen',        desc:'Nửa lệnh bài khắc chữ "Hắc Phong" — mặt sau in dấu ấn lạ, hình mặt quỷ đỏ.' },
  ban_do_da:   { name:'Bản Đồ Da Thú',            desc:'Tấm da khắc đường đi từ Hắc Phong Trại lên Chung Nam — có vệt máu khô.' },
  tan_quyen:   { name:'Tàn Quyển «Ngũ Ấn Ký»',    desc:'"…năm ấn trấn Ma Tôn tại Tịch Ma Điện. Một ấn vỡ, bốn ấn lung lay…"' },
  cot_nhan:    { name:'Cốt Nhạn Khắc Chữ',        desc:'Mảnh xương nhạn khắc hàng chữ nhỏ: "Ấn vỡ không phải do ma — mà do người."' },
  thiep_den:   { name:'Thiếp Đen Vô Danh',        desc:'Thiếp mời "thịnh yến" của Ma Giáo — chỉ có ngày giờ, không hề có địa danh.' },
  co_thu:      { name:'Cổ Thư Rách',              desc:'Trang sách phong ấn: "Kim Ấn vỡ năm ấy, Tiêu Dao Cốc diệt môn — không một ai sống sót."' },
  di_thu:      { name:'Di Thư Chân Nhân',         desc:'"Sư môn phụ bạc ta… nhưng trấn ấn này, ta gánh đến cùng." — nét chữ run rẩy.' },
  phuc_lanh:   { name:'Phúc Lệnh Huyết Ma',       desc:'Sắc lệnh triệu quân: "Mộc Ấn dao động — thúc quân Nam Hãn, đêm rằm tháng bảy."' },
  buc_hoa:     { name:'Bích Họa Ngũ Ấn',          desc:'Tranh vẽ năm phong ấn Kim Mộc Thủy Hỏa Thổ — vị trí Kim Ấn chỉ còn một vết cháy đen.' },
  thu_tinh:    { name:'Thư Tình Chưa Gửi',        desc:'"Nếu có kiếp sau, ta không làm Cốc Chủ, nàng đừng làm đệ tử…"' },
  lenh_bai_doi:{ name:'Lệnh Bài Đồi Mộ Cổ',       desc:'Lệnh bài bằng xương khắc tên bảy vị tông sư trấn ấn — hai cái tên đã bị cạo sạch.' },
  co_lenh:     { name:'Cổ Lệnh Chinh Phạt',       desc:'Văn thư triều đình: "Nhạn Môn thất thủ thì Trung Nguyên mở toang." Dấu triện đã 60 năm.' },
  le_thach:    { name:'Lệ Thạch Đoản Thiên',      desc:'Mảnh đá nhuốm máu: "Đừng tin bất kỳ ai mang lệnh bài đen — kể cả sư môn ngươi."' },
  mat_lenh:    { name:'Mật Lệnh Rách',            desc:'"…khi đủ năm ấn vỡ, Vạn Ma Điện mở — Ma Tôn giáng thế, giang hồ thành lò luyện."' },
  thu_cuoi:    { name:'Thư Cuối Của Quan Chủ',    desc:'"Ta giữ Nhạn Môn ba mươi năm. Hôm nay ta mở cửa — không phải vì hàng, mà vì hết cách."' },
};
const CLUE_DROPS = {
  dh1:'manh_lenh', dh3:'ban_do_da', dh4:'tan_quyen',
  ng2:'cot_nhan', ng4:'thiep_den',
  cn1:'co_thu', cn4:'di_thu',
  cm4:'phuc_lanh',
  tt1:'buc_hoa', tt4:'thu_tinh',
  mc1:'lenh_bai_doi',
  nm1:'co_lenh', nm2:'le_thach', nm3:'mat_lenh', nm4:'thu_cuoi',
};
const BOSS_LORE = {
  dh1:{ name:'Dã Trư Vương', intro:['Grao…! Con mồi dám bước vào lãnh địa của bổn vương?!'] },
  dh2:{ name:'Sói Đầu Đàn', intro:['Trăng lên rồi.','Bầy sói của ta đói lắm, khách nhân à.'] },
  dh3:{ name:'Hắc Phong Chấp Sự', intro:['Hắc Phong Trại không chờ kẻ nhát.','Giao hành lý — hoặc giao mạng!'] },
  dh4:{ name:'Hắc Phong Trại Chủ', intro:['Lệnh bài đen kia… ngươi lấy từ đâu?!','Hỏa Ấn của giang hồ sắp vỡ rồi — ta chỉ đi trước một bước.'], sect:{ daohoa:'Đệ tử Đào Hoa à… sư tỷ ngươi từng quỳ gối trong trại này đấy, ha!' } },
  ng1:{ name:'Sơn Tặc Đầu Mục', intro:['Bạch Đà Sơn mấy dặm chỉ có một đường sống — đường của ta!','Lên! Giết!'] },
  ng2:{ name:'Độc Nhãn Lang Vương', intro:['Một con mắt mất, mười năm hận.','Đêm nay lang vương ăn thịt người.'] },
  ng3:{ name:'Hắc Y Sát Thủ', intro:['…','Ta không có tên. Chỉ có giá tiền.'] },
  ng4:{ name:'Bạch Diện Ma Quân', intro:['Khuôn mặt trắng này nhớ mùi máu lắm.','Mộc Ấn đang rung chuyển — ngươi nghe thấy không?'], sect:{ baidasan:'Độc công Bạch Đà Sơn? Cho ngươi xem độc của Ma Giáo này.' } },
  cn1:{ name:'Phản Đồ Đạo Sĩ', intro:['Đạo gì chứ! Trường sinh mới là thật!','Ngươi dám cản đạo lộ của ta?'] },
  cn2:{ name:'Huyền Giáp Thần Quy', intro:['Nghìn năm, giáp này chưa từng vỡ.','Đến đây, tiểu bối.'] },
  cn3:{ name:'Phản Đồ Chân Nhân', intro:['Chung Nam từng là nhà của ta…','Trấn ấn này giam ta — hay giam cả Ma Tôn?'], sect:{ toanchan:'Đệ tử ngoan của sư huynh… ngươi đến giết ta à?' } },
  cn4:{ name:'Thái Hư Kiếm Thánh', intro:['Kiếm của ta chỉ vỡ một lần — lần đó ta thua.','Thủy Ấn do ta giữ. Muốn qua? Hỏi thanh kiếm này.'], sect:{ toanchan:'Toàn Chân hậu bối… ra tay đừng nương tình.' } },
  cm1:{ name:'Thi Binh Thống Lĩnh', intro:['Lăng mộ này không chờ người sống.','Quân ta chết rồi — nhưng chưa tan.'] },
  cm2:{ name:'Âm Dương Táng Giả', intro:['Táng người, táng thần, táng cả trời.','Nằm xuống đi, khách nhân.'] },
  cm3:{ name:'Thi Vương Bất Tử', intro:['Bất tử không phải phúc — là phạt.','Ở lại cùng ta!'] },
  cm4:{ name:'Cổ Mộ Tổ Sư', intro:['Ai đánh thức giấc ngủ ngàn năm của lão phu?','Mộc Ấn đã mục từ lâu — giang hồ mới là bệnh.'], sect:{ comoc:'Cốc chủ đời này đến rồi à… đồ đệ của ta dạo này có khỏe không?' } },
  tt1:{ name:'Tình Nhi Tuyệt Vọng', intro:['Chàng bỏ ta… cả thiên hạ bỏ ta!','Cắt tình — đoạn tuyệt!'] },
  tt2:{ name:'Hồ Ly Cửu Vĩ', intro:['Chín đuôi, chín kiếp, chín mối tình dở.','Ngươi có tình không? Cho ta xem nào.'] },
  tt3:{ name:'Tuyệt Tình Ma Nữ', intro:['Tình là bệnh, ta là thuốc.','Tuyệt tình quyết — đệ nhất bi khúc giang hồ.'] },
  tt4:{ name:'Tuyệt Tình Cốc Chủ', intro:['Cốc này chôn bao nhiêu kẻ đa tình rồi…','Đến lượt ngươi.'], sect:{ thieulam:'Thiếu Lâm từng độ hóa ta — không thành. Hôm nay ngươi thử xem?' } },
  mc1:{ name:'Thiết Kỵ Bách Phu Trưởng', intro:['Thảo nguyên chỉ nhận kẻ mạnh!','Kỵ binh — bày trận!'] },
  mc2:{ name:'Thần Tiễn Hãn Tử', intro:['Một tên một mạng — ta có cả nghìn tên.','Đứng yên nào.'] },
  mc3:{ name:'Hãn Vương Thiết Kỵ', intro:['Đại hãn truyền lệnh — ta chính là lệnh!','Nghiền nát chúng!'] },
  mc4:{ name:'Đột Thông Đại Hãn', intro:['Nam Hãn ngàn dặm — vì sao dừng ở đây? Vì Kim Ấn đã vỡ!','Người Trung Nguyên… chứng minh đi.'], sect:{ doanthi:'Đoàn Thị hoàng tộc? Hừ, Đại Lý cũng chỉ là một bàn cờ.' } },
  nm1:{ name:'Liêu Quốc Dũng Tướng', intro:['Nhạn Môn ba mươi năm không gãy — hôm nay cũng vậy!','Tướng sĩ! Giữ ải!'] },
  nm2:{ name:'Sa Trường Huyết Sát', intro:['Máu trên giáp ta chưa bao giờ khô.','Thêm một mạng nữa!'] },
  nm3:{ name:'Cô Thành Tướng Quân', intro:['Thành này cô độc — ta cũng vậy.','Qua đây… nếu ngươi đủ nặng ký.'] },
  nm4:{ name:'Nhạn Môn Quan Chủ', intro:['Ta mở cửa không phải vì hàng — mà vì hết cách.','Hỏa Ấn cuối cùng… để ta xem ngươi giữ nổi không!'], sect:{ minhgiao:'Minh Giáo… hay Ma Giáo? Lửa của ngươi cháy về phía nào?' } },
};
// Hàng thoại trấn thủ — thanh bar dưới màn hình, 3.4s/câu
let _btQ = [], _btTimer = null;
function showBossTalk(name, lines){
  const el = document.getElementById('boss-talk');
  if (!el || !lines || !lines.length) return;
  _btQ = lines.slice();
  el.classList.remove('hidden');
  _btRender(el, name);
}
function _btRender(el, name){
  if (!_btQ.length){ el.classList.add('hidden'); return; }
  const line = _btQ.shift();
  el.innerHTML = `<span class="bt-name">${name}</span><span class="bt-line">${line}</span>`;
  clearTimeout(_btTimer);
  _btTimer = setTimeout(() => _btRender(el, name), 3400);
}
function bossIntro(m){
  const L = BOSS_LORE[m.def.bossId];
  if (!L) return;
  if (!player.storySeen) player.storySeen = {};
  player.storySeen[m.def.bossId] = true;
  const lines = L.intro.slice();
  const sl = L.sect && L.sect[player.sect];
  if (sl) lines.push(sl);
  showBossTalk(m.def.name, lines);
}
window.replayBossTalk = function(id){
  const L = BOSS_LORE[id]; if (!L) return;
  const lines = L.intro.slice();
  const sl = L.sect && L.sect[player.sect]; if (sl) lines.push(sl);
  showBossTalk(L.name, lines);
};
// Lời NPC theo tiến độ Ngũ Ấn
function npcStoryLine(){
  const flags = player.storyFlags || {};
  const n = Object.keys(flags).filter(k => k.startsWith('ta_')).length;
  if (flags.ketMo) return 'Trời đổ máu rồi… Vạn Ma Điện sắp mở. Người như ngươi — là hy vọng cuối cùng của giang hồ này.';
  if (n === 0) return null;
  if (n < 3) return 'Nghe đồn có trấn thủ cổ đã ngã xuống… Giang hồ bắt đầu xôn xao rồi đấy.';
  if (n < 5) return 'Trời tối hơn mỗi ngày. Nghe nói các đại phái đang triệu tập đệ tử về giữ sơn môn.';
  return 'Ngũ Ấn sắp vỡ hết rồi… Ngươi… vẫn định tiếp tục chứ?';
}
// Kết mở — ấn cuối vỡ, Ma Tôn sắp giáng thế
function showKetMo(){
  const ov = document.getElementById('overlay');
  if (!ov) return;
  document.getElementById('overlay-inner').innerHTML = `
    <h2 style="color:#ff6b6b">☠ ẤN ĐÃ VỠ</h2>
    <p style="line-height:1.9;font-size:14px">Trấn Ải cuối cùng đã ngã. Tịch Ma Điện mở toang — <b style="color:#ff8f6b">Ma Tôn sắp giáng thế</b>.<br>
    <span style="opacity:.85">12 canh giờ nữa, thiên hạ đại loạn. 19 canh giờ nữa, các phái đốt cháy sơn môn.<br>22 canh giờ nữa… <b style="color:#e8b060">Vạn Ma Điện</b> sẽ hiện ra giữa giang hồ.</span><br>
    <span style="color:#e8b060">Ngươi là người đánh vỡ ấn cuối cùng — cũng là người duy nhất có thể khép nó lại.<br><i>Ma công… hay ma tâm? Đó là lựa chọn của ngươi.</i></span></p>
    <button class="big-btn" onclick="document.getElementById('overlay').classList.add('hidden')">Tiếp Tục Hành Trình</button>`;
  ov.classList.remove('hidden');
  AudioSys.sfx('levelup', 0.9);
}

window.setQlogTab = function(t){ window.qlogTab = t; AudioSys.sfx('ui', 0.5); renderQlog(); };
function renderQlog(){
  const p = el('panel-qlog'); if (!p) return;
  let html = `<h3>Nhật Ký Nhiệm Vụ</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="display:flex;gap:8px;margin-bottom:8px">
    <button class="mini-btn ${window.qlogTab === 'main' ? '' : 'danger'}" onclick="setQlogTab('main')">★ Chính Tuyến</button>
    <button class="mini-btn ${window.qlogTab === 'side' ? '' : 'danger'}" onclick="setQlogTab('side')">◈ Phụ Tuyến</button>
    <button class="mini-btn ${window.qlogTab === 'story' ? '' : 'danger'}" onclick="setQlogTab('story')">📜 Nhật Ký</button></div>`;
  if (window.qlogTab === 'main'){
    let lastCh = '';
    QUESTS.forEach((q, i) => {
      if (q.chapter !== lastCh){
        lastCh = q.chapter;
        const opened = mapGate(q.map).ok;
        html += `<div class="ql-ch">${q.chapter} <span style="opacity:.6">· ${opened ? MAPS[q.map].name : '???'}</span></div>`;
      }
      let row;
      if (i < questIdx || questState === 'all')
        row = `<div class="ql-row" style="opacity:.55"><span style="color:#8fd18f">✔</span> ${q.name}</div>`;
      else if (i === questIdx){
        const prog = q.type === 'talk' ? '' : ` <span style="color:#f0d68a">${questProg}/${q.need}</span>`;
        row = `<div class="ql-row ql-cur"><span style="color:#f0d68a">▶</span> <b>${q.name}</b>${prog}${questState === 'done' ? ' <span style="color:#8fd18f">— xong, về gặp ' + npcName(q.npc) + '</span>' : ''}<button class="mini-btn" style="font-size:10px;padding:1px 8px;margin-left:8px" onclick="goQuest()">🧭 Tới Ngay</button></div>`;
      } else {
        const giverUnlocked = questIdx >= (QUESTS[Math.max(0, i-1)] ? 0 : 0); // spoiler-safe
        row = `<div class="ql-row" style="opacity:.4"><span>🔒</span> ???</div>`;
      }
      html += row;
    });
  } else if (window.qlogTab === 'story'){
    const flags = player.storyFlags || {};
    const nSeal = Object.keys(flags).filter(k => k.startsWith('ta_')).length;
    html += `<div class="ql-ch">☬ Ngũ Ấn Trấn Ma <span style="opacity:.6">· ${nSeal}/7 Trấn Ải đã hạ</span></div>`;
    html += `<div class="ql-row" style="opacity:.85;font-size:11.5px;line-height:1.5">${flags.ketMo ? '⚠ ẤN ĐÃ VỠ — Vạn Ma Điện sắp mở. Giang hồ chờ ngươi khép ấn lại.' : nSeal === 0 ? 'Ngũ Ấn còn nguyên — Ma Tôn vẫn bị giam trong Tịch Ma Điện.' : 'Phong ấn đang rạn nứt… bóng đêm phủ xuống giang hồ.'}</div>`;
    const clues = player.clues || [];
    html += `<div class="ql-ch">🔍 Manh Mối <span style="opacity:.6">· ${clues.length}/${Object.keys(CLUES).length}</span></div>`;
    if (!clues.length) html += `<div class="ql-row" style="opacity:.5">Chưa có manh mối — hạ Thủ Vệ / Trấn Ải để thu thập.</div>`;
    for (const cid of clues){
      const c = CLUES[cid]; if (!c) continue;
      html += `<div class="ql-row"><span style="color:#e8b060">✦</span> <b>${c.name}</b><div style="opacity:.65;font-size:11px;padding-left:18px;line-height:1.4">${c.desc}</div></div>`;
    }
    const seen = Object.keys(player.storySeen || {});
    html += `<div class="ql-ch">☬ Trấn Thủ Đã Gặp <span style="opacity:.6">· ${seen.length}/28</span></div>`;
    if (!seen.length) html += `<div class="ql-row" style="opacity:.5">Chưa gặp trấn thủ nào.</div>`;
    for (const bid of seen){
      const L = BOSS_LORE[bid]; if (!L) continue;
      const killed = Object.values(player.bossKills || {}).some(arr => arr.includes(bid));
      html += `<div class="ql-row"${killed ? '' : ' style="opacity:.55"'}><span>${killed ? '⚔' : '👁'}</span> ${L.name} <button class="mini-btn" onclick="replayBossTalk('${bid}')" style="font-size:10px;padding:1px 6px;margin-left:4px">💬</button></div>`;
    }
    if (flags.ketMo) html += `<div class="ql-ch" style="color:#ff6b6b">☠ KẾT MỞ — Ấn đã vỡ. Ma Tôn sẽ giáng thế…</div>`;
  } else {
    for (const mapId in MAPS){
      const list = SIDE_QUESTS.filter(sq => sq.map === mapId);
      if (!list.length) continue;
      const opened = mapGate(mapId).ok;
      html += `<div class="ql-ch">${opened ? MAPS[mapId].name : '??? Vùng Chưa Mở'} <span style="opacity:.6">· ${list.filter(sq => sideStates[sq.id] && sideStates[sq.id].st === 'claimed').length}/${list.length} xong</span></div>`;
      for (const sq of list){
        const st = sideAvail(sq), sts = sideStates[sq.id];
        if (st === 'claimed') html += `<div class="ql-row" style="opacity:.55"><span style="color:#8fd18f">✔</span> ${sq.name}</div>`;
        else if (st === 'done') html += `<div class="ql-row ql-cur"><span style="color:#8fd18f">▶</span> <b>${sq.name}</b><button class="mini-btn" style="font-size:10px;padding:0 6px;margin-left:6px" onclick="goQuestSide('${sq.id}')">🧭</button> <span style="color:#8fd18f">— xong, về gặp ${npcName(sq.npc)}</span></div>`;
        else if (st === 'active') html += `<div class="ql-row"><span style="color:#9fd0ff">◈</span> ${sq.name}<button class="mini-btn" style="font-size:10px;padding:0 6px;margin-left:6px" onclick="goQuestSide('${sq.id}')">🧭</button> <span style="color:#f0d68a">${sts.prog}/${sq.need}</span></div>`;
        else if (st === 'avail') html += `<div class="ql-row"><span style="color:#9fd0ff">◈</span> ${sq.name}<button class="mini-btn" style="font-size:10px;padding:0 6px;margin-left:6px" onclick="goQuestSide('${sq.id}')">🧭</button> <span style="opacity:.6">— gặp ${npcName(sq.npc)} để nhận</span></div>`;
        else html += `<div class="ql-row" style="opacity:.4"><span>🔒</span> ??? <span style="opacity:.7;font-size:11px">cấp ${sq.reqLv}</span></div>`;
      }
    }
  }
  p.innerHTML = html;
}

// ═══════════ QUẺ TIÊN THIÊN — gacha tính cách & tiềm năng đầu game (lấy cảm hứng QCBH) ═══════════
const TRAIT_TIERS = {
  pham:  { name:'PHÀM',  w:55, color:'#cfc8b8' },
  linh:  { name:'LINH',  w:30, color:'#6ab0f0' },
  huyen: { name:'HUYỀN', w:12, color:'#b08ae8' },
  thien: { name:'THIÊN', w:3,  color:'#f0a03a' },
};
const TRAITS = [
  { id:'thanluc',   name:'Thần Lực',            tier:'pham',  glyph:'💪', desc:'+8 Tấn Công',                              late:p=>{ p.atk += 8; } },
  { id:'nhucthan',  name:'Nhục Thân Cường Tráng',tier:'pham', glyph:'🛡', desc:'+55 Sinh Lực tối đa',                       late:p=>{ p.maxHp += 55; } },
  { id:'anmay',     name:'Ăn May',              tier:'pham',  glyph:'🍀', desc:'+5% tỉ lệ quái rớt đồ',                     late:p=>{ p.dropBonus += 0.05; } },
  { id:'chankhi',   name:'Chân Khí Dồi Dào',    tier:'pham',  glyph:'🔷', desc:'+15 Nội Lực tối đa',                        late:p=>{ p.maxQi += 15; } },
  { id:'tuctri',    name:'Túc Trí Đa Mưu',      tier:'linh',  glyph:'📖', desc:'+8% Kinh Nghiệm',                           late:p=>{ p.expPct += 8; } },
  { id:'luyenkhi',  name:'Thiên Tài Luyện Khí', tier:'linh',  glyph:'⚒', desc:'Rèn đồ +5% tỉ lệ thành công',               late:p=>{ p.forgeBonus += 5; } },
  { id:'thanhanh',  name:'Bách Bộ Thần Hành',   tier:'linh',  glyph:'👟', desc:'+6% Tốc Chạy',                              late:p=>{ p.speed = Math.round(p.speed*1.06); } },
  { id:'thiennhan', name:'Thiên Nhãn',          tier:'linh',  glyph:'👁', desc:'Minimap hiện cả điểm Thảo Dược',            late:p=>{ p.traitHerb = true; } },
  { id:'longtich',  name:'Long Tích Hổ Bộ',     tier:'huyen', glyph:'🐉', desc:'+5% Né Tránh',                              late:p=>{ p.eva = Math.min(0.45, p.eva+0.05); } },
  { id:'doanngoc',  name:'Đoạn Ngọc Thủ',       tier:'huyen', glyph:'🎯', desc:'Ám Khí +15% ST · phá khiên lâu thêm 4s',    late:p=>{ p.amkhiPct += 0.15; p.shieldBonus += 4; } },
  { id:'sattam',    name:'Sát Tâm',             tier:'huyen', glyph:'🌑', desc:'Giết Du Hiệp không tăng Tội Ác',            late:p=>{ p.traitSatTam = true; } },
  { id:'duocthe',   name:'Dược Thể',            tier:'huyen', glyph:'🧪', desc:'Hồ Lô Thuốc hồi 55% máu (thay 40%)',        late:p=>{ p.potionPct = 0.55; } },
  { id:'vohon',     name:'Võ Hồn',              tier:'thien', glyph:'⚔', desc:'Chiêu thức +12% Sát Thương',                 late:p=>{ p.skillDmgPct += 0.12; } },
  { id:'thienmenh', name:'Thiên Mệnh',          tier:'thien', glyph:'☯', desc:'Mỗi màn chơi 1 lần: chết hồi sinh tại chỗ 50% máu', late:p=>{ p.traitRevive = true; } },
  { id:'kymach',    name:'Kỳ Mạch Đại Thông',   tier:'thien', glyph:'🌊', desc:'Đả thông Kinh Mạch +25% tỉ lệ',             late:p=>{ p.traitMerRate = 1.25; } },
  { id:'vanvat',    name:'Vạn Vật Hữu Duyên',   tier:'thien', glyph:'💰', desc:'+15% Bạc rơi',                              late:p=>{ p.silverPct += 15; } },
];
const PERSONALITIES = {
  chinh: { name:'Chính Trực', glyph:'⚖', desc:'Khí chất hiệp nghĩa, đi đâu cũng được người đời kính nể.' },
  ta:    { name:'Tà Khí',     glyph:'🌑', desc:'Đường tà đạo — Du Hiệp kiêng kị, dân thường e ngại.' },
  trung: { name:'Trung Dung', glyph:'☯', desc:'Hài hòa âm dương, không thiên vị bên nào.' },
};
function rollTrait(excludeIds){
  const pool = TRAITS.filter(t => !excludeIds.includes(t.id));
  let total = 0;
  for (const t of pool) total += TRAIT_TIERS[t.tier].w;
  let r = Math.random() * total;
  for (const t of pool){ r -= TRAIT_TIERS[t.tier].w; if (r <= 0) return t; }
  return pool[pool.length - 1];
}
function rollTraitsSilent(){
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push(rollTrait(ids).id);
  return ids;
}

// ---------- Danh tính giang hồ: đặt tên nhân vật ----------
const NAME_HO = ['Vân','Diệp','Tô','Sở','Lâm','Thẩm','Cổ','Bạch','Tiếu','Tần','Hàn','Mạc','Dạ','Liễu','Vô','Mộ Dung','Âu Dương','Lệnh Hồ','Độc Cô','Nam Cung'];
const NAME_TEN = ['Thiên','Dao Tử','Vô Song','Nguyệt','Phong','Tuyết','Kiếm Minh','Thanh Sát','Lưu Ly','Cô Hồn','Phi Yến','Thương','Vấn Tình','Tiêu Dao','Hàn Băng','Phá Quân','Mộ Bạch','Yên Nhi','Tử Ngọ','Song Nhi','Độc Hành','Khinh Vũ','Trầm Châu','Nhạn Quy'];
function genCharName(){
  const ho = NAME_HO[(Math.random()*NAME_HO.length)|0];
  const ten = NAME_TEN[(Math.random()*NAME_TEN.length)|0];
  return ho + ' ' + ten;
}
function sanitizeCharName(v){
  return (v || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

let pendingSect = null, quzeBoard = [], quzePicked = [], quzeShuffles = 3, quzePers = 'trung';
// Bàn 16 quẻ úp — mỗi quẻ roll độc lập theo đúng xác suất phẩm chất gốc (Phàm 55/Linh 30/Huyền 12/Thiên 3)
function rollQuzeBoard(){
  const b = [];
  for (let i = 0; i < 16; i++) b.push({ t: rollTrait([]), open: false });
  return b;
}
function openQuze(key){
  pendingSect = key;
  quzeBoard = rollQuzeBoard();
  quzePicked = []; quzeShuffles = 3; quzePers = 'trung';
  const _ni = el('inp-char-name'); if (_ni && !_ni.value) _ni.value = genCharName();
  el('sect-select').classList.add('hidden');
  el('quze-screen').classList.remove('hidden');
  renderQuze();
}
window.qzFlip = function(i){
  const c = quzeBoard[i]; if (!c || c.open) return;
  c.open = true;
  AudioSys.sfx('ui', 0.6);
  if (c.t.tier === 'thien'){ AudioSys.sfx('levelup', 0.9); }
  else if (c.t.tier === 'huyen'){ AudioSys.sfx('quest', 0.6); }
  renderQuze();
};
window.qzToggle = function(i){
  const c = quzeBoard[i]; if (!c || !c.open) return;
  const at = quzePicked.indexOf(i);
  if (at >= 0) quzePicked.splice(at, 1);
  else {
    if (quzePicked.length >= 3) return;
    if (quzePicked.some(j => quzeBoard[j].t.id === c.t.id)) return; // không chọn 2 quẻ trùng vận
    quzePicked.push(i);
  }
  AudioSys.sfx('ui', 0.5);
  renderQuze();
};
window.qzShuffle = function(){
  if (quzeShuffles <= 0) return;
  quzeShuffles--;
  quzeBoard = rollQuzeBoard();
  quzePicked = [];
  AudioSys.sfx('skill', 0.6);
  renderQuze();
};
function renderQuze(){
  const bd = el('quze-board');
  bd.innerHTML = '';
  quzeBoard.forEach((c, i) => {
    const d = document.createElement('div');
    const picked = quzePicked.includes(i);
    const dupe = !picked && c.open && quzePicked.some(j => quzeBoard[j].t.id === c.t.id);
    d.className = 'qzc' + (c.open ? ' open t-' + c.t.tier : '') + (picked ? ' picked' : '') + (dupe ? ' dim' : '');
    if (c.open){
      const tier = TRAIT_TIERS[c.t.tier];
      d.innerHTML = `<img class="qzc-art" src="assets/quze/${c.t.id}.png" alt="" onerror="this.remove()">
        <div class="qzc-name" style="color:${tier.color}">${c.t.name}</div>
        <div class="qzc-tier" style="color:${tier.color}">— ${tier.name} —</div>
        <div class="qzc-desc">${c.t.desc}</div>`;
      d.addEventListener('click', ()=>qzToggle(i));
    } else {
      d.innerHTML = `<img class="qzc-art" src="assets/quze/back.png" alt="" onerror="this.remove()"><div class="qzc-backglyph">☯</div>`;
      d.addEventListener('click', ()=>qzFlip(i));
    }
    bd.appendChild(d);
  });
  const pk = el('quze-picked');
  pk.innerHTML = '';
  for (let s2 = 0; s2 < 3; s2++){
    const i = quzePicked[s2], d = document.createElement('div');
    d.className = 'qzs' + (i != null ? ' filled t-' + quzeBoard[i].t.tier : '');
    d.textContent = i != null ? quzeBoard[i].t.name : '— Quẻ ' + (s2+1) + ' —';
    pk.appendChild(d);
  }
  const sb = el('btn-quze-shuffle');
  sb.textContent = `🀄 Xáo Lại Bàn Quẻ (còn ${quzeShuffles})`;
  sb.disabled = quzeShuffles <= 0;
  sb.onclick = qzShuffle;
  const pers = el('quze-pers');
  pers.innerHTML = '';
  for (const pid in PERSONALITIES){
    const p = PERSONALITIES[pid];
    const d = document.createElement('div');
    d.className = 'qz-pers' + (quzePers === pid ? ' sel' : '');
    d.innerHTML = `${p.glyph} <b>${p.name}</b><small>${p.desc}</small>`;
    d.addEventListener('click', ()=>{ quzePers = pid; AudioSys.sfx('ui', 0.5); renderQuze(); });
    pers.appendChild(d);
  }
  const allHigh = quzePicked.length === 3 && quzePicked.every(i => quzeBoard[i].t.tier === 'huyen' || quzeBoard[i].t.tier === 'thien');
  let hint = el('qz-title-hint');
  if (!hint){
    hint = document.createElement('div');
    hint.id = 'qz-title-hint'; hint.className = 'qz-title-hint';
    el('quze-picked').after(hint);
  }
  hint.textContent = allHigh ? '✨ 3 quẻ HUYỀN trở lên — sẽ mở danh hiệu ẩn 【Thiên Mệnh Sở Quy】!' : '';
  const go = el('btn-quze-go');
  go.disabled = quzePicked.length !== 3;
  go.textContent = quzePicked.length === 3 ? 'Bắt Đầu Hành Trình' : `Đã chọn ${quzePicked.length}/3 quẻ`;
}
el('btn-name-random').addEventListener('click', ()=>{ el('inp-char-name').value = genCharName(); AudioSys.sfx('ui', 0.5); });
el('btn-quze-go').addEventListener('click', ()=>{
  if (quzePicked.length !== 3) return;
  const pickedTraits = quzePicked.map(i => quzeBoard[i].t);
  const traits = pickedTraits.map(t => t.id);
  const allHigh = pickedTraits.every(t => t.tier === 'huyen' || t.tier === 'thien');
  el('quze-screen').classList.add('hidden');
  const cname = sanitizeCharName(el('inp-char-name') ? el('inp-char-name').value : '') || genCharName();
  startGame(pendingSect, { traits, pers: quzePers, title: allHigh, name: cname });
  checkTitles();
  const pers = PERSONALITIES[quzePers];
  setTimeout(()=>{
    addFloat(player.x, player.y-92, `☯ Quẻ Tiên Thiên: ${pickedTraits.map(t => t.name).join(' · ')}`, '#f0d68a', 13);
    addFloat(player.x, player.y-72, `Tính cách: ${pers.glyph} ${pers.name}`, '#b8a878', 12);
  }, 600);
  AudioSys.sfx('quest', 0.9);
});
TITLES.push({ id:'tmsq', name:'Thiên Mệnh Sở Quy', cond:p=>!!p.quzeTitle, stats:{ allPct:0.03 }, vfx:null });

// ═══════════ A1: ĐỘ KIẾP — mini-game sống còn khi đột phá Đan Điền (thay RNG thuần) ═══════════
let TRIB = { active:false, realm:0, next:null, spawnT:0, strikes:[], hits:0, landed:0, total:0 };
window.breakthrough = function(){
  if (TRIB.active) return;
  const realm = player.dantian.realm;
  const next = DANTIAN_REALMS[realm+1];
  if (!next || !next.cost) return;
  if (player.dantian.tuvi < Math.floor(next.cost.tuvi * (player.doNgo ? 0.7 : 1)) || player.silver < next.cost.silver || player.mat < next.cost.mat) return;
  player.silver -= next.cost.silver; player.mat -= next.cost.mat;
  // Luyện Khí (cảnh 1-4): đột phá vận công theo tỉ lệ — chưa đủ tư cách độ kiếp
  if (!next.trib){
    const msg = document.getElementById('dantian-msg');
    if (Math.random()*100 < next.rate){
      player.dantian.realm++;
      player.dantian.tuvi -= Math.floor(next.cost.tuvi * (player.doNgo ? 0.7 : 1)); player.doNgo = 0;
      zoneBanner = { text:'☯ ĐỘT PHÁ CẢNH GIỚI', sub:`${next.name}${next.unlock ? ' — Học được ' + next.unlock : ''}`, color:'#9fd0ff', t:4 };
      addFloat(player.x, player.y-46, `ĐỘT PHÁ: ${next.name}!`, '#9fd0ff', 18);
      if (next.unlock) addFloat(player.x, player.y-70, `Học được: ${next.unlock}!`, '#f0d68a', 15);
      addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:'#5ea0e8', big:true });
      for (let i=0;i<14;i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-90,90), vy:rnd(-120,-30), color:'#5ea0e8' });
      AudioSys.sfx('levelup', 0.95);
      calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
      checkTitles();
    } else {
      player.dantian.tuvi = Math.floor(player.dantian.tuvi * 0.5);
      zoneBanner = { text:'✘ ĐỘT PHÁ THẤT BẠI', sub:'Tẩu hỏa nhẹ — Tu Vi tổn hao một nửa, cảnh giới giữ nguyên.', color:'#ff5a4a', t:3.5 };
      addFloat(player.x, player.y-46, 'Tẩu hỏa! Tu Vi tổn hao!', '#ff7a6a', 14);
      AudioSys.sfx('forge_fail', 0.8);
    }
    if (msg) msg.textContent = '';
    saveGame();
    return;
  }
  // Trúc Cơ trở lên (cảnh 5-9): LÔI KIẾP — 3-9 đợt thiên lôi, mỗi đợt 3 tia
  closePanels();
  TRIB = { active:true, realm, next, spawnT:0.8, strikes:[], hits:0, landed:0,
    total: next.trib*3 + (player.maDao ? 3 : 0), perWave:3, maxHits: 3 }; // Ma Đạo: lôi kiếp dày hơn
  if ((player.dotpha || 0) > 0){
    player.dotpha--; TRIB.maxHits = 4;
    addFloat(player.x, player.y-90, '◈ Đan Đột Phá bảo mệnh — chịu được 4 tia lôi, thất bại chỉ tổn 25% Tu Vi!', '#e8c84a', 14);
  }
  zoneBanner = { text:'⚡ LÔI KIẾP GIÁNG LÂM', sub:`Độ kiếp ${next.name} — ${next.trib} đợt thiên lôi! Trúng ${TRIB.maxHits} tia là Tẩu Hỏa Nhập Ma`, color:'#e8c84a', t:3.5 };
  addFloat(player.x, player.y-70, 'Thiên đạo thử thách — HÃY NÉ!', '#e8c84a', 16);
  AudioSys.sfx('levelup', 0.8);
  saveGame();
};
function updateTrib(dt){
  if (!player || dead){ TRIB.active = false; TRIB.strikes = []; return; }
  const realm = TRIB.realm;
  // spawn thiên lôi — cảnh giới càng cao, sấm càng dày & nhanh
  TRIB.spawnT -= dt;
  const perWave = TRIB.perWave || 1;
  const interval = perWave > 1 ? Math.max(1.0, 1.6 - realm*0.05) : Math.max(0.5, 1.1 - realm*0.07);
  if (TRIB.spawnT <= 0 && TRIB.landed + TRIB.strikes.length < TRIB.total){
    TRIB.spawnT = interval;
    for (let w = 0; w < perWave && TRIB.landed + TRIB.strikes.length < TRIB.total; w++){
      const onHead = Math.random() < 0.35; // 35% giáng thẳng đầu — buộc phải di chuyển
      TRIB.strikes.push({
        x: clamp(onHead ? player.x : player.x + rnd(-240,240), 40, MAP.w-40),
        y: clamp(onHead ? player.y : player.y + rnd(-240,240), 40, MAP.h-40),
        r: 62, tele: Math.max(0.5, 0.95 - realm*0.05), teleMax: Math.max(0.5, 0.95 - realm*0.05),
      });
    }
    AudioSys.sfx('skill', 0.35);
  }
  // đếm ngược & giáng sấm
  for (const st of TRIB.strikes){
    st.tele -= dt;
    if (st.tele > 0) continue;
    st.done = true;
    TRIB.landed++;
    addEffect({ type:'ring', x:st.x, y:st.y, r:st.r+18, color:'#fff2b0', big:true });
    for (let i=0;i<6;i++) addEffect({ type:'ink', x:st.x, y:st.y, vx:rnd(-120,120), vy:rnd(-140,-20), color:'#ffe9a8' });
    AudioSys.sfx('crit', 0.55);
    if (dist(player.x, player.y, st.x, st.y) < st.r){
      TRIB.hits++;
      const dmg = Math.round(player.maxHp * (player.maDao ? ((player.loidonT || 0) > 0 ? 0.09 : 0.15) : ((player.loidonT || 0) > 0 ? 0.072 : 0.12))); // Lôi Độn -40% · Ma Đạo lôi mạnh hơn
      player.hp -= dmg;
      player.combatT = 4; player.hurtT = 0.25;
      shakeT = Math.max(shakeT, 0.16); shakeMag = 6;
      addFloat(player.x, player.y-40, `THIÊN LÔI! -${dmg} (${TRIB.hits}/${TRIB.maxHits || 3})${(player.loidonT || 0) > 0 ? ' · Lôi Độn -40%' : ''}`, '#ffe9a8', 15);
      AudioSys.sfx('hurt', 0.8);
      if (player.hp <= 0){ TRIB.strikes = TRIB.strikes.filter(x => !x.done); TRIB.active = false; TRIB.strikes = []; return; } // update() xử lý chết
    }
  }
  TRIB.strikes = TRIB.strikes.filter(st => !st.done);
  // kết thúc kiếp
  if (TRIB.landed >= TRIB.total && !TRIB.strikes.length){
    const next = TRIB.next, realm2 = TRIB.realm;
    TRIB.active = false;
    if (TRIB.hits < (TRIB.maxHits || 3) && !dead){
      player.dantian.realm++;
      player.dantian.tuvi -= Math.floor(next.cost.tuvi * (player.doNgo ? 0.7 : 1)); player.doNgo = 0; // Đối Ngộ giảm 30% tiêu hao
      if (player.dantian.realm >= DANTIAN_REALMS.length - 1) ascendToImmortal(); // Hóa Thần thành công → Phi Thăng · Thần Tiên Hóa Cảnh
      zoneBanner = { text:'⚡ ĐỘ KIẾP THÀNH CÔNG', sub:`${next.name}${next.unlock ? ' — Học được ' + next.unlock : ''}`, color:'#9fd0ff', t:4 };
      addFloat(player.x, player.y-46, `ĐỘT PHÁ: ${next.name}!`, '#9fd0ff', 18);
      if (next.unlock) addFloat(player.x, player.y-70, `Học được: ${next.unlock}!`, '#f0d68a', 15);
      addEffect({ type:'ring', x:player.x, y:player.y, r:130, color:'#5ea0e8', big:true });
      for (let i=0;i<16;i++) addEffect({ type:'ink', x:player.x, y:player.y, vx:rnd(-90,90), vy:rnd(-120,-30), color:'#5ea0e8' });
      AudioSys.sfx('levelup', 0.95);
      calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
      checkTitles();
    } else if (!dead){
      player.dantian.tuvi = Math.floor(player.dantian.tuvi * ((TRIB.maxHits || 3) > 3 ? 0.75 : 0.7)); // GDD: thất bại mất 30% Tu Vi · Đan Đột Phá: chỉ tổn 25%
      zoneBanner = { text:'⚡ TẨU HỎA NHẬP MA', sub:'Độ kiếp thất bại — mất 30% Tu Vi tiến độ, cảnh giới giữ nguyên!', color:'#ff5a4a', t:4 };
      addFloat(player.x, player.y-46, 'Tẩu hỏa! Tu Vi tổn hao!', '#ff7a6a', 15);
      AudioSys.sfx('forge_fail', 0.85);
    }
    saveGame();
  }
}
function drawTrib(){
  // vùng cảnh báo sấm (đang trong camera transform)
  for (const st of TRIB.strikes){
    const prog = 1 - st.tele / st.teleMax;
    ctx.globalAlpha = 0.25 + prog*0.4;
    ctx.fillStyle = '#e8c84a';
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = prog > 0.7 ? '#fff2b0' : '#c9a227';
    ctx.lineWidth = 2 + prog*2;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r * (1 - prog*0.55), 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // bảng đếm trên đầu màn hình
  ctx.font = 'bold 15px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 4;
  const waveTxt = TRIB.perWave > 1 && TRIB.next && TRIB.next.trib
    ? `ĐỢT ${Math.min(TRIB.next.trib, Math.floor(TRIB.landed/TRIB.perWave) + 1)}/${TRIB.next.trib} · ` : '';
  const txt = `⚡ LÔI KIẾP ${waveTxt}${TRIB.landed}/${TRIB.total} tia · trúng ${TRIB.hits}/${TRIB.maxHits || 3} là THẤT BẠI`;
  ctx.strokeText(txt, camera.x + W/2, camera.y + 46);
  ctx.fillStyle = TRIB.hits >= 2 ? '#ff7a6a' : '#ffe9a8';
  ctx.fillText(txt, camera.x + W/2, camera.y + 46);
}

// ═══════════ A2: KỲ NGỘ — sự kiện ngẫu nhiên khi đi đường (khí vận giang hồ) ═══════════
let kyngoAcc = 0, kyngoNext = rnd(14000, 22000), kyngoPrev = null; // ~75-115s đi bộ
function updateKyngo(dt){
  if (!player || dead || TRIB.active || mapDef().dungeon) { kyngoPrev = null; return; }
  if (kyngoPrev){
    const moved = dist(player.x, player.y, kyngoPrev.x, kyngoPrev.y);
    if (moved < 20) kyngoAcc += moved; // <20px/frame: loại teleport
    if (kyngoAcc >= kyngoNext){
      kyngoAcc = 0; kyngoNext = rnd(14000, 22000);
      rollKyngo();
    }
  }
  kyngoPrev = { x:player.x, y:player.y };
}
function rollKyngo(){
  const r = Math.random();
  const mdK = mapDef();
  let text, sub, color = '#f0d68a';
  if (r < 0.20){ // Lão đạo sĩ tặng mảnh bí kíp
    const p = Math.floor(Math.random()*3);
    player.bikip.pieces[p]++;
    text = 'KỲ NGỘ · Lão Đạo Sĩ'; sub = `"Tiểu hữu hữu duyên, tặng ngươi Tàn Quyển ${TAN_QUYEN[p]}!"`; color = '#e84a6a';
  } else if (r < 0.36){ // Nhặt huyền thiết
    const n = 2 + Math.floor(Math.random()*2);
    player.mat += n;
    text = 'KỲ NGỘ · Khoáng Mạch'; sub = `Đá dưới chân lóe sáng — nhặt được ${n}✦ Huyền Thiết!`; color = '#9fd0ff';
  } else if (r < 0.48){ // Hồ lô lạc
    if (player.potions < 5){ player.potions++; sub = 'Nhặt được 1 🧪 Hồ Lô Thuốc còn nguyên!' ; }
    else { player.silver += 100; sub = 'Hồ lô đầy — đổi lấy 100◈!'; }
    text = 'KỲ NGỘ · Hồ Lô Lạc';
  } else if (r < 0.64 && mdK.type !== 'safe'){ // Mai phục — khu an toàn tuyệt đối không có
    const mobType = (mdK.packs && mdK.packs.length) ? mdK.packs[Math.floor(Math.random()*mdK.packs.length)].mob : 'bandit';
    for (let i = 0; i < 2; i++){
      const m = spawnMob(mobType, { x:player.x, y:player.y, r:130, count:2 }, null);
      m.packAlert = 9999; m.provoked = true;
    }
    text = '⚠ MAI PHỤC!'; sub = 'Có kẻ phục kích ngươi giữa đường!'; color = '#ff5a4a';
    AudioSys.sfx('hurt', 0.7);
  } else if (r < 0.74){ // Linh khí tụ hội
    player.dantian.tuvi += 30; player.khi += 20;
    text = 'KỲ NGỘ · Linh Khí Tụ Hội'; sub = 'Hít thở thiên địa — +30 Tu Vi · +20 Chân Khí!'; color = '#7fd8e0';
  } else if (r < 0.90){ // Cao Nhân Chỉ Điểm (bài học Tu Tiên Chi Lộ)
    const tv = 40 + ((player.dantian && player.dantian.realm) || 0)*25;
    player.dantian.tuvi += tv;
    sub = `Cao nhân ẩn thế xuất hiện, chỉ điểm vài chiêu — +${tv} Tu Vi!`;
    if (Math.random() < 0.5){ player.dotpha = (player.dotpha || 0) + 1; sub += ' Tặng kèm 1 ◈ Đan Đột Phá!'; }
    text = 'KỲ NGỘ · Cao Nhân Chỉ Điểm'; color = '#d8baff';
  } else { // Đối Ngộ — phá bình cảnh
    player.doNgo = 1;
    text = 'KỲ NGỘ · Đối Ngộ'; color = '#9fd0ff';
    sub = 'Chợt ngộ đạo trong thoáng chốc — lần đột phá kế tiếp giảm 30% Tu Vi tiêu hao!';
  }
  zoneBanner = { text, sub, color, t:3.2 };
  AudioSys.sfx('quest', 0.7);
  addEffect({ type:'ring', x:player.x, y:player.y, r:70, color, big:true });
  calcDerived(); saveGame();
}
TITLES.push({ id:'tctk', name:'Túc Thù Chung Kết', cond:p=>(p.revengeKills||0) >= 3, stats:{ atkPct:0.03 }, vfx:null });

// ============================================================
// Cloud Save Sync — giao tiếp với shell React qua postMessage
// ============================================================
(function(){
  if (!window.parent || window.parent === window) return; // chạy độc lập → bỏ qua
  function localSavedAt(){
    try {
      const raw = localStorage.getItem('vlcm_save');
      if (!raw) return 0;
      return JSON.parse(raw).savedAt || 0;
    } catch(e){ return 0; }
  }
  window.addEventListener('message', function(ev){
    if (ev.origin !== window.location.origin) return;
    const msg = ev.data;
    if (!msg || msg.type !== 'vlcm:cloud-load' || !msg.data) return;
    try {
      const cloud = JSON.parse(msg.data);
      const cloudAt = cloud.savedAt || 0;
      if (cloudAt <= localSavedAt()) return; // bản local mới hơn hoặc bằng — giữ nguyên
      localStorage.setItem('vlcm_save', msg.data);
      if (!player){
        // đang ở màn menu → bật nút Tiếp Tục ngay, không cần tải lại
        el('intro-story').classList.add('hidden');
        showMainMenu();
        el('btn-continue').classList.remove('hidden');
      } else {
        addFloat(player.x, player.y-70, '☁ Có save cloud mới hơn — tải lại trang để dùng bản đó', '#7ec8ff', 14);
      }
    } catch(e){}
  });
  // Báo cho shell biết game đã sẵn sàng nhận save cloud
  try { window.parent.postMessage({ type: 'vlcm:ready' }, window.location.origin); } catch(e){}
})();


// ==================== PHÓ BẢN & BOSS (Request P) ====================
// Boss tương ứng cấp từng map — ảnh riêng vẽ bằng AI, phong cách thủy mặc
Object.assign(MOBS, {
  boss_hacphong:  { name:'Hắc Phong Trại Chủ',    lv:16,  hp:3500,   atk:55,  def:20,  xp:3200,  silver:[350,500],   speed:80, aggro:9999, range:40, atkCd:1.2,  size:24, color:'#181420', eye:'#ff3a3a', boss:true, elite:true, drop:1, el:'Hỏa',  img:'assets/mobs/boss_hacphong.png' },
  boss_sontac:    { name:'Sơn Tặc Đại Đầu Lĩnh',  lv:22,  hp:6000,   atk:75,  def:28,  xp:5200,  silver:[500,700],   speed:76, aggro:9999, range:42, atkCd:1.25, size:25, color:'#241a12', eye:'#ff9a3a', boss:true, elite:true, drop:1, el:'Thổ',  img:'assets/mobs/boss_sontac.png' },
  boss_phando:    { name:'Phản Đồ Đại Tướng',     lv:34,  hp:11000,  atk:110, def:40,  xp:9000,  silver:[800,1100],  speed:82, aggro:9999, range:44, atkCd:1.2,  size:25, color:'#12201c', eye:'#a0ffe9', boss:true, elite:true, drop:1, el:'Thủy', img:'assets/mobs/boss_phando.png' },
  boss_mochu:     { name:'Cổ Mộ Mộ Chủ',          lv:52,  hp:22000,  atk:170, def:70,  xp:16000, silver:[1300,1800], speed:70, aggro:9999, range:46, atkCd:1.3,  size:26, color:'#1c1a14', eye:'#9a86d8', boss:true, elite:true, drop:1, el:'Thổ',  img:'assets/mobs/boss_mochu.png' },
  boss_tinhhoa:   { name:'Tình Hỏa Ma Quân',      lv:72,  hp:40000,  atk:240, def:95,  xp:28000, silver:[2000,2800], speed:88, aggro:9999, range:48, atkCd:1.15, size:26, color:'#2a1218', eye:'#7ec850', boss:true, elite:true, drop:1, el:'Mộc', poisonHit:true, img:'assets/mobs/boss_tinhhoa.png' },
  boss_dothong:   { name:'Đột Thông Hãn Vương',   lv:92,  hp:68000,  atk:340, def:130, xp:45000, silver:[3200,4200], speed:84, aggro:9999, range:50, atkCd:1.1,  size:27, color:'#1a1410', eye:'#ffd76a', boss:true, elite:true, drop:1, el:'Kim',  img:'assets/mobs/boss_dothong.png' },
  boss_thienbinh: { name:'Thiên Binh Thống Soái', lv:108, hp:100000, atk:420, def:160, xp:70000, silver:[4500,6000], speed:92, aggro:9999, range:52, atkCd:1.0,  size:27, color:'#101018', eye:'#ff3a3a', boss:true, elite:true, drop:1, el:'Hỏa',  img:'assets/mobs/boss_thienbinh.png' },
});
// ảnh boss nạp thủ công (MOB_IMGS gốc chỉ load mobs trong literal đầu file)
for (const bt of ['boss_hacphong','boss_sontac','boss_phando','boss_mochu','boss_tinhhoa','boss_dothong','boss_thienbinh']){
  const im = new Image(); im.src = MOBS[bt].img; MOB_IMGS[bt] = im;
}
Object.assign(BGM_TRACKS, {
  pb_daohoa:'bgm_tomb', pb_ngoai:'bgm_tomb', pb_chungnam:'bgm_tomb', pb_comoc:'bgm_tomb',
  pb_tuyettinh:'bgm_tomb', pb_mongco:'bgm_tomb', pb_nhanmon:'bgm_tomb',
});

// Cấu hình từng phó bản: 3 đợt quái (quái của map cha) → Boss → thưởng nguyên liệu tiến cấp kỹ năng
const DUNGEONS = {
  pb_daohoa:   { boss:'boss_hacphong',  bossName:'Hắc Phong Trại Chủ',
    waves:[ ['bandit','bandit','wolf'], ['bandit','hautu','bandit'], ['assassin','bandit','wolf'] ],
    rewards:{ tienDan:[1,2], mat:[4,7],   tuLa:[0,0], hon:[0,0], khi:40,  tuvi:150,  silver:[250,400] } },
  pb_ngoai:    { boss:'boss_sontac',    bossName:'Sơn Tặc Đại Đầu Lĩnh',
    waves:[ ['bandit','wolf','bandit'], ['bandit','bandit','caodo'], ['assassin','bandit','bandit'] ],
    rewards:{ tienDan:[1,2], mat:[5,8],   tuLa:[0,0], hon:[0,0], khi:55,  tuvi:220,  silver:[320,480] } },
  pb_chungnam: { boss:'boss_phando',    bossName:'Phản Đồ Đại Tướng',
    waves:[ ['phando','bandit','phando'], ['xanu','phando','bandit'], ['bandao','xanu','phando'] ],
    rewards:{ tienDan:[2,3], mat:[7,11],  tuLa:[0,1], hon:[0,0], khi:90,  tuvi:450,  silver:[550,800] } },
  pb_comoc:    { boss:'boss_mochu',     bossName:'Cổ Mộ Mộ Chủ',
    waves:[ ['thinu','mocnhan','thinu'], ['huyetbat','mocnhan','thinu'], ['huyetbat','huyetbat','mocnhan'] ],
    rewards:{ tienDan:[2,3], mat:[10,14], tuLa:[1,1], hon:[0,0], khi:140, tuvi:800,  silver:[900,1300] } },
  pb_tuyettinh:{ boss:'boss_tinhhoa',   bossName:'Tình Hỏa Ma Quân',
    waves:[ ['ttdetu','docyeu','ttdetu'], ['docyeu','satthuhy','ttdetu'], ['satthuhy','docyeu','docyeu'] ],
    rewards:{ tienDan:[3,4], mat:[13,18], tuLa:[1,2], hon:[0,1], khi:200, tuvi:1400, silver:[1400,2000] } },
  pb_mongco:   { boss:'boss_dothong',   bossName:'Đột Thông Hãn Vương',
    waves:[ ['thamtu','cungthu','kybinh'], ['cungthu','kybinh','thamtu'], ['kybinh','kybinh','cungthu'] ],
    rewards:{ tienDan:[4,5], mat:[16,22], tuLa:[2,2], hon:[1,1], khi:280, tuvi:2400, silver:[2200,3200] } },
  pb_nhanmon:  { boss:'boss_thienbinh', bossName:'Thiên Binh Thống Soái',
    waves:[ ['kylan','cuongbinh','daokhach'], ['cuongbinh','daokhach','kylan'], ['daokhach','kylan','kylan'] ],
    rewards:{ tienDan:[5,6], mat:[20,26], tuLa:[2,3], hon:[2,2], khi:350, tuvi:3500, silver:[3000,4500] } },
};

// Engine phó bản: DGN = trạng thái lượt chạy hiện tại
let DGN = null; // { id, def, wave, bossRef, cleared }
function startDungeonRun(mapId){
  const def = DUNGEONS[mapId]; if (!def) return;
  DGN = { id: mapId, def, wave: 0, bossRef: null, cleared: false };
  nextDungeonWave();
}
function nextDungeonWave(){
  if (!DGN) return;
  DGN.wave++;
  const w = DGN.def.waves[DGN.wave - 1];
  if (!w){ // hết 3 đợt → triệu hồi Boss
    const b = spawnMob(DGN.def.boss, { x:1300, y:430, r:40, count:1 }, null);
    b.zone = null; // không hồi sinh lại theo zone
    DGN.bossRef = b;
    addFloat(1300, 500, 'BOSS ' + DGN.def.bossName + ' xuất hiện!', '#ff5a4a', 20);
    AudioSys.sfx('crit', 0.7);
    return;
  }
  for (const t of w){
    const m = spawnMob(t, { x:1300, y:800, r:230, count:w.length }, null);
    m.zone = null; // quái phó bản chết là chết hẳn — không respawn
  }
  if (player) addFloat(player.x, player.y - 60, 'Đợt ' + DGN.wave + '/' + DGN.def.waves.length, '#b08ae8', 16);
}
function updateDungeon(){
  if (!DGN || DGN.cleared) return;
  if (mobs.some(m => !m.dead)) return; // còn quái sống → chờ
  if (!DGN.bossRef){ nextDungeonWave(); return; }
  // Boss đã ngã → trao thưởng farm tiến cấp kỹ năng
  DGN.cleared = true;
  const r = DGN.def.rewards;
  const td = Math.round(rnd(r.tienDan[0], r.tienDan[1])), mt = Math.round(rnd(r.mat[0], r.mat[1])),
        tl = Math.round(rnd(r.tuLa[0], r.tuLa[1])),     hn = Math.round(rnd(r.hon[0], r.hon[1])),
        sv = Math.round(rnd(r.silver[0], r.silver[1]));
  player.tienDan += td; player.mat += mt; player.khi += r.khi; player.dantian.tuvi += r.tuvi; player.silver += sv;
  player.dotpha = (player.dotpha || 0) + 1; // boss phó bản luôn rớt Đan Đột Phá — farm để đột phá an toàn
  dailyTrack('dungeon'); // Mục Tiêu Hôm Nay
  if (tl > 0) player.gems.tuLa += tl;
  if (hn > 0) player.gems.honNguyen += hn;
  zoneBanner = { text:'PHÓ BẢN THÔNG QUAN!',
    sub:`+${td} Tiến Cấp Đan · +${mt} Huyền Thiết · +${r.khi} Chân Khí · +${r.tuvi} Tu Vi · +${sv} bạc · +1 Đan Đột Phá`,
    color:'#b08ae8', t:5 };
  addFloat(player.x, player.y - 80, 'Phần thưởng phó bản đã vào túi!', '#f0d68a', 16);
  AudioSys.sfx('levelup', 0.8);
  calcDerived(); saveGame();
}
function drawDungeonHUD(){
  if (!DGN || !player) return;
  const x = W/2, y = 26;
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; ctx.fillStyle = '#d8baff';
  const label = DGN.cleared ? 'Phó bản đã thông quan — qua cổng dịch chuyển để rời đi'
    : DGN.bossRef ? 'BOSS: ' + DGN.def.bossName
    : 'Đợt ' + DGN.wave + '/' + DGN.def.waves.length + ' — dọn sạch quái!';
  ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
  if (DGN.bossRef && !DGN.bossRef.dead){
    const b = DGN.bossRef, pct = Math.max(0, b.hp / b.maxHp);
    const bw = 340, bx = x - bw/2, by = y + 8;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx-2, by-2, bw+4, 14);
    ctx.fillStyle = '#3a1020'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = '#e84a5a'; ctx.fillRect(bx, by, bw*pct, 10);
    ctx.strokeStyle = 'rgba(240,214,138,.8)'; ctx.lineWidth = 1; ctx.strokeRect(bx+.5, by+.5, bw-1, 9);
  }
}

// Cổng dịch chuyển: map cha → phó bản (và cổng thoát ngược lại)
GATES.push(
  { map:'daohoa',      x:2250, y:950,  to:'pb_daohoa',   name:'Phó Bản · Hắc Phong Trại',       portal:true, label:'Phó Bản' },
  { map:'pb_daohoa',   x:1300, y:1660, to:'daohoa',      name:'Rời Phó Bản → Đào Hoa Đảo',      portal:true, label:'Xuất Môn' },
  { map:'ngoai',       x:2250, y:950,  to:'pb_ngoai',    name:'Phó Bản · Sơn Tặc Doanh',        portal:true, label:'Phó Bản' },
  { map:'pb_ngoai',    x:1300, y:1660, to:'ngoai',       name:'Rời Phó Bản → Ngoại Ô',           portal:true, label:'Xuất Môn' },
  { map:'chungnam',    x:2200, y:790,  to:'pb_chungnam', name:'Phó Bản · Phản Đồ Mật Thất',     portal:true, label:'Phó Bản' },
  { map:'pb_chungnam', x:1300, y:1660, to:'chungnam',    name:'Rời Phó Bản → Chung Nam Sơn',     portal:true, label:'Xuất Môn' },
  { map:'comoc',       x:2200, y:890,  to:'pb_comoc',    name:'Phó Bản · Mộ Chủ Địa Cung',      portal:true, label:'Phó Bản' },
  { map:'pb_comoc',    x:1300, y:1660, to:'comoc',       name:'Rời Phó Bản → Cổ Mộ Mật Thất',    portal:true, label:'Xuất Môn' },
  { map:'tuyettinh',   x:2200, y:690,  to:'pb_tuyettinh',name:'Phó Bản · Tình Hỏa Luyện Ngục',  portal:true, label:'Phó Bản' },
  { map:'pb_tuyettinh',x:1300, y:1660, to:'tuyettinh',   name:'Rời Phó Bản → Tuyệt Tình Cốc',    portal:true, label:'Xuất Môn' },
  { map:'mongco',      x:2200, y:790,  to:'pb_mongco',   name:'Phó Bản · Hãn Vương Trướng',     portal:true, label:'Phó Bản' },
  { map:'pb_mongco',   x:1300, y:1660, to:'mongco',      name:'Rời Phó Bản → Mông Cổ Đại Doanh', portal:true, label:'Xuất Môn' },
  { map:'nhanmon',     x:2200, y:790,  to:'pb_nhanmon',  name:'Phó Bản · Thiên Binh Đài',       portal:true, label:'Phó Bản' },
  { map:'pb_nhanmon',  x:1300, y:1660, to:'nhanmon',     name:'Rời Phó Bản → Nhạn Môn Quan',     portal:true, label:'Xuất Môn' },
);


// ==================== BẾ QUAN OFFLINE (bài học idle Nhất Niệm Tiêu Dao) ====================
// Vắng mặt vẫn tu luyện: quay lại nhận Chân Khí + Tu Vi theo thời gian offline (trần 8 giờ).
// Cảnh giới Đan Điền càng cao, hiệu quả bế quan càng lớn.
function grantOfflineGains(savedAt){
  if (!player || !savedAt) return;
  const offSec = Math.min(8*3600, Math.max(0, (Date.now() - savedAt)/1000));
  if (offSec < 600) return; // dưới 10 phút không tính
  const mins = offSec/60;
  const realm = player.dantian ? player.dantian.realm : 0;
  const khiGain = Math.floor(mins * (3 + realm*1.2) * tulinhMult());
  const tuviGain = Math.floor(mins * (1.5 + realm*0.8) * tulinhMult());
  if (khiGain <= 0 && tuviGain <= 0) return;
  player.khi += khiGain;
  player.dantian.tuvi += tuviGain;
  showOfflineGains(offSec, khiGain, tuviGain);
}
function showOfflineGains(offSec, khiGain, tuviGain){
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,8,6,.72);backdrop-filter:blur(3px)';
  const hh = Math.floor(offSec/3600), mm = Math.floor((offSec%3600)/60);
  ov.innerHTML = `<div style="max-width:430px;padding:28px 34px;border:1px solid #c9a227;border-radius:10px;background:linear-gradient(160deg,#1d1812,#12100c);text-align:center;box-shadow:0 0 60px rgba(201,162,39,.25)">
    <div style="font-family:'Playfair Display',serif;font-size:24px;color:#f0d68a;margin-bottom:6px;letter-spacing:2px">Bế Quan Xuất Thế</div>
    <div style="font-size:13px;color:#b8a878;margin-bottom:14px;line-height:1.7">Đạo hữu bế quan ${hh > 0 ? hh + ' canh giờ ' : ''}${mm} khắc — chân khí tự vận hành chu thiên khắp kinh mạch.</div>
    <div style="font-size:15px;line-height:2;color:#e8dcc0">
      <div>Chân Khí <b style="color:#7fd8e0">+${khiGain}</b></div>
      <div>Tu Vi <b style="color:#9fd0ff">+${tuviGain}</b></div>
    </div>
    <div style="font-size:11.5px;color:#8a7a58;margin-top:12px">Cảnh giới Đan Điền càng cao, bế quan càng hiệu quả · tối đa 8 canh giờ</div>
    <button id="btn-xuatquan" style="margin-top:16px;padding:9px 36px;background:#c9a227;border:none;border-radius:6px;color:#1d1812;font-weight:700;cursor:pointer;font-size:14px;letter-spacing:2px">Xuất Quan</button>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#btn-xuatquan').onclick = () => { ov.remove(); AudioSys.sfx('ui', 0.6); };
}


// ==================== NỘI ĐAN YÊU THÚ (bài học Phi Nguyệt Tiên Hành Lục) ====================
// Quái tinh anh/boss rớt Nội Đan theo hành — Thôn Phệ tăng chỉ số VĨNH VIỄN, tối đa 3 viên/ngày.
const ND_EFFECT = {
  Kim:   { k:'atk',  v:6,   desc:'+6 công lực mỗi viên' },
  'Mộc': { k:'hp',   v:40,  desc:'+40 sinh lực mỗi viên' },
  'Thổ': { k:'def',  v:4,   desc:'+4 phòng ngự mỗi viên' },
  'Thủy':{ k:'qi',   v:25,  desc:'+25 nội lực mỗi viên' },
  'Hỏa': { k:'crit', v:0.5, desc:'+0.5% chí mạng mỗi viên' },
};
function ndToday(){
  const d = new Date().toDateString();
  if (player.ndDay !== d){ player.ndDay = d; player.ndCount = 0; }
  return player.ndCount || 0;
}
window.swallowNoidan = function(el2){
  if (!player.noidan || !(player.noidan[el2] > 0)) return;
  if (ndToday() >= 3){
    addFloat(player.x, player.y-40, 'Kinh mạch đã bão hòa — ngày mai hãy thôn phệ tiếp!', '#8a8a8a', 12);
    return;
  }
  player.noidan[el2]--;
  const ef = ND_EFFECT[el2];
  player.ndBonus[ef.k] = (player.ndBonus[ef.k] || 0) + ef.v;
  player.ndCount = ndToday() + 1;
  calcDerived();
  addFloat(player.x, player.y-50, `Thôn phệ Nội Đan ${el2}: ${ef.desc.split(' mỗi')[0]} VĨNH VIỄN!`, NGU_HANH[el2].color, 14);
  addEffect({ type:'ring', x:player.x, y:player.y, r:60, color:NGU_HANH[el2].color });
  AudioSys.sfx('levelup', 0.5);
  saveGame(); renderBag();
};


// ==================== LINH THÚ ĐỒNG HÀNH (bài học Phi Nguyệt + NNTD) ====================
// Thu phục quái TINH ANH suy yếu (<40% máu) bằng Phong Linh Phù — bấm T khi đứng gần.
// Linh thú đi theo, tự săn quái quanh chủ; cho ăn Nội Đan để mạnh lên & tiến hóa (10 viên/bậc, hệ khớp tính 2).
let petObj = null;
function ensurePet(){
  if (!player || !player.pet){ petObj = null; return; }
  if (petObj) return;
  const d = MOBS[player.pet.type];
  if (!d){ player.pet = null; return; }
  petObj = { type:player.pet.type, def:d, name:player.pet.name,
    x:player.x-44, y:player.y+34, zone:null, pack:null, hp:1, maxHp:1, atkT:0, dead:false, face:0,
    shield:0, shieldT:0, hitT:0, wob:Math.random()*10, packAlert:0, lungeT:0, isPet:true };
}
function petDmg(){
  const p = player.pet;
  return Math.round((8 + p.lv*2 + (p.feed || 0)*4) * (1 + Math.floor((p.feed || 0)/10)*0.2));
}
function updatePet(dt){
  if (!player || dead){ petObj = null; return; }
  ensurePet();
  if (!petObj) return;
  petObj.wob += dt*6;
  const tx = player.x - 44, ty = player.y + 34;
  const dd = dist(petObj.x, petObj.y, tx, ty);
  if (dd > 4){
    const sp = Math.min(dd*4, 320);
    petObj.x += (tx-petObj.x)/dd*sp*dt; petObj.y += (ty-petObj.y)/dd*sp*dt;
  }
  petObj.atkT -= dt;
  if (petObj.atkT <= 0){
    let best = null, bd = 280;
    for (const m of mobs){
      if (m.dead || m.def.duHiep) continue;
      const d2 = dist(petObj.x, petObj.y, m.x, m.y);
      if (d2 < bd){ bd = d2; best = m; }
    }
    if (best){
      petObj.atkT = 1.2;
      petObj.face = Math.atan2(best.y-petObj.y, best.x-petObj.x);
      hurtMob(best, petDmg(), 'pet');
    } else petObj.atkT = 0.3;
  }
}
function drawPet(){
  drawMob(petObj);
  const nh = NGU_HANH[player.pet.el] || { color:'#b08ae8' };
  ctx.font = '10px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
  const label = '🐾 ' + petObj.name;
  ctx.strokeText(label, petObj.x, petObj.y - petObj.def.size - 22);
  ctx.fillStyle = nh.color; ctx.fillText(label, petObj.x, petObj.y - petObj.def.size - 22);
}
window.tryTame = function(){
  if (!player || dead) return;
  if (player.pet){ addFloat(player.x, player.y-40, 'Đã có Linh Thú — muốn đổi hãy Phóng Sinh trước (Nhân Vật → Linh Thú)!', '#8a8a8a', 12); return; }
  if ((player.phongphu || 0) <= 0){ addFloat(player.x, player.y-40, 'Cần Phong Linh Phù — bán ở Vũ Khí Phường!', '#ff7a6a', 12); return; }
  let best = null, bd = 230;
  for (const m of mobs){
    if (m.dead || !m.def.elite || m.def.boss || m.def.duHiep) continue;
    if (m.hp > m.maxHp*0.4) continue;
    const d2 = dist(player.x, player.y, m.x, m.y);
    if (d2 < bd){ bd = d2; best = m; }
  }
  if (!best){ addFloat(player.x, player.y-40, 'Không có tinh anh suy yếu (<40% máu) trong tầm — đánh nó xuống trước đã!', '#8a8a8a', 12); return; }
  player.phongphu--;
  if (Math.random() < 0.65){
    player.pet = { type:best.type, name:best.def.name, lv:best.def.lv, el:best.def.el, feed:0 };
    best.dead = true; best.zone = null;
    petObj = null;
    zoneBanner = { text:'🐾 THU PHỤC THÀNH CÔNG', sub:`${best.def.name} hệ ${best.def.el} nguyện theo ngươi — xem ở Nhân Vật → Linh Thú!`, color:'#b08ae8', t:3.5 };
    addEffect({ type:'ring', x:player.x, y:player.y, r:90, color:'#b08ae8', big:true });
    AudioSys.sfx('levelup', 0.8);
    saveGame();
  } else {
    addFloat(player.x, player.y-46, 'Thu phục thất bại — linh thú phản kháng mạnh!', '#ff7a6a', 13);
    AudioSys.sfx('hurt', 0.5);
  }
};
function renderPet(){
  const c = el('char-content'); if (!c) return;
  const p = player.pet;
  let html = '';
  if (!p){
    html = `<div class="stat-sec">LINH THÚ</div>
      <div style="font-size:12.5px;color:#b8a878;line-height:1.9">Ngươi chưa có linh thú đồng hành.<br><br>
      <b style="color:#f0d68a">Cách thu phục:</b><br>
      1. Mua <b style="color:#d8baff">Phong Linh Phù</b> ở Vũ Khí Phường (Tương Dương)<br>
      2. Đánh quái <b>tinh anh</b> (Hắc Phong Sát, Kiếm Khách Bán Đảo, Hắc Y Sát Thủ…) còn dưới 40% máu<br>
      3. Đứng gần và bấm <b style="color:#f0d68a">T</b> — 65% thành công<br><br>
      Phù đang có: <b style="color:#f0d68a">${player.phongphu || 0}</b></div>`;
  } else {
    const nh = NGU_HANH[p.el] || { color:'#e8dcc0', glyph:'·' };
    const tier = Math.floor((p.feed || 0)/10);
    html = `<div class="stat-sec">LINH THÚ ĐỒNG HÀNH</div>
      <div style="font-size:13px;line-height:2;color:#e8dcc0">
        <b style="color:${nh.color};font-size:15px">${nh.glyph} ${p.name}</b>${tier > 0 ? ` <span style="color:#f0d68a">· Tinh Anh bậc ${tier}</span>` : ''} · hệ ${p.el} · C${p.lv}<br>
        Sức mạnh: <b style="color:#f0d68a">${petDmg()} ST</b> mỗi 1.2s — tự săn quái quanh ngươi<br>
        Đã cho ăn: <b>${p.feed || 0}</b> nội đan ${`(còn ${10 - (p.feed || 0)%10} viên nữa tiến hóa)`}
      </div>
      <div class="forge-actions">
        <button class="mini-btn" onclick="feedPet()">● Cho Ăn Nội Đan (hệ ${p.el} tính ×2)</button>
        <button class="mini-btn" style="border-color:#7a4a3a;color:#c88" onclick="releasePet()">Phóng Sinh</button>
      </div>
      <div style="font-size:11.5px;opacity:.6;margin-top:4px">Nội đan trong túi: ${['Kim','Mộc','Thổ','Thủy','Hỏa'].map(e2=>`${e2} ${(player.noidan && player.noidan[e2]) || 0}`).join(' · ')}</div>`;
  }
  c.innerHTML = html;
}
window.feedPet = function(){
  const p = player.pet; if (!p) return;
  let el2 = null;
  if (player.noidan && player.noidan[p.el] > 0) el2 = p.el;
  else el2 = ['Kim','Mộc','Thổ','Thủy','Hỏa'].find(e2 => (player.noidan[e2] || 0) > 0);
  if (el2 == null){ addFloat(player.x, player.y-40, 'Hết nội đan — săn tinh anh/boss để kiếm thêm!', '#8a8a8a', 12); return; }
  const bonus = el2 === p.el ? 2 : 1;
  player.noidan[el2]--;
  p.feed = (p.feed || 0) + bonus;
  addFloat(player.x, player.y-50, `Linh thú ăn Nội Đan ${el2} (+${bonus}) — sức mạnh ${petDmg()}!`, NGU_HANH[el2].color, 13);
  AudioSys.sfx('quest', 0.5);
  saveGame(); renderPet();
};
window.releasePet = function(){
  if (!player.pet) return;
  addFloat(player.x, player.y-46, `${player.pet.name} đã được phóng sinh về núi rừng…`, '#8a8a8a', 12);
  player.pet = null; petObj = null;
  saveGame(); renderPet();
};

// ==================== ĐỘNG PHỦ (bài học NNTD + Phi Nguyệt) ====================
// Tụ Linh Trận: tăng tốc mọi tu luyện (bế quan offline, ngồi thiền, chân khí thụ động).
// Dược Viên: 3 luống trồng linh dược theo GIỜ THỰC — quay lại thu hoạch.
const TULINH_TIERS = [0, 0.15, 0.30, 0.50, 0.75, 1.00];
const GARDEN_SEEDS = {
  hoisinh: { name:'Hồi Sinh Thảo', time:3600,  desc:'1 giờ → 2 🧪 Hồ Lô Thuốc' },
  tukhi:   { name:'Tụ Khí Thảo',   time:7200,  desc:'2 giờ → +200 Chân Khí' },
  ngoctam: { name:'Ngọc Tâm Thảo', time:14400, desc:'4 giờ → +150 Tu Vi' },
};
function tulinhMult(){ return 1 + (TULINH_TIERS[(player && player.abode && player.abode.tulinh) || 0] || 0); }
function renderAbode(){
  if (player.level < 30){ // mở theo tầng — tân thủ tập trung chiến đấu & nhiệm vụ trước
    el('panel-quest').innerHTML = `<h3>Động Phủ</h3><button class="close-x" onclick="closePanels()">✕</button>
      <div style="padding:14px;font-size:13px;line-height:1.8">Quản Gia lắc đầu: <i>"Đạo hữu tu vi còn mỏng, chưa gánh nổi linh khí động phủ."</i><br><br>
      Động Phủ mở khóa ở <b style="color:#f0d68a">cấp 30</b> — hãy rèn thân đã!</div>`;
    closePanels(); el('panel-quest').classList.remove('hidden');
    return;
  }
  const ab = player.abode;
  const t = ab.tulinh;
  let html = `<h3>Động Phủ</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">"Động phủ này tuy nhỏ — nhưng linh khí hội tụ thì đạo hữu tu một ngày bằng kẻ khác tu mười ngày."</div>`;
  // Tụ Linh Trận
  html += `<div class="stat-sec">TỤ LINH TRẬN — BẬC ${t}/5 · tu luyện nhanh +${Math.round(TULINH_TIERS[t]*100)}%</div>`;
  if (t < 5){
    const costS = 500*(t+1), costM = 3*(t+1);
    html += `<div class="npc-shop-row"><span><b style="color:#9fd0ff">Nâng lên bậc ${t+1}</b> — tu luyện nhanh +${Math.round(TULINH_TIERS[t+1]*100)}%<br>
      <span style="font-size:11px;opacity:.7">Áp dụng: bế quan offline · ngồi thiền · chân khí thụ động</span></span>
      <button class="mini-btn" ${player.silver >= costS && player.mat >= costM ? '' : 'disabled'} onclick="upgradeTulinh()">${costS}◈ + ${costM}✦</button></div>`;
  } else html += `<div style="font-size:12px;color:#8fd18f">Tụ Linh Trận đã viên mãn — linh khí hội tụ tột đỉnh!</div>`;
  // Dược Viên
  html += `<div class="stat-sec">DƯỢC VIÊN — trồng theo giờ thực</div>`;
  for (let i = 0; i < 3; i++){
    const plot = ab.garden[i];
    if (!plot){
      html += `<div class="npc-shop-row"><span><b>Luống ${i+1}</b> — đang trống<br>
        <span style="font-size:11px;opacity:.7">${Object.values(GARDEN_SEEDS).map(x=>x.desc).join(' · ')}</span></span>
        <span style="text-align:right">${Object.keys(GARDEN_SEEDS).map(k=>`<button class="mini-btn" style="margin:2px 0" ${player.silver<100?'disabled':''} onclick="plantSeed(${i},'${k}')">${GARDEN_SEEDS[k].name}<br>100◈</button>`).join('')}</span></div>`;
    } else {
      const sd = GARDEN_SEEDS[plot.seed];
      const left = Math.max(0, Math.ceil((plot.readyAt - Date.now())/1000));
      if (left > 0){
        html += `<div class="npc-shop-row"><span><b style="color:#7ec850">${sd.name}</b> đang lớn…<br>
          <span style="font-size:11px;opacity:.7">${sd.desc}</span></span>
          <button class="mini-btn" disabled>${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</button></div>`;
      } else {
        html += `<div class="npc-shop-row"><span><b style="color:#f0d68a">${sd.name}</b> đã chín!<br>
          <span style="font-size:11px;opacity:.7">${sd.desc}</span></span>
          <button class="mini-btn" onclick="harvestSeed(${i})">Thu Hoạch</button></div>`;
      }
    }
  }
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.upgradeTulinh = function(){
  const ab = player.abode, t = ab.tulinh;
  if (t >= 5) return;
  const costS = 500*(t+1), costM = 3*(t+1);
  if (player.silver < costS || player.mat < costM) return;
  player.silver -= costS; player.mat -= costM; ab.tulinh++;
  zoneBanner = { text:`TỤ LINH TRẬN BẬC ${ab.tulinh}`, sub:`Linh khí hội tụ — tốc độ tu luyện +${Math.round(TULINH_TIERS[ab.tulinh]*100)}%!`, color:'#9fd0ff', t:3 };
  AudioSys.sfx('levelup', 0.7);
  saveGame(); renderAbode();
};
window.plantSeed = function(i, seed){
  const ab = player.abode;
  if (ab.garden[i] || !GARDEN_SEEDS[seed] || player.silver < 100) return;
  player.silver -= 100;
  ab.garden[i] = { seed, readyAt: Date.now() + GARDEN_SEEDS[seed].time*1000 };
  addFloat(player.x, player.y-40, `Đã gieo ${GARDEN_SEEDS[seed].name} vào luống ${i+1}!`, '#7ec850', 12);
  AudioSys.sfx('ui', 0.5);
  saveGame(); renderAbode();
};
window.harvestSeed = function(i){
  const ab = player.abode, plot = ab.garden[i];
  if (!plot || plot.readyAt > Date.now()) return;
  ab.garden[i] = null;
  if (plot.seed === 'hoisinh'){
    player.potions = Math.min(5, player.potions + 2);
    addFloat(player.x, player.y-50, 'Thu hoạch: +2 🧪 Hồ Lô Thuốc!', '#7ec850', 13);
  } else if (plot.seed === 'tukhi'){
    player.khi += 200;
    addFloat(player.x, player.y-50, 'Thu hoạch: +200 Chân Khí!', '#7fd8e0', 13);
  } else {
    player.dantian.tuvi += 150;
    addFloat(player.x, player.y-50, 'Thu hoạch: +150 Tu Vi!', '#9fd0ff', 13);
  }
  AudioSys.sfx('quest', 0.6);
  saveGame(); renderAbode();
};

// ==================== ĐƠN GIẢN HÓA CHO TÂN THỦ ====================
// 1) Mở khóa theo tầng cấp — hệ thống nào chưa tới cấp thì khóa lại, khỏi ngợp.
// 2) Mục Tiêu Hôm Nay — checklist nhỏ trên quest tracker, xong hết nhận thưởng.
// 3) Hint bar theo cấp — tân thủ chỉ thấy phím cốt lõi.

// ---------- Mở khóa theo tầng ----------
function sysUnlocked(id){
  if (!player) return true;
  const def = (typeof CHAR_TABS !== 'undefined') && CHAR_TABS.find(x=>x.id===id);
  const lv = def ? def.lv : 1;
  if (player.level >= lv) return true;
  // Linh Thú: đã có pet hoặc đã mua Phong Linh Phù thì không khóa lại
  if (id === 'pet' && (player.pet || (player.phongphu || 0) > 0)) return true;
  return false;
}

// ---------- Hint bar theo cấp ----------
function hintText(){
  const lv = player.level;
  const parts = ['WASD di chuyển', 'Space đánh', 'E nói chuyện', 'R hồ lô thuốc'];
  if (lv >= 3) parts.push('Q nhiệm vụ');
  if (lv >= 5) parts.push('C nhân vật', 'B túi');
  if (lv >= 8) parts.push('M bản đồ', 'K kỹ năng');
  if (lv >= 15) parts.push('T thu phục');
  if (lv >= 10) parts.push('L nhân mạch');
  if (player.canJump) parts.push('J nhảy');
  return parts.join(' · ');
}

// ---------- Mục Tiêu Hôm Nay ----------
const DAILY_GOALS = [
  { id:'kills',   icon:'⚔', name:'Hạ 10 yêu thú',        need:10 },
  { id:'noidan',  icon:'●', name:'Thu 1 Nội Đan',        need:1 },
  { id:'dungeon', icon:'🏯', name:'Thông quan 1 phó bản', need:1 },
  { id:'forge',   icon:'🔨', name:'Rèn / tấn chức / xung mạch 1 lần', need:1 },
];
function dailyReset(){
  if (!player) return;
  if (!player.daily) player.daily = { day:'', kills:0, noidan:0, dungeon:0, forge:0, claimed:false };
  const today = new Date().toDateString();
  if (player.daily.day !== today)
    player.daily = { day:today, kills:0, noidan:0, dungeon:0, forge:0, claimed:false };
  if (!player.truyna || player.truyna.day !== today)
    player.truyna = { day: today, state:'none', map: null };
}
function dailyTrack(key, n){
  if (!player || dead) return;
  dailyReset();
  player.daily[key] = (player.daily[key] || 0) + (n || 1);
  const g = DAILY_GOALS.find(x=>x.id===key);
  if (g && player.daily[key] === g.need)
    addFloat(player.x, player.y-92, `☀ Mục tiêu: ${g.name} — XONG!`, '#7ec850', 13);
  dailyCheckReward();
}
function dailyCheckReward(){
  const d = player.daily;
  if (!d || d.claimed) return;
  if (!DAILY_GOALS.every(g => (d[g.id] || 0) >= g.need)) return;
  d.claimed = true;
  player.silver += 200; player.khi += 100; player.dantian.tuvi += 50;
  zoneBanner = { text:'☀ HOÀN THÀNH MỤC TIÊU HÔM NAY!',
    sub:'+200◈ bạc · +100 Chân Khí · +50 Tu Vi — quay lại ngày mai nhé!',
    color:'#7ec850', t:4.5 };
  AudioSys.sfx('levelup', 0.85);
  saveGame();
}
function dailyHtml(){
  dailyReset();
  const d = player.daily;
  let html = `<div class="q-daily"><div class="q-title">☀ Mục Tiêu Hôm Nay</div>`;
  if (d.claimed){
    html += `<div class="q-done">✔ Đã nhận thưởng — quay lại ngày mai!</div>`;
  } else {
    for (const g of DAILY_GOALS){
      const done = (d[g.id] || 0) >= g.need;
      html += `<div class="q-daily-row${done?' done':''}">${done?'✔':'·'} ${g.icon} ${g.name}
        <span>${done ? '' : ` <b>${Math.min(d[g.id]||0, g.need)}/${g.need}</b>`}</span></div>`;
    }
  }
  html += `</div>`;
  return html;
}

// ==================== BÁI SƯ NHẬP PHÁI (Tán Nhân cấp 10 chọn môn phái) ====================
// Người mới khởi đầu làm Tán Nhân (không hệ ngũ hành — không khắc cũng không bị khắc).
// Tới cấp 10, 7 môn phái mở cửa: chọn 1, nhận lễ vật nhập môn, chiêu thức đổi theo phái.
window.openSectCeremony = function(){
  if (!player || player.sect !== 'vophai') return;
  if (player.level < 10){
    addFloat(player.x, player.y-56, `Bái sư mở khóa ở cấp 10 (hiện cấp ${player.level})`, '#a0ffe9', 13);
    return;
  }
  const wrap = el('ceremony-cards');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (const key in SECTS){
    if (key === 'vophai') continue;
    const s = SECTS[key];
    const card = document.createElement('div');
    card.className = 'sect-card';
    card.innerHTML = `<img class="portrait" src="${SECT_ART[key].portrait}" alt="${s.name}">
      <div class="s-title" style="color:${s.color}">${s.glyph} ${s.name}</div>
      <div class="s-role">${s.role} · hệ <b style="color:${(NGU_HANH[s.element]||{}).color || '#e8d9b0'}">${s.element}</b></div>
      <div class="s-desc">${s.desc}<br><br><b>Nhập môn:</b> ${s.skillA.name}<br><b>Trấn phái:</b> ${s.tp.name}</div>
      <button class="mini-btn" style="margin-top:10px;font-size:13px;padding:7px 20px;border-color:${s.color};color:${s.color}">Bái Sư</button>`;
    card.addEventListener('click', ()=>chooseSect(key));
    wrap.appendChild(card);
  }
  closePanels();
  el('sect-ceremony').classList.remove('hidden');
  AudioSys.sfx('quest', 0.7);
};
window.chooseSect = function(key){
  if (!player || player.sect !== 'vophai' || !SECTS[key] || key === 'vophai') return;
  player.sect = key;
  const s = SECTS[key];
  player.silver += 500; // lễ vật nhập môn
  const w = genItem(10, 0.25); w.slot = 'weapon'; w.slotName = 'Vũ Khí';
  if (player.inv.length < 30) player.inv.push(w); else player.silver += 300;
  player.skillBar = ['a','amkhi','tp',null,null]; // gán sẵn chiêu môn phái mới
  // Nghi thức Thần Binh: hồ lô Tán Nhân hóa thành thần binh của phái mới
  const _tb = THANBINH[key];
  if (_tb){
    addEffect({ type:'ring', x:player.x, y:player.y, r:110, color:_tb.color, big:true });
    setTimeout(()=>{ if (player) addFloat(player.x, player.y-70, `⚔ THẦN BINH 【${_tb.name}】hiện thân — theo người trên đường võ lâm!`, _tb.color, 15); }, 600);
  }
  applySkillIcons();
  calcDerived(); player.hp = player.maxHp; player.qi = player.maxQi;
  el('sect-ceremony').classList.add('hidden');
  zoneBanner = { text:`BÁI NHẬP ${s.name.toUpperCase()}`,
    sub:`Học được ${s.skillA.name} (phím 1) · ${s.tp.name} (phím 3) — lễ vật: 500◈ + vũ khí môn phái`,
    color:s.color, t:5.5 };
  addEffect({ type:'ring', x:player.x, y:player.y, r:130, color:s.color, big:true });
  AudioSys.sfx('levelup', 0.9);
  checkTitles(); saveGame();
  if (!el('panel-char').classList.contains('hidden')) renderCharPanel();
};
el('btn-ceremony-later').addEventListener('click', ()=>{
  el('sect-ceremony').classList.add('hidden');
  addFloat(player.x, player.y-56, 'Tán Nhân tự do cũng tốt — muốn bái sư, mở Nhân Vật (C) bất cứ lúc nào!', '#b8a878', 13);
  AudioSys.sfx('ui', 0.5);
});


// ============================================================
// MÔI TRƯỜNG SỐNG: hạt rơi theo bản đồ, cỏ mặt đất, parallax, cây đung đưa
// (lưu ý: drawTufts/drawAmbients/drawTree chạy trong hệ tọa độ THẾ GIỚI —
//  ctx đã translate(-camera) sẵn từ render(), không trừ camera lần nữa)
// ============================================================
const MAP_AMBIENT = {
  daohoa:     { kind:'petal',   color:'#f0a8c0', n:26 }, // hoa đào rơi
  tuongduong: { kind:'mote',    color:'#f0d68a', n:18 }, // bụi vàng thành thị
  ngoai:      { kind:'leaf',    color:'#9ab86a', n:22 }, // lá rụng ngoại ô
  chungnam:   { kind:'firefly', color:'#b8e87a', n:20 }, // đom đóm lăng mộ
  comoc:      { kind:'wisp',    color:'#9a86d8', n:18 }, // tà khí cổ mộc
  tuyettinh:  { kind:'petal',   color:'#e890a8', n:24 }, // cánh hoa tuyệt tình
  mongco:     { kind:'sand',    color:'#d8c89a', n:26 }, // cát mông cổ
  nhanmon:    { kind:'snow',    color:'#eef4ff', n:30 }, // tuyết nhạn môn
};
const DUNGEON_AMBIENT = { kind:'ember', color:'#ff9a5a', n:16 }; // than hồng phó bản

const ambients = []; // hạt bay trong thế giới
const tufts = [];    // vệt cỏ / vết mực trên mặt đất

function spawnAmbients(){
  ambients.length = 0; tufts.length = 0;
  // cỏ/vết mực rải khắp map — vẽ bằng đúng tông patch của map
  for (let i = 0; i < 130; i++){
    tufts.push({ x: rnd(0,MAP.w), y: rnd(0,MAP.h), k: rnd(0,Math.PI*2), len: 4+rnd(0,7), rock: rnd(0,1) > 0.72 });
  }
  let cfg = MAP_AMBIENT[curMap] || (curMap && curMap.startsWith('pb_') ? DUNGEON_AMBIENT : { kind:'mote', color:'#e8d8a8', n:14 });
  cfg = seasonAmbientCfg(cfg);
  const _wx = weatherNow(); // thời tiết ngày phủ lên hạt môi trường (Gói B)
  if (_wx){
    if (_wx.id === 'drizzle' || _wx.id === 'storm'){
      const _wn = _wx.id === 'storm' ? 64 : 32;
      for (let i = 0; i < _wn; i++) ambients.push({ kind:'rain', color:'#a8c8e8', x:rnd(0,MAP.w), y:rnd(0,MAP.h), ph:rnd(0,Math.PI*2), sp:0.6+rnd(0,0.9), sz:1.2+rnd(0,0.8) });
    } else if (_wx.id === 'snow'){
      for (let i = 0; i < 46; i++) ambients.push({ kind:'snow', color:'#eef4ff', x:rnd(0,MAP.w), y:rnd(0,MAP.h), ph:rnd(0,Math.PI*2), sp:0.5+rnd(0,0.9), sz:1.4+rnd(0,1.6) });
    }
  } // Lịch Tu Tiên: hạt môi trường theo MÙA
  for (let i = 0; i < cfg.n; i++){
    ambients.push({
      kind: cfg.kind, color: cfg.color,
      x: rnd(0,MAP.w), y: rnd(0,MAP.h),
      ph: rnd(0,Math.PI*2), sp: 0.5 + rnd(0,0.8),
      sz: (cfg.kind==='petal'||cfg.kind==='leaf') ? 2.5+rnd(0,2.5) : 1+rnd(0,1.8),
    });
  }
}

function updateAmbients(dt){
  if (SETTINGS.lowFx || typeof camera === 'undefined') return;
  const t = performance.now()/1000;
  for (const p of ambients){
    const k = p.kind;
    if (k === 'ember' || k === 'wisp'){ p.y -= (14 + p.sp*14)*dt; p.x += Math.sin(t*1.4 + p.ph)*10*dt; }
    else if (k === 'sand'){ p.x += (34 + p.sp*22)*dt; p.y += Math.sin(t*2 + p.ph)*7*dt; }
    else if (k === 'rain'){ p.y += (300 + p.sp*180)*dt; p.x += 46*dt; } // mưa hạ: rơi nhanh, hơi chéo gió
    else if (k === 'snow'){ p.y += (16 + p.sp*10)*dt; p.x += Math.sin(t*0.9 + p.ph)*9*dt; }
    else if (k === 'firefly'){ p.x += Math.sin(t*0.8 + p.ph)*18*dt; p.y += Math.cos(t*0.6 + p.ph)*13*dt; }
    else if (k === 'mote'){ p.y -= 5*dt; p.x += Math.sin(t*0.7 + p.ph)*7*dt; }
    else { p.y += (10 + p.sp*12)*dt; p.x += Math.sin(t*1.2 + p.ph)*14*dt; } // petal/leaf: rơi + đu đưa
    // wrap quanh camera để hạt luôn phủ quanh người chơi
    const L = camera.x - 160, R = camera.x + W + 160, T = camera.y - 160, B = camera.y + H + 160;
    if (p.x < L) p.x = R; else if (p.x > R) p.x = L;
    if (p.y < T) p.y = B; else if (p.y > B) p.y = T;
  }
}

function drawTufts(){
  if (typeof camera === 'undefined') return;
  const patch = mapDef().patch;
  ctx.lineWidth = 1.5;
  for (const g of tufts){
    // culling theo view (tọa độ thế giới)
    if (g.x < camera.x-20 || g.x > camera.x+W+20 || g.y < camera.y-20 || g.y > camera.y+H+20) continue;
    if (g.rock){
      ctx.fillStyle = patch + '28';
      ctx.beginPath(); ctx.ellipse(g.x, g.y, g.len*0.9, g.len*0.42, g.k, 0, Math.PI*2); ctx.fill();
    } else {
      ctx.strokeStyle = patch + '55';
      ctx.beginPath();
      ctx.moveTo(g.x - g.len*0.5, g.y);
      ctx.quadraticCurveTo(g.x, g.y - g.len*0.8, g.x + g.len*0.5, g.y - g.len*0.15);
      ctx.stroke();
    }
  }
}

function drawAmbients(){
  if (SETTINGS.lowFx || typeof camera === 'undefined') return;
  const t = performance.now()/1000;
  for (const p of ambients){
    if (p.x < camera.x-20 || p.x > camera.x+W+20 || p.y < camera.y-20 || p.y > camera.y+H+20) continue;
    if (p.kind === 'petal' || p.kind === 'leaf'){
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t*1.5 + p.ph);
      ctx.fillStyle = p.color; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.ellipse(0, 0, p.sz, p.sz*0.55, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore(); ctx.globalAlpha = 1;
    } else if (p.kind === 'firefly'){
      const bl = 0.25 + 0.75*Math.abs(Math.sin(t*2.2 + p.ph));
      ctx.globalAlpha = bl;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = bl*0.3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz*2.6, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'ember'){
      ctx.globalAlpha = 0.5 + 0.4*Math.sin(t*5 + p.ph);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz*0.8, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'rain'){
      ctx.globalAlpha = 0.35; ctx.strokeStyle = p.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 4, p.y - 16); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = p.kind === 'snow' ? 0.8 : 0.45;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// Núi xa 2 lớp parallax — trôi chậm hơn mặt đất tạo chiều sâu (giữ tông thủy mặc gốc)
function drawMountains(){
  ctx.save();
  const cx = (typeof camera !== 'undefined' && camera) ? camera.x : 0;
  const cy = (typeof camera !== 'undefined' && camera) ? camera.y : 0;
  const ridge = (x, s1, s2, ph) => Math.sin(x*0.006 + ph)*s1 + Math.sin(x*0.017 + ph*2.3)*s2;
  ctx.fillStyle = 'rgba(60,54,44,.26)'; // lớp xa — trôi 18% camera
  ctx.beginPath(); ctx.moveTo(-60, -60);
  for (let x = -60; x <= W+60; x += 14) ctx.lineTo(x, 30 + ridge(x + cx*0.18, 20, 8, 2) - cy*0.05);
  ctx.lineTo(W+60, -60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(60,54,44,.15)'; // lớp gần — trôi 38% camera
  ctx.beginPath(); ctx.moveTo(-60, -60);
  for (let x = -60; x <= W+60; x += 14) ctx.lineTo(x, 58 + ridge(x + cx*0.38, 26, 10, 5) - cy*0.1);
  ctx.lineTo(W+60, -60); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Cây đung đưa nhẹ theo gió — giữ nguyên logic vẽ gốc, thêm xoay quanh gốc cây
function drawTree(d){
  const sway = (SETTINGS.lowFx) ? 0 : Math.sin(performance.now()/900 + d.x*0.7) * 0.025;
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(sway); ctx.translate(-d.x, -d.y);
  const tim = (typeof TREE_IMGS !== 'undefined') && TREE_IMGS[curMap];
  if (tim && tim.complete && tim.naturalWidth){
    const h = 100*d.s, w = h * (tim.naturalWidth/tim.naturalHeight);
    ctx.drawImage(tim, d.x-w/2, d.y-h*0.94, w, h);
    ctx.restore();
    return;
  }
  ctx.strokeStyle = '#3a3025'; ctx.lineWidth = 4*d.s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.quadraticCurveTo(d.x+4*d.s, d.y-18*d.s, d.x-2*d.s, d.y-34*d.s); ctx.stroke();
  const g = ctx.createRadialGradient(d.x, d.y-40*d.s, 2, d.x, d.y-40*d.s, 26*d.s);
  g.addColorStop(0, 'rgba(46,74,50,.85)'); g.addColorStop(1, 'rgba(46,74,50,.15)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(d.x, d.y-40*d.s, 26*d.s, 18*d.s, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(d.x-14*d.s, d.y-30*d.s, 14*d.s, 10*d.s, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(d.x+14*d.s, d.y-32*d.s, 13*d.s, 9*d.s, 0, 0, 7); ctx.fill();
  ctx.restore();
}

// Đồng bộ các checkbox chế độ thử nghiệm (màn intro, màn Quẻ & màn chọn phái cũ)
(function(){
  const boxes = [el('chk-max'), el('chk-max-quze'), el('chk-max-intro')].filter(Boolean);
  for (const box of boxes) box.addEventListener('change', ()=>{ for (const o of boxes) o.checked = box.checked; });
})();

// ============================================================
// THÚ CHIẾN: chiến thú đồng hành — đi theo người chơi, tự tấn công quái
// (thay thế cơ chế cưỡi cũ; nền tảng để sau này gắn kỹ năng riêng cho thú)
// ============================================================
let mountObj = null;
function ensureMount(){
  if (!player || !player.mount || !player.mount.out || player.mount.tier <= 0){ mountObj = null; return; }
  if (mountObj) return;
  mountObj = { tier: player.mount.tier, x: player.x + 52, y: player.y + 36,
    atkT: 0.6, face: 0, wob: Math.random()*10, lungeT: 0 };
}
function mountDmg(){
  const t = MOUNT_TIERS[player.mount.tier];
  return Math.round(t.dmg + (player.atk || 0) * 0.2);
}
function updateMount(dt){
  if (!player || dead){ mountObj = null; return; }
  ensureMount();
  if (!mountObj) return;
  mountObj.wob += dt*6;
  mountObj.lungeT = Math.max(0, mountObj.lungeT - dt);
  // bám theo người chơi — đứng lệch bên phải (Linh Thú bên trái)
  const tx = player.x + 52, ty = player.y + 36;
  const dd = dist(mountObj.x, mountObj.y, tx, ty);
  if (dd > 6){
    const sp = Math.min(dd*4, 340);
    mountObj.x += (tx-mountObj.x)/dd*sp*dt; mountObj.y += (ty-mountObj.y)/dd*sp*dt;
  }
  // tự tấn công quái gần nhất (không đánh Du Hiệp trung lập)
  mountObj.atkT -= dt;
  if (mountObj.atkT <= 0){
    let best = null, bd = 320;
    for (const m of mobs){
      if (m.dead || m.def.duHiep) continue;
      const d2 = dist(mountObj.x, mountObj.y, m.x, m.y);
      if (d2 < bd){ bd = d2; best = m; }
    }
    if (best){
      mountObj.atkT = 1.4;
      mountObj.face = Math.atan2(best.y-mountObj.y, best.x-mountObj.x);
      mountObj.lungeT = 0.18; // vồ tới trước khi cắn
      hurtMob(best, mountDmg(), 'mount');
      const t = MOUNT_TIERS[player.mount.tier];
      addEffect({ type:'ring', x:best.x, y:best.y, r:14, color:t.color });
    } else mountObj.atkT = 0.3;
  }
}
function drawMount(){
  const t = MOUNT_TIERS[mountObj.tier];
  const img = MOUNT_IMGS[mountObj.tier];
  const now = performance.now();
  // bóng đổ
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath();
  ctx.ellipse(mountObj.x, mountObj.y+7, 20, 7, 0, 0, 7); ctx.fill();
  const bob = Math.abs(Math.sin(mountObj.wob)) * 3;
  const lunge = mountObj.lungeT > 0 ? (mountObj.lungeT/0.18)*9 : 0;
  const lx = Math.cos(mountObj.face)*lunge, ly = Math.sin(mountObj.face)*lunge;
  if (img && img.complete && img.naturalWidth){
    const mh = 84, mw = mh * (img.naturalWidth/img.naturalHeight);
    const flip = Math.cos(mountObj.face) < 0;
    ctx.save();
    ctx.translate(mountObj.x + lx, mountObj.y - 20 - bob + ly);
    if (flip) ctx.scale(-1, 1);
    ctx.rotate(Math.sin(mountObj.wob)*0.03);
    ctx.drawImage(img, -mw/2, -mh/2, mw, mh);
    ctx.restore();
  } else {
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.ellipse(mountObj.x + lx, mountObj.y - 14 - bob + ly, 16, 12, 0, 0, 7); ctx.fill();
  }
  // tên + vòng hào quang theo giai
  ctx.font = '10px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
  ctx.strokeText('⚔ ' + t.name, mountObj.x, mountObj.y - 58);
  ctx.fillStyle = t.color;
  ctx.fillText('⚔ ' + t.name, mountObj.x, mountObj.y - 58);
}

// ════════════════════════════════════════════════════════════════════════════
// TRACK HT (GDD §13) + VÒNG LẶP NGÀY (GDD §5.9) — cài đặt chính
// ════════════════════════════════════════════════════════════════════════════

// ---------- Tứ Châu khảm phúc (gọi từ panel Rèn Luyện) ----------
window.useJewel = function(kind, uid){
  let it = null;
  for (const s in player.equip) if (player.equip[s] && player.equip[s].uid === uid) it = player.equip[s];
  if (!it) it = player.inv.find(x => x.uid === uid);
  if (!it || !player.jewels) return;
  const J = player.jewels;
  const msg = document.getElementById('jewel-msg');
  const say = (t, c) => { if (msg){ msg.textContent = t; msg.style.color = c; } };
  if (kind === 'chucPhuc'){
    if (J.chucPhuc < 1 || it.noForge || it.plus > 5) return;
    J.chucPhuc--; it.plus++;
    say(`◎ Chúc Phúc — ${it.name} lên +${it.plus}!`, '#8fd18f');
    addFloat(player.x, player.y-40, `◎ +${it.plus} (Chúc Phúc)`, '#7ec850', 14);
    AudioSys.sfx('forge_ok', 0.9);
  } else if (kind === 'linhHon'){
    if (J.linhHon < 1 || it.noForge || it.plus >= 11) return;
    J.linhHon--;
    if (Math.random() < 0.5){
      it.plus++;
      say(`◉ Linh Hồn — ${it.name} lên +${it.plus}!`, '#8fd18f');
      addFloat(player.x, player.y-40, `◉ +${it.plus} (Linh Hồn)`, '#b08ae8', 14);
      if (it.plus === 10) addFloat(player.x, player.y-58, `☆ Thức tỉnh: ${it.awakened.name}`, '#f39c3d', 13);
      if (it.plus === 11){ player.forged11 = true; addFloat(player.x, player.y-76, '☀ KHAI QUANG +11 — Thiên Lôi Cương Khí!', '#ffd76a', 16); }
      AudioSys.sfx('forge_ok', 0.9);
    } else {
      it.plus = Math.max(0, it.plus - 1);
      say(`✘ Linh Hồn thất bại — ${it.name} tụt còn +${it.plus}`, '#ff7a6a');
      addFloat(player.x, player.y-40, `◉ Xịt — tụt còn +${it.plus}`, '#ff7a6a', 13);
      AudioSys.sfx('forge_fail', 0.85);
    }
  } else if (kind === 'sinhMenh'){
    if (J.sinhMenh < 1 || !ARMOR_SLOTS.includes(it.slot) || (it.life || 0) >= 7) return;
    J.sinhMenh--;
    const rate = Math.max(25, 75 - (it.life || 0) * 8);
    if (Math.random()*100 < rate){
      it.life = (it.life || 0) + 1;
      say(`❤ Sinh Mệnh bậc ${it.life} — +${it.life*4}% HP tối đa!`, '#8fd18f');
      addFloat(player.x, player.y-40, `❤ Sinh Mệnh +${it.life*4}% HP`, '#e84a6a', 14);
      AudioSys.sfx('forge_ok', 0.9);
    } else {
      it.life = 0;
      say('✘ Sinh Mệnh tan biến — dòng HP về 0!', '#ff7a6a');
      addFloat(player.x, player.y-40, '❤ Xịt — Sinh Mệnh về 0!', '#ff7a6a', 13);
      AudioSys.sfx('forge_fail', 0.85);
    }
  }
  dailyTrack('forge');
  calcDerived(); saveGame(); renderForge(); refreshEqPanels();
};

// ---------- Hỗn Độn Lò: luyện Linh Dực ----------
window.craftWing = function(t){
  const J = player.jewels;
  const msg = document.getElementById('bagua-msg');
  const say = (tx, c) => { if (msg){ msg.textContent = tx; msg.style.color = c; } };
  if (t === 1){
    if (player.level < 40 || J.honDon < 1 || player.gems.honNguyen < 10 || player.silver < 5000) return;
    let fk = null, fs = null;
    for (const s in player.equip){ const x = player.equip[s]; if (x && x.perfect && x.plus >= 4 && !x.noForge){ fk = 'equip'; fs = s; break; } }
    if (!fk){ const i = player.inv.findIndex(x => x.perfect && x.plus >= 4 && !x.noForge); if (i >= 0){ fk = 'inv'; fs = i; } }
    if (!fk){ say('✘ Cần 1 trang bị Hoàn Hảo +4 trở lên làm vật hiến tế!', '#ff9a6a'); return; }
    if (fk === 'equip') player.equip[fs] = null; else player.inv.splice(fs, 1);
    J.honDon--; player.gems.honNguyen -= 10; player.silver -= 5000;
    const wi = Math.floor(Math.random()*2);
    const w = genWing(wi);
    if (player.inv.length < 30) player.inv.push(w); else player.silver += 2000;
    zoneBanner = { text:'◈ LINH DỰC XUẤT THẾ', sub:`Hỗn Độn Lò luyện thành ${WING_DEFS[wi].name}!`, color:WING_DEFS[wi].color, t:4.5 };
    say(`✔ Luyện thành ${WING_DEFS[wi].name}!`, '#8fd18f');
    addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:WING_DEFS[wi].color, big:true });
    AudioSys.sfx('forge_ok', 0.95);
  } else if (t === 2){
    const w1 = player.equip.canh || player.inv.find(x => x.slot === 'canh');
    if (player.level < 80 || !w1 || w1.wing2 || J.honDon < 1 || player.gems.honNguyen < 20 || player.silver < 10000) return;
    J.honDon--; player.gems.honNguyen -= 20; player.silver -= 10000;
    const j = Math.floor(Math.random()*2);
    const w2 = specialItem('canh', WING2_DEFS[j], { wing2: WING2_DEFS[j].id });
    if (player.equip.canh === w1) player.equip.canh = w2;
    else { const i = player.inv.indexOf(w1); if (i >= 0) player.inv[i] = w2; else player.inv.push(w2); }
    zoneBanner = { text:'◈ LINH DỰC THĂNG HOA', sub:`${WING2_DEFS[j].name} — sức mạnh vượt trần!`, color:WING2_DEFS[j].color, t:5 };
    say(`✔ Thăng thành ${WING2_DEFS[j].name}!`, '#8fd18f');
    addEffect({ type:'ring', x:player.x, y:player.y, r:140, color:WING2_DEFS[j].color, big:true });
    AudioSys.sfx('levelup', 0.95);
  }
  calcDerived(); saveGame(); renderBaGua(); refreshEqPanels();
};

// ---------- Hỗn Độn Lò: đổi 3 Cổ Thần trùng + 1 Hỗn Độn = 1 món tự chọn ----------
window._hdSel = {}; window._hdSet = 'thanhlong'; window._hdSlot = 'non';
window.hdToggle = function(uid){
  if (window._hdSel[uid]) delete window._hdSel[uid];
  else if (Object.keys(window._hdSel).length < 3 && player.inv.some(x => x.uid === uid && x.ancient)) window._hdSel[uid] = true;
  renderBaGua();
};
window.hdExchange = function(){
  const sel = Object.keys(window._hdSel || {}).map(Number);
  if (sel.length !== 3 || player.jewels.honDon < 1 || player.inv.length >= 30) return;
  const setId = ANCIENT_SETS[window._hdSet] ? window._hdSet : 'thanhlong';
  const slotId = ARMOR_SLOTS.includes(window._hdSlot) ? window._hdSlot : 'non';
  const idxs = player.inv.map((x, i) => (x && sel.includes(x.uid)) ? i : -1).filter(i => i >= 0).sort((a, b) => b - a);
  if (idxs.length !== 3){ window._hdSel = {}; renderBaGua(); return; }
  idxs.forEach(i => player.inv.splice(i, 1));
  player.jewels.honDon--;
  const it = genAncient(setId, slotId, player.level);
  player.inv.push(it);
  window._hdSel = {};
  zoneBanner = { text:'◈ CỔ THẦN TỰ CHỌN', sub:`Hỗn Độn Lò đúc thành ${it.name}!`, color:ANCIENT_SETS[setId].color, t:4.5 };
  addFloat(player.x, player.y-56, `◈ ${it.name}`, ANCIENT_SETS[setId].color, 16);
  AudioSys.sfx('forge_ok', 0.95);
  saveGame(); renderBaGua(); refreshEqPanels();
};

// ---------- Bảo Hạp (mở từ Túi Đồ) — Cổ Thần chỉ từ đây, KHÔNG pity ----------
window.openBaoHap = function(t){
  const bh = player.baohap || {};
  if (!bh[t] || bh[t] <= 0) return;
  const def = BAOHAP_TIERS[t];
  bh[t]--;
  const lv = Math.max(player.level, def.min);
  const got = [];
  if (def.ancient > 0 && Math.random() < def.ancient){
    const setIds = Object.keys(ANCIENT_SETS);
    const it = genAncient(setIds[Math.floor(Math.random()*setIds.length)], ARMOR_SLOTS[Math.floor(Math.random()*ARMOR_SLOTS.length)], lv);
    if (player.inv.length < 30){
      player.inv.push(it);
      got.push(`<b style="color:${ANCIENT_SETS[it.ancient].color}">◈ CỔ THẦN — ${it.name}</b> (${Math.round(def.ancient*100)}% đã mỉm cười!)`);
      zoneBanner = { text:'◈ CỔ THẦN XUẤT THẾ', sub:`${it.name} — ${ANCIENT_SETS[it.ancient].hint}!`, color:'#3ac88a', t:5 };
      AudioSys.sfx('levelup', 0.95);
    } else { player.silver += 3000; got.push('Túi đầy — Cổ Thần quy đổi 3000◈'); }
  } else {
    let it = null;
    for (let i = 0; i < 6; i++){ it = genItem(lv, 0.5 + t*0.06); if (it.rarity >= 2) break; }
    if (player.inv.length < 30){ player.inv.push(it); got.push(`Trang bị: <b class="${RARITIES[it.rarity].cls}">${it.name}</b>`); }
    else { player.silver += 800; got.push('Túi đầy — trang bị quy đổi 800◈'); }
  }
  // Châu kèm theo — tầng càng cao tỉ lệ càng tốt
  const jr = Math.random()*100;
  const cp = 22 + t*2, lh = cp + 12 + t, sm = lh + 6 + t*0.5, hd = sm + 3 + t*0.5;
  if (jr < cp){ player.jewels.chucPhuc++; got.push(JEWEL_NAMES.chucPhuc); }
  else if (jr < lh){ player.jewels.linhHon++; got.push(JEWEL_NAMES.linhHon); }
  else if (jr < sm){ player.jewels.sinhMenh++; got.push(JEWEL_NAMES.sinhMenh); }
  else if (jr < hd){ player.jewels.honDon++; got.push(JEWEL_NAMES.honDon); }
  const sil = 150 + t*120;
  player.silver += sil;
  player.dantian.tuvi += 20*t;
  got.push(`${sil}◈ · ${20*t} Tu Vi`);
  addFloat(player.x, player.y-56, `Mở ${def.name}!`, def.color, 15);
  AudioSys.sfx('coin', 0.7);
  saveGame(); refreshEqPanels();
  el('panel-quest').innerHTML = `<h3>${def.name}</h3><button class="close-x" onclick="closePanels()">✕</button>
    <div style="padding:10px;font-size:13px;line-height:2">Khai mở bảo hạp:<br>${got.join('<br>')}</div>
    <div class="forge-actions"><button class="mini-btn" onclick="closePanels();el('panel-bag').classList.remove('hidden')">Xem Túi Đồ</button></div>`;
  closePanels(); el('panel-quest').classList.remove('hidden');
};

// ---------- Ma Tôn Giáng Thế — 4 giờ/lần (0h 4h 8h 12h 16h 20h), luân phiên Hạ/Thượng Giới ----------
let MATON = { next: 0, warned: false, active: false, map: null, endsAt: 0 };
function matonNextBoundary(after){
  const d = new Date(after); d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  while (d.getHours() % 4 !== 0) d.setHours(d.getHours() + 1);
  return d.getTime();
}
function matonMapFor(t){
  const slot = Math.floor(t / 14400000);
  const half = Math.floor(slot / 2);
  return slot % 2 === 0 ? MATON_HA[half % MATON_HA.length] : MATON_THUONG[half % MATON_THUONG.length];
}
function updateMaTon(){
  const now = Date.now();
  if (!MATON.next) MATON.next = matonNextBoundary(now);
  if (!MATON.active && !MATON.warned && now >= MATON.next - 600000){
    MATON.warned = true;
    const mapId = matonMapFor(MATON.next);
    zoneBanner = { text:'⚠ MA TÔN SẮP GIÁNG THẾ', sub:`10 phút nữa — ${MAPS[mapId].name}. Chuẩn bị ứng chiến!`, color:'#c07fe0', t:5 };
    AudioSys.sfx('quest', 0.8);
  }
  if (!MATON.active && now >= MATON.next){
    MATON.active = true; MATON.warned = false;
    MATON.map = matonMapFor(MATON.next);
    MATON.endsAt = now + 30*60000;
    MATON.next = matonNextBoundary(now + 60000);
    zoneBanner = { text:'☠ MA TÔN GIÁNG THẾ', sub:`Tà khí phủ ${MAPS[MATON.map].name} — hạ Ma Tôn nhận Bảo Hạp!`, color:'#e84a6a', t:6 };
    AudioSys.sfx('crit', 0.9);
    if (curMap === MATON.map) spawnMaTonMob();
    saveGame();
  }
  if (MATON.active && now >= MATON.endsAt){
    MATON.active = false; MATON.map = null;
    zoneBanner = { text:'Ma Tôn đã rời đi', sub:'Tà khí tản dần — hẹn khung giờ sau.', color:'#8a8a8a', t:3.5 };
    saveGame();
  }
}
function spawnMaTonMob(){
  const md = MAPS[MATON.map];
  const lv = Math.min(110, md.min + 12);
  const def = { name:'Ma Tôn · Hỗn Độn', lv, hp: 5000 + lv*lv*7, atk: 10 + Math.round(lv*3), def: Math.round(lv*0.8),
    xp: lv*150, silver:[lv*8, lv*12], speed: 70, aggro: 9999, range: 46, atkCd: 1.3, size: 30,
    color:'#2a0a24', eye:'#ff3a6a', boss:true, elite:true, drop:1, el:'Hỏa', img:'assets/mobs/boss.png' };
  const m = { type:'maton', def, name: def.name,
    x: MAP.w*0.55, y: MAP.h*0.42, zone: null, pack: null,
    hp: def.hp, maxHp: def.hp, atkT: rnd(0,1), dead: false, face: 0,
    shield: 1, shieldT: 0, hitT: 0, wob: Math.random()*10, packAlert: 0 };
  mobs.push(m);
  zoneBanner = { text:'☠ MA TÔN XUẤT HIỆN', sub:'Ngay trước mắt — toàn lực ứng chiến!', color:'#e84a6a', t:4 };
  return m;
}
function matonKilled(m){
  MATON.active = false; MATON.map = null;
  const tier = clamp(Math.floor(player.level/15) + 1, 1, 7);
  player.baohap[tier] = (player.baohap[tier] || 0) + 1;
  zoneBanner = { text:'☠ MA TÔN ĐÃ BỊ TIÊU DIỆT', sub:`Nhận ${BAOHAP_TIERS[tier].name} — mở trong Túi Đồ (phím I)!`, color:'#f0d68a', t:6 };
  addFloat(m.x, m.y-130, `+1 ${BAOHAP_TIERS[tier].name}`, BAOHAP_TIERS[tier].color, 16);
  AudioSys.sfx('levelup', 1);
  saveGame();
}
// Hook QA: đẩy lịch Ma Tôn đến sau vài giây
window.debugMaTon = function(sec){ MATON.next = Date.now() + (sec || 5)*1000; MATON.warned = true; return MATON; };

// ---------- Truy Nã Lệnh (GDD §5.9) — Bổ Đầu · Tương Dương ----------
function truynaBand(){
  let idx = TRUYNA_BANDS.findIndex(b => player.level <= b.max);
  if (idx < 0) idx = TRUYNA_BANDS.length - 1;
  while (idx > 0){
    const g = mapGate(TRUYNA_BANDS[idx].map);
    if (g && g.ok) break;
    idx--;
  }
  return TRUYNA_BANDS[idx];
}
function renderTruyNa(){
  const today = new Date().toDateString();
  if (!player.truyna || player.truyna.day !== today) player.truyna = { day: today, state:'none', map: null };
  const tn = player.truyna;
  const band = truynaBand();
  const n = NPCS.find(x => x.id === 'bodau');
  let html = `<h3>${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">${n.lore}</div>`;
  if (tn.state === 'none'){
    html += `<div class="next-tier"><b style="color:#e8b04a">⚖ Truy Nã Lệnh hôm nay</b><br>
      Mục tiêu: <b style="color:#ff7a6a">${band.name}</b> (sức mạnh theo cấp ${player.level})<br>
      Nơi ẩn náu: <b>${MAPS[band.map].name}</b><br>
      <span style="opacity:.75">Thưởng: 1 ⚜ Công Huân Lệnh + bạc + Tu Vi — mỗi ngày 1 lần</span></div>
      <div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px" onclick="truynaAccept()">Nhận Truy Nã</button></div>`;
  } else if (tn.state === 'hunting'){
    html += `<div class="next-tier" style="border-color:#ff7a6a"><b style="color:#ff7a6a">Đang truy nã: ${band.name}</b><br>
      <span style="opacity:.8">Ẩn náu tại <b>${MAPS[tn.map].name}</b> — tìm và tiêu diệt!</span></div>
      <div class="forge-actions"><button class="mini-btn" onclick="closePanels(); travelTo('${tn.map}')">Dịch Chuyển tới ${MAPS[tn.map].name}</button></div>`;
  } else if (tn.state === 'killed'){
    html += `<div class="next-tier" style="border-color:#8fd18f"><b style="color:#8fd18f">✔ Mục tiêu đã phục pháp!</b><br>
      <span style="opacity:.8">Thưởng: 1 ⚜ Công Huân Lệnh + ${300 + player.level*20}◈ + ${60 + player.level*2} Tu Vi</span></div>
      <div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 20px" onclick="truynaClaim()">Nhận Thưởng</button></div>`;
  } else {
    html += `<div style="padding:12px;font-size:12.5px;opacity:.75;text-align:center;line-height:1.8">✔ Truy nã hôm nay đã xong — quay lại ngày mai!<br>⚜ Công Huân Lệnh đang có: <b style="color:#f0d68a">${player.congHuan}</b><br>Mang đến Vạn Duyên Các (Thần Toán Tử) để rút duyên.</div>`;
  }
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.truynaAccept = function(){
  const tn = player.truyna;
  if (!tn || tn.state !== 'none') return;
  tn.state = 'hunting'; tn.map = truynaBand().map;
  zoneBanner = { text:'⚖ ĐÃ NHẬN TRUY NÃ LỆNH', sub:`Mục tiêu ẩn náu tại ${MAPS[tn.map].name} — tiêu diệt để lĩnh thưởng!`, color:'#e8b04a', t:4.5 };
  AudioSys.sfx('quest', 0.8);
  if (curMap === tn.map && !mobs.some(m => m.truyna && !m.dead)) spawnTruyNaMob();
  saveGame(); renderTruyNa();
};
window.truynaClaim = function(){
  const tn = player.truyna;
  if (!tn || tn.state !== 'killed') return;
  tn.state = 'claimed';
  player.congHuan++;
  player.silver += 300 + player.level*20;
  player.dantian.tuvi += 60 + player.level*2;
  zoneBanner = { text:'⚜ +1 CÔNG HUÂN LỆNH', sub:'Mang đến Vạn Duyên Các — Thần Toán Tử rút duyên (5% bí kíp hiếm)!', color:'#f0d68a', t:5 };
  AudioSys.sfx('levelup', 0.9);
  saveGame(); renderTruyNa();
};
function spawnTruyNaMob(){
  const band = truynaBand();
  const lv = player.level;
  const def = { name:'⚖ ' + band.name, lv, hp: Math.round(1200 + lv*lv*3.5), atk: Math.round(8 + lv*2.1), def: Math.round(lv*0.7),
    xp: lv*120, silver:[lv*6, lv*9], speed: 74, aggro: 220, range: 40, atkCd: 1.2, size: 24,
    color:'#3a2a10', eye:'#ffd76a', boss:true, elite:true, drop:1, el:'Thổ', img:'assets/mobs/boss.png' };
  const m = { type:'truyna', def, name: def.name,
    x: rnd(300, MAP.w-300), y: rnd(300, MAP.h-300), zone: null, pack: null,
    hp: def.hp, maxHp: def.hp, atkT: rnd(0,1), dead: false, face: 0,
    shield: 1, shieldT: 0, hitT: 0, wob: Math.random()*10, packAlert: 0, truyna: true };
  mobs.push(m);
  addFloat(m.x, m.y-70, `⚖ Mục tiêu truy nã xuất hiện: ${band.name}!`, '#e8b04a', 15);
  return m;
}

// ---------- Vạn Duyên Các (GDD §5.9) — Thần Toán Tử · gacha Công Huân Lệnh, KHÔNG pity ----------
// ═══════════ TÉ NÚI (GDD Lấy Võ Nhập Đạo §5.4) — chủ động nhảy vực cầu đạo ═══════════
// Mở sau Thăng Linh (realm 5 · Kim Đan). Mỗi lần té: -30% HP (tối thiểu 1) + Trọng Thương 15 phút.
// Không pity — tỉ lệ công khai tại vách. Giờ vàng Kiếp Vân Tụ (12h & 20h): 2 ô hiếm ×2.
function tenuiGoldenHour(){ const h = new Date().getHours(); return h === 12 || h === 20; }
function tenuiWounded(){ return (player.tenuiTT || 0) > Date.now(); }
function tenuiFreeLearn(preferTier){ // bí kíp nguyên quyển / lão tổ chỉ điểm — tôn trọng khóa cảnh giới
  const realm = (player.dantian && player.dantian.realm) || 0;
  let pool = Object.keys(VOHOC_DEFS).filter(id => !VOHOC_DEFS[id].phai && !vhLearned(id) && vhRealmReq(VOHOC_DEFS[id]) <= realm);
  if (preferTier){
    const hi = pool.filter(id => VOHOC_DEFS[id].tier === preferTier);
    if (hi.length) pool = hi;
  }
  if (!pool.length) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  player.vohoc[pick] = true; calcDerived();
  return VOHOC_DEFS[pick];
}
function renderTeNui(n){
  const realm = (player.dantian && player.dantian.realm) || 0;
  const unlocked = realm >= 5, gold = tenuiGoldenHour(), wounded = tenuiWounded();
  let html = `<h3>${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">${n.lore}</div>`;
  if (!unlocked){
    html += `<div style="text-align:center;padding:14px 8px;font-size:13px;line-height:1.8;color:#8a8a8a">
      ☁ Vách cao mây phủ — phàm nhân té xuống chỉ có nát thây.<br>
      Cần đột phá <b style="color:#b08ae8">Kim Đan Cảnh</b> (Đan Điền — phím N, cảnh 5) để Thăng Linh,<br>
      khi ấy mới đủ sức <b style="color:#e8c84a">Té Núi cầu đạo</b>.</div>`;
  } else {
    html += `<div class="stat-sec">TỈ LỆ CÔNG KHAI — KHÔNG GOM DUYÊN${gold ? ' · <b style="color:#ffd76a">⚡ KIẾP VÂN TỤ: 2 ô hiếm ×2!</b>' : ''}</div>
      <div style="font-size:12px;line-height:1.9;opacity:.9">
      <b style="color:#b8a878">${gold ? 50 : 60}%</b> — Rơi vào lùm cây / dòng suối: 1-2 📜 Bí Kíp + 3-6 ✦ Huyền Thiết<br>
      <b style="color:#7ec850">20%</b> — Lọt vào hang động: 3-5 📜 Bí Kíp<br>
      <b style="color:#5aa0e8">10%</b> — Động phủ tu sĩ cổ: 6-8 📜 Bí Kíp + 3 ◈ Tiến Cấp Đan<br>
      <b style="color:#b08ae8">${gold ? 10 : 5}%</b> — Vách động giấu bí tịch: <b>học miễn phí 1 võ học giang hồ</b> (hết → +15 📜)<br>
      <b style="color:#ffd76a">${gold ? 10 : 5}%</b> — Gặp lão tổ ẩn thế: được chỉ điểm <b>1 võ học chưa ngộ</b></div>
      <div style="font-size:11.5px;color:#9a8a68;margin-top:6px;line-height:1.5">Giờ vàng <b>Kiếp Vân Tụ</b> (12h & 20h mỗi ngày): tỉ lệ bí tịch/lão tổ ×2.<br>
      Cái giá mỗi lần té: <b style="color:#ff7a6a">-30% HP</b> (không chết) + <b style="color:#ff7a6a">Trọng Thương 15 phút</b>.</div>`;
    if (wounded){
      const left = Math.ceil(((player.tenuiTT || 0) - Date.now()) / 1000);
      html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 22px" disabled>🩸 Trọng Thương — còn ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</button></div>`;
    } else {
      html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 22px;border-color:#e8c84a;color:#e8c84a" onclick="doTeNui('${n.id}')">☁ TÉ NÚI — nhảy vực cầu đạo</button></div>`;
    }
    html += `<div id="tn-result" style="min-height:20px;font-size:12.5px;line-height:1.8;margin-top:6px"></div>`;
  }
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.doTeNui = function(npcId){
  const n = NPCS.find(x => x.id === npcId);
  const realm = (player.dantian && player.dantian.realm) || 0;
  if (realm < 5 || tenuiWounded()) return;
  // cái giá: -30% HP (tối thiểu 1) + Trọng Thương 15 phút
  player.hp = Math.max(1, Math.round(player.hp - player.maxHp * 0.3));
  player.tenuiTT = Date.now() + 15*60*1000;
  shakeT = Math.max(shakeT, 0.5); shakeMag = Math.max(shakeMag, 10);
  addEffect({ type:'ring', x:player.x, y:player.y, r:120, color:'#3a3a5a', big:true });
  for (let i = 0; i < 16; i++) addEffect({ type:'ink', x:player.x+rnd(-40,40), y:player.y+rnd(-30,10), vx:rnd(-30,30), vy:rnd(60,140), color:'#5a6a8a' });
  AudioSys.sfx('hurt', 0.9);
  const gold = tenuiGoldenHour();
  const tRare = gold ? 10 : 5; // giờ vàng: 2 ô hiếm 5% → 10%
  const r = Math.random()*100;
  let out = '', col = '#b8a878';
  if (r < tRare){ // vách động giấu bí tịch — bí kíp hiếm nguyên quyển
    const v = tenuiFreeLearn('than') || tenuiFreeLearn(null);
    if (v){ out = `<b style="color:#ffd76a">VÁCH ĐỘNG BÍ TỊCH!</b> Ngộ được <b style="color:${VH_TIER[v.tier].color}">${v.name}</b> — bấm K gán vào taskbar!`;
      zoneBanner = { text:'☁ CƠ DUYÊN NGÀN VÀNG', sub:`${n.name}: vách động giấu bí tịch — ${v.name}!`, color:'#ffd76a', t:5 };
      col = '#ffd76a'; AudioSys.sfx('levelup', 0.9);
    } else { player.bikipVH = (player.bikipVH || 0) + 15; out = 'Vách động trống — bí tịch đã thành tựu hết, nhặt được <b style="color:#e8c84a">15 📜 Bí Kíp</b>'; col = '#e8c84a'; }
  } else if (r < tRare * 2){ // lão tổ ẩn thế chỉ điểm
    const v = tenuiFreeLearn(null);
    if (v){ out = `<b style="color:#b08ae8">LÃO TỔ ẨN THẾ</b> chỉ điểm — ngộ được <b style="color:${VH_TIER[v.tier].color}">${v.name}</b>!`;
      zoneBanner = { text:'☁ LÃO TỔ CHỈ ĐIỂM', sub:`${n.name}: ${v.name} — đạo pháp truyền người hữu duyên`, color:'#b08ae8', t:5 };
      col = '#b08ae8'; AudioSys.sfx('quest', 0.9);
    } else { player.bikipVH = (player.bikipVH || 0) + 10; out = 'Lão tổ gật đầu: "Duyên đã đủ" — <b style="color:#e8c84a">+10 📜 Bí Kíp</b>'; col = '#e8c84a'; }
  } else if (r < tRare * 2 + 10){ // động phủ tu sĩ cổ
    const bk = 6 + Math.floor(Math.random()*3);
    player.bikipVH = (player.bikipVH || 0) + bk; player.tienDan += 3;
    out = `<b style="color:#5aa0e8">Động phủ tu sĩ cổ!</b> +${bk} 📜 Bí Kíp + 3 ◈ Tiến Cấp Đan`; col = '#5aa0e8';
  } else if (r < tRare * 2 + 30){ // hang động
    const bk = 3 + Math.floor(Math.random()*3);
    player.bikipVH = (player.bikipVH || 0) + bk;
    out = `<b style="color:#7ec850">Lọt vào hang động</b> — nhặt được +${bk} 📜 Bí Kíp`; col = '#7ec850';
  } else { // lùm cây / dòng suối
    const bk = 1 + Math.floor(Math.random()*2), mt = 3 + Math.floor(Math.random()*4);
    player.bikipVH = (player.bikipVH || 0) + bk; player.mat += mt;
    out = `Rơi vào lùm cây — may mắn toàn mạng: +${bk} 📜 Bí Kíp + ${mt} ✦ Huyền Thiết`;
  }
  saveGame();
  addFloat(player.x, player.y-56, '☁ TÉ NÚI!', col, 16);
  renderTeNui(n);
  const res = document.getElementById('tn-result');
  if (res) res.innerHTML = `☁ Kết cục: ${out}`;
};

function renderVanDuyen(){
  const n = NPCS.find(x => x.id === 'thantoan');
  let html = `<h3>${n.name}</h3><button class="close-x" onclick="closePanels()">✕</button>`;
  html += `<div style="font-size:12.5px;color:#b8a878;margin-bottom:8px;line-height:1.6">${n.lore}</div>`;
  html += `<div style="font-size:13px;margin-bottom:6px">⚜ Công Huân Lệnh: <b style="color:#f0d68a">${player.congHuan}</b></div>`;
  html += `<div class="stat-sec">TỈ LỆ CÔNG KHAI — KHÔNG GOM DUYÊN (NO PITY)</div>
    <div style="font-size:12px;line-height:1.9;opacity:.9">
    <b style="color:#e84a6a">5%</b> — Bí kíp hiếm: Tàn Quyển · Huyết Ma Thôn Phệ (đã thành tựu → ● Hỗn Độn Châu)<br>
    <b style="color:#b08ae8">15%</b> — Tứ Châu ngẫu nhiên (Chúc Phúc / Linh Hồn / Sinh Mệnh / Hỗn Độn)<br>
    <b style="color:#5aa0e8">25%</b> — Trang bị theo cấp (phẩm Lam trở lên)<br>
    <b style="color:#7ec850">30%</b> — Vật liệu tu luyện (Tu La / Hỗn Nguyên / Tiến Cấp Đan / Huyền Thiết)<br>
    <b style="color:#b8a878">25%</b> — Bạc + Tu Vi</div>`;
  html += `<div class="forge-actions"><button class="mini-btn" style="font-size:13px;padding:8px 22px" ${player.congHuan >= 1 ? '' : 'disabled'} onclick="rollVanDuyen()">☯ Rút Duyên — 1 ⚜</button></div>
    <div id="vd-result" style="min-height:20px;font-size:12.5px;line-height:1.8;margin-top:6px"></div>`;
  el('panel-quest').innerHTML = html;
  closePanels(); el('panel-quest').classList.remove('hidden');
}
window.rollVanDuyen = function(){
  if (player.congHuan < 1) return;
  player.congHuan--;
  let r = Math.random()*100, key = 'bac';
  for (const row of VANDUYEN_RATES){ r -= row.w; if (r < 0){ key = row.k; break; } }
  const out = [];
  if (key === 'bikip'){
    if (!player.bikip.hmtp){
      const p = Math.floor(Math.random()*3);
      player.bikip.pieces[p]++;
      out.push(`<b style="color:#e84a6a">BÍ KÍP HIẾM — Tàn Quyển · ${TAN_QUYEN[p]}!</b> (đang có ${player.bikip.pieces[p]})`);
      zoneBanner = { text:'☯ CƠ DUYÊN NGÀN VÀNG', sub:`Tàn Quyển · ${TAN_QUYEN[p]} — 5% đã mỉm cười với ngươi!`, color:'#e84a6a', t:5 };
    } else { player.jewels.honDon++; out.push('<b style="color:#f0d68a">● Hỗn Độn Châu</b> — bí kíp đã thành tựu, quy đổi châu quý'); }
  } else if (key === 'chau'){
    const jr = Math.random()*100;
    const k = jr < 40 ? 'chucPhuc' : jr < 70 ? 'linhHon' : jr < 90 ? 'sinhMenh' : 'honDon';
    player.jewels[k]++;
    out.push(`<b style="color:${JEWEL_COLORS[k]}">${JEWEL_NAMES[k]}</b>`);
  } else if (key === 'trangbi'){
    let it = null;
    for (let i = 0; i < 6; i++){ it = genItem(player.level, 0.7); if (it.rarity >= 2) break; }
    if (player.inv.length < 30){ player.inv.push(it); out.push(`Trang bị: <b class="${RARITIES[it.rarity].cls}">${it.name}</b>`); }
    else { player.silver += 600; out.push('Túi đầy — trang bị quy đổi 600◈'); }
  } else if (key === 'vatlieu'){
    const jr = Math.random()*100;
    if (jr < 30){ const n2 = 2 + Math.floor(Math.random()*3); player.gems.tuLa += n2; out.push(`◆ Tu La Tinh Thạch ×${n2}`); }
    else if (jr < 50){ const n2 = 1 + Math.floor(Math.random()*2); player.gems.honNguyen += n2; out.push(`❖ Hỗn Nguyên Thạch ×${n2}`); }
    else if (jr < 75){ player.tienDan += 3; out.push('◈ Tiến Cấp Đan ×3'); }
    else { player.mat += 8; out.push('✦ Huyền Thiết ×8'); }
  } else {
    const sil = 200 + player.level*15, tv = 60 + player.level*2;
    player.silver += sil; player.dantian.tuvi += tv;
    out.push(`${sil}◈ bạc + ${tv} Tu Vi`);
  }
  AudioSys.sfx(key === 'bikip' ? 'levelup' : 'coin', 0.8);
  saveGame();
  addFloat(player.x, player.y-56, '☯ Rút duyên: ' + (key === 'bikip' ? 'BÍ KÍP HIẾM!' : key === 'chau' ? 'Tứ Châu' : key === 'trangbi' ? 'Trang bị' : key === 'vatlieu' ? 'Vật liệu' : 'Bạc · Tu Vi'), key === 'bikip' ? '#e84a6a' : '#f0d68a', 14);
  renderVanDuyen();
  const res = document.getElementById('vd-result');
  if (res) res.innerHTML = `☯ Kết quả: ${out.join('<br>')}`;
};
