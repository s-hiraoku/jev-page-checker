import { choice, noul, score, type EntryType, type Questions, type Usage } from "@typesafe-ai/sdk";
import type { JevGateway } from "../../runner/jev.js";
import type { ContentClassSummary, JevAnswer } from "../../runner/types.js";

export const CONTENT_CLASS_IDS = [
  "official_primary",
  "news_wire",
  "encyclopedia_reference",
  "expert_blog",
  "ugc_sns",
  "ecommerce_reviews",
  "tools_saas_docs",
  "marketing_leadgen",
  "secondary_aggregator",
  "unknown_other",
] as const;

export type ContentClassId = (typeof CONTENT_CLASS_IDS)[number];

export const CONTENT_CLASS_QUESTION_ID = "content_class";

type DirectedPolarity = "higher_trust" | "lower_trust";
type BatteryPolarity = DirectedPolarity | "neutral" | "categorical" | "unspecified";

interface BatteryBase {
  id: string;
  instructions: string;
  polarity: BatteryPolarity;
}

export interface BatteryNoul extends BatteryBase {
  type: "noul";
  criteria: { true: string; false: string };
}

export interface BatteryChoice extends BatteryBase {
  type: "choice";
  criteria: Readonly<Record<string, string>>;
}

export interface BatteryScore extends BatteryBase {
  type: "score";
  criteria: readonly [string, string, string, string];
}

export type BatteryQuestion = BatteryNoul | BatteryChoice | BatteryScore;

const yesNo = (
  id: string,
  instructions: string,
  yes: string,
  no: string,
  polarity: Exclude<BatteryPolarity, "categorical">,
): BatteryNoul => ({ type: "noul", id, instructions, criteria: { true: yes, false: no }, polarity });

const rubric = (
  id: string,
  instructions: string,
  criteria: readonly [string, string, string, string],
  polarity: Exclude<BatteryPolarity, "categorical">,
): BatteryScore => ({ type: "score", id, instructions, criteria, polarity });

const pick = (id: string, instructions: string, criteria: Readonly<Record<string, string>>): BatteryChoice => ({
  type: "choice",
  id,
  instructions,
  criteria,
  polarity: "categorical",
});

export const CONTENT_CLASS_CRITERIA = {
  official_primary: "Self-published by a government, company, or school as the named organization",
  news_wire: "News reporting or wire-service journalism",
  encyclopedia_reference: "Encyclopedia, handbook, or reference-style factual entry",
  expert_blog: "Expert or practitioner blog/explainer by a named person or practice",
  ugc_sns: "User-generated content: forum, comments, or social post",
  ecommerce_reviews: "Product listing, customer reviews, or shopping comparison",
  tools_saas_docs: "Product docs, API/reference, changelog, or tool help",
  marketing_leadgen: "Marketing, ads, or lead-generation landing content",
  secondary_aggregator: "Secondary summary, aggregator, mirror, or translated reprint of other sources",
  unknown_other: "Does not clearly fit the other classes, or class is unclear",
} as const satisfies Record<ContentClassId, string>;

