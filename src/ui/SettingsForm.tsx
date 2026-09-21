import { useState } from "react";
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
        questions={questions}
        definitionVersion={definitionVersion}
        update={update}
        onSubmit={() => {
          setBusy(true);
          setMessage(null);
          void onSave(draft)
            .then(() => setMessage("Saved."))
            .catch((error: unknown) => setMessage(unknownErrorMessage(error)))
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
  questions,
  definitionVersion,
  update,
  onSubmit,
}: {
  draft: ExtensionSettings;
  approved: boolean;
  busy: boolean;
  message: string | null;
  questions: readonly Check[];
  definitionVersion: number;
  update: <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => void;
  onSubmit: () => void;
}) {
  const copy = useCopy();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <p className="help">{copy.keyHelp}</p>

      <fieldset className="fieldset">
        <legend>{copy.connection}</legend>
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

      <fieldset className="fieldset">
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
        </label>
        <p className="help">{copy.themeHelp}</p>
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
        </label>
        <p className="help">{copy.localeHelp}</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>{copy.behavior}</legend>
        <label className="toggle">
          <input type="checkbox" checked={draft.followTab} onChange={(event) => update("followTab", event.target.checked)} />
          Follow tab
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.recheckOnChange}
            onChange={(event) => update("recheckOnChange", event.target.checked)}
          />
          {copy.recheckOnChange}
        </label>
        <label className="field">
          <span>{copy.debounceMs}</span>
          <input
            type="number"
            value={draft.debounceMs}
            onChange={(event) => update("debounceMs", Number(event.target.value))}
          />
        </label>
        <p className="help">{copy.jevBudgetHelp}</p>
        <label className="field">
          <span>{copy.minWords}</span>
          <input type="number" value={draft.minWords} onChange={(event) => update("minWords", Number(event.target.value))} />
        </label>
      </fieldset>

      <ChecklistView questions={questions} />

      <label className="toggle">
        <input
          type="checkbox"
          checked={approved}
          onChange={(event) => update("ackedVersion", event.target.checked ? definitionVersion : null)}
        />
        {copy.ackLabel}
      </label>

      <div className="toolbar">
        <button className="btn" type="submit" disabled={busy}>
          Save
        </button>
        {message ? <p className="help">{message}</p> : null}
      </div>
    </form>
  );
}
