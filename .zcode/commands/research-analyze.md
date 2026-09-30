---
description: 统计分析（R）：CONFIRM 方案门→生成/执行分离→VERIFY 断言→双阶段审查→报告。low 档约 12 分钟
argument-hint: <data 数据路径> <question 分析问题> [context 分组/配对/批次；含"自动确认"跳过方案门]
---

# /research-analyze — 统计分析

启动 `research-analyze` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| data | ✅ | 数据文件路径（csv/tsv/xlsx，workspace 相对） |
| question | ✅ | 分析问题（差异/关联/生存/预测） |
| context | 可选 | 分组定义/配对结构/样本量口径/批次；含「自动确认」跳过统计方案确认门 |

## 执行

1. 解析 `$ARGUMENTS`：通常 data 是路径（含 / 或 .csv 等），question 是其余部分；**任一必填缺失则向用户收集**
2. CreateWorkflow（saved 源）：name=`research-analyze`，args={data, question, context}
3. 提示预计耗时（low 档 ≈12 分钟）；组学大队列建议改走 auto-research 的 Analysis Loop

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取报告路径与主要统计结果（效应量/CI/精确 p），更新 RESEARCH-STATE.md 的「分析与解读」表；**提示用户可接 `/research-interpret <报告路径>` 解读**。

## 说明

- 产出：`03_analysis/adhoc/{slug}/`（脚本/图/报告自包含，路径契约固定）
- 质量门：方案 CONFIRM → world.run 执行 → VERIFY 文件断言 → spec/quality 双阶段审查
