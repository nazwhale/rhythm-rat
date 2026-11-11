export default function FinishHole({ tier, celebrating, left }: { tier: number; celebrating: boolean; left: number }) {
  return <div className={`finish-hole ${celebrating ? 'celebrating' : ''}`} style={{ left }} role="img" aria-label={tier === 0 ? 'An empty mouse hole' : 'A mouse hole with a rat party'}>
    <svg viewBox="0 0 96 96" shapeRendering="crispEdges">
      <defs><clipPath id="party-door"><path d="M12 96V42h6V24h12V12h36v12h12v18h6v54z" /></clipPath></defs>
      <path fill="#c1c9b8" d="M6 96V42h6V24h12V12h12V6h24v6h12v12h12v18h6v54z" />
      <path fill="#2c3c33" d="M12 96V42h6V24h12V12h36v12h12v18h6v54z" />
      <g clipPath="url(#party-door)">
        {tier > 0 && <g className="party-guests" fill="#9ca69b">
          <path d="M25 82V70h5v-6h6v6h8v5h6v7H25zm3 0h5v5h-5zm12 0h5v5h-5z" />
          <path fill="#e7b1a0" d="M30 65h4v4h-4z" /><path fill="#fff" d="M41 73h3v3h-3z" />
          {tier > 2 && <path fill="#c6b7a8" d="M55 80V69h5v-7h6v7h8v5h6v6H55zm4 0h4v5h-4zm11 0h4v5h-4z" />}
          {tier > 5 && <path fill="#809b8e" d="M37 62v-9h4v-6h5v6h7v4h5v5H37z" />}
        </g>}
        {tier > 1 && <path fill="#e7c465" d="m24 46 5-9 5 9zm37-1 5-9 5 9z" />}
        {tier > 3 && <g className="party-disco"><path stroke="#9eafac" strokeWidth="2" d="M48 12v9" /><path fill="#bbcdd0" d="M39 22h18v4h4v13h-4v4H39v-4h-4V26h4z" /><path fill="#f3f3d8" d="M40 24h5v5h-5zm9 8h5v5h-5z" /><path fill="#799a9b" d="M49 24h5v5h-5zm-9 9h5v5h-5z" /></g>}
        {tier > 4 && <g className="party-confetti" fill="#e7b4ac"><path d="M22 30h3v5h-3zm43 27h5v3h-5zM34 51h3v4h-3z" /><path fill="#e8cb68" d="M67 28h4v3h-4zM27 57h5v3h-5zM54 48h3v5h-3z" /></g>}
        {tier > 5 && <g fill="#e7b4ac"><path d="m16 92 6-15 10 7zM66 84l10-7 6 15z" /><path fill="#e8cb68" d="m20 80-5-6 3-2 5 6zm53-2 5-7 3 3-6 7z" /></g>}
        {tier > 6 && <path className="party-lights" fill="#f2dc87" d="M18 26h5v5h-5zm12-9h5v5h-5zm31 0h5v5h-5zm12 9h5v5h-5z" />}
      </g>
    </svg>
  </div>
}
