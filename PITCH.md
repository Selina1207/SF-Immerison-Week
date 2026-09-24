# Two-minute pitch

Fill in the three blanks in brackets with numbers from your own demo run before you rehearse.

## 0:00–0:30 · The problem

Picture a hospital social worker at 7 a.m. A patient is being admitted, and there is a stack of admission paperwork to sign. Somewhere in those pages there may be a sentence that says the patient gives up the right to sue, or agrees to private arbitration, or lets the hospital share their records. The social worker has minutes, not hours, and nothing to point them to the one paragraph that matters.

## 0:30–1:30 · What we built

This is Patient Rights Analyzer. [Open the site.]

I drop in an admission PDF. [Drop the PDF.]

The page reads the text right in the browser. The AI then looks for clauses that take away a patient's rights: arbitration, liability limits, broad consent to share records, and financial guarantees.

In [__] seconds it gives a plain-English summary of the whole document, and it found [__] clauses in a [__]-page document. [Point to the risk overview.]

Each one shows the exact sentence from the document, the right it affects, a plain-English explanation, and a risk level, so the reader can go straight to the paragraph that matters.

Every result is saved to a database, so there is a record of what was flagged and when.

It is built for trained professionals. It points them to the right paragraph, and they make the call.

## 1:30–2:00 · What was hard

The hardest part was getting the AI to give real answers. At first it copied my instructions back instead of quoting the document, so I changed it to return structured data and to throw away anything that was not a real clause. Two of the AI models I started with were retired in the middle of the week, so I switched models twice.

Right now it reads the first few pages of a document. Reading full admission packets is the next step.

Thank you.
