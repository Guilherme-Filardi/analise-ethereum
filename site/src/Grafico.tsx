import {
  CartesianGrid, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Ponto } from './api'
import { cor } from './cores'
import { data, dataCurta, moeda, moedaCurta } from './formato'

type Serie = { nome: string; pontos: Ponto[]; cor: string }
type Marca = { data: string; valor: number; rotulo: string; embaixo?: boolean }

/** Ponto perto da borda esquerda ou direita: o texto vai para dentro, para não cobrir o eixo. */
function ladoDoRotulo(m: Marca, linhas: Record<string, number | string>[]): 'top' | 'bottom' | 'right' | 'left' {
  const posicao = linhas.findIndex((l) => l.data === m.data) / Math.max(1, linhas.length - 1)
  if (posicao < 0.12) return 'right'
  if (posicao > 0.88) return 'left'
  return m.embaixo ? 'bottom' : 'top'
}

/**
 * Gráfico de linhas por data, com valor em US$. Uma série só não ganha legenda: o título diz.
 * `referencia` desenha uma linha tracejada (por exemplo, "o que você colocou");
 * `marcas` destaca pontos com um texto (por exemplo, o mais caro e o mais barato).
 */
export function GraficoLinhas({ series, referencia, marcas = [], altura = 300 }: {
  series: Serie[]
  referencia?: { valor: number; rotulo: string }
  marcas?: Marca[]
  altura?: number
}) {
  // O Recharts quer uma linha por data, com uma coluna por série.
  const porData = new Map<string, Record<string, number | string>>()
  for (const s of series) {
    for (const p of s.pontos) {
      const linha = porData.get(p.data) ?? { data: p.data }
      linha[s.nome] = p.valor
      porData.set(p.data, linha)
    }
  }
  const linhas = [...porData.values()].sort((a, b) => String(a.data).localeCompare(String(b.data)))
  const corTexto = cor('--texto-2')

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={linhas} margin={{ top: 24, right: 24, bottom: 16, left: 8 }}>
        <CartesianGrid stroke={cor('--grade')} vertical={false} />
        <XAxis dataKey="data" tickFormatter={dataCurta} minTickGap={50} stroke={corTexto} fontSize={12} />
        {/* Folga de 28 px em cima e embaixo, para os rótulos não encostarem no eixo; os números seguem redondos. */}
        <YAxis tickFormatter={moedaCurta} width={90} stroke={corTexto} fontSize={12} domain={['auto', 'auto']}
          padding={{ top: 28, bottom: 28 }} />
        <Tooltip
          labelFormatter={(rotulo) => `Dia ${data(String(rotulo))}`}
          formatter={(valor, nome) => [moeda(Number(valor)), String(nome)]}
          contentStyle={{ background: cor('--superficie'), border: `1px solid ${cor('--borda')}`, borderRadius: 8 }}
          labelStyle={{ color: cor('--texto'), fontWeight: 600 }}
        />
        {series.length > 1 && <Legend formatter={(nome) => <span style={{ color: corTexto }}>{nome}</span>} />}
        {referencia && (
          <ReferenceLine
            y={referencia.valor}
            stroke={corTexto}
            strokeDasharray="5 5"
            label={{ value: referencia.rotulo, position: 'insideBottomRight', fill: corTexto, fontSize: 12 }}
          />
        )}
        {series.map((s) => (
          <Line key={s.nome} type="linear" dataKey={s.nome} stroke={s.cor} strokeWidth={2} dot={false}
            activeDot={{ r: 5 }} isAnimationActive={false} />
        ))}
        {marcas.map((m) => (
          <ReferenceDot key={m.rotulo} x={m.data} y={m.valor} r={5} fill={cor('--superficie')} stroke={cor('--texto')}
            strokeWidth={2} label={{ value: m.rotulo, position: ladoDoRotulo(m, linhas), fill: cor('--texto'), fontSize: 12 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
