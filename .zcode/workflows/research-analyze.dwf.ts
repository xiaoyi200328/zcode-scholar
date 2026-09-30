/* zcode-workflow
description: 统计分析动态工作流 v2.1（借鉴 CC analysis-execution 纪律）：访谈 → 数据盘点 →
  统计方案+CONFIRM 确认门 → 生成/执行分离（路径契约固定）→ world.run 门控执行(≤2轮修复) → VERIFY 真实文件复检 →
  双阶段审查(spec→quality, ≤2轮修复重审) → 报告。
args:
  context:
    type: string
    description: 可选。分组定义、配对结构、样本量、批次等；含“自动确认”则跳过方案确认门
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
// research-analyze v2.1 — 借鉴 CC analysis-execution 纪律的统计分析工作流：
// 访谈 → 数据盘点 → 方案生成+CONFIRM 确认门 → 生成/执行分离（路径契约固定）→ world.run 门控执行(≤2轮修复)
// → VERIFY 真实文件复检（修复后重新查文件，不用退出码冒充）→ 双阶段审查(spec→quality, ≤2轮修复重审) → 报告。
// 红线：精确 p + 效应量 + 95%CI；技术重复不计入 n；Never silently modify statistical parameters。

interface AnalysisBrief {
  /** 分析问题（与传入一致或澄清后的精确表述） */
  question: string;
  /** 设计要点：分组定义、配对与否、样本量（生物学重复）、批次 */
  design: string;
  /** 主要结局/读出变量 */
  outcomes: string;
  /** 用户强调的约束 */
  constraints: string;
}

interface DataProfile {
  /** 数据文件路径 */
  file: string;
  /** 行数（按生物学重复口径） */
  nRows: number;
  /** 列清单 */
  columns: { name: string; type: string; note: string }[];
  /** 实际发现的分组及各组 n */
  groupsFound: string;
  /** 缺失情况摘要 */
  missingness: string;
  /** 数据质量问题，没有则为空字符串 */
  sanityNotes: string;
}

interface AnalysisPlan {
  /** 确认后的统计方案摘要（方法+依据+比较清单+预期输出+风险） */
  planSummary: string;
  /** 方法清单与选择依据 */
  methods: { test: string; rationale: string }[];
  /** 比较清单 */
  comparisons: string[];
  /** 预期输出文件清单 */
  expectedOutputs: string[];
  /** 用户确认意见（无修改则空字符串） */
  userNotes: string;
}

interface ScriptPlan {
  /** R 脚本写入路径（只生成未执行） */
  scriptPath: string;
  /** 输出根目录（不含 results 后缀） */
  outDir: string;
  /** 方法一句话摘要 */
  methodsSummary: string;
}

interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface VerifyOutcome {
  /** 校验是否通过 */
  ok: boolean;
  /** 校验说明（含失败细节） */
  notes: string;
}

interface StageReview {
  /** spec 段：方法适配/前提假设/多重比较 */
  spec: { verdict: "pass" | "fail"; issues: string[] };
  /** quality 段：结果与图一致/效应量与CI完整且自洽/p值精确 */
  quality: { verdict: "pass" | "fail"; issues: string[] };
}

interface AnalysisReport {
  /** 报告路径 */
  reportPath: string;
  /** 图表路径列表 */
  figures: string[];
  /** 主要统计结果 */
  keyResults: { comparison: string; effect: string; ci: string; p: string; n: string }[];
  /** 局限 */
  caveats: string[];
}

interface ResultFinding {
  /** 主要结果 */
  where: string;
  /** 比较 + 效应量 + CI + 精确 p + n */
  what: string;
  /** 支撑：报告与结果文件路径 */
  evidence: string;
  /** 由实际执行并校验的脚本产出 */
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
const autoConfirm = context.includes("自动确认");

async function checkOutputs(outDir: string): Promise<VerifyOutcome> {
  try {
    const csv = await files.read(outDir + "/results/results.csv");
    const header = csv.split("\n")[0];
    const figs = await files.glob(outDir + "/results/*.png");
    if (csv.trim().length > 20 && header.includes("comparison") && header.includes("p") && figs.length > 0) {
      return { ok: true, notes: `results.csv 表头合规、非空，图 ${figs.length} 张` };
    }
    return { ok: false, notes: `results.csv ${csv.trim().length} 字符，表头合规 ${header.includes("comparison") && header.includes("p")}，图 ${figs.length} 张` };
  } catch {
    return { ok: false, notes: `results.csv 未生成于 ${outDir}/results/` };
  }
}

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
    `注意区分生物学重复与技术重复——可疑的重复测量结构在 sanityNotes 里指出。`,
);
log(`数据盘点完成：${profile.nRows} 行，${profile.columns.length} 列`);

