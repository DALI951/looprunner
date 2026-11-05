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

/**
 * Checks GitHub Releases for a newer version
 */
export async function checkForAppUpdates(repoFullName: string): Promise<UpdateInfo> {
  if (!repoFullName || !repoFullName.includes('/')) {
    return {
      hasUpdate: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      error: 'Please specify your GitHub repository (e.g. username/looprunner) to check releases.',
    };
  }

  try {
    const cleanRepo = repoFullName.trim().replace(/^https:\/\/github\.com\//, '');
    const url = `https://api.github.com/repos/${cleanRepo}/releases/latest`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (res.status === 404) {
        return {
          hasUpdate: false,
          currentVersion: APP_VERSION,
          latestVersion: APP_VERSION,
          error: 'No releases found on GitHub yet. Push to main to generate the first release APK!',
        };
      }
      return {
        hasUpdate: false,
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        error: `GitHub API error: ${res.statusText}`,
      };
    }

    const release = await res.json();
    const latestTag = release.tag_name || '';
    const cleanLatest = latestTag.replace(/^v/, '');
    const cleanCurrent = APP_VERSION.replace(/^v/, '');

    // Look for apk in release assets
    let apkUrl = release.html_url;
    if (release.assets && Array.isArray(release.assets)) {
      const apkAsset = release.assets.find((a: { name: string; browser_download_url: string }) =>
        a.name.toLowerCase().endsWith('.apk')
      );
      if (apkAsset) {
        apkUrl = apkAsset.browser_download_url;
      }
    }

    const hasUpdate = isNewerVersion(cleanLatest, cleanCurrent);

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: latestTag,
      releaseNotes: release.body || 'New enhancements and stability improvements.',
      apkDownloadUrl: apkUrl,
      publishedAt: release.published_at,
    };
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: APP_VERSION,
      latestVersion: APP_VERSION,
      error: (err as Error).message || 'Unable to check for updates while offline.',
    };
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
