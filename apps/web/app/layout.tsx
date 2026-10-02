import '@fontsource/anton/400.css';import '@fontsource/open-sans/400.css';import '@fontsource/open-sans/600.css';import '@fontsource/open-sans/700.css';import './globals.css';import './legacy.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'Labour Youth | Local help, thoughtfully coordinated',description:'Find household and local workforce support through Labour Youth. Start with the app.'};
export default function Root({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
