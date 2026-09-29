# Playbook: analyze（分析）

一句话职责：按数据形态分流——**组学大数据桥接 Analysis Loop**，**bench 小数据走轻量统计路径**——并守住同一套统计质量红线。

## Pre-flight: 数据盘点（必答四问）

1. 数据是什么形态？（高通量组学 / bench 小样本 / 临床随访表）
2. 规模与格式？（文件数、行列数、格式 csv/xlslx/vcf/h5ad…）
3. 分析目标？（描述 / 组间比较 / 关联 / 预测 / 机制）
4. 数据与设计文件齐吗？（分组表、批次信息、SAP——缺则提示回 design 模式补）

## 路径 A: 组学大数据 → 桥接 Analysis Loop

1. **方法笔记就绪检查**：`Experiments/` 下有无该技术的方法笔记？无 → 暂停，建议先 `/research survey` + `deep-paper-reading` 产出笔记（调研与执行解耦是本仓核心原则）
2. Read `.claude/skills/analysis-execution/SKILL.md` 并遵循其完整流程：module-centric PLAN（sp-planning 生成）→ 按模块 Omics 路由 SOP → 双阶段审查 → 反思门
3. 组学 SOP 对应表（执行到对应模块时 Read）：

   | Omics | SOP |
   |-------|-----|
   | 蛋白组 | `.claude/skills/proteomics-analysis/SKILL.md` |
   | 基因组（WES/CNA） | `.claude/skills/genomics-analysis/SKILL.md` |
   | 单细胞 | `.claude/skills/single-cell-analysis/SKILL.md` |
   | 临床/生存 | `.claude/skills/clinical-analysis/SKILL.md` |
   | 多组学整合 | `.claude/skills/integration-analysis/SKILL.md` |

4. 重模块可派发独立上下文子代理（Agent tool，general-purpose），只回传紧凑摘要——主对话持计划与摘要，不持原始数据
5. 产物自包含于 `03_analysis/{category}/{omics}/{technique}/{data,scripts,results}/`

## 路径 B: bench 小数据轻量统计（qPCR / WB 灰度 / 流式 / MTT-CCK8 / ELISA / 划痕 / 克隆形成）

1. **数据整理**：转长表（sample, group, value, batch）；技术重复**先取均值再进统计**，n 只数生物学重复；流式先记录 gating 策略与同型对照结果
2. **前提检查**：n<3 只做描述（均值±全距），不做检验装样子；n≥3 先看正态性（Shapiro-Wilk，n<50 慎用，图形辅助）与方差齐性（Levene）
3. **方法选择表**：

   | 设计 | 条件 | 方法 |
   |------|------|------|
   | 两组比较 | 近似正态 | Welch's t-test（默认不假设等方差） |
   | 两组比较 | 非正态/小样本 | Mann-Whitney U |
   | 配对/处理前后 | — | paired t / Wilcoxon signed-rank |
   | 多组单因素 | 正态 | one-way ANOVA + Tukey（全比）或 Dunnett（对对照） |
   | 多组单因素 | 非正态 | Kruskal-Wallis + Dunn |
   | 两因素（处理×时间） | — | two-way ANOVA（报告交互作用） |
   | 多重比较 | — | Dunnett/Tukey/BH-FDR，按设计选，写明用了哪个 |
   | 生存数据 | — | KM 曲线 + log-rank + Cox（可进 clinical-analysis SOP） |

4. **执行**：R 用完整路径 `"C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe" script.R`；脚本与输出落 `03_analysis/bench/{assay}/{data,scripts,results}/`
5. **出图**：Read `.claude/skills/multi-omics-visualization/SKILL.md` 遵循出版级规范；bench 图底线——**散点叠加在柱/箱上**（显示每个生物学重复）、显著性标注实际校正后 p、坐标不从非零截断

## 统计质量红线（两路共用）

- 报告**精确 p 值**（p=0.032，不是 p<0.05）+ **效应量**（Δmean/ES/HR）+ **置信区间**
- 禁止事后换统计方法挑好看的；禁止选择性删"坏"样本——异常值剔除规则在分析前声明
- 图与表必须能从脚本一键复现（脚本入 results 同目录，不手工改图）

## Output Contract

- 统计报告 `Results/Reports/analysis-{slug}-{date}.md`：数据概况 → 方法与依据 → 结果（图表编号引用）→ 局限
- 图 PDF+PNG 双写，数据 csv+rds 双写
- **Next Steps**：结果说明什么 → `/research interpret`；结果反常 → interpret 模式的排查分支

## 常见错误

| 错误 | 后果 | 防线 |
|------|------|------|
| 技术重复当生物学 n | p 值虚假显著 | Pre-flight 整理规则 |
| 用 ANOVA 后两两 t 检验不校正 | 假阳性膨胀 | 方法选择表多重比较行 |
| 只报 p 值不报效应量 | 显著但无意义，reviewer 必杀 | 统计质量红线 |
| 大数据无方法笔记直接跑 | 闭门造车造错轮子 | 路径 A 就绪门 |
