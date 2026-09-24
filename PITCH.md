# FineRead: two-minute pitch

Before you rehearse, fill in the two bracketed blanks with numbers from your own demo run. Stage directions are in *italics*; don't read them aloud.

## 0:00–0:30 · The problem

A patient is being admitted tonight. Their social worker has a stack of paperwork and about ten minutes. Somewhere in those pages there may be one sentence that says the patient gives up the right to sue, or agrees to private arbitration, or lets the hospital share their records for marketing. Nobody has time to read every line, so that sentence gets signed.

## 0:30–1:30 · What we built

This is FineRead. *(Open the site.)*

We drop in an admission PDF. *(Drop the PDF.)*

In [__] seconds, FineRead gives a plain-English summary of the document and flags [__] clauses that take away a patient's rights, ranked high, medium, and low risk. *(Point to the risk overview.)*

Every clause shows the exact sentence from the document and what it means. FineRead also checks each quote against the document itself, so if the AI ever paraphrases or makes something up, the reader sees a warning.

We built it to be trusted. We wrote seventeen edge cases across five kinds of bad input: empty, broken, malicious, off-topic, and huge. Then we ran five rounds of red-team attacks and fixed fifteen wrong answers they found. Today, all twenty-four attacks pass.

It also protects itself. It refuses documents that aren't hospital forms, so it can't be used as a free summarizer. The same PDF uploaded three times calls the AI once. And if NVIDIA is slow, a backup AI answers instead.

Every result is saved to History.

## 1:30–2:00 · What was hard

The hardest part was trust. An AI that sounds confident but invents a clause is worse than no tool at all. So we spent as much time trying to break FineRead as building it.

The next step is reading full admission packets, not just the first pages.

FineRead points trained professionals to the paragraph that matters. They make the call. Thank you.
