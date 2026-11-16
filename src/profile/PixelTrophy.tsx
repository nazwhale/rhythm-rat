export default function PixelTrophy({ place = 1, className = '' }: { place?: number; className?: string }) {
  const gold = place === 1 ? '#d6a634' : place === 2 ? '#94a5a5' : '#b67c54'
  const light = place === 1 ? '#ffe49a' : place === 2 ? '#e0ebdf' : '#edc299'
  return <svg className={`pixel-trophy ${className}`} viewBox="0 0 24 24" shapeRendering="crispEdges" role="img" aria-label={`${place === 1 ? 'Gold' : place === 2 ? 'Silver' : 'Bronze'} pixel-art trophy`}>
    <path fill={gold} d="M5 2h14v3h4v8h-3v3h-4v2h-2v3h5v3H5v-3h5v-3H8v-2H4v-3H1V5h4zm0 5H3v4h2v2h2V7zm14 0h-2v6h2v-2h2V7z" />
    <path fill={light} d="M7 3h10v8h-2v3h-2v2h-2v-2H9v-3H7zM7 21h10v1H7z" />
    <path fill="#fff5d9" d="M8 4h2v6H8zM11 5h3v2h-3z" />
    <path fill="#657666" d="M4 23h16v1H4z" />
  </svg>
}
