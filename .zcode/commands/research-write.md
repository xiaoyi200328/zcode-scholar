---
description: IMRAD 论文初稿：素材盘点+大纲确认门→并行分节起草→质量门(anti-AI 五维评分+引用核查)→三值 verdict 终审。low 档约 20-30 分钟
argument-hint: <topic 论文主题> <materials 素材路径（分号分隔）> [journal 期刊] [context；含"自动确认"跳过大纲门]
---

# /research-write — 论文初稿

启动 `research-write` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| topic | ✅ | 论文主题/工作题目 |
| materials | ✅ | 素材路径清单（分号/逗号分隔）：interpret 报告、figures 目录、结果报告等——可从 RESEARCH-STATE.md 素材池取 |
| journal | 可选 | 目标期刊（决定结构与篇幅） |
| context | 可选 | 稿件类型/核心结论；含「自动确认」跳过大纲确认门 |

## 执行

1. 解析 `$ARGUMENTS`：前两段为 topic 与 materials；**任一必填缺失则向用户收集**（materials 也可提示用户从 RESEARCH-STATE.md 素材池选）
2. CreateWorkflow（saved 源）：name=`research-write`，args={topic, materials, journal, context}
3. 提示预计耗时（low 档 ≈20-30 分钟）与前置条件：**结论应已定稿**（interpret 决策=可发表），否则先跑 `/research-interpret`

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取稿件路径、anti-AI 评分、终审 verdict、blocking issues 与待办清单，更新 RESEARCH-STATE.md 的「写作 Writing」表；向用户报告稿件路径与 blocking 清单。

## 说明

- 引用纪律：全文只引素材文献池，缺的一律 `[待补文献: 主题]` 占位——不编造引用
- 产出：`Writing/manuscript/Manuscript-*.md`（含待办清单）