export const CONTENT_CLASS_BATTERIES: Record<ContentClassId, readonly BatteryQuestion[]> = {
  official_primary: [
    yesNo("official_publisher_named", "Does the page clearly name a government body, company, or school as the publisher?", "A specific org is named as publisher/authoring body", "Publisher org is absent or only generic", "unspecified"),
    yesNo("self_published_voice", "Does the page present itself as that organization speaking officially, not as third-party coverage about it?", "First-party official voice", "Third-party coverage or unclear voice", "unspecified"),
    yesNo("org_contact_or_legal_cues", "Are contact, legal, privacy, or About details for the named organization present on the page?", "Concrete contact/legal/About cues for the org", "No such cues visible", "unspecified"),
    rubric("claim_specificity", "How specific and checkable are the factual claims on the page?", [
      "Vague slogans only; almost nothing checkable",
      "Some concrete claims but thin on dates, names, or numbers",
      "Multiple concrete claims with dates, names, or numbers",
      "Highly specific claims with documents, IDs, or clear references",
    ], "higher_trust"),
    rubric("dating_clarity", "How clearly is the content dated (published or updated)?", [
      "No date visible",
      "A date appears but role (published vs updated) is unclear",
      "Clear published or updated date",
      "Clear dating plus version or effective period",
    ], "unspecified"),
    rubric("promotional_vs_informational", "How promotional is the tone relative to informational official notice?", [
      "Mostly informational notice or policy text",
      "Mostly informational with light promo",
      "Balanced promo and information",
      "Primarily promotional or sales-driven",
    ], "lower_trust"),
  ],
  news_wire: [
    yesNo("outlet_identified", "Is a news outlet or wire service clearly identified as the publisher?", "Named outlet/wire", "Outlet unclear", "unspecified"),
    yesNo("byline_present", "Is a reporter or byline present?", "Named byline/reporter", "No byline", "unspecified"),
    pick("article_genre", "What is the primary genre of this page?", {
      hard_news: "Straight news report of events",
      analysis: "News analysis framed as interpretation",
      opinion: "Opinion, editorial, or column",
      unclear: "Genre unclear",
    }),
    rubric("sourcing_strength", "How well does the article show sources for its key claims?", [
      "No sources indicated",
      "Vague sourcing (\"officials say\") only",
      "Named sources or linked documents for some key claims",
      "Named sources or documents for most key claims",
    ], "higher_trust"),
    rubric("headline_sensationalism", "How sensational is the headline relative to the body?", [
      "Headline matches body calmly",
      "Mildly punchy but still aligned",
      "Overstates or dramatizes the body",
      "Clickbait or mismatch with the body",
    ], "lower_trust"),
    yesNo("correction_or_update_mark", "Does the page mark a correction, update, or editor’s note?", "Correction/update/editor note visible", "No such mark", "neutral"),
  ],
  encyclopedia_reference: [
    rubric("neutral_expository_tone", "How neutral and expository is the tone?", [
      "Strong advocacy or sales tone",
      "Noticeable slant with some expository parts",
      "Mostly neutral explainer tone",
      "Consistently neutral reference tone",
    ], "unspecified"),
    rubric("citation_density", "How well are factual statements backed by citations or references on the page?", [
      "No citations/references",
      "Sparse citations for a few claims",
      "Citations for many key claims",
      "Dense references typical of a reference entry",
    ], "higher_trust"),
    yesNo("version_or_history_visible", "Is an edit history, revision date, or version marker visible?", "History/version/revision cue present", "Not present", "unspecified"),
    yesNo("uncertainty_flagged", "Does the page flag disputed, uncertain, or incomplete information where relevant?", "Uncertainty/dispute is explicitly flagged", "No such flag (or nothing contested visible)", "unspecified"),
    pick("entry_scope", "What best describes this reference page’s scope?", {
      overview_entry: "Broad definition/overview",
      detailed_reference: "Detailed reference with sections",
      stub_thin: "Thin stub-like entry",
      unclear: "Unclear",
    }),
  ],
  expert_blog: [
    yesNo("author_named", "Is a specific human author named?", "Named person author", "Anonymous or brand-only", "unspecified"),
    rubric("credentials_visibility", "How clearly are the author’s relevant credentials or experience shown?", [
      "No credentials shown",
      "Vague bio without domain detail",
      "Some relevant role/experience stated",
      "Clear domain credentials tied to the topic",
    ], "unspecified"),
    yesNo("topic_expertise_alignment", "Does the author’s stated background match the topic being explained?", "Background aligns with topic", "Mismatch or background unknown", "unspecified"),
    rubric("evidence_use", "How strongly does the post ground claims in evidence (data, citations, primary docs)?", [
      "Opinion only, no evidence",
      "Anecdotes or vague evidence",
      "Some concrete citations or data",
      "Claims regularly tied to concrete evidence",
    ], "higher_trust"),
    yesNo("conflict_disclosure", "Does the page disclose sponsorship, affiliation, or material conflict related to the topic?", "Disclosure present", "No disclosure visible", "unspecified"),
    rubric("certainty_calibration", "How carefully does the writing mark speculation versus established fact?", [
      "Presents speculation as settled fact",
      "Mostly assertive with rare hedges",
      "Usually separates fact and conjecture",
      "Consistently marks uncertainty and limits",
    ], "higher_trust"),
  ],
  ugc_sns: [
    yesNo("poster_identifiable", "Is the posting account or username identifiable on the page?", "Account/username visible", "Not identifiable", "unspecified"),
    pick("claim_type", "What kind of claim does the main post make?", {
      personal_anecdote: "Personal experience only",
      general_factual_claim: "General factual claim about the world",
      opinion_preference: "Preference/opinion without factual assertion",
      unclear: "Unclear",
    }),
    rubric("corroboration_offered", "How much corroboration (links, photos, documents) does the post offer for its claims?", [
      "No corroboration",
      "Weak or unrelated links/media",
      "Some on-point supporting media or links",
      "Strong, specific corroboration for the main claim",
    ], "higher_trust"),
    rubric("ragebait_or_hostility", "How much does the post rely on hostility, ridicule, or ragebait framing?", [
      "Calm, non-hostile",
      "Mild frustration without attacks",
      "Clear hostility or mockery",
      "Heavy ragebait or harassment tone",
    ], "lower_trust"),
    yesNo("single_thread_context", "Is this mainly a standalone post rather than a long moderated knowledge article?", "Standalone UGC post/thread item", "Looks like curated article", "unspecified"),
    yesNo("asks_to_trust_unverified", "Does the post ask readers to accept a serious claim without any checkable detail?", "Serious claim with no checkable detail", "Claim is mild or has checkable detail", "lower_trust"),
  ],
  ecommerce_reviews: [
    yesNo("commercial_intent_clear", "Is the page primarily trying to sell or compare products for purchase?", "Clear commercial/purchase intent", "Not primarily commercial", "unspecified"),
    rubric("reviewer_or_seller_identity", "How identifiable is the seller or reviewer identity?", [
      "Anonymous / missing",
      "Handle only",
      "Named seller/reviewer with thin profile",
      "Named party with substantial profile or history cues",
    ], "unspecified"),
    yesNo("incentive_signals", "Does the page indicate incentivized reviews, affiliate links, or paid placement?", "Incentive/affiliate/paid cues present", "No such cues", "unspecified"),
    rubric("product_claim_concreteness", "How concrete are product performance claims?", [
      "Only superlatives",
      "Mostly vague benefits",
      "Some measurable claims",
      "Specific measurable claims with conditions",
    ], "unspecified"),
    yesNo("comparison_method_stated", "If comparing products, does the page state how the comparison was made?", "Method/criteria stated", "No method, or not a comparison", "higher_trust"),
    rubric("review_extremity", "How extreme is the review sentiment presentation?", [
      "Balanced pros and cons",
      "Mostly positive/negative but some nuance",
      "Nearly one-sided",
      "Absolute glowing or total condemnation",
    ], "lower_trust"),
  ],
  tools_saas_docs: [
    pick("doc_surface_type", "What documentation surface is this primarily?", {
      user_guide: "End-user how-to guide",
      api_reference: "API/SDK reference",
      changelog: "Changelog/release notes",
      product_blog: "Product blog mixed with docs tone",
      other: "Other/unclear",
    }),
    yesNo("version_or_date_present", "Is a product version, API version, or last-updated date present?", "Version or update date present", "Absent", "unspecified"),
    rubric("procedural_concreteness", "How concrete are the steps, commands, or API examples?", [
      "No actionable steps",
      "High-level advice only",
      "Some copyable commands/examples",
      "Detailed, copyable procedures or schemas",
    ], "unspecified"),
    rubric("marketing_bleed", "How much marketing language bleeds into the documentation?", [
      "Purely instructional",
      "Mostly instructional with light promo",
      "Noticeable promo mixed in",
      "Primarily marketing framed as docs",
    ], "lower_trust"),
    yesNo("scope_limits_stated", "Does the page state limitations, unsupported cases, or prerequisites?", "Limits/prereqs stated", "Not stated", "unspecified"),
    yesNo("vendor_self_serving_claim", "Does the page make comparative superiority claims against competitors without evidence?", "Unevidenced superiority claims", "No such claims", "lower_trust"),
  ],
  marketing_leadgen: [
    yesNo("conversion_cta_primary", "Is the primary goal a conversion action (signup, demo, purchase, lead form)?", "Primary CTA is conversion", "Not primarily conversion", "unspecified"),
    rubric("unevidenced_absolute_claims", "How strongly does the page use absolute performance claims without evidence?", [
      "No absolute unevidenced claims",
      "Mild claims with some caveats",
      "Several absolute claims lightly supported",
      "Heavy absolute claims without evidence",
    ], "lower_trust"),
    rubric("social_proof_quality", "How specific and checkable is the social proof (logos, quotes, metrics)?", [
      "No social proof",
      "Generic praise only",
      "Named customers or metrics without detail",
      "Specific named proof with context",
    ], "unspecified"),
    yesNo("paid_or_sponsor_disclosure", "If the page is promotional or sponsored, is that nature disclosed?", "Promo/sponsor nature disclosed", "Not disclosed or not applicable visibly", "unspecified"),
    rubric("scarcity_pressure", "How much urgency/scarcity pressure does the page apply?", [
      "No urgency pressure",
      "Mild time suggestion",
      "Strong limited-time pressure",
      "Aggressive countdown/fear-of-missing-out pressure",
    ], "lower_trust"),
    rubric("offer_terms_clarity", "How clearly are price, terms, or eligibility stated?", [
      "Key terms missing",
      "Partial terms",
      "Main terms present but some gaps",
      "Price/terms/eligibility clearly stated",
    ], "unspecified"),
  ],
  secondary_aggregator: [
    yesNo("original_source_linked", "Does the page link or clearly point to the original source(s)?", "Original source linked/pointed", "No original source pointer", "higher_trust"),
    pick("transformation_level", "How does this page relate to its sources?", {
      near_copy: "Near-copy/reprint with little added value",
      summary: "Summary/digest of sources",
      translation_reprint: "Translation or localized reprint",
      curated_roundup: "Curated multi-source roundup",
      unclear: "Unclear",
    }),
    rubric("attribution_clarity", "How clearly are quotes and claims attributed to original sources?", [
      "No attribution",
      "Vague attribution",
      "Most key items attributed",
      "Consistent clear attribution throughout",
    ], "higher_trust"),
    yesNo("translation_or_reprint_marked", "If translated or reprinted, is that status marked?", "Marked as translation/reprint", "Not marked (or not a translation/reprint)", "unspecified"),
    rubric("added_spin", "How much additional spin or framing does the aggregator add beyond the sources?", [
      "Minimal framing; close to sources",
      "Light editorial framing",
      "Noticeable spin",
      "Heavy spin that changes implied meaning",
    ], "lower_trust"),
    yesNo("paywall_or_snippet_only", "Is the page mainly a snippet/teaser that withholds the underlying source substance?", "Mostly teaser/snippet withholding substance", "Substance largely present", "unspecified"),
  ],
  unknown_other: [
    yesNo("publisher_identifiable", "Can a publisher or authoring party be identified at all?", "Some publisher/author party identifiable", "Not identifiable", "unspecified"),
    pick("apparent_purpose", "What appears to be the page’s primary purpose?", {
      inform: "Inform/explain",
      persuade_sell: "Persuade or sell",
      entertain: "Entertain",
      unclear: "Purpose unclear",
    }),
    rubric("evidence_presence", "How much supporting evidence is present for main claims?", [
      "No evidence",
      "Weak/unclear evidence",
      "Some concrete evidence",
      "Strong concrete evidence",
    ], "higher_trust"),
    rubric("identity_obfuscation", "How obfuscated are identity and provenance cues (who published, when, where)?", [
      "Identity and provenance mostly clear",
      "Some gaps",
      "Major gaps",
      "Actively opaque or misleading about provenance",
    ], "lower_trust"),
    rubric("machine_generated_signals", "How strongly does the page show generic machine-generated writing signals (repetitive boilerplate, empty fluency, no concrete specifics)?", [
      "Specific, human-grounded detail",
      "Mostly specific with some generic passages",
      "Largely generic fluent boilerplate",
      "Strong empty-fluency / template-like generation signals",
    ], "unspecified"),
    yesNo("safer_to_treat_as_untrusted", "Given only what is on the page, is it safer to treat the content as untrusted until class and provenance are clarified?", "Safer to treat as untrusted for now", "Enough cues to proceed without that default", "unspecified"),
  ],
};

