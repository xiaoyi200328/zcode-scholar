---
description: NSFC 标书：三阶段（构思文献→四维批判评审+方向门→大纲门→六部分起草→质量门→函评模拟）。low 档约 30-40 分钟
argument-hint: <topic 申报方向> [grantType 面上/青年/重点] [context 研究基础/前期工作；含"自动确认"跳过两道门]
---

# /research-grant — NSFC 标书初稿

启动 `research-grant` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| topic | ✅ | 拟申报的研究方向或题目雏形 |
| grantType | 建议 | 面上/青年/重点（影响字数与深度；缺失会访谈收集） |
| context | 强烈建议 | **课题组研究基础与前期工作（真实信息）**——标书研究基础部分只用你提供的事实，缺失处 [需补充] 占位，绝不编造；含「自动确认」跳过方向门与大纲门 |

## 执行

1. 解析 `$ARGUMENTS`：第一段为 topic；**研究基础等关键项缺失时工作流会访谈你，请准备真实论文/项目清单**
2. CreateWorkflow（saved 源）：name=`research-grant`，args={topic, grantType, context}
3. 提示预计耗时（low 档 ≈30-40 分钟）；文献池要求近 3 年占比 ≥30%

## 完成后

按 `/research` 的「Step 2 状态更新」协议：提取标书路径、四维评分、anti-AI 分、函评等级与 blocking 清单、申请人待办，更新 RESEARCH-STATE.md 的「写作 Writing」表；向用户报告函评等级与待办清单。

## 说明

- 产出：`Writing/grant/NSFC-{类型}-{日期}-{slug}.md`（含 400 字摘要配比 + 六部分 + 参考文献列表 + 待办清单）
- 红线：研究基础零编造——缺失信息以 [需补充] 占位，提交前必须逐条补齐并自查真实性
