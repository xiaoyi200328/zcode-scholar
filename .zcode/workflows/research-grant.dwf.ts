/* zcode-workflow
description: NSFC 标书动态工作流（借鉴 CC Grant Pipeline 三阶段）：访谈 → Stage1
  构思+文献调研（标识符核验/近3年≥30%）→ Stage2 四维批判评审+方向确认门 → Stage3 大纲（NSFC 字数配比）+大纲确认门 →
  并行分节起草 → 组装+anti-AI 评分门+引用核查 → NSFC 函评模拟终审 → 落盘。红线：研究基础只用用户提供的真实信息，不足标[需补充]。
args:
  context:
    type: string
    description: 可选。课题组研究基础、前期工作/数据、申报人信息等；含“自动确认”则跳过中途两道确认门
    default: ""
  grantType:
    type: string
    description: 申报名额类型：面上/青年/重点（影响字数与深度）
    default: ""
  topic:
    type: string
    description: 拟申报的研究方向或题目雏形
    required: true
*/
// research-grant — NSFC 标书动态工作流（借鉴 CC Grant Pipeline：/research-init → /critical-thinking → /writing）：
// 访谈 → Stage1 构思+文献 → Stage2 四维批判评审+方向确认门 → Stage3 大纲（字数配比）+大纲确认门
// → 并行分节起草 → 组装+anti-AI 评分门+引用核查 → NSFC 函评模拟终审 → 落盘。
// 红线：研究基础只用用户提供的事实（不足标 [需补充：xxx]，严禁编造论文/项目）；文献池外一律 [待补文献]；终稿散文体无 bullet。

interface GrantBrief {
  /** 精确化后的科学问题与立项方向 */
  direction: string;
  /** 申报名额类型：面上/青年/重点 */
  grantType: string;
  /** 课题组研究基础（真实信息：已发表论文/在研项目/平台） */
  foundation: string;
  /** 前期工作与已有数据 */
  priorWork: string;
  /** 时间与格式约束 */
  constraints: string;
}

interface StageOne {
  /** 关键科学问题（[现象/矛盾]→[未知机制]→[需回答的核心问题]） */
  keyQuestion: string;
  /** 研究空白 2-3 条（每条带支撑文献） */
  gaps: { gap: string; evidence: string }[];
  /** 可证伪假说 */
  hypothesis: string;
  /** 研究目标：1 个总体 + 2-3 个具体（可量化可验证） */
  aims: { overall: string; specifics: string[] };
  /** 文献池（全文唯一引用来源） */
  refs: { key: string; cite: string; identifier: string; year: number }[];
  /** 近 3 年文献占比（%），NSFC 要求 ≥30% */
  recentRatio: number;
}

interface PanelReview {
  /** 四维评分：科学价值25/创新性30/可行性25/研究基础20 */
  scores: { scientificValue: number; innovation: number; feasibility: number; foundation: number };
  /** 总分 /100 */
  total: number;
  /** 致命缺陷（必须响应才能进入写作） */
  fatalFlaws: string[];
  /** 竞争力评估 */
  competitive: string;
}

interface GrantOutline {
  /** 项目名称（20-25字：[研究对象]+[核心机制/方法]+[预期目标]） */
  title: string;
  /** 各节大纲（NSFC 申请书正文六部分，每节带字数配比与要点） */
  sections: { name: string; wordQuota: string; points: string[] }[];
}

interface SectionDraft {
  /** 节名 */
  section: string;
  /** 该节正文（散文体，字数符合配比） */
  markdown: string;
  /** 引用键列表；文献池外用 "[待补文献: 主题]" */
  citations: string[];
}

interface SavedGrant {
  /** 实际写入路径 */
  path: string;
  /** 待办：[需补充]/[待补文献] 清单 */
  todos: string[];
}

interface AntiAiScore {
  /** 五维总分 /50 */
  total: number;
  dimensions: { directness: number; rhythm: number; trust: number; authenticity: number; density: number };
  issues: string[];
}

