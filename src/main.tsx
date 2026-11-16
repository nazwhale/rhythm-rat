import React, { lazy, Suspense, useEffect, useState, type MouseEvent } from 'react'
import { createRoot } from 'react-dom/client'
import PageLayout from './profile/PageLayout'
import './style.css'
const App = lazy(() => import('./App'))
const ProfilePage = lazy(() => import('./profile/ProfilePage'))
const PuzzlesPage = lazy(() => import('./profile/PuzzlesPage'))
const LeaderboardPage = lazy(() => import('./profile/LeaderboardPage'))
const currentPath = () => window.location.pathname.replace(/\/+$/, '') || '/'
function Router() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const pop = () => setPath(currentPath())
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  function navigate(event: MouseEvent<HTMLElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return
    const link = event.target.closest('a')
    if (!link || link.target || link.hasAttribute('download')) return
    const url = new URL(link.href)
    if (url.origin !== location.origin || url.hash || !['/', '/profile', '/leaderboard', '/puzzles'].includes(url.pathname)) return
    event.preventDefault()
    if (url.pathname === path) return
    history.pushState(null, '', url)
    setPath(currentPath()); window.scrollTo(0, 0)
  }
  return <PageLayout path={path} onNavigate={navigate}><Suspense fallback={<section className="component-loading" role="status">Loading…</section>}>
    {path === '/profile' ? <ProfilePage /> : path === '/leaderboard' ? <LeaderboardPage /> : path === '/puzzles' ? <PuzzlesPage /> : <App />}
  </Suspense></PageLayout>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Router /></React.StrictMode>)
