/** Content-specific body questions. These definitions describe visible evidence, not truth verification. */
export const CONTENT_CATEGORY_IDS = [
  "reporting", "announcement", "explanation", "opinion", "investigation",
  "guide", "experience_review", "sales", "reference", "discussion", "creative",
] as const;

export type ContentCategoryId = (typeof CONTENT_CATEGORY_IDS)[number];
export type RubricVerdict = "pass" | "review" | "alert" | "not_applicable";
export type BilingualLabel = { ja: string; en: string };
export type RubricCriteria = Record<RubricVerdict, string>;
export interface CategoryRubricItem {
  id: string;
  label: BilingualLabel;
  axisKey: string;
  axisLabel: BilingualLabel;
  instruction: string;
  /** If false, a missing feature may legitimately produce N/A; if true its absence is Review. */
  required: boolean;
  criteria: RubricCriteria;
}
export interface ConditionalProbe extends CategoryRubricItem {
  /** Content patterns that activate the probe. Must be assessed from the body, never URL/site identity. */
  trigger: { question: string; instruction: string };
}
export interface CategoryRubric {
  label: BilingualLabel;
  purpose: BilingualLabel;
  items: readonly CategoryRubricItem[];
  conditionalProbes: readonly ConditionalProbe[];
}

const criteria = (pass: string, review: string, alert: string, na: string): RubricCriteria => ({
  pass, review, alert, not_applicable: na,
});
const OPTIONAL_ITEM_IDS = new Set([
  "reporting_context", "reporting_uncertainty", "announcement_metrics", "announcement_third_party",
  "explanation_limits", "opinion_premises", "opinion_hypothesis",
  "guide_recovery", "guide_side_effects", "experience_review_limits", "sales_claims", "sales_testimonials",
  "reference_examples", "discussion_sources",
  "creative_reality_boundary", "creative_satire_quote", "creative_real_world_action",
]);
const item = (id: string, ja: string, en: string, axisJa: string, axisEn: string, instruction: string, c: RubricCriteria): CategoryRubricItem => ({
  id, label: { ja, en }, axisKey: `${CONTENT_CATEGORY_IDS.find((category) => id.startsWith(`${category}_`)) ?? "category"}_${axisEn.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`, axisLabel: { ja: axisJa, en: axisEn }, instruction,
  required: !OPTIONAL_ITEM_IDS.has(id),
  criteria: {
    pass: `Pass when ${c.pass === C.required ? "the page clearly provides the evidence required for this criterion" : c.pass}. Criterion: ${instruction}`,
    review: `Review when ${c.review === C.absent ? "the page does not provide enough evidence to decide this criterion; do not infer the missing detail" : c.review}. Criterion: ${instruction}`,
    alert: `Alert only when ${c.alert === C.wrong ? "the page itself explicitly contradicts or materially misleads on this criterion; do not treat lack of evidence as proof of falsehood" : c.alert}. Criterion: ${instruction}`,
    not_applicable: `${OPTIONAL_ITEM_IDS.has(id) ? "N/A only when the specific feature named here is genuinely absent; when present, assess it and use Review if evidence is insufficient." : "This criterion is required for the selected category. Missing information is Review, never N/A."} Criterion: ${instruction}`,
  },
});
const probe = (base: CategoryRubricItem, triggerQuestion: string, triggerInstruction: string): ConditionalProbe => ({ ...base, trigger: { question: triggerQuestion, instruction: `Inspect the page body. ${triggerInstruction}` } });

const C = {
  required: "The relevant information is stated clearly in the page text.",
  absent: "The page does not provide enough information to decide this criterion.",
  wrong: "The page explicitly contradicts itself or presents a materially misleading account on this criterion.",
  na: "N/A only when this criterion's feature is genuinely absent. If the category requires the information, its omission is Review.",
};

