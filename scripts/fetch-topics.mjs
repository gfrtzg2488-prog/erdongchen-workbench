/* 每日抓取 B 站公开搜索 / 排行榜 → 写入 data/workbench.json 的选题库
   由 .github/workflows/topics.yml 定时调用，也可手动运行 node scripts/fetch-topics.mjs
   只抓公开接口，不登录、不绕过任何平台限制；小红书 / 抖音不做自动抓取。 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/workbench.json');
const MAX_TOPICS = Number(process.env.MAX_TOPICS || 5);
/* 素材抓取已停用，默认 0；如需恢复，把下面的 0 改回 3 */
const MAX_ASSETS = Number(process.env.MAX_ASSETS || 0);

const CN_OFFSET = 8 * 60; // 北京时间
const nowCN = new Date(Date.now() + (CN_OFFSET + new Date().getTimezoneOffset()) * 60000);
const ymd = d => d.toISOString().slice(0, 10);

/* 五个内容分类，每个分类每天出一条选题；关键词贴着账号定位 */
const CATEGORIES = [
  { name: '玄学分享',   keywords: ['塔罗', '星座运势', '玄学', '转运'] },
  { name: '日常分享',   keywords: ['日常vlog', '独居生活', '打工日常'] },
  { name: '穿搭',       keywords: ['通勤穿搭', '秋冬穿搭', '小个子穿搭'] },
  { name: '小确幸好物', keywords: ['好物分享', '提升幸福感的小物', '生活小物'] },
  { name: '小配饰',     keywords: ['配饰分享', '项链', '耳环', '手链'] }
];
const ASSET_KEYWORDS = ['vlog拍摄', '手机摄影技巧', '剪辑技巧', '好物拍摄'];

const log = (...a) => console.log('[topics]', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Referer': 'https://www.bilibili.com/',
  'Accept': 'application/json'
};

function getJSON(url){
  return fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) }).then(async res => {
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if(j.code !== 0) throw new Error('接口 code=' + j.code);
    return j.data;
  });
}

async function search(keyword){
  const u = 'https://api.bilibili.com/x/web-interface/search/type?search_type=video&page=1&keyword=' + encodeURIComponent(keyword);
  for(let attempt = 0; attempt < 3; attempt++){
    try{
      const d = await getJSON(u);
      return (d.result || []).filter(v => v && v.bvid).slice(0, 4);
    }catch(e){
      if(attempt < 2 && /412|429/.test(e.message)){ await sleep(4000 + attempt * 3000); continue; }
      throw e;
    }
  }
  return [];
}

/* 标题里带这些词的，多半是夸大、诱导或卖课，不进库 */
const SPAM = /月入|月赚|日入|躺赚|暴富|稳赚|无货源|0粉丝|零粉丝|一夜暴富|必看|速成|秘籍|带货|开店|主播|转行|求职|课程|训练营|全集|自学|面试|保姆级|副业|从零|全套|合集/;
/* 游戏 / 二次元内容与账号定位无关 */
const GAME = /原神|崩坏|抽卡|卡池|蛋仔|王者荣耀|星铁|和平精英|第五人格|明日方舟|英雄联盟|永劫|塞尔达|我的世界|游戏实况|攻略解说/;
/* 玄学类只收克制的分享，预测结果、承诺效果、卖符卖课的一律不收 */
const XUAN_CLAIM = /必中|准到|改命|消灾|化解|开光|招财|大师|算命|预言|灵验|必灵|转运符|许愿|因果|报应|命中注定/;

const clean = s => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2B00}-\u{2BFF}]/gu, '')
  .replace(/[|｜]{2,}/g, '｜').replace(/[!！‼]{2,}/g, '!')
  .replace(/\s+/g, ' ').trim();

const short = (s, n) => {
  const t = clean(s);
  return t.length > n ? t.slice(0, n).replace(/[|｜·,、\s]+$/, '') + '…' : t;
};

const wan = n => {
  const v = Number(n) || 0;
  return v >= 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, '') + '万' : String(v);
};

function newId(prefix){
  return prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4);
}

/* 只描述可借鉴的结构，不编造内容与数据 */
function angle(item){
  const k = item.keyword || '';
  const cat = item.category || '';
  if(/拍摄|摄影/.test(k)) return '借它的机位与光线处理，用于你的日常/物品类图文的前期拍摄';
  if(/剪辑|后期/.test(k)) return '借它的节奏与转场思路，用于 45–90 秒的日常视频';
  if(cat === '穿搭') return '借它的「场景 → 三套方案 → 价格区间」结构，换成你的衣柜和身材条件';
  if(cat === '小配饰') return '借它的「单品特写 + 搭配对比」拍法，做一组 5–7 张的细节图';
  if(cat === '小确幸好物') return '借它的「痛点 → 使用场景 → 值不值」写法，价格和体验都要写自己的真实感受';
  if(cat === '玄学分享') return '只从民俗/心理视角聊由来和不同说法，标注「仅供娱乐」，不预测具体结果、不承诺效果，也不做健康、财运、感情方面的指导';
  if(cat === '日常分享' || /日常|vlog|独居|打工/.test(k)) return '借它的「时间线 + 一个反转」叙事，换成你的真实日常片段';
  return '看它的前 3 秒钩子和评论区高频疑问，改成你的标题与互动话题';
}