const ZERO_USAGE: Usage = { input_tokens: 0, output_tokens: 0 };

function isContentClassId(value: string): value is ContentClassId {
  return (CONTENT_CLASS_IDS as readonly string[]).includes(value);
}

export function contentClassQuestions(): Questions {
  return {
    [CONTENT_CLASS_QUESTION_ID]: choice("Which content class best describes this page?", CONTENT_CLASS_CRITERIA),
  };
}

export function batteryQuestions(classId: ContentClassId): Questions {
  const questions: Questions = {};
  for (const question of CONTENT_CLASS_BATTERIES[classId]) {
    if (question.type === "noul") questions[question.id] = noul(question.instructions, question.criteria);
    else if (question.type === "choice") questions[question.id] = choice(question.instructions, question.criteria);
    else questions[question.id] = score(question.instructions, question.criteria);
  }
  return questions;
}

export function contentClassState(input: {
  title: string;
  siteName: string;
  author: string;
  description: string;
  publishedAt: string;
  language: string;
  text: string;
}): {
  title: string;
  siteName: string;
  author: string;
  description: string;
  publishedAt: string;
  language: string;
  text: string;
} {
  return {
    title: input.title,
    siteName: input.siteName,
    author: input.author,
    description: input.description,
    publishedAt: input.publishedAt,
    language: input.language,
    text: input.text,
  };
}

