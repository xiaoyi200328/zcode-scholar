---
description: 领域入门笔记：访谈(含库存检查)→按聚焦点并行检索核验→1篇定制入门笔记落盘→新手复审。low 档约 10 分钟
argument-hint: <topic 主题/领域> [context 阶段/重点/规划；含"自动确认"跳过访谈]
---

# /research-survey — 领域入门笔记

启动 `research-survey` 动态工作流。用户参数：`$ARGUMENTS`

## 参数映射

| 参数 | 必填 | 说明 |
|------|------|------|
| topic | ✅ | 调研主题/领域（第一段） |
| context | 可选 | 当前阶段/关注重点/规划/禁忌；含「自动确认」跳过访谈 |

## 执行

1. 解析 `$ARGUMENTS`：第一段为 topic，其余归入 context；**topic 缺失则向用户收集，不要猜**
2. CreateWorkflow（saved 源）：name=`research-survey`，args={topic, context}
3. 提示用户：预计耗时（low 档 ≈10 分钟）；可选在启动时指定 `subagent_model` 降档加速

## 完成后

按 `/research` 命令的「Step 2 状态更新」协议：从运行结果提取笔记路径与点单清单，更新 RESEARCH-STATE.md（若存在）；向用户报告笔记路径与延伸选项。

## 说明

- 不确定下一步该做什么时，用 `/research`（无参数编排模式），系统按课题状态推荐
- 产出位置：`Research/{课题}/Knowledge/Primer-*.md` 或根目录 `Knowledge/`
