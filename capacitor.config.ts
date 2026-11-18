import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.garageempire.app',
  appName: 'Garage Empire',
  webDir: 'public',
  server: {
    url: 'https://next-js-3-d-canvas.vercel.app',
    cleartext: true
  }
};

export default config;