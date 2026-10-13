import {Redirect} from 'expo-router';

// Older links and notifications pointed here; the guest home now lives in the browse tabs.
export default function LegacyHome(){return <Redirect href="/browse"/>;}
