import Link from 'next/link';

export function Logo({className='h-12',variant='black'}:{className?:string;variant?:'black'|'white'}){
  return <Link href="/" aria-label="Labour Youth home" className="inline-flex shrink-0 items-center"><img src={`/logo-${variant}.svg`} alt="Labour Youth" className={className+' w-auto'} width={290} height={220}/></Link>;
}
