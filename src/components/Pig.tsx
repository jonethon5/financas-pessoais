import type { AiTone } from '../types'
import type { PigMood, PigSize } from '../lib/pig'

/**
 * Porquinho PROVISÓRIO (vetor simples), até chegar o desenho definitivo.
 * Para trocar pela arte final, mantenha esta mesma interface: tamanho, humor, roupa do modo e item da loja.
 */
const BODY: Record<PigSize, { rx: number; ry: number }> = { magro: { rx: 50, ry: 50 }, normal: { rx: 62, ry: 55 }, gordo: { rx: 76, ry: 60 } }
const HEADGEAR = new Set(['chapeu', 'cartola', 'coroa', 'fone'])

export function Pig({ size = 'normal', mood = 'normal', tone = 'equilibrado', wear, className = '', px = 160 }: { size?: PigSize; mood?: PigMood; tone?: AiTone; wear?: string | null; className?: string; px?: number }) {
  const { rx, ry } = BODY[size]
  const cx = 100
  const cy = 118
  const top = cy - ry
  const pink = '#F6A6B6'
  const dark = '#E07C93'
  const ink = '#3B2230'
  const eyeY = cy - 14
  const hideToneHat = Boolean(wear && HEADGEAR.has(wear))
  return (
    <svg viewBox="0 0 200 200" width={px} height={px} className={`pig-bob ${className}`} role="img" aria-label={`Porquinho ${mood === 'triste' ? 'tristinho' : mood === 'festa' ? 'comemorando' : mood === 'feliz' ? 'feliz' : ''}`.trim()}>
      {/* sombra */}
      <ellipse cx={cx} cy={186} rx={rx * 0.8} ry={6} fill="#0F2433" opacity={0.1} />
      {/* perninhas */}
      {[-0.45, 0.45].map((k) => (
        <rect key={k} x={cx + rx * k - 9} y={cy + ry - 14} width={18} height={26} rx={8} fill={dark} />
      ))}
      {/* orelhas */}
      <path d={`M ${cx - rx * 0.62} ${top + 18} L ${cx - rx * 0.78} ${top - 12} L ${cx - rx * 0.28} ${top + 4} Z`} fill={dark} strokeLinejoin="round" />
      <path d={`M ${cx + rx * 0.62} ${top + 18} L ${cx + rx * 0.78} ${top - 12} L ${cx + rx * 0.28} ${top + 4} Z`} fill={dark} strokeLinejoin="round" />
      {/* corpo (cofrinho visto de frente) */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={pink} />
      <ellipse cx={cx - rx * 0.35} cy={cy - ry * 0.45} rx={rx * 0.3} ry={ry * 0.18} fill="#fff" opacity={0.35} />
      {/* fenda da moeda */}
      <rect x={cx - 14} y={top + 6} width={28} height={6} rx={3} fill={ink} opacity={0.75} />
      {/* bochechas */}
      <ellipse cx={cx - rx * 0.62} cy={cy + 8} rx={9} ry={6} fill="#F27D96" opacity={0.55} />
      <ellipse cx={cx + rx * 0.62} cy={cy + 8} rx={9} ry={6} fill="#F27D96" opacity={0.55} />
      {/* olhos */}
      {mood === 'feliz' || mood === 'festa' ? (
        <g stroke={ink} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M ${cx - 30} ${eyeY + 2} q 8 -9 16 0`} />
          <path d={`M ${cx + 14} ${eyeY + 2} q 8 -9 16 0`} />
        </g>
      ) : (
        <g fill={ink}>
          <circle cx={cx - 22} cy={eyeY} r={5.5} />
          <circle cx={cx + 22} cy={eyeY} r={5.5} />
          <circle cx={cx - 20} cy={eyeY - 2} r={1.8} fill="#fff" />
          <circle cx={cx + 24} cy={eyeY - 2} r={1.8} fill="#fff" />
        </g>
      )}
      {mood === 'triste' && (
        <g stroke={ink} strokeWidth={3} strokeLinecap="round">
          <path d={`M ${cx - 31} ${eyeY - 12} L ${cx - 15} ${eyeY - 8}`} />
          <path d={`M ${cx + 31} ${eyeY - 12} L ${cx + 15} ${eyeY - 8}`} />
        </g>
      )}
      {/* focinho */}
      <ellipse cx={cx} cy={cy + 10} rx={23} ry={15} fill={dark} />
      <ellipse cx={cx - 7} cy={cy + 10} rx={3.5} ry={5} fill={ink} opacity={0.8} />
      <ellipse cx={cx + 7} cy={cy + 10} rx={3.5} ry={5} fill={ink} opacity={0.8} />
      {/* boca */}
      {mood === 'festa' ? (
        <path d={`M ${cx - 12} ${cy + 31} q 12 14 24 0 Z`} fill={ink} />
      ) : (
        <path d={mood === 'triste' ? `M ${cx - 10} ${cy + 36} q 10 -8 20 0` : mood === 'feliz' ? `M ${cx - 11} ${cy + 31} q 11 9 22 0` : `M ${cx - 8} ${cy + 33} h 16`} stroke={ink} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      )}

      {/* roupa do modo */}
      {tone === 'suave' && !hideToneHat && (
        <g transform={`translate(${cx + rx * 0.5} ${top + 2})`}>
          <path d="M 0 0 l -14 -9 v 18 Z M 0 0 l 14 -9 v 18 Z" fill="#FF8FB1" />
          <circle r={4.5} fill="#E5487A" />
        </g>
      )}
      {tone === 'equilibrado' && !hideToneHat && (
        <g>
          <path d={`M ${cx - 30} ${top + 10} q 30 -36 60 0 Z`} fill="#2F6FEB" />
          <rect x={cx - 4} y={top + 4} width={44} height={8} rx={4} fill="#1D5FD6" />
          <circle cx={cx} cy={top - 7} r={3.5} fill="#1D5FD6" />
        </g>
      )}
      {tone === 'agressivo' && (
        <g>
          {!hideToneHat && <rect x={cx - rx * 0.86} y={eyeY - 26} width={rx * 1.72} height={9} rx={4} fill="#E5484D" />}
          {/* apito de treinador */}
          <path d={`M ${cx - 26} ${cy + ry - 30} Q ${cx} ${cy + ry - 6} ${cx + 26} ${cy + ry - 30}`} stroke="#0F2433" strokeWidth={2} fill="none" />
          <rect x={cx - 6} y={cy + ry - 22} width={18} height={10} rx={5} fill="#C9CED6" stroke="#8A94A0" strokeWidth={1.5} />
        </g>
      )}

      {/* item da loja */}
      {wear === 'oculos' && (
        <g>
          <rect x={cx - 36} y={eyeY - 9} width={28} height={18} rx={7} fill="#0F2433" />
          <rect x={cx + 8} y={eyeY - 9} width={28} height={18} rx={7} fill="#0F2433" />
          <path d={`M ${cx - 8} ${eyeY - 2} h 16`} stroke="#0F2433" strokeWidth={3} />
        </g>
      )}
      {wear === 'gravata' && (
        <g transform={`translate(${cx} ${cy + ry - 12})`}>
          <path d="M 0 0 l -16 -10 v 20 Z M 0 0 l 16 -10 v 20 Z" fill="#E5484D" />
          <circle r={4.5} fill="#B4232A" />
        </g>
      )}
      {wear === 'cachecol' && (
        <g>
          <path d={`M ${cx - rx * 0.8} ${cy + ry * 0.55} Q ${cx} ${cy + ry * 0.95} ${cx + rx * 0.8} ${cy + ry * 0.55}`} stroke="#0F9D6B" strokeWidth={12} strokeLinecap="round" fill="none" />
          <rect x={cx + rx * 0.35} y={cy + ry * 0.6} width={12} height={26} rx={4} fill="#0B7F5A" />
        </g>
      )}
      {wear === 'chapeu' && (
        <g>
          <ellipse cx={cx} cy={top + 6} rx={rx * 0.95} ry={9} fill="#E8C66B" />
          <path d={`M ${cx - 30} ${top + 4} q 2 -30 30 -30 q 28 0 30 30 Z`} fill="#F2D27E" />
          <rect x={cx - 30} y={top - 4} width={60} height={7} fill="#C2410C" />
        </g>
      )}
      {wear === 'cartola' && (
        <g>
          <ellipse cx={cx} cy={top + 6} rx={40} ry={7} fill="#0F2433" />
          <rect x={cx - 25} y={top - 40} width={50} height={46} rx={4} fill="#0F2433" />
          <rect x={cx - 25} y={top - 6} width={50} height={7} fill="#6E56F0" />
        </g>
      )}
      {wear === 'coroa' && <path d={`M ${cx - 28} ${top + 8} L ${cx - 28} ${top - 18} L ${cx - 14} ${top - 4} L ${cx} ${top - 24} L ${cx + 14} ${top - 4} L ${cx + 28} ${top - 18} L ${cx + 28} ${top + 8} Z`} fill="#F2A516" stroke="#C98A06" strokeWidth={2} strokeLinejoin="round" />}
      {wear === 'fone' && (
        <g>
          <path d={`M ${cx - rx * 0.8} ${cy - 8} Q ${cx} ${top - 34} ${cx + rx * 0.8} ${cy - 8}`} stroke="#0F2433" strokeWidth={7} fill="none" strokeLinecap="round" />
          <rect x={cx - rx - 6} y={cy - 22} width={16} height={28} rx={7} fill="#2F6FEB" />
          <rect x={cx + rx - 10} y={cy - 22} width={16} height={28} rx={7} fill="#2F6FEB" />
        </g>
      )}

      {/* confete na festa */}
      {mood === 'festa' && (
        <g>
          {[[28, 40, '#FF6B4A'], [170, 50, '#2F6FEB'], [40, 90, '#0F9D6B'], [165, 100, '#F2A516'], [60, 25, '#6E56F0'], [140, 22, '#FF6B4A']].map(([x, y, c]) => (
            <rect key={`${x}-${y}`} x={x as number} y={y as number} width={7} height={11} rx={2} fill={c as string} transform={`rotate(${(x as number) % 40} ${x} ${y})`} />
          ))}
        </g>
      )}
    </svg>
  )
}