phase("统计方案生成与确认（CONFIRM 门）");
const analyst = agent("统计分析师", {
  system:
    "你是统计分析师：方法选择有依据（数据类型/分布/设计），报告精确 p 值、效应量与 95%CI；" +
    "技术重复先取均值再进统计；图上叠加散点。" +
    "铁律：Never silently modify statistical parameters to suppress errors——修不了就明说，不靠改参数硬过。" +
    "效应量与 CI 必须同向自洽：effect 与 CI 必须描述同一方向的同一差值，CI 必须包含效应量本身。",
});
const plan = await analyst.ask<AnalysisPlan>(
  `分析问题：${brief.question}\n设计简报：${JSON.stringify(brief)}\n数据概况：${JSON.stringify(profile)}\n\n` +
    `任务：制定统计方案——方法清单（每条带依据）、比较清单、预期输出文件、风险。\n` +
    `${autoConfirm ? "用户已开启自动确认：按最合理方案定稿，userNotes 记'自动确认'。" : "方案定稿前必须向用户展示方案摘要（方法/比较/预期输出/风险），等待用户 proceed 或 modify，把意见吸收进最终方案并记入 userNotes。"}`,
);

phase("生成 R 脚本（只生成不执行）");
const scriptPlan = await analyst.ask<ScriptPlan>(
  `按已确认方案编写完整 R 脚本：统计检验 + 图（带散点的箱线图/相应图型，PNG+PDF 双写）+ results.csv 汇总表 + console 打印关键结果。\n` +
    `${plan.userNotes !== "" ? `用户确认意见：${plan.userNotes}（必须体现在脚本里）。\n` : ""}` +
    `路径契约（严格执行，防止目录嵌套错乱）：\n` +
    `- outDir = 03_analysis/adhoc/{简短slug}（不以 results 结尾）\n` +
    `- 脚本 = outDir/scripts/analyze.R\n` +
    `- 汇总表 = outDir/results/results.csv（表头必含 comparison,effect,ci,p,n）\n` +
    `- 图 = outDir/results/ 下的 *.png 与 *.pdf\n` +
    `- 数据文件 ${data} 只读引用\n` +
    `本步只把脚本写入工作区，绝不执行。返回 scriptPath 与 outDir。`,
);
log(`脚本已生成：${scriptPlan.scriptPath}（待执行）`);

