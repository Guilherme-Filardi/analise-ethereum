import { useState } from 'react'
import type { Precos } from '../api'
import { cor } from '../cores'
import { Escolhas } from '../Escolhas'
import { Explica } from '../Explica'
import { GraficoLinhas } from '../Grafico'
import { corDoSinal, data, moeda, moedaCurta, pct, subiuCaiu } from '../formato'
import { useDado } from '../usar'

type Periodo = '7d' | '1m' | '3m' | '1a' | '3a' | 'tudo'

const PERIODOS: { id: Periodo; nome: string; frase: string }[] = [
  { id: '7d', nome: '7 dias', frase: 'Em 7 dias' },
  { id: '1m', nome: '1 mês', frase: 'Em 1 mês' },
  { id: '3m', nome: '3 meses', frase: 'Em 3 meses' },
  { id: '1a', nome: '1 ano', frase: 'Em 1 ano' },
  { id: '3a', nome: '3 anos', frase: 'Em 3 anos' },
  { id: 'tudo', nome: 'Tudo (desde 2017)', frase: 'Desde 2017' },
]

export function Preco() {
  const [periodo, setPeriodo] = useState<Periodo>('1a')
  const { dado: p, erro } = useDado<Precos>(`/api/precos?periodo=${periodo}`)
  const frase = PERIODOS.find((x) => x.id === periodo)!.frase

  return (
    <section className="cartao" aria-labelledby="titulo-preco">
      <h2 id="titulo-preco">Quanto vale 1 ETH</h2>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {p && (
        <>
          <p className="destaque">{moeda(p.preco_fim)}</p>
          <p className="secundario">Preço de 1 ETH, em dólar, no fechamento de {data(p.fim)} (21h em Brasília).</p>

          <Escolhas opcoes={PERIODOS} atual={periodo} mudar={setPeriodo} rotulo="Período do gráfico" />

          <p className="frase">
            {frase}, o preço <strong className={corDoSinal(p.variacao)}>{subiuCaiu(p.variacao)} {pct(Math.abs(p.variacao))}</strong>:
            de {moeda(p.preco_inicio)} ({data(p.inicio)}) para {moeda(p.preco_fim)}.
          </p>

          <GraficoLinhas
            series={[{ nome: 'Preço de 1 ETH', pontos: p.serie, cor: cor('--serie-1') }]}
            marcas={[
              { data: p.maior_dia, valor: p.maior, rotulo: `mais caro: ${moedaCurta(p.maior)}` },
              { data: p.menor_dia, valor: p.menor, rotulo: `mais barato: ${moedaCurta(p.menor)}`, embaixo: true },
            ]}
            altura={360}
          />

          <div className="numeros">
            <div className="numero">
              <div className="rotulo">Mais caro no período</div>
              <div className="valor">{moeda(p.maior)}</div>
              <div className="nota">em {data(p.maior_dia)}</div>
            </div>
            <div className="numero">
              <div className="rotulo">Mais barato no período</div>
              <div className="valor">{moeda(p.menor)}</div>
              <div className="nota">em {data(p.menor_dia)}</div>
            </div>
          </div>

          <Explica titulo="Como ler este gráfico?">
            <p>Cada ponto da linha é o preço de 1 ETH, em dólar, no fim de um dia.</p>
            <p>
              O "fim do dia" é às 21h em Brasília (meia-noite em Londres), porque é quando a Binance, de onde vem o
              dado, fecha o dia. Por isso o último ponto é sempre o de ontem, até as 21h de hoje.
            </p>
            <p>Passe o mouse (ou o dedo) sobre a linha para ver o preço de cada dia.</p>
            <p>Os botões acima mudam o período: dos últimos 7 dias até tudo desde agosto de 2017.</p>
          </Explica>
        </>
      )}
    </section>
  )
}
