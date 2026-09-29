# Playbook: write（论文写作）

一句话职责：从定稿的图表与结论出发，产出**投稿级 manuscript 初稿**——边界明确：只写论文，NSFC 标书走 Claude Code 的 `/writing`。

## Pre-flight 三门

1. **结论门**：结果解读定稿了吗（`Results/Reports/interpretation-*.md` 存在且决策为"可发表"）？未定 → 回 `/research interpret`，**结论漂移时写的每个字都会返工**
2. **图表门**：主图/附图定稿了吗？未定 → 先按 Step 1 处理图表
3. **期刊门**：目标期刊定了吗？未定 → 用 survey 快速通道查 3-5 本候选（scope 契合度 / IF / 审稿周期 / 图表限制），与用户确认后再动笔——期刊决定结构（Letter vs Article）、字数与图表规格

## Step 1: 图表定稿

- Read `.claude/skills/multi-omics-visualization/SKILL.md` 遵循出版级规范（或项目已按 nature-figure 标准产出的直接复核）
- 图注自明测试：只看图+图注能否复述结论；每图一个主结论，图注含 n、统计方法、误差条定义
- 图表清单定稿后冻结，写作期间只改字不改图（防止图文错位）

## Step 2: 大纲（IMRAD claim-evidence 映射）

- Read `.claude/skills/scientific-writing/SKILL.md` 遵循其 IMRAD 结构与两段式写作法
- 每节先列 claim → evidence 映射表：Introduction 的每个 gap、Discussion 的每条结论，都要指向具体图表/文献
- 与用户确认大纲再进散文（返工成本最低点）

## Step 3: 分节起草（两段式 outline → prose）

- 起草顺序：**Methods → Results → Introduction → Discussion → Abstract → Title**（先写最确定的，Abstract 最后浓缩全文）
- Results 段落规则：一段一个结论，首句即结论句，随后证据句引用图表，不做文献综述
- Discussion 结构：主要发现 → 机制解释 → 与文献对照（含矛盾处理）→ 局限 → 展望；局限写实但不过度自贬

## Step 4: 去 AI 痕迹

- Read `.claude/skills/writing-anti-ai/SKILL.md` 并逐条自查（"delve/pivotal/comprehensive"类高频 AI 词、空洞总起句、强制三并列等）
- 底线句：正文散文体，严禁 bullet points 串正文（继承本仓 scientific-writing 铁律）

## Step 5: 引用核查

- Read `.claude/skills/citation-verification/SKILL.md` 遵循核查原则
- 每条引用三验：DOI/PMID 可解析、作者年份标题与原文一致、**结论表述确实被该文支持**（转述失实是高危错误）
- 投稿格式按目标期刊（Vancouver/APA），用 EndNote/Zotero 导出为主，不手打

## Step 6: 投稿前自查

- Read `.claude/skills/paper-self-review/SKILL.md` 跑完整 checklist
- 补投稿材料：cover letter（一段式：一句卖点+一句适配性+原创性声明）、highlights、推荐审稿人（3 名，无利益冲突）
- 全文交叉检查：图表编号连续且被正文引用、缩写首次出现有定义、数据可用性声明与伦理声明

## Output Contract

- 产出 `Writing/manuscript/` 目录：
  ```
  Writing/manuscript/
  ├── 00-outline.md          # claim-evidence 映射表
  ├── 01-title-abstract.md
  ├── 02-introduction.md
  ├── 03-methods.md
  ├── 04-results.md
  ├── 05-discussion.md
  ├── figures/               # 定稿图 + 图注
  ├── cover-letter.md
  └── submission-checklist.md
  ```
- 每节完稿即落盘并写 Daily 日志；后续修订加日期后缀不覆盖旧版
- **Next Steps**：投稿后收到意见 → Claude Code `/rebuttal`；接收后材料 → `/poster` `/presentation`；写下一篇前 → `/mine-writing-patterns` 积累写作记忆

## 常见错误

| 错误 | 后果 | 防线 |
|------|------|------|
| 结论未定稿就动笔 | 大面积返工 | Pre-flight 结论门 |
| Abstract 先写 | 全文写完抽象早已漂移 | Step 3 起草顺序 |
| 图正文中未引用/编号错乱 | 校稿灾难 | Step 6 交叉检查 |
| 转述文献失实 | 审稿人信任崩塌 | Step 5 三验 |
