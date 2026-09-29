# MCP Search and Read Routing

All skills and agents MUST follow this routing table when searching or reading web content.

## Search Routing

| Channel | Intent | Tool | Notes |
|---------|--------|------|-------|
| **A (biomed)** | Biomedical/life-science literature needing citable PMID/DOI | Bash `curl` Europe PMC REST API (see below) | **Free** (keyless). Reachable when NCBI is blocked. Richest source for this AI+Medicine repo |
| **B (general web)** | Non-biomed web, GitHub, news, technical | `mcp__brave-search__brave_web_search` | Free tier ~2 QPS. **Often fails** (proxy/2 QPS) → channel C backs it up |
| **C (general web, robustness)** | Same general-web intent as B, run **in parallel** with B | `WebSearch` | ⚠️ NOT unlimited — relays to Zhipu `web_search_prime`, shares quota. In **default** loop because brave often fails |
| **D (CN-specific)** | CNKI, WeChat, Chinese academic sources | `mcp__web-search-prime__web_search_prime` | Add as 4th channel when CN needed. Zhipu quota |
| **E (method/code)** | Analysis method, parameters, pipeline, SOP — "how do people actually run this?" | `mcp__github__search_code` / `search_repositories` → `mcp__zread__read_file` / `search_doc` | Discovery **free** (PAT); deep-read shares Zhipu quota. **Triggered for method/parameter dimensions** (experiment-note method determination), NOT in the default A+B+C literature loop |
| **local** | Physical location / business | `mcp__brave-search__brave_local_search` | Free tier |

**Default = run A+B+C in parallel per query and merge.** brave's unreliability is the reason C (quota-burning) is in the default loop despite its cost — coverage robustness > quota frugality here. **Add Channel E (GitHub) when the dimension is method/parameter/code-oriented** (experiment notes, SOP, analysis-parameter determination) — see "GitHub for Method & Parameter Determination" below.

### Academic Literature via Europe PMC

生物医学文献调研的**首选稳定通道**（NSFC 医学方向核心库）：无需 API key，`curl` 直连 `www.ebi.ac.uk`，一次调用返回 PMID/DOI/标题/期刊/年份/作者/摘要。**⚠️ NCBI `eutils.ncbi.nlm.nih.gov` 在本机被完全封锁**（curl 直连/代理 7897/WebFetch 均失败），Europe PMC 是其稳定替代——覆盖同一 PubMed/MED 内容，且单接口比 esearch+efetch 两步更简洁。

```bash
# 主题检索（关键词+布尔 AND/OR，空格用 %20；resultType=core 带摘要；SRC:MED 限 PubMed 内容）
curl -s "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=8&query=<query>%20SRC:MED"

# compact 提取（标题/摘要/期刊/年份）
... | python3 -c "import sys,json;[print(r.get('pmid'),'|',r.get('pubYear'),(r.get('journalTitle','') or '')[:22],'|',(r.get('title','') or '')[:88],'|',(r.get('abstractText','') or '')[:200]) for r in json.load(sys.stdin).get('resultList',{}).get('result',[])]"

# 批量校验/核实 PMID（防 subagent 张冠李戴——2026-08-10 多次抓出错误 PMID）
curl -s "https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&pageSize=30&query=(ext_id:PMID1%20OR%20ext_id:PMID2)%20SRC:MED"

# 按 DOI 反查 PMID；按精确标题查
# query=DOI:10.xxx     /     query=title:%22phrase%22
```

- **何时用**：任何需要可引 PMID 的生医调研（`/research-init`、`deep-research`、文献综述、标书立项依据）。outage 期间（Zhipu/brave/WebSearch 全挂）仍是唯一可用学术通道。
- **不限速**：免费 keyless，无 NCBI 的 3 req/s 限制，可适度并发。
- **覆盖**：`SRC:MED` = PubMed/MED 内容；不加则含预印本/专利。预印本/网页/非生医走 brave-search（免费优先）或 WebSearch（Zhipu 额度）。
- **查询注意**：默认相关性排序最稳；`sort=` 参数较挑（`sort=CITED desc` 可用，**避免 `P_DATE:desc`** 会致 hitCount=None）；MeSH `MESH:` 字段语法挑剔，**优先关键词+布尔**。
- **防幻觉纪律**：subagent 返回的 PMID **落盘前用 `ext_id:` 批量核实一次**（见 `reference_mcp_tools`）。

### GitHub for Method & Parameter Determination

分析方法与参数的**实现层 ground truth**——文献只报告"用了什么方法/什么参数"，GitHub 给"具体怎么跑、默认参数、canonical SOP"。**实验笔记（`Experiments/`）撰写、分析调研门、pipeline 参数确定时首选 Channel E**。

```bash
# 1. 发现 canonical repo / 真实用法（FREE，PAT）
mcp__github__search_code            # 搜函数/参数用法，query 必含语言+库名
mcp__github__search_repositories    # 搜工具仓库

# 2. 深读 repo 文件/SOP（Zhipu 额度，max 2 并发）
mcp__zread__get_repo_structure      # 看 repo 结构，定位 scripts/ docs/
mcp__zread__read_file               # 读具体脚本/README，取默认参数
mcp__zread__search_doc              # 搜 repo 文档/issues，定位参数说明
```

- **何时用**：方法笔记撰写（`deep-research`/`deep-paper-reading` → `Experiments/`）、analysis 调研门、参数不确定（如 CopyKAT `KS.cut`、CellChat `expr_prop`、DEqMS 阈值、MOFA2 `scale`）、找可复用 pipeline。
- **成本**：github 搜索免费；zread 深读共享 Zhipu key（与 web-reader/web-search-prime 同 key）。
- **纪律**：**不克隆 repo**（用 zread 读）；先 github search 定位再 zread 读，避免无目的深读烧额度。

