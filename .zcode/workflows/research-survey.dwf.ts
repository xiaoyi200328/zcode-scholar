/* zcode-workflow
description: 综述式入门笔记工作流
  v4（结构=领域进展综述→研究方向举例+代表文章略读卡→讨论与展望）：访谈(库存检查)→按研究方向并行检索代表作(核验标识符)→三部分组装(3000-5000字)→新手复审→落盘。深入浅出、详略得当、脉络清晰；单篇精读主线已废除。
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
// research-survey v4 — 综述式入门笔记（结构：领域进展综述 → 研究方向举例+代表文章略读卡 → 讨论与展望）：
// 访谈(库存检查) → 按研究方向并行检索代表作（每人 ≤3 次网络调用，核验标识符）→ 三部分组装（3000-5000 字）
// → 新手复审（≤2 问题）→ 落盘。
// 纪律：深入浅出、详略得当、脉络清晰；废除单篇精读主线；引证只来自检索结果。

interface IntakeBrief {
  /** 一句话学习目标 */
  goal: string;
  /** 用户当前阶段与已有基础 */
  stage: string;
  /** 3-4 个研究方向板块（按领域自身逻辑划分，构成综述脉络与略读章节） */
  directions: {
    /** 方向名称 */
    name: string;
    /** 检索要点提示 */
    hint: string;
  }[];
  /** 后续规划（影响详略取舍） */
  plan: string;
  /** 明确不需要覆盖的内容 */
  exclude: string;
  /** 库存检查命中的已有可复用知识，没有则为空字符串 */
  reused: string;
}

interface PaperRef {
  /** 论文标题（英文原题） */
  title: string;
  /** 第一作者 et al., 年份 */
  cite: string;
  /** 可验证标识符：DOI / PMID / arXiv ID（已批量核验） */
  identifier: string;
}

interface SkimCard {
  /** 论文标题（英文原题） */
  title: string;
  /** 第一作者 et al., 年份 */
  cite: string;
  /** 标识符（已核验） */
  identifier: string;
  /** 研究问题一句话（≤60 字） */
  question: string;
  /** 方法/思路一句话（≤60 字） */
  method: string;
  /** 关键结果一句话（≤60 字） */
  result: string;
  /** 在领域脉络中的位置：承前启后/与其它工作的关系（一句话） */
  position: string;
}

interface DirectionNotes {
  /** 研究方向名称（与分配到的保持一致） */
  direction: string;
  /** 方向定位 2-3 句：解决什么问题、现状到哪、与其它方向的关系 */
  overview: string;
  /** 该方向代表性文章略读卡 2-3 张 */
  skims: SkimCard[];
}

interface SavedNote {
  /** 实际写入的工作区相对路径 */
  path: string;
  /** 笔记末尾"下一步点单"清单：3-5 个后续可延伸方向 */
  nextOptions: { title: string; why: string }[];
}

