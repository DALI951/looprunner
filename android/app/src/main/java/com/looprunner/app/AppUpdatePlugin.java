package com.looprunner.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        Context context = getContext();

        new Thread(() -> {
            try {
                URL url = new URL(apkUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "LoopRunner-Android");
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(20000);
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                // Handle manual HTTP redirects (301, 302, 307, 308) for GitHub Release Assets
                int responseCode = conn.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                        || responseCode == HttpURLConnection.HTTP_MOVED_PERM
                        || responseCode == 307
                        || responseCode == 308) {
                    String redirectUrl = conn.getHeaderField("Location");
                    if (redirectUrl != null && !redirectUrl.isEmpty()) {
                        conn.disconnect();
                        url = new URL(redirectUrl);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestProperty("User-Agent", "LoopRunner-Android");
                        conn.connect();
                    }
                }

                int totalLength = conn.getContentLength();
                InputStream input = conn.getInputStream();

                File cacheDir = context.getExternalCacheDir() != null ? context.getExternalCacheDir() : context.getCacheDir();
                File updateFile = new File(cacheDir, "LoopRunner_update.apk");
                if (updateFile.exists()) {
                    updateFile.delete();
                }

                FileOutputStream output = new FileOutputStream(updateFile);
                byte[] buffer = new byte[8192];
                int bytesRead;
                int totalRead = 0;
                long lastNotify = 0;

                while ((bytesRead = input.read(buffer)) != -1) {
                    output.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                    long now = System.currentTimeMillis();
                    if (now - lastNotify > 150 || totalRead == totalLength) {
                        lastNotify = now;
                        float progress = totalLength > 0 ? (float) totalRead / totalLength : 0.5f;
                        JSObject progressObj = new JSObject();
                        progressObj.put("progress", progress);
                        progressObj.put("receivedBytes", totalRead);
                        progressObj.put("totalBytes", totalLength);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                output.close();
                input.close();
                conn.disconnect();

                // Launch Native Package Installer
                getActivity().runOnUiThread(() -> {
                    try {
                        installApk(context, updateFile);
                        call.resolve();
                    } catch (Exception ex) {
                        call.reject("Failed to trigger installer: " + ex.getMessage());
                    }
                });

            } catch (Exception e) {
                call.reject("Download failed: " + e.getMessage());
            }
        }).start();
    }

    private void installApk(Context context, File file) {
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!context.getPackageManager().canRequestPackageInstalls()) {
                Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(settingsIntent);
            }
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(uri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(installIntent);
    }
}
