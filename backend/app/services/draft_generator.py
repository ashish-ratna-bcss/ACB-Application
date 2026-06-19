"""
Pure mechanical mapping: sub-document content → ACB Final Report template.
Zero AI calls. Zero inference. Missing data → "TO DO" literal.
"""
from __future__ import annotations

TODO = "TO DO"

# ── Static legal texts (verbatim from template / model DFR) ──────────────────
# These appear identically in every ACB Final Report. Never AI-generated.

SUPREME_COURT_CASES_TEXT = (
    "The Hon'ble Supreme Court of India has held in the following cases that departmental "
    "proceedings can be conducted simultaneously with criminal proceedings:\n\n"
    "1. State of Rajasthan Vs. B.K. Meena & Others (1996) 6 SCC 417 — It is open to the "
    "State Government to conduct departmental proceedings simultaneously with the criminal "
    "trial.\n\n"
    "2. Capt. M.Paul Anthony Vs. Bharat Gold Mines Ltd. (1999) 3 SCC 679 — Departmental "
    "proceedings and criminal proceedings can go on simultaneously.\n\n"
    "3. Kendriya Vidyalaya Sangathan Vs. Ram Ratan Yadav (2003) 3 SCC 789 — There is no "
    "legal bar to conduct of departmental proceedings simultaneously with criminal "
    "proceedings.\n\n"
    "4. Divisional Controller, KSRTC Vs. M.G. Vittal Rao (2012) 1 SCC 442 — Departmental "
    "inquiry and criminal trial can go on simultaneously.\n\n"
    "5. Depot Manager, APSRTC Vs. V.Vinodh Kumar & Others AIR 2006 SC 2801 — Simultaneous "
    "departmental proceedings are permissible.\n\n"
    "6. Union of India & Others Vs. B.V. Gopinath AIR 2014 SC 1119 — Departmental "
    "proceedings are not stayed merely because criminal proceedings are pending.\n\n"
    "7. Ashoo Surendranath Tewari Vs. Deputy Superintendent of Police (2020) 9 SCC 636 — "
    "The pendency of a criminal case does not bar initiation or continuation of departmental "
    "proceedings.\n\n"
    "8. Ajit Kumar Nag Vs. General Manager (PJ), Indian Oil Corporation Ltd. (2005) 7 SCC "
    "764 — Simultaneous departmental inquiry is permissible.\n\n"
    "9. P.V. Joseph Vs. State of Kerala (2003) — Departmental and criminal proceedings can "
    "proceed simultaneously.\n\n"
    "10. High Court of Punjab & Haryana Vs. State of Haryana (2011) — The mere pendency of "
    "criminal prosecution does not operate as a bar to holding of departmental inquiry."
)

SECTION_19_PC_ACT_TEXT = (
    "Section 19 of the Prevention of Corruption Act, 1988 (as amended by the Prevention of "
    "Corruption (Amendment) Act, 2018):\n\n"
    '"19. Previous sanction necessary for prosecution. — (1) No Court shall take cognizance '
    "of an offence punishable under Sections 7, 11, 13 and 15 alleged to have been committed "
    "by a public servant, except with the previous sanction, save as otherwise provided in "
    "the Lokpal and Lokayuktas Act, 2013,—\n"
    "(a) in the case of a person who is employed in connection with the affairs of the Union "
    "and is not removable from his office save by or with the sanction of the Central "
    "Government, of the Central Government;\n"
    "(b) in the case of a person who is employed in connection with the affairs of a State "
    "and is not removable from his office save by or with the sanction of the State "
    "Government, of the State Government;\n"
    "(c) in the case of any other person, of the authority competent to remove him from his "
    "office.\n\n"
    "(3A) The competent authority shall endeavour to convey its decision on the request for "
    "sanction for prosecution within a period of three months from the date of receipt of "
    "the request.\n\n"
    "(3B) Where the competent authority fails to convey its decision within the period "
    'specified under sub-section (3A), the sanction applied for shall be deemed to have been granted."'
)

