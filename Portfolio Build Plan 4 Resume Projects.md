# Portfolio Build Plan: 4 Resume Projects

Oct 15, 2026&#32;

## Read this first: what code can and cannot prove

About half of the resume's claims are build work Claude Code can do with you. The other half need real people or a measured run, and every number on the final resume must come from your own eval output, not from the current text.

| Project | Resume claim | Kind | What makes it true |
| --- | --- | --- | --- |
| Contract Clause | Interviewed four legal professionals | People | Four 30-minute calls before you pick clause types; notes in docs/interviews.md |
| Contract Clause | Precision 0.84, recall 0.91 | Measured | A held-out eval run with the match rule stated. Your numbers will differ; use yours |
| Visual Search | 20-product catalogue | Defect | Too small to test search: a top-10 list returns half the catalogue. Use 2,000+ products |
| Visual Search | Targeting 81% top-10 match, 650 ms | Defect | A target is not a result. Report the Recall@10 and p95 latency you achieve |
| Visual Search | Usability test with five shoppers | People | Five sessions, three tasks each, logged in docs/usability.md |
| Rental Tracker | 100+ UAT cases, 20+ bugs resolved | Measured | A test-case sheet and a bug list that exist; report the counts you actually reach |
| Rental Tracker | Trained five users; task time 30 to 5 min | People | The same task timed in a spreadsheet and in the app, by five users |
| Content Engine | Publishing to five platforms | Constraint | YouTube uploads stay private until an audit; X charges per post (see Project 4) |
| Content Engine | Measured production efficiency | Measured | A stopwatch baseline for manual videos vs per-stage logs over 10 runs |

The rule for every bullet: **Claim → Evidence → Artifact**. Each bullet states what you did, the number or observation behind it, and a file a reviewer can open. In plain terms: if no file proves a line, reword it or cut it.

## Build order and timeline

Build Contract Clause, then Visual Search, Rental Tracker and Content Engine, over about 9 weeks at roughly 12 hours a week. Open the slow accounts on day 1.

- **Contract Clause first.** It sets the eval habit and the FastAPI skeleton that Visual Search reuses.
- **Visual Search second.** Same backend shape, plus embeddings and a React front end.
- **Rental Tracker third.** The most PM-heavy build, and it needs five testers, so recruit them during weeks 1–4.
- **Content Engine last.** It has the most third-party accounts and the only real spend; approvals run in the background from day 1.

&#91;embedded content: build and people-work timeline · 9 weeks\]

Each people step lands just before the build that needs its result: interviews set the clause list in week 1, and the spreadsheet baseline is timed before the first Rental Tracker sprint.

Day-1 setup:

- [ ] Message 6–8 lawyers, paralegals or in-house counsel to land four 30-minute interviews in weeks 1–2
- [ ] LLM API key with a monthly spend cap
- [ ] Google Cloud project with the YouTube Data API enabled; decide whether to request the compliance audit
- [ ] Meta developer app; switch an Instagram account to Professional and link it to a Facebook Page
- [ ] LinkedIn developer app with the Share on LinkedIn product added
- [ ] X developer account with a few dollars of prepaid credit (skip if you would rather not pay)
- [ ] Free accounts: Supabase, Vercel, PostHog, Jira, Pexels API
- [ ] Line up five shoppers for week 4 and five rental test users for weeks 5 and 7

## Shared repo standard (all four repos)

Every repo uses the same skeleton so a reviewer finds the proof in under a minute: a README with a Results table, a committed eval folder, and a CLAUDE.md that keeps Claude Code on spec.

```text
<repo>/
  CLAUDE.md          # spec, stack, commands, rules; under 200 lines
  README.md          # problem, demo GIF, architecture, Results, how to run
  docs/PRD.md        # problem, users, scope, success metrics
  docs/decisions.md  # one line per decision and why
  eval/              # eval scripts + results/<date>.json, committed
  tests/
  .env.example       # every key named, no values
  Makefile           # make setup | make run | make test | make eval
```

What goes in each CLAUDE.md:

