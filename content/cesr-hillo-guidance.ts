/**
 * Supervisor guidance for each HiLLO page of the CESR Journey pack:
 * what assessors look for, the minimum evidence, common pitfalls, and
 * which other HiLLOs the same evidence serves. Authored at St George's
 * (Adult Critical Care, Portfolio Pathway lead) from supervising
 * Portfolio Pathway candidates; it is guidance, not curriculum wording,
 * and carries no numeric WBA targets — the GMC minimums are on the
 * Evidence rules page. Rendered by `hilloPage` in cesr-hillo-pages.ts.
 */

export interface HilloGuidance {
  n: number;
  /** 2–4 sentences: what assessors want to see for this HiLLO. */
  lookFor: string;
  /** The evidence an application for this HiLLO cannot do without. */
  minimum: string[];
  /** The ways applications most often fall short here. */
  pitfalls: string[];
  /** Other HiLLOs the same evidence can serve, with the overlap named. */
  alsoServes: string[];
}

export const CESR_HILLO_GUIDANCE: HilloGuidance[] = [
  {
    n: 1,
    lookFor:
      "This is a generic HiLLO: evidence comes from every placement, not a dedicated one. Assessors want to see you working inside NHS governance — consent, capacity, information governance, complaints, incidents, appraisal — with reflection on each, not a folder of certificates. Much of the evidence here also appears elsewhere; cross-reference rather than duplicate.",
    minimum: [
      "Annual appraisal documents for the last three years",
      "An MSF or 360° feedback within the last two years",
      "Mandatory training current: information governance, Mental Capacity Act, adult and child safeguarding (Level 3), equality and diversity, human factors",
      "At least one reflection on a legal or ethical decision (consent, capacity, DoLS, treatment limitation)",
    ],
    pitfalls: [
      "Training certificates filed without any reflection or application to a case",
      "No supervisor verification on the governance evidence",
      "Patient-identifiable detail left in complaint, incident or consent documents",
    ],
    alsoServes: [
      "HiLLO 2 — incidents, complaints and safeguarding",
      "HiLLO 4 — supervising and appraising others",
      "HiLLO 8 — capacity, best interests and treatment limitation",
      "HiLLO 9 — governance roles and committees",
    ],
  },
  {
    n: 2,
    lookFor:
      "Assessors want leadership in safety and quality improvement, not attendance. The strongest evidence is a QI project you led through at least one full PDSA cycle with outcome data and a sustainability plan, an incident you reported and followed to a system change, and an M&M presentation with documented learning. Safeguarding is assessed here too: Level 3 adult and child training, and a case where you acted.",
    minimum: [
      "One completed QI project with a closed loop (measure, change, re-measure) and your role stated",
      "Level 3 adult and child safeguarding training, current",
      "An M&M or governance presentation with the learning and any action recorded",
      "An incident report you raised, with your reflection and what changed",
    ],
    pitfalls: [
      "QI projects with no measurable outcome, or an audit cycle never closed",
      "A single evidence type per Key Capability — no triangulation between WBA, clinical record and course",
      "Safeguarding evidenced by the certificate alone, with no case or reflection",
    ],
    alsoServes: [
      "HiLLO 1 — governance and professional standards",
      "HiLLO 4 — teaching safety and QI",
      "HiLLO 9 — leading change in a unit",
      "HiLLOs 10–14 — any placement audit or QI project",
    ],
  },
  {
    n: 3,
    lookFor:
      "This HiLLO is about research literacy, not research output. Assessors want to see that you read and appraise evidence routinely, change practice because of it, understand research ethics and governance, and can use your own unit's data. Publications help but are not required; a GCP certificate, a journal club record and a guideline you appraised are the core.",
    minimum: [
      "Good Clinical Practice (GCP) certificate, current",
      "A record of regular journal club participation over at least a year, with the appraisals you presented",
      "A critical appraisal or guideline review that led to a documented change in your practice or your unit's",
      "Evidence you have used local or national data (ICNARC, a registry, an audit) to inform care",
    ],
    pitfalls: [
      "Treating the HiLLO as 'publications only' and leaving it thin when there are none",
      "Appraisals filed without the practice change that followed",
      "Journal club attendance that was never recorded",
    ],
    alsoServes: [
      "HiLLO 2 — evidence-based QI",
      "HiLLO 4 — teaching critical appraisal",
      "HiLLO 6 — organ support decisions justified from the evidence",
    ],
  },
  {
    n: 4,
    lookFor:
      "Assessors want sustained, regular teaching with documented learner feedback, across more than one learner group, plus evidence that you assess and supervise others. A formal qualification (Teach the Teachers, PGCert) and instructor or faculty status strengthen the case. The Key Capability on involving patients and the public in education is the one most often left empty — plan for it.",
    minimum: [
      "A teaching timetable or log covering at least a year, with learner feedback from several sessions",
      "WBAs you have completed as the assessor, with the number and types",
      "A teaching course certificate or an educational qualification",
      "Something for patient and public involvement in education: a patient-facing resource, a session co-delivered with a patient, or simulation with lay participants",
    ],
    pitfalls: [
      "Nothing against the patient and public involvement Key Capability",
      "Teaching delivered but no feedback kept",
      "No evidence of assessing or supervising others, only of teaching",
    ],
    alsoServes: [
      "HiLLO 1 — appraising and supervising colleagues",
      "HiLLO 2 — safety and QI teaching",
      "HiLLO 3 — teaching critical appraisal",
      "HiLLO 9 — educational leadership roles",
    ],
  },
  {
    n: 5,
    lookFor:
      "Evidence comes mainly from your General ICM time (minimum 2¼ years). Assessors want to see the whole arc — recognising the deteriorating patient, resuscitation, airway and circulatory support, transfer, and early communication with families — at a consultant level of independence, with the procedural work logged. Current ALS is expected; a transfer course and a logbook of intra- and inter-hospital transfers are near-essential.",
    minimum: [
      "ALS certificate, current (recertified within four years)",
      "A procedural logbook covering intubation, central and arterial access and chest drains, with dates and supervision level",
      "A transfer logbook (intra- and inter-hospital) with a reflection on a difficult transfer",
      "MET, outreach or emergency call records with at least one reflection",
    ],
    pitfalls: [
      "Procedural competence more than seven years old with no maintenance evidence",
      "No reflection on a critical incident or a resuscitation that went badly",
      "Transfer experience done but never documented",
    ],
    alsoServes: [
      "HiLLO 6 — procedures and organ support",
      "HiLLO 7 — perioperative resuscitation",
      "HiLLO 8 — family communication in the acute phase",
      "HiLLO 10 — airway skills from anaesthesia",
      "HiLLOs 12–14 — specialty emergencies",
    ],
  },
  {
    n: 6,
    lookFor:
      "The most procedure-heavy of the core HiLLOs. Assessors want a procedural logbook separated by procedure and complication, point-of-care ultrasound with accreditation or a clear route to it, and evidence of leading organ support decisions over the course of an illness — ventilation strategy, renal replacement, haemodynamic monitoring — not snapshots. Echo accreditation (FUSIC Heart, FICE or equivalent) is the single strongest differentiator here.",
    minimum: [
      "Procedural logbook: central venous and arterial access, dialysis catheters, chest drains, bronchoscopy, with complications recorded",
      "Point-of-care ultrasound: accreditation, or a logbook with a named mentor and a date for sign-off",
      "A longitudinal case (CBD or reflection) showing organ support decisions changing over days",
      "Evidence of interpreting investigations with a specialist (radiology or microbiology MDT, or a documented discussion)",
    ],
    pitfalls: [
      "No ultrasound accreditation and no plan for it",
      "Logbook totals without site, indication or complications",
      "Organ support evidenced by single decisions rather than the course of an illness",
    ],
    alsoServes: [
      "HiLLO 5 — resuscitation procedures",
      "HiLLO 7 — perioperative organ support",
      "HiLLO 12 — neuromonitoring (ICP, EEG)",
      "HiLLO 14 — cardiac support (IABP, ECMO, echo)",
    ],
  },
  {
    n: 7,
    lookFor:
      "Assessors want breadth across surgical specialties — general, vascular, orthopaedic, cardiothoracic, neurosurgical — and both elective and emergency cases. Show pre-operative risk assessment and optimisation as a separate activity from post-operative care, involvement in enhanced recovery or NELA-type pathways, and teamwork with surgeons and anaesthetists that an MSF from that side can confirm.",
    minimum: [
      "Cases spanning at least four surgical specialties, elective and emergency",
      "A documented pre-operative review or optimisation of a high-risk patient",
      "Participation in an enhanced recovery, NELA or perioperative audit or pathway",
      "Feedback from surgical colleagues (an MSF that includes them, or a structured report)",
    ],
    pitfalls: [
      "Evidence drawn from one surgical specialty",
      "MSF from anaesthetic and ICU colleagues only, none from surgeons",
      "Pre-operative optimisation not documented separately from post-operative management",
    ],
    alsoServes: [
      "HiLLO 5 — stabilisation of the surgical emergency",
      "HiLLO 6 — post-operative organ support",
      "HiLLO 10 — anaesthetic and perioperative skills",
      "HiLLO 12 — post-neurosurgical care",
      "HiLLO 14 — post-cardiac-surgical care",
    ],
  },
  {
    n: 8,
    lookFor:
      "The most ethically demanding HiLLO. Assessors want to see you leading end-of-life discussions, treatment limitation and withdrawal, delirium and rehabilitation planning, and the whole organ donation process. Brainstem death testing and organ donation are the two Key Capabilities most often under-evidenced — seek the cases out and log them. Documentation of family meetings should carry your reflection, not just the record.",
    minimum: [
      "Family meeting records (end-of-life, treatment limitation) with your reflection",
      "A log of brainstem death tests you performed or participated in",
      "Organ donation cases, DBD and DCD, with your role and the SN-OD involvement",
      "Evidence on recovery and rehabilitation: follow-up clinic, rehabilitation prescription, or a discharge summary you wrote",
    ],
    pitfalls: [
      "Nothing, or one case, against brainstem death testing",
      "Organ donation evidenced only by a course, with no referrals or approaches",
      "End-of-life documentation without a reflective component",
    ],
    alsoServes: [
      "HiLLO 1 — capacity, best interests and the legal framework",
      "HiLLO 2 — communication and safety",
      "HiLLO 5 — family communication",
      "HiLLO 9 — leading difficult decisions",
    ],
  },
  {
    n: 9,
    lookFor:
      "Assessors want senior leadership: running the unit for a shift, leading ward rounds and MDTs, managing conflict, running outreach, and understanding surge and major incident planning. Leadership claims need an MSF or structured report that speaks to them. Major incident and mass casualty planning is the Key Capability most often left empty — a MIMMS-type course or an exercise you took part in covers it.",
    minimum: [
      "Evidence of leading the unit: ward round or on-call leadership confirmed by a supervisor or structured report",
      "An outreach or MET record with a reflection on a difficult escalation or refusal",
      "A leadership-focused MSF or 360°",
      "Major incident training or participation in a major incident exercise or surge plan",
    ],
    pitfalls: [
      "Nothing against surge and major incident planning",
      "Outreach work done but not logged",
      "Leadership described in the narrative with no feedback to support it",
    ],
    alsoServes: [
      "HiLLO 1 — governance and systems",
      "HiLLO 2 — safety and QI leadership",
      "HiLLO 4 — educational leadership",
      "HiLLO 8 — leading end-of-life decisions",
    ],
  },
  {
    n: 10,
    lookFor:
      "Assessors apply the Required evidence above strictly: the placement, the logbook and the twelve anaesthesia-specific SLEs are not negotiable, and the Initial Assessment of Competence alone is insufficient. Beyond that they want breadth — surgical specialties, ASA grades, emergency and elective, regional and general techniques — and a supervisor's confirmation of independent practice at the stated level.",
    minimum: [
      "The Required evidence list on this page, complete",
      "A logbook broken down by surgical specialty, ASA grade, airway technique and regional technique",
      "Difficult airway and can't-intubate-can't-oxygenate training",
      "A supervisor report confirming the level of independence reached",
    ],
    pitfalls: [
      "Relying on the Initial Assessment of Competence without the twelve anaesthesia SLEs",
      "A logbook of totals only, with no specialty, ASA or technique breakdown",
      "A placement more than seven years ago with no maintenance evidence",
    ],
    alsoServes: [
      "HiLLO 5 — airway and resuscitation",
      "HiLLO 7 — perioperative care",
      "HiLLO 12 — neuroanaesthesia",
      "HiLLO 14 — cardiac anaesthesia",
    ],
  },
  {
    n: 11,
    lookFor:
      "Assessors want a medical placement that looks like a medical registrar's year: unselected acute take, ward rounds, outpatient or ambulatory care, and end-of-life care, across several medical specialties. The take volume is best shown by the rota. MRCP or equivalent is expected; without it you must show equivalent training.",
    minimum: [
      "The Required evidence list on this page, complete",
      "Rota evidence of acute unselected take at registrar level",
      "Cases spanning at least five medical specialties (respiratory, cardiology, gastroenterology, neurology, endocrine, renal)",
      "An outpatient or ambulatory care record and an end-of-life case from the placement",
    ],
    pitfalls: [
      "Cases concentrated in one or two specialties",
      "Acute take done but not documented by rota or log",
      "The end-of-life Key Capability under-represented",
    ],
    alsoServes: [
      "HiLLO 1 — legal and ethical decisions on the ward",
      "HiLLO 5 — resuscitation on the take",
      "HiLLO 6 — investigation and organ support",
      "HiLLO 8 — end-of-life care",
      "HiLLO 9 — leading the medical team",
    ],
  },
  {
    n: 12,
    lookFor:
      "Insufficient evidence for the three specialty HiLLOs (12, 13 and 14) is the single most common reason applications fail. Assessors want a three-month neurocritical care placement with a case log, a named supervisor's end-of-placement report, and specific evidence of ICP and EVD management, subarachnoid haemorrhage, traumatic brain injury and brainstem death testing. An audit or QI project in the unit and attendance at neuroradiology and neurosurgical MDTs round it out.",
    minimum: [
      "A placement case log (around 40–60 cases) with diagnoses and your role",
      "A named supervisor's end-of-placement report",
      "ICP and EVD management logged as its own item, with a CBD",
      "A neuro ICU audit or QI project, and MDT attendance records",
    ],
    pitfalls: [
      "Thin evidence spread over the nine Key Capabilities with no case log",
      "ICP and EVD management buried in general cases rather than logged separately",
      "A placement more than seven years ago with no maintenance evidence",
    ],
    alsoServes: [
      "HiLLO 1 — brainstem death and capacity law",
      "HiLLO 5 — neurological emergencies",
      "HiLLO 6 — neuromonitoring",
      "HiLLO 7 — post-neurosurgical care",
      "HiLLO 8 — brainstem death testing and organ donation",
      "HiLLO 10 — neuroanaesthesia",
    ],
  },
  {
    n: 13,
    lookFor:
      "Assessors want a three-month paediatric critical care placement with a case log broken down by age band and diagnosis, a paediatric procedural log, current APLS or EPALS, and Level 3 child safeguarding — the last two are mandatory and are checked first. Retrieval and inter-hospital transfer involvement is the part most often missing.",
    minimum: [
      "The Required evidence list on this page, complete",
      "A case log by age band (neonate, infant, child, adolescent) and diagnosis",
      "A paediatric procedural log: intubation, intraosseous and vascular access",
      "Retrieval or transfer involvement, and a named supervisor's end-of-placement report",
    ],
    pitfalls: [
      "APLS/EPALS or Level 3 child safeguarding missing or out of date",
      "A case log with no age-band breadth",
      "No retrieval or transfer evidence",
    ],
    alsoServes: [
      "HiLLO 1 — safeguarding and consent for children",
      "HiLLO 2 — child safeguarding in practice",
      "HiLLO 5 — paediatric resuscitation",
      "HiLLO 8 — end-of-life care for a child and family",
    ],
  },
  {
    n: 14,
    lookFor:
      "Assessors want a three-month cardiothoracic critical care placement with a case log across CABG, valve, thoracic and aortic surgery, an echo logbook, and evidence of mechanical circulatory support where the unit offers it. CALS and an echo accreditation (FUSIC Heart, FICE or BSE Level 1) are the credentials they look for. A unit audit or QI project and participation in cardiac surgical planning MDTs complete the picture.",
    minimum: [
      "The Required evidence list on this page, complete",
      "A case log across CABG, valve, thoracic and aortic surgery with your role",
      "An echo logbook of cardiac surgical patients, and the accreditation or the route to it",
      "Mechanical circulatory support exposure (IABP, ECMO, VAD) where available, and a named supervisor's end-of-placement report",
    ],
    pitfalls: [
      "No CALS and no echo accreditation",
      "Mechanical support available in the unit but not documented",
      "A placement more than seven years ago with no maintenance evidence",
    ],
    alsoServes: [
      "HiLLO 5 — resuscitation after cardiac surgery",
      "HiLLO 6 — echo and cardiac organ support",
      "HiLLO 7 — perioperative cardiac care",
      "HiLLO 9 — leading the post-operative unit",
      "HiLLO 10 — cardiac anaesthesia",
    ],
  },
];