const CATEGORY_PURPOSE: Readonly<Record<ContentCategoryId, BilingualLabel>> = {
  reporting: { ja: "外部で起きた事実を伝える。", en: "Reports an event or fact that happened outside the writing." },
  announcement: { ja: "当事者が自らの決定や予定を伝える。", en: "A party states its own decision, plan, or offering." },
  explanation: { ja: "既存の情報を整理し、意味や関係を解説する。", en: "Organizes existing information and explains its meaning or relationships." },
  opinion: { ja: "立場や提案を論じる。", en: "Argues a position or a proposal." },
  investigation: { ja: "独自の方法で調べ、結果を示す。", en: "Investigates with its own method and shows the result." },
  guide: { ja: "読者が行う作業の手順を説明する。", en: "Explains steps a reader carries out." },
  experience_review: { ja: "使用や体験に基づいて評価する。", en: "Evaluates something from use or experience." },
  sales: { ja: "購入、申込、寄付などの行動を促す。", en: "Urges a purchase, signup, donation, or similar action." },
  reference: { ja: "定義、仕様、データなどを参照できる形で示す。", en: "Presents definitions, specifications, or data for lookup." },
  discussion: { ja: "複数の投稿、質問、回答、応答を扱う。", en: "Handles several posts, questions, answers, or replies." },
  creative: { ja: "創作物、風刺、娯楽として読ませる。", en: "Presents fiction, satire, or entertainment." },
};

