import { useState } from 'react'
import type { Escala, Precos, Velas } from '../api'
import { cor } from '../cores'
import { Escolhas } from '../Escolhas'
import { Explica } from '../Explica'
import { GraficoLinhas, GraficoVariacao, GraficoVelas } from '../Grafico'
import { data, moeda, moedaCurta, pct, subiuCaiu } from '../formato'
import { useDado } from '../usar'

type Periodo = '7d' | '1m' | '3m' | '1a' | '3a' | 'tudo'
type Tipo = 'linha' | 'velas' | 'barras'

const PERIODOS: { id: Periodo; nome: string; frase: string; escala: Escala }[] = [
  { id: '7d', nome: '7D', frase: 'Em 7 dias', escala: 'dia' },
  { id: '1m', nome: '1M', frase: 'Em 1 mês', escala: 'dia' },
  { id: '3m', nome: '3M', frase: 'Em 3 meses', escala: 'dia' },
  { id: '1a', nome: '1A', frase: 'Em 1 ano', escala: 'dia' },
  { id: '3a', nome: '3A', frase: 'Em 3 anos', escala: 'semana' },
  { id: 'tudo', nome: 'Tudo', frase: 'Desde 2017', escala: 'mes' },
]

const TIPOS: { id: Tipo; nome: string }[] = [
  { id: 'linha', nome: 'Linha' },
  { id: 'velas', nome: 'Velas' },
  { id: 'barras', nome: 'Sobe e desce' },
]

const ESCALAS: { id: Escala; nome: string }[] = [
  { id: 'dia', nome: 'Dia a dia' },
  { id: 'semana', nome: 'Semana' },
  { id: 'mes', nome: 'Mês' },
]

const PALAVRA: Record<Escala, [string, string]> = { dia: ['dia', 'dias'], semana: ['semana', 'semanas'], mes: ['mês', 'meses'] }

/** O cartão do preço: o gráfico e os controles de período, tipo e escala. */
export function Preco({ altura = 340 }: { altura?: number }) {
  const [periodo, setPeriodo] = useState<Periodo>('1a')
  const [tipo, setTipo] = useState<Tipo>('linha')
  const [escala, setEscala] = useState<Escala>('dia')
  const info = PERIODOS.find((x) => x.id === periodo)!

  // Ao trocar de período, a escala volta para a que cabe nele (dia até 1 ano, semana em 3 anos,
  // mês desde 2017). Ela continua livre para mudar depois.
  function mudarPeriodo(p: Periodo) {
    setPeriodo(p)
    setEscala(PERIODOS.find((x) => x.id === p)!.escala)
  }

  const linha = useDado<Precos>(tipo === 'linha' ? `/api/precos?periodo=${periodo}` : null)
  const velas = useDado<Velas>(tipo !== 'linha' ? `/api/velas?periodo=${periodo}&escala=${escala}` : null)
  const atual = tipo === 'linha' ? linha : velas
  const [um, varios] = PALAVRA[escala]

  return (
    <section className="cartao" aria-labelledby="titulo-grafico-preco">
      <div className="cartao-cab">
        <div>
          <h2 id="titulo-grafico-preco" className="cartao-titulo">Preço do ETH</h2>
          <p className="cartao-sub">Fechamento de cada {tipo === 'linha' ? 'dia' : um}, em dólar</p>
        </div>
        <Escolhas opcoes={TIPOS} atual={tipo} mudar={setTipo} rotulo="Tipo de gráfico" estilo="segmento" />
      </div>
      <div className="controles">
        <Escolhas opcoes={PERIODOS} atual={periodo} mudar={mudarPeriodo} rotulo="Período" estilo="segmento" />
        {tipo !== 'linha' && (
          <Escolhas opcoes={ESCALAS} atual={escala} mudar={setEscala} rotulo="Escala: cada barra é um" estilo="segmento" />
        )}
      </div>

      {atual.erro && <p className="erro" role="alert">{atual.erro}</p>}
      {!atual.dado && !atual.erro && <div className="carregando" style={{ height: altura }}>Carregando...</div>}

      {tipo === 'linha' && linha.dado && (
        <div className={linha.atualizando ? 'grafico-caixa recarregando' : 'grafico-caixa'}>
          <p className="frase" style={{ marginTop: 0 }}>
            {info.frase}, o preço{' '}
            <strong className={linha.dado.variacao >= 0 ? 'positivo' : 'negativo'}>
              {linha.dado.variacao >= 0 ? '▲' : '▼'} {subiuCaiu(linha.dado.variacao)} {pct(Math.abs(linha.dado.variacao))}
            </strong>
            , de {moeda(linha.dado.preco_inicio)} para {moeda(linha.dado.preco_fim)}.
          </p>
          <GraficoLinhas
            area
            series={[{ nome: 'Preço de 1 ETH', pontos: linha.dado.serie, cor: cor('--serie-1') }]}
            marcas={[
              { data: linha.dado.maior_dia, valor: linha.dado.maior, rotulo: `máx. ${moedaCurta(linha.dado.maior)}` },
              { data: linha.dado.menor_dia, valor: linha.dado.menor, rotulo: `mín. ${moedaCurta(linha.dado.menor)}`, embaixo: true },
            ]}
            altura={altura}
          />
          <p className="nota">
            Mais caro: {moeda(linha.dado.maior)} em {data(linha.dado.maior_dia)}. Mais barato: {moeda(linha.dado.menor)} em{' '}
            {data(linha.dado.menor_dia)}.
          </p>
        </div>
      )}

      {tipo !== 'linha' && velas.dado && (
        <div className={velas.atualizando ? 'grafico-caixa recarregando' : 'grafico-caixa'}>
          <p className="frase" style={{ marginTop: 0 }}>
            {info.frase}: <strong>{velas.dado.velas.length} {velas.dado.velas.length === 1 ? um : varios}</strong>. Subiu em{' '}
            <strong className="positivo">▲ {velas.dado.subiu}</strong> e caiu em <strong className="negativo">▼ {velas.dado.caiu}</strong>.
            Num {um} comum, mexeu {pct(velas.dado.mexida_tipica)}.
          </p>
          {tipo === 'velas'
            ? <GraficoVelas velas={velas.dado.velas} escala={escala} altura={altura} />
            : <GraficoVariacao velas={velas.dado.velas} escala={escala} altura={altura} />}
          <p className="nota">
            Maior alta: <span className="positivo">{pct(velas.dado.maior_alta, true)}</span> em {data(velas.dado.maior_alta_dia)}.
            Maior queda: <span className="negativo">{pct(velas.dado.maior_queda, true)}</span> em {data(velas.dado.maior_queda_dia)}.
          </p>
        </div>
      )}

      <Explica titulo="Como ler este gráfico">
        <p>O "fim do dia" é às 21h em Brasília, quando a Binance (de onde vem o preço) fecha o dia.</p>
        <p><strong>Linha:</strong> o preço de fechamento de cada dia. Passe o mouse ou o dedo para ver o valor.</p>
        <p>
          <strong>Velas:</strong> cada vela mostra onde o preço abriu e fechou (a parte grossa) e o mais alto e o mais
          baixo que chegou (o fio). Verde: fechou acima de onde abriu. Vermelha: fechou abaixo.
        </p>
        <p>
          <strong>Sobe e desce:</strong> quanto o preço subiu ou caiu em cada {um}, contra o fechamento anterior.
        </p>
        <p>
          A <strong>escala</strong> diz o que é cada barra: um dia, uma semana (de segunda a domingo) ou um mês. A última
          semana ou mês pode estar ainda aberta, e aparece mais clara.
        </p>
      </Explica>
    </section>
  )
}
