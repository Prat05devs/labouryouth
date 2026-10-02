import {SiteNav} from '@/components/site/nav';
import {SiteFooter} from '@/components/site/footer';
export default function InfoLayout({children}:{children:React.ReactNode}){return <div className="min-h-screen"><SiteNav/>{children}<SiteFooter/></div>;}
