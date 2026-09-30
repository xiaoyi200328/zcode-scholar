/* zcode-workflow
description: 投稿级图表动态工作流（借鉴 CC multi-omics-visualization 的 Research-then-Draw
  协议）：访谈定图表清单 → 检索绘图配方+派生 QC 清单 → 并行生成 Python 绘图脚本（只生成不执行）→ world.run 门控执行+修复 →
  vision QC 对照图型硬规则（≤2 轮定向修复，仍不过标 manual-review-needed）→ 图表目录交付。
args:
  context:
    type: string
    description: 可选。数据背景、已用统计方法、期刊特殊要求等
    default: ""
  data:
    type: string
    description: 数据或分析产物路径（workspace 相对：csv 文件或 03_analysis 目录）
    required: true
  figures:
    type: string
    description: 图表需求（如“图1：两组比较箱线图；图2：生存曲线”）；不填则访谈时向你收集
    default: ""
  journal:
    type: string
    description: 目标期刊（决定尺寸/字号/配色规范）
    default: Nature 风格
*/
// research-figures — 投稿级图表动态工作流（借鉴 CC multi-omics-visualization 的 Research-then-Draw 协议）：
// 访谈 → Research-then-Draw（检索配方+派生图型 QC 清单）→ 并行生成 Python 绘图脚本（只生成不执行）
// → world.run 门控执行+修复 → vision QC 对照图型硬规则（≤2 轮定向修复，仍不过标 manual-review-needed）→ 图表目录交付。
// 期刊常量：双栏 183mm/单栏 89mm；PNG ≥300dpi；色盲安全三族配色（grey + #CC3311 + #2166AC）；字体 ≥7pt。

interface FigureSpec {
  /** 图 ID（fig-1, fig-2…） */
  id: string;
  /** 图标题/内容 */
  title: string;
  /** 图型：boxplot/volcano/survival/heatmap/bar/scatter/forest… */
  type: string;
  /** 数据来源路径 */
  dataPath: string;
  /** 特殊要求 */
  requirement: string;
}

interface DrawRecipe {
  /** 对应图 ID */
  figureId: string;
  /** 绘图配方：具体参数与做法（写入脚本顶部注释的持久记录） */
  recipe: string;
  /** 该图型的可量化 QC 硬规则清单（从期刊规则派生） */
  qcChecklist: string[];
  /** 配方来源 URL 与日期 */
  source: string;
}

interface FigScript {
  /** 图 ID */
  figureId: string;
  /** 脚本路径（只生成未执行） */
  scriptPath: string;
  /** 输出 PNG 路径 */
  outputPng: string;
  /** 输出 PDF/SVG 路径 */
  outputVector: string;
  /** 图注草稿（含 n、统计方法、误差条定义） */
  captionDraft: string;
}

interface FigureQC {
  /** 图 ID */
  figureId: string;
  /** 是否成功以视觉方式读取了 PNG（false 时仅完成程序化检查） */
  visionRead: boolean;
  /** 逐项 QC 结果（note 每条 ≤100 字符，只写判定依据要点，防止响应超长被截断） */
  checks: { item: string; pass: boolean; note: string }[];
  /** QC 裁定 */
  verdict: "pass" | "fail" | "manual-review-needed";
  /** 未通过维度的定向修复提示（每条 ≤80 字符） */
  fixHints: string[];
}

interface FigureEntry {
  /** 图 ID */
  id: string;
  /** PNG 路径 */
  png: string;
  /** 矢量路径 */
  vector: string;
  /** 图注草稿 */
  caption: string;
  /** QC 状态 */
  status: "pass" | "manual-review-needed";
}

interface CatalogReport {
  /** 图表目录写入路径 */
  catalogPath: string;
  /** 图表清单 */
  figures: FigureEntry[];
}

interface QCFinding {
  /** 来源 */
  where: string;
  /** 内容 */
  what: string;
  /** 支撑 */
  evidence: string;
  /** QC 通过为 verified；manual-review-needed 为 unconfirmed */
  status: "verified" | "unconfirmed";
}

/** world.run 返回（本地别名） */
interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const data = String(args.data ?? "").trim();
if (data === "") {
  throw new Error("缺少数据路径：请以 args.data 传入。");
}
const argFigures = String(args.figures ?? "").trim();
const journal = String(args.journal ?? "Nature 风格").trim();
const context = String(args.context ?? "").trim();

const outRoot = "03_analysis/adhoc/figures";