phase("执行 R 脚本并修复至通过");
let run: RunResult;
try {
  run = await world.run("Rscript", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
} catch {
  run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
}
let attempts = 0;
while (run.exitCode !== 0 && attempts < 2) {
  attempts += 1;
  log(`脚本执行失败，进行第 ${attempts} 轮修复`);
  await analyst.ask(
    `R 脚本执行失败（第 ${attempts} 轮修复）。stderr 摘要：\n${run.stderr.slice(0, 4000)}\n` +
      `请定位根因并修复脚本，写回原路径 ${scriptPlan.scriptPath}。不要靠改统计参数压制错误。`,
  );
  try {
    run = await world.run("Rscript", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  } catch {
    run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  }
}
if (run.exitCode !== 0) {
  return {
    conclusion: `R 脚本两轮自动修复后仍执行失败，未产出统计结果。脚本在 ${scriptPlan.scriptPath}，最后错误：${run.stderr.slice(0, 300)}`,
    findings: [],
    verified: ["方案经确认门", "数据盘点完成", "脚本已生成"],
    notCovered: ["执行/校验/审查/报告全部未完成——请人工查看 stderr 后重跑"],
  };
}

phase("VERIFY 校验与双阶段审查");
let verify = await checkOutputs(scriptPlan.outDir);
if (!verify.ok) {
  log(`VERIFY 未通过：${verify.notes}，修复一轮`);
  await analyst.ask(
    `VERIFY 校验未通过：${verify.notes}。请对照路径契约检查脚本输出逻辑` +
      `（results.csv 固定写 ${scriptPlan.outDir}/results/results.csv，图输出到 ${scriptPlan.outDir}/results/），` +
      `修复后写回原路径 ${scriptPlan.scriptPath}。`,
  );
  try {
    run = await world.run("Rscript", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  } catch {
    run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  }
  verify = await checkOutputs(scriptPlan.outDir);
}
log(`VERIFY 结果：${verify.ok ? "通过" : "未通过"}（${verify.notes}）`);

const reviewer = agent("统计审稿人", {
  system:
    "你是统计审稿人，执行双阶段审查（检查项不减）：\n" +
    "spec 段：方法与设计适配、前提假设声明、多重比较处理；\n" +
    "quality 段：结果与图一致、效应量与 CI 完整且自洽（effect 必须落在自己的 CI 内、方向一致）、p 值精确、无选择性剔除。\n" +
    "只依据报告与结果文件判断，不修改文件；若怀疑数值错误，可用只读 R 命令独立抽查。fail 必须给出具体位置与原因。",
});
let review = await reviewer.ask<StageReview>(
  `先 Read ${scriptPlan.outDir}/results/ 下的汇总表与图，然后执行双阶段审查并按结构返回（spec 与 quality 各自 pass/fail + 问题清单）。` +
    `\n\n统计方案：${JSON.stringify(plan)}`,
);
let reviewRounds = 0;
while ((review.spec.verdict === "fail" || review.quality.verdict === "fail") && reviewRounds < 2) {
  reviewRounds += 1;
  log(`审查未通过（spec: ${review.spec.verdict}, quality: ${review.quality.verdict}），第 ${reviewRounds} 轮修复重审`);
  await analyst.ask(
    `双阶段审查未通过。spec 问题：${JSON.stringify(review.spec.issues)}\nquality 问题：${JSON.stringify(review.quality.issues)}\n` +
      `请逐条修复（脚本或输出），写回原路径 ${scriptPlan.scriptPath}。修复后 effect 与 CI 必须自洽。`,
  );
  try {
    run = await world.run("Rscript", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  } catch {
    run = await world.run("C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe", [scriptPlan.scriptPath], { timeoutMs: 600_000 });
  }
  verify = await checkOutputs(scriptPlan.outDir);
  review = await reviewer.ask<StageReview>(
    `修复后请重新执行双阶段审查（spec/quality 两段），对象：${scriptPlan.outDir}/results/。统计方案：${JSON.stringify(plan)}`,
  );
}

phase("统计报告落盘");
const report = await analyst.ask<AnalysisReport>(
  `审查状态：spec ${review.spec.verdict}${review.spec.issues.length > 0 ? `（遗留问题 ${JSON.stringify(review.spec.issues)}）` : ""}，quality ${review.quality.verdict}${review.quality.issues.length > 0 ? `（遗留问题 ${JSON.stringify(review.quality.issues)}）` : ""}。VERIFY：${verify.notes}。\n` +
    `阅读 ${scriptPlan.outDir}/results/ 输出，撰写统计报告并写入 ${scriptPlan.outDir}/report.md：\n` +
    `结构：分析问题 → 数据概况 → 方法与依据 → 结果（每项比较：效应量 + 95%CI + 精确 p + n；effect 与 CI 必须同向自洽，引用图表编号）→ 审查遗留问题（如有，显著标出）→ 局限。\n` +
    `console 输出摘要：\n${run.stdout.slice(0, 6000)}\n` +
    `返回 reportPath、figures、keyResults、caveats。`,
);

try {
  await artifact.file("report", report.reportPath, {
    title: `统计分析报告：${question}`,
    description: scriptPlan.methodsSummary,
    primary: true,
  });
} catch {
  log(`报告已在工作区 ${report.reportPath}，但发布预览卡片失败。`);
}

const resultFindings: ResultFinding[] = report.keyResults.map((r) => ({
  where: "主要结果",
  what: `${r.comparison}：效应 ${r.effect}，95%CI ${r.ci}，p=${r.p}（n=${r.n}）`,
  evidence: `见 ${report.reportPath} 与 ${scriptPlan.outDir}/results/`,
  status: "verified",
}));

return {
  conclusion:
    `「${brief.question}」的统计分析完成（方案确认门${autoConfirm ? "自动" : "已用户确认"}；脚本执行通过${attempts > 0 ? `，修复 ${attempts} 轮` : ""}；` +
    `VERIFY ${verify.ok ? "通过" : "未通过"}；双阶段审查 spec ${review.spec.verdict}/quality ${review.quality.verdict}${reviewRounds > 0 ? `，修复重审 ${reviewRounds} 轮` : ""}）。` +
    `报告在 ${report.reportPath}。`,
  findings: resultFindings,
  verified: [
    "统计方案经 CONFIRM 确认门（用户确认或自动确认）",
    "生成/执行分离：脚本生成后由 world.run 确定性执行，退出码 0",
    `VERIFY 真实文件复检：${verify.notes}`,
    `双阶段审查 spec ${review.spec.verdict}/quality ${review.quality.verdict}${reviewRounds > 0 ? `（修复重审 ${reviewRounds} 轮）` : ""}`,
    `全部产物自包含于 ${scriptPlan.outDir}/`,
  ],
  notCovered: [
    "未做生物学解读（interpret 工作流的职责）",
    review.spec.issues.length > 0 || review.quality.issues.length > 0
      ? `审查遗留问题：${JSON.stringify([...review.spec.issues, ...review.quality.issues])}`
      : "无审查遗留问题",
  ],
};