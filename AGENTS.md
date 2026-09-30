# AGENTS.md

## 语言与风格

中文回答，专业术语保持英文。有疑必问，多解时呈现选择而非暗选。

## 这个仓库是什么

**ZCode Scholar** — ZCode 原生科研动态工作流集（独立于 Claude Code 体系的 claude-scholar）。三个已就绪的动态工作流：

| 工作流 | 用途 | 关键参数 |
|--------|------|---------|
| `research-survey` | 需求先行的领域入门笔记 | `topic`（必填）；`context`（阶段/重点/规划，给了跳过访谈） |
| `research-write` | 论文 IMRAD 初稿 | `topic` + `materials`（素材路径，必填）；`journal`；`context` |
| `research-analyze` | 数据统计分析（R） | `data`（数据路径，必填）+ `question`（必填）；`context`（分组/配对/批次） |

## 运行约定

- 动态工作流按名运行（`.zcode/workflows/*.dwf.ts`）；`context` 参数给足则跳过访谈直接开工
- 快模式：子代理用 low 推理档（运行时指定 `subagent_model`），默认跟随会话档位
- **R 环境**：优先 PATH 中的 `Rscript`，失败则回退 `C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe`
- **检索路由**：中文 `web-search-prime` / 英文 brave / 通用 `WebSearch` / 深读 `web-reader`（见 `.claude/rules/mcp-routing.md`）

## 输出与命名约定

- **课题状态源**：`RESEARCH-STATE.md`（每课题一份）是课题唯一状态文档，**只由 `/research` 编排器维护**；工作流不读写它
- 入门笔记 → `Research/{课题}/Knowledge/`（无匹配课题则新建；无 vault 则根目录 `Knowledge/`）
- 论文初稿 → `Writing/manuscript/`；标书 → `Writing/grant/`；审稿回复 → `Writing/rebuttal/`；统计产物 → `03_analysis/adhoc/{slug}/`（脚本/图/报告自包含）
- 运行时产物（`.zcode/plans|workflow-drafts|workflow-runs`）已由 `.zcode/.gitignore` 排除，不入库
- Git Conventional Commits；文献标识符（DOI/PMID）必须核验后才可引用
