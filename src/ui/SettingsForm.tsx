import { useState } from "react";
import type { Check } from "../lib/checkkit.js";
import type { ExtensionSettings } from "../lib/settings.js";
import { ChecklistView } from "./ChecklistView.js";

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
  const approved = draft.approver.trim() !== "" && draft.ackedVersion === definitionVersion;

  const update = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setMessage(null);
        void onSave(draft)
          .then(() => setMessage("Saved."))
          .catch((error: unknown) => setMessage(error instanceof Error ? error.message : String(error)))
          .finally(() => setBusy(false));
      }}
    >
      <p className="help">キーは端末内だけ。Jev への問い合わせ以外には使わない。ログにも出さない。</p>

      <fieldset className="fieldset">
        <legend>接続</legend>
        <label className="field">
          <span>TypeSafe API キー</span>
          <input
            type="password"
            autoComplete="off"
            value={draft.apiKey}
            onChange={(event) => update("apiKey", event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="fieldset">
        <legend>動作</legend>
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
          本文が変わったらやり直す
        </label>
        <label className="field">
          <span>やり直しまでの待ち（ミリ秒）</span>
          <input
            type="number"
            value={draft.debounceMs}
            onChange={(event) => update("debounceMs", Number(event.target.value))}
          />
        </label>
        <p className="help">
          Jev の入力枠は state と最長の質問で 32k トークン、1 リクエスト 64k（公式 Models）。収まる主本文は 1 回で送り、超えたら重ねて分割する。URL ごとに変えない。
        </p>
        <label className="field">
          <span>本文とみなす最小語数</span>
          <input type="number" value={draft.minWords} onChange={(event) => update("minWords", Number(event.target.value))} />
        </label>
      </fieldset>

      <ChecklistView questions={questions} />

      <fieldset className="fieldset">
        <legend>承認</legend>
        <label className="field">
          <span>承認者の名前</span>
          <input value={draft.approver} onChange={(event) => update("approver", event.target.value)} />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={approved}
            onChange={(event) => update("ackedVersion", event.target.checked ? definitionVersion : null)}
          />
          上のチェックリスト全体を承認する。判定は根拠であり、公開・送信・遮断の許可ではない。
        </label>
      </fieldset>

      <div className="toolbar">
        <button className="btn" type="submit" disabled={busy}>
          Save
        </button>
        {message ? <p className="help">{message}</p> : null}
      </div>
    </form>
  );
}
