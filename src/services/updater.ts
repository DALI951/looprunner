import { registerPlugin, Capacitor } from '@capacitor/core';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  apkDownloadUrl?: string;
  publishedAt?: string;
  error?: string;
}

export const APP_VERSION = '1.0.0';

interface NativeAppUpdatePlugin {
  downloadAndInstallApk(options: { url: string }): Promise<void>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (info: { progress: number; receivedBytes: number; totalBytes: number }) => void
  ): Promise<any>;
}

const NativeAppUpdate = registerPlugin<NativeAppUpdatePlugin>('AppUpdate');

/**
 * Checks GitHub Releases for a newer version
 */
export async function checkForAppUpdates(repoFullName: string = 'DALI951/looprunner'): Promise<UpdateInfo> {
  if (!repoFullName || !repoFullName.includes('/')) {
    return {
      hasUpdate: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      error: 'Please specify your GitHub repository (e.g. username/looprunner).',
    };
  }

  try {
    const cleanRepo = repoFullName.trim().replace(/^https:\/\/github\.com\//, '');
    const url = `https://api.github.com/repos/${cleanRepo}/releases/latest`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          hasUpdate: false,
          currentVersion: APP_VERSION,
          latestVersion: APP_VERSION,
          error: 'No releases found on GitHub yet.',
        };
      }
      return {
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        error: `GitHub error: ${res.statusText}`,
      };
    }

    const release = await res.json();
    const latestTag = release.tag_name || '';
    const cleanLatest = latestTag.replace(/^v/, '');
    const cleanCurrent = APP_VERSION.replace(/^v/, '');

    let apkUrl = '';
    if (release.assets && Array.isArray(release.assets)) {
      const apkAsset = release.assets.find((a: { name: string; browser_download_url: string }) =>
        a.name.toLowerCase().endsWith('.apk')
      );
      if (apkAsset) {
        apkUrl = apkAsset.browser_download_url;
      }
    }

    const hasUpdate = isNewerVersion(cleanLatest, cleanCurrent) || (latestTag && latestTag !== `v${APP_VERSION}`);

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: latestTag || `v${APP_VERSION}`,
      releaseNotes: release.body || 'New enhancements and stability improvements.',
      apkDownloadUrl: apkUrl,
      publishedAt: release.published_at,
    };
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      error: (err as Error).message || 'Unable to check updates while offline.',
    };
  }
}

/**
 * In-App Download and Install Handler (Like PinPulse):
 * Downloads the APK directly inside the app with live progress, then triggers the installer.
 */
export async function downloadAndInstallInApp(
  apkUrl: string,
  onProgress: (percent: number, receivedBytes: number, totalBytes: number) => void
): Promise<void> {
  if (!apkUrl) throw new Error('No APK download URL provided.');

  if (Capacitor.isNativePlatform()) {
    // Native Android execution via AppUpdatePlugin
    const handle = await NativeAppUpdate.addListener('downloadProgress', data => {
      const percent = Math.min(100, Math.round(data.progress * 100));
      onProgress(percent, data.receivedBytes, data.totalBytes);
    });

    try {
      await NativeAppUpdate.downloadAndInstallApk({ url: apkUrl });
    } finally {
      if (handle && handle.remove) {
        handle.remove();
      }
    }
  } else {
    // Web / Desktop fallback: stream download with progress
    const response = await fetch(apkUrl);
    if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

    const contentLength = Number(response.headers.get('content-length')) || 25000000;
    const reader = response.body?.getReader();

    if (!reader) {
      window.location.href = apkUrl;
      return;
    }

    let received = 0;
    const chunks: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        const percent = Math.min(100, Math.round((received / contentLength) * 100));
        onProgress(percent, received, contentLength);
      }
    }

    const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'LoopRunner.apk';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(n => parseInt(n, 10) || 0);
  const l = parse(latest);
  const c = parse(current);

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lPart = l[i] || 0;
    const cPart = c[i] || 0;
    if (lPart > cPart) return true;
    if (lPart < cPart) return false;
  }
  return false;
}
