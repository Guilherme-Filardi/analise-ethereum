import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Ponto } from './api'
import { cor } from './cores'
import { data, dataCurta, moeda, moedaCurta } from './formato'

type Serie = { nome: string; pontos: Ponto[]; cor: string }

/** Gráfico de linhas por data, com valor em US$. Uma série não ganha legenda: o título diz. */
export function GraficoLinhas({ series, referencia, altura = 280 }: {
  series: Serie[]
  referencia?: { valor: number; rotulo: string }
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
      <LineChart data={linhas} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={cor('--grade')} vertical={false} />
        <XAxis dataKey="data" tickFormatter={dataCurta} minTickGap={40} stroke={corTexto} fontSize={12} />
        <YAxis
          tickFormatter={moedaCurta}
          width={90}
          stroke={corTexto}
          fontSize={12}
        />
        <Tooltip
          labelFormatter={(rotulo) => data(String(rotulo))}
          formatter={(valor) => moeda(Number(valor))}
          contentStyle={{ background: cor('--superficie'), border: `1px solid ${cor('--borda')}` }}
          labelStyle={{ color: cor('--texto') }}
        />
        {series.length > 1 && <Legend formatter={(nome) => <span style={{ color: corTexto }}>{nome}</span>} />}
        {referencia && (
          <ReferenceLine
            y={referencia.valor}
            stroke={corTexto}
            strokeDasharray="4 4"
            label={{ value: referencia.rotulo, position: 'insideBottomRight', fill: corTexto, fontSize: 12 }}
          />
        )}
        {series.map((s) => (
          <Line key={s.nome} type="monotone" dataKey={s.nome} stroke={s.cor} strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