- Goal in two sentences, plus an explicit out-of-scope list
- Stack, folder layout and the make commands
- Data contracts: input and output schemas
- Definition of done for each milestone
- One hard rule: no metric is typed by hand. make eval writes a results JSON, and the README table is generated from it

Claude Code reads CLAUDE.md at the start of every session, and its docs recommend keeping the file under 200 lines ([source](https://code.claude.com/docs/en/memory)).

How to run each project in Claude Code:

1. Create the empty GitHub repo, add the CLAUDE.md, then paste that project's kickoff prompt (one per section below).
2. Ask for a plan per milestone first and approve it before any code is written.
3. Build one milestone per session; commit when its done-check passes.
4. Run make eval and commit the results file before you touch the README.

README Results block, where every number links to the file that produced it:

```markdown
## Results (run 2026-11-02, commit a1b2c3d)
| Metric | Value | Produced by |
| --- | --- | --- |
| <metric> | <from eval JSON> | eval/results/2026-11-02.json |
```

## Project 1: Contract Clause Assistant

A FastAPI service that finds renewal, termination and liability clauses in a contract, quotes the exact source text, and sends low-confidence answers to a human review queue, scored against CUAD's expert labels.

**Data.** CUAD v1 has more than 13,000 expert labels across 510 commercial contracts in 41 clause categories, licensed CC BY 4.0 ([dataset](https://huggingface.co/datasets/theatticusproject/cuad-qa)). The Hugging Face QA version has 22,450 train and 4,182 test rows. Split by contract, not by row, and hold out about 100 contracts you never tune prompts on.

**Scope.** In: six CUAD categories set by your interviews (default: Renewal Term, Notice Period To Terminate Renewal, Expiration Date, Termination For Convenience, Cap On Liability, Uncapped Liability), text and text-layer PDF input, a JSON API, a review queue. Out: scanned PDFs and OCR, redlining, multi-user auth, non-English contracts.

**Pipeline**

1. Ingest: extract text with character offsets (CUAD ships text; use pdfplumber for PDFs).
2. Chunk by paragraph, about 300–500 tokens with overlap, keeping each chunk's offsets.
3. Embed locally with a small sentence-transformers model into FAISS; add BM25 for exact legal phrases.
4. Retrieve the top-k chunks per category with a query written from that category's definition.
5. Extract: the LLM returns JSON per category with found, quote, chunk id and confidence.
6. Verify: the quote must appear verbatim in the cited chunk, or confidence is set to 0. This is the citation guarantee.
7. Route: anything under the confidence threshold, or failing the check, goes to a review queue in SQLite with accept and reject endpoints.

**API.** POST /contracts · GET /contracts/{id}/clauses · GET /review · POST /review/{item\_id}

**Eval (write it before tuning anything)**

- Unit: one contract × one category. Gold positive means CUAD has at least one answer span for it.
- True positive: the predicted quote overlaps a gold span with token Jaccard of 0.5 or more. State this rule in the README beside the numbers.
- Report per-category and overall precision and recall, a precision–recall curve across confidence thresholds, the share routed to review, and cost and latency per contract.
- Report retrieval recall@k separately: if the gold clause is not in the retrieved chunks, the LLM cannot find it. This shows where errors come from.
- Baseline: retrieval only (top chunk = answer), so the LLM's lift is visible.
- A promptfoo regression suite on 20 dev contracts, run before every prompt change.

**Milestones**

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Four interviews | docs/interviews.md holds notes and a ranked clause list that sets the six categories |
| M1 | Data and split | make data writes train/dev/test by contract and exports gold spans |
| M2 | Retrieval | Retrieval recall@k reported on dev |
| M3 | Extraction and quote check | Every answer has a verified quote or confidence 0 |
| M4 | Eval harness | make eval writes results JSON and a PR curve on the held-out test set |
| M5 | API and review queue | Endpoints tested; low-confidence items appear in /review |
| M6 | Product docs | README Results, success metrics and a B2B roadmap in docs/ |

**Interview script (30 min).** How do you review a contract today, step by step? Which clauses take longest or get missed? What does a missed clause cost? What would you need to see before trusting a tool's answer?

**Kickoff prompt**

```text
You are helping me build contract-clause-assistant, a portfolio project. Read CLAUDE.md first.
Goal: a FastAPI service that finds these CUAD clause categories in a contract: Renewal Term, Notice Period To Terminate Renewal, Expiration Date, Termination For Convenience, Cap On Liability, Uncapped Liability. Every answer cites a quote that must appear verbatim in the source; a quote that fails this check gets confidence 0 and goes to a review queue.
Stack: Python 3.12, FastAPI, sentence-transformers, FAISS, rank-bm25, SQLite, an LLM API with JSON output, pytest, promptfoo.
Data: theatticusproject/cuad-qa on Hugging Face. Split by contract into train/dev/test; never tune prompts on test.
Milestones: M1 data + split, M2 retrieval + recall@k, M3 extraction + quote check, M4 eval harness (precision/recall at token Jaccard >= 0.5, PR curve, cost per contract), M5 API + review queue, M6 README.
Rules: propose a plan for M1 and wait for my OK. Never type a metric by hand: make eval writes eval/results/<date>.json and the README table is generated from it. Commit at the end of each milestone.
```

## Project 2: Visual Search for Fashion

Upload a photo and get the ten most similar products from a catalogue of 2,000 or more, with recall and latency measured on real phone photos and a generic-versus-fashion model comparison.

**Fix the scope first.** The resume's 20-product catalogue cannot support a top-10 metric: ten results are half the catalogue, so even random ranking scores well. Build on 2,000–5,000 products and report what you achieve, not a target.

**Data.** ashraq/fashion-product-images-small on Hugging Face has 44,072 product images with gender, articleType, baseColour and display name ([dataset](https://huggingface.co/datasets/ashraq/fashion-product-images-small)). Sample 2,000–5,000 across about 10 article types.

**Models.** Generic OpenCLIP ViT-B-32 as the baseline versus Marqo-FashionCLIP, which loads directly in open\_clip as hf-hub:Marqo/marqo-fashionCLIP and is Apache 2.0 licensed ([model card](https://huggingface.co/Marqo/marqo-fashionCLIP)). The comparison is the experiment; one model alone is only a demo.

**Architecture**

1. Offline: embed the catalogue, L2-normalise, store in a FAISS inner-product index plus a parquet file of metadata.
2. API: FastAPI POST /search takes an image, embeds it and returns the top 10 with scores; below a similarity floor it returns no close match instead of junk.
3. UI: a React page with upload or camera, a results grid and category filter chips.
4. Analytics: PostHog events search\_submitted, result\_clicked (with rank and product id) and no\_match\_shown.

**Eval**

- Query set: 50–100 phone photos of real clothes (yours, friends', a shop), each labelled with article type and colour.
- Relevant means same articleType and baseColour. State this rule in the README.
- Metrics: Recall@10 (at least one relevant item in the top 10), Precision@10, MRR, and /search latency p50 and p95 measured end to end on your machine, with the CPU named.
- Rows to report: random baseline, generic OpenCLIP, FashionCLIP. The random row proves the metric means something.

**Usability test with five shoppers.** Three tasks each, such as find something like this shirt. Log success, time and the rank of the first click. Use PostHog click-by-rank data to change one thing in the layout, then re-run two sessions.

**Failure scenarios** for docs/PRD.md: a non-fashion photo, several garments in one photo, low light, and a product type missing from the catalogue.

**Milestones**

| # | Milestone | Done when |
| --- | --- | --- |
| M1 | Catalogue and index | make index builds a FAISS index for each model |
| M2 | Eval harness | Recall@10, P@10 and MRR for random, OpenCLIP and FashionCLIP |
| M3 | API and latency | p50 and p95 from a 200-query benchmark script |
| M4 | React UI and PostHog | Events visible in PostHog from a local session |
| M5 | Usability round | docs/usability.md with five sessions and one layout change |
| M6 | README | Results table, demo GIF, failure cases shown |

**Kickoff prompt**

```text
You are helping me build fashion-visual-search, a portfolio project. Read CLAUDE.md first.
Goal: upload a clothing photo and get the 10 most similar products from a 2,000-5,000 item catalogue sampled from ashraq/fashion-product-images-small on Hugging Face.
Stack: Python 3.12, open_clip, FAISS (inner product on normalised vectors), FastAPI, React + Vite, PostHog.
Compare two models: OpenCLIP ViT-B-32 and hf-hub:Marqo/marqo-fashionCLIP. Build one index per model.
Eval: my labelled phone photos in eval/queries/ (articleType + colour). Relevant = same articleType and baseColour. Report Recall@10, Precision@10, MRR and p50/p95 latency for a random baseline and both models.
Milestones: M1 catalogue + index, M2 eval harness, M3 API + latency benchmark, M4 React UI + PostHog events, M5 usability notes, M6 README.
Rules: plan M1 and wait for my OK. Never type a metric by hand: make eval writes eval/results/<date>.json. Commit at the end of each milestone.
```

## Project 3: Rental Operations Tracker

A Next.js and Supabase app that runs a small landlord's rent ledger (leases, monthly charges, partial payments, deposits and refunds) where the database itself blocks duplicate charges and missing deposits.

**Users and scope.** One landlord or property manager per account. In: properties and units, tenants, leases, monthly charge generation, payments split across charges, deposits with deductions and refunds, early move-out proration, overdue and pending-refund reports, Supabase Auth with row-level security. Out: collecting payments online, a tenant portal, multi-currency, accounting integrations (CSV export only).

**Data model**

| Table | Key fields | Rule that removes a risk |
| --- | --- | --- |
| properties, units, tenants | name, address, unit label, contact | Row-level security scopes every row to its owner |
| leases | unit, tenant, start, end, monthly\_rent, due\_day, move\_out\_date | Cannot go active without a deposit row or an explicit waiver (missing deposit records) |
| rent\_charges | lease, period, amount, due\_date | UNIQUE (lease\_id, period) makes duplicate rent charges impossible |
| payments | lease, amount, paid\_on, method, reference | Unique reference per lease stops double entry |
| payment\_allocations | payment, charge, amount | A trigger keeps allocations at or below the charge (partial payments) |
| deposits, deposit\_deductions | amount, received\_on, reason | Deductions above the deposit become an amount owed, never a negative refund |
| refunds | deposit, amount, status, paid\_on | Amount must equal deposit minus deductions |

Two SQL views are the reports: overdue\_rent (charges past due with a balance, and days overdue) and pending\_refunds (ended leases with no completed refund).

**Edge cases to write as acceptance criteria:** partial payment, overpayment held as credit, early move-out with a prorated final month, deductions larger than the deposit, a rent change mid-lease, lease renewal, and a charge job that retries and runs twice.

**PM artifacts.** docs/PRD.md, user stories with Given/When/Then acceptance criteria, a Jira board run as three one-week sprints, and a risk log listing each risk, its mitigation and the test that proves it.

**UAT.** A test-case sheet (ID, precondition, steps, expected, actual, pass or fail) covering every story and edge case; 8 modules at 12–15 cases each lands near 100 honestly. Log each failure as a Jira bug linked to its case, and automate the 15 most critical paths with Playwright so fixes stay fixed.

**Timed user test.** Task: record a month's rent, one partial payment and one deposit refund for three units. Each of five users does it once in a spreadsheet (the baseline) and once in the app after a 10-minute walkthrough, alternating the order between users. Report the median time for each.

**Hosting.** Vercel and Supabase free plans. Supabase pauses free projects that show low activity over 7 days ([docs](https://supabase.com/docs/guides/platform/free-project-pausing)), so keep a seed script and resume or ping the project before you share the demo link.

**Sprints**

| Sprint | Scope | Done when |
| --- | --- | --- |
| S0, 2 days | PRD, data model, Jira, risk log, spreadsheet baseline task | PRD reviewed; five testers booked |
| S1 | Schema, RLS, CRUD for properties, units, tenants, leases | Migrations apply cleanly; RLS tests pass |
| S2 | Charges, payments, allocations, deposits, refunds, reports | Every edge-case acceptance test passes |
| S3 | UAT run, bug fixes, user guide, training, timed test | UAT sheet complete; timings in docs/user-test.md |

**Kickoff prompt**

```text
You are helping me build rental-ops-tracker, a portfolio project. Read CLAUDE.md and docs/PRD.md first.
Goal: a rent ledger for a small landlord: properties, units, tenants, leases, monthly rent charges, payments allocated across charges (partial payments), deposits, deductions, refunds, early move-out proration, and two reports: overdue rent and pending refunds.
Stack: Next.js (App Router, TypeScript), Supabase (Postgres, Auth, row-level security, migrations), Vitest, Playwright.
Database rules come first: UNIQUE(lease_id, period) on rent_charges; allocations can never exceed their charge; a lease cannot go active without a deposit row or an explicit waiver; refund = deposit minus deductions. Reports are SQL views.
Sprints: S1 schema + RLS + CRUD, S2 money flows + reports, S3 UAT fixes + user guide.
Rules: start S1 with the schema and RLS tests, show me each migration before applying it, and commit at the end of each sprint.
```

## Project 4: AI Content Automation Engine

A self-hosted n8n pipeline that turns a topic into a captioned short video and publishes it, with two quality gates and a run log so the efficiency claim has data behind it.

&#91;embedded content: content pipeline · 8 stages, 2 QC gates, 5 publish targets\]

Both gates send a failure back one step instead of forward, and every stage inside the bracket writes its timing and cost to the run log.

**Stack.** n8n self-hosted in Docker; an LLM API for research summaries and scripts; text-to-speech (a hosted voice API or an open-source local model); Whisper for word-timed captions; the Pexels API for B-roll; a music and SFX folder you curate from royalty-free sources; FFmpeg for assembly and render. Export every workflow as JSON into the repo. Secrets live in n8n credentials, never in git.

**Quality gates**

- Script QC: an LLM rubric (hook in the first line, one idea, claims match the research sources) plus rule checks (word count for the target length, banned phrases). A fail triggers a rewrite, at most twice, then the run stops for you.
- Video QC: FFmpeg checks for duration, 9:16 resolution, loudness (ebur128), black frames (blackdetect) and caption timing against the audio. A fail returns to editing.

**Publishing constraints**

| Platform | Access route | Catch |
| --- | --- | --- |
| YouTube | Google Cloud project, OAuth, videos.insert | Uploads from unverified projects created after 28 July 2020 are locked to private until the project passes an audit ([docs](https://developers.google.com/youtube/v3/docs/videos/insert)) |
| Instagram | Professional (Business or Creator) account, Meta app, content-publishing permission | Capped at 100 API posts per 24 hours; media must sit at a public URL ([docs](https://developers.facebook.com/documentation/instagram-platform/content-publishing)) |
| Facebook | A Facebook Page plus a Meta app with Page publishing permission | Posts go to a Page, not a personal profile |
| LinkedIn | Self-serve Share on LinkedIn product, w\_member\_social scope, your own profile | Tokens last 60 days and self-serve apps get no refresh token, so you re-authorise ([explainer](https://opentweet.io/answers/can-i-post-to-linkedin-without-partner-approval)) |
| X | Prepaid pay-per-use credits; no free tier for new developers since February 2026 | $0.015 per post, $0.20 if the post contains a link ([explainer](https://invisibleapi.ai/blog/x-api-pricing/)) |

**Measuring efficiency.** Make three videos by hand in the same format with a stopwatch running: that is the baseline. Then run the pipeline 10 times. The run log records wall-clock time per stage and your hands-on minutes (approvals, fixes). Report median hands-on minutes per video, manual versus pipeline, plus cost per video.

**Honest scope option.** If X credits or the YouTube audit are not worth it, publish for real to LinkedIn, Instagram and Facebook, upload to YouTube as private, skip X, and say exactly that on the resume.

**Milestones**

| # | Milestone | Done when |
| --- | --- | --- |
| M1 | n8n in Docker; topic to research to script | Script and sources saved for 3 topics |
| M2 | Script QC gate | Rubric scores logged; a bad script loops and recovers |
| M3 | Faceless video: voice, captions, B-roll, music, render | A 9:16 MP4 under 60 seconds from one trigger |
| M4 | Video QC gate | Each check fails on a deliberately broken file |
| M5 | Avatar stage (optional) | One avatar clip assembled in the same pipeline |
| M6 | Publishing | Posted to each platform you kept, with post IDs logged |
| M7 | Measurement and README | 10-run results and sample videos linked |

**Kickoff prompt**

```text
You are helping me build content-engine, a portfolio project. Read CLAUDE.md first.
Goal: an n8n pipeline (self-hosted in Docker) that turns a topic row into a 9:16 captioned short video and publishes it: research with sources -> script -> script QC gate -> TTS voice -> optional avatar clip -> captions (Whisper), B-roll (Pexels API), music and SFX from assets/ -> FFmpeg render -> video QC gate -> publish.
Every stage writes start, end, cost and hands-on minutes to a run log (SQLite). Script QC: LLM rubric + rule checks, max 2 rewrites. Video QC: duration, resolution, loudness (ebur128), black frames (blackdetect), caption timing.
The repo holds exported n8n workflow JSON, the Python/FFmpeg scripts n8n calls, docker-compose.yml and .env.example. No secrets in git.
Milestones: M1 research + script, M2 script QC, M3 faceless render, M4 video QC, M5 optional avatar, M6 publishing, M7 measurement + README.
Rules: plan M1 and wait for my OK. Commit at the end of each milestone.
```

## Costs and free-tier choices

Everything except LLM calls, an avatar and X posts runs on free plans; cap those three and the whole portfolio stays cheap.

| Item | Used in | Cost (October 2026) | Cheaper route |
| --- | --- | --- | --- |
| LLM API | Projects 1 and 4 | Per token; set a monthly cap | Price a 10-contract run first, then extrapolate before the full eval |
| HeyGen API (avatar) | Project 4 | Pay-as-you-go from $5, no free API credits since February 2026, from about $1 per avatar minute ([explainer](https://omidsaffari.com/blog/heygen-pricing)) | Faceless format: voice, B-roll and captions |
| X API | Project 4 | $0.015 per post, $0.20 with a link | Post without links, or skip X |
| Text-to-speech | Project 4 | Varies by hosted voice API | An open-source local TTS model |
| Supabase, Vercel, PostHog, Jira, Pexels, n8n self-hosted | Projects 2–4 | Free plans | Already free |
| Compute for embeddings | Project 2 | A laptop CPU handles 5,000 images | A free notebook GPU if it is slow |

## Rewriting the resume bullets

Write each project as three or four bullets: what you built, how you measured it, and the number your eval produced. Brackets are blanks for your own results, not targets.

**Contract Clause Assistant**

- Interviewed \[N\] legal professionals and prioritised \[clause types\] from the reviews they found slowest or riskiest.
- Built a RAG clause extractor (FastAPI, FAISS + BM25, \[LLM\]) on CUAD with verbatim, source-linked citations.
- Scored precision \[x\] and recall \[y\] on \[N\] held-out contracts (token-overlap match), routing \[z\]% of answers to human review.

**Visual Search for Fashion**

- Built image search over \[N\] products with OpenCLIP, Marqo-FashionCLIP, FAISS, FastAPI and React.
- The fashion model reached Recall@10 of \[x\] versus \[y\] for generic CLIP on \[N\] real phone photos, at \[z\] ms p95 latency on CPU.
- A usability test with \[N\] shoppers plus PostHog click data led to \[layout change\].

**Rental Operations Tracker**

- Wrote the PRD, user stories and acceptance criteria for leases, rent, partial payments and deposit refunds.
- Shipped a Next.js and Supabase app whose database rules block duplicate rent charges and missing deposit records.
- Ran \[N\] UAT cases over three one-week Jira sprints and fixed \[N\] bugs.
- Median task time fell from \[a\] min in a spreadsheet to \[b\] min in the app across \[N\] users.

**AI Content Automation Engine**

- Built an n8n pipeline from topic to published short video across \[N\] stages, with script and video QC gates.
- Publishes to \[platforms that actually work\]; \[YouTube uploads stay private pending the API audit, if true\].
- Median hands-on time per video fell from \[a\] to \[b\] min over \[N\] runs, at \[$c\] per video.

If a people step did not happen, delete that bullet rather than keep a softened version. Link each GitHub repo, and make sure every bracketed value appears in that repo's Results table.
