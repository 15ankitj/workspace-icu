/** Gallery categories (brief §10). */
export const TEMPLATE_CATEGORIES = [
  "Training & Portfolio",
  "Supervision",
  "Quality Improvement",
  "Teaching",
  "Personal",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