function unitFromAnswer(question: BatteryQuestion, answer: JevAnswer | undefined): number | undefined {
  if (question.type === "noul") {
    if (answer?.type !== "noul" || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) return undefined;
    return answer.noul;
  }
  if (question.type === "score") {
    if (answer?.type !== "score" || !Number.isFinite(answer.score)) return undefined;
    const span = question.criteria.length - 1;
    const unit = answer.score / span;
    if (unit < 0 || unit > 1) return undefined;
    return unit;
  }
  return undefined;
}

const DRAFT_TRUST = {
  status: "draft" as const,
  weights: "draft-equal" as const,
  threshold: "欠測" as const,
  applied: false as const,
  withheld: "threshold-欠測" as const,
};

export function draftTrustScore(
  questions: readonly BatteryQuestion[],
  answers: Readonly<Record<string, JevAnswer | undefined>>,
): ContentClassSummary["trust"] {
  const oriented: number[] = [];
  for (const question of questions) {
    if (question.polarity !== "higher_trust" && question.polarity !== "lower_trust") continue;
    const unit = unitFromAnswer(question, answers[question.id]);
    if (unit === undefined) return { ...DRAFT_TRUST };
    oriented.push(question.polarity === "higher_trust" ? unit : 1 - unit);
  }
  if (oriented.length === 0) return { ...DRAFT_TRUST };
  const value = oriented.reduce((sum, item) => sum + item, 0) / oriented.length;
  return { ...DRAFT_TRUST, value };
}

