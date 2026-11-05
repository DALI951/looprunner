import React, { useState, useEffect } from 'react';
import { checkForAppUpdates, UpdateInfo, APP_VERSION } from '../services/updater';
import { storage } from '../services/storage';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ExternalLink, GitBranch } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const settings = storage.getSettings();
  const [repoInput, setRepoInput] = useState<string>(settings.githubRepo || 'DALI951/looprunner');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheck = async () => {
    setIsLoading(true);
    const targetRepo = repoInput.trim() || 'DALI951/looprunner';
    storage.saveSettings({ githubRepo: targetRepo });
    const info = await checkForAppUpdates(targetRepo);
    setUpdateInfo(info);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                In-App APK Updates
                <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded-full border border-sky-800">
                  v{APP_VERSION}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Direct GitHub Releases & CI/CD Builder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* GitHub Repository Bar */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-sky-400" />
            GitHub Repository
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              placeholder="e.g. DALI951/looprunner"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
            <button
              onClick={handleCheck}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Checking...' : 'Check'}</span>
            </button>
          </div>
        </div>

        {/* Status / Results Card */}
        <div className="rounded-2xl border p-4 text-xs space-y-3 bg-slate-950/70 border-slate-800">
          {updateInfo ? (
            <>
              {updateInfo.hasUpdate ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle className="w-4 h-4" />
                    <span>New Version Ready: {updateInfo.latestVersion}</span>
                  </div>
                  <p className="text-slate-300 whitespace-pre-line text-[11px] max-h-28 overflow-y-auto bg-slate-900 p-2.5 rounded-xl border border-slate-800 font-sans">
                    {updateInfo.releaseNotes}
                  </p>
                  {updateInfo.apkDownloadUrl && (
                    <a
                      href={updateInfo.apkDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download APK ({updateInfo.latestVersion})</span>
                    </a>
                  )}
                </>
              ) : updateInfo.error ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed">{updateInfo.error}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The GitHub Actions build workflow compiles your APK on GitHub on every push. You can watch the live APK build progress below:
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sky-400 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  <span>You are on the latest version (v{APP_VERSION}).</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-4 text-slate-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-sky-400" />
              Connecting to GitHub Releases...
            </div>
          )}

          {/* Quick Action Links */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <a
              href="https://github.com/DALI951/looprunner/actions"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
            >
              <span>View GitHub Actions Build</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href="https://github.com/DALI951/looprunner/releases"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              <span>Releases Page</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Close Button */}
        <div>
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
