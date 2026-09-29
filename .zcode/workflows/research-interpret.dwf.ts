/* zcode-workflow
description: 结果解读动态工作流（借鉴 CC results-report 决策对象 + analysis-reflection
  决策矩阵）：访谈锁假说参照 → 统计复核 + 生物学意义（机制链+≥2替代解释）→
  文献对照（consistent/extends/novel/contradicts）→ 决策矩阵强制选一 → 强命名报告落盘（含 What Changed
  Our Belief）→ 复审。
args:
  context:
    type: string
    description: 可选。数据来源、样本背景、已知问题等
    default: ""
  hypothesis:
    type: string
    description: 假说参照（一句话或设计文档路径）；不提供则访谈时向你收集——没有假说参照的解读是自由发挥
    default: ""
  report:
    type: string
    description: 统计报告或分析产物路径（workspace 相对）
    required: true
*/
// research-interpret — 结果解读动态工作流（借鉴 CC results-report + analysis-reflection 决策矩阵）：
// 访谈锁假说参照 → 统计复核 + 生物学意义（机制链 + ≥2 替代解释）→ 文献对照（consistent/extends/novel/contradicts）
// → 决策矩阵强制选一（禁止"需进一步研究"式空话结尾）→ 强命名报告落盘（含 What Changed Our Belief）→ 复审。

interface InterpretBrief {
  /** 解读对象：报告/产物路径清单 */
  sources: string;
  /** 假说参照（一句话或设计文档路径） */
  hypothesis: string;
  /** 数据来源与样本背景 */
  background: string;
  /** 用户已知的问题或关注点 */
  concerns: string;
}

interface ClaimVerdict {
  /** 原报告中的统计论断 */
  claim: string;
  /** 复核判定：支持 / 弱证据 / 方向相反 / 未校正 / 无法判断 */
  verdict: "支持" | "弱证据" | "方向相反" | "未校正" | "无法判断";
  /** 复核依据：效应量 vs 显著性/方向/校正方法 */
  note: string;
}

interface InterpretationCore {
  /** 逐条统计复核 */
  claims: ClaimVerdict[];
  /** 机制解释链：X→Y→Z 每一环标注有数据证据还是推测 */
  mechanism: string;
  /** 至少 2 个替代解释（混杂/偏倚/实验假象）及现有数据能否排除 */
  alternatives: string[];
}

interface LitComparison {
  /** 对应的论断 */
  claim: string;
  /** 文献对照状态 */
  status: "consistent" | "extends" | "novel" | "contradicts";
  /** 证据：一致/矛盾的文献（作者年份+标识符）与说明 */
  evidence: string;
}

interface DecisionReport {
  /** 报告写入路径 */
  path: string;
  /** 决策矩阵六情形选一：可发表 / 待补强 / 科学信号 / 不可解读 / 可深化 / 阴性结果报告 */
  decision: string;
  /** 决策理由（对应证据） */
  rationale: string;
  /** 下一步动作（具体、可执行） */
  nextActions: string[];
  /** What Changed Our Belief（一句话：这轮解读改变了什么认知） */
  beliefChange: string;
}

interface ReviewIssues {
  /** 复审问题 ≤2 条：过度解读 / 文献对照失实 / 决策与证据不匹配 */
  issues: string[];
}

interface InterpretFinding {
  /** 来源：统计复核或文献对照 */
  where: string;
  /** 内容 */
  what: string;
  /** 支撑：报告对应节 */
  evidence: string;
  /** 统计复核有报告为证；文献对照未经全文核验 */
  status: "verified" | "unconfirmed";
}

const report = String(args.report ?? "").trim();
if (report === "") {
  throw new Error("缺少解读对象：请以 args.report 传入统计报告/产物路径。");
}
const argHypothesis = String(args.hypothesis ?? "").trim();
const context = String(args.context ?? "").trim();

