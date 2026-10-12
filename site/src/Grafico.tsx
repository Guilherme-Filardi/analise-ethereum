import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Escala, FaixaReal, Ponto, Vela } from './api'
import { cor } from './cores'
import { data, dataCurta, diaHora, hora, mesAnoCurto, moeda, moedaCurta, moedaEixo, pct, pctEixo, subiuCaiu } from './formato'

// Todos os gráficos seguem as mesmas regras: linha de 2 px, grade fina e discreta, eixos em
// cinza, e a cor da série só na marca (o texto fica sempre na cor de texto). A caixinha do
// mouse (a "dica") mostra o valor em destaque e o nome em segundo plano.

/** Eixo de datas: dia/mês/ano para trechos curtos, mês/ano para os longos. */
function formatoData(pontos: { data: string }[], escala?: Escala) {
  if (escala === 'mes') return mesAnoCurto
  if (pontos.length < 2) return dataCurta
  const dias = (Date.parse(pontos[pontos.length - 1].data) - Date.parse(pontos[0].data)) / 86400000
  return dias > 500 ? mesAnoCurto : dataCurta
}

function eixos(corTexto: string) {
  return { stroke: corTexto, fontSize: 12, tickLine: false, axisLine: { stroke: cor('--eixo') } }
}

const NOME_ESCALA: Record<Escala, string> = { dia: 'Dia', semana: 'Semana de', mes: 'Mês de' }

function tituloVela(v: Vela, escala: Escala) {
  if (escala === 'dia') return `Dia ${data(v.data)}`
  return `${NOME_ESCALA[escala]} ${data(v.data)} a ${data(v.fim)}`
}

// ------------------------------------------------------------------ linhas

type Serie = { nome: string; pontos: Ponto[]; cor: string }
type Marca = { data: string; valor: number; rotulo: string; embaixo?: boolean }

/** Ponto perto da borda: o texto vai para dentro, para não cobrir o eixo. */
function ladoDoRotulo(m: Marca, linhas: Record<string, number | string>[]): 'top' | 'bottom' | 'right' | 'left' {
  const posicao = linhas.findIndex((l) => l.data === m.data) / Math.max(1, linhas.length - 1)
  if (posicao < 0.12) return 'right'
  if (posicao > 0.88) return 'left'
  return m.embaixo ? 'bottom' : 'top'
}

