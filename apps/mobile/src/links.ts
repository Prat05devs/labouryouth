import {Linking} from 'react-native';
// Public website pages (Decision 12 and 26). Returns an error code instead of throwing so screens can show it.
export const webPages={about:'/our-story',support:'/help',privacy:'/information/privacy',terms:'/information/terms',workerPolicy:'/information/worker-policy'} as const;
export async function openWebPage(page:keyof typeof webPages):Promise<string>{
 const base=process.env.EXPO_PUBLIC_WEB_URL;if(!base)return 'linkUnavailable';
 try{await Linking.openURL(base.replace(/\/$/,'')+webPages[page]);return '';}catch{return 'linkUnavailable';}
}
