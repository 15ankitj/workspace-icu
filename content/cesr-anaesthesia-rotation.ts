/**
 * The Anaesthesia rotation (HiLLO 10) milestones of the CESR Journey
 * pack: the St George's HiLLO 10 tracker's pre-IAC and post-IAC plan,
 * one milestone per item, each mapped to the KC 10.x pages it serves.
 * Authored at St George's (Adult Critical Care, Portfolio Pathway lead);
 * guidance, not curriculum wording — the GMC requirements are the
 * Required evidence section of the HiLLO 10 page. No numeric targets.
 * Rendered by content/cesr-anaesthesia-pages.ts.
 */

export type MilestonePhase = "Before the IAC" | "After the IAC" | "Both";
export type MilestoneStrand =
  "Logbook" | "Practical skills" | "SLEs" | "Rota" | "CPD";
export type MilestoneEvidence =
  | "Logbook"
  | "Logbook + DOPS"
  | "Logbook + CBD or reflection"
  | "SLE form"
  | "Certificate"
  | "Attendance record"
  | "Rota evidence"
  | "Reading log + reflection";

export interface RotationMilestone {
  /** Stable id, used as the pack page key suffix; never renumber. */
  id: string;
  title: string;
  phase: MilestonePhase;
  strand: MilestoneStrand;
  evidence: MilestoneEvidence;
  /** One line on what good looks like, shown under the how-to. */
  note?: string;
  /** KC ids (10.1 … 10.10) this milestone evidences. */
  serves: string[];
}

export const MILESTONE_PHASES: MilestonePhase[] = [
  "Before the IAC",
  "After the IAC",
  "Both",
];
export const MILESTONE_STRANDS: MilestoneStrand[] = [
  "Logbook",
  "Practical skills",
  "SLEs",
  "Rota",
  "CPD",
];

