import '@fontsource/anton/400.css';import '@fontsource/open-sans/400.css';import '@fontsource/open-sans/600.css';import '@fontsource/open-sans/700.css';import './globals.css';import './legacy.css';import type {Metadata} from 'next';
export const metadata:Metadata={title:'Labour Youth | Good work, close to home',description:'Post daily work in Dehradun, see verified local workers who are available, and talk directly on WhatsApp.'};
export default function Root({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