TCS_CONDUCT_RULES_TEXT = (
    "The conduct of the Accused Officer is in violation of the Telangana Civil Services "
    "(Conduct) Rules, 1964. Rule 3 of the said Rules reads as under:\n\n"
    '"Rule 3. General:\n\n'
    "(1) Every Government servant shall at all times —\n"
    "    (i) maintain absolute integrity;\n"
    "    (ii) maintain devotion to duty; and\n"
    "    (iii) do nothing which is unbecoming of a Government Servant.\n\n"
    "(2) Every Government servant holding a supervisory post shall take all possible steps "
    "to ensure the integrity and devotion to duty of all Government servants for the time "
    "being under his control and authority.\n\n"
    "(3) No Government servant shall, in the performance of his official duties, or in the "
    "exercise of powers conferred on him, act otherwise than in his best judgement except "
    "when he is acting under the direction of his official superior, and shall, where he is "
    "acting under such direction, obtain the direction in writing wherever practicable, and "
    "where it is not practicable to obtain the direction in writing, shall obtain written "
    'confirmation of the direction as soon thereafter as possible."\n\n'
    "By demanding and accepting bribe amount as illegal gratification, the Accused Officer "
    "has failed to maintain absolute integrity and devotion to duty and has acted in a manner "
    "unbecoming of a Government Servant, thereby violating Rule 3(1)(i), 3(1)(ii) and "
    "3(1)(iii) of the Telangana Civil Services (Conduct) Rules, 1964."
)

SECTION_7_DIFFERENCE_TEXT = (
    "Difference between old Section 7 and amended Section 7 of the Prevention of Corruption "
    "Act, 1988:\n\n"
    "Old Section 7 (before Amendment Act, 2018):\n"
    '"Whoever, being, or expecting to be a public servant, accepts or obtains or agrees to '
    "accept or attempts to obtain from any person, for himself or for any other person, any "
    "gratification whatever, other than legal remuneration, as a motive or reward for doing "
    "or forbearing to do any official act or for showing or forbearing to show, in the "
    "exercise of his official functions, favour or disfavour to any person or for rendering "
    "or attempting to render any service or disservice to any person, with the Central, "
    "Provincial or State Government or Legislature, or with any public servant, as such, "
    "shall be punishable with imprisonment which shall be not less than six months but which "
    'may extend to five years and shall also be liable to fine."\n\n'
    "New Section 7 (after Amendment Act, 2018):\n"
    '"A public servant shall be guilty of an offence if he— (a) accepts or obtains or agrees '
    "to accept or attempts to obtain, by himself or through any other person, any undue "
    "advantage, with intention to perform or cause performance of public duty improperly or "
    "dishonestly or to forbear or cause forbearance to perform such duty either by himself or "
    "by another public servant; or (b) accepts or obtains or agrees to accept or attempts to "
    "obtain, by himself or through any other person, any undue advantage as a reward for the "
    "improper or dishonest performance of a public duty or for forbearing to perform such "
    "duty either by himself or by another public servant, shall be punishable with "
    "imprisonment for a term which shall not be less than three years but which may extend "
    'to seven years and shall also be liable to fine."\n\n'
    "Key changes: (i) the expression 'gratification other than legal remuneration' has been "
    "replaced by 'undue advantage'; (ii) minimum sentence enhanced from 6 months to 3 years; "
    "(iii) maximum sentence enhanced from 5 years to 7 years."
)

INEVITABLE_CONCLUSION_TEXT = (
    "From the totality of evidence on record, it is an inevitable and irresistible conclusion "
    "that the Accused Officer demanded and accepted bribe amount as illegal gratification for "
    "performing a public duty.\n\n"
    "The demand of illegal gratification is proved by: (i) the testimony of the complainant; "
    "(ii) the testimony of the shadow witness; (iii) the audio/video recording of the demand "
    "conversation; and (iv) the FSL report confirming the genuineness of the recordings.\n\n"
    "The acceptance of illegal gratification is proved by: (i) the trap proceedings; "
    "(ii) the phenolphthalein test which gave positive result on the hands of the Accused "
    "Officer; (iii) recovery of tainted currency notes from the possession of the Accused "
    "Officer; (iv) the testimony of the mediators; and (v) the chemical examination report.\n\n"
    "All three essential ingredients of the offence under Section 7 of the Prevention of "
    "Corruption Act, 1988 (as amended), namely — (i) the Accused Officer is a public servant; "
    "(ii) he accepted undue advantage; (iii) as a motive or reward for performing a public "
    "duty — are clearly established beyond reasonable doubt."
)

