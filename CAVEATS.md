# What is real and what is not

| What | Status |
|---|---|
| PDF text extraction | Real, in the browser. Text-based PDFs only; scanned or photographed pages return nothing (no OCR). |
| Document length | Only the first ~6,000 characters (about 2–3 pages) are analyzed. Clauses later in a long packet are missed. |
| Clause detection | Real AI call (NVIDIA `nemotron-3.5-lightning-30b-a3b`). It can miss clauses or flag harmless ones. |
| Summary | AI-written from the analyzed text only. It can leave out or misstate details; check it against the document. |
| Quotes | The AI is told to quote word for word, but quotes are not checked against the document. |
| Risk levels | The model's own judgment. There is no written rubric behind High / Medium / Low. |
| Saving | Each analysis and its clauses are saved to Supabase. There is no screen to view past analyses yet. |
| Login | None. Anyone with the URL can use it, and all results go into one shared database. |
| Privacy | Analyzed document text is stored. Do not upload real patient documents; use blank or sample forms. |
| Speed | Depends on NVIDIA's free servers. The page counts seconds; if NVIDIA hasn't finished in 5 minutes (or errors sooner), Cloudflare's own AI answers instead. |
| Model availability | Free NVIDIA endpoint. Two models were retired mid-build; this one may be too. |
| Usage limits | No rate limit, so heavy use could run out NVIDIA free credits. |
| Testing | Checked by hand on a small number of sample PDFs. No automated tests. |
| Language | English documents only. |

This is a screening aid for trained professionals, not legal advice.
