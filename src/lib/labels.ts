import type { JevAnswer, Verdict } from "./checkkit.js";
import { copyFor } from "./copy.js";
import type { ResolvedLocale } from "./locale.js";
import { CATEGORY_RUBRICS } from "./category-rubrics.js";

export const APP_NAME = "Audit";
export const APP_NAME_FULL = "Jev Audit";
export const APP_MARK = "Jev";

const QUESTION_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    content_classification: "本文の分類",
    identifiable_publisher: "ページの責任者が分かるか",
    honest_identity: "表示名とホスト名が一致するか",
    site_purpose: "ページの目的は明確か",
    disclosed_incentives: "販売や勧誘の相手が分かるか",
    evidence_for_claims: "主な主張に根拠があるか",
    separates_fact_and_opinion: "事実と意見を区別できるか",
    unsourced_specifics: "出典のない具体的な数字があるか",
    self_consistent: "本文に矛盾がないか",
    certainty_matches_evidence: "断定の強さが根拠に見合うか",
    evidence_for_claims_cite: "主張の根拠を支える文",
    separates_fact_and_opinion_cite: "事実と意見を分ける文",
    unsourced_specifics_cite: "出典のない具体の文",
    self_consistent_cite: "食い違いの文",
    certainty_matches_evidence_cite: "断定を支える文",
    identifiable_publisher_cite: "発行元を示す文",
    honest_identity_cite: "なりすましを示す文",
    site_purpose_cite: "目的を示す文",
    disclosed_incentives_cite: "利害を示す文",
  },
  en: {
    content_classification: "Content classification",
    identifiable_publisher: "Can the publisher be identified?",
    honest_identity: "Does the displayed identity match the host?",
    site_purpose: "Is the page's purpose clear?",
    disclosed_incentives: "Is it clear who benefits from a pitch?",
    evidence_for_claims: "Are the main claims supported?",
    separates_fact_and_opinion: "Can facts and opinions be told apart?",
    unsourced_specifics: "Are specific claims missing sources?",
    self_consistent: "Does the page contradict itself?",
    certainty_matches_evidence: "Does the wording match the evidence?",
    evidence_for_claims_cite: "Sentence behind the evidence",
    separates_fact_and_opinion_cite: "Sentence behind fact and opinion",
    unsourced_specifics_cite: "Sentence behind unsourced specifics",
    self_consistent_cite: "Sentence behind a contradiction",
    certainty_matches_evidence_cite: "Sentence behind the certainty",
    identifiable_publisher_cite: "Sentence behind the publisher",
    honest_identity_cite: "Sentence behind identity",
    site_purpose_cite: "Sentence behind the purpose",
    disclosed_incentives_cite: "Sentence behind the pitch",
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

const LEGACY_V8_SITE_PURPOSE_LABELS: Record<ResolvedLocale, string> = {
  ja: "ページの主な目的は何か",
  en: "What is the page mainly for?",
};

const LEGACY_V8_PURPOSE_LABELS: Record<ResolvedLocale, Record<string, string>> = {
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

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: "Pass",
  fail: "Alert",
  review: "Review",
  not_applicable: "N/A",
  error: "Error",
};

const PURPOSE_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    clear: "目的が明確",
    mixed: "目的が混在・不明瞭",
    hidden: "目的を隠している",
  },
  en: {
    clear: "Clear purpose",
    mixed: "Mixed or unclear purpose",
    hidden: "Purpose is hidden",
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

export function questionLabel(id: string, locale: ResolvedLocale = "ja", definitionVersion?: number): string {
  if (id === "site_purpose" && definitionVersion === 8) return LEGACY_V8_SITE_PURPOSE_LABELS[locale];
  const category = Object.values(CATEGORY_RUBRICS).find((rubric) => [...rubric.items, ...rubric.conditionalProbes].some((entry) => entry.id === id || `${entry.id}_cite` === id));
  if (category !== undefined) {
    const entry = [...category.items, ...category.conditionalProbes].find((item) => item.id === id || `${item.id}_cite` === id);
    if (entry !== undefined) return entry.label[locale];
  }
  return QUESTION_LABELS[locale][id] ?? id;
}

export function questionAxisLabel(id: string, locale: ResolvedLocale = "ja", definitionVersion?: number): string {
  const category = Object.values(CATEGORY_RUBRICS).find((rubric) => [...rubric.items, ...rubric.conditionalProbes].some((entry) => entry.id === id || `${entry.id}_cite` === id));
  if (category !== undefined) {
    const entry = [...category.items, ...category.conditionalProbes].find((item) => item.id === id || `${item.id}_cite` === id);
    if (entry !== undefined) return entry.axisLabel[locale];
  }
  return QUESTION_AXIS_LABELS[locale][id] ?? questionLabel(id, locale, definitionVersion);
}

const DISCLOSURE_LABELS: Record<ResolvedLocale, Record<string, string>> = {
  ja: {
    no_pitch: "勧誘はない",
    named_beneficiary: "受益者を明示",
    hidden_beneficiary: "誰が得をするかを隠している",
  },
  en: {
    no_pitch: "No pitch",
    named_beneficiary: "Beneficiary named",
    hidden_beneficiary: "Beneficiary hidden",
  },
};

export function choiceLabel(questionId: string, choice: string, locale: ResolvedLocale = "ja", definitionVersion?: number): string {
  if (questionId === "site_purpose") {
    const labels = definitionVersion === 8 ? LEGACY_V8_PURPOSE_LABELS : PURPOSE_LABELS;
    return labels[locale][choice] ?? choice;
  }
  if (questionId === "disclosed_incentives") return DISCLOSURE_LABELS[locale][choice] ?? choice;
  if (questionId === "unsourced_specifics") return SPECIFIC_LABELS[locale][choice] ?? choice;
  if (choice === "pass") return locale === "ja" ? "通過" : "Pass";
  if (choice === "review") return locale === "ja" ? "要確認" : "Review";
  if (choice === "alert") return locale === "ja" ? "警告" : "Alert";
  if (choice === "not_applicable") return locale === "ja" ? "対象外" : "N/A";
  return choice;
}

const BASIS_LABELS: Record<ResolvedLocale, Record<string, Record<string, string>>> = {
  en: {
    identifiable_publisher: {
      true: "A specific organization, publication, platform-plus-author, or named person is identifiable as responsible.",
      false: "The responsible party is missing, anonymous, only a generic label, or only a slogan that names no publisher.",
    },
    honest_identity: {
      true: "The branding matches the hostname, or a hosting platform is presenting a named author's page as that author's page.",
      false: "The page claims to be a different organization than the hostname suggests (typosquat, fake login, copied masthead, spoofed institution).",
    },
    site_purpose: {
      clear: "The page communicates what it is for, regardless of whether it is reporting, opinion, a listing, sales, fiction, or entertainment.",
      mixed: "The page has hard-to-distinguish purposes, or its purpose cannot be determined from the available content.",
      hidden: "The page obscures what it is for.",
    },
    disclosed_incentives: {
      no_pitch: "There is no sales or advocacy pitch.",
      named_beneficiary: "A pitch is present and the beneficiary or sponsor is named.",
      hidden_beneficiary: "The page pushes a product, donation, or political outcome while hiding who benefits.",
    },
    evidence_for_claims: {
      "0": "Established factual claims are made with little or no supporting evidence, data, or sources on the page.",
      "1": "Some established claims have sources or data, or the writing is a proposal or hypothesis whose main particulars are not checkable; important established claims or measurements are still missing.",
      "2": "The main factual claims presented as established are backed by named sources, data, documents, or the author's inspectable work.",
    },
    separates_fact_and_opinion: {
      true: "Facts and judgments are labeled or clearly separated, or the page is clearly an essay or opinion throughout.",
      false: "Opinions are written as if they were established facts, or facts are framed as mere opinion to dodge responsibility.",
    },
    unsourced_specifics: {
      none: "Specific facts are sourced, are the author's own stated work, are marked as unverified hypothesis, or the page stays at a level of generality that does not invent particulars.",
      some: "A few specifics lack a source, including unmeasured proposal details, but they are not presented as settled external facts that carry the piece.",
      many: "Load-bearing numbers, dates, quotes, or events are given as established fact with no checkable source and are not the author's own stated work.",
    },
    self_consistent: {
      true: "No two statements conflict on the same fact.",
      false: "The page states one thing and later the opposite, for example two different values for the same quantity.",
    },
    certainty_matches_evidence: {
      true: "Strong claims come with strong evidence; uncertain points are hedged or marked as the author's view, as a hypothesis, as unverified, or as unknown.",
      false: "The page states contested or thinly supported claims as settled fact, or hides strong evidence behind false uncertainty.",
    },
  },
  ja: {
    identifiable_publisher: {
      true: "特定の組織、媒体、プラットフォームと著者、または実名の人物が責任者として分かる。",
      false: "責任者がいない、匿名、一般的な肩書きだけ、または発行元を名乗らないスローガンだけ。",
    },
    honest_identity: {
      true: "表示上のブランドがホスト名と一致している。または、ホスティング上で著者本人のページとして出している。",
      false: "ホストが示す主体とは別の組織を名乗っている（タイポスクワッティング、偽ログイン、盗用した見出し、なりすまし）。",
    },
    site_purpose: {
      clear: "報道、意見、一覧、販売、創作、娯楽のいずれでも、ページが何のためかを伝えている。",
      mixed: "目的が区別しにくく混在している。または、ページの内容から目的を判断できない。",
      hidden: "ページが何のためかを隠している。",
    },
    disclosed_incentives: {
      no_pitch: "販売や勧誘はない。",
      named_beneficiary: "勧誘があり、誰が得をするかが書いてある。",
      hidden_beneficiary: "商品、寄付、政治的な結果を推し進めつつ、誰が得をするかを隠している。",
    },
    evidence_for_claims: {
      "0": "確定した事実主張に、ページ上の根拠・データ・出典がほとんどない。",
      "1": "一部の確定主張には出典やデータがある。または、主な細部を検証できない提案・仮説である。重要な確定主張や計測はまだ欠けている。",
      "2": "確定として示された主な事実主張が、名指しの出典、データ、文書、または著者が検査できる自らの仕事で裏付けられている。",
    },
    separates_fact_and_opinion: {
      true: "事実と判断が区別されている。または、ページ全体がエッセイや意見である。",
      false: "意見が確定した事実のように書かれている。または、事実を単なる感想にして責任を避けている。",
    },
    unsourced_specifics: {
      none: "具体的な事実に出典がある、著者自身の仕事だと示されている、未検証の仮説だと記されている、または細部を捏造しない一般論にとどまっている。",
      some: "出典のない具体が少しある（未計測の提案の細部を含む）が、記事を支える確定した外部事実としては出していない。",
      many: "数字、日付、引用、出来事など、記事を支える具体を、確認できる出典もなく、著者自身の仕事でもないと確定事実として述べている。",
    },
    self_consistent: {
      true: "同じ事実について矛盾する記述がない。",
      false: "一方で述べたことを後で否定している。同じ量に二つの値が付くなど。",
    },
    certainty_matches_evidence: {
      true: "強い主張には強い根拠がある。不確かな点は、著者の見解、仮説、未検証、不明だと示されている。",
      false: "争点のある主張や薄い根拠の主張を確定事実として述べている。または強い根拠を偽の不確さで隠している。",
    },
  },
};

export function basisKey(answer: JevAnswer | undefined): string | undefined {
  if (answer === undefined) return undefined;
  if (answer.type === "noul") return answer.noul >= 0.5 ? "true" : "false";
  if (answer.type === "choice") return answer.choice;
  return String(Math.round(answer.score));
}

export function basisLabel(
  id: string,
  answer: JevAnswer | undefined,
  locale: ResolvedLocale = "ja",
  fallback = "",
): string {
  const key = basisKey(answer);
  if (key === undefined) return fallback;
  return BASIS_LABELS[locale][id]?.[key] ?? BASIS_LABELS.en[id]?.[key] ?? fallback;
}

export const REMARK_IDS = [
  "identifiable_publisher",
  "honest_identity",
  "site_purpose",
  "disclosed_incentives",
  "evidence_for_claims",
  "separates_fact_and_opinion",
  "unsourced_specifics",
  "self_consistent",
  "certainty_matches_evidence",
] as const;

const VERDICT_REMARKS: Record<ResolvedLocale, Record<string, Record<Verdict, string>>> = {
  ja: {
    identifiable_publisher: {
      pass: "ページから責任者が分かる。",
      review: "責任者を特定できるか、判断できない。",
      fail: "ページの責任者を特定できない。",
      error: "発行元を判定できなかった。",
      not_applicable: "この項目は対象外。",
    },
    honest_identity: {
      pass: "表示名とホスト名が一致する。",
      review: "なりすましか、判断できない。",
      fail: "別の組織を名乗っている。",
      error: "表示された身元を判定できなかった。",
      not_applicable: "この項目は対象外。",
    },
    site_purpose: {
      pass: "ページが何のためかを明示している。",
      review: "目的が混在しているか、内容から目的を判断できない。",
      fail: "目的を明かさず、読者を別の理解へ誘導している。",
      error: "ページの目的が明確か判定できなかった。",
      not_applicable: "この項目は対象外。",
    },
    disclosed_incentives: {
      pass: "勧誘はないか、受益者が明記されている。",
      review: "誰が得をするか、判断できない。",
      fail: "誰が得をするかを隠している。",
      error: "勧誘や利害を判定できなかった。",
      not_applicable: "この項目は対象外。",
    },
    evidence_for_claims: {
      pass: "主な事実の記述を、ページ上の根拠が支えている。",
      review: "根拠は一部にあるか、判断できない。",
      fail: "主な事実の記述に、ほとんど根拠がない。",
      error: "主張の根拠を判定できなかった。",
      not_applicable: "記事がないので、この問は聞いていない。",
    },
    separates_fact_and_opinion: {
      pass: "事実と著者の判断を区別できる。",
      review: "事実と意見を区別できるか判断できない。",
      fail: "意見を事実のように、または事実を好みのように書いている。",
      error: "事実と意見を判定できなかった。",
      not_applicable: "記事がないので、この問は聞いていない。",
    },
    unsourced_specifics: {
      pass: "具体的な記述に出典があるか、出典を必要としない。",
      review: "出典のない具体的な記述は、中核ではない。",
      fail: "記事を支える具体的な記述に出典がない。",
      error: "具体的な記述の出典を判定できなかった。",
      not_applicable: "記事がないので、この問は聞いていない。",
    },
    self_consistent: {
      pass: "同じ事実について、記述に食い違いがない。",
      review: "記述に食い違いがあるか判断できない。",
      fail: "同じ事実について、記述が食い違っている。",
      error: "記述の食い違いを判定できなかった。",
      not_applicable: "記事がないので、この問は聞いていない。",
    },
    certainty_matches_evidence: {
      pass: "断定の強さが、示された根拠に見合う。",
      review: "断定の強さが根拠に見合うか判断できない。",
      fail: "断定が、示された根拠より強い。",
      error: "断定の強さと根拠を判定できなかった。",
      not_applicable: "記事がないので、この問は聞いていない。",
    },
  },
  en: {
    identifiable_publisher: {
      pass: "This page identifies who is responsible.",
      review: "It is unclear who is responsible for this page.",
      fail: "This page does not identify who is responsible.",
      error: "The publisher could not be checked.",
      not_applicable: "Not applicable to this page.",
    },
    honest_identity: {
      pass: "The displayed identity matches the host.",
      review: "It is unclear whether the page is impersonating someone.",
      fail: "The page presents itself as a different organization.",
      error: "The displayed identity could not be checked.",
      not_applicable: "Not applicable to this page.",
    },
    site_purpose: {
      pass: "The page makes its purpose clear.",
      review: "The page's purposes are mixed, or its purpose is unclear from the available content.",
      fail: "The page hides what it is for.",
      error: "The clarity of the page's purpose could not be checked.",
      not_applicable: "Not applicable to this page.",
    },
    disclosed_incentives: {
      pass: "There is no pitch, or it names who benefits.",
      review: "It is unclear who benefits from the pitch.",
      fail: "The page hides who benefits from the pitch.",
      error: "The pitch and its beneficiary could not be checked.",
      not_applicable: "Not applicable to this page.",
    },
    evidence_for_claims: {
      pass: "The page supports its main factual claims.",
      review: "Some claims have support, or the support is unclear.",
      fail: "The page provides little support for its main factual claims.",
      error: "The claims and their support could not be checked.",
      not_applicable: "Not asked. This page is not one piece of writing.",
    },
    separates_fact_and_opinion: {
      pass: "Facts and the author's views are distinguishable.",
      review: "It is unclear whether facts and opinions are distinguishable.",
      fail: "An opinion is presented as fact, or a fact as mere opinion.",
      error: "Facts and opinions could not be checked.",
      not_applicable: "Not asked. This page is not one piece of writing.",
    },
    unsourced_specifics: {
      pass: "Specific claims have sources, or do not need them.",
      review: "Unsourced specifics are not central to the piece.",
      fail: "Specific claims that carry the piece have no source.",
      error: "Specific claims and their sources could not be checked.",
      not_applicable: "Not asked. This page is not one piece of writing.",
    },
    self_consistent: {
      pass: "The page does not contradict itself about the same fact.",
      review: "It is unclear whether the page contradicts itself.",
      fail: "The page gives conflicting accounts of the same fact.",
      error: "The page's consistency could not be checked.",
      not_applicable: "Not asked. This page is not one piece of writing.",
    },
    certainty_matches_evidence: {
      pass: "The wording's certainty matches the evidence shown.",
      review: "It is unclear whether the wording matches the evidence.",
      fail: "The wording is more certain than the evidence supports.",
      error: "The wording and its evidence could not be checked.",
      not_applicable: "Not asked. This page is not one piece of writing.",
    },
  },
};

const LEGACY_V8_SITE_PURPOSE_REMARKS: Record<ResolvedLocale, Record<Verdict, string>> = {
  ja: {
    pass: "主な目的は報道、意見、一覧のいずれか。",
    review: "販売や娯楽が主目的の可能性がある。",
    fail: "主な目的を判別できない。",
    error: "ページの目的を判定できなかった。",
    not_applicable: "この項目は対象外。",
  },
  en: {
    pass: "The page is mainly news, opinion, or a listing.",
    review: "The page may mainly be a pitch or entertainment.",
    fail: "The page's main purpose is unclear.",
    error: "The page's purpose could not be checked.",
    not_applicable: "Not applicable to this page.",
  },
};

/** Short client remark for this question and this verdict. The same sentence for every URL. */
export function verdictRemark(id: string, verdict: Verdict, locale: ResolvedLocale = "ja", definitionVersion?: number): string {
  if (id === "site_purpose" && definitionVersion === 8) return LEGACY_V8_SITE_PURPOSE_REMARKS[locale][verdict];
  return VERDICT_REMARKS[locale][id]?.[verdict] ?? "";
}

/** Item readout. The remark is not the criterion paragraph, and it does not repeat the chip. */
export function evidenceReadout(
  id: string,
  verdict: Verdict,
  locale: ResolvedLocale,
  sentence: string,
): { verdict: string; remark: string; sentence: string } {
  return {
    verdict: copyFor(locale).verdictLabels[verdict],
    remark: verdictRemark(id, verdict, locale),
    sentence: sentence.trim(),
  };
}

export function instructionText(check: { instructions: unknown }): string {
  return typeof check.instructions === "string" ? check.instructions : JSON.stringify(check.instructions);
}

const INSTRUCTION_JA: Record<string, string> = {
  identifiable_publisher:
    "ホスト名、タイトル、サイト名、著者、見えている本文から、このページの責任者を名指しできるか。著者とサイト名は、署名、発行者名、著者リンク、JSON-LD、メタデータです。主本文からナビゲーションとして除いた文字列でも数えます。掲載プラットフォームと、実名または公開ハンドルの著者なら、発行元は特定できます。見出しの中のブランド風の語、一般的な部署名、ホスト名だけ、「公式」という語だけで相手が無い場合は、特定できたことにしません。このページから責任者を名指しできるかだけを見ます。有名なホストだから特定できたとはせず、連絡先の住所も必須にしません。",
  honest_identity:
    "見えているブランド、タイトル、名乗っている発行元は、実際のホスト名と一致しているか。それとも別の主体のなりすましか。見るのはなりすましであり、文章のうまさや有名さではありません。自分として話しているサイトは、名指しした機関を厳しく批評していても、なりすましではありません。別のホストにいながら、他の組織の名前、ロゴ、ログインを写しているページはなりすましです。他者のホストの綴りを似せたものもなりすましです。風刺だと分かるように自分で書いている場合は、身元については正直です。",
  site_purpose:
    "ページの形、タイトル、見えている本文から、読者にページの目的が分かるか。ページの形はクライアントが構造から付けたラベルです。一覧は行き先の並び、記事は一つの文章です。ホストの評判は使いません。報道、意見、一覧、販売、創作、娯楽のどれであっても、目的が明示されていれば明確です。販売の利害は disclosed_incentives で別に確認します。目的が混在して区別できないか、内容が足りず判断できなければ mixed です。ページが何のためかを隠している場合だけ hidden です。",
  disclosed_incentives:
    "販売、資金集め、または得をする主体への働きかけがあるとき、どれに当たるか。no_pitch は販売や勧誘がない。named_beneficiary は勧誘があり、誰が得をするかが書いてある。hidden_beneficiary は商品、寄付、政治的な結果を推し進めつつ、誰が得をするかを隠している。明らかな店は no_pitch です。誰が宣伝の対価を得ているか読者に分からなければ、商品名は named_beneficiary ではありません。",
  evidence_for_claims:
    "見えている本文は、確定として出した事実主張を、どの程度支えているか。数えるのは、このページで読者が確認できる根拠だけです。名指しの出典、データ、文書、方法、または著者が自分の仕事だと示して指しているものです。設計の提案、作業仮説、未検証、実験が必要、まだ計測していない、と本文が記している点は、確定した事実主張ではありません。明確に提案だと分かるものを、出典の無い報道断定と同じ点数にしません。提案に公式リンクや計測が無くても、いちばん上の段にはしません。名前の無い「専門家によると」や、中身の無い宣伝文句は低い点数です。特定の引用形式は求めません。ホストが有名だから主張を認めません。",
  separates_fact_and_opinion:
    "事実の記述と著者の判断を、読者が区別できるか。エッセイや意見のページは混ざってよい。判断が判断として読め、報じられた事実が創作でなければ通過です。主張があるからといってエッセイを失敗にしません。推測だと、仮説だと、実験が必要だと記された設計は、計測した事実として書いた判断ではありません。判断を計測した事実として書いている場合、または出典を避けるために計測した事実を好みの問題として書いている場合は失敗です。",
  unsourced_specifics:
    "数字、日付、引用、名指しの出来事を、読者が確認できる出典も無く、確定した外部の事実として出しているか。著者自身の仕事だとページが言い、確認する手段を示していれば、それは出典です。記事を支える具体を、確認できる出典も無く外部の事実として出している場合は、出典があることにはなりません。仮説、未検証、実験が必要と記した具体は、出典の無い事実ではありません。そうした具体が、確認できる出典も無く記事を支える主な数字になっているなら、多いではなく少しです。一晩で、10 倍、研究の無い「臨床的に証明」のような宣伝の丸い数字は、確定事実として主張を支えるなら具体値です。",
  self_consistent:
    "同じ事実について、本文の中で矛盾がないか。一致する二つの記述は通過です。同じ主張の反復は矛盾ではありません。同じ事実に相容れない数字、日付、結果がある場合、または後で無かったことにしている場合は失敗です。",
  certainty_matches_evidence:
    "断定の強さは、ページが実際に示している根拠に見合っているか。強い主張には強い根拠が要ります。個人の結果だと記したもの、不確かだと和らげた点は通過です。仮説、未検証、実験が必要と記した主張は、正しい不確かさです。確定事実として扱いません。健康、金、身元、法について確定したように聞こえる主張には、ページ上の確定した根拠が要ります。争点がある主張、または根拠が薄い主張を確定事実として述べている場合は失敗です。",
};

const CITE_INSTRUCTION_JA: Record<string, string> = {
  evidence_for_claims_cite:
    "このページから切った文が選択肢です。各ラベルの説明がその文です。確定した事実主張の根拠になっている文を一つ選んでください。名指しの出典、文書、データ、方法、または著者が自分の仕事だと示している文です。ページでいちばん具体的な段落だから、という理由では選ばないでください。この問が通過しないときは、通過する部分を支える文ではなく、失敗の原因になっている文を選んでください。その根拠に関わる文が無ければ none です。新しい文は書かないでください。",
  separates_fact_and_opinion_cite:
    "このページから切った文が選択肢です。各ラベルの説明がその文です。事実と意見の切り分けに関わる文を一つ選んでください。事実と著者の判断が並んでいる文、判断を計測した事実として書いた文、または計測した事実を好みとして書いた文です。数字や出典があるという理由だけでは選ばないでください。この問が通過しないときは、通過する部分を支える文ではなく、失敗の原因になっている文を選んでください。その切り分けに関わる文が無ければ none です。新しい文は書かないでください。",
  unsourced_specifics_cite:
    "このページから切った文が選択肢です。各ラベルの説明がその文です。数字、日付、引用、名指しの出来事が入っている文を一つ選んでください。確認できる出典が無く確定事実として出ている具体があればそれを優先し、無ければ記事を支える具体が入っている文です。出典の名前だけで具体が無い文は選ばないでください。この問が通過しないときは、通過する部分を支える文ではなく、失敗の原因になっている文を選んでください。具体に関わる文が無ければ none です。新しい文は書かないでください。",
  self_consistent_cite:
    "このページから切った文が選択肢です。各ラベルの説明がその文です。本文の内部矛盾に関わる文を一つ選んでください。同じ事実について別の文と食い違う数字、日付、結果の文、または後で取り消している主張の文です。食い違いが無ければ、別の文も述べている事実の文です。いちばん具体的な段落だから、という理由では選ばないでください。この問が通過しないときは、通過する部分を支える文ではなく、失敗の原因になっている文を選んでください。同じ事実に触れる文が無ければ none です。新しい文は書かないでください。",
  certainty_matches_evidence_cite:
    "このページから切った文が選択肢です。各ラベルの説明がその文です。断定の強さに関わる文を一つ選んでください。断定、和らげ、仮説、個人の結果のいずれかの文です。言い切りの強さと、その文の中の根拠がずれている文があればそれを優先します。数字があるという理由だけでは選ばないでください。この問が通過しないときは、通過する部分を支える文ではなく、失敗の原因になっている文を選んでください。断定の強さが問題になる文が無ければ none です。新しい文は書かないでください。",
  identifiable_publisher_cite:
    "ラベルは、ページに出ているタイトル、サイト名、著者、説明、そのあとに本文から切った文です。各ラベルの説明がその文字列です。責任者の名前が分かるもの、または責任者がいないと分かるものを一つ選んでください。この問が通過しないときは、通過する部分を支えるものではなく、失敗の原因になっているものを選んでください。責任者に関わるものが無ければ none です。新しい文は書かないでください。",
  honest_identity_cite:
    "ラベルは、ページに出ているタイトル、サイト名、著者、説明、そのあとに本文から切った文です。各ラベルの説明がその文字列です。自分として話しているか、別の主体を名乗っているかが分かるものを一つ選んでください。この問が通過しないときは、通過する部分を支えるものではなく、失敗の原因になっているものを選んでください。身元に関わるものが無ければ none です。新しい文は書かないでください。",
  site_purpose_cite:
    "ラベルは、ページに出ているタイトル、サイト名、著者、説明、そのあとに本文から切った文です。各ラベルの説明がその文字列です。このページが何のためにあるかが分かるものを一つ選んでください。この問が通過しないときは、通過する部分を支えるものではなく、失敗の原因になっているものを選んでください。目的に関わるものが無ければ none です。新しい文は書かないでください。",
  disclosed_incentives_cite:
    "ラベルは、ページに出ているタイトル、サイト名、著者、説明、そのあとに本文から切った文です。各ラベルの説明がその文字列です。勧誘、得をする主体の名前、または勧誘がないことが分かるものを一つ選んでください。この問が通過しないときは、通過する部分を支えるものではなく、失敗の原因になっているものを選んでください。勧誘に関わるものが無ければ none です。新しい文は書かないでください。",
};

const CITE_NONE_EN = "No single sentence carries this question.";
const CITE_NONE_JA = "この問を支える文は一本に決まらない。";
const CITE_IDS = [
  "evidence_for_claims_cite",
  "separates_fact_and_opinion_cite",
  "unsourced_specifics_cite",
  "self_consistent_cite",
  "certainty_matches_evidence_cite",
  "identifiable_publisher_cite",
  "honest_identity_cite",
  "site_purpose_cite",
  "disclosed_incentives_cite",
] as const;

for (const id of CITE_IDS) {
  BASIS_LABELS.en[id] = { none: CITE_NONE_EN };
  BASIS_LABELS.ja[id] = { none: CITE_NONE_JA };
}

export function instructionLabel(id: string, locale: ResolvedLocale, fallback: string): string {
  if (locale !== "ja") return fallback;
  const citeJa = CITE_INSTRUCTION_JA[id];
  if (citeJa !== undefined) return citeJa;
  return INSTRUCTION_JA[id] ?? fallback;
}

export function basisEntries(id: string, locale: ResolvedLocale = "ja"): { key: string; text: string }[] {
  const table = BASIS_LABELS[locale][id] ?? BASIS_LABELS.en[id];
  if (table === undefined) {
    const category = Object.values(CATEGORY_RUBRICS).find((rubric) => [...rubric.items, ...rubric.conditionalProbes].some((entry) => entry.id === id));
    const entry = category?.items.concat(category.conditionalProbes).find((item) => item.id === id);
    if (entry !== undefined) return Object.entries(entry.criteria).map(([key, text]) => ({ key, text }));
    return [];
  }
  return Object.keys(table).map((key) => ({ key, text: table[key] ?? "" }));
}
