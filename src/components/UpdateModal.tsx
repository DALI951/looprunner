import React, { useState } from 'react';
import { checkForAppUpdates, UpdateInfo, APP_VERSION } from '../services/updater';
import { storage } from '../services/storage';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const settings = storage.getSettings();
  const [repoInput, setRepoInput] = useState<string>(settings.githubRepo || '');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  if (!isOpen) return null;

  const handleCheck = async () => {
    setIsLoading(true);
    storage.saveSettings({ githubRepo: repoInput.trim() });
    const info = await checkForAppUpdates(repoInput.trim());
    setUpdateInfo(info);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">App Updates & Releases</h2>
              <p className="text-[11px] text-slate-400">Current Version: v{APP_VERSION}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GitHub Repo Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">
            GitHub Repository (owner/repo)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. username/looprunner"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              onClick={handleCheck}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Check</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Every commit pushed to GitHub automatically triggers a GitHub Actions APK build.
          </p>
        </div>

        {/* Results Card */}
        {updateInfo && (
          <div className="rounded-2xl border p-4 text-xs space-y-2.5 bg-slate-950/70 border-slate-800">
            {updateInfo.hasUpdate ? (
              <>
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Update Available: {updateInfo.latestVersion}</span>
                </div>
                <p className="text-slate-300 whitespace-pre-line text-[11px] max-h-28 overflow-y-auto bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                  {updateInfo.releaseNotes}
                </p>
                {updateInfo.apkDownloadUrl && (
                  <a
                    href={updateInfo.apkDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download APK ({updateInfo.latestVersion})</span>
                  </a>
                )}
              </>
            ) : updateInfo.error ? (
              <div className="flex items-start gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">{updateInfo.error}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sky-400 font-medium">
                <CheckCircle className="w-4 h-4" />
                <span>You are on the latest version (v{APP_VERSION}).</span>
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
