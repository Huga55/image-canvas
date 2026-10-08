export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#17332e" />
      <rect x="8" y="11" width="36" height="42" rx="5" fill="#f4efe6" />
      <rect x="8" y="31.2" width="36" height="1.6" fill="#e4ddd3" />
      <rect x="25.2" y="11" width="1.6" height="42" fill="#e4ddd3" />
      <Landscape x={10.2} y={13.2} width={13.6} height={16.4} sky="#0f6f62" hill="#e2c27a" />
      <Landscape x={28.2} y={13.2} width={13.6} height={16.4} sky="#b85c3a" hill="#f3e2a8" />
      <rect x="10.2" y="34.2" width="13.6" height="16.4" rx="1.6" fill="#d7cbb8" />
      <rect x="12.2" y="37.2" width="9.4" height="1.5" rx="0.7" fill="#f7f3ec" />
      <rect x="12.2" y="40.2" width="6.6" height="1.5" rx="0.7" fill="#f7f3ec" />
      <g transform="rotate(11 47 43)">
        <rect x="36.6" y="31.4" width="20.4" height="24.4" rx="3" fill="#0c1816" opacity="0.28" />
        <rect x="36" y="30" width="20" height="24" rx="2.6" fill="#17332e" />
        <rect x="37.15" y="31.15" width="17.7" height="21.7" rx="2" fill="#fffdf8" />
        <Landscape x={38.3} y={32.3} width={15.2} height={12.2} sky="#0f6f62" hill="#e2c27a" />
        <rect x="38.5" y="46.4" width="9.2" height="1.4" rx="0.7" fill="#e4ddd3" />
        <rect x="38.5" y="49" width="6.2" height="1.4" rx="0.7" fill="#e4ddd3" />
      </g>
    </svg>
  )
}

function Landscape({
  x,
  y,
  width,
  height,
  sky,
  hill
}: {
  x: number
  y: number
  width: number
  height: number
  sky: string
  hill: string
}) {
  const id = `cell-${x}-${y}`.replaceAll('.', '')
  return (
    <g>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={width} height={height} rx="1.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
      <rect x={x} y={y} width={width} height={height} fill={sky} />
      <circle cx={x + width * 0.28} cy={y + height * 0.24} r={Math.min(width, height) * 0.12} fill="#f3e2a8" />
      <path
        fill={hill}
        d={`M${x} ${y + height} L${x + width * 0.32} ${y + height * 0.62} L${x + width * 0.55} ${y + height * 0.82} L${x + width * 0.74} ${y + height * 0.58} L${x + width} ${y + height} Z`}
      />
      </g>
    </g>
  )
}
