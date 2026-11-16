import { createContext, useContext, useState, type ReactNode, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import SiteNav from './SiteNav'

const HeaderSlot = createContext<HTMLDivElement | null>(null)
export function HeaderControls({ children }: { children: ReactNode }) {
  const target = useContext(HeaderSlot)
  return target ? createPortal(children, target) : null
}
export default function PageLayout({ children, path, onNavigate }: { children: ReactNode; path: string; onNavigate: (event: MouseEvent<HTMLElement>) => void }) {
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  return <HeaderSlot.Provider value={headerSlot}><main className={`app-shell${path === '/' ? '' : ' account-page'}`} onClick={onNavigate}>
    <header className="topbar"><div className="brand-and-tagline"><a className="brand" href="/"><img className="brand-mark" src="/rhythm-rat.svg" alt="" width="32" height="32" /><span>RHYTHM<span className="brand-light">RAT</span></span></a><span className="brand-tagline">Eat to the beat.</span></div><div ref={setHeaderSlot} className="header-controls" /></header>
    <SiteNav path={path} />
    <div className="page-content">{children}</div>
  </main></HeaderSlot.Provider>
}