function DicaLinhas({ active, payload, label, series, comHora }: {
  active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: Serie[]; comHora?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="dica">
      <div className="terciario">{comHora ? diaHora(String(label)) : data(String(label))}</div>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.nome)
        if (!p) return null
        return (
          <div key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <i style={{ width: 12, height: 3, borderRadius: 2, background: s.cor, display: 'inline-block' }} />
            <span className="valor-dica">{moeda(p.value)}</span>
            {series.length > 1 && <span className="terciario">{s.nome}</span>}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Gráfico de linhas por data, com valor em US$. Uma série só não ganha legenda: o título diz.
 * `area` pinta um véu claro embaixo da linha (só com uma série). `referencia` desenha uma
 * linha tracejada (por exemplo, "o que você colocou"); `marcas` destaca pontos com um texto.
 */
export function GraficoLinhas({ series, referencia, marcas = [], altura = 300, area = false, comHora = false }: {
  series: Serie[]
  referencia?: { valor: number; rotulo: string }
  marcas?: Marca[]
  altura?: number
  area?: boolean
  /** As datas trazem a hora ("aaaa-mm-dd hh:mm"): o eixo mostra a hora, e a dica, o dia e a hora. */
  comHora?: boolean
}) {
  const porData = new Map<string, Record<string, number | string>>()
  for (const s of series) {
    for (const p of s.pontos) {
      const linha = porData.get(p.data) ?? { data: p.data }
      linha[s.nome] = p.valor
      porData.set(p.data, linha)
    }
  }
  const linhas = [...porData.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)))
  const corTexto = cor('--texto-3')
  const fmt = comHora ? hora : formatoData(linhas as { data: string }[])
  // Trecho curto (24 horas, 7 dias): "US$ 2,5 mil" se repetiria em todo o eixo; vai em dólar inteiro.
  const valores = series.flatMap((s) => s.pontos.map((p) => p.valor))
  const fmtValor = Math.max(...valores) - Math.min(...valores) < 1000 ? moedaCurta : moedaEixo
  const comArea = area && series.length === 1

  return (
    <div className="grafico-caixa">
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={linhas} margin={{ top: 20, right: 12, bottom: 4, left: 0 }}>
          {comArea && (
            <defs>
              <linearGradient id="veu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series[0].cor} stopOpacity={0.18} />
                <stop offset="100%" stopColor={series[0].cor} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <XAxis dataKey="data" tickFormatter={fmt} minTickGap={48} {...eixos(corTexto)} />
          <YAxis tickFormatter={fmtValor} width={78} {...eixos(corTexto)} axisLine={false}
            domain={['auto', 'auto']} padding={{ top: 20, bottom: 20 }} />
          <Tooltip content={<DicaLinhas series={series} comHora={comHora} />} cursor={{ stroke: cor('--eixo'), strokeWidth: 1 }} />
          {referencia && (
            <ReferenceLine y={referencia.valor} stroke={corTexto} strokeDasharray="4 4"
              label={{ value: referencia.rotulo, position: 'insideBottomRight', fill: corTexto, fontSize: 12 }} />
          )}
          {comArea && (
            <Area type="linear" dataKey={series[0].nome} stroke="none" fill="url(#veu)" isAnimationActive={false}
              activeDot={false} tooltipType="none" />
          )}
          {series.map((s) => (
            <Line key={s.nome} type="linear" dataKey={s.nome} stroke={s.cor} strokeWidth={2} dot={false}
              activeDot={{ r: 5, stroke: cor('--superficie'), strokeWidth: 2 }} isAnimationActive={false} />
          ))}
          {marcas.map((m) => (
            <ReferenceDot key={m.rotulo} x={m.data} y={m.valor} r={5} fill={cor('--superficie')} stroke={cor('--texto')}
              strokeWidth={2} label={{ value: m.rotulo, position: ladoDoRotulo(m, linhas), fill: cor('--texto-2'), fontSize: 12 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      {series.length > 1 && (
        <div className="legenda">
          {series.map((s) => <span key={s.nome}><i style={{ background: s.cor }} />{s.nome}</span>)}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ velas

function DicaVela({ active, payload, escala }: { active?: boolean; payload?: { payload: Vela }[]; escala: Escala }) {
  if (!active || !payload?.length) return null
  const v = payload[0].payload
  return (
    <div className="dica">
      <strong>{tituloVela(v, escala)}</strong>
      {v.aberta && <div className="terciario">ainda não terminou ({v.dias} {v.dias === 1 ? 'dia' : 'dias'} até agora)</div>}
      <div className={`valor-dica ${v.variacao > 0 ? 'positivo' : v.variacao < 0 ? 'negativo' : ''}`}>
        {v.variacao > 0 ? '▲' : v.variacao < 0 ? '▼' : '●'} {subiuCaiu(v.variacao)} {pct(Math.abs(v.variacao))}
      </div>
      <table>
        <tbody>
          <tr><td>Abriu</td><td className="num">{moeda(v.abertura)}</td></tr>
          <tr><td>Mais alto</td><td className="num">{moeda(v.maxima)}</td></tr>
          <tr><td>Mais baixo</td><td className="num">{moeda(v.minima)}</td></tr>
          <tr><td>Fechou</td><td className="num">{moeda(v.fechamento)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

/** O desenho de uma vela: o pavio vai da mínima à máxima; o corpo, da abertura ao fechamento. */
function DesenhoVela(props: { x?: number; y?: number; width?: number; height?: number; payload?: Vela; sobe: string; cai: string }) {
  const { x = 0, y = 0, width = 0, height = 0, payload: v, sobe, cai } = props
  if (!v) return null
  const amplitude = v.maxima - v.minima || 1
  const yDe = (valor: number) => y + ((v.maxima - valor) / amplitude) * height
  const topo = yDe(Math.max(v.abertura, v.fechamento))
  const base = yDe(Math.min(v.abertura, v.fechamento))
  const largura = Math.max(1, Math.min(14, width))
  const meio = x + width / 2
  const corVela = v.fechamento >= v.abertura ? sobe : cai
  return (
    <g opacity={v.aberta ? 0.55 : 1}>
      <line x1={meio} x2={meio} y1={y} y2={y + height} stroke={corVela} strokeWidth={1} />
      <rect x={meio - largura / 2} y={topo} width={largura} height={Math.max(1, base - topo)} fill={corVela} rx={largura > 5 ? 1.5 : 0} />
    </g>
  )
}

/** Velas: verde quando fechou acima de onde abriu, vermelha quando fechou abaixo. */
export function GraficoVelas({ velas, escala, altura = 340 }: { velas: Vela[]; escala: Escala; altura?: number }) {
  const corTexto = cor('--texto-3')
  const linhas = velas.map((v) => ({ ...v, corpo: [v.minima, v.maxima] }))
  return (
    <div className="grafico-caixa">
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={linhas} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} barCategoryGap="20%">
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <XAxis dataKey="data" tickFormatter={formatoData(velas, escala)} minTickGap={48} {...eixos(corTexto)} />
          <YAxis tickFormatter={moedaEixo} width={78} {...eixos(corTexto)} axisLine={false}
            domain={['auto', 'auto']} padding={{ top: 12, bottom: 12 }} />
          <Tooltip content={<DicaVela escala={escala} />} cursor={{ fill: cor('--superficie-2') }} />
          <Bar dataKey="corpo" isAnimationActive={false}
            shape={(p: object) => <DesenhoVela {...p} sobe={cor('--sobe-marca')} cai={cor('--cai-marca')} />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Uma barra por vela: para cima (verde) se fechou acima da anterior, para baixo (vermelha) se abaixo. */
export function GraficoVariacao({ velas, escala, altura = 340 }: { velas: Vela[]; escala: Escala; altura?: number }) {
  const corTexto = cor('--texto-3')
  const [verde, vermelho] = [cor('--sobe-marca'), cor('--cai-marca')]
  return (
    <div className="grafico-caixa">
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={velas} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
          barCategoryGap={velas.length > 120 ? 1 : '18%'}>
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <XAxis dataKey="data" tickFormatter={formatoData(velas, escala)} minTickGap={48} {...eixos(corTexto)} />
          <YAxis tickFormatter={pctEixo} width={52} {...eixos(corTexto)} axisLine={false} />
          <ReferenceLine y={0} stroke={cor('--eixo')} />
          <Tooltip content={<DicaVela escala={escala} />} cursor={{ fill: cor('--superficie-2') }} />
          <Bar dataKey="variacao" isAnimationActive={false} maxBarSize={24}>
            {velas.map((v) => (
              <Cell key={v.data} fill={v.variacao >= 0 ? verde : vermelho} fillOpacity={v.aberta ? 0.55 : 1} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ------------------------------------------------------------------ faixa prevista contra o real

function DicaFaixa({ active, payload }: { active?: boolean; payload?: { payload: FaixaReal }[] }) {
  if (!active || !payload?.length) return null
  const f = payload[0].payload
  const dentro = f.real >= f.min && f.real <= f.max
  return (
    <div className="dica">
      <div className="terciario">{data(f.data)}</div>
      <div className="valor-dica">{moeda(f.real)}</div>
      <div className="terciario">previsto na véspera: {moeda(f.min)} a {moeda(f.max)}</div>
      <div className={dentro ? 'positivo' : 'negativo'} style={{ fontWeight: 600, marginTop: 4 }}>
        {dentro ? '✓ caiu dentro da faixa' : '✗ ficou fora da faixa'}
      </div>
    </div>
  )
}

/** A faixa prevista na véspera (o véu azul) e o preço que veio (a linha). Ponto vermelho: ficou fora. */
export function GraficoFaixa({ pontos, altura = 280 }: { pontos: FaixaReal[]; altura?: number }) {
  const corTexto = cor('--texto-3')
  const linhas = pontos.map((p) => ({ ...p, banda: [p.min, p.max], fora: p.real < p.min || p.real > p.max }))
  const vermelho = cor('--cai-marca')
  const superficie = cor('--superficie')
  return (
    <div className="grafico-caixa">
      <ResponsiveContainer width="100%" height={altura}>
        <ComposedChart data={linhas} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <XAxis dataKey="data" tickFormatter={dataCurta} minTickGap={48} {...eixos(corTexto)} />
          <YAxis tickFormatter={moedaEixo} width={78} {...eixos(corTexto)} axisLine={false}
            domain={['auto', 'auto']} padding={{ top: 10, bottom: 10 }} />
          <Tooltip content={<DicaFaixa />} cursor={{ stroke: cor('--eixo'), strokeWidth: 1 }} />
          <Area type="linear" dataKey="banda" stroke="none" fill={cor('--acento')} fillOpacity={0.18} isAnimationActive={false}
            activeDot={false} />
          <Line type="linear" dataKey="real" stroke={cor('--texto')} strokeWidth={2} isAnimationActive={false}
            activeDot={{ r: 5, stroke: superficie, strokeWidth: 2 }}
            dot={(p: { cx?: number; cy?: number; payload?: { fora: boolean }; index?: number }) =>
              p.payload?.fora
                ? <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={vermelho} stroke={superficie} strokeWidth={2} />
                : <g key={p.index} />} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="legenda">
        <span><i className="caixa" style={{ background: cor('--acento'), opacity: 0.35 }} />faixa prevista na véspera (80%)</span>
        <span><i style={{ background: cor('--texto') }} />preço que veio</span>
        <span><i className="caixa" style={{ background: vermelho, width: 10, borderRadius: 5 }} />ficou fora</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ minigráfico

/** Linha pequena, sem eixo, para mostrar o desenho dos últimos dias ao lado de um número. */
export function Mini({ pontos, altura = 56, rotulo }: { pontos: Ponto[]; altura?: number; rotulo: string }) {
  const subiu = pontos.length > 1 && pontos[pontos.length - 1].valor >= pontos[0].valor
  const c = cor(subiu ? '--sobe-marca' : '--cai-marca')
  return (
    <div role="img" aria-label={rotulo} style={{ width: '100%', height: altura }}>
      <ResponsiveContainer width="100%" height={altura}>
        <LineChart data={pontos} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line type="linear" dataKey="valor" stroke={c} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
