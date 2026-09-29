/* zcode-workflow
description: 论文写作动态工作流：访谈定方向 → 素材盘点生成 claim-evidence 大纲 →
  并行分节起草（Methods/Results/Intro/Discussion）→ 组装去 AI 痕迹并落盘 →
  审稿人复审修订。引证只来自素材，缺的显式标记[待补文献]。
args:
  journal:
    type: string
    description: 目标期刊与稿件类型（如 Article/Letter），决定结构与篇幅
    default: ""
  materials:
    type: string
    description: 素材路径清单（分号/逗号分隔）：结果报告、解读报告、图目录、文献清单等；不填则访谈时向你收集
    required: true
  topic:
    type: string
    description: 论文主题或工作题目
    required: true
*/
// research-write — 论文写作动态工作流：
// 需求访谈 → 素材盘点与 claim-evidence 大纲 → 并行分节起草 → 组装去 AI 痕迹并落盘 → 审稿人复审修订。
// 铁律：引证只来自素材提供的文献池；素材没有的一律写 [待补文献: 主题]，严禁编造。

interface WriteBrief {
  /** 一句话：这篇稿子要讲的核心结论（take-home message） */
  keyMessage: string;
  /** 目标期刊与稿件类型（Article/Letter/Original Research…），未定则写"未定" */
  journal: string;
  /** 图表是否定稿、数据是否冻结 */
  readiness: string;
  /** 用户强调的要求与禁忌 */
  constraints: string;
  /** 素材路径清单（调用方未提供时向用户收集） */
  materials: string[];
}

interface RefEntry {
  /** 引用键：素材内文献的短键（如 Rifai2006） */
  key: string;
  /** 完整引用信息：作者/年份/期刊 */
  cite: string;
  /** 可验证标识符：DOI / PMID（素材里有的话），没有则空字符串 */
  identifier: string;
}

interface Outline {
  /** 建议题目（工作标题） */
  title: string;
  /** 各节大纲（通常含 Introduction / Methods / Results / Discussion） */
  sections: {
    /** 节名 */
    name: string;
    /** 本节要点：claim → evidence 对应关系，2-4 条 */
    points: string[];
  }[];
  /** 素材文献池：写作时只允许引用这些（按 key 引用） */
  refs: RefEntry[];
  /** 素材缺口：动笔前必须补的（缺失图/数据/文献），没有则为空数组 */
  gaps: string[];
}

interface SectionDraft {
  /** 节名（与分配一致） */
  section: string;
  /** 该节正文 markdown（散文体段落，不含一级标题） */
  markdown: string;
  /** 本节引用键列表；素材外的用 "[待补文献: 主题]" 原样列入 */
  citations: string[];
}

interface SavedManuscript {
  /** 实际写入的工作区相对路径 */
  path: string;
  /** 给作者的待办：[待补文献] 清单、素材缺口等 */
  todos: string[];
}

interface ReviewIssues {
  /** 审稿人视角问题 ≤3 条：证据链断裂 / 逻辑跳跃 / 过度解读 */
  issues: string[];
}

interface TodoFinding {
  /** 待办来源：素材缺口或审稿意见 */
  where: string;
  /** 待办内容 */
  what: string;
  /** 支撑：见稿件待办清单 */
  evidence: string;
  /** 待办是建议性质，未经核验 */
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

// 落盘规则：检测 vault 中带 Writing 目录的课题
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
    "你是论文写作导师的开题面谈：动笔前必须弄清核心结论、目标期刊、素材位置，而不是急着列提纲。" +
    "用户背景信息已足够时直接整理；只有关键项（素材路径、核心结论）缺失时才向用户追问一次。",
});
const brief = await intake.ask<WriteBrief>(
  `用户要写论文：「${topic}」。${journal !== "" ? `目标期刊：${journal}。` : "目标期刊未指定。"}` +
    `${context !== "" ? `补充背景：${context}。` : ""}` +
    `${argMaterials.length > 0 ? `素材路径：${argMaterials.join(" ; ")}。` : "素材路径未提供——必须向用户问清结果报告/图目录等素材的位置。"}` +
    `\n\n整理成写作简报；缺关键项（素材路径、核心结论）就向用户追问。`,
);
log(`写作简报就绪：${brief.keyMessage}`);

phase("素材盘点与 claim-evidence 大纲");
const librarian = agent("资料管理员", {
  system:
    "你是严谨的资料管理员：逐个核对素材路径是否真实存在并阅读内容，" +
    "从素材中提取可引用的文献池（含标识符），缺素材就如实列入 gaps，绝不虚构素材里没有的东西。",
});
const outline = await librarian.ask<Outline>(
  `论文主题：「${topic}」\n写作简报：${JSON.stringify(brief)}\n\n` +
    `任务：\n` +
    `1. 逐个核对简报中的素材路径（Read 或列目录），盘点可得的结果、图表、数据与文献。\n` +
    `2. 从素材中提取文献池 refs（key/cite/identifier）——这是全文唯一允许的引用来源。\n` +
    `3. 生成 claim-evidence 大纲：每节 2-4 条要点，每条写明 claim 和支撑它的图/表/素材。\n` +
    `4. 素材缺失或图表未定稿的，如实列入 gaps。`,
);
log(`大纲就绪：《${outline.title}》，共 ${outline.sections.length} 节，文献池 ${outline.refs.length} 条`);

