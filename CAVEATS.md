# What is real and what is not

| What | Status |
|---|---|
| PDF text extraction | Real, in the browser. Text-based PDFs only; scanned or photographed pages return nothing (no OCR). |
| Document length | Only the first ~6,000 characters (about 2–3 pages) are analyzed. The page says which pages were covered, but clauses later in a long packet are missed (see EDGE_CASES.md S1). |
| Clause detection | Real AI call: NVIDIA `nemotron-3.5-lightning-30b-a3b`, with Cloudflare `llama-3.3-70b-instruct-fp8-fast` as the backup. It can miss clauses or flag harmless ones. |
| Summary | AI-written from the analyzed text only. It can leave out or misstate details; check it against the document. |
| Quotes | Checked against the document text. A quote that isn't found gets a warning, but a found quote can still be summarized wrongly. |
| Risk levels | The model's own judgment. There is no written rubric behind High / Medium / Low. |
| Saving and History | Each analysis is saved to Supabase and listed under History in the browser that ran it. The list lives in that browser, so another device or cleared browser data won't show it. The original PDF is not stored, only the analyzed text and results. |
| History access | There's no login. Each analysis is protected only by its long random id, which the browser keeps. Anyone who gets hold of an id can open or delete that analysis. |
| Login | None. Anyone with the URL can use it, and all results go into one shared database. |
| Privacy | Analyzed document text is stored. Do not upload real patient documents; use blank or sample forms. |
| Speed | Depends on NVIDIA's free servers. The page counts seconds; if NVIDIA hasn't finished in 5 minutes (or errors sooner), Cloudflare's own AI answers instead. |
| Model availability | Free NVIDIA endpoint. Two models were retired mid-build; this one may be too. |
| Usage limits | 10 analyses per minute per internet connection. Everyone on one network (a classroom, for example) shares that limit. |
| Testing | Edge cases across five axes, with fixture files, are in EDGE_CASES.md. `scripts/probe.mjs` red-teams the live site. There is no automated test suite in CI. |
| Scope limit | Documents without at least 2 medical or hospital terms are refused before the AI runs. Documents the AI marks as out of scope are refused with no summary or clauses. A real hospital form the AI misjudges would be refused too, and there's no override. |
| Language and scope | Tested on English hospital documents. The AI reports the language and whether the document is in scope, and the page warns when either looks off, but that detection can be wrong. |
| Prompt injection | The document is sent as data with instructions to ignore any commands inside it. This lowers the risk; it doesn't remove it. |

This is a screening aid for trained professionals, not legal advice.
