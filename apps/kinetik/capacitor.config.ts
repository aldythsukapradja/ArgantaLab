import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.argantalab.kinetikcircle',
  appName: 'KinetikCircle',
  webDir: 'dist',
  backgroundColor: '#F3F3F6',
  ios: { contentInset: 'always' },
  android: { backgroundColor: '#F3F3F6' },
}

export default config