NO_NOTICE_REQUIRED_TEXT = (
    "It is submitted that as per the provisions of the Prevention of Corruption Act, 1988 "
    "(as amended), it is not required under the statute to issue notice to the Accused Officer "
    "calling for his explanation before granting prosecution sanction. The competent authority "
    "is only required to apply its mind to the material placed before it and arrive at a prima "
    "facie satisfaction that the accused should be prosecuted.\n\n"
    "The Hon'ble Supreme Court of India has held in State of Goa Vs. Babu Thomas (2005) 8 SCC "
    "130 that the sanctioning authority is not required to issue notice to the accused before "
    "granting sanction. The sanctioning authority has to satisfy itself that prima facie a case "
    "is made out warranting prosecution.\n\n"
    "The necessary material i.e., FIR, Trap Proceedings Report, FSL Report, Seizure Mahazar, "
    "Statements of Witnesses, and other relevant documents are enclosed with this report for "
    "the perusal of the competent authority."
)

SECTION_20_PC_ACT_TEXT = (
    "Presumption u/s 20 of the Prevention of Corruption Act, 1988.\n\n"
    'Section 20 envisages that "Where in any trial of an offence punishable under '
    "Section 7 or Section 11, it is proved that a public servant accused of an offence has "
    "accepted or obtained or attempted to obtain for himself, or for any other person, any "
    "undue advantage from any person it shall be presumed, unless the contrary is proved, "
    "that he accepted or obtained or attempted to obtain that undue advantage, as a motive "
    "or reward under section 7 for performing or to cause performance of a public duty "
    "improperly or dishonestly either by himself or by another public servant or, as the "
    "case may be, any undue advantage without consideration or for a consideration which "
    'he knows to be inadequate under section 11".'
)

PROSECUTION_SANCTION_TEXT = (
    "The Chief Commissioner of Land Administration, Telangana, Hyderabad to issue "
    "sanction for the prosecution of the AO for the offence punishable u/s 7(a) of the "
    "Prevention of Corruption Act 1988 (as amended in 2018)."
)

# ── Document type buckets ─────────────────────────────────────────────────────

_REPORT_TYPES      = {"Investigation Report", "Preliminary Enquiry Report"}
_LETTER_TYPES      = {"Letter", "Government Communication"}
_WITNESS_TYPES     = {"Witness Statement"}
_PROCEEDINGS_TYPES = {"Proceedings"}
_ORDER_TYPES       = {"Order"}


# ── Aggregation helpers ───────────────────────────────────────────────────────

def _of_type(sds: list[dict], *types: str) -> list[dict]:
    return [sd for sd in sds if sd.get("document_type") in types]


def _merge_field(sds: list[dict], field: str) -> str | None:
    parts = []
    for sd in sds:
        val = (sd.get("content") or {}).get(field) or ""
        if val.strip():
            parts.append(f"[{sd['title']}]\n{val.strip()}")
    return "\n\n".join(parts) if parts else None


