/* zcode-workflow
description: 统计分析动态工作流：访谈弄清设计 → 数据盘点 → 统计方案与 R 脚本生成 → 确定性执行（world.run 门控，失败自动修复
  ≤2 轮）→ 报告（效应量/CI/精确 p）+ 统计复审。产物自包含于 03_analysis/adhoc/{slug}/。
args:
  context:
    type: string
    description: 可选。分组定义、配对结构、样本量、批次、预期输出等；给足则跳过访谈直接开工
    default: ""
  data:
    type: string
    description: 数据文件路径（workspace 相对，csv/tsv/xlsx）
    required: true
  question:
    type: string
    description: 分析问题（如：A/B 两组的 X 是否有差异？关联/生存/预测均可）
    required: true
*/
// research-analyze — 统计分析动态工作流：
// 分析访谈 → 数据盘点 → 统计方案与 R 脚本 → 确定性执行（world.run 门控 + ≤2 轮自动修复）→ 结果报告 → 统计复审。
// 质量红线：报告精确 p 值 + 效应量 + 95%CI；技术重复不得计入 n；禁止选择性剔除样本。

interface AnalysisBrief {
  /** 分析问题（与传入一致或澄清后的精确表述） */
  question: string;
  /** 设计要点：分组定义、配对与否、样本量（生物学重复）、批次 */
  design: string;
  /** 主要结局/读出变量 */
  outcomes: string;
  /** 用户强调的约束（如必须用的方法、排除规则） */
  constraints: string;
}

interface DataProfile {
  /** 数据文件路径 */
  file: string;
  /** 行数（样本量，按生物学重复口径） */
  nRows: number;
  /** 列清单：名称/类型/备注 */
  columns: { name: string; type: string; note: string }[];
  /** 实际发现的分组及各组 n */
  groupsFound: string;
  /** 缺失情况摘要 */
  missingness: string;
  /** 数据质量问题（异常值/量纲/分组不匹配等），没有则为空字符串 */
  sanityNotes: string;
}

interface ScriptPlan {
  /** R 脚本写入的工作区相对路径 */
  scriptPath: string;
  /** 输出目录（results 子目录含图与汇总表） */
  outDir: string;
  /** 统计方法一句话摘要（写进报告的方法依据） */
  methodsSummary: string;
}

/** world.run 的返回（本地别名） */
interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface AnalysisReport {
  /** 统计报告写入的工作区相对路径 */
  reportPath: string;
  /** 产出图表路径列表 */
  figures: string[];
  /** 主要统计结果 */
  keyResults: { comparison: string; effect: string; ci: string; p: string; n: string }[];
  /** 局限与注意 */
  caveats: string[];
}

interface ReviewIssues {
  /** 统计审稿问题 ≤3 条：方法误用 / 过度解读 / 结果与图不一致 */
  issues: string[];
}

interface ResultFinding {
  /** 主要结果 */
  where: string;
  /** 比较 + 效应量 + CI + 精确 p + n */
  what: string;
  /** 支撑：报告与结果文件路径 */
  evidence: string;
  /** 由实际执行的 R 脚本产出 */
  status: "verified" | "unconfirmed";
}

const data = String(args.data ?? "").trim();
if (data === "") {
  throw new Error("缺少数据路径：请以 args.data 传入。");
}
const question = String(args.question ?? "").trim();
if (question === "") {
  throw new Error("缺少分析问题：请以 args.question 传入。");
}
const context = String(args.context ?? "").trim();

phase("分析访谈：弄清设计与问题");
const intake = agent("需求访谈员", {
  system:
    "你是统计分析师开题面谈：动工前必须弄清实验设计（分组/配对/样本量口径），" +
    "设计不清时向用户追问一次，不猜设计。",
});
const brief = await intake.ask<AnalysisBrief>(
  `分析问题：${question}\n数据文件：${data}。${context !== "" ? `用户背景：${context}。` : "设计信息未提供。"}` +
    `\n\n整理成分析简报；分组/配对/样本量口径不清就向用户追问。`,
);
log(`分析简报就绪：${brief.question}`);

phase("数据盘点");
const profile = await agent("数据管理员", {
  system:
    "你是数据管理员：只读检查数据文件（Read / 命令行查看），不修改数据。" +
    "如实报告结构、缺失与质量问题，发现问题不隐瞒。",
}).ask<DataProfile>(
  `检查数据文件 ${data}：列名与类型、行数、分组列与各组 n、缺失情况、明显异常（量纲/重复行/编码问题）。\n` +
    `注意区分生物学重复与技术重复——如发现可疑的重复测量结构，在 sanityNotes 里指出。`,
);
log(`数据盘点完成：${profile.nRows} 行，${profile.columns.length} 列${profile.sanityNotes !== "" ? "（有质量提示）" : ""}`);

