import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const FIRST_CHECK_MS = 5_000; // let the app start first
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const NOTICE_MS = 5_000;

/** The title bar's Updates button fires this on window to check right now. */
export const CHECK_UPDATE_EVENT = 'husk-check-update';

/** A strip under the title bar that appears when a newer HUSK is on GitHub. One click installs it and restarts. */
export const UpdateBanner: React.FC = () => {
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // null = not installing
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // answer to a manual check when there is no update

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    // The automatic check stays quiet; a check the user asked for always answers
    const check = (manual: boolean) => {
      if (manual) setNotice('Checking for updates…');
      return api
        .checkForUpdate()
        .then(async (update) => {
          if (update) {
            setVersion(update.version);
            setDismissed(false);
            setNotice('');
          } else if (manual) {
            setNotice(`HUSK ${await api.getAppVersion()} is the newest version.`);
          }
        })
        .catch(() => {
          // offline or GitHub is busy: the automatic check tries again later
          if (manual) setNotice('Could not check for updates. Check your internet connection.');
        });
    };
    const first = setTimeout(() => check(false), FIRST_CHECK_MS);
    const every = setInterval(() => check(false), CHECK_EVERY_MS);
    const onManual = () => check(true);
    window.addEventListener(CHECK_UPDATE_EVENT, onManual);
    const stopProgress = api.onUpdateProgress(setProgress);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      window.removeEventListener(CHECK_UPDATE_EVENT, onManual);
      stopProgress();
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.endsWith('…')) return;
    const timer = setTimeout(() => setNotice(''), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (notice && (!version || dismissed)) {
    return (
      <div className="no-print bg-[#1a1917] border-b border-[#26231f] px-4 py-1.5 flex items-center text-xs text-stone-300 select-none">
        {notice}
      </div>
    );
  }
  if (!version || dismissed) return null;

  const install = async () => {
    setError('');
    setProgress(0);
    const result = await window.electronAPI!.installUpdate();
    // On success the app quits, so this only runs after a failure
    if (!result.success) {
      setProgress(null);
      setError(result.error || 'The update failed.');
    }
  };

  const installing = progress !== null;

  return (
    <div className="no-print bg-[#FF4C00]/10 border-b border-[#FF4C00]/25 px-4 py-1.5 flex items-center gap-3 text-xs text-stone-200 select-none">
      <Download className="w-3.5 h-3.5 text-[#FF4C00] shrink-0" />
      <span className="min-w-0 truncate">
        {error ? (
          <span className="text-rose-300">{error}</span>
        ) : installing ? (
          `Downloading HUSK ${version}… ${Math.round(progress * 100)}%. HUSK restarts when it is done.`
        ) : (
          `HUSK ${version} is ready. Your documents are saved first and are not changed.`
        )}
      </span>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={install}
          disabled={installing}
          className="px-3 py-1 rounded-lg bg-[#FF4C00] hover:bg-[#DB5100] disabled:opacity-60 text-white font-semibold transition"
        >
          {error ? 'Try again' : 'Update & restart'}
        </button>
        {!installing && (
          <button
            onClick={() => setDismissed(true)}
            title="Not now"
            className="p-1 rounded text-stone-400 hover:text-white hover:bg-[#22201d] transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
