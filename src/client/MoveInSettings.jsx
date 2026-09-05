import React, { useMemo, useState } from 'react';

const CATEGORIES = ['instructions', 'skills', 'commands', 'agents', 'hooks', 'permissions', 'mcp'];

async function requestMovein(payload) {
  const response = await fetch('/dsh-movein/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error || `request failed with ${response.status}`);
  return result;
}

export function MoveInSettings({ t }) {
  const [project, setProject] = useState('');
  const [origin, setOrigin] = useState('claude');
  const [selected, setSelected] = useState(() => new Set(['skills']));
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const busy = phase === 'working';
  const include = useMemo(() => CATEGORIES.filter((id) => selected.has(id)), [selected]);
  const canApply = !busy && result?.ok && !result.applied;

  const resetPreview = () => {
    setResult(null);
    setError('');
  };

  const toggle = (id) => {
    resetPreview();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const run = async (apply) => {
    if (apply && !canApply) return;
    setPhase('working');
    resetPreview();
    try {
      const next = await requestMovein({ project, origin, apply, include });
      setResult(next);
      setPhase('ready');
    } catch (nextError) {
      setError(String(nextError?.message || nextError));
      setPhase('error');
    }
  };

  return (
    <section className="dmi-page">
      <header className="dmi-head">
        <p className="dmi-eyebrow">{t('eyebrow')}</p>
        <h2 className="dmi-title">{t('title')}</h2>
        <p className="dmi-intro">{t('intro')}</p>
      </header>

      <div className="dmi-block">
        <label className="dmi-label" htmlFor="dmi-project">{t('source')}</label>
        <input
          id="dmi-project"
          className="dmi-input"
          value={project}
          disabled={busy}
          onChange={(event) => { setProject(event.target.value); resetPreview(); }}
          placeholder="C:\\work\\project"
          spellCheck="false"
        />
        <p className="dmi-hint">{t('sourceHint')}</p>
      </div>

      <fieldset className="dmi-block" style={{ borderLeft: 0, borderRight: 0, borderTop: 0, margin: 0 }}>
        <legend className="dmi-legend">{t('categories')}</legend>
        <div className="dmi-grid">
          {CATEGORIES.map((id) => (
            <label className="dmi-choice" key={id}>
              <input type="checkbox" disabled={busy} checked={selected.has(id)} onChange={() => toggle(id)} />
              <span>{t(id)}</span>
            </label>
          ))}
        </div>
        <p className="dmi-hint">{t('firstTry')}</p>
      </fieldset>

      <details className="dmi-details">
        <summary>{t('otherOrigins')}</summary>
        <p className="dmi-hint">{t('originNote')}</p>
        <div className="dmi-origins">
          {['claude', 'codex', 'opencode'].map((id) => (
            <label className="dmi-origin" key={id}>
              <input type="radio" name="dmi-origin" disabled={busy} checked={origin === id} onChange={() => {
                setOrigin(id);
                setSelected(new Set(id === 'codex' ? ['instructions'] : ['skills']));
                resetPreview();
              }} />
              <span>{t(id)}</span>
            </label>
          ))}
        </div>
      </details>

      <div className="dmi-actions">
        <button className="dmi-button" type="button" disabled={busy || include.length === 0} onClick={() => run(false)}>
          {busy ? t('working') : t('preview')}
        </button>
        <button className="dmi-button dmi-primary" type="button" disabled={!canApply || include.length === 0} onClick={() => run(true)}>
          {t('apply')}
        </button>
        <span className="dmi-hint">{t('dryRun')}</span>
      </div>

      {error && <div className="dmi-error" role="alert">{error}</div>}

      {result && (
        <section className="dmi-result" aria-live="polite">
          <div className="dmi-resultHead">
            <h3>{result.ok ? result.applied ? t('resultApplied') : t('resultPreview') : t('resultBlocked')}</h3>
            <span className="dmi-status">{result.origin}</span>
          </div>
          <p className="dmi-project">{result.project}</p>
          {result.actions.length === 0
            ? <p className="dmi-hint">{t('noActions')}</p>
            : (
              <ul className="dmi-list">
                {result.actions.map((action, index) => (
                  <li className="dmi-row" data-status={action.status} key={`${action.label}-${index}`}>
                    <span className="dmi-status">{action.status}</span>
                    <div>
                      <div className="dmi-rowTitle">{action.label}</div>
                      <div className="dmi-rowNote">{action.note}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          {result.notices.length > 0 && (
            <div className="dmi-warning">
              <strong>{t('conflicts')}</strong>
              {result.notices.map((notice, index) => <div key={index}>{notice.message}</div>)}
            </div>
          )}
          <details className="dmi-report">
            <summary>{t('fullReport')}</summary>
            <pre>{result.report}</pre>
          </details>
          {result.ok && result.applied && result.actions.some((action) => action.status === 'done') && (
            <div className="dmi-block">
              <h3>{t('nextTitle')}</h3>
              <p className="dmi-hint">{t('nextSteps')}</p>
              <a href="https://github.com/sjh9714/dsh-movein/blob/main/docs/first-task.md" target="_blank" rel="noreferrer">
                {t('firstTask')}
              </a>
            </div>
          )}
          {result.starPrompt && (
            <a className="dmi-star" href="https://github.com/sjh9714/dsh-movein" target="_blank" rel="noreferrer">
              {t('star')}
            </a>
          )}
        </section>
      )}
    </section>
  );
}
