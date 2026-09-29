---
description: 全方位科研辅助入口：调研(survey)/实验设计(design)/分析(analyze)/结果解读(interpret)/论文写作(write) 五模式路由，服务干实验与湿实验科研人员
argument-hint: [mode] <主题或问题> · mode 可省略自动识别：survey调研 design设计 analyze分析 interpret解读 write写作
skills: research-assist
---

# /research — 全周期科研辅助入口

用户请求：`$ARGUMENTS`

你是全周期科研工作流的入口。加载 `research-assist` skill（若未自动挂载，Read
`.zcode/skills/research-assist/SKILL.md`），按其模式路由表执行。

## Step 0: Pre-flight

1. **模式判定**（优先级从高到低）：
   - `$1` 是显式 mode（`survey|design|analyze|interpret|write` 或中文别名 调研|设计|分析|解读|写作）→ 剩余参数为 topic
   - 否则从 `$ARGUMENTS` 关键词推断（映射表见 skill 的"模式路由表"）
   - 仍无法判定 → 列出 5 个模式一句话说明，AskUserQuestion 让用户选；**不要暗选**
2. **环境确认**：
   - 仓库根有 `CLAUDE.md` 约定细节，执行中需要环境事实（R 路径、PDF 工作流）时 Read 它
   - Obsidian 绑定检测：`project-memory/registry.yaml` 存在 → 已绑定，输出走对应 `Research/{slug}/`；不存在 → 未绑定，就地建 `{topic-slug}/` 同构目录，不阻塞，但提示用户可在 Claude Code 侧运行 `/obsidian-init` 入库
3. **联动提示**：若 topic 与现有课题明显相关（`Research/` 下已有同名/相近 slug），先告知用户并确认是新建还是并入现有课题

## Step 1: 分发执行

1. Read `.zcode/skills/research-assist/references/{mode}.md`（对应 playbook）
2. 严格按 playbook 的 Pre-flight → Steps → Output Contract 执行
3. playbook 指示加载 `.claude/skills/` 后端时，用 Read 加载对应 SKILL.md 并遵循——
   **不复制其后端内容，不跳过后端流程**

## Step 2: 收尾

1. 按 playbook 的 Output Contract 落盘产物
2. 在 `Daily/YYYY-MM-DD.md`（或就地目录的 `Daily/`）追加一段记录：模式、topic、产物路径、下一步建议
3. 向用户报告：产物路径 + playbook 给出的 Next Steps（显式回流建议）

## 边界（不属于本命令）

- NSFC 标书 → Claude Code `/writing`；幻灯 → `/make-slides`；审稿回复 → `/rebuttal`
- 组学大数据的多模块执行由 `analysis-execution` 后端接管，本命令只负责把需求桥接过去

## Related Resources

- **Skill**: `research-assist`（`.zcode/skills/research-assist/SKILL.md`，路由大脑）
- **Playbooks**: survey / experiment-design / analysis / interpretation / writing（同目录 `references/`）
- **复用后端**: `.claude/skills/`（deep-research、scientific-writing、analysis-execution、multi-omics-visualization 等，由 playbook 按需加载）
- **兄弟入口**: Claude Code 侧 `.claude/commands/`（research-init、writing、make-slides 等）