const reportFiles = await files.glob("Research/*/Results/Reports/*.md");
const projects = [...new Set(reportFiles.map((p) => p.split("/")[1]).filter((s) => s !== ""))];
const saveRule =
  projects.length > 0
    ? `已有课题：Research/{${projects.join(", ")}}。与数据来源明显匹配的写入其 Results/Reports/（目录不存在则创建）；否则新建 Research/{简短英文slug}/Results/Reports/ 写入。`
    : "写入根目录 Results/Reports/（不存在则创建）。";
const fileRule = `文件名 {YYYY-MM-DD}--{简短slug}--interpret.md（强命名规范，日期用今天，可用 date 命令查询）。${saveRule}`;

phase("需求访谈：锁定假说参照");
const intake = agent("需求访谈员", {
  system:
    "你是结果解读面谈：铁律是'没有假说参照的解读是自由发挥'——动工前必须锁定假说或设计文档。" +
    "假说参照缺失时向用户追问一次；用户背景足够时直接整理。",
});
const brief = await intake.ask<InterpretBrief>(
  `解读对象：${report}。${argHypothesis !== "" ? `假说参照：${argHypothesis}。` : "假说参照未提供——必须向用户问清（一句话假说或设计文档路径）。"}` +
    `${context !== "" ? `补充背景：${context}。` : ""}` +
    `\n\n整理成解读简报；同时核对解读对象文件是否存在。`,
);
log(`解读简报就绪：假说 = ${brief.hypothesis}`);

phase("统计复核与生物学意义");
const interpreter = await agent("结果解读者", {
  system:
    "你是结果解读者（借鉴 results-report 的纪律）：统计复核逐条对照效应量与显著性，" +
    "显著不等于重要；机制解释链每一环标注'有数据证据'还是'推测'；" +
    "强迫列出至少 2 个替代解释（混杂/偏倚/实验假象——抗体特异性、gating 漂移、批次等）并说明现有数据能否排除。" +
    "只依据报告与产物文件判断，不修改它们。",
}).ask<InterpretationCore>(
  `假说参照：${brief.hypothesis}\n解读对象：${report}（先 Read，必要时读其引用的产物文件）\n背景：${brief.background}\n` +
    `已知关注点：${brief.concerns !== "" ? brief.concerns : "无"}\n\n` +
    `任务：\n` +
    `1. 逐条复核统计论断（claims：verdict 五选一 + 依据）——显著≠重要，方向相反的显著是发现不是支持，未校正的多组比较降级为探索性。\n` +
    `2. 机制解释链（与假说对照：支持/部分支持/推翻，每一环标注证据状态）。\n` +
    `3. 至少 2 个替代解释及排除可能性。`,
);
log(`统计复核完成：${interpreter.claims.filter((c) => c.verdict !== "支持").length} 条论断未获完全支持`);

phase("文献对照");
const litChecker = await agent("文献对照员", {
  system:
    "你是文献对照员：快速检索验证每条主要论断在文献中的位置，" +
    "标注 consistent / extends / novel / contradicts 四态；矛盾不回避，列出可能解释。" +
    "检索预算（搜索+核验合计）不超过 4 次网络调用；找到的文献带标识符；找不到对照就标 novel 并注明检索词，不编造。" +
    "本任务只检索与汇报，不要在工作区写任何文件。",
}).ask<{ comparisons: LitComparison[] }>(
  `解读核心：${JSON.stringify(interpreter)}\n主题背景：${brief.background}\n\n` +
    `对主要论断（claims 中 verdict 为 支持/方向相反 的，以及机制链关键环节）做文献对照，返回 comparisons 数组。`,
);
log(`文献对照完成：${litChecker.comparisons.length} 条`);

