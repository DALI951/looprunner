import React, { useState, useEffect } from 'react';
import { checkForAppUpdates, downloadAndInstallInApp, UpdateInfo, APP_VERSION } from '../services/updater';
import { storage } from '../services/storage';
import { Download, RefreshCw, X, CheckCircle, AlertTriangle, ArrowDownCircle, Sparkles } from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({ isOpen, onClose }) => {
  const settings = storage.getSettings();
  const [repoInput, setRepoInput] = useState<string>(settings.githubRepo || 'DALI951/looprunner');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  // In-app download state (PinPulse style)
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadPercent, setDownloadPercent] = useState<number>(0);
  const [receivedBytes, setReceivedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      handleCheck();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheck = async () => {
    setIsLoading(true);
    setDownloadError(null);
    setIsComplete(false);
    const targetRepo = repoInput.trim() || 'DALI951/looprunner';
    storage.saveSettings({ githubRepo: targetRepo });
    const info = await checkForAppUpdates(targetRepo);
    setUpdateInfo(info);
    setIsLoading(false);
  };

  const handleStartInAppUpdate = async () => {
    if (!updateInfo?.apkDownloadUrl) return;
    setIsDownloading(true);
    setDownloadPercent(0);
    setDownloadError(null);

    try {
      await downloadAndInstallInApp(
        updateInfo.apkDownloadUrl,
        (percent, received, total) => {
          setDownloadPercent(percent);
          setReceivedBytes(received);
          setTotalBytes(total);
        }
      );
      setIsComplete(true);
    } catch (err: any) {
      setDownloadError(err?.message || 'Download failed. Please check internet connection.');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatMb = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                In-App Update
                <span className="text-[10px] bg-sky-950 text-sky-300 px-2 py-0.5 rounded-full border border-sky-800">
                  v{APP_VERSION}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Direct Download & Install</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status / Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-2 text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
            <p>Checking for latest update...</p>
          </div>
        ) : updateInfo ? (
          <div className="space-y-3">
            {updateInfo.hasUpdate ? (
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>New Version: {updateInfo.latestVersion}</span>
                  </div>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-800">
                    Ready
                  </span>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 max-h-24 overflow-y-auto text-[11px] text-slate-300 whitespace-pre-line font-sans">
                  {updateInfo.releaseNotes}
                </div>

                {/* Live Download Progress Bar (PinPulse style) */}
                {isDownloading ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-sky-300 flex items-center gap-1.5">
                        <ArrowDownCircle className="w-4 h-4 animate-bounce text-sky-400" />
                        Downloading update...
                      </span>
                      <span className="text-white font-mono">{downloadPercent}%</span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-md shadow-sky-500/50"
                        style={{ width: `${downloadPercent}%` }}
                      />
                    </div>

                    {totalBytes > 0 && (
                      <p className="text-[10px] text-slate-400 text-right font-mono">
                        {formatMb(receivedBytes)} MB / {formatMb(totalBytes)} MB
                      </p>
                    )}
                  </div>
                ) : isComplete ? (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-600/60 text-xs text-emerald-300 font-medium text-center">
                    ✓ Download complete. Package installer opened!
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartInAppUpdate}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download & Install ({updateInfo.latestVersion})</span>
                  </button>
                )}

                {downloadError && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800">
                    {downloadError}
                  </p>
                )}
              </div>
            ) : updateInfo.error ? (
              <div className="bg-amber-950/40 border border-amber-600/60 rounded-2xl p-3 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-amber-300 text-[11px]">{updateInfo.error}</span>
              </div>
            ) : (
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-center space-y-1">
                <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-white">App is Up to Date</p>
                <p className="text-[10px] text-slate-400">You are currently running v{APP_VERSION}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Close Button */}
        <div>
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