phase("并行起草各节");
const drafts = await Promise.all(
  outline.sections.map(async (s, i) => {
    const d = await agent(`执笔-${i + 1}-${s.name}`, {
      system:
        "你是该节的执笔人：散文体、一段一个论点、首句即结论句；" +
        "只引用文献池里的文献（按 key），素材没有的一律写 [待补文献: 主题]，严禁编造。" +
        "本任务只写稿与汇报，不要在工作区写任何文件。",
    }).ask<SectionDraft>(
      `你负责撰写「${s.name}」一节。\n论文主题：${topic}\n工作题目：${outline.title}\n写作简报：${JSON.stringify(brief)}\n` +
        `本节大纲要点：${JSON.stringify(s.points)}\n文献池：${JSON.stringify(outline.refs)}\n\n` +
        `要求：紧扣要点写作，引用规范为（作者, 年份）+ 文献池 key；段落之间要有逻辑递进；` +
        `不写空话套话，每个论断都要落到素材证据上。`,
    );
    report({ section: d.section, chars: d.markdown.length, citations: d.citations.length });
    return d;
  }),
);

phase("组装定稿并落盘");
const writer = agent("主笔人", {
  system:
    "你是论文主笔：把各节草稿组装成结构完整的稿件（工作标题 + Abstract + 各节 + Figure legends 占位），" +
    "并逐句执行去 AI 痕迹：删除空洞总起句、AI 高频词（delve/pivotal/comprehensive 类）、强行三并列；" +
    "正文严禁 bullet points 串散文。引证纪律：只引文献池，缺的标 [待补文献: 主题]。",
});
const saved = await writer.ask<SavedManuscript>(
  `论文主题：「${topic}」\n简报：${JSON.stringify(brief)}\n大纲：${JSON.stringify(outline)}\n各节草稿：${JSON.stringify(drafts)}\n\n` +
    `组装顺序：Title + Abstract（最后浓缩全文）→ Introduction → Methods → Results → Discussion → Figure legends（占位）。\n` +
    `然后把完整稿件直接写入工作区。${fileRule}\n` +
    `写入完成后返回实际路径与 todos（[待补文献] 清单 + outline.gaps + 图表待办），不要在返回里重复全文。`,
);
log(`稿件已写入 ${saved.path}（待办 ${saved.todos.length} 项）`);

phase("审稿人复审并修订");
const reviewer = agent("审稿人", {
  system:
    "你是目标期刊的审稿人：只依据稿件文本与素材清单判断，不检索、不修改文件。" +
    "只提最要害的问题（最多 3 条）：证据链断裂、逻辑跳跃、过度解读、引用失实。不夸奖。",
});
const critique = await reviewer.ask<ReviewIssues>(
  `先 Read ${saved.path}，再以审稿人身份挑出最多 3 条最要害的问题；确实没有就返回空数组。` +
    `\n\n素材文献池（引用越界即失实）：${JSON.stringify(outline.refs)}`,
);
let manuscriptPath = saved.path;
let todos = saved.todos;
if (critique.issues.length > 0) {
  const revised = await writer.ask<SavedManuscript>(
    `审稿人读了 ${saved.path} 提出以下意见：${JSON.stringify(critique.issues)}\n` +
      `请逐条修订该文件（直接编辑写入，保持结构与落盘位置不变），完成后返回实际路径与更新后的 todos。`,
  );
  manuscriptPath = revised.path;
  todos = revised.todos;
  log(`按审稿意见修订并更新了 ${manuscriptPath}。`);
} else {
  log("审稿人未发现问题，稿件定稿。");
}

try {
  await artifact.file("manuscript", manuscriptPath, {
    title: `论文初稿：${topic}`,
    description: brief.keyMessage,
    primary: true,
  });
} catch {
  const repaired = await writer.ask<SavedManuscript>(
    `文件 ${manuscriptPath} 未能发布（可能未写成功或路径有误）。请核对并重新写入，返回实际路径与 todos。`,
  );
  manuscriptPath = repaired.path;
  try {
    await artifact.file("manuscript", manuscriptPath, {
      title: `论文初稿：${topic}`,
      description: brief.keyMessage,
      primary: true,
    });
  } catch {
    log(`稿件已在工作区 ${manuscriptPath}，但发布预览卡片失败。`);
  }
}

const todoFindings: TodoFinding[] = todos.map((t) => ({
  where: "作者待办",
  what: t,
  evidence: "见稿件内 [待补文献] 标记与文末待办清单",
  status: "unconfirmed",
}));

return {
  conclusion:
    `「${topic}」的 IMRAD 初稿已完成（${outline.sections.length} 节并行起草组装，审稿人复审 ${critique.issues.length > 0 ? "并修订" : "通过"}），` +
    `保存到 ${manuscriptPath}；待办 ${todos.length} 项（含待补文献）见稿件文末。`,
  findings: todoFindings,
  verified: [
    "各节由独立执笔人起草，引证仅限素材文献池，素材外一律 [待补文献] 占位",
    "稿件经审稿人视角独立复审（发现问题已修订）",
    `稿件已落盘：${manuscriptPath}`,
  ],
  notCovered: [
    "图表未嵌入稿件（仅图注占位），投稿格式与参考文献样式未排版",
    "文献池来自素材，未经逐条重新核验标识符",
    "初稿为工作稿，投稿前需人工全文通读与查重",
  ],
};