async function collect(keywords, category){
  const out = [];
  for(const kw of keywords){
    try{
      const list = await search(kw);
      list.forEach(v => out.push({ ...v, keyword: kw, category: category || '' }));
      log('关键词「' + kw + '」命中', list.length, '条');
    }catch(e){
      log('关键词「' + kw + '」失败：' + e.message);
    }
    await sleep(1600);
  }
  return out;
}

async function main(){
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  data.tables = data.tables || {};
  const ideas = data.tables.ideas = Array.isArray(data.tables.ideas) ? data.tables.ideas : [];

  const today = ymd(nowCN);
  const seenUrl = new Set(ideas.map(r => (r.url || '').trim()).filter(Boolean));
  const seenTitle = new Set(ideas.map(r => (r.title || '').trim()));

  const pools = [];
  for(const c of CATEGORIES){
    pools.push({ cat: c.name, list: await collect(c.keywords, c.name) });
  }
  const assetPool = MAX_ASSETS > 0 ? await collect(ASSET_KEYWORDS, '') : [];
  if(!pools.some(p => p.list.length) && !assetPool.length){
    throw new Error('B 站接口没有返回可用结果');
  }

  const sortByPlay = (a, b) => (Number(b.play) || 0) - (Number(a.play) || 0);
  /* 素材按关键词轮流取，避免全来自同一个词 */
  const interleave = pool => {
    const groups = new Map();
    pool.forEach(v => {
      if(!groups.has(v.keyword)) groups.set(v.keyword, []);
      groups.get(v.keyword).push(v);
    });
    const gs = Array.from(groups.values());
    gs.forEach(g => g.sort(sortByPlay));
    const out = [];
    for(let i = 0; gs.some(g => g[i]); i++){
      gs.forEach(g => { if(g[i]) out.push(g[i]); });
    }
    return out;
  };
  pools.forEach(p => p.list.sort(sortByPlay));
  const assetList = interleave(assetPool);

  const push = (it, kind, idx, cat) => {
    const url = 'https://www.bilibili.com/video/' + it.bvid;
    const title = short(it.title, 40);
    if(!title || SPAM.test(title) || GAME.test(title)) return false;
    if(cat === '玄学分享' && XUAN_CLAIM.test(title)) return false;
    const isAsset = kind === '素材';
    const finalTitle = isAsset ? ('素材·' + it.keyword + '：' + title).slice(0, 50) : title;
    if(seenTitle.has(finalTitle)) return false;
    const play = Number(it.play) || 0;
    const base = {
      id: newId(isAsset ? 'im' : 'ia'),
      kind,
      title: finalTitle,
      platform: 'B站',
      tags: [cat, it.keyword, '自动抓取'].filter(Boolean).join(','),
      heat: play >= 1000000 ? 5 : play >= 300000 ? 4 : idx === 0 ? 4 : 3,
      status: '待选',
      url,
      source: 'bilibili-auto',
      source_date: today,
      created_at: today,
      note: (cat ? '分类「' + cat + '」· ' : '') + '关键词「' + it.keyword + '」· 播放 ' + wan(play) +
            ' · UP 主 ' + clean(it.author || '-') + ' · 搜于 B 站。取材方向：' + angle(it) +
            (isAsset ? '。原片版权归 UP 主所有，使用画面前请先确认授权' : '')
    };
    if(cat) base.category = cat;
    /* 同一条视频已在库里：只刷新说明与热度，不重复入库，也不覆盖你的状态 */
    const prev = ideas.find(r => r.source === 'bilibili-auto' && r.kind === kind && r.title === finalTitle);
    if(prev){
      Object.assign(prev, { note: base.note, heat: base.heat, tags: base.tags, url });
      if(cat) prev.category = cat;
      seenTitle.add(finalTitle);
      seenUrl.add(url);
      return false;
    }
    ideas.unshift(base);
    seenUrl.add(url);
    seenTitle.add(finalTitle);
    return true;
  };

  let topics = 0, assets = 0;
  /* 每个分类出一条，凑不够再看下一个分类 */
  for(const p of pools){
    for(const it of p.list){
      if(topics >= MAX_TOPICS) break;
      if(push(it, '选题', topics, p.cat)){ topics++; break; }
    }
  }
  for(let i = 0; i < assetList.length && assets < MAX_ASSETS; i++){
    if(push(assetList[i], '素材', assets, '')) assets++;
  }

  // 自动条目只留最近 3 天，避免选题库无限增长；手动条目一条不动
  const days = Number(process.env.PRUNE_DAYS || 3);
  const cutoff = new Date(nowCN.getTime() - days * 86400000).toISOString().slice(0, 10);
  const before = data.tables.ideas.length;
  data.tables.ideas = data.tables.ideas.filter(r => !(r.source === 'bilibili-auto' && r.source_date && r.source_date < cutoff));
  // 再按条数封顶，自动条目最多 24 条（最新在前），手动条目全留
  const keepAuto = Number(process.env.KEEP_AUTO || 24);
  let autoKept = 0;
  data.tables.ideas = data.tables.ideas.filter(r => r.source === 'bilibili-auto' ? (autoKept++ < keepAuto) : true);

  const added = topics + assets;
  log('新增', topics, '条选题 /', assets, '条素材，库内', before, '→', data.tables.ideas.length, '条');
  if(!added){
    log('没有新内容，未改动文件');
    return;
  }
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  log('已写入', FILE);
}

main().catch(e => { console.error('[topics] 失败：', e.message); process.exit(1); });