export const ANAESTHESIA_MILESTONES: RotationMilestone[] = [
  // ---- Logbook ----
  {
    id: "log-elective-supervised",
    title: "Elective cases, ASA 1–2, supervised",
    phase: "Before the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    note: "Record date, procedure, ASA grade and supervision level for every case from day one.",
    serves: ["10.4", "10.5", "10.6"],
  },
  {
    id: "log-emergency-supervised",
    title: "Emergency cases, supervised",
    phase: "Before the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.9"],
  },
  {
    id: "log-total",
    title: "Logbook over 12 months, showing progression",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    note: "The GMC asks for at least 300 cases over 12 months; what assessors read is the progression to indirect supervision and the breadth of specialty, ASA grade and technique.",
    serves: ["10.4"],
  },
  {
    id: "log-elective-asa-1-3",
    title: "Elective cases, ASA 1–3",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.4", "10.5"],
  },
  {
    id: "log-emergency-asa-1e-3e",
    title: "Emergency cases, ASA 1E–3E",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.9"],
  },
  {
    id: "log-out-of-hours",
    title: "Out-of-hours emergency cases",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.9"],
  },
  {
    id: "log-obstetric",
    title: "Obstetric emergency anaesthesia",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.9"],
  },
  {
    id: "log-trauma",
    title: "Trauma anaesthesia",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook",
    serves: ["10.9"],
  },
  {
    id: "log-emergency-airway",
    title: "Emergency airway management, documented",
    phase: "After the IAC",
    strand: "Logbook",
    evidence: "Logbook + CBD or reflection",
    serves: ["10.10"],
  },

  // ---- Practical skills ----
  {
    id: "skill-bag-mask",
    title: "Bag-mask ventilation",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.5", "10.10"],
  },
  {
    id: "skill-supraglottic",
    title: "Supraglottic airway insertion",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.5"],
  },
  {
    id: "skill-laryngoscopy",
    title: "Direct laryngoscopy and tracheal intubation",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.5"],
  },
  {
    id: "skill-videolaryngoscopy",
    title: "Videolaryngoscopy",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.5", "10.10"],
  },
  {
    id: "skill-iv-cannulation",
    title: "Peripheral intravenous cannulation",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook",
    serves: ["10.5"],
  },
  {
    id: "skill-arterial-line",
    title: "Arterial line insertion",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.6"],
  },
  {
    id: "skill-central-venous",
    title: "Central venous cannulation",
    phase: "Before the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.6"],
  },
  {
    id: "skill-fibreoptic",
    title: "Fibreoptic intubation",
    phase: "After the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.10"],
  },
  {
    id: "skill-difficult-airway",
    title: "Difficult airway management, simulated or real",
    phase: "After the IAC",
    strand: "Practical skills",
    evidence: "Logbook + CBD or reflection",
    serves: ["10.10"],
  },
  {
    id: "skill-regional",
    title: "Regional anaesthesia blocks",
    phase: "After the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.8"],
  },
  {
    id: "skill-neuraxial",
    title: "Neuraxial blockade, spinal and epidural",
    phase: "After the IAC",
    strand: "Practical skills",
    evidence: "Logbook + DOPS",
    serves: ["10.8"],
  },
  {
    id: "skill-postop-analgesia",
    title: "Post-operative analgesia planning and delivery",
    phase: "After the IAC",
    strand: "Practical skills",
    evidence: "Logbook + CBD or reflection",
    serves: ["10.8"],
  },

  // ---- SLEs ----
  {
    id: "sle-minicex-preop",
    title: "Mini-CEX — pre-operative assessment",
    phase: "Both",
    strand: "SLEs",
    evidence: "SLE form",
    note: "ASA 1–2 patients before the IAC; ASA 3 and complex patients after it.",
    serves: ["10.1", "10.4"],
  },
  {
    id: "sle-minicex-recovery",
    title: "Mini-CEX — post-operative care and recovery",
    phase: "Both",
    strand: "SLEs",
    evidence: "SLE form",
    note: "Basic recovery management before the IAC; complex recovery after it.",
    serves: ["10.8"],
  },
  {
    id: "sle-minicex-induction",
    title: "Mini-CEX — induction of anaesthesia",
    phase: "Both",
    strand: "SLEs",
    evidence: "SLE form",
    note: "Basic induction before the IAC; modified rapid sequence induction after it.",
    serves: ["10.5"],
  },
  {
    id: "sle-minicex-maintenance",
    title: "Mini-CEX — supervised maintenance of anaesthesia",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.6"],
  },
  {
    id: "sle-minicex-emergency",
    title: "Mini-CEX — emergency situations",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.7", "10.9"],
  },
  {
    id: "sle-cbd-planning",
    title: "CBD — anaesthetic planning",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.1", "10.4"],
  },
  {
    id: "sle-cbd-pharmacology",
    title: "CBD — pharmacological principles",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.2"],
  },
  {
    id: "sle-cbd-monitoring",
    title: "CBD — monitoring equipment",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.3"],
  },
  {
    id: "sle-cbd-complex-case",
    title: "CBD — complex case management",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.2", "10.4"],
  },
  {
    id: "sle-cbd-critical-incident",
    title: "CBD — critical incident analysis",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.7"],
  },
  {
    id: "sle-cbd-hypotension",
    title: "CBD — hypotension during anaesthesia",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.7"],
  },
  {
    id: "sle-cbd-preop-optimisation",
    title: "CBD — pre-operative optimisation of the high-risk patient",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.4"],
  },
  {
    id: "sle-cbd-postop-pain",
    title: "CBD — post-operative pain management",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.8"],
  },
  {
    id: "sle-cbd-difficult-airway",
    title: "CBD — the difficult airway algorithm",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.10"],
  },
  {
    id: "sle-dops-airway",
    title: "DOPS — airway management",
    phase: "Both",
    strand: "SLEs",
    evidence: "SLE form",
    note: "Basic techniques before the IAC; advanced techniques after it.",
    serves: ["10.5", "10.10"],
  },
  {
    id: "sle-dops-vascular-access",
    title: "DOPS — vascular access",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.6"],
  },
  {
    id: "sle-dops-facemask",
    title: "DOPS — facemask ventilation",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.5"],
  },
  {
    id: "sle-dops-supraglottic",
    title: "DOPS — supraglottic airway",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.5"],
  },
  {
    id: "sle-dops-intubation",
    title: "DOPS — tracheal intubation",
    phase: "Before the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.5"],
  },
  {
    id: "sle-dops-rsi",
    title: "DOPS — rapid sequence induction",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.5", "10.9"],
  },
  {
    id: "sle-dops-regional",
    title: "DOPS — regional anaesthesia",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.8"],
  },
  {
    id: "sle-dops-spinal",
    title: "DOPS — spinal anaesthesia",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.8"],
  },
  {
    id: "sle-dops-epidural",
    title: "DOPS — epidural anaesthesia",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.8"],
  },
  {
    id: "sle-acat-independent",
    title: "ACAT — independent practice",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.6"],
  },
  {
    id: "sle-acat-out-of-hours",
    title: "ACAT — out-of-hours anaesthetic duty period",
    phase: "After the IAC",
    strand: "SLEs",
    evidence: "SLE form",
    serves: ["10.6", "10.9"],
  },

  // ---- Rota ----
  {
    id: "rota-participation",
    title: "Regular anaesthetic rota participation",
    phase: "After the IAC",
    strand: "Rota",
    evidence: "Rota evidence",
    note: "Sample rotas plus a supervisor's confirmation; this is the GMC's rota requirement.",
    serves: ["10.6"],
  },
  {
    id: "rota-daytime-sessions",
    title: "Daytime theatre sessions across specialties",
    phase: "After the IAC",
    strand: "Rota",
    evidence: "Rota evidence",
    serves: ["10.6"],
  },
  {
    id: "rota-out-of-hours",
    title: "Out-of-hours duties, nights and weekends",
    phase: "After the IAC",
    strand: "Rota",
    evidence: "Rota evidence",
    serves: ["10.9"],
  },
  {
    id: "rota-on-call",
    title: "On-call duties with appropriate supervision",
    phase: "After the IAC",
    strand: "Rota",
    evidence: "Rota evidence",
    serves: ["10.9"],
  },

  // ---- CPD ----
  {
    id: "cpd-basic-course",
    title: "Basic anaesthesia course",
    phase: "Before the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.2"],
  },
  {
    id: "cpd-airway-course",
    title: "Airway management course",
    phase: "Before the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.3", "10.10"],
  },
  {
    id: "cpd-als",
    title: "ALS, current",
    phase: "Before the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.7"],
  },
  {
    id: "cpd-local-teaching",
    title: "Local anaesthetic department teaching",
    phase: "Both",
    strand: "CPD",
    evidence: "Attendance record",
    note: "Core teaching before the IAC; advanced topics after it.",
    serves: ["10.2"],
  },
  {
    id: "cpd-elearning",
    title: "e-Learning Anaesthesia modules",
    phase: "Before the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.2"],
  },
  {
    id: "cpd-self-directed",
    title: "Self-directed learning record",
    phase: "Both",
    strand: "CPD",
    evidence: "Reading log + reflection",
    serves: ["10.2"],
  },
  {
    id: "cpd-advanced-airway",
    title: "Advanced airway course (awake fibreoptic, DAS)",
    phase: "After the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.10"],
  },
  {
    id: "cpd-obstetric",
    title: "Obstetric anaesthesia teaching or course",
    phase: "After the IAC",
    strand: "CPD",
    evidence: "Attendance record",
    serves: ["10.9"],
  },
  {
    id: "cpd-transfer-course",
    title: "Critical care transfer course",
    phase: "After the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.7"],
  },
  {
    id: "cpd-atls",
    title: "ATLS, current",
    phase: "After the IAC",
    strand: "CPD",
    evidence: "Certificate",
    serves: ["10.9"],
  },
];
