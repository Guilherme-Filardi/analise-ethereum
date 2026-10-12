import { useEffect, useState } from 'react'
import { Abas } from '../Abas'
import type { Cenario, Cenarios, Compra, Limites, SeguirVereditos } from '../api'
import { cor } from '../cores'
import { EscolhaMes } from '../EscolhaMes'
import { Escolhas } from '../Escolhas'
import { Explica } from '../Explica'
import { GraficoLinhas } from '../Grafico'
import { corDoSinal, data, deCada100, moeda, moedaCurta, pct, somarDias } from '../formato'
import { useDado } from '../usar'
import './telas.css'

type Aba = 'compra' | 'hoje' | 'palpites'

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'compra', nome: 'Se eu tivesse comprado' },
  { id: 'hoje', nome: 'Se eu comprar hoje' },
  { id: 'palpites', nome: 'Se eu seguisse os palpites' },
]

const VALORES = [100, 1000, 10000].map((v) => ({ id: v, nome: moedaCurta(v) }))

/**
 * Pede à API um instante depois da última mudança (enquanto a pessoa digita o valor, não precisa
 * calcular a cada tecla). O resultado anterior fica na tela até o novo chegar, junto com o valor
 * que o gerou, para a frase nunca misturar o valor novo com a conta antiga.
 */
function useConta<T>(endereco: string, valor: number) {
  const [pedido, setPedido] = useState({ endereco, valor })
  useEffect(() => {
    const espera = setTimeout(() => setPedido({ endereco, valor }), 250)
    return () => clearTimeout(espera)
  }, [endereco, valor])
  const { dado, erro, atualizando } = useDado<T>(pedido.endereco)
  const [mostrado, setMostrado] = useState<{ r: T; valor: number } | null>(null)
  if (dado && !atualizando && mostrado?.r !== dado) setMostrado({ r: dado, valor: pedido.valor })
  return { mostrado, erro, atualizando: atualizando || pedido.endereco !== endereco }
}

/** Valor em dólar com ▲ ou ▼ e a cor, comparado ao que a pessoa colocou. */
function Dinheiro({ v, base }: { v: number; base: number }) {
  const simbolo = v > base ? '▲ ' : v < base ? '▼ ' : ''
  return <span className={corDoSinal(v - base)}>{simbolo}{moedaCurta(v)}</span>
}

