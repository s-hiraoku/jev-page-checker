import { useLayoutEffect, useRef, useState } from "react";
import type { Check } from "../lib/checkkit.js";
import { unknownErrorMessage } from "../lib/errors.js";
import { parseLocale, parseTheme, type ExtensionSettings } from "../lib/settings.js";
import { ChecklistView } from "./ChecklistView.js";
import { LocaleProvider, useCopy, useResolvedLocale } from "./useLocale.js";
import { useTheme } from "./useTheme.js";

interface Props {
  settings: ExtensionSettings;
  questions: readonly Check[];
  definitionVersion: number;
  onSave: (settings: ExtensionSettings) => Promise<void>;
}

export function SettingsForm({ settings, questions, definitionVersion, onSave }: Props) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [approvalWarning, setApprovalWarning] = useState(false);
  const approved = draft.ackedVersion === definitionVersion;
  useTheme(draft.theme);
  const locale = useResolvedLocale(draft.locale);

  const update = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <LocaleProvider locale={locale}>
      <SettingsFields
        draft={draft}
        approved={approved}
        busy={busy}
        message={message}
        approvalWarning={approvalWarning}
        questions={questions}
        definitionVersion={definitionVersion}
        update={update}
        onDismissWarning={() => setApprovalWarning(false)}
        onSubmit={() => {
          setBusy(true);
          setMessage(null);
          const missingApproval = draft.ackedVersion !== definitionVersion;
          void onSave(draft)
            .then(() => {
              setMessage("saved");
              setApprovalWarning(missingApproval);
            })
            .catch((error: unknown) => {
              setMessage(unknownErrorMessage(error));
              setApprovalWarning(false);
            })
            .finally(() => setBusy(false));
        }}
      />
    </LocaleProvider>
  );
}

function SettingsFields({
  draft,
  approved,
  busy,
  message,
  approvalWarning,
  questions,
  definitionVersion,
  update,
  onDismissWarning,
  onSubmit,
}: {
  draft: ExtensionSettings;
  approved: boolean;
  busy: boolean;
  message: string | null;
  approvalWarning: boolean;
  questions: readonly Check[];
  definitionVersion: number;
  update: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onDismissWarning: () => void;
  onSubmit: () => void;
}) {
  const copy = useCopy();
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <header className="settings-intro">
        <h1 className="page-title stamp">{copy.settings}</h1>
        <p className="lede">{copy.settingsIntro}</p>
        <p className="help">{copy.keyHelp}</p>
      </header>

      <div className="settings-grid">
        <fieldset className="fieldset settings-card">
          <legend>{copy.connection}</legend>
          <p className="settings-card-help">{copy.connectionHelp}</p>
          <label className="field">
            <span>{copy.apiKey}</span>
            <input
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              onChange={(event) => update("apiKey", event.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="fieldset settings-card">
          <legend>{copy.appearance}</legend>
          <label className="field">
            <span>{copy.theme}</span>
            <select
              aria-label={copy.theme}
              value={draft.theme}
              onChange={(event) => update("theme", parseTheme(event.target.value))}
            >
              <option value="system">{copy.themeSystem}</option>
              <option value="light">{copy.themeLight}</option>
              <option value="dark">{copy.themeDark}</option>
            </select>
            <small>{copy.themeHelp}</small>
          </label>
          <label className="field">
            <span>{copy.locale}</span>
            <select
              aria-label={copy.locale}
              value={draft.locale}
              onChange={(event) => update("locale", parseLocale(event.target.value))}
            >
              <option value="system">{copy.localeSystem}</option>
              <option value="ja">日本語</option>
              <option value="en">English</option>
            </select>
            <small>{copy.localeHelp}</small>
          </label>
        </fieldset>

        <fieldset className="fieldset settings-card settings-behavior">
          <legend>{copy.behavior}</legend>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={draft.checkOnlyWhenSidebarOpens}
              onChange={(event) => update("checkOnlyWhenSidebarOpens", event.target.checked)}
            />
            <span><strong>{copy.checkOnlyWhenSidebarOpens}</strong><small>{copy.checkOnlyWhenSidebarOpensHelp}</small></span>
          </label>
          <label className="setting-toggle">
            <input type="checkbox" checked={draft.followTab} onChange={(event) => update("followTab", event.target.checked)} />
            <span><strong>{copy.followTab}</strong><small>{copy.followTabHelp}</small></span>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={draft.recheckOnChange}
              onChange={(event) => update("recheckOnChange", event.target.checked)}
            />
            <span><strong>{copy.recheckOnChange}</strong><small>{copy.recheckOnChangeHelp}</small></span>
          </label>
          <div className="settings-number-grid">
            <label className="field">
              <span>{copy.debounceMs}</span>
              <input type="number" min={250} max={15000} step={250} value={draft.debounceMs} onChange={(event) => update("debounceMs", Number(event.target.value))} />
              <small>{copy.debounceHelp}</small>
            </label>
            <label className="field">
              <span>{copy.minWords}</span>
              <input type="number" min={10} max={400} value={draft.minWords} onChange={(event) => update("minWords", Number(event.target.value))} />
              <small>{copy.minWordsHelp}</small>
            </label>
          </div>
          <details className="settings-limits">
            <summary>{copy.jevLimitsTitle}</summary>
            <p className="help">{copy.jevBudgetHelp}</p>
          </details>
        </fieldset>
      </div>

      <ChecklistView
        questions={questions}
        afterHeading={
          <>
            <section className="settings-approval">
              <div>
                <h2>{copy.approvalTitle}</h2>
                <p className="help">{copy.approvalHelp}</p>
              </div>
              <label className="setting-toggle approval-toggle">
                <input type="checkbox" checked={approved} onChange={(event) => update("ackedVersion", event.target.checked ? definitionVersion : null)} />
                <span><strong>{copy.ackLabel}</strong></span>
              </label>
            </section>
            {approvalWarning ? <ApprovalWarningDialog onClose={onDismissWarning} /> : null}
          </>
        }
      />

      <div className="toolbar settings-toolbar">
        <button className="btn" type="submit" disabled={busy}>
          {copy.save}
        </button>
        {message ? <p className="help" role="status" aria-live="polite">{message === "saved" ? copy.saved : message}</p> : null}
      </div>
    </form>
  );
}

function ApprovalWarningDialog({ onClose }: { onClose: () => void }) {
  const copy = useCopy();
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="approval-warning"
      aria-labelledby="approval-warning-text"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <p id="approval-warning-text">{copy.approvalUncheckedWarning}</p>
      <button type="button" className="btn" onClick={onClose}>
        {copy.dismiss}
      </button>
    </dialog>
  );
}