phase("统计方案与 R 脚本生成");
const analyst = agent("统计分析师", {
  system:
    "你是统计分析师：方法选择有依据（数据类型/分布/设计），" +
    "报告精确 p 值、效应量与 95%CI；技术重复先取均值再进统计；" +
    "图上叠加散点显示每个生物学重复；坐标不从非零截断。" +
    "数据文件只读，一切产物写入指定输出目录。",
});
const plan = await analyst.ask<ScriptPlan>(
  `分析问题：${brief.question}\n设计简报：${JSON.stringify(brief)}\n数据概况：${JSON.stringify(profile)}\n\n` +
    `任务：\n` +
    `1. 选定统计方法并写明依据（比较类型/分布处理/多重比较校正），记入 methodsSummary。\n` +
    `2. 编写完整 R 脚本：统计检验 + 图（带散点的箱线图/相应图型，PNG+PDF 双写）+ results.csv 汇总表（comparison/effect/CI/p/n）；console 打印关键结果。\n` +
    `3. 脚本与输出目录：03_analysis/adhoc/{简短slug}/{scripts,results}/（不存在则创建；数据文件 ${data} 只读引用）。\n` +
    `4. 把脚本写入工作区，返回 scriptPath 与 outDir。`,
);

phase("执行 R 脚本并修复至通过");
let run: RunResult;
try {
  run = await world.run("Rscript", [plan.scriptPath], { timeoutMs: 600_000 });
} catch {
  run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [plan.scriptPath], { timeoutMs: 600_000 });
}
let attempts = 0;
while (run.exitCode !== 0 && attempts < 2) {
  attempts += 1;
  log(`脚本执行失败，进行第 ${attempts} 轮修复`);
  await analyst.ask(
    `R 脚本执行失败（第 ${attempts} 轮修复）。stderr 摘要：\n${run.stderr.slice(0, 4000)}\n` +
      `请修复脚本并写回原路径 ${plan.scriptPath}，不要改输出目录与数据文件。`,
  );
  try {
    run = await world.run("Rscript", [plan.scriptPath], { timeoutMs: 600_000 });
  } catch {
    run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [plan.scriptPath], { timeoutMs: 600_000 });
  }
}
if (run.exitCode !== 0) {
  return {
    conclusion: `R 脚本两轮自动修复后仍执行失败，未产出统计结果。脚本在 ${plan.scriptPath}，最后错误：${run.stderr.slice(0, 300)}`,
    findings: [],
    verified: ["数据盘点完成，脚本与输出目录已生成"],
    notCovered: ["统计执行与报告全部未完成——请人工查看 stderr 后重跑"],
  };
}
log(`脚本执行成功（修复 ${attempts} 轮）`);

phase("结果报告与统计复审");
const report = await analyst.ask<AnalysisReport>(
  `脚本执行成功。阅读 ${plan.outDir}/results/ 下的输出，撰写统计报告并写入 ${plan.outDir}/results/report.md：\n` +
    `结构：分析问题 → 数据概况 → 方法与依据（${plan.methodsSummary}）→ 结果（每项比较：效应量 + 95%CI + 精确 p + n，引用图表编号）→ 局限。\n` +
    `脚本 console 输出摘要：\n${run.stdout.slice(0, 6000)}\n` +
    `返回 reportPath、figures 列表、keyResults、caveats。`,
);
const reviewer = agent("统计审稿人", {
  system:
    "你是统计审稿人：只依据报告与结果文件判断，不重跑分析、不修改文件。" +
    "只提最要害的问题（最多 3 条）：方法误用、过度解读、结果与图不一致。不夸奖。",
});
const critique = await reviewer.ask<ReviewIssues>(
  `先 Read ${report.reportPath}（必要时查看 ${plan.outDir}/results/ 下的图与汇总表），挑出最多 3 条最要害的问题；没有就返回空数组。`,
);
let reportPath = report.reportPath;
if (critique.issues.length > 0) {
  await analyst.ask(
    `统计审稿人读了 ${reportPath} 提出以下意见：${JSON.stringify(critique.issues)}\n` +
      `请逐条修订报告文件（若涉及计算错误则改脚本重跑并同步更新报告），完成后只返回实际报告路径。`,
  );
  log(`按统计审稿意见修订了报告。`);
} else {
  log("统计复审未发现问题。");
}

try {
  await artifact.file("report", reportPath, {
    title: `统计分析报告：${question}`,
    description: plan.methodsSummary,
    primary: true,
  });
} catch {
  log(`报告已在工作区 ${reportPath}，但发布预览卡片失败。`);
}

const resultFindings: ResultFinding[] = report.keyResults.map((r) => ({
  where: "主要结果",
  what: `${r.comparison}：效应 ${r.effect}，95%CI ${r.ci}，p=${r.p}（n=${r.n}）`,
  evidence: `见 ${reportPath} 与 ${plan.outDir}/results/`,
  status: "verified",
}));

return {
  conclusion:
    `「${brief.question}」的统计分析完成（脚本执行通过${attempts > 0 ? `，自动修复 ${attempts} 轮` : ""}），` +
    `报告在 ${reportPath}，图表与结果表在 ${plan.outDir}/results/。`,
  findings: resultFindings,
  verified: [
    "R 脚本由工作流确定性执行（world.run 门控，退出码 0）",
    "报告经统计审稿人独立复审",
    `全部产物自包含于 ${plan.outDir}/`,
  ],
  notCovered: [
    "未做生物学解读（那是 interpret 阶段的事）",
    "统计方法基于摘要级数据盘点，如原始设计有未提供的结构（批次/配对）请告知重跑",
  ],
};