phase("决策矩阵与报告落盘");
const reporter = agent("解读报告撰写人", {
  system:
    "你是解读报告撰写人（借鉴 results-report 决策对象契约）：\n" +
    "决策矩阵六情形强制选一：可发表 / 待补强 / 科学信号（矛盾或推翻）/ 不可解读（统计可疑）/ 可深化（机制黑箱）/ 阴性结果报告。\n" +
    "报告必须以明确的下一步动作结尾，禁止'需要进一步研究'式空话；\n" +
    "含 What Changed Our Belief 一段（这轮解读改变了什么认知）。",
});
const final = await reporter.ask<DecisionReport>(
  `假说：${brief.hypothesis}\n统计复核与生物学意义：${JSON.stringify(interpreter)}\n文献对照：${JSON.stringify(litChecker.comparisons)}\n\n` +
    `任务：\n` +
    `1. 依决策矩阵六情形强制选定 decision，rationale 对应证据。\n` +
    `2. 撰写报告并写入工作区，结构：结论一句话 → 统计复核表 → 机制链与替代解释 → 文献对照表（四态标注）→ What Changed Our Belief → 决策与下一步动作 → 局限。\n` +
    `3. 文献对照的 contradictory/novel 项必须在报告中显著标出。\n` +
    `${fileRule}\n返回 path、decision、rationale、nextActions、beliefChange。`,
);
log(`解读报告已写入 ${final.path}，决策：${final.decision}`);

const reviewer = agent("解读复审人", {
  system:
    "你是解读复审人：只依据报告与被解读的原始报告判断，不检索、不修改文件。" +
    "只提最要害的问题（最多 2 条）：过度解读、文献对照失实、决策与证据不匹配。不夸奖。",
});
const critique = await reviewer.ask<ReviewIssues>(
  `先 Read ${final.path}（对照原始报告 ${report}），挑出最多 2 条最要害的问题；没有就返回空数组。`,
);
if (critique.issues.length > 0) {
  await reporter.ask(
    `解读复审人提出以下意见：${JSON.stringify(critique.issues)}\n请逐条修订报告文件（直接编辑写入），完成后只返回实际路径。`,
  );
  log(`按复审意见修订了报告。`);
} else {
  log("复审未发现问题。");
}

try {
  await artifact.file("interpret", final.path, {
    title: `结果解读：${brief.hypothesis.slice(0, 40)}`,
    description: `决策：${final.decision}`,
    primary: true,
  });
} catch {
  log(`报告已在工作区 ${final.path}，但发布预览卡片失败。`);
}

const statFlags: InterpretFinding[] = interpreter.claims
  .filter((c) => c.verdict === "弱证据" || c.verdict === "方向相反" || c.verdict === "未校正")
  .map((c) => ({
    where: "统计复核",
    what: `${c.claim} —— ${c.verdict}：${c.note}`,
    evidence: `见解读报告统计复核表`,
    status: "verified" as const,
  }));
const litFlags: InterpretFinding[] = litChecker.comparisons
  .filter((c) => c.status === "contradicts" || c.status === "novel")
  .map((c) => ({
    where: `文献对照（${c.status}）`,
    what: `${c.claim} —— ${c.evidence}`,
    evidence: `见解读报告文献对照表（未逐篇全文核验）`,
    status: "unconfirmed" as const,
  }));

return {
  conclusion:
    `「${brief.hypothesis.slice(0, 50)}」的结果解读完成：${interpreter.claims.length} 条论断复核、${litChecker.comparisons.length} 条文献对照，` +
    `决策【${final.decision}】。报告在 ${final.path}，下一步：${final.nextActions[0] ?? "见报告"}`,
  findings: statFlags.concat(litFlags),
  verified: [
    "假说参照经访谈锁定（无假说不解读）",
    "统计复核逐条对照效应量与显著性，替代解释 ≥2 个",
    "文献对照四态标注，矛盾与新颖项显著标出",
    "决策矩阵强制选一，报告含 What Changed Our Belief 与具体下一步",
    `报告已落盘：${final.path}`,
  ],
  notCovered: [
    "文献对照仅检索级，未逐篇通读全文",
    "解读基于报告与产物文件，未接触原始数据",
  ],
};