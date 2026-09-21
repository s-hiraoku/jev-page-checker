import type { Verdict } from "./checkkit.js";
import type { ResolvedLocale } from "./locale.js";

export const APP_NAME = "Audit";
export const APP_NAME_FULL = "Jev Audit";
export const APP_MARK = "Jev";

const QUESTION_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    identifiable_publisher: "発行元が特定できる",
    honest_identity: "なりすましではない",
    site_purpose: "ページの主な目的",
    disclosed_incentives: "利害の開示",
    evidence_for_claims: "主張の根拠",
    separates_fact_and_opinion: "事実と意見の切り分け",
    unsourced_specifics: "出典のない具体値",
    self_consistent: "本文の内部矛盾",
    certainty_matches_evidence: "断定と根拠の釣り合い",
  },
  en: {
    identifiable_publisher: "Publisher is identifiable",
    honest_identity: "Not impersonating",
    site_purpose: "Main purpose of the page",
    disclosed_incentives: "Incentives are disclosed",
    evidence_for_claims: "Evidence for claims",
    separates_fact_and_opinion: "Fact vs opinion",
    unsourced_specifics: "Unsourced specifics",
    self_consistent: "Internal consistency",
    certainty_matches_evidence: "Certainty matches evidence",
  },
};

const QUESTION_AXIS_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    identifiable_publisher: "発行元",
    honest_identity: "実体",
    site_purpose: "目的",
    disclosed_incentives: "利害",
    evidence_for_claims: "根拠",
    separates_fact_and_opinion: "事実/意見",
    unsourced_specifics: "出典",
    self_consistent: "一貫",
    certainty_matches_evidence: "断定",
  },
  en: {
    identifiable_publisher: "Publisher",
    honest_identity: "Identity",
    site_purpose: "Purpose",
    disclosed_incentives: "Incentives",
    evidence_for_claims: "Evidence",
    separates_fact_and_opinion: "Fact/opinion",
    unsourced_specifics: "Sources",
    self_consistent: "Consistency",
    certainty_matches_evidence: "Certainty",
  },
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "Pass",
  fail: "Alert",
  review: "Review",
  not_applicable: "N/A",
  error: "Error",
};

const PURPOSE_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    news_reference: "報道・解説",
    opinion_analysis: "意見・分析",
    portal: "ポータル・一覧",
    commercial: "販売・集客",
    satire_entertainment: "風刺・娯楽",
    unclear: "判別できない",
  },
  en: {
    news_reference: "News / reference",
    opinion_analysis: "Opinion / analysis",
    portal: "Portal / listing",
    commercial: "Sales / acquisition",
    satire_entertainment: "Satire / entertainment",
    unclear: "Unclear",
  },
};

const SPECIFIC_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    none: "ない / 出典あり",
    some: "中核以外に少しある",
    many: "中核の数字や引用に出典がない",
  },
  en: {
    none: "None / sourced",
    some: "Some, not core",
    many: "Core figures or quotes lack sources",
  },
};

export function questionLabel(id: string, locale: ResolvedLocale = "ja"): string {
  return QUESTION_LABELS[locale][id] ?? id;
}

export function questionAxisLabel(id: string, locale: ResolvedLocale = "ja"): string {
  return QUESTION_AXIS_LABELS[locale][id] ?? questionLabel(id, locale);
}

export function choiceLabel(questionId: string, choice: string, locale: ResolvedLocale = "ja"): string {
  if (questionId === "site_purpose") return PURPOSE_LABELS[locale][choice] ?? choice;
  if (questionId === "unsourced_specifics") return SPECIFIC_LABELS[locale][choice] ?? choice;
  return choice;
}

export function instructionText(check: { instructions: unknown }): string {
  return typeof check.instructions === "string" ? check.instructions : JSON.stringify(check.instructions);
}
