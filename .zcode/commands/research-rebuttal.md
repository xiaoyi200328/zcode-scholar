---
description: 审稿回复：分类(Major/Minor/Typo/误解)→策略映射(Experiment 升级用户)→逐条回应→语气/完整性门。low 档约 10-15 分钟
argument-hint: <comments 审稿意见原文或文件路径> [manuscript 稿件路径] [context 资源约束等]
---

# /research-rebuttal — 审稿回复

启动 `research-rebuttal` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| comments | ✅ | 审稿意见原文（直接粘贴）或意见文件路径 |
| manuscript | 可选 | 被审稿件路径（用于定位 Changes 与引用原文） |
| context | 可选 | 稿件状态、可补实验的资源等 |

## 执行

1. 解析 `$ARGUMENTS`：comments 通常是粘贴的长文本；**缺失则向用户收集**
2. CreateWorkflow（saved 源）：name=`research-rebuttal`，args={comments, manuscript, context}
3. 提示预计耗时（low 档 ≈10-15 分钟）；若出现 Experiment 策略（需补实验），工作流会升级向你确认处理方式

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取 rebuttal 路径、分类统计、Experiment 待办（如有），更新 RESEARCH-STATE.md 的「写作 Writing」表；向用户报告分类统计与需补实验项。

## 说明

- 三份产物：`Writing/rebuttal/rebuttal.md` + `review-analysis.md` + 条件性 `experiment-plan.md`
- 硬门：回复条数 = 意见条数（typo 也确认）；禁语检测（The reviewer is wrong / This is obvious）