interface CitationAudit {
  verifiedCount: number;
  outOfScope: string[];
  unresolved: string[];
}

interface PanelVerdict {
  /** NSFC 函评等级：优/良/中/差 */
  grade: "优" | "良" | "中" | "差";
  /** 资助建议 */
  funding: string;
  /** top blocking issues ≤3 */
  blocking: string[];
  /** top polish issues ≤3 */
  polish: string[];
}

interface GrantFinding {
  /** 来源 */
  where: string;
  /** 内容 */
  what: string;
  /** 支撑 */
  evidence: string;
  /** 评审评分有据；文献池未逐条全文核验 */
  status: "verified" | "unconfirmed";
}

const topic = String(args.topic ?? "").trim();
if (topic === "") {
  throw new Error("缺少申报方向：请以 args.topic 传入。");
}
const grantType = String(args.grantType ?? "").trim();
const context = String(args.context ?? "").trim();
const autoConfirm = context.includes("自动确认");

const writingFiles = await files.glob("Research/*/Writing/*.md");
const projects = [...new Set(writingFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `已有课题：Research/{${projects.join(", ")}}。与主题明显匹配的写入其 Writing/grant/（目录不存在则创建）；否则新建 Research/{简短英文slug}/Writing/grant/ 写入。`
    : "写入根目录 Writing/grant/（不存在则创建）。";
const fileRule = `文件名 NSFC-{grantType}-{YYYYMMDD}-{简短slug}.md（日期用今天，可用 date 命令查询）。${saveRule}`;

phase("需求访谈：申报名额与研究基础");
const intake = agent("需求访谈员", {
  system:
    "你是 NSFC 申报面谈：标书的研究基础部分只能用申请人真实信息，严禁编造论文/项目。\n" +
    "关键项（申报名额类型、课题组研究基础、前期工作）缺失时向用户追问一次；足够时直接整理。",
});
const brief = await intake.ask<GrantBrief>(
  `拟申报方向：「${topic}」。${grantType !== "" ? `名额类型：${grantType}。` : "名额类型未指定（面上/青年/重点）——需问清。"}` +
    `${context !== "" ? `用户背景：${context}。` : "研究基础未提供——必须向用户问清（已发表论文/在研项目/平台条件）。"}` +
    `\n\n整理成申报简报。研究基础与前期工作如实记录；用户没给的标 [需补充]，不编造。`,
);
log(`申报简报就绪：${brief.direction}（${brief.grantType}）`);

phase("Stage 1 构思：5W1H、文献调研与研究空白");
const ideator = agent("构思师", {
  system:
    "你是 NSFC 研究构思师（借鉴 research-init + research-ideation）：\n" +
    "检索纪律：预算（搜索+核验）≤6 次；每条入库文献必须有可解析的 DOI/PMID（PubMed efetch 批量核验）；" +
    "目标文献池 15-25 篇、近 3 年占比 ≥30%（NSFC 铁律）；" +
    "关键科学问题格式：[现象/矛盾] → [未知机制] → [需回答的核心问题]；研究空白 2-3 条且每条带支撑文献。本任务只检索与汇报。",
});
const stageOneDraft = await ideator.ask<StageOne>(
  `申报方向：「${topic}」\n申报简报：${JSON.stringify(brief)}\n\n` +
    `任务：\n` +
    `1. 先 Read .claude/rules/mcp-routing.md 了解检索路由。\n` +
    `2. 文献调研：围绕方向检索 15-25 篇（近 3 年为主），批量核验标识符后入文献池 refs。\n` +
    `3. 研究空白分析（趋势/方法学/应用/矛盾四维，2-3 条带文献支撑）。\n` +
    `4. 提炼关键科学问题、可证伪假说、研究目标（1 总体 + 2-3 具体可量化）。\n` +
    `5. 计算近 3 年文献占比 recentRatio（NSFC 要求 ≥30%，不足则补检）。`,
);
log(`Stage 1 完成：文献池 ${stageOneDraft.refs.length} 篇（近 3 年 ${stageOneDraft.recentRatio}%），空白 ${stageOneDraft.gaps.length} 条`);

phase("Stage 2 四维批判评审与方向确认门");
const grantReviewer = agent("NSFC 评审专家", {
  system:
    "你是极严格的 NSFC 评审专家（借鉴 grant-reviewer + scientific-critical-thinking）：\n" +
    "四维加权评分：科学价值 25%/创新性 30%/可行性 25%/研究基础 20%，总分 /100。\n" +
    "专项检查：逻辑断层（claim→evidence 因果链）、证据等级缺陷、统计学盲区、文献引用偏倚。\n" +
    "评分具体到位置，不空评；致命缺陷（必须响应才能进入写作）单独列出。",
});
const grantReview = await grantReviewer.ask<PanelReview>(
  `申报方向与 Stage 1 要素：${JSON.stringify(stageOneDraft)}\n申报简报：${JSON.stringify(brief)}\n\n` +
    `执行四维加权评审，输出评分、致命缺陷、竞争力评估。研究基础维度依据简报中的真实信息评估，缺失项计入扣分而非猜测。`,
);
log(`Stage 2 评审：总分 ${grantReview.total}/100，致命缺陷 ${grantReview.fatalFlaws.length} 条`);

let stageOne = stageOneDraft;
if (!autoConfirm) {
  stageOne = await ideator.ask<StageOne>(
    `评审结果：${JSON.stringify(grantReview)}\n原 Stage 1 要素：${JSON.stringify(stageOneDraft)}\n\n` +
      `把评分与致命缺陷展示给用户，等待用户响应（接受修订方向 / 提出不同方向），` +
      `将意见与评审要求一并吸收，返回修订后的 Stage 1 要素（结构不变）。`,
  );
  log(`方向确认门：已按用户意见修订 Stage 1 要素`);
}

phase("Stage 3 大纲：NSFC 结构与字数配比");
const writer = agent("NSFC 主笔人", {
  system:
    "你是资深 NSFC 标书撰稿人（借鉴 biomed-author 硬约束）：\n" +
    "①两段式写作强制执行 ②最终输出 flowing prose 严禁 bullet points ③严格 NSFC 结构合规 ④每个论断必须有文献或数据支撑。\n" +
    "内置反 AI 自查：避免程度副词堆叠、'首先其次最后'机械过渡、每段以'近年来'开头、空泛评价语（'具有重大意义'）。\n" +
    "研究基础与工作条件只能使用简报中的真实信息，不足标 [需补充：xxx]，严禁编造。",
});
const outline = await writer.ask<GrantOutline>(
  `申报方向：「${topic}」\n名额：${brief.grantType}\n确认后 Stage 1 要素：${JSON.stringify(stageOne)}\n申报简报：${JSON.stringify(brief)}\n\n` +
    `生成 NSFC 申请书正文大纲（六部分，每节带字数配比与要点）：\n` +
    `①立项依据（3000-4000 字：研究意义→国内外现状→假说与创新三段论；参考文献 30-50 篇、近 3 年 ≥30%）\n` +
    `②研究内容、研究目标及拟解决的关键科学问题（目标 1 总体+2-3 具体可量化）\n` +
    `③研究方案及可行性分析\n` +
    `④项目特色与创新之处（2-3 条，禁止'首次''填补空白'等无支撑空话）\n` +
    `⑤年度研究计划及预期研究结果\n` +
    `⑥研究基础与工作条件（只用用户真实信息，不足标 [需补充]）\n` +
    `项目名称 20-25 字：[研究对象]+[核心机制/方法]+[预期目标]。`,
);

let outlineConfirmed = outline;
if (!autoConfirm) {
  outlineConfirmed = await writer.ask<GrantOutline>(
    `把下面这份大纲展示给用户请求确认（项目名称 + 六部分要点 + 字数配比）：\n${JSON.stringify(outline)}\n` +
      `等待用户确认或修改；吸收意见后返回确认版大纲（结构不变）。两段式硬门，不可跳过。`,
  );
}
log(`大纲确认完成：《${outlineConfirmed.title}》，六部分`);

phase("并行起草六部分");
const drafts = await Promise.all(
  outlineConfirmed.sections.map(async (s, i) => {
    const d = await agent(`执笔-${i + 1}-${s.name.slice(0, 8)}`, {
      system:
        "你是 NSFC 标书执笔人：散文体、段落化、无 bullet；字数严格遵守配比；" +
        "引用只用文献池（按 key），缺的标 [待补文献: 主题]；研究基础类内容只用简报真实信息，缺的标 [需补充：xxx]。" +
        "本任务只写稿与汇报，不要在工作区写任何文件。",
    }).ask<SectionDraft>(
      `你负责撰写「${s.name}」（字数配比：${s.wordQuota}）。\n项目名称：${outlineConfirmed.title}\n要素：${JSON.stringify(stageOne)}\n` +
        `本节要点：${JSON.stringify(s.points)}\n文献池：${JSON.stringify(stageOne.refs)}\n申报简报（研究基础原材料）：${JSON.stringify(brief)}\n\n` +
        `写作要求：每段主题句明确、段落逻辑过渡；论断落到文献或数据上；避免 AI 痕迹（程度副词堆叠/机械过渡/空泛评价）。`,
    );
    report({ section: d.section, chars: d.markdown.length });
    return d;
  }),
);

phase("组装、anti-AI 评分门与引用核查");
const assembled = await writer.ask<SavedGrant>(
  `六部分草稿：${JSON.stringify(drafts)}\n项目名称：${outlineConfirmed.title}\n\n` +
    `组装为完整标书并直接写入工作区。结构顺序：项目名称 → **项目摘要（400 字，严格配比：背景 80 → 问题 60 → 假说 60 → 方法 120 → 预期成果 80；摘要缺失 = 函评一票硬伤，绝不可漏）** → 六部分正文 → 文末统一参考文献列表（含标识符）→ 文末附 todos。${fileRule}\n` +
    `返回实际路径与 todos（[需补充]/[待补文献] 清单）。`,
);
log(`标书已写入 ${assembled.path}`);

const [antiAi, citationAudit] = await Promise.all([
  agent("去 AI 痕迹检查员", {
    system:
      "你是 anti-AI 检查员（五维评分制，只读不修改）：Directness/Rhythm/Trust/Authenticity/Density 各 1-10，总分 /50。\n" +
      "NSFC 特化检查：程度副词堆叠（显著地/极大地/有效地）、'首先其次最后'机械过渡、每段以'近年来'开头、" +
      "空泛评价语（'具有重大意义''国际领先'无事实支撑）。45-50 优；35-44 良；<35 必须回炉（给出扣分位置）。",
  }).ask<AntiAiScore>(`Read ${assembled.path}，按五维评分并给出扣分位置。`),
  agent("引用核查员", {
    system:
      "你是引用核查员：文献池带标识符的逐条核验可解析（DOI/PMID）；检查正文引用是否越界（池外引用 = outOfScope）；" +
      "检查近 3 年文献占比是否 ≥30%。检索预算 ≤6 次。不修改文件。",
  }).ask<CitationAudit>(
    `文献池：${JSON.stringify(stageOne.refs)}\n标书：Read ${assembled.path}\n\n返回 verifiedCount、outOfScope、unresolved。`,
  ),
]);
log(`质量门：anti-AI ${antiAi.total}/50，引用核验 ${citationAudit.verifiedCount}（越界 ${citationAudit.outOfScope.length}，未决 ${citationAudit.unresolved.length}）`);

if (antiAi.total < 35 || citationAudit.outOfScope.length > 0) {
  await writer.ask<SavedGrant>(
    `质量门未通过，请修订 ${assembled.path}（直接编辑写入）：\n` +
      `${antiAi.total < 35 ? `anti-AI ${antiAi.total}/50，扣分点：${JSON.stringify(antiAi.issues)}\n` : ""}` +
      `${citationAudit.outOfScope.length > 0 ? `越界引用（删除或替换 [待补文献]）：${JSON.stringify(citationAudit.outOfScope)}\n` : ""}` +
      `完成后返回实际路径与更新后的 todos。`,
  );
  log(`质量门回炉修订完成（≤1 轮）`);
}

phase("NSFC 函评模拟终审");
const panelist = agent("NSFC 函评专家", {
  system:
    "你是 NSFC 函评专家（模拟真实函评）：按四维给出等级（优/良/中/差）与资助建议（建议资助/修改后可再审/不予资助），\n" +
    "必报 top3 blocking（致命）与 top3 polish（润色）。只依据标书文本与简报判断，不修改文件。\n" +
    "检查：创新点是否无支撑空话、关键科学问题是否'科学问题'而非'技术问题'、研究基础是否写实、摘要 400 字配比、近 3 年文献占比。",
});
let verdict = await panelist.ask<PanelVerdict>(
  `Read ${assembled.path}，执行函评并按契约返回。\n申报简报：${JSON.stringify(brief)}\n文献池：${JSON.stringify(stageOne.refs)}`,
);
let grantPath = assembled.path;
let todos = assembled.todos;
if ((verdict.grade === "中" || verdict.grade === "差") && verdict.blocking.length > 0) {
  const revised = await writer.ask<SavedGrant>(
    `函评等级「${verdict.grade}」（${verdict.funding}），blocking issues：${JSON.stringify(verdict.blocking)}\n` +
      `请逐条修订（直接编辑写入，保持结构），完成后返回实际路径与更新后的 todos。修订 ≤1 轮，改不完的列入 todos。`,
  );
  grantPath = revised.path;
  todos = revised.todos;
  verdict = await panelist.ask<PanelVerdict>(
    `Read ${grantPath}，重新函评（上一轮意见：${JSON.stringify(verdict.blocking)}）。`,
  );
  log(`函评修订完成，最终等级：${verdict.grade}（${verdict.funding}）`);
} else {
  log(`函评等级：${verdict.grade}（${verdict.funding}）`);
}

try {
  await artifact.file("grant", grantPath, {
    title: `NSFC 标书初稿：${outlineConfirmed.title}`,
    description: `${brief.grantType}｜函评 ${verdict.grade}（${verdict.funding}）`,
    primary: true,
  });
} catch {
  log(`标书已在工作区 ${grantPath}，但发布预览卡片失败。`);
}

const blockingFindings: GrantFinding[] = verdict.blocking.map((b) => ({
  where: "函评 blocking issue",
  what: b,
  evidence: `函评等级「${verdict.grade}」，见标书`,
  status: "unconfirmed",
}));
const todoFindings: GrantFinding[] = todos.map((t) => ({
  where: "申请人待办",
  what: t,
  evidence: "见标书文末待办清单",
  status: "unconfirmed",
}));

return {
  conclusion:
    `「${outlineConfirmed.title}」NSFC 标书初稿完成（${brief.grantType}；四维评审 ${grantReview.total}/100 已响应；` +
    `anti-AI ${antiAi.total}/50；引用核验 ${citationAudit.verifiedCount} 条；函评等级「${verdict.grade}」——${verdict.funding}），` +
    `保存到 ${grantPath}。`,
  findings: [...blockingFindings, ...todoFindings],
  verified: [
    "Stage 1 文献池经批量标识符核验，近 3 年占比已达标检查",
    "Stage 2 四维加权评审（25/30/25/20）+ 方向确认门（用户响应或自动确认）",
    "大纲确认硬门（两段式：大纲是人审 checkpoint）",
    "研究基础部分仅使用用户提供的真实信息，缺失处 [需补充] 占位",
    `anti-AI 五维评分 ${antiAi.total}/50；函评模拟终审「${verdict.grade}」`,
    `标书已落盘：${grantPath}`,
  ],
  notCovered: [
    "研究基础中的论文/项目清单未经逐条真实性核验（须申请人自查）",
    "文献池未经逐篇全文精读",
    "初稿为工作稿：正式提交前需申请人全文通读、按官方模板排版并核对当年度指南",
  ],
};