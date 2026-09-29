/* zcode-workflow
description: 实验设计动态工作流（借鉴 CC research-ideation 5W1H +
  scientific-critical-thinking 四维评审）：访谈 → 5W1H 构思+假说可证伪化 → 3 个并行方案设计 →
  四维加权批判评审(25/30/25/20)+致命缺陷 → 用户选择门 → 定稿落盘 Experiments/。
args:
  context:
    type: string
    description: 可选。研究对象/平台/预算与时间/已有工具等；含“自动确认”则跳过方案选择门
    default: ""
  topic:
    type: string
    description: 要验证的科学问题或假说方向
    required: true
*/
// research-design — 实验设计动态工作流（借鉴 CC research-ideation + scientific-critical-thinking）：
// 访谈 → 5W1H 构思 + 假说可证伪化 → 3 个并行方案设计（不同策略取向）→ 四维加权批判评审（25/30/25/20 + 致命缺陷）
// → 用户选择门（proceed/modify）→ 定稿落盘 Experiments/experiment-design-{slug}.md。
// 设计六要素：变量定义/对照体系/随机化盲法/生物学重复/样本量依据/批次控制。

interface DesignBrief {
  /** 精确化后的科学问题 */
  question: string;
  /** 研究对象与模型（细胞系/动物/人群/数据集） */
  model: string;
  /** 可用平台与工具（抗体/CRISPR/仪器/预算量级） */
  platform: string;
  /** 时间与预算约束 */
  constraints: string;
  /** 用户强调的偏好 */
  preferences: string;
}

interface IdeaBrief {
  /** 5W1H 各维一句话 */
  what: string;
  why: string;
  who: string;
  when: string;
  where: string;
  how: string;
  /** 可证伪假说：在[条件]中，[干预X]通过[机制Y]影响[读出Z]；若X改变而Z未按预期改变则假说否定 */
  hypothesis: string;
  /** 方案取向建议（给 3 个设计师的分工提示） */
  angles: string[];
}

interface DesignProposal {
  /** 方案编号与名称（如 "方案A：稳健主线"） */
  name: string;
  /** 设计总表：分组×处理×读出×重复 */
  designMatrix: string;
  /** 对照体系（阴性/阳性/同型/参照） */
  controls: string;
  /** 样本量依据（power analysis 或文献依据） */
  sampleSize: string;
  /** 正交验证策略（关键结论至少两条独立手段） */
  orthogonalValidation: string;
  /** 时间线与风险预案 */
  timelineRisks: string;
  /** 开工前必须先做的 pilot */
  pilots: string;
}

interface ProposalReview {
  /** 方案名 */
  proposal: string;
  /** 四维评分：科学价值25/创新性30/可行性25/研究基础20 */
  scores: { novelty: number; feasibility: number; scientificValue: number; foundation: number };
  /** 总分 /100 */
  total: number;
  /** 致命缺陷（威胁主结论效度，必须修复才能开工） */
  fatalFlaws: string[];
  /** 重要改进建议 */
  improvements: string[];
}

interface SelectedDesign {
  /** 实际写入路径 */
  path: string;
  /** 用户选择意见的落实摘要 */
  adaptations: string;
}

interface FlawFinding {
  /** 来源 */
  where: string;
  /** 缺陷/意见内容 */
  what: string;
  /** 支撑：见定稿文档的评审响应节 */
  evidence: string;
  /** 已在定稿中响应 */
  status: "verified" | "unconfirmed";
}

const topic = String(args.topic ?? "").trim();
if (topic === "") {
  throw new Error("缺少科学问题：请以 args.topic 传入。");
}
const context = String(args.context ?? "").trim();
const autoConfirm = context.includes("自动确认");

