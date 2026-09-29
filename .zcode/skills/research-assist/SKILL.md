---
name: research-assist
description: |
  ZCode 原生的全周期科研辅助路由大脑。覆盖调研（survey）、实验设计（design）、分析（analyze）、
  结果解读（interpret）、论文写作（write）五种模式，服务干实验（数据分析）与湿实验科研人员。
  Read by the /research command and the main model when the user asks for research help without
  naming a stage. Triggers on: "帮我调研", "查文献", "设计实验", "实验方案", "分析数据",
  "跑统计", "解读结果", "这个结果说明什么", "写论文", "写 manuscript", "literature survey",
  "experiment design", "analyze data", "interpret results", "write paper".
tags: [Research, Full-Cycle, Wet-Lab, Dry-Lab, Routing]
version: 1.0.0
---

# research-assist — 全周期科研辅助路由大脑

## Overview

本 skill 是 `/research` 命令的方法大脑：**只做路由与编排，不做具体方法执行**。
五种模式各有一份 playbook（`references/`），playbook 内按需 `Read` 并遵循
`.claude/skills/` 下的既有方法论 skill 作为执行后端——**零复制，单一 source of truth**。

```
/research [mode] <topic>
   └─→ research-assist SKILL（本文件，路由决策）
         └─→ references/{mode}.md playbook（阶段方法）
               └─→ .claude/skills/* 后端（执行时按 playbook 指示 Read 加载）
```

## When to Use This Skill

- 用户通过 `/research` 命令发起任意阶段的科研求助
- 用户用自然语言提出调研/设计实验/分析/解读/写作需求，但未指明阶段，需要先判定模式
- 需要判断某个需求属于本工作流还是应交给其他专用入口（见 Core Contract 边界）

## Core Contract

### This skill is responsible for

- **模式判定**：从 `$ARGUMENTS` 的显式 mode 或自然语言关键词推断 survey/design/analyze/interpret/write；无法判定时向用户提供选项询问
- **Playbook 分发**：按模式 `Read references/{mode}.md` 并逐步执行
- **后端资源映射**：按 playbook 指示 Read `.claude/skills/` 下对应 SKILL.md 并遵循其流程
- **输出落盘约定**：vault 已绑定则写入 `Research/{slug}/` 对应目录，未绑定则就地建目录（见下文 Output Contract）

### This skill is not responsible for

- **组学大数据分析执行** — 那是 Analysis Loop（`.claude/skills/analysis-execution/`）的职责，本工作流只负责把需求桥接过去
- **NSFC 标书写作** — 走 Claude Code 入口 `/writing`（biomed-author）；本工作流 write 模式仅做 manuscript
- **幻灯/海报/审稿回复** — `/make-slides`、`/poster`、`/rebuttal` 等专用入口
- **知识库生命周期管理** — `/obsidian-init`、`/obsidian-sync` 等命令

## 模式路由表（核心地图）

| Mode | 中文别名 | Playbook | 复用的 `.claude` 后端 | 典型产出 |
|------|---------|----------|----------------------|---------|
| `survey` | 调研 / 查文献 | `references/survey.md` | `deep-research`、`rules/mcp-routing.md`、`zotero-obsidian-bridge` | 泛读索引 + Tier 分类笔记 + Research Gaps |
| `design` | 设计 / 实验方案 | `references/experiment-design.md` | `research-ideation`、`scientific-critical-thinking` | experiment-design.md（湿/干实验方案） |
| `analyze` | 分析 / 跑统计 | `references/analysis.md` | `analysis-execution`、5 个组学 SOP、`results-analysis`、`multi-omics-visualization` | 统计报告 + 出版级图 / 模块产物 |
| `interpret` | 解读 / 结果说明 | `references/interpretation.md` | `results-analysis`、`results-report` | interpretation-report（决策型） |
| `write` | 写作 / 写论文 | `references/writing.md` | `scientific-writing`、`writing-anti-ai`、`citation-verification`、`paper-self-review` | `Writing/manuscript/` 目录 |

**模式判定优先级**：显式 mode 参数 > 关键词匹配（上表中文别名 + description 触发词）> 上下文推断 > 询问用户。

## 执行模型

```
判定 mode
  ↓
Read references/{mode}.md
  ↓
按 playbook 的 Pre-flight → Steps → Output 执行
  ↓（playbook 内按需加载后端）
落盘产物 + 写 Daily 日志 + 报告下一步建议（可自然回流其他 mode）
```

全周期是循环而非直线：survey 产出 gaps → design 消化 gaps → analyze 验证 design →
interpret 决定"补实验（回流 design）/ 推进写作（进入 write）"。playbook 的
**Next Steps** 一节负责显式给出回流建议。

## Output Contract

1. **Vault 已绑定**（`project-memory/registry.yaml` 存在且指向当前课题）：写入对应课题目录——
   调研 → `Knowledge/` + `Papers/`；设计 → `Experiments/`；分析/解读 → `Results/Reports/`；写作 → `Writing/`
2. **Vault 未绑定**：提示用户可运行 Claude Code 的 `/obsidian-init`（本命令不代跑），
   同时就地创建 `{topic-slug}/` 同构目录继续工作，不阻塞
3. **每日日志**：任何模式完成后在 `Daily/YYYY-MM-DD.md`（或就地目录的 `Daily/`）追加一段操作记录
4. **临时文件**一律放 `temp/`，由用户或清理流程处理，不混入产物目录

## Context Loading Protocol

执行任何模式前按序加载：

1. `references/{mode}.md`（阶段 playbook）
2. 仓库根 `AGENTS.md` 已注入的环境约定；细节不明时 `Read CLAUDE.md`
3. playbook 指定的后端 SKILL.md（执行到该步骤时才读，避免预加载浪费上下文）

## Reference Files

| 文件 | 用途 |
|------|------|
| `references/survey.md` | 调研 playbook：快问快答 vs 系统调研决策树、检索通道、Tier 分类 |
| `references/experiment-design.md` | 实验设计 playbook：假说→设计六要素→湿/干实验专项→缺陷自查 |
| `references/analysis.md` | 分析 playbook：组学大数据 Analysis Loop 桥接 + bench 小数据轻量统计 |
| `references/interpretation.md` | 结果解读 playbook：统计复核→生物学意义→文献对照→下一步 |
| `references/writing.md` | 论文写作 playbook：图表定稿→IMRAD→去 AI 痕迹→引用核查→自查 |