const CATEGORY_RUBRIC_BASE: Readonly<Record<ContentCategoryId, Omit<CategoryRubric, "purpose">>> = {
  reporting: { label: { ja: "報道・事実報告", en: "Reporting" }, items: [
    item("reporting_event_time", "中心事実と時点", "Central event and time", "事実・時点", "Facts and timing", "Assess whether the central reported event and the time to which the account refers are identifiable.", criteria(C.required, C.absent, C.wrong, C.na)),
    item("reporting_attribution", "情報源の帰属", "Source attribution", "情報源", "Attribution", "Assess whether the source of central facts or quotations is identified in the text.", criteria(C.required, C.absent, C.wrong, C.na)),
    item("reporting_verification", "主張の検証手掛かり", "Verification cues", "検証手掛かり", "Verification cues", "For important independently asserted claims, assess whether the page gives a primary source or another checkable verification cue. Do not demand independent corroboration merely when reporting that someone made an announcement.", criteria("Important independent assertions have a relevant checkable cue, or the text clearly attributes an announcement.", C.absent, C.wrong, C.na)),
    item("reporting_context", "引用・数字の文脈", "Context for quotes and figures", "文脈", "Context", "Assess whether quotations, numbers, and comparisons retain enough context to understand their scope and reference point.", criteria(C.required, C.absent, C.wrong, C.na)),
    item("reporting_uncertainty", "未確定情報の扱い", "Treatment of uncertainty", "不確実性", "Uncertainty", "Assess whether allegations, estimates, and confirmed facts are distinguished, and whether material updates are presented as developments.", criteria(C.required, C.absent, C.wrong, C.na)),
  ], conditionalProbes: [probe(item("reporting_high_stakes", "匿名情報源", "Anonymous source", "重大主張", "High-stakes claims", "Assess whether the body explains why the source is anonymous and provides independent confirmation where material.", criteria("The reason for anonymity and relevant independent confirmation are described.", C.absent, C.wrong, C.na)), "Does the body rely on an anonymous source?", "Activate only when the body uses an anonymous source; do not infer it from the publisher or URL." )] },
  announcement: { label: { ja: "当事者の発表・告知", en: "First-party announcement" }, items: [
    item("announcement_actor", "発表の主体と内容", "Announcing actor and action", "主体・内容", "Actor and action", "Assess whether the organization or person speaking and their own decision, action, or offering are clear.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("announcement_status", "実績と予定", "Completed work and plans", "実績・予定", "Status and plans", "Assess whether completed outcomes are distinguished from plans, targets, and forecasts.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("announcement_metrics", "数値・性能の根拠", "Basis for figures and performance", "数値の根拠", "Metric basis", "Assess whether important numerical or performance claims include measurement conditions or another relevant basis.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("announcement_third_party", "第三者に関する主張", "Claims about third parties", "第三者", "Third parties", "Assess whether claims about outside organizations, users, or beneficiaries are attributed rather than asserted as established consent or endorsement without support.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("announcement_scope", "適用範囲と条件", "Scope and conditions", "適用条件", "Applicability", "Assess whether relevant audience, start date, geography, usage conditions, and possibility of change are stated.", criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("announcement_future_comparison", "将来の成果保証", "Future outcome guarantee", "保証・比較", "Guarantees and comparisons", "Assess whether conditions and assumptions attached to the promised future outcome are stated.", criteria("The promised outcome's material conditions and assumptions are stated.",C.absent,C.wrong,C.na)), "Does the body promise a future outcome?", "Activate only when the body promises a future outcome." )] },
  explanation: { label: { ja: "解説・分析", en: "Explanation and analysis" }, items: [
    item("explanation_scope", "論点と用語", "Question and terminology", "論点・用語", "Question and terms", "Assess whether the explanatory question and the meaning of central terms are understandable.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("explanation_sources", "資料の出所", "Source provenance", "資料の出所", "Source provenance", "Assess whether readers can identify or reach the source material behind central facts and figures.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("explanation_fit", "資料の適合", "Fit of source material", "資料の適合", "Source fit", "Assess whether the subject, time period, and units of cited material fit the point being explained.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("explanation_inference", "推論のつながり", "Reasoning chain", "推論", "Reasoning", "Assess whether the path from source material to interpretation, causal account, or conclusion is explained without a material unsupported leap.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("explanation_limits", "比較と限界", "Comparisons and limits", "比較・限界", "Limits", "Assess whether comparison conditions, exceptions, and uncertainty are stated in proportion to the strength of the conclusion.", criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("explanation_causality", "因果関係の断定", "Causal assertion", "因果・予測", "Causality and forecasts", "Assess whether the explanation considers a plausible alternative cause for the asserted causal relationship.", criteria("A plausible alternative cause is addressed or the limits of causal inference are stated.",C.absent,C.wrong,C.na)), "Does the body claim a causal relationship?", "Activate only when the body states a causal relationship." )] },
  opinion: { label: { ja: "意見・提案", en: "Opinion and proposal" }, items: [
    item("opinion_position", "主張と目的", "Position and purpose", "主張・目的", "Position and purpose", "Assess whether the judgment or proposal and its intended purpose are clear.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("opinion_premises", "事実の前提", "Factual premises", "事実の前提", "Factual premises", "Assess whether checkable factual premises that materially support the conclusion have a traceable cue.", criteria(C.required,C.absent,C.wrong,C.na)),
    item("opinion_fact_value", "事実と価値判断", "Facts and value judgments", "事実・価値", "Facts and values", "Assess whether preferences or normative judgments are presented as measured facts.", criteria("The text distinguishes value judgments from factual claims.",C.absent,"A preference or value judgment is explicitly misrepresented as an established measurement.",C.na)),
    item("opinion_hypothesis", "仮説と因果", "Hypotheses and causality", "仮説・因果", "Hypotheses", "Assess whether claimed effects of a proposal are supported as results or clearly identified as untested hypotheses.", criteria("Effects are supported at the stated strength or clearly marked as untested.",C.absent,"An untested effect is presented as an established outcome.",C.na)),
    item("opinion_conditions", "実行条件と影響", "Conditions and effects", "条件・影響", "Conditions and effects", "Assess whether necessary implementation conditions and material burdens or side effects are addressed.", criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("opinion_quantified_effect", "提案の数値効果", "Quantified effect of a proposal", "効果の前提", "Effect assumptions", "Assess whether the assumptions behind the proposal's quantified effect are stated.", criteria("The estimate's assumptions are stated and its uncertainty is not hidden.",C.absent,C.wrong,C.na)), "Does the body quantify an effect of the proposal?", "Activate only when the body gives a quantified effect for the proposal." )] },
  investigation: { label: { ja: "調査・検証", en: "Research and verification" }, items: [
    item("investigation_design", "問いと設計", "Question and design", "問い・設計", "Question and design", "Assess whether the research question and observation, experiment, or comparison design are described.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_sample", "対象の選び方", "Selection of subjects", "対象選定", "Subject selection", "Assess whether the sample or subjects, time period, and exclusions can be understood.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_measure", "測定の定義", "Measurement definition", "測定", "Measurement", "Assess whether indicators, units, and measurement procedures are defined.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_data", "元データの出所", "Data provenance", "データと結果", "Data and results", "Assess whether data collection or acquisition sources are traceable, or restrictions on unavailable data are explained.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_analysis", "分析手順", "Analysis procedure", "分析手順", "Analysis", "Assess whether aggregation, comparison, statistical, or decision procedures are described.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_results", "結果の対応", "Results match methods", "データと結果", "Data and results", "Assess whether the main tables and conclusions correspond to the described methods and data.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("investigation_limits", "不確実性と一般化", "Uncertainty and generalization", "限界・一般化", "Limits", "Assess whether error, bias, limitations, and the scope to which results may apply are stated.",criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("investigation_statistics", "統計的有意差", "Statistical significance", "分析手順", "Analysis", "Assess whether the statistical method, assumptions, and uncertainty underlying the significance claim are described.", criteria("The method and relevant assumptions for the significance claim are described.",C.absent,C.wrong,C.na)), "Does the body claim a statistically significant result?", "Activate only when the body describes a result as statistically significant." )] },
  guide: { label: { ja: "手順・ガイド", en: "How-to guide" }, items: [
    item("guide_goal", "目的と適用条件", "Goal and prerequisites", "目的・条件", "Goal and prerequisites", "Assess whether the intended end state and required environment, permissions, and version are clear.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("guide_sequence", "操作の再現性", "Reproducible sequence", "手順", "Procedure", "Assess whether readers can follow the order of steps and relevant branches.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("guide_inputs", "入力の具体性", "Specificity of inputs", "入力", "Inputs", "Assess whether commands, values, and target objects are specified precisely enough for the task.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("guide_outcome", "結果の確認", "Checking the result", "結果確認", "Verification", "Assess whether the reader is told what observable result indicates success or failure.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("guide_recovery", "失敗時の対処", "Failure recovery", "復旧", "Recovery", "When likely failures matter, assess whether a remedy or way to undo the operation is given.",criteria("Relevant common failure handling or rollback is provided.",C.absent,C.wrong,C.na)),
    item("guide_side_effects", "副作用・危険", "Side effects and hazards", "副作用", "Side effects", "Assess whether important deletion, cost, permission, or safety consequences are disclosed before the relevant action.",criteria("Material consequences are disclosed before the action.",C.absent,"The instructions conceal or materially misstate a clear significant consequence.",C.na)),
  ], conditionalProbes: [probe(item("guide_risky_action", "健康・身体安全への影響", "Health or physical safety impact", "副作用", "Side effects", "Assess whether health or physical safety risks and the precautions needed before the operation are stated.",criteria("Material risks and relevant precautions are stated before the operation.",C.absent,C.wrong,C.na)), "Does a described operation create a material safety risk?", "Activate only when the described operation creates a material health or physical safety risk." )] },
  experience_review: { label: { ja: "体験・レビュー", en: "Experience and review" }, items: [
    item("experience_review_use", "使用の実体", "Actual use", "使用実体", "Actual use", "Assess whether the author says what they used or experienced and the scope of that use.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("experience_review_conditions", "評価条件", "Evaluation conditions", "評価条件", "Conditions", "Assess whether relevant duration, environment, settings, and comparison conditions are stated.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("experience_review_observation", "観察の具体性", "Specific observations", "観察", "Observations", "Assess whether central evaluations are grounded in measurements or concrete use situations.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("experience_review_scope", "結果の節度", "Proportionate conclusions", "結果の節度", "Scope of conclusion", "Assess whether observation, preference, and inference are distinguished and an individual result is not generalized without basis.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("experience_review_limits", "欠点と適用範囲", "Drawbacks and fit", "欠点・適用範囲", "Drawbacks and scope", "Assess whether important limitations and unsuitable use cases are identified.",criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("experience_review_incentive_benchmark", "ベンチマーク結果", "Benchmark result", "利害・測定", "Disclosure and measurement", "Assess whether the benchmark method and tested conditions are stated well enough to interpret the result.",criteria("The benchmark method and relevant test conditions are described.",C.absent,C.wrong,C.na)), "Does the body report a benchmark result?", "Activate only when the body reports benchmark measurements." )] },
  sales: { label: { ja: "販売・勧誘", en: "Sales and persuasion" }, items: [
    item("sales_offer_cost", "提供内容と負担", "Offer and cost", "提供・費用", "Offer and cost", "Assess whether the reader can understand what is offered and the price, donation, or recurring cost.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("sales_terms", "参加・契約条件", "Participation and contract terms", "契約条件", "Terms", "Where applicable, assess whether eligibility, duration, renewal, cancellation, and refund conditions are stated.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("sales_claims", "効能・優位性の根拠", "Support for benefits and superiority", "効果の根拠", "Claim support", "Assess whether material claims about outcomes or comparisons have cues appropriate to the kind of claim.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("sales_risks", "制約とリスク", "Limits and risks", "制約・リスク", "Limits and risks", "Assess whether conditions for no result, exclusions, and material side effects are disclosed rather than hidden.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("sales_testimonials", "推薦・体験談の位置づけ", "Status of endorsements and testimonials", "推薦・体験談", "Testimonials", "Assess whether endorser relationships and exceptional experiences are distinguished from typical outcomes.",criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("sales_pressure_claims", "自動更新", "Automatic renewal", "総負担・主張", "Total cost and claims", "Assess whether renewal timing, cancellation steps, and recurring charges are disclosed.",criteria("Renewal timing, cancellation, and recurring charges are clearly stated.",C.absent,C.wrong,C.na)), "Does the offer renew automatically?", "Activate only when the body describes automatic renewal or recurring charges." )] },
  reference: { label: { ja: "資料・参照", en: "Reference material" }, items: [
    item("reference_scope", "適用範囲と版", "Scope and version", "範囲・版", "Scope and version", "Assess whether the intended subject, user, time, and version of the reference are identifiable.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("reference_definitions", "定義と単位", "Definitions and units", "定義・単位", "Definitions", "Assess whether item names, meanings, and units are unambiguous.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("reference_boundaries", "必要な項目と境界", "Required fields and boundaries", "項目・境界", "Fields and limits", "Assess whether values needed for use, defaults, limits, and exceptions are included.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("reference_provenance", "出所と更新", "Provenance and updates", "出所・更新", "Provenance", "Assess whether borrowed figures or specifications and revision information can be traced.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("reference_examples", "例と本文の整合", "Consistency of examples", "例の整合", "Example consistency", "Assess whether examples, tables, and prose use the same definitions.",criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("reference_deprecation", "複数バージョン", "Multiple versions", "差分・移行", "Differences and migration", "Assess whether differences between documented versions and applicable migration conditions are stated.",criteria("Version differences and any relevant migration conditions are stated.",C.absent,C.wrong,C.na)), "Does the reference document multiple versions?", "Activate only when the body distinguishes more than one version." )] },
  discussion: { label: { ja: "投稿・議論", en: "Posts and discussion" }, items: [
    item("discussion_attribution", "発言の帰属", "Attribution of contributions", "発言者", "Attribution", "Assess whether questions, answers, quotations, and edits can be attributed to their speakers.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("discussion_context", "問いの文脈", "Context of the question", "問いの文脈", "Question context", "Assess whether the question's assumptions, environment, and intent can be understood.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("discussion_reasoning", "回答の理由", "Reasoning in answers", "回答理由", "Reasoning", "Assess whether conclusions include an explanation, example, or reproducible steps as appropriate.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("discussion_sources", "事実主張の出所", "Sources for factual claims", "事実の出所", "Factual sources", "Assess whether external figures, rules, or events are sourced and distinguished from personal experience.",criteria(C.required,C.absent,C.wrong,C.na)),
    item("discussion_status", "解決状況と時点", "Resolution and timing", "解決・時点", "Status and time", "Assess whether disagreement, unresolved points, and version dependence can be seen; do not treat acceptance as proof of truth.",criteria(C.required,C.absent,C.wrong,C.na)),
  ], conditionalProbes: [probe(item("discussion_conflict_stale", "相反する回答", "Conflicting answers", "未解決・適用範囲", "Open issues and scope", "Assess whether the disagreement between answers and any unresolved point are made visible.",criteria("The competing answers and unresolved point are represented clearly.",C.absent,C.wrong,C.na)), "Does the discussion contain conflicting answers?", "Activate only when the body presents materially different answers to the same question." )] },
  creative: { label: { ja: "創作・風刺", en: "Fiction and satire" }, items: [
    item("creative_context", "創作の文脈", "Creative context", "創作の文脈", "Creative context", "Assess whether title, genre, style, or placement lets a reader understand the work as fiction or satire; an explicit label is not required.",criteria("The surrounding presentation provides a reasonable creative context.",C.absent,"The presentation materially encourages reading invented events as literal reporting.",C.na)),
    item("creative_reality_boundary", "現実との境界", "Boundary with reality", "現実との境界", "Reality boundary", "If real people or events appear, assess whether fictional depiction is distinguishable from factual claims about them.",criteria("Depiction and factual claims are distinguishable.",C.absent,"Fictional depiction is materially presented as an external fact.",C.na)),
    item("creative_satire_quote", "風刺・引用の境界", "Satire and quotation boundary", "風刺・引用", "Satire and quotation", "Assess whether the target of satire or quoted material could reasonably be mistaken for the subject's own factual statement.",criteria("The satire or quotation boundary is reasonably clear.",C.absent,"The presentation materially attributes satirical or quoted words as the subject's factual statement.",C.na)),
    item("creative_real_world_action", "現実の行動への誘導", "Calls to real-world action", "現実の誘導", "Real-world calls", "Identify important claims outside the fictional work that promote purchase, voting, or an efficacy claim; those claims require assessment under their corresponding content category.",criteria("No applicable extra-fiction claim is left unassessed; this criterion itself does not judge the work's fictional world.",C.absent,"A material real-world claim is clearly misleading; assess its specific substance with the corresponding category as well.",C.na)),
  ], conditionalProbes: [probe(item("creative_real_world_claim", "実在人物の描写", "Depiction of a real person", "現実主張の境界", "Boundary of real claims", "Assess whether fictional depiction of a real person is distinguishable from factual claims about that person.",criteria("The fictional depiction is distinguishable from factual claims about the real person.",C.absent,"The fictional depiction is materially presented as a factual claim about the real person.",C.na)), "Does the work portray a real person as part of its story?", "Activate only when the body depicts an identifiable real person within the creative work." )] },
};

function extraProbe(category: ContentCategoryId, anchorId: string, id: string, ja: string, en: string, instruction: string, triggerQuestion: string, triggerInstruction: string): ConditionalProbe {
  const anchor = CATEGORY_RUBRIC_BASE[category].items.find((entry) => entry.id === anchorId);
  if (!anchor) throw new Error(`Missing axis anchor ${anchorId}`);
  return probe(item(id, ja, en, anchor.axisLabel.ja, anchor.axisLabel.en, instruction, criteria(
    "The page provides the feature-specific evidence described in this criterion.",
    C.absent,
    C.wrong,
    C.na,
  )), triggerQuestion, triggerInstruction);
}

const EXTRA_PROBES: Readonly<Record<ContentCategoryId, readonly ConditionalProbe[]>> = {
  reporting: [
    extraProbe("reporting", "reporting_uncertainty", "reporting_serious_allegation", "重大な申し立て", "Serious allegation", "Assess whether the subject's response is represented and the allegation is clearly attributed.", "Does the body make a serious allegation about an identifiable subject?", "Activate only for a serious allegation stated in the body."),
    extraProbe("reporting", "reporting_context", "reporting_numeric_conclusion", "数値による結論", "Numerical conclusion", "Assess whether the basis, comparison point, and reference date for the numerical conclusion are stated.", "Does the body draw a conclusion from a numerical comparison?", "Activate only when a numerical comparison supports a conclusion."),
  ],
  announcement: [
    extraProbe("announcement", "announcement_metrics", "announcement_provider_comparison", "他社比較", "Provider comparison", "Assess whether the comparison basis, scope, and conditions are stated.", "Does the announcement compare its offering with another provider?", "Activate only for a comparison with another provider in the body."),
    extraProbe("announcement", "announcement_third_party", "announcement_external_endorsement", "外部推薦", "External endorsement", "Assess whether the endorser's identity and relationship to the announcing party are disclosed.", "Does the announcement include an outside endorsement?", "Activate only when an outside endorsement appears in the body."),
  ],
  explanation: [
    extraProbe("explanation", "explanation_inference", "explanation_forecast", "予測", "Forecast", "Assess whether the forecast's assumptions and uncertainty are stated.", "Does the explanation predict a future outcome?", "Activate only for an explicit forecast in the body."),
    extraProbe("explanation", "explanation_fit", "explanation_group_comparison", "集団比較", "Group comparison", "Assess whether the compared groups are sufficiently comparable for the stated inference.", "Does the explanation compare different groups?", "Activate only when the body compares groups."),
    extraProbe("explanation", "explanation_fit", "explanation_period_comparison", "期間比較", "Period comparison", "Assess whether the compared periods are sufficiently comparable for the stated inference.", "Does the explanation compare different time periods?", "Activate only when the body compares time periods."),
  ],
  opinion: [
    extraProbe("opinion", "opinion_hypothesis", "opinion_policy_causality", "政策・行動の因果効果", "Policy or action causal effect", "Assess whether the claimed causal effect is supported as a result or clearly labeled as an untested hypothesis, with assumptions identified.", "Does the proposal claim that a stated intervention causes an effect?", "Activate only for a causal effect claim in the body."),
  ],
  investigation: [
    extraProbe("investigation", "investigation_analysis", "investigation_causal_effect", "因果効果", "Causal effect", "Assess whether the design addresses plausible confounding and limits the causal conclusion to what the described method can support.", "Does the investigation claim that one factor caused an outcome?", "Activate only for an explicit causal conclusion in the body."),
    extraProbe("investigation", "investigation_data", "investigation_restricted_data", "非公開データ", "Restricted data", "Assess whether access restrictions and their effect on checking or reproducing the result are explained.", "Does the investigation rely on data readers cannot access?", "Activate only when the body indicates that relied-on data are unavailable to readers."),
    extraProbe("investigation", "investigation_sample", "investigation_special_exclusions", "特殊な除外", "Special exclusions", "Assess whether unusual exclusion rules are stated with their rationale and likely effect on the findings.", "Does the method exclude cases using a non-routine rule?", "Activate only for an unusual exclusion rule described in the body."),
  ],
  guide: [
    extraProbe("guide", "guide_side_effects", "guide_data_deletion", "データ削除", "Data deletion", "Assess whether the target, consequences, and recovery limitations of the deletion are stated before the step.", "Do the instructions delete data or files?", "Activate only when a described step deletes data or files."),
    extraProbe("guide", "guide_side_effects", "guide_payment", "支払い", "Payment", "Assess whether the amount, timing, and recurring nature of required payment are stated before the step.", "Do the instructions require a payment?", "Activate only when following a described step requires payment."),
    extraProbe("guide", "guide_side_effects", "guide_permission_change", "権限変更", "Permission change", "Assess whether the permission being granted or changed and its scope are stated before the step.", "Do the instructions change account or system permissions?", "Activate only when a described step changes permissions."),
  ],
  experience_review: [
    extraProbe("experience_review", "experience_review_conditions", "experience_review_free_product", "提供品", "Provided product", "Assess whether receipt of a free or discounted product is disclosed.", "Does the reviewer say the product was provided free or at a discount?", "Activate only when the body indicates a provided product."),
    extraProbe("experience_review", "experience_review_conditions", "experience_review_compensation", "報酬", "Compensation", "Assess whether compensation for the review is disclosed.", "Does the reviewer say they received compensation for the review?", "Activate only when the body indicates review compensation."),
    extraProbe("experience_review", "experience_review_conditions", "experience_review_referral_fee", "紹介料", "Referral fee", "Assess whether a commission or referral fee tied to reader actions is disclosed.", "Does the review mention a referral commission or fee?", "Activate only when the body indicates a referral fee or commission."),
    extraProbe("experience_review", "experience_review_observation", "experience_review_performance_difference", "大きな性能差", "Large performance difference", "Assess whether the measurement method and tested conditions explain the reported performance difference.", "Does the review claim a substantial performance difference?", "Activate only for a material performance-difference claim in the body."),
  ],
  sales: [
    extraProbe("sales", "sales_claims", "sales_health_finance_claim", "健康・金銭効果", "Health or financial outcome", "Assess whether evidence and limitations are stated at a level appropriate to the health or financial outcome claim.", "Does the offer claim a health or financial outcome?", "Activate only for a health or financial benefit claim in the body."),
    extraProbe("sales", "sales_terms", "sales_scarcity_claim", "期限・残数の限定", "Deadline or scarcity", "Assess whether the stated deadline or quantity limit has a clear basis and is not presented as artificial urgency.", "Does the offer claim a deadline or limited remaining quantity?", "Activate only for a deadline or scarcity claim in the body."),
    extraProbe("sales", "sales_testimonials", "sales_endorsement", "推薦文", "Endorsement", "Assess whether the endorser's relationship and any material incentive are disclosed.", "Does the offer use an endorsement or testimonial?", "Activate only when an endorsement or testimonial is used in the body."),
  ],
  reference: [
    extraProbe("reference", "reference_scope", "reference_deprecation_notice", "廃止予定", "Deprecation notice", "Assess whether the affected feature, date, and successor or migration direction are stated.", "Does the reference say a feature or version will be discontinued?", "Activate only for a deprecation statement in the body."),
    extraProbe("reference", "reference_definitions", "reference_unit_variants", "単位の違い", "Unit variants", "Assess whether unit differences and any required conversion are stated.", "Does the reference document multiple units for the same quantity?", "Activate only when multiple units are shown for the same quantity."),
    extraProbe("reference", "reference_scope", "reference_region_variants", "地域別適用", "Regional variants", "Assess whether applicable regions and differences between them are stated.", "Does the reference distinguish rules or specifications by region?", "Activate only when the body distinguishes regional variants."),
  ],
  discussion: [
    extraProbe("discussion", "discussion_status", "discussion_accepted_answer_old", "古い承認済み回答", "Old accepted answer", "Assess whether the accepted answer's date and current-environment applicability are apparent; acceptance alone does not establish correctness.", "Is an accepted answer visibly old relative to the discussion context?", "Activate only when an accepted answer appears old or potentially outdated."),
    extraProbe("discussion", "discussion_status", "discussion_version_dependent", "版依存の解決策", "Version-dependent solution", "Assess whether the version or environment required for the solution is stated.", "Does a proposed solution depend on a particular software version?", "Activate only when the body indicates version dependence."),
  ],
  creative: [
    extraProbe("creative", "creative_reality_boundary", "creative_real_event", "実在の出来事", "Real event", "Assess whether fictional depiction of a real event is distinguishable from factual reporting about it.", "Does the creative work depict an identifiable real event?", "Activate only when the body depicts a real-world event."),
    extraProbe("creative", "creative_real_world_action", "creative_purchase_call", "作品外の購入誘導", "Extra-fiction purchase call", "Assess whether the purchase offer is clearly outside the fictional narrative and evaluate its material claims under the sales category.", "Does the page urge readers to buy something outside the fictional work?", "Activate only for a real-world purchase call outside the work itself."),
    extraProbe("creative", "creative_real_world_action", "creative_voting_call", "作品外の投票誘導", "Extra-fiction voting call", "Assess whether the call is clearly outside the fictional narrative and evaluate its real-world factual claims under the relevant category.", "Does the page urge readers to vote outside the fictional work?", "Activate only for a real-world voting call outside the work itself."),
    extraProbe("creative", "creative_real_world_action", "creative_efficacy_claim", "作品外の効能主張", "Extra-fiction efficacy claim", "Assess the efficacy claim's evidence and limitations under its relevant category, not as part of the fictional world.", "Does the page claim a real-world effect outside the fictional work?", "Activate only for a real-world efficacy claim outside the work itself."),
  ],
};

export const CATEGORY_RUBRICS = Object.fromEntries(
  CONTENT_CATEGORY_IDS.map((id) => [id, {
    ...CATEGORY_RUBRIC_BASE[id],
    purpose: CATEGORY_PURPOSE[id],
    conditionalProbes: [...CATEGORY_RUBRIC_BASE[id].conditionalProbes, ...EXTRA_PROBES[id]],
  }]),
) as unknown as Readonly<Record<ContentCategoryId, CategoryRubric>>;

export function categoryChoiceDescriptions(): Record<string, string> {
  return Object.fromEntries(CONTENT_CATEGORY_IDS.map((id) => {
    const rubric = CATEGORY_RUBRICS[id];
    return [id, `${rubric.label.en}. ${rubric.purpose.en}`];
  }));
}

export function getCategoryRubric(id: ContentCategoryId): CategoryRubric { return CATEGORY_RUBRICS[id]; }

/** Verdict item or its cite question. Trigger ids stay unmatched so routing questions keep their own label. */
export function rubricEntry(id: string): CategoryRubricItem | undefined {
  for (const rubric of Object.values(CATEGORY_RUBRICS)) {
    const entry = [...rubric.items, ...rubric.conditionalProbes].find((item) => item.id === id || `${item.id}_cite` === id);
    if (entry !== undefined) return entry;
  }
  return undefined;
}

/** Localized axes, in stable first-seen order; every individual item remains in items. */
export function categoryAxisLabels(id: ContentCategoryId): ReadonlyArray<{ key: string; label: BilingualLabel }> {
  const seen = new Set<string>();
  return [...CATEGORY_RUBRICS[id].items, ...CATEGORY_RUBRICS[id].conditionalProbes]
    .filter((entry) => !seen.has(entry.axisKey) && Boolean(seen.add(entry.axisKey)))
    .map(({ axisKey, axisLabel }) => ({ key: axisKey, label: axisLabel }));
}
