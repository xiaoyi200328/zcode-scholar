---
description: 实验设计：5W1H+假说可证伪化→3方案并行→四维加权评审(25/30/25/20)→选择门→定稿落盘。low 档约 15 分钟
argument-hint: <topic 科学问题/假说方向> [context 研究对象/平台/预算/周期；含"自动确认"跳过选择门]
---

# /research-design — 实验设计

启动 `research-design` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| topic | ✅ | 要验证的科学问题或假说方向 |
| context | 可选 | 研究对象/可用平台/预算周期/已有工具；含「自动确认」跳过方案选择门；湿实验设计会软路由 K-Dense 的 statistical-power/experimental-design 技能 |

## 执行

1. 解析 `$ARGUMENTS`：第一段为 topic，其余归入 context；**缺失则向用户收集**
2. CreateWorkflow（saved 源）：name=`research-design`，args={topic, context}
3. 提示预计耗时（low 档 ≈15 分钟）

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取设计文档路径、评审分、致命缺陷响应情况，更新 RESEARCH-STATE.md 的「假说」与「设计」表；向用户报告定稿路径与评审要点。

## 说明

- 产出：`Research/{课题}/Experiments/experiment-design-*.md`（含 Pilot 清单与评审意见响应）
