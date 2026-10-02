import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Labour Youth', slug: 'labour-youth', scheme: 'labouryouth', version: '0.1.0',
  orientation: 'default', userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER,
    infoPlist: { NSLocationWhenInUseUsageDescription: 'Your location is checked only when you choose a work location or start a shift.', ITSAppUsesNonExemptEncryption: false } },
  android: { package: process.env.ANDROID_PACKAGE },
  plugins: ['@react-native-community/datetimepicker','expo-router','expo-secure-store',['expo-location',{locationWhenInUsePermission:'Allow Labour Youth to check your location when you start a shift.'}]],
  extra: process.env.EAS_PROJECT_ID ? {eas:{projectId:process.env.EAS_PROJECT_ID}} : {},
  owner: process.env.EXPO_OWNER,
};
export default config;
