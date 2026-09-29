# Playbook: survey（调研）

一句话职责：把一个研究问题变成**经过 Tier 分类的文献地图 + Research Gaps 清单**，为 design/write 供弹药。

## Pre-flight

1. **问题具体化门**：当前问题若不够具体（缺对象/场景/目标三要素之一），先向用户提 2-3 个澄清问题再动手。不要拿模糊问题跑系统调研，浪费且产出不可用。
2. **库存优先**：先在已有知识资产里找现成答案，避免重复调研：
   - vault 已绑定：搜 `Research/*/Papers/`、`Research/_Index/Cross-Project-Knowledge.md`、`Knowledge/Research-Gaps.md`
   - 未绑定：搜本仓库 `Research/` 与 `programs/` 下同名主题笔记
   - 命中相关笔记 → 展示给用户，确认"补齐"还是"从零开始"

## 通道选择决策树

```
用户要什么？
├─ 快问快答（一个事实/方法/参数，几分钟级）
│    → 快速通道（本 playbook 直接执行，不开子代理）
├─ 系统调研（开题/立项/写综述，小时级）
│    → 系统通道（Read .claude/skills/deep-research/SKILL.md，遵循其子代理扇出流程）
└─ 深度精读某几篇论文
     → Read .claude/skills/deep-paper-reading/SKILL.md，产出方法笔记到 Experiments/
```

## 快速通道

1. 按搜索路由表选工具（Read `.claude/rules/mcp-routing.md`）：中文 `mcp__web-search-prime__web_search_prime`（location: "cn"）、英文 `mcp__brave-search__brave_web_search`、通用 `WebSearch`、深读网页 `mcp__web_reader__webReader`
2. 生物医学事实类问题优先 PubMed E-utilities（keyless、可给出可核查的 PMID/DOI）：
   ```bash
   curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<QUERY>&retmax=10&sort=relevance" 
   curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMIDS>&rettype=docsum"
   ```
3. 汇总回答：每条结论后附来源（作者+年份+PMID/DOI/URL），3-5 个独立来源交叉印证才可写"确认"；只有单一来源要明示

## 系统通道

0. **产出定位确认**（问一次用户即可）：默认产出**入门讲义**——读者假设为对该领域还不熟悉的人；仅当用户明确要"找空白/立项"时才产出前沿地图（Tier 分类 + Research Gaps）
1. 单篇入门笔记可直接运行项目动态工作流 `research-survey`（`.zcode/workflows/`：需求访谈 → 定向检索选 1 篇主文精读 + 4-8 篇支撑文献 → 撰写并落盘 → 新手复审；子代理 low 推理档实测约 10 分钟，max 档约 30 分钟；延伸方向由用户点单后再做）；手动执行则 Read `.claude/skills/deep-research/SKILL.md` 并**严格遵循**其 Phase 划分、并发限额与子代理 prompt 模板
2. 生物医学主题补充要求：检索式用 MeSH 词 + 自由词组合；**奠基作不限年份**（入门必需），综述取近 3 年；每条入库文献必须有可验证标识（DOI/PMID/arXiv ID），核验不过不记录——引用幻觉防线，见 `citation-verification`
3. 入门讲义产出（默认）：
   - `Knowledge/Primer-{topic}-{date}.md`：领域一段话总览 → 核心概念术语表（中英 + 一句话解释）→ 结构式论文笔记（每篇：研究问题/方法一句话/关键结果/为什么必读/前置知识）→ 推荐学习路径（按依赖排序并说明理由）→ 常见误区与开放问题
   - `Papers/Broad/{NNN}-{slug}.md` 泛读索引笔记（讲义的检索底稿）
   - `references.md` 全量文献表（含标识符，供 citation-verification）
4. 前沿地图产出（仅当用户要求找空白时）：
   - Tier 分类：**Tier 1** 直击核心问题 → 泛读笔记 + Zotero 导入清单；**Tier 2** 方法可借鉴或结果可比 → 泛读笔记；**Tier 3** 仅背景 → 只进 references
   - `Knowledge/Literature-Review-{date}.md` 主题综述（现状→争议→方法演进）
   - `Knowledge/Research-Gaps.md` 研究空白清单（每条 gap 注明支撑文献）

## Output Contract

- vault 已绑定 → 写入 `Research/{slug}/` 对应目录；未绑定 → 就地 `{topic-slug}/` 同构目录（不阻塞）
- 完成后写 Daily 日志
- **Next Steps**：给用户的回流建议——有 gap 值得做 → `/research design <gap 主题>`；方法需要深学 → deep-paper-reading；已可写 → `/research write`

## 常见错误

| 错误 | 后果 | 防线 |
|------|------|------|
| 记录无标识符的"文献" | 引用幻觉，投稿即翻车 | 四标识符缺一不记录 |
| Tier 1 论文只读摘要 | 综述深度不够 | Tier 1 必须读全文（pdf_helper.py 分页） |
| 不查库存重复调研 | 浪费且与旧结论冲突 | Pre-flight 库存优先 |
| 系统调研不设检索预算 | 子代理过度检索，token 与时间失控 | 动态工作流硬上限 / deep-research 并发限额 |
| 把进展罗列当入门笔记 | 对新手不可读，违背产出定位 | 产出定位确认（第 0 步） |
