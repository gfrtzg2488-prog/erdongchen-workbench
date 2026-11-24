# 创业学习工作台（learn.html）实施计划

## 一、Summary

在 `/workspace` 新增一个独立单文件应用 **`learn.html`**，品牌暂定「筑基 · 创业学习工作台」（ZHUJI · FOUNDER LAB）。覆盖创业所需条件与公司知识的学习闭环：

**课程学习 → 实操 → 结果 → 复盘 → 归档**

- 复用现有工作台的纸感设计系统与纯前端单文件架构（无构建、无 CDN、file:// 可开）。
- 预置 8 大模块 × 3 个学习单元的课程框架，并附少量「示例」记录演示完整流程。
- 数据仅存本机 localStorage，支持 JSON 导入/导出。
- 归档输出 4 种：Markdown 归档文件、可打印 HTML 报告、JSON 全量备份、Excel（多工作表）。
- 不改动现有 `index.html`、`tech.html`、`wangchunqiu.html`、`sw.js`、`manifest.webmanifest`。

## 二、Current State Analysis（已核实）

| 事项 | 现状 | 对本计划的影响 |
| --- | --- | --- |
| 应用形态 | [index.html](file:///workspace/index.html) 为 3337 行单文件应用，内联 CSS/JS | 新页面沿用同形态，零构建 |
| 设计系统 | `:root` 纸感色板（`--paper #F3EFE6`、`--ink #17181B`、`--accent #B04A2B`、serif 标题、mono 数字、3px 圆角） | 直接复用同一色板与组件风格，形成产品家族感 |
| 布局 | 左侧固定 rail + sticky topbar + 多 `section.view`；≤820px 变底部导航 | 新页面复用同一响应式策略 |
| 数据层 | [index.html](file:///workspace/index.html#L890-L1078) `Store` + `TABLES` + localStorage + 可选 GitHub 私有仓库 | 新页面只做 localStorage，减少配置与泄密面 |
| 表单/弹层 | [index.html](file:///workspace/index.html#L1361-L1452) `openModal` / `openForm` / `fieldHTML` | 复用该模式，统一录入交互 |
| 导出 | [index.html](file:///workspace/index.html#L1189-L1251) JSON 备份、XML Spreadsheet 2003 多表 `.xls` | 复用导出思路，新增 Markdown 与打印报告 |
| PWA | `sw.js` 仅缓存 index 外壳，`manifest` 指向枕冬 | 新页面不注册 SW，避免与现有 PWA 作用域冲突 |
| 无常量 | 现有应用无打印样式、无 Markdown 导出 | 本次为报告内联打印 CSS，并新写 Markdown 生成器 |

## 三、Preset 课程框架（内置内容）

品牌：**筑基**；副标 `ZHUJI · FOUNDER LAB`。8 个模块，每模块 3 个单元，共 24 单元：

| 模块 | 单元（示例化标题） |
| --- | --- |
| 01 创业条件评估 | 动机与资源盘点 / 时间与现金流底线 / 风险承受力与家庭共识 |
| 02 商业与市场 | 需求验证访谈 / 目标客户与竞品 / 商业模式画布与定价 |
| 03 公司设立与合规 | 主体形式选择 / 注册与银行开户流程 / 经营范围与许可资质 |
| 04 财税与资金 | 记账报税基础 / 发票与社保公积金 / 现金流预算与融资准备 |
| 05 产品与交付 | MVP 定义 / 交付流程与质量标准 / 供应商与供应链 |
| 06 团队与股权 | 岗位与招聘 / 薪酬与激励 / 股权期权与合伙协议 |
| 07 增长与运营 | 获客渠道盘点 / 内容与销售转化 / 客户留存与核心指标 |
| 08 法务与风控 | 合同要点 / 知识产权 / 数据合规与纠纷处理 |

每个单元字段：`title`、`goal`（一句话目标）、`points`（3 条要点，换行分隔）、`hours`（建议学时）、`status`（未开始/学习中/已学完）、`notes`。

示例记录（首次打开写入，均带 `sample:true`，界面显示「示例」小标）：
- 2 个单元为「已学完」、1 个「学习中」；
- 2 条实操（1 进行中、1 已完成）；
- 1 条结果（目标/实际/结论，示例数字仅用于演示，不涉及真实客户与经营数据）；
- 1 条复盘、1 条归档日志。

## 四、Proposed Changes

### 唯一新增文件：`/workspace/learn.html`

单文件结构（顺序）：

1. **Head**：`lang="zh-CN"`、viewport（含 `viewport-fit=cover`）、title「筑基 · 创业学习工作台」、theme-color `#17181B`、favicon 复用 `icon-192.png`。不引 manifest、不注册 SW。
2. **CSS**：从 index 提取色板与基础组件，新增学习专用样式。
   - 复用：`.rail/.nav/.topbar/.btn/.card/.stat/.badge/.chip/.toolbar/.kanban/.col/.icard/.form-grid/.f/dialog/.toast/.empty/.bar`。
   - 新增：`.stage-flow`（四段流程条）、`.unit-row`（单元行：状态点、标题、目标、学时、操作）、`.module-head`（模块进度条）、`.archive-grid`（四种归档卡片）、`.result-row`、`.review-card`、`.sample-tag`。
   - 响应式断点沿用 1180 / 1020 / 820 / 380px；≤820px rail 变底部横向导航，main 底部留安全区。
3. **HTML 骨架**：
   - `aside.rail`：品牌「筑基」、`#nav`、页脚（当前周期、`LOCAL · 本机存储`）。
   - `header.topbar`：eyebrow、`#viewTitle`、`#viewSub`、时钟、`数据`按钮、`#sync` 状态胶囊、`#newBtn` 主按钮（文案随视图变化）。
   - `#views` 下 6 个 `section.view[data-view]`：`overview`、`curriculum`、`practice`、`results`、`review`、`archive`。
   - `<dialog id="modal">`、`<div id="toast">`。
4. **JS**（`<script>` 内，按块组织）：
   - 常量：`LS_KEY='zj_learn_v1'`、`TABLES`、`NAV`、`STATUS` 枚举、`MODULES_SEED`、`UNITS_SEED`、`SAMPLE_DATA`。
   - 工具：`$`、`esc`、`ymd/todayStr/fmtCN/relDay`、`uid`、`sum`、`clip`、`icon`（在现有 ICON_PATHS 基础上补充 `book/target/play/flag/check/archive/download/printer/file/chevron`）。
   - 数据层：`emptyData / normalize / lsRead / lsWrite / createRow / updateRow / deleteRow`，写入节流 200ms；所有记录自动补 `created_at/updated_at`。
   - 渲染：`renderAll / renderNav / updateHeader / renderOverview / renderCurriculum / renderPractice / renderResults / renderReview / renderArchive`。
   - 表单：`openForm / fieldHTML`（复用 index 模式），各视图对应的新建/编辑函数。
   - 归档：`buildMarkdown(scope)`、`buildReportHTML(scope)`、`exportJSON()`、`importJSON(file)`、`exportExcel()`、`logArchive(scope, formats, counts)`。
   - 事件：`#nav` 切换、`[data-act]` 事件委托、筛选 chips、Enter 快捷录入、`hashchange` 保持视图、`storage` 跨标签同步。
   - 启动：`init()` 读取本地数据（空则写入种子 + 示例）、`renderAll()`、时钟、绑定事件。

### 数据模型（决定完整，执行不再选择）

```js
// modules: 内置模块（可改标题/摘要，不删除）
{ id, title, en, summary, order, builtin:true }

// units
{ id, module_id, title, goal, points, hours, status:'未开始|学习中|已学完',
  notes, order, sample?, created_at, updated_at }

// practices
{ id, module_id, unit_id, title, action, deliverable, due_date,
  status:'待开始|进行中|已完成|受阻', notes, sample?, created_at, updated_at }

// results
{ id, practice_id, title, metric, target, actual,
  verdict:'达标|部分达标|未达标', evidence, date, notes, sample?, created_at, updated_at }

// reviews
{ id, scope:'模块|实操|阶段', ref_id, ref_title, date,
  kept, improve, next, score:1-5, notes, sample?, created_at, updated_at }

// archives
{ id, date, title, scope, formats:['Markdown','报告','JSON','Excel'],
  counts:{units,practices,results,reviews}, created_at }
```

关联规则：
- 实操通过 `unit_id` 关联单元，`module_id` 冗余存储便于筛选；单元为空时允许只挂模块。
- 结果为「一条实操可多条结果」，按 `practice_id` 关联。
- 复盘用 `scope + ref_id + ref_title` 快照，关联对象被删也不影响历史复盘。
- 删除模块禁止；删除单元/实操/结果/复盘均弹原生 `confirm`，确认后删除并 toast 提示。

### 六个视图的具体内容

1. **总览 OVERVIEW**
   - Hero：`第 N 天 · 本周学习 X 小时` + 分隔线。
   - 4 个 stat：课程完成率（已学完/总单元）、实操完成数、达标结果数、复盘次数。
   - `stage-flow`：课程 → 实操 → 结果 → 复盘 四段，显示各段数量与转化提示（如「3 个单元已学完，尚无实操」）。
   - 「今日学习」列表：学习中单元 + 7 天内到期实操，可勾选完成。
   - 「模块进度」：8 行进度条（已学完单元/3），点击跳课程页并定位模块。
   - 「最近复盘」：3 条摘要，点击展开。
   - 顶部保留快速输入：回车记一条学习任务。
2. **课程 CURRICULUM**
   - 工具栏：状态筛选 chips（全部/未开始/学习中/已学完）、搜索框。
   - 按模块分组：模块头（编号、标题、进度条、单元数）+ 单元行。
   - 单元行操作：开始学习 / 标记学完 / 编辑 / 去实操 / 写复盘；要点默认折叠，点击展开。
   - 模块头右侧「+ 单元」。
3. **实操 PRACTICE**
   - 4 列看板：待开始 / 进行中 / 已完成 / 受阻；移动端单列堆叠。
   - 卡片：标题、关联单元、交付物摘要、截止日、状态；操作：编辑、记结果、删除。
   - 「记结果」打开结果表单，预填实操标题与关联 id。
4. **结果 RESULTS**
   - 筛选：全部 / 达标 / 部分达标 / 未达标。
   - 每行展示：结果标题、实操、指标、目标 vs 实际、结论 badge（达标=绿、部分=琥珀、未达标=赤陶）、证据链接、日期。
   - 行操作：编辑、去复盘。
5. **复盘 REVIEW**
   - 卡片列表：范围（模块/实操/阶段）、关联对象、日期、评分（1–5 点）、保留 / 改进 / 下一步 三段、备注。
   - 「新建复盘」可选范围并挑关联对象。
   - 顶部统计：本月复盘数、平均分。
6. **归档 ARCHIVE**
   - 范围选择：全部 / 指定模块。
   - 4 张导出卡：
     - **Markdown 归档**：生成单文件 `.md`（含概览统计、模块进度、单元、实操、结果、复盘；按模块分二级标题，Obsidian 可直接读）。
     - **可打印报告**：`window.open` 新窗口写入内联样式 HTML（封面、日期、范围、统计、各模块表格、复盘汇总），页内「打印 / 存为 PDF」按钮，含 `@media print`（A4、隐藏按钮、表格避免断行）。
     - **JSON 备份**：`{v, updated_at, tables}` 下载，`筑基-archive-YYYY-MM-DD.json`。
     - **Excel 表格**：XML Spreadsheet 2003，6 个工作表（模块/单元/实操/结果/复盘/归档），下载 `.xls`。
   - 每次导出成功后写入一条 `archives` 日志（日期、范围、格式、条数），下方表格展示，可删除日志。
   - 数据区：导入 JSON（整体覆盖，导入前提示先导出）、恢复内置课程框架（只补缺失模块/单元，不覆盖已有记录）、清空全部记录（需输入「清空」二次确认）。
   - 隐私提示条：数据只存本机浏览器；导出文件请注意脱敏，客户名/合同/金额用 `{占位符}`。
7. **交互与状态**
   - `ui = { view, moduleFilter, statusFilter, practiceFilter, resultFilter, archiveScope, search }`。
   - 视图通过 `location.hash` 记忆；刷新后回到上次视图。
   - 主按钮 `#newBtn` 随视图变化：总览=记学习任务、课程=新增单元、实操=新增实操、结果=记录结果、复盘=新建复盘、归档=生成归档（滚动到导出区）。
   - Toast 统一反馈；空状态给出下一步引导文案。

### 归档生成细节（避免执行时再决策）

- **Markdown**：文件名 `zhuji-archive-YYYY-MM-DD.md`；开头 `# 筑基 · 创业学习归档` + 元信息（日期、范围、统计）；`##` 为模块，`###` 为单元/实操/结果/复盘；所有字段用纯文本，不写入任何真实敏感信息；空数据输出「暂无记录」。
- **报告**：文件名固定「筑基 · 学习归档报告」，`<html lang="zh-CN">`，内联 CSS，不依赖外部资源；封面含品牌、日期、范围；统计用四宫格；模块用表格（单元/状态/学时），实操结果用两列表；复盘按时间倒序；页脚「本报告由本地数据生成，未上传」。
- **Excel**：列定义固定，复用 index 的 `xlCell` 思路并做 XML 转义；数字列输出 Number 类型。
- **JSON**：`docOf(data)` 结构；导入兼容 `{tables:{...}}` 与裸表对象；表缺失自动补空数组。
- **日志**：导出前即时记录，标注 `已生成`，不声称「已保存到云端」。

## 五、Assumptions & Decisions

1. 新建独立 `learn.html`，不替换、不修改现有三个工作台与 PWA 文件。
2. 仅本地存储（localStorage），不接入 GitHub 同步；换设备通过 JSON 导入/导出迁移。
3. 内容预置「8 模块 × 3 单元」框架 + 少量示例记录，所有示例带 `示例` 标记，可单独删除。
4. 归档的 Markdown 采用**单文件**方案（不引入 zip 库，保证离线与稳定）；按模块标题分节，便于后续拆分。
5. 数据模型 6 张表；删除操作必须二次确认，不提供批量删除与自动清理。
6. 不虚构真实经营数据；示例结果只使用「访谈 N 位 / 完成 N 项」这类过程指标。
7. 不改 `manifest.webmanifest` / `sw.js`；新页面不注册 Service Worker。
8. 视觉沿用纸感米白 + 墨色侧栏，强调色仍为赤陶 `#B04A2B`，学习完成态用鼠尾草绿 `#6E7A55`。

## 六、Verification

1. **静态检查**
   - 启动 `python3 -m http.server 8000`（cwd `/workspace`），访问 `http://localhost:8000/learn.html`。
   - 提取 `<script>` 内容做 `node --check`，确保无语法错误；浏览器控制台无报错。
2. **功能走查**
   - 首次打开：8 模块 24 单元、示例记录、四段流程数字正确；刷新后数据不丢。
   - 课程页：筛选、搜索、新增单元、开始学习、标记学完、写笔记；进度条与总览同步。
   - 实操页：新增实操、改状态、记结果；结果页出现对应记录。
   - 复盘页：新建复盘（模块/实操/阶段三种范围），评分与摘要展示正确。
   - 归档页：四种导出均可触发下载；Markdown 与报告内容包含当前范围数据；归档日志新增一条；导入 JSON 后数据恢复；清空需输入「清空」。
3. **兼容与响应式**
   - 1440px 桌面三栏/看板正常；820px 以下底部导航、单列布局、无横向溢出。
   - 键盘可达：Tab 焦点、Enter 提交、Esc 关闭弹窗。
4. **验收标准**
   - 无外部 CDN 请求；断网仍可用；刷新/重启浏览器数据保留；`index.html` 等既有文件 `git status` 无改动。
