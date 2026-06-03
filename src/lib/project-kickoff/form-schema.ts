import type { SectionDef } from "./types";

const text = (key: string, label: string, required = false) =>
  ({ key, label, type: "text" as const, required });
const area = (key: string, label: string, required = false) =>
  ({ key, label, type: "textarea" as const, required });

export const KICKOFF_FORM: SectionDef[] = [
  {
    id: 1, title: "Campaign Overview", always: true,
    fields: [
      text("client_brand", "Client / brand name", true),
      text("campaign_name", "Campaign / project name", true),
      text("industry", "Industry / category", true),
      area("campaign_summary", "In one sentence, what did this campaign do?", true),
      area("business_problem", "What was the business problem or opportunity?", true),
    ],
  },
  {
    id: 2, title: "The Work", always: true,
    fields: [
      area("creative_idea", "What was the creative idea / big concept?", true),
      area("channels", "What channels / formats did the campaign run across?"),
      area("differentiator", "What made this work different or unexpected?"),
      area("craft_details", "Are there any craft / production details worth highlighting?"),
    ],
  },
  {
    id: 3, title: "Results & Proof", always: true,
    fields: [
      area("result_business", "Business result", true),
      area("result_audience", "Audience / engagement result", true),
      area("result_brand", "Brand / perception result"),
      area("result_other", "Any other noteworthy numbers, earned media, or cultural signals?"),
      area("result_restrictions", "What are the result-sharing restrictions, if any?"),
    ],
  },
  {
    id: 4, title: "Case Study Specifics", always: false, deliverable: "case_study",
    fields: [
      area("case_narrative", "What's the narrative arc?"),
      area("case_audience", "Who is the case study written for?"),
      area("case_quotes", "What quotes or client testimonials are available?"),
      area("case_assets", "What visual assets are available for the case study?"),
    ],
  },
  {
    id: 5, title: "Social Post Specifics", always: false, deliverable: "social",
    fields: [
      area("social_platforms", "Which platforms are we posting on?", true),
      area("social_accounts", "Whose account(s)?", true),
      area("social_tone", "What's the tone / voice for social?"),
      area("social_goal", "What do we want people to feel or do after seeing the post?"),
      area("social_credits", "Are there any credits, tags, or handles to include?"),
      area("social_timing", "Any post timing, campaign tie-ins, or industry events to align with?"),
    ],
  },
  {
    id: 6, title: "Award Submission Specifics", always: false, deliverable: "award",
    fields: [
      area("award_shows", "Which award show(s) are we entering?", true),
      area("award_categories", "Which category / categories?"),
      area("award_ambition", "What level of ambition are we setting?"),
      area("award_worthy", "What is the single most award-worthy thing about this work?"),
      area("award_benchmarks", "Are there competitive or industry benchmarks to reference?"),
      area("award_limit", "What is the entry word / character limit?"),
    ],
  },
  {
    id: 7, title: "Approvals & Assets", always: true,
    fields: [
      text("approver_internal", "Who is the internal approver?", true),
      text("approver_client", "Does the client need to approve?", true),
      area("assets_location", "Where are the final assets housed?"),
      area("clearances", "Are there any legal, IP, talent, or music clearances to be aware of?"),
      area("exclusions", "Is there anything that must NOT be included in any of the deliverables?"),
    ],
  },
];

export const SECTION_BY_ID: Record<number, SectionDef> =
  Object.fromEntries(KICKOFF_FORM.map((s) => [s.id, s]));