function readClass(answer: JevAnswer | undefined): ContentClassId | undefined {
  if (answer?.type !== "choice" || !isContentClassId(answer.choice)) return undefined;
  return answer.choice;
}

function addUsage(left: Usage, right: Usage): Usage {
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
  };
}

export interface ContentClassRun {
  summary: ContentClassSummary;
  usage: Usage;
  timing: { wallMs: number; jevMs: number };
}

export async function askContentClassBattery(
  state: EntryType,
  jev: JevGateway,
  suppliedClass?: ContentClassId,
): Promise<ContentClassRun> {
  const started = performance.now();
  let usage = ZERO_USAGE;
  let jevMs = 0;
  let classId: ContentClassId = "unknown_other";
  let classSource: ContentClassSummary["classSource"] = "fallback_unknown_other";
  let fallbackReason: string | undefined;
  let contentClassAnswer: JevAnswer | undefined;

  if (suppliedClass !== undefined) {
    classId = suppliedClass;
    classSource = "supplied";
  } else {
    try {
      const jevStarted = performance.now();
      const reply = await jev.ask({ state, questions: contentClassQuestions() });
      jevMs += Math.round(performance.now() - jevStarted);
      usage = addUsage(usage, reply.usage);
      contentClassAnswer = reply.answers[CONTENT_CLASS_QUESTION_ID];
      const parsed = readClass(contentClassAnswer);
      if (parsed === undefined) {
        classId = "unknown_other";
        classSource = "fallback_unknown_other";
        fallbackReason = contentClassAnswer === undefined ? "content_class answer missing" : "content_class choice is outside the ten ids";
      } else {
        classId = parsed;
        classSource = "content_class";
      }
    } catch {
      classId = "unknown_other";
      classSource = "fallback_unknown_other";
      fallbackReason = "content_class request failed";
    }
  }

  const questions = CONTENT_CLASS_BATTERIES[classId];
  let answers: Record<string, JevAnswer> = {};
  let batteryRequest: ContentClassSummary["batteryRequest"] = "ok";
  try {
    const jevStarted = performance.now();
    const reply = await jev.ask({ state, questions: batteryQuestions(classId) });
    jevMs += Math.round(performance.now() - jevStarted);
    usage = addUsage(usage, reply.usage);
    answers = reply.answers;
  } catch {
    batteryRequest = "failed";
  }

  return {
    summary: {
      status: "draft",
      jevLiveVerification: "欠測",
      classId,
      classSource,
      ...(fallbackReason === undefined ? {} : { fallbackReason }),
      batteryRequest,
      questionIds: questions.map((question) => question.id),
      ...(contentClassAnswer === undefined ? {} : { contentClassAnswer }),
      answers,
      trust: draftTrustScore(questions, answers),
    },
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}
