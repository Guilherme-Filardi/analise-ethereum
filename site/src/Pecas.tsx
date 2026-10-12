import type { ReactNode } from 'react'
import type { PrevisaoHoje } from './api'
import { moeda, pct } from './formato'

/** Variação com sinal, em pílula: verde com ▲ se subiu, vermelha com ▼ se caiu. */
export function Variacao({ valor, texto }: { valor: number | null; texto?: string }) {
  if (valor === null) return <span className="var neutro">sem dado</span>
  const classe = valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : 'neutro'
  return (
    <span className={`var ${classe}`}>
      {valor > 0 ? '▲' : valor < 0 ? '▼' : '●'} {pct(Math.abs(valor))}{texto ? ` ${texto}` : ''}
    </span>
  )
}

/** Variação grande, sem pílula, para dentro de um número em destaque. */
export function Sinal({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="terciario">–</span>
  const classe = valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : ''
  return <span className={classe}>{valor > 0 ? '▲' : valor < 0 ? '▼' : '●'} {pct(Math.abs(valor))}</span>
}

/** Um número com rótulo em cima e nota embaixo. */
export function Kpi({ rotulo, valor, nota, extra }: { rotulo: string; valor: ReactNode; nota?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="rotulo">{rotulo}</div>
      <div className="valor-grande">{valor}</div>
      {extra}
      {nota && <div className="nota">{nota}</div>}
    </div>
  )
}

const FORCA_FRASE: Record<string, string> = {
  fraca: 'quase cara ou coroa',
  'média': 'pende um pouco',
  forte: 'pende mais para um lado',
}

/** O palpite em selo: nunca só cor, sempre com símbolo e palavra. */
export function SeloPalpite({ palpite, forca, pequeno = false }: { palpite: string; forca?: string; pequeno?: boolean }) {
  if (!palpite) return <span className={`selo neutro${pequeno ? ' pequeno' : ''}`}>● sem palpite</span>
  const sobe = palpite === 'sobe'
  return (
    <span className={`selo ${sobe ? 'sobe' : 'cai'}${pequeno ? ' pequeno' : ''}`}>
      {sobe ? '▲ Sobe' : '▼ Cai'}
      {forca && <span style={{ fontWeight: 500, opacity: 0.85 }}>· força {forca}</span>}
    </span>
  )
}

export function fraseDaForca(forca: string) {
  return FORCA_FRASE[forca] ?? ''
}

/**
 * A faixa de preço desenhada: o trilho, a faixa azul e um risco no preço de hoje.
 * Mostra de cara se a faixa está mais para cima ou para baixo do preço atual.
 */
export function FaixaVisual({ min, max, hoje, rotulos = true }: { min: number; max: number; hoje: number; rotulos?: boolean }) {
  const folga = (max - min) * 0.45
  const de = Math.min(min, hoje) - folga
  const ate = Math.max(max, hoje) + folga
  const pos = (v: number) => `${((v - de) / (ate - de)) * 100}%`
  return (
    <div>
      <div className="faixa-visual" role="img"
        aria-label={`Faixa de ${moeda(min)} a ${moeda(max)}; o preço de hoje é ${moeda(hoje)}`}>
        <div className="trilho" />
        <div className="banda" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
        <div className="agora" style={{ left: pos(hoje) }} title={`hoje: ${moeda(hoje)}`} />
      </div>
      {rotulos && (
        <div className="faixa-numeros num">
          <div><span>de</span>{moeda(min)}</div>
          <div style={{ textAlign: 'center' }}><span>hoje</span>{moeda(hoje)}</div>
          <div style={{ textAlign: 'right' }}><span>até</span>{moeda(max)}</div>
        </div>
      )}
    </div>
  )
}

/** O palpite em palavras: a força diz se é empate, leve tendência ou tendência. */
export function fraseDoPalpite(palpite: string, forca: string) {
  const lado = palpite === 'sobe' ? 'subir' : 'cair'
  if (forca === 'forte') return `Tendência de ${lado}`
  if (forca === 'média') return `Leve tendência de ${lado}`
  return 'Empate: quase cara ou coroa'
}

/**
 * A chance de subir e a de cair numa barra só, dividida. Dá para ver de cara que as duas
 * quase sempre ficam perto da metade: a direção de um dia é quase cara ou coroa.
 */
export function ChanceDividida({ chance }: { chance: number }) {
  return (
    <div>
      <div className="dividida" role="img" aria-label={`Chance de subir ${pct(chance)}, de cair ${pct(1 - chance)}`}>
        <div className="lado sobe" style={{ width: `${chance * 100}%` }}><span>▲ Sobe {pct(chance)}</span></div>
        <div className="lado cai" style={{ width: `${(1 - chance) * 100}%` }}><span>{pct(1 - chance)} Cai ▼</span></div>
      </div>
    </div>
  )
}

/** Dica curta de quanto a faixa tem de largura, em dólar e em porcentagem do preço de hoje. */
export function larguraDaFaixa(p: Pick<PrevisaoHoje, 'preco'>, min: number, max: number) {
  return `${moeda(max - min)} de largura (${pct((max - min) / p.preco)} do preço)`
}