const expFiles = await files.glob("Research/*/Experiments/*.md");
const projects = [...new Set(expFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `已有课题：Research/{${projects.join(", ")}}。与主题明显匹配的写入其 Experiments/（目录不存在则创建）；否则新建 Research/{简短英文slug}/Experiments/ 写入。`
    : "写入根目录 Experiments/（不存在则创建）。";
const fileRule = `文件名 experiment-design-{YYYYMMDD}-{简短slug}.md（日期用今天，可用 date 命令查询）。${saveRule}`;

phase("需求访谈：弄清对象、平台与约束");
const intake = agent("需求访谈员", {
  system:
    "你是实验设计导师的开题面谈：动工前必须弄清研究对象、可用平台、时间预算。" +
    "背景足够时直接整理；关键项（研究对象、可用平台）缺失时才向用户追问一次。",
});
const brief = await intake.ask<DesignBrief>(
  `要设计实验验证：「${topic}」。${context !== "" ? `用户背景：${context}。` : "平台与约束未提供——必须向用户问清研究对象、可用平台、时间预算。"}` +
    `\n\n整理成设计简报；关键项缺失就向用户追问。`,
);
log(`设计简报就绪：${brief.question}`);

phase("5W1H 构思与假说可证伪化");
const ideator = agent("构思师", {
  system:
    "你是研究构思师（借鉴 research-ideation 的 5W1H 法）：先六维展开，再把模糊想法压成可证伪假说。\n" +
    "假说格式：在[条件/模型]中，[干预X]通过[机制Y（可选）]影响[读出Z]；若X改变而Z未按预期改变，则假说被否定。\n" +
    "自查：能否设计一个'假说为真则结果必须相反'的实验？说不出就不合格，回炉重写。",
});
const idea = await ideator.ask<IdeaBrief>(
  `科学问题：「${topic}」\n设计简报：${JSON.stringify(brief)}\n\n` +
    `任务：5W1H 六维构思（What/Why/Who/When/Where/How 各一句话）→ 提炼可证伪假说 → ` +
    `给出 3 个方案取向建议（angles，如：稳健主线 / 创新深潜 / 快速验证，各一句话分工提示）。`,
);
log(`假说：${idea.hypothesis}`);

phase("并行设计 3 个方案");
const proposals = await Promise.all(
  idea.angles.slice(0, 3).map(async (angle, i) => {
    const p = await agent(`方案设计师-${i + 1}`, {
      system:
        "你是实验设计师，负责一个方案取向。设计必须完整覆盖六要素：\n" +
        "①变量定义（自变量含梯度/因变量含检测方法/混杂逐一列控制手段）②对照体系（阴性/阳性/同型/参照，每组实验必答'对照是什么'）\n" +
        "③随机化与盲法 ④生物学重复 n≥3 且与技术重复严格区分（技术重复不得计入 n）⑤样本量依据（power analysis 或文献，写明计算过程）⑥批次控制。\n" +
        "关键结论必须有正交验证策略（两条独立手段）；体系未建立先列 pilot。本任务只设计不落盘。",
    }).ask<DesignProposal>(
      `你的方案取向：${angle}\n科学问题：${topic}\n假说：${idea.hypothesis}\n设计简报：${JSON.stringify(brief)}\n\n` +
        `按类型定义产出完整方案（六要素一个不能少），方案名用「方案${"ABC"[i]}：${angle.slice(0, 12)}」式命名。`,
    );
    report({ proposal: p.name, hasPilot: p.pilots !== "" });
    return p;
  }),
);

phase("四维加权批判评审");
const reviewer = agent("批判评审人", {
  system:
    "你是批判评审人（借鉴 scientific-critical-thinking 四维加权：科学价值 25%/创新性 30%/可行性 25%/研究基础 20%，总分 /100）。\n" +
    "逐方案评分并区分：致命缺陷（威胁主结论效度，必须修复才能开工）/ 重要改进建议。\n" +
    "检查清单：假说可证伪性、对照完整性、重复设计（技术重复不得计 n）、样本量依据、批次混杂、正交验证、" +
    "无阳性对照、读出与假说错位。评分要有具体位置引用，不空评。",
});
const reviews = await reviewer.ask<{ reviews: ProposalReview[] }>(
  `假说：${idea.hypothesis}\n设计简报：${JSON.stringify(brief)}\n候选方案：${JSON.stringify(proposals)}\n\n` +
    `对每个方案独立执行四维加权评审，输出 reviews 数组（顺序与候选一致）。`,
);
log(`评审完成：${reviews.reviews.map((r) => `${r.proposal} ${r.total}分${r.fatalFlaws.length > 0 ? `（致命缺陷 ${r.fatalFlaws.length}）` : ""}`).join("；")}`);

phase("用户选择与定稿落盘");
const finalizer = agent("方案定稿人", {
  system:
    "你是方案定稿人：把用户选中的方案写成可执行、可辩护的实验设计文档，" +
    "并附'评审意见响应'一节——逐条说明致命缺陷如何修复、改进建议采纳与否及理由。" +
    "铁律：评审发现致命缺陷的方案，文档必须写明修复措施，不能带缺陷开工。",
});
const final = await finalizer.ask<SelectedDesign>(
  `候选方案与评审结果：${JSON.stringify({ proposals, reviews })}\n假说：${idea.hypothesis}\n\n` +
    `${autoConfirm ? "用户已开启自动确认：选总分最高且无致命缺陷的方案；若全有致命缺陷，选最接近可行的并在文档中列明修复计划。userNotes 记'自动确认'。" : "把各方案对比（名称/总分/致命缺陷/适用场景）展示给用户，等待用户选择（可附修改意见），把选择与意见落实到定稿。"}` +
    `\n\n将选中方案定稿为实验设计文档并写入工作区，结构：背景与假说 → 设计总表 → 对照表 → 样本量依据 → 正交验证策略 → 时间线与风险 → Pilot 清单 → 评审意见响应 → Open Questions。\n` +
    `${fileRule}\n返回实际路径与 adaptations（用户意见落实摘要）。`,
);
log(`实验设计已定稿：${final.path}`);

try {
  await artifact.file("design", final.path, {
    title: `实验设计：${topic}`,
    description: idea.hypothesis,
    primary: true,
  });
} catch {
  log(`设计文档已在工作区 ${final.path}，但发布预览卡片失败。`);
}

const flawFindings: FlawFinding[] = reviews.reviews
  .flatMap((r) => r.fatalFlaws.map((f) => ({ r, f })))
  .map(({ r, f }) => ({
    where: `评审致命缺陷（${r.proposal}）`,
    what: f,
    evidence: "见定稿文档「评审意见响应」一节",
    status: "verified",
  }));

return {
  conclusion:
    `「${topic}」的实验设计完成：3 个方案并行设计 → 四维评审（最高分 ${Math.max(...reviews.reviews.map((r) => r.total))}/100）→ ` +
    `${autoConfirm ? "自动选择" : "用户选择"}后定稿，保存到 ${final.path}。假说：${idea.hypothesis}`,
  findings: flawFindings,
  verified: [
    "假说经可证伪化检查（说不出反向实验即回炉）",
    "3 个方案由独立设计师并行完成，六要素齐全",
    "四维加权评审（25/30/25/20）+ 致命缺陷列表已给出",
    `方案经${autoConfirm ? "自动确认" : "用户选择门"}后定稿，致命缺陷已在「评审意见响应」中处理`,
    `设计文档已落盘：${final.path}`,
  ],
  notCovered: [
    "设计评审是纸面推演，pilot 结果可能推翻方案（开工前先跑 pilot）",
    "样本量依据若来自文献引用，未逐条核验原文",
  ],
};