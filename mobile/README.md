# FamilyVault Mobile

React Native (Expo) mobile client for FamilyVault.

## Setup

1. Copy `.env.local` to `.env` in the `mobile` folder.
2. Add the required vars:
   ```
   EXPO_PUBLIC_SUPABASE_URL=your-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-key
   ```
3. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```

## Running Locally

To start the Expo bundler:
```bash
npx expo start
```

Press `i` to run on an iOS simulator, or `a` to run on an Android emulator.

## Building Native Apps

To build the APK or IPA for devices, use EAS:

```bash
npm install -g eas-cli
eas build --profile preview
```

## Note on Encryption
The mobile app uses `react-native-quick-crypto` for native-speed AES-256-GCM encryption which perfectly matches the WebCrypto `window.crypto.subtle` implementation on the web.
