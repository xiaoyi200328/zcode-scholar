/* zcode-workflow
description: 需求先行的入门笔记工作流：先访谈（含库存检查——已有知识可复用则标注）弄清你的阶段/重点/规划，再按聚焦点并行检索候选文献（核验标识符），撰写
  1 篇定制入门笔记并落盘到知识库，新手视角复审。low 档约 10 分钟。
args:
  context:
    type: string
    description: 可选。已知背景：当前阶段与基础、最想搞清的重点、后续规划、不想要的内容。提供后跳过访谈直接开工；不提供则工作流会先问你再动工
    default: ""
  topic:
    type: string
    description: 想入门的领域/主题（中英文均可）
    required: true
*/
// research-survey v3.1 — 需求先行的新手入门笔记：
// 访谈（含库存检查）→ 按聚焦点并行检索（每人 ≤3 次网络调用）→ 撰写并直接落盘 → 新手复审（≤2 问题）。
// 多篇文献做支撑、只产出 1 篇笔记；延伸方向由用户点单。

interface IntakeBrief {
  /** 一句话学习目标：用户此刻最需要建立什么认知 */
  goal: string;
  /** 用户当前阶段与已有基础（如：零基础 / 有相关背景 / 正在做课题） */
  stage: string;
  /** 聚焦重点：这次必须讲清的 2-4 个具体问题 */
  focuses: string[];
  /** 与学习目标相关的后续规划（开题 / 实验设计 / 写基金 / 纯学习），影响笔记取舍 */
  plan: string;
  /** 明确不需要覆盖的内容（防止笔记跑偏），没有则为空字符串 */
  exclude: string;
  /** 工作区已有可复用知识（库存检查命中：课题 Knowledge 与 Papers 目录里的相关笔记），没有则为空字符串 */
  reused: string;
}

interface PaperRef {
  /** 论文标题（英文原题） */
  title: string;
  /** 第一作者 et al., 年份 */
  cite: string;
  /** 可验证标识符：DOI / PMID / arXiv ID 之一（已批量核验） */
  identifier: string;
}

interface FocusPicks {
  /** 聚焦焦点（与分配到的保持一致） */
  focus: string;
  /** 该焦点候选文献 2-3 篇，供撰写人择优取用 */
  candidates: (PaperRef & {
    /** 在笔记中的用途：支撑哪个焦点/哪段论述 */
    usedFor: string;
    /** 1-2 句要点（基于摘要）：讲了什么、结论是什么 */
    points: string;
  })[];
}

interface SavedNote {
  /** 实际写入的工作区相对路径 */
  path: string;
  /** 笔记末尾"下一步点单"清单：3-5 个后续可延伸方向 */
  nextOptions: { title: string; why: string }[];
}

interface ReaderCritique {
  /** 最多 2 个最影响零基础读者理解的问题；没有则为空数组 */
  issues: string[];
}

interface NextOption {
  /** 延伸选项来源 */
  where: string;
  /** 选项 + 一句话为什么值得 */
  what: string;
  /** 支撑：见笔记「下一步」一节 */
  evidence: string;
  /** 建议性质，未经调研验证 */
  status: "verified" | "unconfirmed";
}

const topic = String(args.topic ?? "").trim();
if (topic === "") {
  throw new Error("缺少调研主题：请以 args.topic 传入。");
}
const context = String(args.context ?? "").trim();