### Decision Flow

```
DEFAULT: run 3 channels in parallel per query, merge results:
  - Channel A: Europe PMC curl (biomed, free)      — skip if non-biomed
  - Channel B: brave-search (general web, free)   — may fail
  - Channel C: WebSearch (general web, Zhipu quota) — backs up B
  Rationale: brave frequently fails → parallel C ensures coverage; A is the richest biomed source.
Add-ons:
  CN source (CNKI/WeChat) → Channel D: web-search-prime (location: "cn")
  Method/param/code dimension → Channel E: GitHub (search_code/search_repositories free → zread deep-read, quota)
  Physical location → brave-local-search
```

### Parallel Search

- Literature review (biomed): A (Europe PMC) + B (brave) + C (WebSearch) in parallel; merge
- Technical investigation: B (brave) + C (WebSearch) in parallel (+ A if biomed-adjacent); merge
- Fact-checking: same 3-channel parallel per claim
- **NEVER send >3 parallel MCP search calls in one batch** — the 3 channels above ARE the per-dimension batch budget

## Rate Limit Protection (MANDATORY)

| Tool | Rate Limit | Usage Rule |
|------|-----------|------------|
| Europe PMC `curl` | **Free, keyless, no rate cap** | Channel A; fan out freely (NCBI `eutils` 在本机被封，Europe PMC 是替代) |
| `WebSearch` | **Zhipu-relayed (shared quota)** | ⚠️ NOT unlimited — relays to Zhipu `web_search_prime`, shares quota with all 6 Zhipu servers. **Channel C, in default loop** (brave often fails) |
| `web-search-prime` | Shared Zhipu key (3 MCP servers share 1 key) | Channel D (CN-specific); max ~2 calls/minute |
| `web-reader` | Same shared Zhipu key | Max 2 concurrent fetches |
| `zread` | Same shared Zhipu key | Max 2 concurrent calls |
| `brave-search` | Free tier ~2 QPS | General non-biomed search (free, proxy-stable); mind ~2 QPS under fan-out. Also local-search |

**Global constraint**: At any given moment, total concurrent MCP calls to Zhipu-family servers (web-search-prime + web-reader + zread) must not exceed **3**.

## Deep Read Routing

| Source | Tool | Notes |
|--------|------|-------|
| Web page (needs full content) | `mcp__web_reader__webReader` | Returns markdown with images |
| PDF (local/URL, ≤5 pages) | `mcp__pdf-reader__read_pdf` | Use `pages` parameter, max 20 pages per call |
| PDF (local, >5 pages) | `scripts/pdf_helper.py` | Avoids token overflow |
| PDF (Zotero-stored) | `zotero_get_item_fulltext` | First choice if paper is in Zotero |
| GitHub repo (no clone) | `mcp__zread__get_repo_structure` + `read_file` + `search_doc` | Read pipeline code without cloning |

### PDF Reading Priority

```
1. Zotero fulltext (if paper is in library)
2. scripts/pdf_helper.py (local PDF, >5 pages)
3. mcp__pdf-reader__read_pdf (local/URL PDF, ≤5 pages, use pages parameter)
4. mcp__web_reader__webReader (arXiv HTML version)
```

## Vision Routing (GLM-5.3-flash main-model vision — 2026-09-28 起)

**默认 = 主模型 `Read` 直读图像**：GLM-5.3-flash 有原生视觉，本地/远程 PNG/JPG 直接 Read 进上下文。优势：ground truth（CSV/表）在会话内即时对账、render→Read→修 自闭环、零 MCP 配额、subagent 同模型同能力。

| Task | Tool |
|------|------|
| Paper figure / data chart analysis | **`Read`** the rendered PNG |
| Analysis result figure QC | **`Read`** PNG + 与脚本/CSV 交叉核实 |
| General image analysis | **`Read`** |
| Error screenshot diagnosis | **`Read`** |
| Technical diagram / architecture | **`Read`** |
| Text extraction from screenshot | **`Read`** |

**Fallback**（主模型视觉不可用或需独立第二意见时才用）：`zai-mcp-server`（`analyze_data_visualization` / `analyze_image` / `diagnose_error_screenshot` / `understand_technical_diagram` / `extract_text_from_screenshot`）；`4_5v_mcp` 仅吃 remote URL。zai 系仍占 Zhipu 配额，遵守全局 ≤3 并发。

### Vision Usage Patterns

- PDF 图表：`scripts/pdf_helper.py figure` 渲染 PNG → **`Read`** out_path（不要把 PDF 路径直接给任何 vision 通道）
- Figure QC 纪律不变：vision 读数（主模型与外部模型 alike）必须与脚本/CSV 交叉核实，禁止纯 vision 断言
- 修图自闭环：生成图后直接 `Read` 验证标签/图例/裁剪/配色，发现问题改脚本重渲染再 `Read`，直到通过

## Recency Filters

- `web-search-prime`: `search_recency_filter: "oneMonth"` for recent, `"oneYear"` for general
- `brave-search`: Use freshness parameter if available
- `WebSearch`: Include year in query (e.g., "2025 2026")

## Prohibited Patterns

- Do NOT read an entire large PDF via pdf-reader without the `pages` parameter
- Do NOT clone a GitHub repo just to read a few files — use zread instead
- Do NOT exceed 3 concurrent MCP calls to Zhipu-family servers at any time
