/* zcode-workflow
description: 论文写作动态工作流 v2（借鉴 CC writing 三处铁律）：访谈 → 素材盘点+大纲 → 大纲用户确认硬门 → 并行分节起草 →
  组装落盘 → 质量门（anti-AI 五维评分<35回炉 + 引用核查）→ 审稿人三值 verdict 终审。引证只来自素材文献池。
args:
  journal:
    type: string
    description: 目标期刊与稿件类型；含“自动确认”则跳过大纲确认门
    default: ""
  materials:
    type: string
    description: 素材路径清单（分号/逗号分隔）；不填则访谈时向你收集
    required: true
  topic:
    type: string
    description: 论文主题或工作题目
    required: true
*/
// research-write v2 — 借鉴 CC writing/scientific-writing/biomed-author 三处铁律 + anti-ai 50 分制 + FINAL-VERDICT 三值桶：
// 访谈 → 素材盘点+大纲 → 大纲用户确认硬门（bullet 大纲只是人审 checkpoint）→ 并行分节起草
// → 组装落盘 → 质量门（anti-AI 五维评分 <35 回炉 + 引用核查并行）→ 审稿人终审（三值 verdict，非 ready 修订 ≤1 轮）。
// 铁律：引证只来自素材文献池；素材没有的一律 [待补文献: 主题]，严禁编造。

interface WriteBrief {
  /** 一句话核心结论（take-home message） */
  keyMessage: string;
  /** 目标期刊与稿件类型，未定则写"未定" */
  journal: string;
  /** 图表是否定稿、数据是否冻结 */
  readiness: string;
  /** 用户强调的要求与禁忌 */
  constraints: string;
  /** 素材路径清单 */
  materials: string[];
}

interface RefEntry {
  /** 引用键 */
  key: string;
  /** 完整引用信息 */
  cite: string;
  /** DOI/PMID，素材里没有则空字符串 */
  identifier: string;
}

interface Outline {
  /** 工作标题 */
  title: string;
  /** 各节大纲 */
  sections: { name: string; points: string[] }[];
  /** 文献池：全文唯一允许的引用来源 */
  refs: RefEntry[];
  /** 素材缺口 */
  gaps: string[];
}

interface SectionDraft {
  /** 节名 */
  section: string;
  /** 该节正文 markdown（散文体，不含一级标题） */
  markdown: string;
  /** 引用键列表；素材外用 "[待补文献: 主题]" */
  citations: string[];
}

interface SavedManuscript {
  /** 实际写入路径 */
  path: string;
  /** 给作者的待办 */
  todos: string[];
}

interface AntiAiScore {
  /** 五维总分（/50） */
  total: number;
  /** 各维得分：Directness/Rhythm/Trust/Authenticity/Density 各 /10 */
  dimensions: { directness: number; rhythm: number; trust: number; authenticity: number; density: number };
  /** 扣分点位置与原因 */
  issues: string[];
}

interface CitationAudit {
  /** 已核验标识符的文献数 */
  verifiedCount: number;
  /** 越界引用（文中出现但不在文献池） */
  outOfScope: string[];
  /** 标识符核验失败/无法核验的 */
  unresolved: string[];
}

interface FinalVerdict {
  /** 三值裁定 */
  verdict: "ready with minor edits" | "needs moderate revision" | "not ready for submission";
  /** top blocking issues（最多 3） */
  blocking: string[];
  /** top polish issues（最多 3） */
  polish: string[];
}

interface TodoFinding {
  /** 待办来源 */
  where: string;
  /** 待办内容 */
  what: string;
  /** 支撑：见稿件待办清单 */
  evidence: string;
  /** 待办是建议性质 */
  status: "verified" | "unconfirmed";
}

const topic = String(args.topic ?? "").trim();
if (topic === "") {
  throw new Error("缺少论文主题：请以 args.topic 传入。");
}
const argMaterials = String(args.materials ?? "")
  .split(/[;；,，]/)
  .map((s) => s.trim())
  .filter((s) => s !== "");
const journal = String(args.journal ?? "").trim();
const context = String(args.context ?? "").trim();
const autoConfirm = context.includes("自动确认");

