---
description: 投稿级图表：Research-then-Draw 检索配方→脚本门控执行→vision QC ≤2轮定向修复→图表目录。low 档约 15 分钟
argument-hint: <data 数据/产物路径> [figures 图表需求] [journal 期刊，默认Nature风格] [context]
---

# /research-figures — 投稿级图表

启动 `research-figures` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| data | ✅ | 数据/分析产物路径（csv 或 03_analysis 目录） |
| figures | 可选 | 图表需求（如"图1：A/B比较带散点箱线图"）；缺失会访谈逐张问清 |
| journal | 可选 | 目标期刊（默认 Nature 风格：89/183mm、≥300dpi、色盲安全） |
| context | 可选 | 数据背景/已用统计方法 |

## 执行

1. 解析 `$ARGUMENTS`：data 是路径；**缺失则向用户收集**
2. CreateWorkflow（saved 源）：name=`research-figures`，args={data, figures, journal, context}
3. 提示预计耗时（low 档 ≈15 分钟，含配方检索与 vision QC 循环）

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取图表目录路径、QC 通过数，更新 RESEARCH-STATE.md 的「图表 Figures」表；QC 有 manual-review-needed 的图提示用户人工复核。

## 说明

- 产出：`03_analysis/adhoc/figures/catalog.md` + 每图 PNG/PDF 双写（配方与来源 URL 记录在脚本头部）
- 绘图脚本由 world.run 确定性执行（失败自动修复 ≤2 轮）；QC 员做像素/字体/散点/统计标注四层检查