/** "Quanto?": botões prontos e um campo para outro valor. */
function EscolhaValor({ valor, mudar }: { valor: number; mudar: (v: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  return (
    <fieldset className="campo-grupo">
      <legend>Quanto (em dólar)?</legend>
      <Escolhas opcoes={VALORES} atual={valor} mudar={(v) => { mudar(v); setTexto(String(v)) }} rotulo="Valores prontos" />
      <label className="campo-curto">
        <span>ou outro valor: US$</span>
        <input type="number" min="1" inputMode="decimal" value={texto}
          onChange={(e) => { setTexto(e.target.value); const n = Number(e.target.value); if (n > 0) mudar(n) }} />
      </label>
    </fieldset>
  )
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? <p className="erro" role="alert">{texto}</p> : null
}

const classeResultado = (atualizando: boolean) => `cartao${atualizando ? ' recarregando' : ''}`

/** O mesmo dia, N anos antes do último dia com preço (29/02 vira 28/02). */
function anosAtras(ultimo: string, anos: number): string {
  const [ano, mes, dia] = ultimo.split('-')
  const diaSeguro = mes === '02' && dia === '29' ? '28' : dia
  return `${Number(ano) - anos}-${mes}-${diaSeguro}`
}

// ------------------------------------------------------------- se eu tivesse comprado

function TivesseComprado({ limites }: { limites: Limites }) {
  const [valor, setValor] = useState(1000)
  const [compra, setCompra] = useState(anosAtras(limites.ultimo, 1))
  const [vendeuHoje, setVendeuHoje] = useState(true)
  const [venda, setVenda] = useState(`${limites.ultimo.slice(0, 7)}-01`)
  const atalhos = [
    { id: anosAtras(limites.ultimo, 1), nome: '1 ano atrás' },
    { id: anosAtras(limites.ultimo, 3), nome: '3 anos atrás' },
    { id: anosAtras(limites.ultimo, 5), nome: '5 anos atrás' },
    { id: limites.primeiro, nome: 'No começo (2017)' },
  ]
  const { mostrado, erro, atualizando } = useConta<Compra>(
    `/api/simular/compra?valor=${valor}&compra=${compra}&venda=${vendeuHoje ? 'hoje' : venda}`, valor,
  )

  return (
    <div className="grade">
      <section className="cartao">
        <div className="formulario">
          <EscolhaValor valor={valor} mudar={setValor} />
          <fieldset className="campo-grupo">
            <legend>Quando comprou?</legend>
            <Escolhas opcoes={atalhos} atual={compra} mudar={setCompra} rotulo="Atalhos de data da compra" />
            <EscolhaMes rotulo="ou escolha o dia" valor={compra} mudar={setCompra} primeiro={limites.primeiro} ultimo={limites.ultimo} />
          </fieldset>
          <fieldset className="campo-grupo">
            <legend>Quando vendeu?</legend>
            <Escolhas
              estilo="segmento"
              opcoes={[{ id: 'hoje', nome: 'Hoje (último preço)' }, { id: 'outro', nome: 'Em outro dia' }]}
              atual={vendeuHoje ? 'hoje' : 'outro'}
              mudar={(id) => setVendeuHoje(id === 'hoje')}
              rotulo="Quando vendeu"
            />
            {!vendeuHoje && (
              <EscolhaMes rotulo="dia da venda" valor={venda} mudar={setVenda} primeiro={limites.primeiro} ultimo={limites.ultimo} />
            )}
          </fieldset>
        </div>
        <Explica titulo="Como a conta é feita?">
          <p>Simula uma compra de verdade no passado, com o preço real de cada dia.</p>
          <p>
            A compra e a venda acontecem no preço de fechamento do dia escolhido (21h em Brasília). "Hoje" é o
            último dia com preço fechado.
          </p>
          <p>Desconta a taxa da corretora (0,1% na compra e 0,1% na venda). Imposto e câmbio do real ficam de fora.</p>
        </Explica>
      </section>

      <Erro texto={erro} />
      {mostrado && !erro && <ResultadoCompra r={mostrado.r} valor={mostrado.valor} atualizando={atualizando} />}
    </div>
  )
}

function ResultadoCompra({ r, valor, atualizando }: { r: Compra; valor: number; atualizando: boolean }) {
  const caiuMuito = r.pior_retorno < -0.01
  return (
    <>
      <section className={classeResultado(atualizando)} aria-busy={atualizando}>
        <p className="frase grande-frase" role="status" aria-live="polite">
          Se você tivesse colocado <strong>{moeda(valor)}</strong> em ETH em {data(r.dia_compra)} e vendido
          em {data(r.dia_venda)}, teria <strong className={corDoSinal(r.retorno)}>{moeda(r.valor_final)}</strong>.
        </p>
        <div className="kpis quatro">
          <div className="kpi">
            <div className="rotulo">Você colocou</div>
            <div className="valor-grande num">{moedaCurta(valor)}</div>
            <div className="nota">ETH a {moeda(r.preco_compra)}</div>
          </div>
          <div className="kpi">
            <div className="rotulo">Teria no fim</div>
            <div className="valor-grande num"><Dinheiro v={r.valor_final} base={valor} /></div>
            <div className="nota">ETH a {moeda(r.preco_venda)}</div>
          </div>
          <div className="kpi">
            <div className="rotulo">{r.retorno >= 0 ? 'Ganho' : 'Perda'}</div>
            <div className={`valor-grande num ${corDoSinal(r.retorno)}`}>
              {r.retorno > 0 ? '▲ ' : r.retorno < 0 ? '▼ ' : ''}{moedaCurta(Math.abs(r.valor_final - valor))}
            </div>
            <div className="nota">{pct(r.retorno, true)} sobre o que você colocou</div>
          </div>
          <div className="kpi">
            <div className="rotulo">Pior momento</div>
            {caiuMuito ? (
              <>
                <div className="valor-grande num negativo">▼ {moedaCurta(r.pior_valor)}</div>
                <div className="nota">em {data(r.pior_dia)}, {pct(Math.abs(r.pior_retorno))} abaixo</div>
              </>
            ) : (
              <>
                <div className="valor-grande">Nenhum</div>
                <div className="nota">nunca ficou mais de 1% abaixo</div>
              </>
            )}
          </div>
        </div>
        {caiuMuito && (
          <p className="frase">
            No pior momento, o seu dinheiro valia só <strong className="negativo">{moeda(r.pior_valor)}</strong>. Quem
            vendesse ali, de susto, teria ficado com isso.
          </p>
        )}
      </section>

      <section className={classeResultado(atualizando)}>
        <div className="cartao-cab"><h2 className="cartao-titulo">Quanto o seu dinheiro valeu, dia a dia</h2></div>
        <GraficoLinhas
          area
          series={[{ nome: 'Seu dinheiro', pontos: r.carteira, cor: cor('--serie-1') }]}
          referencia={{ valor, rotulo: `o que você colocou: ${moedaCurta(valor)}` }}
          marcas={caiuMuito
            ? [{ data: r.pior_dia, valor: r.pior_valor, rotulo: `pior momento: ${moedaCurta(r.pior_valor)}`, embaixo: true }]
            : []}
        />
      </section>
    </>
  )
}

// ------------------------------------------------------------- se eu comprar hoje

function ComprarHoje() {
  const [valor, setValor] = useState(1000)
  const [grupo, setGrupo] = useState<'todos' | 'parecidos'>('todos')
  const { mostrado, erro, atualizando } = useConta<Cenarios>(`/api/simular/hoje?valor=${valor}`, valor)
  const r = mostrado?.r

  return (
    <div className="grade">
      <section className="cartao">
        <div className="formulario">
          <EscolhaValor valor={valor} mudar={setValor} />
          <fieldset className="campo-grupo">
            <legend>Comparar com</legend>
            <Escolhas
              opcoes={[
                { id: 'todos', nome: 'Todas as compras desde 2017' },
                { id: 'parecidos', nome: 'Só dias com o preço igualmente longe do recorde' },
              ]}
              atual={grupo}
              mudar={setGrupo}
              rotulo="Com quais compras comparar"
            />
          </fieldset>
        </div>
        <Explica titulo="Como a conta é feita?">
          <p>
            Para cada dia do passado, o site vê quanto uma compra naquele dia valia 1, 3, 6 e 12 meses depois. Juntando
            todas, dá para ver o que é comum e o que é raro.
          </p>
          <p>
            "Caso ruim" e "caso bom" deixam de fora os 10% piores e os 10% melhores resultados, que são raros. Entre
            eles ficam 8 de cada 10 compras. "Típico" é o do meio.
          </p>
          <p>Verde (▲) quer dizer mais do que você colocou; vermelho (▼), menos.</p>
        </Explica>
      </section>

      <Erro texto={erro} />
      {r && mostrado && !erro && (
        <>
          <section className={classeResultado(atualizando)} aria-busy={atualizando}>
            <p className="frase grande-frase" role="status" aria-live="polite">
              Ninguém sabe o futuro. O que dá para mostrar é o que aconteceu com quem comprou{' '}
              <strong>{moeda(mostrado.valor)}</strong> no passado
              {grupo === 'parecidos'
                ? `, em dias em que o preço estava, como hoje, uns ${pct(r.queda_hoje)} abaixo do maior preço já visto.`
                : ', em qualquer dia desde 2017.'}
            </p>
            <ul className="lista">
              <li><strong>Caso ruim:</strong> só 1 de cada 10 compras foi pior.</li>
              <li><strong>Típico:</strong> metade foi melhor, metade foi pior.</li>
              <li><strong>Caso bom:</strong> só 1 de cada 10 compras foi melhor.</li>
            </ul>
            {grupo === 'parecidos' && (
              <p className="frase">
                Esses dias se concentram nas grandes quedas, como as de 2018 e 2022 ({r.episodios_parecidos} trechos de
                dias seguidos). Dias vizinhos se parecem muito entre si: é menos exemplo do que parece. Trate como
                pista, não como regra.
              </p>
            )}
          </section>
          {r.prazos.map((p) => (
            <Prazo key={p.prazo} prazo={p.prazo} valor={mostrado.valor} c={p[grupo]} atualizando={atualizando} />
          ))}
        </>
      )}
    </div>
  )
}

/** Um prazo ("daqui a 3 meses"): quatro números lado a lado. */
function Prazo({ prazo, valor, c, atualizando }: { prazo: string; valor: number; c: Cenario; atualizando: boolean }) {
  return (
    <section className={classeResultado(atualizando)}>
      <div className="cartao-cab">
        <h2 className="cartao-titulo">Daqui a {prazo}</h2>
        {c && <span className="cartao-sub">{c.compras.toLocaleString('pt-BR')} compras comparadas</span>}
      </div>
      {!c ? (
        <p className="secundario">Sem casos suficientes neste prazo.</p>
      ) : (
        <div className="kpis quatro">
          <div className="kpi">
            <div className="rotulo">Caso ruim</div>
            <div className="valor-grande num"><Dinheiro v={c.ruim} base={valor} /></div>
          </div>
          <div className="kpi">
            <div className="rotulo">Típico</div>
            <div className="valor-grande num"><Dinheiro v={c.tipico} base={valor} /></div>
          </div>
          <div className="kpi">
            <div className="rotulo">Caso bom</div>
            <div className="valor-grande num"><Dinheiro v={c.bom} base={valor} /></div>
          </div>
          <div className="kpi">
            <div className="rotulo">No prejuízo</div>
            <div className="valor-grande">{deCada100(c.no_prejuizo)}</div>
            <div className="nota">das compras</div>
          </div>
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------- se eu seguisse os palpites

function SeguirPalpites({ limites }: { limites: Limites }) {
  const [valor, setValor] = useState(1000)
  const [desde, setDesde] = useState('2018-01-01')
  const { mostrado, erro, atualizando } = useConta<SeguirVereditos>(
    `/api/simular/vereditos?valor=${valor}&desde=${desde}`, valor,
  )

  return (
    <div className="grade">
      <section className="cartao">
        <div className="formulario">
          <EscolhaValor valor={valor} mudar={setValor} />
          <EscolhaMes rotulo="Começando em" valor={desde} mudar={setDesde} primeiro="2017-10-01" ultimo={somarDias(limites.ultimo, -1)} />
        </div>
        <Explica titulo="Como a conta é feita?">
          <p>
            Usa os palpites da regra antiga (versão 1). Imagina seguir à risca o palpite de cada dia: comprar ETH
            quando o palpite é "subir", vender quando é "cair" e, quando é "sem palpite", não mexer em nada. Começa
            com o dinheiro parado.
          </p>
          <p>
            Os palpites do passado foram refeitos usando, em cada dia, só o que se sabia naquele dia. Cada compra ou
            venda paga 0,1% de taxa.
          </p>
          <p>
            Por que pode perder mesmo acertando mais da metade? Porque acertar conta os dias, não o tamanho do
            movimento. Ficar de fora em poucos dias de alta muito forte custa mais que muitos acertos pequenos.
          </p>
        </Explica>
      </section>

      <Erro texto={erro} />
      {mostrado && !erro && <ResultadoPalpites r={mostrado.r} valor={mostrado.valor} atualizando={atualizando} />}
    </div>
  )
}

function ResultadoPalpites({ r, valor, atualizando }: { r: SeguirVereditos; valor: number; atualizando: boolean }) {
  const seguindo = r.seguindo[r.seguindo.length - 1].valor
  const esperando = r.esperando[r.esperando.length - 1].valor
  return (
    <>
      <section className={classeResultado(atualizando)} aria-busy={atualizando}>
        <p className="frase grande-frase" role="status" aria-live="polite">
          Começando em {data(r.seguindo[0].data)} com {moeda(valor)}, seguir os palpites{' '}
          {seguindo > esperando ? 'ganhou' : 'perdeu'} de comprar e esquecer: <strong className={corDoSinal(seguindo - valor)}>
            {moeda(seguindo)}</strong> contra <strong className={corDoSinal(esperando - valor)}>{moeda(esperando)}</strong>.
        </p>
        <div className="kpis quatro">
          <div className="kpi">
            <div className="rotulo">Seguindo os palpites</div>
            <div className="valor-grande num"><Dinheiro v={seguindo} base={valor} /></div>
            <div className="nota">maior queda no caminho: {pct(Math.abs(r.maior_queda_seguindo))}</div>
          </div>
          <div className="kpi">
            <div className="rotulo">Comprando e esquecendo</div>
            <div className="valor-grande num"><Dinheiro v={esperando} base={valor} /></div>
            <div className="nota">maior queda no caminho: {pct(Math.abs(r.maior_queda_esperando))}</div>
          </div>
          <div className="kpi">
            <div className="rotulo">Compras e vendas</div>
            <div className="valor-grande num">{r.operacoes.toLocaleString('pt-BR')}</div>
            <div className="nota">cada uma paga 0,1% de taxa</div>
          </div>
          <div className="kpi">
            <div className="rotulo">Tempo com ETH</div>
            <div className="valor-grande num">{pct(r.tempo_comprado)}</div>
            <div className="nota">do período, seguindo os palpites</div>
          </div>
        </div>
      </section>

      <section className={classeResultado(atualizando)}>
        <div className="cartao-cab"><h2 className="cartao-titulo">Os dois jeitos, dia a dia</h2></div>
        <GraficoLinhas
          series={[
            { nome: 'Seguindo os palpites', pontos: r.seguindo, cor: cor('--serie-1') },
            { nome: 'Comprando e esquecendo', pontos: r.esperando, cor: cor('--serie-2') },
          ]}
          referencia={{ valor, rotulo: `o que você colocou: ${moedaCurta(valor)}` }}
          altura={340}
        />
      </section>
    </>
  )
}

export function Simular() {
  const [aba, setAba] = useState<Aba>('compra')
  const { dado: limites, erro } = useDado<Limites>('/api/limites')
  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Simular</h1>
          <p>Veja o que teria acontecido com o seu dinheiro, com o preço real de cada dia.</p>
        </div>
      </header>
      <div className="abas-largas">
        <Abas opcoes={ABAS} atual={aba} mudar={setAba} rotulo="Simulações" />
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!limites && !erro && <p className="carregando">Carregando...</p>}
      {limites && (
        <>
          {aba === 'compra' && <TivesseComprado limites={limites} />}
          {aba === 'hoje' && <ComprarHoje />}
          {aba === 'palpites' && <SeguirPalpites limites={limites} />}
        </>
      )}
    </>
  )
}
