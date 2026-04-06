import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'maeum-jungsan',
  brand: {
    displayName: '마음정산',
    primaryColor: '#3B82F6',
    icon: '',  // 콘솔에서 앱 아이콘 업로드 후 URL로 교체
  },
  web: {
    host: 'localhost',
    port: 3000,
    commands: {
      dev: 'next dev',
      build: 'next build',
    },
  },
  webViewProps: {
    type: 'partner',
  },
  permissions: ['CLIPBOARD', 'CAMERA', 'CONTACTS', 'NOTIFICATION'],
});
