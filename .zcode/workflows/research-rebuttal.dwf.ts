/* zcode-workflow
description: 审稿回复动态工作流（借鉴 CC
  review-response）：意见解析分类（Major/Minor/Typo/Misunderstanding）→ 策略映射（Experiment
  策略升级用户决策）→ 并行逐条回应 → 语气门+完整性门（回复数=意见数）→ 组装落盘 rebuttal.md +
  review-analysis.md（+条件 experiment-plan.md）。
args:
  comments:
    type: string
    description: 审稿意见原文（直接粘贴）或意见文件路径（workspace 相对）
    required: true
  context:
    type: string
    description: 可选。稿件状态、能补实验的资源、审稿人背景等
    default: ""
  manuscript:
    type: string
    description: 被审稿件路径（workspace 相对，用于定位 Changes）
    default: ""
*/
// research-rebuttal — 审稿回复动态工作流（借鉴 CC review-response）：
// 意见解析分类 → 策略映射（Experiment 升级用户决策）→ 并行逐条回应 → 语气门+完整性门 → 组装落盘。
// 不变量：回复条数 = 意见条数（一条都不能漏，typo 也要确认）；禁语：The reviewer is wrong / This is obvious。

interface CommentItem {
  /** 意见 ID（R1-1, R2-3…按审稿人分组编号） */
  id: string;
  /** 审稿人 */
  reviewer: string;
  /** 意见原文（可精简但保留关键句） */
  text: string;
  /** 分类：Major（实质问题）/ Minor（次要）/ Typo（格式笔误）/ Misunderstanding（误解） */
  cls: "Major" | "Minor" | "Typo" | "Misunderstanding";
  /** 识别依据：命中的关键词/信号 */
  keywords: string;
}

interface StrategyItem {
  /** 意见 ID */
  id: string;
  /** 策略：Accept / Defend / Clarify / Experiment */
  strategy: "Accept" | "Defend" | "Clarify" | "Experiment";
  /** 策略理由 */
  rationale: string;
  /** Experiment 策略时：需要什么实验/数据、预计工作量 */
  experimentNeeded: string;
}

interface ResponseItem {
  /** 意见 ID */
  id: string;
  /** 关切摘要（一句话） */
  concernSummary: string;
  /** 回应正文（感谢开头；Defend 需证据；Misunderstanding 用 We apologize for the confusion） */
  response: string;
  /** 稿件修改说明（Changes）与位置引用 */
  changes: string;
}

interface ToneAudit {
  /** 语气问题（防御性/攻击性/缺感谢开头） */
  toneIssues: string[];
  /** 遗漏未回应的意见 ID */
  missingResponses: string[];
}

interface SavedRebuttal {
  /** rebuttal.md 路径 */
  rebuttalPath: string;
  /** review-analysis.md 路径 */
  analysisPath: string;
  /** experiment-plan.md 路径（无 Experiment 策略则为空字符串） */
  experimentPlanPath: string;
}

interface RebuttalFinding {
  /** 来源 */
  where: string;
  /** 内容 */
  what: string;
  /** 支撑 */
  evidence: string;
  /** 分类与策略有评审记录；回应有效性未经审稿人确认 */
  status: "verified" | "unconfirmed";
}

const comments = String(args.comments ?? "").trim();
if (comments === "") {
  throw new Error("缺少审稿意见：请以 args.comments 粘贴原文或给出文件路径。");
}
const manuscript = String(args.manuscript ?? "").trim();
const context = String(args.context ?? "").trim();

