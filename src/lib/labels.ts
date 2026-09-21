import type { JevAnswer, Verdict } from "./checkkit.js";
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
      news_reference: "Reports or explains events or facts in a journalistic or encyclopedic way.",
      opinion_analysis: "Argues a position, teaches, or interprets; the author's view or experience is the point.",
      portal: "A listing, index, or headline board rather than one piece of writing.",
      commercial: "Exists mainly to sell a product, service, or lead, including affiliate copy dressed as reporting.",
      satire_entertainment: "Humor, fiction, or entertainment that is not claiming to be a news report.",
      unclear: "Purpose cannot be determined, or incompatible purposes are mixed without labeling them.",
    },
    disclosed_incentives: {
      true: "There is no sales or advocacy pitch, or a pitch is present and the beneficiary or sponsor is named.",
      false: "The page pushes a product, donation, or political outcome while hiding who benefits.",
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
      news_reference: "出来事や事実を、報道または事典のように報告・説明する。",
      opinion_analysis: "立場を論じる、教える、解釈する。著者の見解や経験が主題である。",
      portal: "一件の文章ではなく、一覧、索引、見出し板である。",
      commercial: "主に商品・サービス・見込み客の獲得が目的。報道に見せたアフィリエイトも含む。",
      satire_entertainment: "ユーモア、創作、娯楽であり、報道だと称していない。",
      unclear: "目的が分からない。または相容れない目的が、区別されずに混ざっている。",
    },
    disclosed_incentives: {
      true: "販売や勧誘がない。または勧誘があり、受益者やスポンサーが明示されている。",
      false: "商品、寄付、政治的結果を推し進めつつ、誰が得をするかを隠している。",
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

export function instructionText(check: { instructions: unknown }): string {
  return typeof check.instructions === "string" ? check.instructions : JSON.stringify(check.instructions);
}

const INSTRUCTION_JA: Record<string, string> = {
  identifiable_publisher:
    "ホスト名、タイトル、サイト名、著者、見えている本文から、このページの責任者を名指しできるか。著者とサイト名は、署名、発行者名、著者リンク、JSON-LD、メタデータです。主本文からナビゲーションとして除いた文字列でも数えます。掲載プラットフォームと、実名または公開ハンドルの著者なら、発行元は特定できます。見出しの中のブランド風の語、一般的な部署名、ホスト名だけ、「公式」という語だけで相手が無い場合は、特定できたことにしません。このページから責任者を名指しできるかだけを見ます。有名なホストだから特定できたとはせず、連絡先の住所も必須にしません。",
  honest_identity:
    "見えているブランド、タイトル、名乗っている発行元は、実際のホスト名と一致しているか。それとも別の主体のなりすましか。見るのはなりすましであり、文章のうまさや有名さではありません。自分として話しているサイトは、名指しした機関を厳しく批評していても、なりすましではありません。別のホストにいながら、他の組織の名前、ロゴ、ログインを写しているページはなりすましです。他者のホストの綴りを似せたものもなりすましです。風刺だと分かるように自分で書いている場合は、身元については正直です。",
  site_purpose:
    "ページの形、タイトル、見えている本文から、このページの主な目的は何か。ページの形は、クライアントが構造から付けたラベルです。一覧は行き先の並び、記事は一つの文章です。ホストの評判は使いません。目的は人気や品質の点数ではありません。意見、解説、批評は意見・分析です。報道に見えて、販売、商品の順位付け、見込み客の獲得が目的なら販売です。相容れない目的が、区別されずに混ざっていれば判別できません。",
  disclosed_incentives:
    "販売、資金集め、または得をする主体への働きかけがあるとき、その関係を出しているか。明らかな店、または勧誘の無い文章は通過です。アフィリエイト、提供枠、健康・金・法の勧誘で、誰が対価を得ているかを隠している場合は失敗です。誰が宣伝の対価を得ているか読者に分からなければ、商品名を出しても開示ではありません。",
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

export function instructionLabel(id: string, locale: ResolvedLocale, fallback: string): string {
  if (locale !== "ja") return fallback;
  return INSTRUCTION_JA[id] ?? fallback;
}

export function basisEntries(id: string, locale: ResolvedLocale = "ja"): { key: string; text: string }[] {
  const table = BASIS_LABELS[locale][id] ?? BASIS_LABELS.en[id];
  if (table === undefined) return [];
  return Object.keys(table).map((key) => ({ key, text: table[key] ?? "" }));
}
