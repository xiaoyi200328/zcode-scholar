---
description: 结果解读：统计复核→生物学意义(替代解释≥2)→文献对照四态→决策矩阵强制选一→强命名报告。low 档约 12 分钟
argument-hint: <report 统计报告路径> [hypothesis 假说参照] [context]
---

# /research-interpret — 结果解读

启动 `research-interpret` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| report | ✅ | 统计报告/分析产物路径（如 RESEARCH-STATE 分析表最近一行的报告路径） |
| hypothesis | 强烈建议 | 假说参照（一句话或设计文档路径）——**没有假说参照的解读是自由发挥**，缺失会访谈收集 |
| context | 可选 | 数据来源背景/已知问题 |

## 执行

1. 解析 `$ARGUMENTS`：第一段为 report 路径；**缺失则向用户收集**
2. 若 RESEARCH-STATE.md 存在且用户未给 hypothesis，从「假说」节自动取用并告知
3. CreateWorkflow（saved 源）：name=`research-interpret`，args={report, hypothesis, context}
4. 提示预计耗时（low 档 ≈12 分钟，含文献对照检索）

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取报告路径、决策矩阵结果（六情形）、What Changed Our Belief，更新 RESEARCH-STATE.md 的「分析与解读」表（决策列）与「下一步 Next Actions」；**按决策触发推荐**：可发表→提示 `/research-figures`/`/research-write`；待补强→提示回 `/research-design`。

## 说明

- 产出：`Results/Reports/{YYYY-MM-DD}--{slug}--interpret.md`（含 What Changed Our Belief 段）