// 落盘规则：检测仓库是否为 Obsidian vault（Research 下有课题 Knowledge 目录）
const kbFiles = await files.glob("Research/*/Knowledge/*.md");
const projects = [...new Set(kbFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `工作区已有课题目录：Research/{${projects.join(", ")}}。若某课题与主题明显匹配，写入其 Knowledge/（不存在则创建）；否则在 Research/ 下新建 {简短英文slug}/Knowledge/ 写入。`
    : "工作区没有课题目录：写入根目录 Knowledge/（不存在则创建）。";
const fileRule = `文件名 Primer-{YYYYMMDD}-{简短slug}.md（日期用今天，可用 date 命令查询）。${saveRule}`;

phase("需求访谈：先弄清你的阶段与重点");
const intake = agent("需求访谈员", {
  system:
    "你是研究导师开新课前的第一次面谈：目标是在动手前弄清学生现阶段最需要什么，而不是急着展示学问。\n" +
    "第一步先做库存检查：用 Glob/Read 查工作区已有知识（各课题的 Knowledge 与 Papers 目录里与主题相关的笔记），" +
    "命中的记入简报的 reused 字段——避免重复调研。\n" +
    "第二步：用户背景信息已足够时直接整理成简报；只有当学习目的完全无法判断时才向用户追问，" +
    "追问一次问全最关键的几点：当前阶段与基础、最想搞清的重点、接下来的规划、不想要什么。" +
    "若库存里已有可直接复用的笔记，向用户指出而不是从零开始。",
});
const brief = await intake.ask<IntakeBrief>(
  context === ""
    ? `用户想入门「${topic}」，但没有提供任何背景。先做库存检查，然后向用户追问弄清：当前阶段与已有基础、这次最想搞清的重点（2-4 个具体问题）、接下来的规划、明确不想要的内容，整理成简报（含 reused）。`
    : `用户想入门「${topic}」，并提供了背景：\n${context}\n\n先做库存检查，然后整理成简报（含 reused）；信息足够就不要追问。`,
);
log(`需求简报就绪：${brief.goal}${brief.reused !== "" ? `（库存命中：${brief.reused.slice(0, 80)}）` : ""}`);

const focusList = brief.focuses.length > 0 ? brief.focuses : [topic];

phase("并行定向检索：按聚焦点选文献");
const picks = await Promise.all(
  focusList.map(async (f, i) => {
    const p = await agent(`文献选路人-${i + 1}`, {
      system:
        "你是给新人挑文献的前辈：判断力优先，只选最合适的，不凑数量。" +
        "检索预算（搜索+核验合计）不超过 3 次网络调用，只看标题与摘要，不读全文，超预算立即收尾。" +
        "标识符核验不过的论文不得入选；检索通道全部不可用就如实说明，不要编造。" +
        "本任务只检索与汇报，不要在工作区写任何文件。",
    }).ask<FocusPicks>(
      `你负责的聚焦点：${f}\n主题：${topic}\n需求简报：${JSON.stringify(brief)}\n\n` +
        `任务：为该聚焦点找 2-3 篇最合适的候选文献（权威综述 / 奠基作 / 代表工作均可）；简报 reused 里已有的知识可在 points 里呼应。\n` +
        `1. 先 Read .claude/rules/mcp-routing.md 了解本仓库检索路由。\n` +
        `2. 一次批量核验全部标识符（如 PubMed efetch 的 id 参数逗号分隔）；核验不过的换掉或舍弃。\n` +
        `3. 每篇写 1-2 句要点（points，基于摘要）并注明 usedFor（支撑该焦点的哪个论述）。`,
    );
    report({ focus: p.focus, papers: p.candidates.length });
    return p;
  }),
);

phase("撰写入门笔记并落盘");
const writer = agent("笔记撰写人", {
  system:
    "你是给这位学生写第一课的导师：中文大白话，每一段都对着需求简报写，宁可讲透一个点，不做信息罗列。" +
    "所有文献表述以检索结果为准，不添加检索结果之外的文献。" +
    "若简报 reused 提到工作区已有相关笔记，在笔记开头注明'延伸自'并建议读者对照阅读。",
});
const draft = await writer.ask<SavedNote>(
  `主题：${topic}\n需求简报：${JSON.stringify(brief)}\n各焦点候选文献：${JSON.stringify(picks)}\n\n` +
    `第一步：从全部候选中选出 1 篇最适合做精读主线的主文（最权威、最适配其阶段与规划），在笔记中说明选择理由。\n` +
    `第二步：撰写 1 篇入门笔记（全文约 2000-2500 字）并直接写入工作区，结构：\n` +
    `# {主题} 入门笔记\n` +
    `## 这个方向在研究什么、为什么和你有关（对照简报的阶段与规划来写）\n` +
    `## 看懂主文必需的核心概念（≤6 条术语，每条一句话大白话）\n` +
    `## 主文精读：{主文标题}（选它的理由 / 研究问题 / 方法一句话 / 关键结果 / 局限）\n` +
    `## 为什么这是你当前阶段的最佳切入点（对照简报）\n` +
    `## 下一步你可以点单的方向（nextOptions 3-5 条：是什么 + 为什么可能对你有用）\n\n` +
    `文献使用规则：主文是精读主线；其余候选按论述需要穿插引证（均带标识符，每处一句话说清它支撑什么），` +
    `简报每个聚焦点至少落到 1-2 篇文献的具体结论上——引证可以多，但严禁逐篇罗列。\n` +
    `落盘规则：${fileRule}\n` +
    `写入完成后返回实际路径与 nextOptions（不要再返回全文）。`,
);
log(`笔记已写入 ${draft.path}`);

phase("新手视角复审并定稿");
const reader = agent("独立评审员", {
  system:
    "你是刚接触这个领域的学生，只依据笔记文本本身阅读，不检索、不核对仓库、不修改任何文件。" +
    "只提最影响理解的问题（最多 2 个），不夸奖、不吹毛求疵。",
});
const critique = await reader.ask<ReaderCritique>(
  `先 Read ${draft.path}，然后以零基础新生的身份只依据文本本身，挑出最多 2 个最影响理解的问题` +
    `（没解释的术语 / 逻辑跳跃 / 看不懂的句子）。确实没有就返回空数组。`,
);
let notePath = draft.path;
let nextOpts = draft.nextOptions;
if (critique.issues.length > 0) {
  const revised = await writer.ask<SavedNote>(
    `零基础读者读完 ${draft.path} 提出以下问题：${JSON.stringify(critique.issues)}\n` +
      `请按问题修订该文件（直接编辑写入，保持结构与落盘规则不变），完成后只返回实际路径与修订后的 nextOptions。`,
  );
  notePath = revised.path;
  nextOpts = revised.nextOptions;
  log(`按新手读者的反馈修订了 ${critique.issues.length} 处。`);
} else {
  log("复审未发现问题，笔记定稿。");
}

try {
  await artifact.file("note", notePath, {
    title: `入门笔记：${topic}`,
    description: brief.goal,
    primary: true,
  });
} catch {
  const repaired = await writer.ask<SavedNote>(
    `文件 ${notePath} 未能发布（可能未写成功或路径有误）。请核对并重新写入，只返回最终确认的相对路径。`,
  );
  notePath = repaired.path;
  try {
    await artifact.file("note", notePath, {
      title: `入门笔记：${topic}`,
      description: brief.goal,
      primary: true,
    });
  } catch {
    log(`笔记已在工作区 ${notePath}，但发布预览卡片失败。`);
  }
}

const optionFindings: NextOption[] = nextOpts.map((o) => ({
  where: "延伸选项",
  what: `${o.title} —— ${o.why}`,
  evidence: "见笔记「下一步你可以点单的方向」一节",
  status: "unconfirmed",
}));

return {
  conclusion:
    `已完成「${topic}」的 1 篇入门笔记（按需求简报定制：${brief.goal}），已保存到 ${notePath}。` +
    `后续想深入哪个方向，从笔记末尾的点单清单里选即可。`,
  findings: optionFindings,
  verified: [
    "需求经访谈确认（或由 context 参数提供），访谈含库存检查（已有知识可复用则标注）",
    "全部候选文献的标识符经批量核验可解析",
    "笔记经零基础新手视角的独立评审通读并修订",
    `笔记已落盘：${notePath}`,
  ],
  notCovered: [
    "只写了 1 篇笔记，未覆盖领域全貌（按点单延伸）",
    "基于摘要级理解，未通读主文全文",
    "延伸选项是建议性质，未经调研验证",
  ],
};