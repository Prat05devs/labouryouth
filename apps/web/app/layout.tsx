import '@fontsource/anton/400.css';import '@fontsource/open-sans/400.css';import '@fontsource/open-sans/600.css';import '@fontsource/open-sans/700.css';import './globals.css';import './legacy.css';import type {Metadata,Viewport} from 'next';
export const metadata:Metadata={title:'Labour Youth | Good work, close to home',description:'Post daily work in Dehradun, see verified local workers who are available, and talk directly on WhatsApp.',icons:{icon:'/logo-black.svg',apple:'/logo.png'}};
// viewport-fit=cover lets the safe-area padding in `shell` keep content clear of notches in landscape.
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#fbfaf7'};
export default function Root({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
