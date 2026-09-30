---
description: 科研编排器：无参数=读取课题状态（RESEARCH-STATE.md）对账+仪表盘+推荐并发射下一步工作流；带参数=直通启动对应工作流；运行完成后维护课题状态文档。8 个工作流的统一入口与串联层
argument-hint: [mode] [参数] · 无参数=编排模式 · survey调研 design设计 analyze分析 interpret解读 figures图表 write写作 grant标书 rebuttal审稿回复
skills: research-assist
---

# /research — 科研编排器（状态感知入口）

用户请求：`$ARGUMENTS`

本命令是 zcode-scholar 的**统一编排入口**，两种形态：

- **编排模式**（无参数，或参数只有模式名而无主题/路径）：维护并读取课题状态文档 `RESEARCH-STATE.md`，对账、出仪表盘、推荐并发射下一步工作流
- **直通模式**（mode + 完整参数）：按模式直接启动对应工作流，完成后同样更新状态文档

**为什么编排器是命令而非工作流**：ZCode 禁止工作流嵌套（工作流不能调用工作流）。因此借鉴 CC analysis-executor 的真实形态——编排发生在主对话层：本命令读取状态并发射，主代理在运行完成通知到达后维护状态。（借鉴 auto_research 的 Hub.md 单文件状态源 + orchestrator 薄上下文 + 四态返回契约。）

## Step 0: 状态文档定位（两种形态都需要）

1. 检测 vault：`Research/*/Knowledge/*.md` 存在 → 取与当前工作最匹配的课题 `{slug}`，状态文件 = `Research/{slug}/RESEARCH-STATE.md`；否则 = 根目录 `RESEARCH-STATE.md`
2. 状态文件不存在 → 按下方「RESEARCH-STATE.md schema」初始化骨架（各表留空），并告知用户已创建

## Step 1A: 编排模式（无参数，或参数只有模式名）

### 1. 对账 reconcile（状态自愈）

扫描标准产物位置，与 state 对应表比对；**未记录的产物补录一行**（不要重写历史行）：

| 扫描位置 | 补录到 | 提取方式 |
|---------|--------|---------|
| `Research/{slug}/Experiments/experiment-design-*.md` | 设计表 | 评审分从文档「评审意见响应」节提取；缺失记 DONE_WITH_CONCERNS |
| `03_analysis/adhoc/*/results/report.md` 或 `*/report.md` | 分析表 | 分析问题取报告标题 |
| `Results/Reports/*--interpret.md` | 分析表（决策列）| 决策从文档「决策与下一步」节提取 |
| `03_analysis/adhoc/figures/catalog.md` | 图表表 | 张数与 QC 状态从目录提取 |
| `Writing/manuscript/*.md`、`Writing/grant/*.md`、`Writing/rebuttal/*.md` | 写作表 | 终审从文档结论提取，缺失记 DONE_WITH_CONCERNS |

### 2. 仪表盘（向用户展示，每节 ≤3 行）

假说状态 → 设计数 → 最近分析决策 → 素材池计数（interpret 报告/figures/文献池）→ Next Actions

### 3. 推荐下一步（规则表，展示给用户确认，**不暗发**）

| 状态 | 推荐 |
|------|------|
| 无假说/无设计 | `research-design` |
| 有设计 + 有未分析的新数据 | `research-analyze` |
| 分析表中有报告但决策列为空 | `research-interpret` |
| 最近决策=可发表 且 无图表 | `research-figures` |
| 最近决策=可发表 且 图表已齐 | `research-write` |
| 最近决策=待补强 | 提示按缺陷补实验（回 design 修订），本轮不发射 |
| 用户明确要申报 NSFC | `research-grant` |
| 用户收到审稿意见 | `research-rebuttal` |

### 4. 发射

用户选择后，**从 state 自动填充参数**（这是串联的核心）：
- interpret ← 分析表最近一行的报告路径 + 假说节的假说
- write ← 素材池的 interpret 报告 + figures 目录
- grant ← 素材池 + 假说节
- analyze ← 用户给的数据路径

用 CreateWorkflow（saved 源，`subagent_model` 按用户要求）启动，并告知：完成后你会收到通知并自动更新状态文档。

### 5. 链式模式

仅当用户明说「链式/自动连跑」时：按推荐链连续发射（每环完成→更新状态→自动发射下一环）；遇 BLOCKED、决策=待补强、或需要用户提供真实信息（如 grant 的研究基础）时**停下升级**。

## Step 1B: 直通模式（mode + 完整参数）

