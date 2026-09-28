/**
 * The ICM curriculum as the CESR Journey pack renders it: 14 High-Level
 * Learning Outcomes (HiLLOs), their 92 Key Capabilities (KCs), and the
 * evidence menus, at-a-glance notes, required and maintenance lists from
 * the September 2026 pack in content/source/cesr/hillo-NN.md.
 *
 * Every string here except `shortTitle` is copied verbatim from those
 * files (content/cesr-curriculum.test.ts checks each one against its
 * source); HiLLO statements and KC texts are the GMC Specialty Specific
 * Guidance for ICM (Portfolio pathway), updated 04/02/2025. The `N.M`
 * numbering is a WorkspaceICU convention — the SSG lists KCs unnumbered.
 * `shortTitle` is a WorkspaceICU navigation label for the KC page title (a
 * topic under 40 characters, distinct within its HiLLO),
 * not curriculum wording; the verbatim text is the page's description
 * and first quote. Inline `**bold**` and `*italic*` in items and bullets
 * are rendered by `md()` in content/blocks.ts.
 *
 * Data only: the page layout that turns this into pack pages lives in
 * content/cesr-hillo-pages.ts, so a future SSG revision is a change here.
 */

/** One strand of a KC's evidence menu, in the source's fixed order. */
export interface CurriculumStrand {
  kind: "wba" | "clinical" | "cpd";
  /** The work-based strand's suggested number, e.g. "2–3" or "1–2 anaesthesia SLEs". */
  aim?: string;
  items: string[];
}

export interface CurriculumKC {
  /** "12.8" — WorkspaceICU numbering, stable across pack versions. */
  id: string;
  /** Navigation label for the page title; not curriculum wording. */
  shortTitle: string;
  /** Verbatim SSG wording. */
  text: string;
  /** The September pack's one-line note on evidencing this KC, if any. */
  note?: string;
  strands: CurriculumStrand[];
}

/** A checklist section of the HiLLO page (HiLLO-level, required, maintenance). */
export interface CurriculumSection {
  /** The source heading, kept for the record. */
  heading: string;
  /** The heading's qualifier, e.g. "placement within the last 7 years WTE". */
  qualifier?: string;
  /** A line the source put before the items, if any. */
  intro?: string;
  items: string[];
}

export interface CurriculumHillo {
  n: number;
  icon: string;
  /** "Neurosciences intensive care medicine" — the page title is `HiLLO n — title`. */
  title: string;
  /** Verbatim SSG statement of the outcome. */
  statement: string;
  /** The September pack's at-a-glance bullets (markdown inline). */
  atAGlance: string[];
  /** The SSG's hard requirements (HiLLOs 10, 11, 13, 14). */
  required?: CurriculumSection;
  /** Evidence that covers the whole HiLLO and no single KC (absent for
   *  HiLLO 10, whose placement-wide items are all in `required`). */
  hilloLevel?: CurriculumSection;
  /** The maintenance route when the placement was over seven years ago (HiLLOs 10–14). */
  maintenance?: CurriculumSection;
  kcs: CurriculumKC[];
}

