# ZCode Scholar — ZCode 原生科研动态工作流集

> 独立于 [claude-scholar](https://github.com/Galaxy-Dawn/claude-scholar)（Claude Code plugin）的 **ZCode 原生科研工作流仓库**。clone 即用：用 ZCode 打开本仓库，对 agent 说「运行 xx 工作流」即可，无需任何安装步骤。

## 工作流清单

| 工作流 | 借鉴的 CC 管线 | 产出 | 耗时（low 档） |
|--------|------|------|------|
| `research-survey` | /research-init（Tier 分类、库存优先） | 1 篇定制入门笔记（主文精读 + 多篇引证 + 点单式延伸清单），落盘知识库 | ≈ 10 分钟 |
| `research-design` | research-ideation（5W1H）+ scientific-critical-thinking（四维评审） | 实验设计文档（3 方案并行 → 四维加权评审 → 用户选择 → 评审意见响应），落盘 Experiments/ | ≈ 15 分钟 |
| `research-analyze` | /run-analysis + analysis-execution（CONFIRM 门/生成执行分离/双阶段审查）+ sp-verification | R 脚本 + 图表 + 统计报告（效应量/CI/精确 p），落盘 03_analysis/ | ≈ 12 分钟 |
| `research-interpret` | results-report（决策对象）+ analysis-reflection（决策矩阵） | 结果解读报告（统计复核 + 机制链 + 文献对照四态 + 决策强制选一），落盘 Results/Reports/ | ≈ 12 分钟 |
| `research-write` | /writing（两段式+大纲确认门）+ writing-anti-ai（50 分制）+ paper-self-review（三值 verdict） | IMRAD 初稿（claim-evidence 大纲 → 并行分节 → 质量门 → 终审），落盘 Writing/manuscript/ | ≈ 20-30 分钟 |

**借鉴 CC 的质量门一览**：需求访谈先行 / 库存检查 / CONFIRM 用户确认门（大纲、统计方案、方案选择）/ 生成与执行分离（world.run 门控）/ VERIFY 断言 / 双阶段审查（spec→quality）/ anti-AI 50 分制评分 / 引用幻觉防线 / 三值 verdict 终审。

## 用法

```bash
# 1. clone 本仓库，用 ZCode 打开
# 2. 对 agent 说（工作流面板也可直接选）：
运行 research-survey 工作流，主题是「单细胞测序解析肿瘤微环境」
运行 research-design 工作流，验证蛋白X磷酸化影响Y通路
运行 research-analyze 工作流，数据是 data/qpcr.csv，问题是 A/B 两组差异
运行 research-interpret 工作流，报告是 03_analysis/.../report.md，假说是…
运行 research-write 工作流，素材是 Results/Reports/ 下的解读报告
```

**参数约定**：每个工作流都有 `context` 类参数——把你所处阶段、关注重点、规划写清楚可直接开工；不写则工作流会先访谈你再动工。在 `context` 中写「自动确认」可跳过中途的确认门（大纲/方案/选择），全自动跑完。

## 快慢模式

子代理推理档跟随会话设置（默认 max，质量优先，约慢 3 倍）。**快模式**：运行时指定子代理用 low 推理档（`subagent_model: <模型>$low`），检索/核验/统计执行不受影响，撰写质量略降。

## 质量防线（所有工作流共用）

- **需求先行**：先弄清你的阶段/重点/规划，再动手——不做方向不明的大锅饭
- **引用幻觉防线**：入库文献的 DOI/PMID 标识符必须批量核验可解析；写作引证只来自你提供的素材，缺的在文中显式标记 `[待补文献]`
- **预算硬上限**：每个检索子代理有网络调用次数上限，杜绝失控空转
- **独立复审**：交付物必经未参与撰写的独立评审（新手/审稿人视角），发现问题才修订
- **落盘可追溯**：所有产物写入工作区（知识库/分析目录），路径在运行结果中明确给出

## 目录结构

```
zcode-scholar/
├── .zcode/
│   ├── commands/research.md      # /research 五模式命令（调研/设计/分析/解读/写作）
│   ├── skills/research-assist/   # 命令的路由大脑 + 5 个阶段 playbook
│   └── workflows/                # 动态工作流（.dwf.ts，随仓库分发）
├── .agents/skills/               # 内置技能后端（7 个，选自 K-Dense-AI/scientific-agent-skills，MIT）
│   ├── statistical-power         # 样本量/功效分析（SESOI 效应量原则 + 敏感性分析）
│   ├── experimental-design       # 随机化/区组/析因 DOE/伪重复判定
│   ├── statistical-analysis      # 检验选择指南/假设诊断/效应量规范/报告标准
│   ├── statsmodels               # GLM/线性模型/时间序列方法参考
│   ├── scikit-survival           # 生存分析方法参考（Cox/竞争风险）
│   ├── paper-lookup              # 10 大学术数据库检索
│   └── citation-management       # 引用管理与核验
├── .claude/rules/mcp-routing.md  # 检索路由（research-survey 运行时依赖）
├── AGENTS.md                     # ZCode 工作区指令
└── .zcodeignore                  # ZCode 排除规则（同步自 .gitignore）
```

**技能后端说明**：工作流内建**软路由**——技能存在时自动加载其方法论（如 research-design 的样本量计算走 `statistical-power` 的 SESOI 规范），缺失时按工作流内置纪律执行，自包含不依赖外部安装。技能来自 [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills)（MIT），归属声明见 `.agents/skills/LICENSE-K-Dense.md`。

## 与 auto-research（Claude Scholar）的关系

- 本仓库**自包含**：三个动态工作流不依赖其他仓库即可运行
- `/research` 命令的 survey/analyze/write 深度模式会按需加载 `.claude/skills/` 方法后端（组学 SOP、scientific-writing 等）——这些后端在 [auto-research](https://github.com/xiaoyi200328/auto-research) 仓库；需要完整命令体验请配合使用
- `research-analyze` 的 R 路径默认 `C:/Program Files/R/R-4.5.3/bin/x64/Rscript.exe`（auto-research 的约定），机器上 R 在 PATH 中则自动优先使用 `Rscript`

## License

[MIT](LICENSE)