const rebuttalFiles = await files.glob("Research/*/Writing/manuscript/*.md");
const projects = [...new Set(rebuttalFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `已有课题：Research/{${projects.join(", ")}}。与稿件明显匹配的写入其 Writing/rebuttal/（目录不存在则创建）；否则新建 Research/{简短英文slug}/Writing/rebuttal/ 写入。`
    : "写入根目录 Writing/rebuttal/（不存在则创建）。";

phase("意见解析与分类");
const parser = await agent("意见解析员", {
  system:
    "你是审稿意见解析员（借鉴 review-response 分类法）：\n" +
    "按审稿人分组编号（R1-1, R1-2, R2-1…），逐条分类：\n" +
    "Major=实质性方法/结论问题（需要实质回应，不能只澄清）；Minor=次要问题；Typo=格式笔误；" +
    "Misunderstanding=误解（标志：'The authors did not...' 而实际已做）。\n" +
    "优先级排序：Major > Misunderstanding > Minor > Typo。意见在文件里就 Read 文件；逐条提取，一条不漏。",
}).ask<{ comments: CommentItem[] }>(
  `审稿意见：${comments.startsWith("/") || comments.includes("\\") || comments.endsWith(".md") || comments.endsWith(".txt") ? `（文件）Read ${comments}` : comments}\n` +
    `${context !== "" ? `背景：${context}\n` : ""}` +
    `逐条分类并返回 comments 数组（id/reviewer/text/cls/keywords），一条不漏。`,
);
log(`意见解析完成：${parser.comments.length} 条（Major ${parser.comments.filter((c) => c.cls === "Major").length} / Minor ${parser.comments.filter((c) => c.cls === "Minor").length} / Typo ${parser.comments.filter((c) => c.cls === "Typo").length} / 误解 ${parser.comments.filter((c) => c.cls === "Misunderstanding").length}）`);

phase("策略制定与补实验升级");
const strategist = agent("策略制定员", {
  system:
    "你是回应策略制定员（分类→策略映射表）：\n" +
    "Major → Experiment 或 Defend（实质问题不能只澄清，要有行动）；Minor → Accept 或 Clarify；" +
    "Typo → Accept；Misunderstanding → Clarify（礼貌指出误解）。\n" +
    "每条给出 rationale。Experiment 策略意味着要补实验/新数据——超出写作能力，必须升级用户决策。",
});
const strategyDraft = await strategist.ask<{ strategies: StrategyItem[] }>(
  `意见清单：${JSON.stringify(parser.comments)}\n${manuscript !== "" ? `稿件路径：${manuscript}（可 Read 了解稿件现状）\n` : ""}` +
    `${context !== "" ? `背景（可补实验的资源等）：${context}\n` : ""}` +
    `按映射表为每条意见制定策略，返回 strategies 数组。`,
);
let strategies = strategyDraft.strategies;
const experimentItems = strategies.filter((s) => s.strategy === "Experiment");
if (experimentItems.length > 0) {
  const escalated = await strategist.ask<{ strategies: StrategyItem[] }>(
    `以下 ${experimentItems.length} 条意见的策略是 Experiment（需要补实验/新数据），这超出写作能力，必须升级给你确认：\n` +
      `${JSON.stringify(experimentItems)}\n\n` +
      `向用户展示这些意见与所需实验，问清处理方式：列入 experiment-plan 待办 / 改用现有数据补充辩护（降级 Defend/Clarify）/ 标为后续研究（Limitation）。\n` +
      `按用户决定调整策略后返回完整 strategies 数组（结构不变）。`,
  );
  strategies = escalated.strategies;
  log(`补实验升级完成：Experiment 策略 ${strategies.filter((s) => s.strategy === "Experiment").length} 条保留`);
}

phase("并行撰写逐条回应");
const strategyOf = (id: string): StrategyItem | undefined => strategies.find((s) => s.id === id);
const responses: ResponseItem[] = await Promise.all(
  parser.comments.map(async (c) => {
    const st = strategyOf(c.id);
    const r = await agent(`回应撰稿人-${c.id}`, {
      system:
        "你是审稿回应撰稿人：每条回应以感谢审稿人开始；三步结构：关切摘要 → 回应（Defend 必须带证据，Clarify 礼貌指出误解并用 We apologize for the confusion）→ 稿件修改说明（Changes + 位置引用）。\n" +
        "禁语：The reviewer is wrong / This is obvious；保持专业尊重。\n" +
        "证据只用稿件与用户提供的事实；没有的如实说明，不编造。本任务只写稿与汇报，不要在工作区写任何文件。",
    }).ask<ResponseItem>(
      `意见：${JSON.stringify(c)}\n策略：${JSON.stringify(st ?? { strategy: "Clarify", rationale: "未匹配，默认澄清" })}\n` +
        `${manuscript !== "" ? `稿件：Read ${manuscript}（用于定位 Changes 与引用原文）\n` : ""}` +
        `撰写该条的正式回应（英文，投稿信风格），按类型定义返回。`,
    );
    report({ id: r.id, strategy: st?.strategy ?? "Clarify" });
    return r;
  }),
);
log(`逐条回应完成：${responses.length}/${parser.comments.length}`);

phase("语气门与完整性门");
const toneChecker = await agent("语气与完整性检查员", {
  system:
    "你是语气与完整性检查员（两条硬门）：\n" +
    "语气门：每条回应以感谢开始；无防御性/攻击性表达；无禁语（The reviewer is wrong / This is obvious）；Misunderstanding 类用了 We apologize for the confusion。\n" +
    "完整性门：回应条数 = 意见条数（即使 typo 也要确认）。逐条核对，只读不修改。",
}).ask<ToneAudit>(
  `意见清单：${JSON.stringify(parser.comments.map((c) => ({ id: c.id, cls: c.cls })))}\n回应清单：核对以下内容——\n${JSON.stringify(responses)}`,
);
const complete = toneChecker.missingResponses.length === 0 && toneChecker.toneIssues.length === 0;
if (!complete) {
  const fixer = await agent("回应修订员", {
    system: "你是回应修订员：按检查员意见补齐遗漏回应、修正语气问题（直接输出修订后的完整回应集，不落盘）。",
  }).ask<{ responses: ResponseItem[] }>(
    `语气问题：${JSON.stringify(toneChecker.toneIssues)}\n遗漏回应：${JSON.stringify(toneChecker.missingResponses)}\n` +
      `原回应集：${JSON.stringify(responses)}\n意见清单：${JSON.stringify(parser.comments)}\n` +
      `补齐并修正后返回完整 responses 数组（条数必须 = 意见条数）。`,
  );
  responses.length = 0;
  responses.push(...fixer.responses);
  log(`语气/完整性修订完成：${responses.length}/${parser.comments.length}`);
}

phase("组装落盘与交付");
const assembler = await agent("rebuttal 组装人", {
  system:
    "你是 rebuttal 组装人：组装三份产物——\n" +
    "①rebuttal.md：开场感谢（概括主要修改）→ 按审稿人分组逐条（意见原文 + Response + Changes + 位置）→ 主要修改总结；\n" +
    "②review-analysis.md：分类统计表 + 策略说明 + 遗留点（未完全解决的如实标注）；\n" +
    "③experiment-plan.md（仅当存在 Experiment 策略）：每项 目的/方法/预期结果/优先级/时间估计。\n" +
    "回应正文只做格式组装不改写。",
}).ask<SavedRebuttal>(
  `分类：${JSON.stringify(parser.comments)}\n策略：${JSON.stringify(strategies)}\n回应集：${JSON.stringify(responses)}\n` +
    `${manuscript !== "" ? `稿件：${manuscript}\n` : ""}` +
    `写入工作区。${saveRule}\n返回三份产物的实际路径（experimentPlanPath 无 Experiment 策略时为空字符串）。`,
);
log(`rebuttal 已落盘：${assembler.rebuttalPath}`);

try {
  await artifact.file("rebuttal", assembler.rebuttalPath, {
    title: `审稿回复（${parser.comments.length} 条意见）`,
    description: `分类：Major ${parser.comments.filter((c) => c.cls === "Major").length} / Minor ${parser.comments.filter((c) => c.cls === "Minor").length} / Typo ${parser.comments.filter((c) => c.cls === "Typo").length} / 误解 ${parser.comments.filter((c) => c.cls === "Misunderstanding").length}`,
    primary: true,
  });
} catch {
  log(`rebuttal 已在工作区 ${assembler.rebuttalPath}，但发布预览卡片失败。`);
}

const experimentFindings: RebuttalFinding[] = strategies
  .filter((s) => s.strategy === "Experiment")
  .map((s) => ({
    where: "Experiment 策略（需补实验）",
    what: `${s.id}：${s.experimentNeeded}`,
    evidence: "见 experiment-plan.md",
    status: "unconfirmed",
  }));

return {
  conclusion:
    `审稿回复完成：${parser.comments.length} 条意见全部回应（Major ${parser.comments.filter((c) => c.cls === "Major").length} 条，` +
    `其中 ${strategies.filter((s) => s.strategy === "Experiment").length} 条需补实验已升级给你决策），` +
    `rebuttal 在 ${assembler.rebuttalPath}${assembler.experimentPlanPath !== "" ? `，补实验计划在 ${assembler.experimentPlanPath}` : ""}。`,
  findings: experimentFindings,
  verified: [
    "完整性门：回应条数 = 意见条数（逐条核对，typo 也确认）",
    "语气门：感谢开头/无禁语/Misunderstanding 礼貌澄清，未过已重写",
    "分类策略：Major→Experiment/Defend、Minor→Accept/Clarify、Typo→Accept、误解→Clarify",
    `产物已落盘：${assembler.rebuttalPath}${assembler.analysisPath !== "" ? ` + ${assembler.analysisPath}` : ""}`,
  ],
  notCovered: [
    "回应有效性未经真实审稿人确认",
    "Defend 类回应的证据来自稿件与用户事实，未做文献级核验",
  ],
};