export const CESR_CURRICULUM: CurriculumHillo[] = [
  {
    n: 1,
    icon: "🏛️",
    title: "NHS systems, law and ethics",
    statement:
      "The doctor will be able to function successfully within NHS organisational and management systems whilst adhering to the appropriate legal and ethical framework.",
    atAGlance: [
      "**Standard expected:** Level 4 — independent consultant practice, expert knowledge",
      "**Key capabilities:** 6",
      "**Anchor evidence:** MSF, supervisor reports, and personal involvement in governance shown through minutes and policies",
      "See: **Evidence rules that apply everywhere** for cross-cutting requirements",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "MSF(s) covering professional behaviour and teamworking",
        "Supervisor report(s) addressing this HiLLO",
        "Evidence of your role as an appraiser or assessor of others",
        "Postgraduate qualification or further study in management/leadership, if held",
        "Minutes or emails confirming attendance at Directorate or higher management meetings",
      ],
    },
    kcs: [
      {
        id: "1.1",
        shortTitle: "National legislation in practice",
        text: "Understand, incorporate and implement national legislation (e.g. Health and Social Care Act 2012 and the Equality Act 2010 (Disability Discrimination Act 1995 in Northern Ireland)) into everyday practice",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: a case where mental capacity, DoLS/LPS, or equality legislation shaped management",
              "Mini-CEX: a best-interests discussion or IMCA referral observed",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection: applying national legislation in ICU decision-making (best-interests process, IMCA, reasonable adjustments)",
              "Anonymised documentation of a capacity assessment or DoLS/LPS application you led",
              "Evidence of applying the Equality Act in practice (interpreter use, adjustments for disability, protected characteristics)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Mandatory training record: equality and diversity, MCA/DoLS or LPS, safeguarding adults and children",
              "Medico-legal or ethics-and-law study day",
            ],
          },
        ],
      },
      {
        id: "1.2",
        shortTitle: "Information technology and governance",
        text: "Successfully and ethically incorporate information technology and governance, according to national legislation, into patient care",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: a confidentiality or information-sharing dilemma (police request, relative asking for information, media interest)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on a confidentiality dilemma and how UK data protection principles were applied",
              "Involvement in a clinical IT, EPR or digital project, protocol or rollout (letters, minutes)",
              "Evidence of appropriate use of clinical systems: audit of documentation quality, e-prescribing safety work",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Data protection and information governance training certificates (annual)",
              "Cyber-security / IG e-learning (e-LfH or trust module)",
            ],
          },
        ],
      },
      {
        id: "1.3",
        shortTitle: "Communication and documentation",
        text: "Can communicate & document effectively, according to ethical and legal frameworks to promote the highest standards of healthcare",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "Mini-CEX: documentation and communication in a medicolegally sensitive case (DNACPR discussion, treatment escalation plan)",
              "CBD: a case where contemporaneous documentation mattered (complaint, coroner, incident)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Referral letter, coroner's or Procurator Fiscal report, or complaint response you authored (anonymised)",
              "MSF comments evidencing communication and documentation standards",
              "Patient/relative feedback or thank-you correspondence (anonymised)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Communication skills course (breaking bad news, conflict, advanced communication)",
              "Record-keeping / medico-legal writing training",
            ],
          },
        ],
      },
      {
        id: "1.4",
        shortTitle: "Ethical and legal frameworks",
        text: "Know how to interpret, construct and apply ethical and legal frameworks into all areas of clinical governance",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: an ethically complex governance issue (duty of candour, resource allocation, disagreement about escalation)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Personal involvement in developing a clinical, governance or organisational policy (the document plus minutes showing your role)",
              "Governance activity: personal involvement in a critical incident analysis, SJR or structured mortality review",
              "Duty of candour conversation you led, documented and reflected on",
              "Contribution to a departmental ethics or clinical governance meeting (agenda, minutes, action)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Clinical governance / patient safety training",
              "Root cause analysis or PSIRF investigation training",
            ],
          },
        ],
      },
      {
        id: "1.5",
        shortTitle: "Professional behaviours",
        text: "Demonstrate the highest professional behaviours, individually and corporately",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "MSF demonstrating professional behaviour across the MDT",
              "Mini-CEX or ACAT with explicit comment on professionalism and teamworking",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Appraisal outputs from the last three years, including PDP and reflections",
              "Letters/testimonials from colleagues, patients or relatives (anonymised where patient-related)",
              "Evidence of probity and professional conduct: revalidation summary, occupational health/mandatory training compliance",
              "Contribution to unit culture: wellbeing initiative, peer support role, civility work",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Professionalism, human factors or civility training",
              "Trust mandatory training compliance record",
            ],
          },
        ],
      },
      {
        id: "1.6",
        shortTitle: "Continual learning and integration",
        text: "Continually strive to enhance and integrate knowledge into clinical practice and the NHS organisation as a whole, whilst observing legal and ethical obligations",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: a change you made to your practice or the unit's after new evidence, guidance or learning",
            ],
          },
          {
            kind: "clinical",
            items: [
              "CPD portfolio showing breadth across the SSG's CPD themes (simulation, human factors, IG, safeguarding, specialty updates)",
              "Evidence of translating learning into practice: a guideline update, teaching session or QI arising from CPD",
              "Attendance and contribution at Directorate or higher management meetings (minutes, action lists)",
              "Postgraduate qualification or further study in management/leadership, if held",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Annual CPD summary with reflections, as used for appraisal",
              "Leadership/management course (e.g. Edward Jenner, trust leadership programme)",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 2,
    icon: "🛡️",
    title: "Patient safety and quality improvement",
    statement:
      "The doctor will be focused on patient safety and will deliver effective quality improvement, whilst practising within established legal and ethical frameworks.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 6",
      "**Anchor evidence:** a QI project with demonstrable improvement, M&M participation, incident learning",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "QI project or clinical audit with personal involvement that led to improvement in patient care (report, protocols/forms, minutes showing your participation)",
        "Attendance at — or chairing of — Morbidity and Mortality meetings",
        "MSF(s) and supervisor report(s) addressing this HiLLO",
        "Case reviews showing participation in the meeting",
        "Portfolio of self-study",
      ],
    },
    kcs: [
      {
        id: "2.1",
        shortTitle: "Safeguarding and vulnerable groups",
        text: "Adhere to national legislation and guidelines relating to safeguarding children and other vulnerable groups of patients such as those with protected characteristics",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: a safeguarding concern raised or managed in critical care (adult or child)",
              "Mini-CEX: a conversation with a vulnerable patient or their advocate",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of vulnerable-adult or child safeguarding processes applied: anonymised referral, reflection",
              "Involvement in a safeguarding review, strategy meeting or MARAC-type process",
              "Evidence of reasonable adjustments for patients with protected characteristics (learning disability passport, interpreter, faith needs)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Adult safeguarding training at the level required for your role, current",
              "Children's safeguarding training at the level required for your role, current",
              "PREVENT, learning disability and autism, and equality training",
            ],
          },
        ],
      },
      {
        id: "2.2",
        shortTitle: "Quality improvement and good practice",
        text: "Contribute towards quality improvement, communicate effectively and share good practice",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: the design and outcome of a QI project or audit cycle you led",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Completed QI/audit cycle with your role explicit and re-audit or measurable change (report, protocols/forms)",
              "Presentation of the project (M&M, governance day, regional/national meeting) with feedback",
              "Minutes of meetings where the project was discussed, demonstrating attendance and participation",
              "Guideline or pathway adopted by the unit as a result of your work",
              "Sharing good practice: poster, publication, network presentation, safety bulletin",
            ],
          },
          {
            kind: "cpd",
            items: [
              "QI methodology training (e.g. QSIR, IHI Open School, trust QI course)",
              "Audit and clinical effectiveness training",
            ],
          },
        ],
      },
      {
        id: "2.3",
        shortTitle: "Learning from incidents",
        text: "Demonstrate a commitment to learn from critical incidents and adverse events as well as sharing the learning points from these experiences",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: a critical incident or adverse event you were involved in and the learning derived",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Personal involvement in a critical incident analysis, SJR or PSIRF learning response",
              "Reflection on a significant event and the change it produced",
              "Evidence of sharing learning: safety bulletin, teaching session, M&M presentation, 'learning from incidents' summary",
              "Datix/incident reports you raised, with outcomes (anonymised)",
              "Attendance at, or chairing of, Morbidity and Mortality meetings (minutes, case reviews showing participation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Incident investigation / human factors / PSIRF training",
              "Duty of candour training",
            ],
          },
        ],
      },
      {
        id: "2.4",
        shortTitle: "Communication and its barriers",
        text: "Communicate effectively with patients, their families and professional colleagues whilst recognising and effectively managing any barriers to effective communication",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "Mini-CEX: a difficult conversation (interpreter, conflict, communication barrier, cognitive impairment)",
              "CBD: a case where a communication barrier was recognised and managed",
              "ACAT: handover or referral communication across specialties",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Formal patient/relative feedback, thank-you letters, or complaint responses (anonymised)",
              "MSF comments on communication with patients, families and colleagues",
              "Evidence of using interpreters, advocates or communication aids appropriately",
              "Reflection on a communication failure and what changed",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Advanced communication skills course",
              "Breaking bad news / conflict resolution / cultural competence training",
            ],
          },
        ],
      },
      {
        id: "2.5",
        shortTitle: "Evidence-based care",
        text: "Optimise care of critically unwell patients by the critical appraisal of recent medical literature and the application of evidence-based guidelines",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: applying or departing from an evidence-based guideline, with rationale",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Journal club presentation with critical appraisal (slides, minutes/attendance, feedback)",
              "Guideline you wrote or updated, with its evidence base cited",
              "Evidence of implementing a national guideline locally (NICE, FICM/ICS, GPICS) — protocol, audit of compliance",
              "Portfolio of self-study: reading log, e-ICM modules, critical appraisal notes",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Critical appraisal / evidence-based medicine training",
              "Specialty update meetings (ICS State of the Art, regional ICM meetings) with reflection",
            ],
          },
        ],
      },
      {
        id: "2.6",
        shortTitle: "Patient safety as the priority",
        text: "Ensure patient safety is the key priority at all times in their clinical practice both within the intensive care unit and in the wider clinical environment of the hospital",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: a patient safety intervention in or beyond the ICU (deteriorating ward patient, transfer safety, medication error averted)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Participation in and development of patient safety procedures (checklists, huddles, safety briefings) — minutes, documents",
              "Contribution to unit safety systems: WHO-style checklists for procedures, transfer checklists, drug safety work",
              "Datix/incident reports you raised, with outcomes (anonymised)",
              "Involvement in outreach, deteriorating-patient or sepsis pathways beyond the ICU",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Human factors or simulation training",
              "Patient safety syllabus modules (NHS England level 1–2)",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 3,
    icon: "🔬",
    title: "Research, appraisal and data",
    statement:
      "An Intensive Care Medicine specialist will know how to undertake medical research including the ethical considerations, methodology and how to manage and interpret data appropriately.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 6",
      "**Anchor evidence:** GCP, personal research/trial involvement, journal club activity, unit data work",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Good Clinical Practice certificate, current",
        "Publications, posters, abstracts or oral presentations, if held",
        "Higher degree or further study involving research (MSc/MD/PhD), if held",
        "Supervisor report(s) addressing this HiLLO",
      ],
    },
    kcs: [
      {
        id: "3.1",
        shortTitle: "Current literature and guidelines",
        text: "Remain up to date in their reading of current research literature and best practice guidelines",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: a recent trial or guideline discussed and its relevance to a current patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "CPD diary showing regular literature engagement (e-ICM, journal alerts, conference attendance with your contribution referenced)",
              "Reflection: a recent trial or guideline that changed your practice",
              "Portfolio of self-study or reading log",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Specialty update meetings and conferences attended (certificates, reflections)",
              "Subscription/completion evidence for e-ICM or equivalent modules",
            ],
          },
        ],
      },
      {
        id: "3.2",
        shortTitle: "Research processes and governance",
        text: "Have an understanding of the processes and governance of clinical research, and will be able to communicate this to patients and their relatives where appropriate",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD or Mini-CEX: a consent/assent discussion for research with a patient or family (including deferred consent)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Personal involvement in study enrolment or trial activity on the unit (screening logs, delegation log entry, minutes)",
              "Role as PI, sub-investigator or research champion (letters, delegation logs)",
              "Involvement in a research ethics or R&D governance process (application, amendment, minutes)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Good Clinical Practice certificate, current",
              "Research governance / consent training",
            ],
          },
        ],
      },
      {
        id: "3.3",
        shortTitle: "Critical appraisal in practice",
        text: "Be able to critically appraise clinical literature, and to apply this, when appropriate, to their clinical practice",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: bedside application (or rejection) of a trial result with reasoning",
              "Teaching observation: a critical appraisal session you delivered",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Journal club presentation with structured critical appraisal, plus attendance list or minutes and feedback",
              "Written critical appraisal (CASP-style) of a key paper",
              "Evidence of appraising literature for a guideline or protocol you wrote",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Critical appraisal / evidence-based medicine course",
              "Statistics for clinicians training",
            ],
          },
        ],
      },
      {
        id: "3.4",
        shortTitle: "Ethics and law in patient care",
        text: "Use their knowledge of the ethical principles of practising medicine, and the legal framework associated with this in modern healthcare to benefit their patients",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: research ethics or wider medical ethics applied to a real decision (equipoise, consent capacity, incidental findings)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on an ethical dilemma in research or clinical practice and the legal framework applied",
              "Involvement in an ethics committee, clinical ethics advisory group or ethics teaching",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Ethics or law teaching attended or delivered",
              "GCP (ethics component) — cross-reference",
            ],
          },
        ],
      },
      {
        id: "3.5",
        shortTitle: "Unit data and local improvement",
        text: "Have the ability to organise the collection and interpretation of data collected from their own intensive care unit and use this as a method of improving clinical services locally",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: a unit data project and the service change it informed",
            ],
          },
          {
            kind: "clinical",
            items: [
              "A unit data project you organised: audit dataset, ICNARC/case-mix analysis, dashboard — with the service change it informed",
              "Minutes or reports showing your data presented to the department",
              "Evidence of data quality work (coding accuracy, ICNARC validation, ward-round data capture)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Data analysis / clinical informatics training",
              "ICNARC or national audit training",
            ],
          },
        ],
      },
      {
        id: "3.6",
        shortTitle: "Population data in treatment plans",
        text: "Apply information derived from population data to help inform individual treatment plans for their patients",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: using severity scores, case-mix or population-level evidence in an individual decision (e.g. risk prediction in a family discussion)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on the limits of population data at the bedside",
              "Documented use of prognostic scores or population data in an anonymised treatment plan or family discussion",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Prognostication / risk prediction teaching",
              "Epidemiology or public health module",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 4,
    icon: "🎓",
    title: "Teaching and supervision",
    statement:
      "To ensure development of the future medical workforce, a doctor working as a specialist in Intensive Care Medicine will be an effective clinical teacher and will be able to provide educational and clinical supervision.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 4",
      "**Anchor evidence:** a sustained teaching record with feedback, plus formal educational roles",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "CPD record of educational activity within the last seven years",
        "Letter/email from the Education Centre or supervisor confirming regular teaching, with dates and sessions",
        "MSF(s) and supervisor report(s) addressing this HiLLO",
      ],
    },
    kcs: [
      {
        id: "4.1",
        shortTitle: "Effective and equitable teaching",
        text: "Deliver effective teaching and training to medical students, doctors in training, colleagues and members of the wider multidisciplinary team. This will include understanding the teaching, assessment and feedback needs of learners from all groups with protected characteristics and being able to adapt teaching and provide supportive techniques to ensure successful and equitable learning outcomes.",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "Teaching observation (TO) or Mini-CEX: a teaching session observed by a senior colleague",
              "MSF with comment on teaching and supervision",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Teaching sessions delivered: timetables identifying your sessions, posters, slides",
              "Teaching on Life Support or simulation courses (faculty certificates)",
              "Feedback from those taught, formal or informal",
              "Evidence of adapting teaching to learner needs (reflection or feedback demonstrating it, including learners with protected characteristics)",
              "Letter/email from the Education Centre or supervisor confirming regular teaching involvement, with dates and sessions",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Train-the-trainer / teaching skills course",
              "Equality, diversity and inclusion in education training",
            ],
          },
        ],
      },
      {
        id: "4.2",
        shortTitle: "Assessing learners and feedback",
        text: "Competently assess the performance of learners objectively and deliver timely and constructive feedback on learning activities in accordance with current educational standards and best practice",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "Assessment you have completed for a learner (anonymised WBA you assessed) with your written feedback",
              "Observed feedback conversation (TO or Mini-CEX)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Letters describing your role supervising or mentoring junior doctors, nurses, ACCPs or allied staff",
              "Evidence of structured feedback given (anonymised examples, feedback forms)",
              "Role as an appraiser, assessor or examiner (letters)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Feedback or assessment-skills training",
              "Supervision skills / educational supervisor training",
            ],
          },
        ],
      },
      {
        id: "4.3",
        shortTitle: "Trainer requirements and training QA",
        text: "Meet any regulatory requirements of a trainer and will keep these current as well as participating in quality assurance processes to ensure excellent undergraduate and postgraduate training",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: a supervision challenge (learner in difficulty, ARCP concern) and how you handled it within regulatory requirements",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Recognised trainer status, educational/clinical supervisor accreditation, or equivalent (certificates, appraisal outputs)",
              "Participation in training QA: ARCP panels, faculty groups, GMC/HEE survey responses acted on",
              "Role as appraiser, assessor or examiner (letters)",
              "Evidence of keeping trainer status current (refresher training, appraisal of educational role)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Educational supervisor / GMC-recognised trainer training and updates",
              "Equality and diversity training for trainers",
            ],
          },
        ],
      },
      {
        id: "4.4",
        shortTitle: "Patient involvement in education",
        text: "Endeavour to ensure patient involvement and feedback is integral to the delivery of education to doctors in their individual roles as well as their role as a member of the multidisciplinary team",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD: teaching designed around a patient case or patient feedback, and its effect on learners",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Teaching material built on patient cases or patient feedback (anonymised)",
              "Evidence of patient/family perspectives incorporated into training you delivered (patient stories, follow-up clinic learning, complaints-derived teaching)",
              "Reflection on patient involvement in education",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Patient and public involvement in education training",
              "Simulation faculty development including patient-centred scenarios",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 5,
    icon: "🚨",
    title: "Resuscitation, stabilisation and transfer",
    statement:
      "Doctors specialising in Intensive Care Medicine can identify, resuscitate and stabilise a critically ill patient, as well as undertake their safe intra-hospital or inter-hospital transfer to an appropriately staffed and equipped facility.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 11",
      "**Anchor evidence:** General Adult ICM logbook reflecting a **minimum 2¼ years' experience**, transfer evidence, valid ALS/ATLS",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Logbook demonstrating resuscitation and stabilisation of a broad range of patients across ≥2¼ years General Adult ICM, including interventional procedures",
        "Logbook evidence of transferring intensive care patients",
        "Attendance at a transfer course",
        "Valid ALS / ATLS (or similar)",
        "Reflective notes: clinical incidents, cases that influenced practice, significant events, personal dilemmas",
        "Feedback from colleagues; supervisor report(s)",
      ],
    },
    kcs: [
      {
        id: "5.1",
        shortTitle: "Recognising the acutely ill patient",
        text: "Identify an acutely ill patient or one at risk of significant deterioration by taking account of their medical history, clinical examination, vital signs and available investigations",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "ACAT: unselected referrals/ward reviews identifying deteriorating patients",
              "Mini-CEX: structured assessment of an acutely ill patient (A–E, NEWS2 interpretation)",
              "CBD: a patient whose deterioration was recognised early — or late — and the lessons",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: deteriorating-patient reviews and outcomes (outreach, MET, referrals)",
              "Reflection on a missed or delayed recognition of deterioration",
              "Outreach or MET call log with your role",
            ],
          },
          {
            kind: "cpd",
            items: [
              "ALS current (cross-reference HiLLO-level evidence)",
              "Deteriorating patient / NEWS2 / sepsis recognition training",
            ],
          },
        ],
      },
      {
        id: "5.2",
        shortTitle: "Differential diagnosis and initial plan",
        text: "Integrate clinical findings with timely and appropriate investigations to form a differential diagnosis and an initial treatment plan",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: undifferentiated critical illness worked to a differential and plan",
              "Mini-CEX: admission clerking with differential and plan",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: ICU admissions clerked with your differential and initial plan",
              "Anonymised admission documentation demonstrating structured reasoning",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Diagnostic reasoning / acute medicine update",
              "Point-of-care ultrasound in diagnosis (FUSIC/FICE) — cross-reference HiLLO 6",
            ],
          },
        ],
      },
      {
        id: "5.3",
        shortTitle: "Fluids, inotropes and monitoring",
        text: "Administer intravenous fluids and inotropic drugs as clinically indicated utilising central venous access where required and monitoring the effectiveness of these treatments with invasive monitoring techniques",
        strands: [
          {
            kind: "wba",
            aim: "3–4",
            items: [
              "DOPS: central venous access",
              "DOPS: arterial access",
              "CBD: shock managed with fluids/vasoactive drugs guided by invasive monitoring",
              "Mini-CEX: haemodynamic assessment and titration at the bedside",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: vascular access and haemodynamic support episodes (numbers, sites, complications)",
              "Evidence of ultrasound-guided access competence (logbook, sign-off)",
              "Reflection on a vasoactive/fluid decision that went wrong or was borderline",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Vascular access course or simulation",
              "Haemodynamic monitoring / cardiac output monitoring training",
            ],
          },
        ],
      },
      {
        id: "5.4",
        shortTitle: "Sepsis, trauma and stabilisation",
        text: "Stabilise and initiate an initial treatment plan for a critically ill acute surgical, acute medical or peri-partum patient including those with sepsis or post-trauma and institute timely antimicrobial therapy",
        strands: [
          {
            kind: "wba",
            aim: "3",
            items: [
              "CBD: sepsis with timely antimicrobials",
              "CBD: trauma stabilisation (primary survey to ICU)",
              "CBD or ACAT: peri-partum critical illness (haemorrhage, pre-eclampsia, sepsis)",
              "ACAT: acute surgical/medical take contribution",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: breadth across surgical, medical, obstetric, trauma and sepsis presentations",
              "Sepsis bundle compliance evidence (audit, personal cases)",
              "Reflection on an antimicrobial decision (choice, timing, de-escalation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "ATLS or equivalent, current",
              "Obstetric critical care / maternal medicine update",
              "Antimicrobial stewardship training",
            ],
          },
        ],
      },
      {
        id: "5.5",
        shortTitle: "Airway and advanced respiratory support",
        text: "Provide definitive airway management and initiate and maintain advanced respiratory support",
        strands: [
          {
            kind: "wba",
            aim: "3–4",
            items: [
              "DOPS: rapid sequence induction and intubation in ICU",
              "DOPS: front-of-neck access in simulation, or supraglottic rescue",
              "CBD: initiation and titration of invasive ventilation (lung-protective strategy, weaning)",
              "CBD: a difficult airway in ICU and how it was planned",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: ICU airway episodes (numbers, grade, adjuncts, complications) and ventilation days",
              "Evidence of ventilator management competence: modes used, ARDS management, prone positioning",
              "Reflection on an airway or ventilation critical incident",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Difficult airway course / DAS ICU guideline training",
              "Mechanical ventilation course (e.g. ventilator masterclass, ARDS update)",
            ],
          },
        ],
      },
      {
        id: "5.6",
        shortTitle: "Transport of the ventilated patient",
        text: "Undertake the transport of mechanically ventilated critically ill patients outside the Intensive Care Unit when required",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "DOPS or CBD: intra-hospital transfer of a ventilated patient (to CT/theatre)",
              "CBD or reflection: inter-hospital transfer including risk assessment and preparation",
              "Mini-CEX: pre-transfer checklist and handover",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Transfer logbook (numbers, level of care, adverse events)",
              "Transfer course certificate (cross-reference HiLLO-level evidence)",
              "Evidence of transfer equipment competence and checklist use",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Transfer course (mandatory per SSG)",
              "Retrieval/transfer simulation",
            ],
          },
        ],
      },
      {
        id: "5.7",
        shortTitle: "MDT communication and the record",
        text: "Communicate effectively and in a timely manner, with fellow members of the multi-disciplinary team including those from other specialties and make an accurate, legible and contemporaneous entry in the patient's medical record",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "Mini-CEX: MDT communication during an emergency",
              "ACAT: ward round or referral communication across specialties",
            ],
          },
          {
            kind: "clinical",
            items: [
              "MSF comments on communication and teamworking",
              "Anonymised documentation example showing accurate, legible, contemporaneous entries",
              "Letters/emails to colleagues discussing patient management",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Human factors / crew resource management training",
              "Record-keeping training",
            ],
          },
        ],
      },
      {
        id: "5.8",
        shortTitle: "Escalation and structured handover",
        text: "Where escalation of care is required, be able to arrange this and provide a succinct structured handover to clinical colleagues",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "ACAT or Mini-CEX: structured handover (SBAR) at escalation",
              "CBD: an escalation you arranged (to theatre, specialist centre, or higher level of care)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Referral letter/email arranging escalation (anonymised)",
              "Evidence of handover tool use (unit handover audit, checklist)",
              "Reflection on an escalation that was delayed or contested",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Handover / communication training",
              "Transfer course — cross-reference",
            ],
          },
        ],
      },
      {
        id: "5.9",
        shortTitle: "Anticipating deterioration",
        text: "Recognise when a patient has the potential to deteriorate or requires future treatment escalation and be able to provide explicit instructions regarding an ongoing treatment plan and contact details should a further review be required",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: ward review with explicit escalation plan and safety-netting",
              "ACAT: outreach reviews with documented plans and contact details",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Anonymised plan documentation demonstrating explicit instructions and review triggers",
              "Treatment escalation plan (TEP/ReSPECT) you completed with the patient or family",
              "Outreach follow-up records",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Treatment escalation planning / ReSPECT training",
              "Deteriorating patient update",
            ],
          },
        ],
      },
      {
        id: "5.10",
        shortTitle: "Communicating with families",
        text: "Have the ability to communicate with a patient's family, in terms they can understand, the patient's clinical condition, current and likely future treatment options and where possible, an indicative prognosis in an empathetic and understanding manner",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "Mini-CEX: family discussion including prognosis",
              "CBD: a family meeting where uncertainty or conflict was managed",
              "Mini-CEX: breaking bad news",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on a difficult family conversation",
              "Patient/family feedback if available (anonymised)",
              "Anonymised documentation of a family meeting (attendees, what was said, plan)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Advanced communication skills / breaking bad news course",
              "Family communication in ICU teaching (e.g. VALUE framework)",
            ],
          },
        ],
      },
      {
        id: "5.11",
        shortTitle: "Safety within environmental limits",
        text: "Be mindful at all times that whilst assessing and treating patients they must maintain optimum safety for their patients by recognising any limitations of their current clinical environment, the available equipment and personnel and employing best practice guidelines where these exist",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD or reflection: adapting care to environment/equipment/staffing limits (resus in ED, night staffing, remote site)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of guideline use in emergency care (unit guideline, national guideline applied)",
              "Incident report with learning where environment or equipment limited care",
              "Contribution to equipment or environment safety (checklists, procurement input, capacity escalation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Human factors training",
              "Major incident / surge training — cross-reference HiLLO 9",
            ],
          },
        ],
        note: "Often overlooked because it is about judgement rather than a procedure — a single honest reflection on working around a real limitation covers it well.",
      },
    ],
  },
  {
    n: 6,
    icon: "🖥️",
    title: "Investigations, monitoring and organ support",
    statement:
      "Intensive Care Medicine specialists will have the knowledge and skills to initiate, request and interpret appropriate investigations and advanced monitoring techniques, to aid the diagnosis and management of patients with organ systems failure. They will be able to provide and manage the subsequent advanced organ system support therapies. This will include both pharmacological and mechanical interventions.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 4",
      "**Anchor evidence:** echo/ultrasound training with maintained skill, advanced organ support experience, General ICM logbook",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Echocardiography or ultrasound training (e.g. FUSIC/FICE) with case-mix logbook demonstrating maintenance",
        "Evidence of using advanced organ support equipment and technology (CRRT, advanced haemodynamic monitoring, ± ECMO exposure)",
        "CPD record within seven years; letters/emails discussing patient management",
        "Reflective notes; supervisor report(s)",
      ],
    },
    kcs: [
      {
        id: "6.1",
        shortTitle: "Point-of-care and other investigations",
        text: "Initiate, perform, interpret and integrate point-of-care testing, radiological and laboratory investigations with their patient's clinical findings",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "DOPS: point-of-care ultrasound examination (heart) with findings integrated into care",
              "DOPS: point-of-care ultrasound examination (lung/abdomen/vascular)",
              "CBD: imaging and laboratory results synthesised into a management change",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Ultrasound logbook with case mix (FUSIC/FICE or equivalent)",
              "Evidence of blood-gas, coagulation, microbiology interpretation guiding care (anonymised examples)",
              "Reflection on an investigation that was misinterpreted or delayed",
            ],
          },
          {
            kind: "cpd",
            items: [
              "FUSIC/FICE accreditation or equivalent, with evidence of maintenance",
              "Radiology for intensivists / CT interpretation update",
            ],
          },
        ],
      },
      {
        id: "6.2",
        shortTitle: "Escalating organ support",
        text: "Integrate knowledge, skills and investigations to treat a patient who is deteriorating and institute or escalate organ support therapies",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: multi-organ failure with staged escalation of support",
              "ACAT: deteriorating ICU patient round",
              "Mini-CEX: assessment of a deteriorating ICU patient and escalation decision",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: multi-organ support episodes",
              "Reflection on an escalation decision (timing, ceiling, family involvement)",
              "Evidence of managing organ support escalation overnight as the senior decision-maker",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Advanced organ support update (ARDS, AKI, shock)",
              "Sepsis / septic shock management course",
            ],
          },
        ],
      },
      {
        id: "6.3",
        shortTitle: "Invasive procedures and organ support",
        text: "Perform invasive procedures to aid the diagnosis and management of a critically ill patient, and provide advanced organ-support therapies as well as monitor the effectiveness of these therapies in improving the patient's overall condition",
        strands: [
          {
            kind: "wba",
            aim: "3–4",
            items: [
              "DOPS: chest drain insertion",
              "DOPS: bronchoscopy",
              "DOPS: percutaneous tracheostomy",
              "DOPS: CRRT access and initiation",
              "CBD: initiating and adjusting CRRT or advanced haemodynamic support with effectiveness monitoring",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Procedure logbook (numbers, complications)",
              "Evidence of using advanced organ support equipment and technology (CRRT, cardiac output monitoring, ± ECMO exposure)",
              "Reflection on a procedural complication",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Procedural skills course (tracheostomy, bronchoscopy, chest drain)",
              "CRRT / renal replacement therapy training",
            ],
          },
        ],
      },
      {
        id: "6.4",
        shortTitle: "Monitoring data and safe prescribing",
        text: "Use their knowledge, apply their skills, and interpret investigations and advanced therapeutic monitoring data to manage critically ill patients, including safe prescribing practices and advanced organ system support modalities, throughout the course of their critical illness",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: longitudinal management across a critical illness course, including drug dosing in organ failure (e.g. dosing on CRRT)",
              "Mini-CEX: prescribing review on a ward round",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection: prescribing safety or monitoring-guided decision that changed course",
              "Pharmacy/ward-round documentation of safe prescribing review (anonymised)",
              "Involvement in medication safety work (antimicrobial stewardship, sedation protocols, drug error review)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Prescribing in critical illness / pharmacology update",
              "Antimicrobial stewardship training",
            ],
          },
        ],
        note: "Assessors look for prescribing *over the course* of an illness, not a single decision — a longitudinal CBD is stronger than several snapshots.",
      },
    ],
  },
  {
    n: 7,
    icon: "🏥",
    title: "Perioperative critical care",
    statement:
      "Specialists in Intensive Care Medicine can provide pre-operative resuscitation and optimisation of patients, deliver post-operative clinical care including optimising their physiological status, provide advanced organ system support and manage their pain relief.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 4",
      "**Anchor evidence:** General ICM logbook (≥2¼ years) with perioperative case breadth",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Procedure/caseload logbook reflecting ≥2¼ years General Adult ICM with a wide operative case mix",
        "CPD record within seven years",
        "Reflective notes: clinical incidents, cases that influenced practice, significant events, personal dilemmas",
      ],
    },
    kcs: [
      {
        id: "7.1",
        shortTitle: "Care across a range of operations",
        text: "Have the knowledge and understanding of the care of patients undergoing a wide range of operative procedures",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: postoperative care after major abdominal, vascular or emergency surgery",
              "CBD: postoperative care after a procedure from a different specialty (urology, ENT, orthopaedics, plastics)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: breadth of surgical specialties represented",
              "Evidence of attending pre-operative MDT or perioperative planning meetings",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Perioperative medicine teaching / update",
              "Surgical specialty updates relevant to your unit's case mix",
            ],
          },
        ],
      },
      {
        id: "7.2",
        shortTitle: "Perioperative resuscitation",
        text: "Be expert in resuscitating and stabilising patients before and after a wide range of operative procedures",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: pre-operative resuscitation and optimisation of an emergency surgical patient",
              "CBD or ACAT: unstable postoperative patient stabilised",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: pre-operative optimisation and postoperative resuscitation cases",
              "Reflection on a perioperative deterioration",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Perioperative resuscitation / enhanced recovery update",
              "Goal-directed therapy training",
            ],
          },
        ],
      },
      {
        id: "7.3",
        shortTitle: "Complications of operative procedures",
        text: "Have an awareness of and be able to treat the common complications of a broad range of operative procedures",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: a significant postoperative complication (bleeding, anastomotic leak, ileus, respiratory failure) recognised and treated",
              "CBD: a return to theatre decision",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection or M&M case on a postoperative complication",
              "Logbook: postoperative complications managed",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Surgical complications / perioperative medicine update",
              "M&M attendance with surgical cases — cross-reference HiLLO 2",
            ],
          },
        ],
      },
      {
        id: "7.4",
        shortTitle: "Leading the perioperative team",
        text: "Lead and contribute to the skill mix of a multidisciplinary team that will deliver the perioperative management of patients undergoing surgical procedures",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "Mini-CEX: leading perioperative MDT discussion or ward round",
              "MSF evidence of collaboration with surgical and anaesthetic teams",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Letters/emails showing collaboration with surgical and anaesthetic teams (anonymised)",
              "Evidence of pain-management planning with the MDT (acute pain team liaison, regional/neuraxial follow-up)",
              "Contribution to a perioperative pathway (ERAS, high-risk surgery pathway)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Acute pain management update",
              "MDT working / human factors training",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 8,
    icon: "🕊️",
    title: "Consequences of critical illness, end of life and organ donation",
    statement:
      "Doctors specialising in Intensive Care Medicine will understand and manage the physical and psychosocial consequences of critical illness for patients and their families, including providing pain relief, treating delirium and arranging ongoing care and rehabilitation. They will also manage the withholding or withdrawal of life-sustaining treatment, discussing end of life care with patients and their families and facilitating organ donation where appropriate.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 5",
      "**Anchor evidence:** General ICM logbook breadth, organ donation activity, rehab/follow-up involvement",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Logbook demonstrating management of a broad range of patients (≥2¼ years General Adult ICM)",
        "Organ donation activities record",
        "Attendance at rehabilitation or ICU follow-up clinics (minutes, clinic letters indicating your presence, referrals)",
        "Letters/emails discussing patient management; CPD record; reflective notes; supervisor report(s)",
      ],
    },
    kcs: [
      {
        id: "8.1",
        shortTitle: "Consequences, pain and delirium",
        text: "Identifying and limiting the physical and psychosocial consequences of critical illness for patients and families paying particular attention to the assessment, prevention and treatment of pain and delirium",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: delirium assessment and management",
              "CBD or Mini-CEX: analgesia/sedation strategy (including sedation holds and daily targets)",
              "Mini-CEX: assessment of pain in a non-verbal patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of PICS awareness: follow-up clinic involvement, rehab referral, patient diary work",
              "Logbook: delirium and pain management cases",
              "Involvement in unit delirium/sedation/early mobilisation initiatives (audit, guideline)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Delirium / sedation / rehabilitation after critical illness update",
              "Pain management course",
            ],
          },
        ],
      },
      {
        id: "8.2",
        shortTitle: "Discharge, follow-up and rehabilitation",
        text: "Communicating the continuing care requirements of patients at discharge from both ICU and hospital to healthcare professionals, patients and relatives. This will include the patient's plan for ongoing care, medical follow up and rehabilitation",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: complex discharge with rehabilitation planning",
              "Mini-CEX: ICU-to-ward handover",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Anonymised ICU discharge summary or structured handover you authored",
              "Attendance at rehabilitation or ICU follow-up clinics (minutes, clinic letters indicating your presence, referrals)",
              "Evidence of rehabilitation prescription use (NICE CG83)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Rehabilitation after critical illness / follow-up clinic training",
              "Discharge planning / continuity of care teaching",
            ],
          },
        ],
      },
      {
        id: "8.3",
        shortTitle: "End of life care",
        text: "Facilitating discussions focused on how to manage end of life care with patients and their families. The process of withholding or withdrawing life-sustaining treatments and providing palliative care whilst maintaining respect for cultural and religious beliefs will form an important element of this.",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "Mini-CEX: end-of-life family discussion",
              "CBD: withdrawal/withholding decision with cultural or religious dimension",
              "CBD: a decision involving disagreement between family and team, or second opinion",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on an end-of-life dilemma",
              "Anonymised documentation of a withdrawal decision and palliative plan",
              "Evidence of working with palliative care, chaplaincy or faith leaders",
            ],
          },
          {
            kind: "cpd",
            items: [
              "End-of-life care in ICU / palliative care update",
              "Law and ethics of withdrawal (MCA, best interests, court applications) training",
            ],
          },
        ],
      },
      {
        id: "8.4",
        shortTitle: "Diagnosing death",
        text: "Diagnosing death using neurological criteria and diagnosing death using circulatory criteria in time sensitive scenarios (eg donation after circulatory death).",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "DOPS or CBD: diagnosis of death using neurological criteria (documented participation, two-doctor test)",
              "CBD or reflection: DCD process and time-sensitive circulatory death diagnosis",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: DNC tests performed or observed",
              "Evidence of following the AoMRC code of practice and FICM/ICS guidance (anonymised documentation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "DNC/organ donation course or simulation",
              "AoMRC code of practice / ancillary investigations training",
            ],
          },
        ],
        note: "Diagnosis of death using neurological criteria must follow the AoMRC code; documented participation as one of the two doctors is the strongest evidence.",
      },
      {
        id: "8.5",
        shortTitle: "Organ donation",
        text: "Identifying likely organ donors, working collaboratively with specialist nurses for organ donation and facilitating the process of organ donation, including providing appropriate physiological support to the organ donor",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: donor identification, SN-OD referral and family approach",
              "Mini-CEX: collaborative family approach with the SN-OD",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of donor physiological optimisation managed (anonymised)",
              "Organ donation committee/CLOD activity, audits or teaching if held",
              "Referral rate / PDA compliance data with your involvement",
              "Organ donation activities record (as the SSG lists)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "NHSBT organ donation training / deceased donation course",
              "Family approach training",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 9,
    icon: "👥",
    title: "Leading and managing a critical care service",
    statement:
      "Intensive Care Medicine specialists will have the skillset and competence to lead and manage a critical care service, including the multidisciplinary clinical team and providing contemporaneous care to a number of critically ill patients.",
    atAGlance: [
      "**Standard expected:** Level 4",
      "**Key capabilities:** 5",
      "**Anchor evidence:** leading ICU ward rounds, management meeting participation, MDT leadership",
      "See: **Evidence rules that apply everywhere**",
    ],
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Evidence of leading ICM ward rounds",
        "Attendance at management or Hospital Board meetings (minutes, action plans, results)",
        "Organisation of, attendance at, or actions from MDT meetings",
        "Postgraduate qualification or further study in leadership/management, if held",
        "Letters/emails discussing patient management and collaboration; supervisor report(s)",
      ],
    },
    kcs: [
      {
        id: "9.1",
        shortTitle: "Supporting colleagues outside ICU",
        text: "Providing support to colleagues and contributing to the management of acutely unwell patients outside of the critical care unit when requested to do so",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "ACAT: outreach/ward referrals supported",
              "CBD: a ward patient you advised on without admitting",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Referral responses or letters evidencing support to other teams (anonymised)",
              "Outreach or MET log with your role",
              "Evidence of supporting colleagues (advice calls, second opinions, support to trainees overnight)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Outreach / critical care without walls training",
              "Deteriorating patient update",
            ],
          },
        ],
      },
      {
        id: "9.2",
        shortTitle: "Leading a diverse MDT",
        text: "Having the leadership and communication skills to head a culturally diverse multidisciplinary team providing care to an equally diverse range of patients on the critical care unit",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "Mini-CEX: leading a unit ward round or handover",
              "MSF evidencing MDT leadership across diverse staff groups",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of leading ICM ward rounds (rota, supervisor letter)",
              "Evidence of managing team conflict, staff wellbeing or cultural competence",
              "Contribution to unit staffing, induction or team development",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Leadership or human factors training",
              "Equality, diversity and inclusion / cultural competence training",
            ],
          },
        ],
      },
      {
        id: "9.3",
        shortTitle: "Involving patients and relatives",
        text: "Involving patients and their relatives in as many treatment decisions as circumstances will allow whilst ensuring patients and relatives are kept abreast of the current treatment plan and options",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "Mini-CEX or CBD: shared decision-making with patient/family",
              "CBD: keeping a family informed through a prolonged or uncertain course",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Patient/family feedback or thank-you correspondence (anonymised)",
              "Evidence of family communication systems you contributed to (family liaison, communication boards, update calls)",
              "Reflection on a case where patient/family involvement changed the plan",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Shared decision-making / communication training",
              "Family-centred care in ICU teaching",
            ],
          },
        ],
      },
      {
        id: "9.4",
        shortTitle: "Systems and processes for safe care",
        text: "Actively participating in the development and application of systems and processes designed to improve the delivery of safe care for critically ill patients",
        strands: [
          {
            kind: "wba",
            aim: "1–2",
            items: [
              "CBD: a system or process change you led and its effect on safe care",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Systems work: capacity/escalation policies, safety huddles, checklists you developed or embedded (documents plus minutes)",
              "Cross-reference QI evidence from HiLLO 2 where relevant",
              "Attendance at management or Hospital Board meetings, or other meetings indicating leadership in the wider health environment (minutes, action plans, results)",
              "Evidence of organisation of, attendance at, or actions from MDT meetings",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Leadership/management course or postgraduate qualification",
              "QI methodology training — cross-reference HiLLO 2",
            ],
          },
        ],
      },
      {
        id: "9.5",
        shortTitle: "Mass casualty incidents",
        text: "Understanding and being able to describe the special requirements of a mass casualty incident",
        strands: [
          {
            kind: "wba",
            aim: "1",
            items: [
              "CBD or reflection: unit surge planning (e.g. pandemic escalation) or MAJAX exercise role",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Knowledge of the trust major incident plan evidenced (teaching delivered, plan contribution, exercise debrief)",
              "Evidence of a real surge or major incident response and your role (anonymised)",
              "Contribution to critical care network surge or mutual aid planning",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Major incident training / exercise participation",
              "CBRN / mass casualty awareness training",
            ],
          },
        ],
        note: "Rarely evidenced by a real event — a MAJAX exercise role or a documented surge plan contribution is expected and sufficient.",
      },
    ],
  },
  {
    n: 10,
    icon: "💉",
    title: "Anaesthesia",
    statement:
      "Intensive Care Medicine specialists will have developed the necessary skills of induction of anaesthesia, airway control, care of the unconscious patient and understanding of surgery and its physiological impact on the patient.",
    atAGlance: [
      "**Standard expected:** Level 3",
      "**Key capabilities:** 10",
      "⚠️ **This HiLLO has *required* evidence** (below) if the placement was within seven years — the IAC alone is explicitly insufficient (it can evidence the 6-month level only if anaesthetic training was outside the UK)",
      "**Weak HiLLO 10 evidence cannot be compensated elsewhere** and is a leading cause of failed applications",
      "See: **Evidence rules that apply everywhere**",
    ],
    required: {
      heading: "Required evidence (placement within the last 7 years WTE)",
      qualifier: "placement within the last 7 years WTE",
      items: [
        "**Logbook over 12 months of at least 300 cases in total**, showing development and progression of anaesthetic skills",
        "Demonstration of **performing emergency anaesthesia for simple surface surgery in ASA 1 and 2 patients under local supervision**",
        "**At least 12 SLEs for appropriate CT1 anaesthesia procedures** — in addition to IAC SLEs, excluding ICM-related SLEs (refer to the Anaesthesia curriculum)",
        "**Anaesthetic rota participation** (samples)",
        "**Supervisor reports demonstrating completion of the equivalent of a year of anaesthesia training**",
        "Anaesthesia charts/records (supportive — insufficient alone)",
        "Anaesthesia CPD: e-Learning Anaesthesia, study days, updates",
      ],
    },
    maintenance: {
      heading:
        "Maintenance route — if anaesthesia training was more than 7 years ago (WTE)",
      qualifier: "if anaesthesia training was more than 7 years ago (WTE)",
      items: [
        "Logbook of ICU intubations/airway management",
        "Ongoing anaesthetic commitments other than ICM (anaesthesia logbook/rota)",
        "Anaesthesia-related SLEs",
        "Anaesthesia CPD (on its own insufficient)",
      ],
    },
    kcs: [
      {
        id: "10.1",
        shortTitle: "Pre-anaesthetic checks",
        text: "Conduct comprehensive pre-anaesthetic and pre-operative checks",
        strands: [
          {
            kind: "wba",
            aim: "1–2 anaesthesia SLEs",
            items: [
              "A-DOPS: anaesthetic machine and equipment check",
              "A-CEX: pre-operative check and WHO sign-in for an elective list",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: pre-operative assessments performed (part of the 300-case logbook)",
              "Evidence of completing the IAC checks competencies (if trained in the UK)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "e-Learning Anaesthesia (e-LA) modules: safety, equipment check",
              "Anaesthetic induction/departmental teaching attendance",
            ],
          },
        ],
      },
      {
        id: "10.2",
        shortTitle: "Basic sciences for anaesthesia",
        text: "Demonstrate knowledge of anatomy, physiology, biochemistry and pharmacology relevant to anaesthetic practice",
        strands: [
          {
            kind: "wba",
            aim: "1–2 anaesthesia SLEs",
            items: [
              "A-CBD: applied basic science in an anaesthetic case (e.g. induction agent choice in shock, neuromuscular blockade pharmacology)",
              "A-CEX with explicit comment on applied physiology or pharmacology",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on an anaesthetic case where basic science understanding changed management",
              "Evidence of primary FRCA-level knowledge if held (exam, MCQ bank progress) or equivalent",
            ],
          },
          {
            kind: "cpd",
            items: [
              "e-LA modules: physiology, pharmacology, anatomy for regional anaesthesia",
              "Primary-level anaesthesia teaching attended or delivered",
            ],
          },
        ],
      },
      {
        id: "10.3",
        shortTitle: "Anaesthetic equipment and physics",
        text: "Describe the functioning principles of standard equipment used within anaesthetic practice and understand the physical principles governing the operation of such equipment and the clinical measurements derived from them",
        strands: [
          {
            kind: "wba",
            aim: "1 anaesthesia SLE",
            items: [
              "A-CBD: anaesthetic machine, breathing systems, vaporisers or monitoring physics discussed through a case",
              "A-DOPS: setting up and checking monitoring (capnography, agent analysis, neuromuscular monitoring)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Evidence of equipment-failure or alarm management during a case (reflection, incident report if any)",
              "Logbook: cases across different anaesthetic machines/environments",
            ],
          },
          {
            kind: "cpd",
            items: [
              "e-LA modules: equipment and physics",
              "Equipment/physics teaching or simulation",
            ],
          },
        ],
      },
      {
        id: "10.4",
        shortTitle: "Pre-operative assessment (ASA 1-3)",
        text: "Pre-operatively assess ASA 1-3 patients' suitability for anaesthesia, prescribe suitable pre-medication and recognise when further investigation or optimisation is required prior to commencing surgery and adequately communicate this to the patient and their family",
        strands: [
          {
            kind: "wba",
            aim: "2 anaesthesia SLEs",
            items: [
              "A-CEX: pre-operative assessment of an ASA 1–3 patient including communication of the plan",
              "A-CBD: a case deferred or optimised before surgery, with rationale",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: pre-operative assessments with ASA grading",
              "Anonymised pre-assessment documentation showing investigation and optimisation decisions",
              "Evidence of pre-assessment clinic attendance",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Pre-operative assessment / perioperative medicine teaching",
              "e-LA modules: pre-operative assessment, premedication",
            ],
          },
        ],
      },
      {
        id: "10.5",
        shortTitle: "Induction and its complications",
        text: "Safely induce anaesthesia in ASA 1-3 patients and recognise and deal with complications associated with the induction of anaesthesia",
        strands: [
          {
            kind: "wba",
            aim: "2–3 anaesthesia SLEs",
            items: [
              "A-DOPS: induction of anaesthesia (elective ASA 1–3)",
              "A-DOPS: intravenous induction and airway management under supervision, progression to distant supervision",
              "A-CBD: an induction complication (hypotension, laryngospasm, aspiration risk, failed cannulation) managed",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: induction numbers with progression of supervision level (immediate → local → distant)",
              "Reflection on an induction critical incident or near-miss",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Simulation: induction complications",
              "e-LA modules: induction, airway",
            ],
          },
        ],
      },
      {
        id: "10.6",
        shortTitle: "Maintenance and monitoring",
        text: "As a member of the multi-disciplinary theatre team, maintain anaesthesia for the relevant procedure, utilise appropriate monitoring and effectively interpret the information it provides to ensure the safety of the anaesthetised patient",
        strands: [
          {
            kind: "wba",
            aim: "2 anaesthesia SLEs",
            items: [
              "A-DOPS or A-CEX: maintenance phase with monitoring interpretation and intra-operative management",
              "A-CEX: management of an intra-operative physiological change (hypotension, hypoxia, arrhythmia)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: case mix across surgical specialties and techniques (TIVA, volatile, spontaneous vs controlled ventilation)",
              "Evidence of working as part of the theatre team (WHO checklist, team brief participation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "e-LA modules: maintenance, monitoring, intra-operative problems",
              "Theatre human factors / team training",
            ],
          },
        ],
      },
      {
        id: "10.7",
        shortTitle: "Anaesthetic critical incidents",
        text: "Recognise anaesthetic critical incidents, understand their causes and how to manage them",
        strands: [
          {
            kind: "wba",
            aim: "1–2 anaesthesia SLEs",
            items: [
              "A-CBD: an anaesthetic critical incident (real or simulated) analysed — causes and management",
              "Simulation assessment: anaesthetic emergency (anaphylaxis, malignant hyperthermia, LAST, can't-ventilate)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on an anaesthetic critical incident and the learning",
              "Incident report or M&M presentation of an anaesthetic incident (anonymised)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Anaesthetic emergencies simulation course",
              "AAGBI/Association of Anaesthetists quick reference handbook training",
            ],
          },
        ],
      },
      {
        id: "10.8",
        shortTitle: "Recovery, analgesia and fluids",
        text: "Safely care for a patient recovering from anaesthesia and recognise and treat the common associated complications whilst providing appropriate post-operative analgesia (including that via regional and neuraxial blockade), anti-emesis and fluid therapies",
        strands: [
          {
            kind: "wba",
            aim: "2 anaesthesia SLEs",
            items: [
              "A-CEX or A-CBD: recovery-phase care including analgesia (regional/neuraxial where seen), PONV and fluids",
              "A-DOPS: a regional or neuraxial technique observed or performed (spinal, simple block) where available",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: recovery cases and complications managed (airway obstruction, pain, PONV, hypotension)",
              "Evidence of post-operative analgesia planning including regional/neuraxial follow-up",
              "Recovery-room attendance and handover evidence",
            ],
          },
          {
            kind: "cpd",
            items: [
              "e-LA modules: recovery, post-operative analgesia, regional anaesthesia",
              "Acute pain / regional anaesthesia teaching",
            ],
          },
        ],
      },
      {
        id: "10.9",
        shortTitle: "Emergency anaesthesia (ASA 1E–2E)",
        text: "Provide urgent or emergency anaesthesia to ASA 1E and 2E patients requiring non-complex emergency surgery",
        strands: [
          {
            kind: "wba",
            aim: "2 anaesthesia SLEs",
            items: [
              "A-DOPS/A-CBD: emergency anaesthesia for simple surface surgery, ASA 1E–2E, under local supervision (REQUIRED — see the HiLLO page)",
              "A-CEX: rapid sequence induction for an emergency case",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: emergency cases identified as such, with ASA E grading and supervision level",
              "Evidence of emergency theatre list participation (rota)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Emergency anaesthesia / RSI simulation",
              "e-LA modules: emergency anaesthesia",
            ],
          },
        ],
        note: "This is the SSG's explicitly required competency for HiLLO 10 — emergency anaesthesia for simple surface surgery in ASA 1E–2E under local supervision. Do not leave it to chance.",
      },
      {
        id: "10.10",
        shortTitle: "Difficult airways and CICO",
        text: "Identify patients with difficult airways, demonstrate management of the 'cannot intubate cannot oxygenate' scenario in simulation, and be familiar with difficult airway guidelines",
        strands: [
          {
            kind: "wba",
            aim: "1–2 anaesthesia SLEs",
            items: [
              "Simulation certificate/record: CICO scenario performed",
              "A-CBD: difficult airway prediction and planning (DAS guidelines applied)",
              "A-DOPS: videolaryngoscopy, fibreoptic intubation or supraglottic airway placement",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: airway techniques used with difficult-airway cases identified",
              "Evidence of difficult airway alert/letter completion for a patient (anonymised)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Airway workshop / difficult airway course",
              "DAS guideline training; CICO/front-of-neck-access drill",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 11,
    icon: "🩺",
    title: "Medicine",
    statement:
      "In order to manage acutely ill patients outside the Intensive Care Unit, an Intensive Care Medicine specialist will have the diagnostic, investigational and patient management skills required to care for ward-based patients whose condition commonly requires admission to the intensive care unit.",
    atAGlance: [
      "**Standard expected:** Level 3",
      "**Key capabilities:** 8",
      "**Anchor evidence:** supervisor reports demonstrating the **equivalent of a year of medicine training (up to half may be Emergency Medicine)** and a **logbook of over 12 months** of appropriate medical caseload",
      "**Weak HiLLO 11 evidence cannot be compensated elsewhere**",
      "⚠️ **This HiLLO has *required* evidence** (below) if the placement was within seven years",
      "See: **Evidence rules that apply everywhere**",
    ],
    required: {
      heading: "Required evidence (placement within the last 7 years WTE)",
      qualifier: "placement within the last 7 years WTE",
      items: [
        "**Supervisor report(s) demonstrating completion of the equivalent of a year of medicine training** (up to half may be Emergency Medicine)",
        "**Logbook with over 12 months of caseload and mix appropriate to a medical placement**",
        "**Medicine-related SLEs** appropriate to the placement, considering the key capabilities",
        "**ALS or other life support courses**, current",
      ],
    },
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Relevant CPD within seven years; letters/emails on patient management; reflective notes",
      ],
    },
    maintenance: {
      heading:
        "Maintenance route — if medicine training was more than 7 years ago (WTE)",
      qualifier: "if medicine training was more than 7 years ago (WTE)",
      items: [
        "Evidence you work in a General ICU which accepts medical patients",
        "Evidence you attend EM and ward referrals",
        "Logbook; ALS/other life support; medicine CPD; unit caseload activity (not alone sufficient); reflections, referrals, audits, QI",
      ],
    },
    kcs: [
      {
        id: "11.1",
        shortTitle: "Acute unselected take",
        text: "Be able to manage an acute unselected take",
        strands: [
          {
            kind: "wba",
            aim: "2–3 medicine SLEs",
            items: [
              "ACAT: unselected medical take (multiple patients over a take)",
              "Mini-CEX: clerking and initial management of an unselected admission",
              "CBD: a diagnostically challenging take patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: take episodes with breadth of presentations (chest pain, breathlessness, sepsis, AKI, GI bleed, collapse, confusion)",
              "Evidence of take leadership (post-take ward round presentation, handover)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Acute medicine update / Acute Internal Medicine course",
              "ALS current",
            ],
          },
        ],
      },
      {
        id: "11.2",
        shortTitle: "Acute specialty-related take",
        text: "Manage an acute specialty-related take",
        strands: [
          {
            kind: "wba",
            aim: "1–2 medicine SLEs",
            items: [
              "ACAT or CBD: specialty take (cardiology, respiratory, gastroenterology, renal, neurology)",
              "Mini-CEX: specialty-specific assessment (e.g. ACS pathway, NIV initiation, upper GI bleed)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: specialty-take cases",
              "Evidence of specialty pathway use (ACS, PE, stroke, DKA protocols) in your cases",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Specialty update relevant to the take (e.g. BTS, BSG, cardiology update)",
              "e-learning modules for the specialty",
            ],
          },
        ],
      },
      {
        id: "11.3",
        shortTitle: "Continuity of care for in-patients",
        text: "Be capable of providing continuity of care to medical in-patients, including management of comorbidities and cognitive impairment",
        strands: [
          {
            kind: "wba",
            aim: "2 medicine SLEs",
            items: [
              "CBD: inpatient with multimorbidity and cognitive impairment (delirium/dementia) managed over time",
              "Mini-CEX: ward round review demonstrating continuity",
              "ACAT: ward round leadership over a period of days",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: inpatients managed over multiple days with comorbidity",
              "Anonymised documentation of a capacity assessment or best-interests decision on a medical ward",
              "Evidence of MDT input into a complex inpatient (geriatrics, pharmacy, therapies)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Geriatric medicine / frailty / dementia and delirium training",
              "Polypharmacy / medicines optimisation update",
            ],
          },
        ],
      },
      {
        id: "11.4",
        shortTitle: "Outpatient and community care",
        text: "Know how to manage patients in an outpatient clinic, ambulatory or community setting (including management of long term conditions)",
        strands: [
          {
            kind: "wba",
            aim: "1–2 medicine SLEs",
            items: [
              "Mini-CEX: outpatient or ambulatory consultation observed",
              "CBD: long-term condition management decision in an ambulatory setting",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Clinic letters you authored or clinic attendance evidence (ambulatory care, follow-up clinic, hot clinic)",
              "Evidence of SDEC/ambulatory pathway use",
              "Logbook or record of clinic sessions attended",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Ambulatory emergency care / outpatient medicine training",
              "Long-term conditions update (diabetes, heart failure, COPD)",
            ],
          },
        ],
        note: "The hardest KC to evidence from an ICU post — plan clinic or SDEC sessions deliberately during the medicine placement.",
      },
      {
        id: "11.5",
        shortTitle: "Medical problems in other specialties",
        text: "Have the ability to assess and treat medical problems in patients in other specialties and special cases",
        strands: [
          {
            kind: "wba",
            aim: "1–2 medicine SLEs",
            items: [
              "CBD or ACAT: medical review of a surgical, obstetric, psychiatric or oncology inpatient",
              "Mini-CEX: assessment of a medical problem in a non-medical setting",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Referral responses evidencing cross-specialty input (anonymised)",
              "Logbook: medical reviews of patients under other specialties",
              "Evidence of perioperative medicine or obstetric medicine involvement",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Perioperative medicine / obstetric medicine / liaison psychiatry update",
              "Medical problems in surgical patients teaching",
            ],
          },
        ],
      },
      {
        id: "11.6",
        shortTitle: "MDT working and discharge planning",
        text: "Make an active contribution to the functioning of a multi-disciplinary clinical team including effective discharge planning",
        strands: [
          {
            kind: "wba",
            aim: "1–2 medicine SLEs",
            items: [
              "MSF or Mini-CEX: MDT working and board-round contribution",
              "CBD: a complex discharge planned with the MDT",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Anonymised discharge summary with planning input",
              "Evidence of board round / MDT attendance and contribution",
              "Letters/emails to GPs or community teams (anonymised)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Discharge planning / integrated care training",
              "Team working / human factors",
            ],
          },
        ],
      },
      {
        id: "11.7",
        shortTitle: "Resuscitation and deterioration",
        text: "Deliver effective resuscitation and manage an acutely deteriorating patient",
        strands: [
          {
            kind: "wba",
            aim: "2 medicine SLEs",
            items: [
              "ACAT or CBD: ward-based deterioration or peri-arrest managed",
              "Mini-CEX: leading or participating in a cardiac arrest or peri-arrest call",
              "DOPS: a resuscitation skill (defibrillation, airway adjunct, IO access)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Valid ALS (cross-reference HiLLO-level evidence)",
              "Cardiac arrest team participation log",
              "Reflection on a resuscitation event on the wards",
            ],
          },
          {
            kind: "cpd",
            items: [
              "ALS current",
              "Deteriorating patient / resuscitation update",
            ],
          },
        ],
      },
      {
        id: "11.8",
        shortTitle: "End of life and palliative care",
        text: "Care for patients who require end of life care as well as those who require palliative care",
        strands: [
          {
            kind: "wba",
            aim: "1–2 medicine SLEs",
            items: [
              "CBD: ward-based end-of-life or palliative care decision",
              "Mini-CEX: end-of-life conversation with a patient or family on the wards",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection on a palliative transition outside ICU",
              "Anonymised documentation of an end-of-life care plan, DNACPR/ReSPECT discussion or symptom control plan",
              "Evidence of working with the palliative care team",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Palliative care / end-of-life care training",
              "Advance care planning / ReSPECT training",
            ],
          },
        ],
      },
    ],
  },
  {
    n: 12,
    icon: "🧠",
    title: "Neurosciences intensive care medicine",
    statement:
      "Doctors specialising in Intensive Care understand the special needs of, and are competent to manage patients with neurological diseases, both medical and those requiring surgery, which will include the management of raised intracranial pressure, central nervous system infections and neuromuscular disorders.",
    atAGlance: [
      "**Standard expected:** Level 3 — performs tasks in most circumstances, guidance only in complex situations; advanced knowledge needing occasional advice; plans and manages most cases, specialist help for some",
      "**Placement:** evidence appropriate to a **three-month attachment to a specialist neurosciences unit**",
      "**Key capabilities:** 9",
      "**Currency:** neuro ICM time more than seven years ago (WTE) **must** be supplemented by the maintenance checklist at the end",
      "**Cross-referencing:** much of this evidence also serves HiLLOs 5, 6 and 7 — list it there too and state where the document lives; never upload duplicates",
    ],
    hilloLevel: {
      heading: "Placement-level evidence (covers the whole HiLLO)",
      qualifier: "covers the whole HiLLO",
      items: [
        "Logbook of caseload and mix appropriate to a three-month neuro ICM placement",
        "Rota demonstrating the neurosciences attachment",
        "Unit caseload activity data (supportive triangulation — not sufficient alone)",
        "Supervisor report confirming the equivalent of a three-month neuro ICM placement, commenting on each key capability",
        "At least two reflective pieces from this placement (clinical incidents, cases that influenced practice, significant events, personal dilemmas)",
        "CPD record of neurocritical care educational activity within the last seven years",
        "Letters/emails with colleagues discussing patient management or showing collaboration",
        "One audit or QI project on the unit (e.g. EVD infection rates, ICP bundle compliance, time to osmotherapy) — also cross-references HiLLOs 1 and 2",
      ],
    },
    maintenance: {
      heading:
        "Maintenance route — if your neuro ICM placement was more than 7 years ago",
      qualifier: "if your neuro ICM placement was more than 7 years ago",
      items: [
        "Rotas showing current work in or with a neuro ICU",
        "Referrals to/from neurosciences",
        "Current caseload/logbook including neuro cases",
        "Neurocritical care CPD, reflections, governance, QI or audit",
      ],
      intro: "The SSG states maintenance **must** be demonstrated:",
    },
    kcs: [
      {
        id: "12.1",
        shortTitle: "Perioperative risk assessment",
        text: "Understanding and assessing the perioperative risks associated with patient comorbidities, emergency anaesthesia and surgery and the implications of concomitant drug therapies in these patients",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: pre-operative risk assessment of a comorbid neurosurgical patient",
              "CBD: emergency craniotomy — risks of emergency anaesthesia and surgery",
              "Mini-CEX: pre-operative assessment on the unit",
              "ACAT: neurosurgical admission with significant comorbidity",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook cases: anticoagulation/antiplatelet reversal in intracranial haemorrhage",
              "Documented MDT or neurosurgical planning discussion you contributed to",
              "Reflection: implications of concomitant drug therapy (e.g. antiepileptics, DOACs)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Neuroanaesthesia or perioperative neurosciences teaching/course",
            ],
          },
        ],
      },
      {
        id: "12.2",
        shortTitle: "Postoperative medical conditions",
        text: "Being competent in the postoperative care of common acute and chronic medical conditions commonly found in these patients",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: post-craniotomy patient with an acute or chronic medical condition (e.g. diabetes, AF, COPD)",
              "ACAT: take of post-operative neurosurgical admissions",
              "Mini-CEX: neuro ICU ward round review of a post-operative patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: post-operative neurosurgical cases with medical comorbidity managed",
              "Discharge or step-down documentation showing continuity of medical care",
            ],
          },
          {
            kind: "cpd",
            items: ["Neurocritical care or postoperative medicine update"],
          },
        ],
      },
      {
        id: "12.3",
        shortTitle: "Effects of major neurosurgery",
        text: "Being aware of the effects of major neurological surgery on these patients and the associated immediate postoperative management of these patients including the common complications and providing optimal analgesia",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: immediate post-craniotomy management and complications",
              "CBD: post-operative care after aneurysm clipping or coiling",
              "CBD: major spinal surgery aftercare including analgesia strategy",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: post-operative complications recognised and managed",
              "Documented analgesia plans for craniotomy/spinal patients",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Neurosurgery overview session or operative/theatre attendance record",
            ],
          },
        ],
      },
      {
        id: "12.4",
        shortTitle: "Levels of care",
        text: "Knowing the factors which influence the intensity, levels of care and the clinical environments where the necessary care can be safely delivered to patients with neurological disease",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: admission/triage decision for a patient with neurological disease",
              "CBD or ACAT: step-down or repatriation decision from neuro ICU",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Log of level-of-care decisions with rationale (capture these as they happen)",
              "Contribution to an admission, escalation or repatriation pathway/guideline",
            ],
          },
          {
            kind: "cpd",
            items: ["Neurocritical care pathways / levels-of-care teaching"],
          },
        ],
      },
      {
        id: "12.5",
        shortTitle: "Cardiorespiratory dysfunction",
        text: "Recognising and treating respiratory and cardiovascular dysfunction with their associated complications commonly encountered in these patients",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: neurogenic pulmonary oedema or ventilation strategy in brain injury",
              "CBD: cardiovascular instability after brain injury (e.g. SAH-associated myocardial dysfunction)",
              "DOPS: relevant procedure in a neuro patient (e.g. arterial/central access, bronchoscopy)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: respiratory and cardiovascular complications managed",
              "Reflection on a difficult ventilation or haemodynamic problem in brain injury",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Teaching on ventilation and haemodynamics in acute brain injury",
            ],
          },
        ],
      },
      {
        id: "12.6",
        shortTitle: "Other perioperative complications",
        text: "Effectively assessing and managing other perioperative conditions and complications encountered by pre- and post-operative neurosurgical and neurological patients",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "CBD: sodium and water disturbance (DI, SIADH, cerebral salt wasting)",
              "CBD or Mini-CEX: another perioperative complication (seizure, CSF leak, wound infection, VTE)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: perioperative complications beyond the cardiorespiratory",
              "Guideline/protocol use or contribution (e.g. sodium management)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Relevant update (e.g. sodium disorders, VTE in neurosurgery)",
            ],
          },
        ],
        note: "Commonly under-evidenced — one good CBD here fills a frequent gap.",
      },
      {
        id: "12.7",
        shortTitle: "Neurological assessment",
        text: "Being able to competently assess a patient's neurological status and provide appropriate support where necessary",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "Mini-CEX: structured neurological assessment (GCS, pupils, focal signs, sedation hold)",
              "CBD: assessment of impaired consciousness with investigation plan",
              "DOPS: use of neuromonitoring where performed",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: documented serial neurological assessments guiding management",
              "Reflection on an assessment that changed the clinical course",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Neurological assessment or neuromonitoring teaching (incl. EEG awareness)",
            ],
          },
        ],
      },
      {
        id: "12.8",
        shortTitle: "Raised intracranial pressure",
        text: "Having a thorough understanding of the pathophysiology of raised intracranial pressure including the options for its operative and non-operative management",
        strands: [
          {
            kind: "wba",
            aim: "2–3",
            items: [
              "CBD: tiered ICP management (positioning, sedation, osmotherapy, CO₂ control, CSF drainage)",
              "CBD: decision-making around surgical options (EVD, evacuation, decompressive craniectomy)",
              "DOPS: EVD/ICP monitor care or insertion where performed",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: raised ICP cases (TBI, SAH, hydrocephalus, CNS infection) managed",
              "Audit: ICP bundle compliance, time to osmotherapy, or EVD infection rates",
            ],
          },
          {
            kind: "cpd",
            items: [
              "ICP/neuromonitoring course or teaching delivered on raised ICP",
            ],
          },
        ],
      },
      {
        id: "12.9",
        shortTitle: "Neurological emergencies and escalation",
        text: "Providing immediate treatment of perioperative emergencies in neurosurgical and neurological patients and knowing when to seek senior help and support",
        strands: [
          {
            kind: "wba",
            aim: "2",
            items: [
              "ACAT or CBD: acute deterioration (e.g. pupillary change, post-operative haematoma, status epilepticus) with escalation to neurosurgery/senior support",
              "Simulation-based assessment of a neuro emergency, where available",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: emergencies attended and immediate management provided",
              "Reflection explicitly addressing when and how you sought senior help",
            ],
          },
          {
            kind: "cpd",
            items: ["Neuro emergencies simulation or resuscitation update"],
          },
        ],
      },
    ],
  },
  {
    n: 13,
    icon: "🧸",
    title: "Paediatric intensive care medicine",
    statement:
      "A specialist in adult Intensive Care Medicine is competent to recognise, provide initial stabilisation and manage common paediatric emergencies until expert advice or specialist assistance is available. They are familiar with legislation regarding safeguarding children in the context of Intensive Care Medicine practice.",
    atAGlance: [
      "**Standard expected:** Level 3",
      "**Key capabilities:** 6",
      "**Placement:** evidence appropriate to a **three-month paediatric ICM placement**, including attendance at paediatric emergencies",
      "⚠️ **Mandatory courses:** APLS or EPALS, and child safeguarding at the level required for your role",
      "**Weak HiLLO 13 evidence cannot be compensated elsewhere**",
      "⚠️ **This HiLLO has *required* evidence** (below) if the placement was within seven years",
      "See: **Evidence rules that apply everywhere**",
    ],
    required: {
      heading: "Required evidence (placement within the last 7 years WTE)",
      qualifier: "placement within the last 7 years WTE",
      items: [
        "**APLS or EPALS** certificate, current",
        "**Child safeguarding** training, current, at the level required for your role",
        "**Supervisor report demonstrating the equivalent of a three-month paediatric ICM placement**",
        "**Logbook of caseload and mix appropriate to a three-month paediatric placement, including attendance at paediatric emergencies**",
        "**Relevant paediatric SLEs** appropriate to the placement, considering the key capabilities",
      ],
    },
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Appropriate paediatric CPD within seven years; letters/emails; reflective notes",
      ],
    },
    maintenance: {
      heading:
        "Maintenance route — if paediatric ICM training was more than 7 years ago (WTE)",
      qualifier: "if paediatric ICM training was more than 7 years ago (WTE)",
      items: [
        "Evidence you work in an area which manages critically unwell paediatric patients (rotas, referrals, caseload/logbook)",
        "Evidence you attend EM and ward paediatric referrals",
        "Paediatric CPD: APLS, updates, e-learning",
      ],
    },
    kcs: [
      {
        id: "13.1",
        shortTitle: "Adult and paediatric differences",
        text: "Know and can effectively manage the major anatomical, physiological and psychological differences between adult and paediatric patients",
        strands: [
          {
            kind: "wba",
            aim: "1–2 paediatric SLEs",
            items: [
              "CBD: a paediatric case where anatomical/physiological differences shaped management (drug dosing, fluids, equipment sizing)",
              "Mini-CEX: assessment of a sick child including weight estimation and age-appropriate observations",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: paediatric cases with age/weight-based management documented",
              "Evidence of using paediatric drug/equipment references (Broselow, APLS formulae, BNFc) in practice",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Paediatric physiology teaching or e-learning",
              "APLS/EPALS (cross-reference required evidence)",
            ],
          },
        ],
      },
      {
        id: "13.2",
        shortTitle: "Common paediatric emergencies",
        text: "Appreciate the pathophysiology of common paediatric emergencies, recognise their presentation and can provide initial management until expert help or specialist assistance is available",
        strands: [
          {
            kind: "wba",
            aim: "2 paediatric SLEs",
            items: [
              "CBD or ACAT: a common paediatric emergency (bronchiolitis, sepsis, seizures, DKA, croup) initially managed",
              "Mini-CEX: recognition of the sick child and initial stabilisation",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: paediatric emergencies attended",
              "Reflection on a paediatric emergency and the interface with specialist help",
              "Evidence of ED/paediatric ward attendance for emergencies (rota, referrals)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Paediatric emergencies update / e-learning",
              "Paediatric sepsis, DKA, status epilepticus guideline training",
            ],
          },
        ],
      },
      {
        id: "13.3",
        shortTitle: "Cardiovascular support of a child",
        text: "Are able to provide emergency and continuing cardiovascular support to a child until expert help or specialist assistance is available",
        strands: [
          {
            kind: "wba",
            aim: "1–2 paediatric SLEs",
            items: [
              "CBD: paediatric shock — fluid resuscitation and inotropic support pending retrieval",
              "Simulation record: paediatric cardiovascular emergency",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: paediatric cardiovascular support episodes",
              "Evidence of managing a child awaiting retrieval (anonymised documentation, retrieval handover)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Paediatric shock / inotropes teaching",
              "Paediatric simulation",
            ],
          },
        ],
      },
      {
        id: "13.4",
        shortTitle: "Resuscitation and retrieval",
        text: "Are capable of resuscitating a child, know when to seek specialist help and support via their local paediatric retrieval team whose processes they are familiar with",
        strands: [
          {
            kind: "wba",
            aim: "1–2 paediatric SLEs",
            items: [
              "CBD or reflection: a retrieval-team referral you made, demonstrating familiarity with local processes (e.g. STRS, CATS)",
              "Simulation: paediatric cardiac arrest / peri-arrest",
            ],
          },
          {
            kind: "clinical",
            items: [
              "APLS/EPALS certificate (cross-reference)",
              "Logbook or attendance record: paediatric arrest/peri-arrest calls",
              "Evidence of knowing the local retrieval pathway (guideline, contact list, referral records)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "APLS or EPALS, current",
              "Retrieval service teaching / referral training",
            ],
          },
        ],
      },
      {
        id: "13.5",
        shortTitle: "Paediatric airway and ventilation",
        text: "Are competent to provide elective and emergency airway management and mechanical ventilation to a child including induction of anaesthesia for intubation",
        strands: [
          {
            kind: "wba",
            aim: "2 paediatric SLEs",
            items: [
              "DOPS: paediatric airway management/intubation (clinical or high-fidelity simulation)",
              "CBD: induction of anaesthesia and initiation of ventilation in a child pending retrieval",
              "DOPS: paediatric bag-valve-mask ventilation and airway adjuncts",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: paediatric airway episodes and ventilation initiation",
              "Evidence of paediatric ventilator/equipment familiarity (unit checklist, simulation sign-off)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Paediatric airway workshop / simulation",
              "Paediatric anaesthesia exposure (theatre lists, if available)",
            ],
          },
        ],
      },
      {
        id: "13.6",
        shortTitle: "Safeguarding children",
        text: "Practise in accordance with national legislation and guidelines relating to safeguarding children in the context of critical care",
        strands: [
          {
            kind: "wba",
            aim: "1 paediatric SLE",
            items: [
              "CBD or reflection: a safeguarding concern in the context of a critically ill child, managed per local process",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Child safeguarding certificate, current, at the appropriate level (cross-reference)",
              "Evidence of familiarity with local safeguarding referral pathways (guideline, named nurse contact, referral records)",
              "Evidence of NAI recognition training or case discussion",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Child safeguarding training at the level required for your role",
              "Safeguarding supervision or case review attendance",
            ],
          },
        ],
        note: "Safeguarding training is mandatory for HiLLO 13 (see Required evidence on the HiLLO page); this KC additionally wants it *applied* in a critical care context.",
      },
    ],
  },
  {
    n: 14,
    icon: "❤️",
    title: "Cardiothoracic intensive care medicine",
    statement:
      "Intensive Care Medicine specialists recognise the special needs of, and are competent to provide the perioperative care to patients who have undergone cardiothoracic surgery, including providing pain relief and advanced organ system support utilising specialised techniques available to support the cardiovascular system.",
    atAGlance: [
      "**Standard expected:** Level 3",
      "**Key capabilities:** 8",
      "**Placement:** evidence of a **three-month attachment to a specialist unit** or of working in a unit which accepts cardiothoracic referrals",
      "**Courses:** ALS current; CALS strongly supportive; echocardiography/ultrasound training with maintained skill",
      "**Weak HiLLO 14 evidence cannot be compensated elsewhere**",
      "⚠️ **This HiLLO has *required* evidence** (below) if the placement was within seven years",
      "See: **Evidence rules that apply everywhere**",
    ],
    required: {
      heading: "Required evidence (placement within the last 7 years WTE)",
      qualifier: "placement within the last 7 years WTE",
      items: [
        "**Evidence of a three-month attachment to a specialist unit, or of working in a unit which accepts cardiothoracic referrals** (logbooks, caseload activity data)",
        "**Supervisor report demonstrating the equivalent placement**",
        "**Relevant cardiothoracic SLEs** appropriate to the placement, considering the key capabilities",
        "**ALS current**; CALS and echocardiography/ultrasound training strongly supportive",
      ],
    },
    hilloLevel: {
      heading: "HiLLO-level evidence",
      items: [
        "Echocardiography/ultrasound training with case-mix logbook demonstrating maintenance",
        "Cardiothoracic ICM CPD; letters/emails; reflective notes",
      ],
    },
    maintenance: {
      heading:
        "Maintenance route — if cardiothoracic ICM training was more than 7 years ago (WTE)",
      qualifier:
        "if cardiothoracic ICM training was more than 7 years ago (WTE)",
      items: [
        "Evidence you work in a relevant ICU: rotas, referrals, caseload/logbook",
        "CPD, reflections, relevant governance, QI or audit in cardiothoracic critical care",
      ],
      intro: "The SSG states maintenance **must** be demonstrated:",
    },
    kcs: [
      {
        id: "14.1",
        shortTitle: "Perioperative risk assessment",
        text: "Assessing the perioperative risks associated with these patients' co-morbidities, emergency anaesthesia and surgery and the implications of their concomitant drug therapies",
        strands: [
          {
            kind: "wba",
            aim: "1–2 cardiothoracic SLEs",
            items: [
              "CBD: pre-operative risk assessment of a cardiac surgical patient (EuroSCORE, antiplatelet/anticoagulant management)",
              "Mini-CEX: pre-operative review on the cardiothoracic unit",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Reflection: drug therapy implications around cardiac surgery (antiplatelets, anticoagulants, ACE inhibitors, diabetes agents)",
              "Logbook: pre-operative cardiothoracic assessments",
              "Evidence of cardiac surgical MDT attendance",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Cardiothoracic critical care update",
              "Perioperative cardiac risk / cardiology for intensivists",
            ],
          },
        ],
      },
      {
        id: "14.2",
        shortTitle: "Postoperative medical conditions",
        text: "The postoperative care of common acute and chronic medical conditions commonly found in these patients",
        strands: [
          {
            kind: "wba",
            aim: "1–2 cardiothoracic SLEs",
            items: [
              "CBD: post-cardiac-surgery patient with significant medical comorbidity (diabetes, CKD, COPD, AF)",
              "ACAT: ward round on the cardiothoracic ICU",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: postoperative medical problems managed",
              "Reflection on a postoperative medical complication",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Cardiothoracic ICM update",
              "Diabetes / renal / respiratory management in cardiac surgery teaching",
            ],
          },
        ],
      },
      {
        id: "14.3",
        shortTitle: "Type of surgery and complications",
        text: "Assessing the implications of the type and site of surgery for these patients' immediate postoperative management and the potential complications, which they can manage effectively whilst providing optimal analgesia",
        strands: [
          {
            kind: "wba",
            aim: "2 cardiothoracic SLEs",
            items: [
              "CBD: immediate post-op care after CABG/valve/thoracic surgery, including analgesia strategy (incl. regional techniques for thoracotomy)",
              "Mini-CEX: admission handover and first hour after cardiac surgery",
              "DOPS: pacing box management / temporary pacing wire assessment",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: breadth across cardiac and thoracic procedures (CABG, valve, aortic, thoracotomy, VATS)",
              "Evidence of fast-track/extubation protocol use",
              "Evidence of analgesia planning including regional techniques",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Cardiothoracic critical care course",
              "Acute pain after thoracic surgery teaching",
            ],
          },
        ],
      },
      {
        id: "14.4",
        shortTitle: "Levels of care",
        text: "Considering the factors which influence the intensity, levels of care and the clinical environments where the necessary care can be safely delivered to these patients",
        strands: [
          {
            kind: "wba",
            aim: "1–2 cardiothoracic SLEs",
            items: [
              "CBD or ACAT: admission, fast-track vs full ICU, or step-down decision for a cardiothoracic patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Log of level-of-care decisions with rationale",
              "Evidence of contributing to unit flow/capacity decisions (bed meeting, escalation)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Cardiothoracic pathways / enhanced recovery teaching",
              "Levels of care / GPICS training",
            ],
          },
        ],
      },
      {
        id: "14.5",
        shortTitle: "Respiratory dysfunction",
        text: "Treating respiratory dysfunction and complications in these patients",
        strands: [
          {
            kind: "wba",
            aim: "2 cardiothoracic SLEs",
            items: [
              "CBD: post-cardiothoracic respiratory failure (atelectasis, effusion, air leak, ventilation after thoracic surgery)",
              "DOPS: chest drain management in a cardiothoracic patient",
              "CBD: NIV/HFNO or ventilation strategy after lung resection",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: respiratory complications managed",
              "Evidence of chest drain / air-leak management (anonymised)",
              "Reflection on a respiratory complication",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Thoracic surgery critical care teaching",
              "Ventilation after cardiothoracic surgery update",
            ],
          },
        ],
      },
      {
        id: "14.6",
        shortTitle: "Cardiovascular and circulatory support",
        text: "Treat cardiovascular dysfunction and complications in these patients including understanding advanced monitoring techniques and provision of mechanical circulatory support",
        strands: [
          {
            kind: "wba",
            aim: "2–3 cardiothoracic SLEs",
            items: [
              "CBD: low cardiac output state — advanced monitoring, inotropes/vasopressors, pacing",
              "CBD or CPD: mechanical circulatory support (IABP, VA-ECMO, VAD) — understanding and, where available, direct care",
              "DOPS: echocardiography in a cardiothoracic patient (tamponade, LV/RV function, valve assessment)",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Echo logbook cases in cardiothoracic patients (cross-reference)",
              "Logbook: cardiovascular support episodes including pacing and mechanical support exposure",
              "Evidence of managing a patient on IABP/ECMO/VAD or observing (anonymised)",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Advanced haemodynamic monitoring / cardiac output teaching",
              "Mechanical circulatory support course or ECMO simulation",
              "Echocardiography training (FUSIC/FICE/BSE level 1)",
            ],
          },
        ],
        note: "Mechanical circulatory support exposure varies by unit — where direct care is unavailable, a CBD demonstrating understanding plus observation is acceptable; say so explicitly.",
      },
      {
        id: "14.7",
        shortTitle: "Other perioperative complications",
        text: "Assessing and managing other perioperative conditions and complications encountered by pre- and post-operative cardiothoracic surgery patients",
        strands: [
          {
            kind: "wba",
            aim: "1–2 cardiothoracic SLEs",
            items: [
              "CBD: bleeding/coagulopathy after bypass, AKI, delirium, sternal wound issues — any managed complication beyond the cardiorespiratory",
              "Mini-CEX: assessment of a bleeding post-cardiac-surgery patient",
            ],
          },
          {
            kind: "clinical",
            items: [
              "Logbook: complication cases",
              "Evidence of point-of-care coagulation testing (TEG/ROTEM) use in decision-making",
              "Reflection on a perioperative complication",
            ],
          },
          {
            kind: "cpd",
            items: [
              "Coagulation after bypass / transfusion in cardiac surgery teaching",
              "Cardiac surgery complications update",
            ],
          },
        ],
      },
      {
        id: "14.8",
        shortTitle: "Cardiothoracic emergencies and escalation",
        text: "Recognising and providing immediate treatment of perioperative emergencies and know when to seek senior help and support",
        strands: [
          {
            kind: "wba",
            aim: "1–2 cardiothoracic SLEs",
            items: [
              "CBD or simulation: cardiac arrest after cardiac surgery managed per CALS principles, including emergency resternotomy awareness",
              "Simulation: tamponade / major haemorrhage / arrhythmia emergency after cardiac surgery",
            ],
          },
          {
            kind: "clinical",
            items: [
              "CALS course certificate (cross-reference)",
              "Reflection on escalation to the surgical team in an emergency",
              "Logbook: cardiothoracic emergencies attended",
            ],
          },
          {
            kind: "cpd",
            items: ["CALS course", "Cardiothoracic emergencies simulation"],
          },
        ],
      },
    ],
  },
];