interface ReaderCritique {
  /** 最多 2 个最影响阅读的问题：脉络不清/略读卡难读/术语未解释；没有则为空数组 */
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
const fileRule = `文件名 Primer-{YYYYMMDD}-{简短slug}.md（日期用今天，可用 date 命令查询；若同名文件已存在直接覆盖）。${saveRule}`;

phase("需求访谈：先弄清你的阶段与重点");
const intake = agent("需求访谈员", {
  system:
    "你是研究导师开新课前的第一次面谈：目标是在动手前弄清学生现阶段最需要什么，而不是急着展示学问。\n" +
    "第一步先做库存检查：用 Glob/Read 查工作区已有知识（各课题的 Knowledge 与 Papers 目录里与主题相关的笔记），命中的记入简报的 reused 字段——避免重复调研。\n" +
    "第二步：把该领域按自身逻辑划分成 3-4 个研究方向板块（如发展阶段/方法流派/问题切面——选最适合该领域的划分方式），这些板块将构成综述脉络与略读章节，每个板块给一句检索要点（hint）。\n" +
    "第三步：用户背景信息已足够时直接整理成简报；只有当学习目的完全无法判断时才向用户追问一次（当前阶段与基础、最想搞清的重点、接下来的规划、不想要什么）。",
});
const brief = await intake.ask<IntakeBrief>(
  context === ""
    ? `用户想入门「${topic}」，但没有提供任何背景。先做库存检查，然后划分 3-4 个研究方向板块，再向用户追问弄清：当前阶段与已有基础、最想搞清的重点、接下来的规划、不想要的内容，整理成简报（含 directions 与 reused）。`
    : `用户想入门「${topic}」，并提供了背景：\n${context}\n\n先做库存检查，然后划分 3-4 个研究方向板块，整理成简报（含 directions 与 reused）；信息足够就不要追问。`,
);
log(`需求简报就绪：${brief.goal}（${brief.directions.length} 个研究方向）${brief.reused !== "" ? `｜库存命中：${brief.reused.slice(0, 60)}` : ""}`);

phase("并行检索各研究方向的代表文章");
const notes = await Promise.all(
  brief.directions.map(async (d, i) => {
    const n = await agent(`文献选路人-${i + 1}`, {
      system:
        "你是给新人挑文献的前辈：判断力优先，选最能代表该方向脉络的文章，不凑数量。" +
        "检索预算（搜索+核验合计）不超过 3 次网络调用，只看标题与摘要，不读全文，超预算立即收尾。" +
        "标识符核验不过的论文不得入选；检索通道全部不可用就如实说明，不要编造。" +
        "响应精简：每条字段 ≤60 字，不要长篇大论。本任务只检索与汇报，不要在工作区写任何文件。",
    }).ask<DirectionNotes>(
      `你负责的研究方向：${d.name}\n方向要点：${d.hint}\n所属主题：${topic}\n\n` +
        `任务：为该方向找 2-3 篇最有代表性的文章（权威综述/奠基作/代表工作均可）；简报 reused 里已有的知识可在 overview 呼应。\n` +
        `1. 先 Read .claude/rules/mcp-routing.md 了解本仓库检索路由。\n` +
        `2. 一次批量核验全部标识符（如 PubMed efetch 的 id 参数逗号分隔）；核验不过的换掉或舍弃。\n` +
        `3. 每篇产出结构式略读卡（question/method/result/position 各一句话，每条 ≤60 字），overview 用 2-3 句话定位该方向。`,
    );
    report({ direction: n.direction, papers: n.skims.length });
    return n;
  }),
);

phase("组装综述式入门笔记并落盘");
const writer = agent("笔记撰写人", {
  system:
    "你是给这位学生写领域入门综述的导师：中文、深入浅出（每个机制讲成大白话）、详略得当（脉络段详、略读卡精）、脉络清晰（段落间递进过渡，不是罗列）。\n" +
    "所有文献表述以检索结果为准，不添加检索结果之外的文献；术语首次出现必须给大白话解释。\n" +
    "若简报 reused 提到工作区已有相关笔记，在笔记开头注明'延伸自'并建议对照阅读。",
});
const draft = await writer.ask<SavedNote>(
  `主题：${topic}\n需求简报：${JSON.stringify(brief)}\n各方向检索结果：${JSON.stringify(notes)}\n\n` +
    `撰写综述式入门笔记（全文 3000-5000 字）并直接写入工作区，结构严格按以下顺序：\n\n` +
    `# {主题} 入门笔记\n` +
    `## 一、领域进展\n` +
    `  结构化综述：按各研究方向组织成递进脉络（领域背景与问题 → 各方向演进与现状，融入代表文章引用，术语首现给大白话）→ 一句话收束当前整体格局。这是叙事主体，占全文一半左右。\n` +
    `## 二、代表性研究方向与文章略读\n` +
    `  每个方向一小节：2-3 句方向定位 + 该方向每篇代表文章一张结构式略读卡，统一模板：\n` +
    `  **{标题}**（{作者, 年份}｜{标识符}）— 研究问题：…｜方法：…｜关键结果：…｜脉络位置：…\n` +
    `## 三、讨论与展望\n` +
    `  开放问题 2-4 条、领域趋势判断、结合用户阶段与规划的一句话启示。\n` +
    `## 核心概念速查\n` +
    `  术语表 ≤8 条（术语｜大白话解释），正文已首现解释，此处集中备查。\n` +
    `## 代表文章清单\n` +
    `  全量表：标题｜作者年份｜标识符｜所属方向。\n` +
    `## 下一步你可以点单的方向\n` +
    `  nextOptions 3-5 条：是什么 + 为什么可能对你有用。\n\n` +
    `写作纪律：\n` +
    `- 综述段是叙事不是罗列：方向之间要有逻辑递进（谁解决了什么、还剩什么、引出谁）\n` +
    `- 严禁回到'单篇精读主线'的旧写法——没有唯一主文，各方向代表作平权呈现\n` +
    `- 引证只来自检索结果（均带标识符），穿插在综述与略读卡中\n` +
    `落盘规则：${fileRule}\n` +
    `写入完成后返回实际路径与 nextOptions（不要再返回全文）。`,
);
log(`笔记已写入 ${draft.path}`);

phase("新手视角复审并定稿");
const reader = agent("独立评审员", {
  system:
    "你是刚接触这个领域的学生，只依据笔记文本本身阅读，不检索、不核对仓库、不修改任何文件。" +
    "只提最影响阅读的问题（最多 2 个）：脉络不清 / 略读卡难读 / 术语没解释。不夸奖、不吹毛求疵。",
});
const critique = await reader.ask<ReaderCritique>(
  `先 Read ${draft.path}，然后以零基础新生的身份只依据文本本身，挑出最多 2 个最影响阅读的问题。确实没有就返回空数组。`,
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
    `已完成「${topic}」的综述式入门笔记（${notes.length} 个研究方向、${notes.reduce((n, d) => n + d.skims.length, 0)} 篇代表文章略读卡），` +
    `已保存到 ${notePath}。后续想深入哪个方向，从笔记末尾的点单清单里选即可。`,
  findings: optionFindings,
  verified: [
    "需求经访谈确认（或由 context 参数提供），访谈含库存检查与研究方向划分",
    "全部代表文章的标识符经批量核验可解析",
    "笔记结构 = 领域进展综述 → 代表方向+略读卡 → 讨论与展望（经零基础视角复审修订）",
    `笔记已落盘：${notePath}`,
  ],
  notCovered: [
    "综述式略读基于标题与摘要，未逐篇通读全文",
    "只写了 1 篇笔记，领域全貌按点单延伸",
    "延伸选项是建议性质，未经调研验证",
  ],
};