const writingFiles = await files.glob("Research/*/Writing/*.md");
const projects = [...new Set(writingFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `已有课题：Research/{${projects.join(", ")}}。与主题明显匹配的写入其 Writing/manuscript/（目录不存在则创建）；否则新建 Research/{简短英文slug}/Writing/manuscript/ 写入。`
    : "写入根目录 Writing/manuscript/（不存在则创建）。";
const fileRule = `文件名 Manuscript-{YYYYMMDD}-{简短slug}.md（日期用今天，可用 date 命令查询）。${saveRule}`;

phase("需求访谈：定方向、期刊与素材");
const intake = agent("需求访谈员", {
  system:
    "你是论文写作导师的开题面谈：动笔前必须弄清核心结论、目标期刊、素材位置。" +
    "背景足够时直接整理；关键项（素材路径、核心结论）缺失时才向用户追问一次。",
});
const brief = await intake.ask<WriteBrief>(
  `用户要写论文：「${topic}」。${journal !== "" ? `目标期刊：${journal}。` : "目标期刊未指定。"}` +
    `${context !== "" ? `补充背景：${context}。` : ""}` +
    `${argMaterials.length > 0 ? `素材路径：${argMaterials.join(" ; ")}。` : "素材路径未提供——必须向用户问清。"}` +
    `\n\n整理成写作简报；缺关键项就向用户追问。`,
);
log(`写作简报就绪：${brief.keyMessage}`);

phase("素材盘点与 claim-evidence 大纲");
const librarian = agent("资料管理员", {
  system:
    "你是严谨的资料管理员：逐个核对素材路径并阅读内容，" +
    "从素材提取文献池（含标识符），缺素材如实列入 gaps，绝不虚构。",
});
const outline = await librarian.ask<Outline>(
  `论文主题：「${topic}」\n写作简报：${JSON.stringify(brief)}\n\n` +
    `任务：\n` +
    `1. 逐个核对素材路径，盘点结果、图表、数据与文献。\n` +
    `2. 提取文献池 refs（key/cite/identifier）——全文唯一引用来源。\n` +
    `3. 生成 claim-evidence 大纲：每节 2-4 条要点（bullet 形式，这是给人审的中间产物）。\n` +
    `4. 素材缺口列入 gaps。`,
);

phase("大纲确认硬门（两段式：大纲 → 确认 → 散文）");
const confirmedOutline =
  autoConfirm === true
    ? outline
    : await librarian.ask<Outline>(
        `把下面这份大纲展示给用户请求确认（核心论点 + 每节要点 + 文献池）：\n${JSON.stringify(outline)}\n` +
          `等待用户确认或修改；把修改意见吸收进大纲后返回确认版（结构不变）。这是两段式写作的硬门，不可跳过。`,
      );
log(`大纲确认完成：${confirmedOutline.sections.length} 节，文献池 ${confirmedOutline.refs.length} 条`);

phase("并行起草各节");
const drafts = await Promise.all(
  confirmedOutline.sections.map(async (s, i) => {
    const d = await agent(`执笔-${i + 1}-${s.name}`, {
      system:
        "你是该节的执笔人：散文体、一段一个论点、首句即结论句；" +
        "只引用文献池里的文献（按 key），素材没有的一律写 [待补文献: 主题]，严禁编造。" +
        "本任务只写稿与汇报，不要在工作区写任何文件。",
    }).ask<SectionDraft>(
      `你负责撰写「${s.name}」一节。\n论文主题：${topic}\n工作题目：${confirmedOutline.title}\n写作简报：${JSON.stringify(brief)}\n` +
        `本节大纲要点（已用户确认）：${JSON.stringify(s.points)}\n文献池：${JSON.stringify(confirmedOutline.refs)}\n\n` +
        `要求：紧扣要点，引用规范为（作者, 年份）+ 文献池 key；段落逻辑递进；每个论断落到素材证据上。`,
    );
    report({ section: d.section, chars: d.markdown.length, citations: d.citations.length });
    return d;
  }),
);

phase("组装定稿并落盘");
const writer = agent("主笔人", {
  system:
    "你是论文主笔：组装结构完整稿件（工作标题 + Abstract + 各节 + Figure legends 占位），" +
    "逐句去 AI 痕迹（空洞总起句、AI 高频词、强行三并列），正文严禁 bullet points 串散文。" +
    "起草顺序惯例：Methods → Results → Discussion → Introduction → Abstract → Title。" +
    "引证纪律：只引文献池，缺的标 [待补文献: 主题]。",
});
const saved = await writer.ask<SavedManuscript>(
  `论文主题：「${topic}」\n简报：${JSON.stringify(brief)}\n确认后大纲：${JSON.stringify(confirmedOutline)}\n各节草稿：${JSON.stringify(drafts)}\n\n` +
    `组装完整稿件并直接写入工作区。${fileRule}\n` +
    `写入完成后返回实际路径与 todos，不要重复全文。`,
);
log(`稿件已写入 ${saved.path}`);

phase("质量门：anti-AI 评分与引用核查（并行）");
const [antiAi, citationAudit] = await Promise.all([
  agent("去 AI 痕迹检查员", {
    system:
      "你是 anti-AI 检查员（五维评分制，只依据文本本身，不修改文件）：\n" +
      "Directness/Rhythm/Trust/Authenticity/Density 各 1-10 分，总分 /50。\n" +
      "检查：空洞总起句、AI 高频词（delve/pivotal/comprehensive/至关重要/深入探讨 类）、强行三并列、" +
      "程度副词堆叠、每段都以'近年来'开头、空泛评价语（'具有重大意义'）。\n" +
      "45-50 Excellent；35-44 Good；<35 Needs revision（必须给出扣分位置）。",
  }).ask<AntiAiScore>(
    `Read ${saved.path}，按五维评分并给出扣分位置清单。`,
  ),
  agent("引用核查员", {
    system:
      "你是引用核查员（借鉴 citation-verification 铁律：AI 生成的引用约 40% 有错，每条都要核验）。\n" +
      "两项任务：(1) 文献池中带标识符的逐条核验可解析（DOI/PMID）；(2) 检查正文引用是否越界" +
      "（出现文献池之外的引用 = outOfScope）。不修改文件。检索预算不超过 6 次网络调用。",
  }).ask<CitationAudit>(
    `文献池：${JSON.stringify(confirmedOutline.refs)}\n稿件：Read ${saved.path}\n\n` +
      `返回：verifiedCount、outOfScope（越界引用）、unresolved（核验失败的）。`,
  ),
]);
log(`质量门结果：anti-AI ${antiAi.total}/50，引用核验 ${citationAudit.verifiedCount} 条（越界 ${citationAudit.outOfScope.length}，未决 ${citationAudit.unresolved.length}）`);

if (antiAi.total < 35 || citationAudit.outOfScope.length > 0) {
  await writer.ask<SavedManuscript>(
    `质量门未通过，请修订 ${saved.path}（直接编辑写入）：\n` +
      `${antiAi.total < 35 ? `anti-AI ${antiAi.total}/50（<35），扣分点：${JSON.stringify(antiAi.issues)}\n` : ""}` +
      `${citationAudit.outOfScope.length > 0 ? `越界引用（删除或替换为 [待补文献]）：${JSON.stringify(citationAudit.outOfScope)}\n` : ""}` +
      `保持核心信息完整，去痕迹同时注入声音。完成后返回实际路径与更新后的 todos。`,
  );
  log(`质量门回炉修订完成（≤1 轮）`);
}

phase("审稿人终审与修订（三值 verdict）");
const reviewer = agent("审稿人", {
  system:
    "你是目标期刊审稿人（借鉴 paper-self-review 的 FINAL-VERDICT 契约）：\n" +
    "只依据稿件文本与素材清单判断，不检索、不修改文件。\n" +
    "裁定三值：ready with minor edits / needs moderate revision / not ready for submission。\n" +
    "必报：top3 blocking issues、top3 polish issues。",
});
let verdict = await reviewer.ask<FinalVerdict>(
  `Read ${saved.path}，给出三值裁定与 top3 blocking / top3 polish。\n` +
    `素材文献池（引用越界即失实）：${JSON.stringify(confirmedOutline.refs)}`,
);
let manuscriptPath = saved.path;
let todos = saved.todos;
if (verdict.verdict !== "ready with minor edits" && verdict.blocking.length > 0) {
  const revised = await writer.ask<SavedManuscript>(
    `审稿人裁定「${verdict.verdict}」，blocking issues：${JSON.stringify(verdict.blocking)}\n` +
      `请逐条修订（直接编辑写入，保持结构不变），完成后返回实际路径与更新后的 todos。修订 ≤1 轮，改不完的列入 todos。`,
  );
  manuscriptPath = revised.path;
  todos = revised.todos;
  verdict = await reviewer.ask<FinalVerdict>(
    `修订后请重新 Read ${manuscriptPath} 并给出最终三值裁定与 top3 blocking / polish。`,
  );
  log(`终审修订完成，最终裁定：${verdict.verdict}`);
} else {
  log(`终审裁定：${verdict.verdict}`);
}

try {
  await artifact.file("manuscript", manuscriptPath, {
    title: `论文初稿：${topic}`,
    description: brief.keyMessage,
    primary: true,
  });
} catch {
  log(`稿件已在工作区 ${manuscriptPath}，但发布预览卡片失败。`);
}

const blockingFindings: TodoFinding[] = verdict.blocking.map((b) => ({
  where: "审稿人 blocking issue",
  what: b,
  evidence: `终审裁定「${verdict.verdict}」，见稿件`,
  status: "unconfirmed",
}));
const todoFindings: TodoFinding[] = todos.map((t) => ({
  where: "作者待办",
  what: t,
  evidence: "见稿件文末待办清单",
  status: "unconfirmed",
}));

return {
  conclusion:
    `「${topic}」的 IMRAD 初稿完成（大纲经${autoConfirm ? "自动" : "用户"}确认门；` +
    `anti-AI ${antiAi.total}/50；引用核验 ${citationAudit.verifiedCount} 条、越界 ${citationAudit.outOfScope.length}；` +
    `终审裁定「${verdict.verdict}」），保存到 ${manuscriptPath}。`,
  findings: [...blockingFindings, ...todoFindings],
  verified: [
    "大纲经确认硬门（两段式：bullet 大纲是人审 checkpoint）",
    "各节引证仅限素材文献池，越界引用已在质量门处理",
    `anti-AI 五维评分 ${antiAi.total}/50（<35 已回炉）`,
    "稿件经审稿人三值 verdict 终审（非 ready 已修订一轮）",
    `稿件已落盘：${manuscriptPath}`,
  ],
  notCovered: [
    "图表未嵌入稿件（仅图注占位），投稿格式与参考文献样式未排版",
    "anti-AI 修订后未二次评分（单轮回炉设计）",
    "初稿为工作稿，投稿前需人工全文通读与查重",
  ],
};