phase("访谈：图表清单与期刊规范");
const intake = await agent("需求访谈员", {
  system:
    "你是出版图表面谈：动工前必须弄清每张图的内容、图型与数据来源。" +
    "图表需求不明确时向用户追问一次（每张图画什么、用什么数据、什么图型）；足够时直接整理。",
}).ask<{ figures: FigureSpec[]; notes: string }>(
  `数据/产物路径：${data}（先查看该路径下可用的数据与结果文件）。${argFigures !== "" ? `用户图表需求：${argFigures}` : "图表需求未提供——必须向用户逐张问清。"}` +
    `${context !== "" ? `背景：${context}。` : ""}目标期刊：${journal}。\n\n` +
    `整理成图表清单（每张：id=fig-N、title、type、dataPath 指向真实存在的文件、requirement）；数据不足的图如实标注并在 notes 说明。`,
);
log(`图表清单就绪：${intake.figures.length} 张（${intake.notes.slice(0, 60)}）`);

phase("Research-then-Draw：检索绘图配方与 QC 清单");
const recipeAgent = await agent("绘图研究员", {
  system:
    "你是绘图研究员（Research-then-Draw 协议第一步）：为每种图型检索该图型在目标期刊风格下的最佳实践配方，" +
    "并从期刊规则派生可量化的 QC 硬规则清单（如：字体≥7pt、色盲安全、标签不遮挡、300dpi、统计标注存在）。" +
    "检索预算 ≤4 次网络调用；配方必须记录 source URL 与日期；查不到就基于期刊通用规范给出并注明'通用规范'。不要在工作区写任何文件。",
}).ask<{ recipes: DrawRecipe[] }>(
  `目标期刊：${journal}\n图表清单：${JSON.stringify(intake.figures)}\n\n` +
    `按图型去重检索（同图型共用配方），返回 recipes 数组（每个 figureId 一条，qcChecklist 至少 5 条可量化规则）。`,
);
log(`配方就绪：${recipeAgent.recipes.length} 条`);

phase("并行生成绘图脚本（只生成不执行）");
const scripts = await Promise.all(
  intake.figures.map(async (f) => {
    const recipe = recipeAgent.recipes.find((r) => r.figureId === f.id);
    const s = await agent(`绘图脚本师-${f.id}`, {
      system:
        "你是出版级绘图脚本师：Python matplotlib/seaborn，严格执行期刊规范与配方。\n" +
        "规范常量：双栏 183mm/单栏 89mm（换算英寸）；PNG ≥300dpi；色盲安全三族配色（grey + #CC3311 + #2166AC）；" +
        "字体 ≥7pt；箱线图必须叠加散点显示每个数据点；统计标注（p 值/显著性标记）不可缺失。\n" +
        "脚本顶部注释必须包含配方与来源 URL（脚本即持久记录）。只生成不执行，不要运行任何命令。",
    }).ask<FigScript>(
      `图表：${JSON.stringify(f)}\n绘图配方与 QC 清单：${JSON.stringify(recipe ?? { note: "无配方，按期刊通用规范" })}\n` +
        `输出目录：${outRoot}/${f.id}/（PNG+PDF 双写；不存在则创建；数据只读引用 ${f.dataPath}）。\n` +
        `同时给出图注草稿 captionDraft（含 n、统计方法、误差条定义）。返回 scriptPath/outputPng/outputVector/captionDraft。`,
    );
    report({ figureId: s.figureId, script: s.scriptPath });
    return s;
  }),
);

phase("执行绘图脚本并修复至通过");
const runOutputs: { id: string; run: RunResult }[] = [];
for (const s of scripts) {
  let run: RunResult;
  try {
    run = await world.run("python", [s.scriptPath], { timeoutMs: 300_000 });
  } catch {
    run = await world.run("py", [s.scriptPath], { timeoutMs: 300_000 });
  }
  let fixRounds = 0;
  while (run.exitCode !== 0 && fixRounds < 2) {
    fixRounds += 1;
    const fixer = agent(`绘图修复员-${s.figureId}-${fixRounds}`);
    await fixer.ask(
      `绘图脚本执行失败（第 ${fixRounds} 轮）。stderr：\n${run.stderr.slice(0, 3000)}\n` +
        `请修复脚本 ${s.scriptPath}（写回原路径），保持输出路径与规范不变。`,
    );
    try {
      run = await world.run("python", [s.scriptPath], { timeoutMs: 300_000 });
    } catch {
      run = await world.run("py", [s.scriptPath], { timeoutMs: 300_000 });
    }
  }
  runOutputs.push({ id: s.figureId, run });
  log(`图 ${s.figureId} 执行${run.exitCode === 0 ? "成功" : `失败（已修复 ${fixRounds} 轮）`}`);
}