def _collect(sds: list[dict], field: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for sd in sds:
        for item in (sd.get("content") or {}).get(field, []):
            if item and item not in seen:
                seen.add(item)
                out.append(item)
    return out


def _bullet(items: list[str]) -> str | None:
    return "\n".join(f"• {i}" for i in items) if items else None


def _first(*candidates) -> str:
    for c in candidates:
        if c:
            return c
    return TODO


def _subdoc_list(sds: list[dict], *types: str) -> str | None:
    matches = _of_type(sds, *types)
    if not matches:
        return None
    return "\n".join(
        f"• {sd['title']} (Pages {sd['start_page']}–{sd['end_page']})"
        for sd in matches
    )


# ── Abstract table ────────────────────────────────────────────────────────────

def _build_abstract(persons: list[str], findings: list[str]) -> str:
    if not persons and not findings:
        return TODO
    rows = ["Name / Designation | Sections Attracted | Evidence | Recommendation",
            "─" * 72]
    for p in (persons or [TODO]):
        rows.append(f"{p} | TO DO | TO DO | Prosecution")
    if findings:
        rows.append("\nKey Findings:")
        rows.extend(f"• {f}" for f in findings)
    return "\n".join(rows)


# ── Main builder ──────────────────────────────────────────────────────────────

def build_draft(sub_docs: list[dict], case_id: str, documents: list[dict]) -> dict:
    """
    sub_docs  : flat list of sub-document dicts, each with a nested 'content' dict.
    case_id   : case identifier string.
    documents : list of CaseDocument dicts (for section 9 / 13.3 listing).
    """
    all_persons  = _collect(sub_docs, "key_persons")
    all_dates    = _collect(sub_docs, "key_dates")
    all_orgs     = _collect(sub_docs, "organizations")
    all_findings = _collect(sub_docs, "key_findings")
    all_actions  = _collect(sub_docs, "key_actions")

    report_sds   = _of_type(sub_docs, *_REPORT_TYPES)
    letter_sds   = _of_type(sub_docs, *_LETTER_TYPES)
    witness_sds  = _of_type(sub_docs, *_WITNESS_TYPES)
    proceed_sds  = _of_type(sub_docs, *_PROCEEDINGS_TYPES)
    order_sds    = _of_type(sub_docs, *_ORDER_TYPES)

    report_summary  = _merge_field(report_sds, "summary")
    report_main     = _merge_field(report_sds, "main_content")
    letter_main     = _merge_field(letter_sds, "main_content")
    witness_main    = _merge_field(witness_sds, "main_content")
    proceed_main    = _merge_field(proceed_sds, "main_content")
    order_main      = _merge_field(order_sds, "main_content")

    report_findings = _collect(report_sds, "key_findings")
    report_actions  = _collect(report_sds, "key_actions")
    report_persons  = _collect(report_sds, "key_persons")

    doc_list = "\n".join(
        f"• {d.get('original_name') or d.get('file_name', '')} "
        f"[{d.get('status', '')}] — {d.get('total_pages', 0)} pages"
        for d in documents
    ) or TODO

    fir_actions = _bullet([
        a for a in all_actions
        if any(k in a.lower() for k in ("fir", "section", "register", "case no"))
    ])

    sections = [
        {
            "number": "1",
            "heading": "Introduction",
            "subsections": [
                {
                    "number": "1.1",
                    "heading": "Background of the case",
                    "content": _first(report_summary, report_main),
                },
                {
                    "number": "1.2",
                    "heading": "Source of complaint (Written / Oral / Suo Motu)",
                    "content": _first(_merge_field(letter_sds, "subject")),
                },
                {
                    "number": "1.3",
                    "heading": "Date(s) of demand and date of acceptance of bribe",
                    "content": _first(_bullet(all_dates)),
                },
            ],
        },
        {
            "number": "2",
            "heading": "Service Particulars of the Accused Officer (AO)",
            "subsections": [
                {
                    "number": "2.1",
                    "heading": "Name, designation, and department",
                    "content": _first(_bullet(all_persons)),
                },
                {
                    "number": "2.2",
                    "heading": "Place of posting at the time of offence",
                    "content": _first(_bullet(all_orgs)),
                },
                {
                    "number": "2.3",
                    "heading": "Job chart",
                    "content": TODO,
                },
            ],
        },
        {
            "number": "3",
            "heading": "Allegation in Brief",
            "subsections": [
                {
                    "number": "3.1",
                    "heading": "Demand of illegal gratification",
                    "content": _first(_bullet(report_findings)),
                },
                {
                    "number": "3.2",
                    "heading": "Acceptance/obtaining of bribe",
                    "content": TODO,
                },
                {
                    "number": "3.3",
                    "heading": "Misuse of official position / abuse of public duty",
                    "content": TODO,
                },
                {
                    "number": "3.4",
                    "heading": "Official favour",
                    "content": TODO,
                },
            ],
        },
        {
            "number": "4",
            "heading": "Complaint",
            "subsections": [
                {
                    "number": "4.1",
                    "heading": "Date and contents of complaint",
                    "content": _first(letter_main),
                },
                {
                    "number": "4.2",
                    "heading": "Verification of complaint (discreet inquiry / electronic recording, if any)",
                    "content": TODO,
                },
                {
                    "number": "4.3",
                    "heading": "Receipt of further or supplementary complaint, if applicable",
                    "content": TODO,
                },
            ],
        },
        {
            "number": "5",
            "heading": "Registration of FIR",
            "subsections": [
                {
                    "number": "5.1",
                    "heading": "FIR number, date, and sections invoked under relevant laws",
                    "content": _first(fir_actions),
                },
            ],
        },
        {
            "number": "6",
            "heading": "Pre-Trap Proceedings",
            "subsections": [
                {"number": "6.1", "heading": "Introduction of complainant and shadow/mediator witnesses", "content": _first(proceed_main)},
                {"number": "6.2", "heading": "Preparation of trap money (application of phenolphthalein powder)", "content": TODO},
                {"number": "6.3", "heading": "Noting down serial numbers of currency notes", "content": TODO},
                {"number": "6.4", "heading": "Demonstration of chemical reaction to mediators", "content": TODO},
                {"number": "6.5", "heading": "Instructions given to complainant and shadow witness", "content": TODO},
                {"number": "6.6", "heading": "Fixing place, date, and time for acceptance of bribe", "content": TODO},
                {"number": "6.7", "heading": "Pre-arranged signal", "content": TODO},
                {"number": "6.8", "heading": "NO PERSONAL GRUDGES OR FINANCIAL ISSUES", "content": TODO},
            ],
        },
        {
            "number": "7",
            "heading": "Post-Trap Proceedings",
            "subsections": [
                {"number": "7.1",  "heading": "Vantage positions taken by trap party", "content": TODO},
                {"number": "7.2",  "heading": "Receipt of pre-arranged signal", "content": TODO},
                {"number": "7.3",  "heading": "Apprehension of AO", "content": TODO},
                {"number": "7.4",  "heading": "Phenolphthalein test on hands/fingers of AO", "content": TODO},
                {"number": "7.5",  "heading": "Chemical test of contact portion i.e., pocket/other relevant surfaces etc.", "content": TODO},
                {"number": "7.6",  "heading": "Seizure of tainted bribe amount", "content": TODO},
                {"number": "7.7",  "heading": "Video recording/photography of proceedings", "content": TODO},
                {"number": "7.8",  "heading": "Immediate explanation offered by AO (spot explanation)", "content": TODO},
                {"number": "7.9",  "heading": "Seizure of official records related to complainant's pending work", "content": TODO},
                {"number": "7.10", "heading": "Examination of complainant", "content": TODO},
                {"number": "7.11", "heading": "Examination of official witness regarding status of pending work", "content": TODO},
                {"number": "7.12", "heading": "Examination of independent/official witnesses present at time of acceptance", "content": TODO},
                {"number": "7.13", "heading": "Arrest of accused (if effected)", "content": TODO},
            ],
        },
        {
            "number": "8",
            "heading": "Oral Evidence",
            "subsections": [
                {"number": "8.1", "heading": "Statement of complainant",          "content": _first(witness_main)},
                {"number": "8.2", "heading": "Statements of shadow witness",       "content": TODO},
                {"number": "8.3", "heading": "Statements of mediators",            "content": TODO},
                {"number": "8.4", "heading": "Statements of official witnesses",   "content": TODO},
                {"number": "8.5", "heading": "Statements of circumstantial witnesses", "content": TODO},
            ],
        },
        {
            "number": "9",
            "heading": "Documentary Evidence",
            "subsections": [
                {"number": "9.1", "heading": "Complaint",                                                   "content": _first(_subdoc_list(sub_docs, *_LETTER_TYPES))},
                {"number": "9.2", "heading": "FIR",                                                         "content": TODO},
                {"number": "9.3", "heading": "Pre-trap and post-trap proceedings reports",                  "content": _first(_subdoc_list(sub_docs, *_PROCEEDINGS_TYPES))},
                {"number": "9.4", "heading": "Digital evidence (audio/video recordings, transcripts, FSL report)", "content": TODO},
                {"number": "9.5", "heading": "Seized official records relating to official favour",          "content": TODO},
                {"number": "9.6", "heading": "Statement recorded under Section 183 BNSS",                   "content": TODO},
                {"number": "9.7", "heading": "Attendance record of the AO on the date of demand and acceptance", "content": TODO},
                {"number": "9.8", "heading": "CDRs analysis, CAF, S. 63 Certificate",                       "content": TODO},
            ],
        },
        {
            "number": "10",
            "heading": "Analysis of Evidence",
            "subsections": [
                {
                    "number": "10.1",
                    "heading": "Evidence for Demand",
                    "content": _first(_bullet(report_findings), _bullet(all_findings)),
                },
                {
                    "number": "10.2",
                    "heading": "Verbatim for demand",
                    "content": TODO,
                },
                {
                    "number": "10.3",
                    "heading": "Evidence for Acceptance",
                    "content": _first(_bullet(report_actions), _bullet(all_actions)),
                },
                {
                    "number": "10.4",
                    "heading": "Verbatim for acceptance",
                    "content": TODO,
                },
                {
                    "number": "10.5",
                    "heading": "Evidence for performance of public duty by AO",
                    "content": _first(order_main),
                },
                {
                    "number": "10.6",
                    "heading": "Presumption under Section 20 of PC Act",
                    "content": SECTION_20_PC_ACT_TEXT,
                },
                {
                    "number": "10.7",
                    "heading": "Corroboration of documentary and digital evidences",
                    "content": TODO,
                },
            ],
        },
        {
            "number": "11",
            "heading": "Findings of Investigation",
            "subsections": [
                {
                    "number": "11.1",
                    "heading": "Summary of facts established",
                    "content": _first(report_summary, _bullet(all_findings)),
                },
                {
                    "number": "11.2",
                    "heading": "Role of accused and offences committed (relevant sections of Law)",
                    "content": _first(_bullet(report_persons), _bullet(all_persons)),
                },
                {
                    "number": "11.3",
                    "heading": "Violation of Conduct Rules",
                    "content": TODO,
                },
                {
                    "number": "11.4",
                    "heading": "Procedural lapses noticed, if any",
                    "content": TODO,
                },
            ],
        },
        {
            "number": "12",
            "heading": "Abstract of Findings and Recommendations",
            "subsections": [
                {
                    "number": "12.1",
                    "heading": "Tabular presentation including name, designation, sections attracted, evidence, and recommendation for prosecution",
                    "content": _build_abstract(all_persons, all_findings),
                },
            ],
        },
        {
            "number": "13",
            "heading": "Request for Prosecution Sanction Order",
            "subsections": [
                {
                    "number": "13.0",
                    "heading": "",
                    "content": PROSECUTION_SANCTION_TEXT,
                },
                {
                    "number": "13.1",
                    "heading": "Competent authority for sanction",
                    "content": TODO,
                },
                {
                    "number": "13.2",
                    "heading": "Grounds for grant of sanction",
                    "content": _first(_bullet(all_findings)),
                },
                {
                    "number": "13.3",
                    "heading": "Enclosures of relevant documents i.e., SO, DACs",
                    "content": doc_list,
                },
            ],
        },
    ]

    return {
        "case_id": case_id,
        "title": "FORMAT FOR FINAL REPORT IN TRAP CASES",
        "case_number": case_id,
        "sections": sections,
    }
