# Vendored source documents

## constitution-of-india.pdf

- Document: THE CONSTITUTION OF INDIA, as on 1 May 2026
- Publisher: Government of India, Ministry of Law and Justice, Legislative Department
- Source URL: https://www.legislative.gov.in/static/uploads/2025/07/c9fe9c9b6840524844316f74bb1c556c.pdf
- Downloaded: 31 August 2026 (curl with a browser user agent; the HTML portal blocks generic bots)
- Pages: 402, PDF 1.7
- Verification: cover page and article index text extracted with pdftotext and checked by hand
- License: statutes are public domain in India (EBC v. D.B. Modak, 2008)

This file is the canonical text source for the extraction pipeline. It is committed to the repository on purpose so that builds and tests never depend on government servers being reachable. When a newer edition is published, download it here, update this README, and rerun the pipeline.

## constitution-of-india-hindi.pdf

- Document: CONSTITUTION OF INDIA (Rajbhasha/Hindi edition), as on 1 May 2026, current through the 106th Amendment
- Publisher: Government of India, Ministry of Law and Justice, Legislative Department
- Source URL: https://www.legislative.gov.in/static/uploads/2025/08/575648bd8ecb7654db902b93115d35e4.pdf
- Downloaded: 5 September 2026 (curl with a browser user agent)
- Pages: 803, PDF 1.7, diglot layout (Hindi and English on facing pages)
- Verification: cover and contents checked by hand; the Hindi Preamble (page 63) published on this site was verified by two-source cross-check, text layer against rendered page, on 5 September 2026
- Known defect: the PDF text layer corrupts Devanagari shaping (the i-matra is dropped or displaced, conjuncts reorder), so naive pdftotext output is unpublishable. Every Hindi text published here must pass a two-source cross-check, text layer against rendered page, before release.
- License: statutes are public domain in India (EBC v. D.B. Modak, 2008)

This file is the canonical source for the Hindi edition. Phase 1 publishes the verified Hindi Preamble on the Preamble page; the full Hindi pipeline is Phase 2.
