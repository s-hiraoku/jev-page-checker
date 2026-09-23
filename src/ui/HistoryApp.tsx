import type { Bridge } from "../lib/bridge.js";
import { CATEGORY_RUBRICS, type ContentCategoryId } from "../lib/category-rubrics.js";
import { formatCheckedAt } from "../lib/format.js";
import type { StoredRecord } from "../lib/session.js";
import { worstVerdict } from "../lib/groups.js";
import { AppChrome } from "./AppChrome.js";
import { VerdictChip } from "./bits.js";
import { useBridgeSession } from "./useBridgeSession.js";
import { useCopy, useLocale } from "./useLocale.js";

export function HistoryApp({ bridge }: { bridge: Bridge }) {
  const { session, error } = useBridgeSession(bridge);
  const theme = session?.settings.theme;
  const locale = session?.settings.locale;

  if (session === null) {
    return (
      <AppChrome wide theme={theme} locale={locale}>
        <LoadingCopy fallback={error} />
      </AppChrome>
    );
  }

  return (
    <AppChrome wide meta={`v${session.definitionVersion}`} theme={theme} locale={locale}>
      <HistoryBody
        history={session.history}
        onOpen={(id) => void bridge.openDetails(id)}
        onDelete={(id) => void bridge.deleteHistory(id)}
      />
    </AppChrome>
  );
}

function classificationLabel(
  item: StoredRecord,
  review: string,
  notApplicable: string,
  locale: "ja" | "en",
): string {
  const classification = item.report.classification;
  if (classification?.status === "not_applicable") return notApplicable;
  if (classification?.status === "review" || classification?.primary === undefined) return review;
  return CATEGORY_RUBRICS[classification.primary as ContentCategoryId]?.label[locale] ?? classification.primary;
}

function LoadingCopy({ fallback }: { fallback: string | null }) {
  const copy = useCopy();
  return fallback ?? copy.loading;
}

function HistoryBody({
  history,
  onOpen,
  onDelete,
}: {
  history: StoredRecord[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const copy = useCopy();
  return (
    <>
      <h2 className="page-title stamp">{copy.history}</h2>
      <p className="help">{copy.historyHelp}</p>
      {history.length === 0 ? <p className="notice">{copy.historyEmpty}</p> : null}
      <div className="history">
        {history.map((item) => (
          <HistoryRow key={item.id} item={item} onOpen={onOpen} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
}

function HistoryRow({
  item,
  onOpen,
  onDelete,
}: {
  item: StoredRecord;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const copy = useCopy();
  const locale = useLocale();
  const siteIds = item.report.inspection?.siteQuestionIds ?? [];
  const bodyIds = item.report.inspection?.bodyQuestionIds ?? [];
  const showLanes = siteIds.length > 0 || bodyIds.length > 0;
  const title = item.snapshot.title || item.snapshot.hostname;
  return (
    <div className="history-row">
      <button type="button" className="history-open" aria-label={title} onClick={() => onOpen(item.id)}>
        <strong>{title}</strong>
        <div className="history-category">{copy.classificationTitle}: {classificationLabel(item, copy.classificationStatusReview, copy.classificationStatusNotApplicable, locale)}</div>
        <div className="history-time">
          {copy.checkedAt} {formatCheckedAt(item.createdAt, locale)}
        </div>
        {showLanes ? (
          <div className="history-lanes">
            <span className="history-lane">
              {copy.site} <VerdictChip verdict={worstVerdict(item.report.items, siteIds)} />
            </span>
            <span className="history-lane">
              {copy.body} <VerdictChip verdict={worstVerdict(item.report.items, bodyIds)} />
            </span>
          </div>
        ) : null}
        <div className="url">{item.snapshot.url}</div>
      </button>
      <button
        type="button"
        className="btn secondary history-delete"
        aria-label={`${copy.deleteRecord} ${title}`}
        onClick={() => onDelete(item.id)}
      >
        {copy.deleteRecord}
      </button>
    </div>
  );
}