1. 模式判定（别名见 argument-hint；中英文均可）
2. 各模式启动（CreateWorkflow saved 源 + 对应参数）：
   - `survey` → research-survey {topic, context}
   - `design` → research-design {topic, context}
   - `analyze` → research-analyze {data, question, context}
   - `interpret` → research-interpret {report, hypothesis, context}
   - `figures` → research-figures {data, figures, journal, context}
   - `write` → research-write {topic, materials, journal, context}
   - `grant` → research-grant {topic, grantType, context}
   - `rebuttal` → research-rebuttal {comments, manuscript, context}
3. 必填参数缺失（如 analyze 缺 question）→ 向用户收集后再发射；launch 前告知参数与预计耗时

## Step 2: 运行完成后的状态更新（两种形态的共同收尾）

工作流完成通知到达后：

1. 从运行结果提取：产物路径、关键决策（interpret 六情形/评审分/verdict 等级）、todos
2. 按 schema 更新对应表的行（一行一事，单元格一句话）；刷新「下一步 Next Actions」；日志层追加 ≤3 行（倒序）
3. 决策变化触发推荐规则变化时，主动提示用户新的下一步
4. 示例：interpret 完成且决策=可发表 → 分析表追加 I 行 + Next Actions 更新 + 提示「可发射 research-figures/write」

## RESEARCH-STATE.md schema（协议本体，初始化与更新均按此执行）

```markdown
---
type: research-state
project: {slug}
updated: {YYYY-MM-DD}
---
# RESEARCH-STATE — {课题一句话}

## 假说 Hypothesis
- [ACTIVE] {可证伪假说一句话}（D1, {日期}）
<!-- 枚举: ACTIVE | REVISED | FALSIFIED -->

## 设计 Designs
| ID | 文档 | 评审分 | 缺陷已响应 | 日期 |
|----|------|--------|-----------|------|
| D1 | Experiments/experiment-design-*.md | 80/100 | ✅ | 2026-09-29 |

## 分析与解读 Analyses
| ID | 工作流 | 输入 | 报告路径 | 决策 | 日期 |
|----|--------|------|---------|------|------|
| A1 | research-analyze | temp/x.csv | 03_analysis/adhoc/x/report.md | — | {日期} |
| I1 | research-interpret | A1 报告 | Results/Reports/...--interpret.md | 可深化 | {日期} |
<!-- 决策枚举（interpret 六情形）: 可发表 | 待补强 | 科学信号 | 不可解读 | 可深化 | 阴性结果报告 -->

## 图表 Figures
| 目录 | 张数 | QC 全过 | 日期 |
|------|------|--------|------|
| 03_analysis/adhoc/figures | 5 | 4/5 | {日期} |

## 写作 Writing
| 类型 | 路径 | 终审 | 日期 |
|------|------|------|------|
| grant | Writing/grant/NSFC-青年-*.md | 良-修改后可再审 | {日期} |

## 素材池 Assets
- interpret 报告：{路径列表}
- figures：{目录}
- 文献池：{各工作流产出的 refs 所在文件}

## 下一步 Next Actions
- [ ] {来自最近 interpret 决策矩阵的 nextActions}

## 日志 Log
- **{日期}**: {research-design 定稿 D1（评审 80/100）→ 待分析}
```

## 状态纪律（借鉴 CC Hub.md 血泪教训）

- **枚举第一天冻结**：运行状态 `DONE | DONE_WITH_CONCERNS | BLOCKED | VOIDED`；假说 `ACTIVE | REVISED | FALSIFIED`；决策 = interpret 六情形。不要发明新状态词（真实 CC 项目曾自由演化出十几种状态导致机器难解析）
- **单元格一句话**：能从产物目录推导的（脚本路径/产物清单）不进表；细节留在产物文档
- **口径变更用 blockquote overlay**：表格上方加引用块声明"历史行仅作审计"，不改历史行
- **单一写手**：本命令是 RESEARCH-STATE.md 的唯一写手；工作流不写状态

## 边界（不属于本命令）

- NSFC 标书的深度写作纪律、组学大队列执行等由工作流内部的后端负责（见各工作流）
- 知识库生命周期（obsidian-init/sync）走 Claude Code 侧命令

## Related Resources

- **工作流**：`.zcode/workflows/` 8 个（survey/design/analyze/interpret/figures/write/grant/rebuttal）
- **Skill**：`research-assist`（`.zcode/skills/research-assist/SKILL.md`，五模式方法路由）
- **状态协议**：本文件「RESEARCH-STATE.md schema」节为唯一协议源
