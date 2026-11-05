/* 每日抓取 B 站公开搜索 / 排行榜 → 写入 data/workbench.json 的选题库
   由 .github/workflows/topics.yml 定时调用，也可手动运行 node scripts/fetch-topics.mjs
   只抓公开接口，不登录、不绕过任何平台限制；小红书 / 抖音不做自动抓取。 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('data/workbench.json');
const MAX_TOPICS = Number(process.env.MAX_TOPICS || 5);
const MAX_ASSETS = Number(process.env.MAX_ASSETS || 3);

const CN_OFFSET = 8 * 60; // 北京时间
const nowCN = new Date(Date.now() + (CN_OFFSET + new Date().getTimezoneOffset()) * 60000);
const ymd = d => d.toISOString().slice(0, 10);

/* 关键词贴着账号定位：「日常分享 + 账号搭建 + 高频互动」 */
const TOPIC_KEYWORDS = ['独居生活', '一人食', '通勤日常', '打工人的一天', '出租屋改造', '断舍离', '存钱日常', '周末安排', '小红书起号', '个人IP定位'];
const ASSET_KEYWORDS = ['vlog拍摄', '手机摄影技巧', '剪辑技巧', '生活感拍照'];

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
  for(let attempt = 0; attempt < 2; attempt++){
    try{
      const d = await getJSON(u);
      return (d.result || []).filter(v => v && v.bvid).slice(0, 4);
    }catch(e){
      if(attempt === 0 && /412|429/.test(e.message)){ await sleep(2500); continue; }
      throw e;
    }
  }
  return [];
}

/* 标题里带这些词的，多半是夸大、诱导或卖课，不进库 */
const SPAM = /月入|月赚|日入|躺赚|暴富|稳赚|无货源|0粉丝|零粉丝|一夜暴富|必看|速成|秘籍|带货|开店|主播|转行|求职|课程|训练营|全集|自学|面试/;

const clean = s => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

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
  if(/运营|定位|选题|涨粉|账号/.test(k)) return '借它的「问题 → 拆解 → 可执行步骤」结构，换成你自己账号的真实过程与数据';
  if(/拍摄|摄影/.test(k)) return '借它的机位与光线处理，用于你的日常/物品类图文的前期拍摄';
  if(/剪辑|后期/.test(k)) return '借它的节奏与转场思路，用于 45–90 秒的日常视频';
  return '看它的前 3 秒钩子和评论区高频疑问，改成你的标题与互动话题';
}

async function collect(keywords){
  const out = [];
  for(const kw of keywords){
    try{
      const list = await search(kw);
      list.forEach(v => out.push({ ...v, keyword: kw }));
      log('关键词「' + kw + '」命中', list.length, '条');
    }catch(e){
      log('关键词「' + kw + '」失败：' + e.message);
    }
    await sleep(900);
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

  const topicPool = await collect(TOPIC_KEYWORDS);
  const assetPool = await collect(ASSET_KEYWORDS);
  if(!topicPool.length && !assetPool.length){
    throw new Error('B 站接口没有返回可用结果');
  }

  const sortByPlay = (a, b) => (Number(b.play) || 0) - (Number(a.play) || 0);
  /* 每个关键词轮流取，避免一整批选题都来自同一个词 */
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
  const topicList = interleave(topicPool);
  const assetList = interleave(assetPool);

  const push = (it, kind, idx) => {
    const url = 'https://www.bilibili.com/video/' + it.bvid;
    const title = clean(it.title).slice(0, 46);
    if(!title || SPAM.test(title) || seenUrl.has(url) || seenTitle.has(title)) return false;
    const base = {
      id: newId(kind === '选题' ? 'ia' : 'im'),
      platform: 'B站',
      tags: [it.keyword, '自动抓取'].join(','),
      heat: idx === 0 ? 5 : idx < 3 ? 4 : 3,
      status: '待选',
      url,
      source: 'bilibili-auto',
      source_date: today,
      created_at: today,
      note: '关键词「' + it.keyword + '」· 播放 ' + wan(it.play) + ' · UP 主 ' + clean(it.author || '-') +
            ' · 搜于 B 站。取材方向：' + angle(it)
    };
    if(kind === '素材'){
      ideas.unshift({ ...base, kind, title: ('素材·' + it.keyword + '：' + title).slice(0, 50),
        note: base.note + '。原片版权归 UP 主所有，使用画面前请先确认授权' });
    }else{
      ideas.unshift({ ...base, kind, title });
    }
    seenUrl.add(url);
    seenTitle.add(title);
    return true;
  };

  let topics = 0, assets = 0;
  for(let i = 0; i < topicList.length && topics < MAX_TOPICS; i++){
    if(push(topicList[i], '选题', topics)) topics++;
  }
  for(let i = 0; i < assetList.length && assets < MAX_ASSETS; i++){
    if(push(assetList[i], '素材', assets)) assets++;
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
