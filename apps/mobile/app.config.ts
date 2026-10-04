import type { ExpoConfig } from 'expo/config';
// Owner-chosen identifier (Decision 22); env vars can still override for staging variants.
const APP_ID = 'in.labouryouth.app';
// A release bundle must never ship pointing at a developer machine (Decision 22).
const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
if (process.env.LY_RELEASE === '1' && !apiUrl.startsWith('https://')) {
  throw new Error('Release builds need EXPO_PUBLIC_API_URL set to the deployed https API');
}
const config: ExpoConfig = {
  name: 'Labour Youth', slug: 'labour-youth', scheme: 'labouryouth', version: '0.1.0',
  orientation: 'default', userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER || APP_ID,
    infoPlist: { NSLocationWhenInUseUsageDescription: 'Workers share their location only when going online to see nearby jobs and when checking in at the start of a shift.', ITSAppUsesNonExemptEncryption: false } },
  android: { package: process.env.ANDROID_PACKAGE || APP_ID, permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'], blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'] },
  plugins: ['@react-native-community/datetimepicker','expo-router','expo-secure-store',['expo-location',{locationWhenInUsePermission:'Workers share their location only when going online to see nearby jobs and when checking in at the start of a shift.'}]],
  extra: process.env.EAS_PROJECT_ID ? {eas:{projectId:process.env.EAS_PROJECT_ID}} : {},
  owner: process.env.EXPO_OWNER,
};
export default config;
