import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.looprunner.app',
  appName: 'LoopRunner',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
