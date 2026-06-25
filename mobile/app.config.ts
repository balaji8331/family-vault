import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FamilyVault',
  slug: 'familyvault',
  scheme: 'familyvault',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.familyvault.app',
    infoPlist: {
      NSCameraUsageDescription: 'Allow FamilyVault to scan documents and take photos of items to store securely.',
      NSFaceIDUsageDescription: 'Allow FamilyVault to use Face ID to securely unlock your vault and decrypt documents.'
    }
  },
  android: {
    package: 'com.familyvault.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    permissions: [
      'CAMERA',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT'
    ]
  },
  web: {
    favicon: './assets/favicon.png'
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow FamilyVault to access your camera.'
      }
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Allow FamilyVault to use Face ID to unlock your vault.'
      }
    ],
    'expo-secure-store',
    'expo-document-picker'
  ]
});