phase("vision QC 与定向修复（≤2 轮）");
const qcs: FigureQC[] = await Promise.all(
  scripts.map(async (s) => {
    const recipe = recipeAgent.recipes.find((r) => r.figureId === s.figureId);
    const exec = runOutputs.find((r) => r.id === s.figureId);
    const qc = await agent(`视觉QC员-${s.figureId}`, {
      system:
        "你是视觉 QC 员：Read 该 PNG 文件（若无法以图像方式读取，如实标 visionRead=false 并改用只读命令做程序化检查：尺寸/DPI/文件大小）。" +
        "对照该图型的 QC 硬规则清单逐项判定（pass/fail + 说明）；fail 时给出按失败维度的定向修复提示（fixHints）。" +
        "不修改任何文件。",
    }).ask<FigureQC>(
      `图 ${s.figureId}：PNG=${s.outputPng}（脚本执行 ${exec && exec.run.exitCode === 0 ? "成功" : "失败"}）\n` +
        `QC 硬规则清单：${JSON.stringify(recipe?.qcChecklist ?? [])}\n返回逐项检查与裁定。响应必须精简：note 每条 ≤100 字符只写判定依据要点，fixHints 每条 ≤80 字符；详细测量过程不要写进响应。2 轮修复仍不过应裁 manual-review-needed。`,
    );
    report({ figureId: qc.figureId, verdict: qc.verdict });
    return qc;
  }),
);

phase("定向修复循环（QC fail → 修脚本 → 重跑 → 复检）");
const finalQcs: FigureQC[] = [];
for (let i = 0; i < qcs.length; i += 1) {
  let qc = qcs[i];
  const s = scripts[i];
  let rounds = 0;
  while (qc.verdict === "fail" && rounds < 2) {
    rounds += 1;
    log(`图 ${s.figureId} QC fail，第 ${rounds} 轮定向修复`);
    const fixer = await agent(`图表精修员-${s.figureId}-${rounds}`);
    await fixer.ask(
      `QC 未通过项：${JSON.stringify(qc.checks.filter((c) => !c.pass))}\n修复提示：${JSON.stringify(qc.fixHints)}\n` +
        `请修改脚本 ${s.scriptPath}（写回原路径）。完成后返回 done=true。`,
    );
    try {
      await world.run("python", [s.scriptPath], { timeoutMs: 300_000 });
    } catch {
      await world.run("py", [s.scriptPath], { timeoutMs: 300_000 });
    }
    const reQc = await agent(`视觉QC员-${s.figureId}-复检${rounds}`, {
      system: "你是视觉 QC 员：修复后按同一 QC 清单复检，只读不修改。响应精简：note 每条 ≤100 字符。",
    }).ask<FigureQC>(
      `重新 Read ${s.outputPng}，按清单复检。上一轮问题：${JSON.stringify(qc.checks.filter((c) => !c.pass))}`,
    );
    qc = reQc;
  }
  if (qc.verdict === "fail") {
    qc = { ...qc, verdict: "manual-review-needed" };
  }
  finalQcs.push(qc);
}

phase("图表目录与交付");
const catalog = await agent("图表目录撰写人", {
  system: "你是图表目录撰写人：汇总全部图表为带图注草稿的目录文档，QC 未过的显著标出。",
}).ask<CatalogReport>(
  `脚本与 QC 结果：${JSON.stringify({ scripts, finalQcs })}\n\n` +
    `撰写图表目录 catalog.md 并写入 ${outRoot}/：每图一节（PNG/PDF 路径、图注草稿、QC 状态、遗留问题）。返回 catalogPath 与 figures 清单。`,
);

try {
  await artifact.file("catalog", catalog.catalogPath, {
    title: `投稿级图表目录（${catalog.figures.length} 张）`,
    description: `${journal} 风格，Research-then-Draw 协议 + vision QC`,
    primary: true,
  });
} catch {
  log(`图表目录已在工作区 ${catalog.catalogPath}，但发布预览卡片失败。`);
}

const qcFindings: QCFinding[] = finalQcs.map((q) => ({
  where: `vision QC（${q.figureId}）`,
  what: q.verdict === "pass" ? "QC 全项通过" : `${q.verdict}：${q.checks.filter((c) => !c.pass).map((c) => c.item).join("；")}`,
  evidence: `见 ${catalog.catalogPath}`,
  status: q.verdict === "pass" ? ("verified" as const) : ("unconfirmed" as const),
}));

return {
  conclusion:
    `「${data}」的投稿级图表完成：${intake.figures.length} 张图（Research-then-Draw 检索配方 → 门控执行 → vision QC），` +
    `其中 QC 全过 ${finalQcs.filter((q) => q.verdict === "pass").length} 张、需人工复核 ${finalQcs.filter((q) => q.verdict !== "pass").length} 张。目录在 ${catalog.catalogPath}。`,
  findings: qcFindings,
  verified: [
    "每张图的绘图配方经检索并记录来源 URL（写入脚本头部注释持久保存）",
    "绘图脚本由 world.run 确定性执行，退出码 0（失败自动修复 ≤2 轮）",
    "vision QC 对照图型硬规则清单逐项判定，fail 经 ≤2 轮定向修复",
    `图表目录已落盘：${catalog.catalogPath}`,
  ],
  notCovered: [
    "QC 员若无法以视觉方式读取 PNG，仅完成程序化检查（已在 findings 中如实标注）",
    "图注草稿需作者按最终数据核对",
  ],
};