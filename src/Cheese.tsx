import type { Duration } from './level'

export function Cheese({ duration, className }: { duration: Duration; className?: string }) {
  return <svg className={className} viewBox="0 0 16 12" shapeRendering="crispEdges">
              {duration === 'h' ? <>
                {/* Red-wax Edam with a pale cut face. */}
                <path fill="#a8423c" d="M5 0h6v1h2v2h2v6h-2v2H3V9H1V3h2V1h2z" />
                <path fill="#cc6052" d="M5 1h6v1h2v2H3V2h2zM2 4h3v5H3V8H2z" />
                <path fill="#f6d982" d="M6 3h6v1h2v4h-2v2H6V9H4V5h2z" />
                <path fill="#ffe8a3" d="M6 3h6v2H6z" />
                <path fill="#d7b564" d="M7 6h1v1H7zM11 7h1v1h-1z" />
              </> : duration === 'q' ? <>
                <path fill="#d59a32" d="M1 4h14v7H1z" />
                <path fill="#f8d773" d="M1 4 11 0h2v2h2v2z" />
                <path fill="#f4c653" d="M1 4h14v5H1z" />
                <path fill="#c68c2f" d="M4 5h2v2H4zM10 7h2v2h-2z" />
              </> : <>
                {/* A little round brie: stepped rind, creamy centre, shaded side. */}
                <path fill="#aa9270" d="M5 1h6v1h2v2h1v5h-2v2H4V9H2V4h1V2h2z" />
                <path fill="#eee6d1" d="M5 0h6v1h2v2h1v4h-2v2H4V7H2V3h1V1h2z" />
                <path fill="#fff6d7" d="M5 1h6v1h2v4h-2v2H5V7H3V3h2z" />
                <path fill="#ddbc7b" d="M6 3h2v1H6zM10 5h1v2h-1zM5 6h1v1H5z" />
                <path fill="#d2c5a7" d="M4 9h8v1H4z" />
              </>}
            </svg>
}
