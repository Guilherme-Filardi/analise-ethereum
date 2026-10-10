import { useEffect, useState } from 'react'
import { Abas } from '../Abas'
import { pedir, type Cenarios, type Compra, type Limites, type SeguirVereditos } from '../api'
import { cor } from '../cores'
import { EscolhaMes } from '../EscolhaMes'
import { Escolhas } from '../Escolhas'
import { Explica } from '../Explica'
import { GraficoLinhas } from '../Grafico'
import { corDoSinal, data, deCada100, mesAno, moeda, pct } from '../formato'
import { useDado } from '../usar'

type Aba = 'compra' | 'hoje' | 'palpites'

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'compra', nome: 'Se eu tivesse comprado' },
  { id: 'hoje', nome: 'Se eu comprar hoje' },
  { id: 'palpites', nome: 'Se eu seguisse os palpites' },
]

const VALORES = [100, 1000, 10000].map((v) => ({ id: v, nome: moeda(v).replace(',00', '') }))

/** Pede à API toda vez que o endereço muda (ou seja, toda vez que uma escolha muda). */
function useConta<T>(endereco: string | null) {
  const [resposta, setResposta] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (!endereco) return
    let valido = true
    // Espera um instante: enquanto a pessoa digita o valor, não precisa calcular a cada tecla.
    const espera = setTimeout(() => {
      pedir<T>(endereco)
        .then((r) => { if (valido) { setResposta(r); setErro(null) } })
        .catch((e: Error) => { if (valido) setErro(e.message) })
    }, 250)
    return () => { valido = false; clearTimeout(espera) }
  }, [endereco])
  return { resposta, erro }
}

/** "Quanto?": botões prontos e um campo para outro valor. */
function EscolhaValor({ valor, mudar }: { valor: number; mudar: (v: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  return (
    <fieldset className="mes-ano">
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
    { id: limites.primeiro, nome: 'no começo (2017)' },
  ]
  const { resposta: r, erro } = useConta<Compra>(
    `/api/simular/compra?valor=${valor}&compra=${compra}&venda=${vendeuHoje ? 'hoje' : venda}`,
  )

  return (
    <>
      <div className="formulario">
        <EscolhaValor valor={valor} mudar={setValor} />
        <fieldset className="mes-ano">
          <legend>Quando comprou?</legend>
          <Escolhas opcoes={atalhos} atual={compra} mudar={setCompra} rotulo="Atalhos de data da compra" />
          <EscolhaMes rotulo="ou escolha o mês" valor={compra} mudar={setCompra} primeiro={limites.primeiro} ultimo={limites.ultimo} />
        </fieldset>
        <fieldset className="mes-ano">
          <legend>Quando vendeu?</legend>
          <Escolhas
            opcoes={[{ id: 'hoje', nome: 'Hoje (último preço)' }, { id: 'outro', nome: 'Em outro mês' }]}
            atual={vendeuHoje ? 'hoje' : 'outro'}
            mudar={(id) => setVendeuHoje(id === 'hoje')}
            rotulo="Quando vendeu"
          />
          {!vendeuHoje && (
            <EscolhaMes rotulo="mês da venda" valor={venda} mudar={setVenda} primeiro={limites.primeiro} ultimo={limites.ultimo} />
          )}
        </fieldset>
      </div>

      <Erro texto={erro} />
      {r && !erro && (
        <div role="status" aria-live="polite">
          <p className="frase grande-frase">
            Se você tivesse colocado <strong>{moeda(valor)}</strong> em ETH em {data(r.dia_compra)} e vendido
            em {data(r.dia_venda)}, teria <strong className={corDoSinal(r.retorno)}>{moeda(r.valor_final)}</strong>.
          </p>
          <p className="frase">
            Isso é <strong className={corDoSinal(r.retorno)}>
              {r.retorno >= 0 ? 'um ganho' : 'uma perda'} de {moeda(Math.abs(r.valor_final - valor))} ({pct(r.retorno, true)})
            </strong>. O ETH custava {moeda(r.preco_compra)} na compra e {moeda(r.preco_venda)} na venda.
          </p>
          {r.pior_retorno < -0.01 && (
            <p className="frase">
              No pior momento do caminho ({data(r.pior_dia)}), o seu dinheiro chegou a valer só{' '}
              <strong className="negativo">{moeda(r.pior_valor)}</strong>, uma queda de {pct(Math.abs(r.pior_retorno))} sobre
              o que você colocou. Quem vendesse ali, de susto, teria ficado com isso.
            </p>
          )}
          <h3>Quanto o seu dinheiro valeu, dia a dia</h3>
          <GraficoLinhas
            series={[{ nome: 'Seu dinheiro', pontos: r.carteira, cor: cor('--serie-1') }]}
            referencia={{ valor, rotulo: `o que você colocou: ${moeda(valor)}` }}
            marcas={r.pior_retorno < -0.01
              ? [{ data: r.pior_dia, valor: r.pior_valor, rotulo: `pior momento: ${moeda(r.pior_valor)}`, embaixo: true }]
              : []}
          />
        </div>
      )}
      <Explica>
        <p>Simula uma compra de verdade no passado, com o preço real de cada dia.</p>
        <p>
          A compra e a venda acontecem no preço de fechamento do dia (21h em Brasília). Ao escolher um mês, vale
          o primeiro dia daquele mês. "Hoje" é o último dia com preço fechado.
        </p>
        <p>Desconta a taxa da corretora (0,1% na compra e 0,1% na venda). Imposto e câmbio do real ficam de fora.</p>
      </Explica>
    </>
  )
}

// ------------------------------------------------------------- se eu comprar hoje

function ComprarHoje() {
  const [valor, setValor] = useState(1000)
  const [grupo, setGrupo] = useState<'todos' | 'parecidos'>('todos')
  const { resposta: r, erro } = useConta<Cenarios>(`/api/simular/hoje?valor=${valor}`)

  return (
    <>
      <div className="formulario">
        <EscolhaValor valor={valor} mudar={setValor} />
        <fieldset className="mes-ano">
          <legend>Comparar com</legend>
          <Escolhas
            opcoes={[
              { id: 'todos', nome: 'Todas as compras desde 2017' },
              { id: 'parecidos', nome: 'Só compras em dias parecidos com hoje' },
            ]}
            atual={grupo}
            mudar={setGrupo}
            rotulo="Com quais compras comparar"
          />
        </fieldset>
      </div>
      <Erro texto={erro} />
      {r && !erro && (
        <div role="status" aria-live="polite">
          <p className="frase">
            Ninguém sabe o futuro. O que dá para mostrar é o que aconteceu com quem comprou no passado
            {grupo === 'parecidos'
              ? `, em dias em que o preço estava, como hoje, uns ${pct(r.queda_hoje)} abaixo do maior preço já visto`
              : ', em qualquer dia desde 2017'}:
          </p>
          {r.prazos.map((p) => {
            const c = p[grupo]
            if (!c) return <p key={p.prazo} className="secundario">{p.prazo}: sem casos suficientes.</p>
            return <Faixa key={p.prazo} prazo={p.prazo} valor={valor} c={c} />
          })}
          {grupo === 'parecidos' && (
            <p className="aviso">
              Os dias parecidos com hoje vêm de poucas grandes quedas (2018 e 2022), em {r.episodios_parecidos} trechos.
              É pouco exemplo: trate como pista, não como regra.
            </p>
          )}
        </div>
      )}
      <Explica>
        <p>
          Para cada dia do passado, o site vê quanto uma compra naquele dia valia 1, 3, 6 e 12 meses depois. Juntando
          todas, dá para ver o que é comum e o que é raro.
        </p>
        <p>
          "Caso ruim" e "caso bom" deixam de fora os 10% piores e os 10% melhores resultados, que são raros. Entre
          eles ficam 8 de cada 10 compras. "Típico" é o do meio.
        </p>
        <p>Verde quer dizer mais do que você colocou; vermelho, menos.</p>
      </Explica>
    </>
  )
}

/** Uma linha "daqui a X": a frase e 4 caixinhas com os números. */
function Faixa({ prazo, valor, c }: { prazo: string; valor: number; c: NonNullable<Cenarios['prazos'][0]['todos']> }) {
  return (
    <div className="faixa">
      <h3>Daqui a {prazo}</h3>
      <div className="numeros">
        <div className="numero">
          <div className="rotulo">Caso ruim</div>
          <div className={`valor ${corDoSinal(c.ruim - valor)}`}>{moeda(c.ruim)}</div>
          <div className="nota">só 1 de cada 10 compras foi pior</div>
        </div>
        <div className="numero">
          <div className="rotulo">Caso típico</div>
          <div className={`valor ${corDoSinal(c.tipico - valor)}`}>{moeda(c.tipico)}</div>
          <div className="nota">metade foi melhor, metade foi pior</div>
        </div>
        <div className="numero">
          <div className="rotulo">Caso bom</div>
          <div className={`valor ${corDoSinal(c.bom - valor)}`}>{moeda(c.bom)}</div>
          <div className="nota">só 1 de cada 10 compras foi melhor</div>
        </div>
        <div className="numero">
          <div className="rotulo">Estava no prejuízo</div>
          <div className="valor">{deCada100(c.no_prejuizo)}</div>
          <div className="nota">das compras, nesse prazo</div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------- se eu seguisse os palpites

function SeguirPalpites({ limites }: { limites: Limites }) {
  const [valor, setValor] = useState(1000)
  const [desde, setDesde] = useState('2018-01-01')
  const { resposta: r, erro } = useConta<SeguirVereditos>(`/api/simular/vereditos?valor=${valor}&desde=${desde}`)
  const final = (pontos: { valor: number }[]) => pontos[pontos.length - 1].valor

  return (
    <>
      <div className="formulario">
        <EscolhaValor valor={valor} mudar={setValor} />
        <EscolhaMes rotulo="Começando em" valor={desde} mudar={setDesde} primeiro="2017-10-01" ultimo={limites.ultimo} />
      </div>
      <Erro texto={erro} />
      {r && !erro && (
        <div role="status" aria-live="polite">
          <p className="frase grande-frase">
            Começando em {mesAno(desde)} com {moeda(valor)}: seguindo os palpites, você teria{' '}
            <strong className={corDoSinal(final(r.seguindo) - valor)}>{moeda(final(r.seguindo))}</strong>. Só comprando e
            esquecendo, teria <strong className={corDoSinal(final(r.esperando) - valor)}>{moeda(final(r.esperando))}</strong>.
          </p>
          <p className="frase">
            {final(r.seguindo) > final(r.esperando)
              ? 'Seguir os palpites ganhou de comprar e esquecer, neste período.'
              : 'Seguir os palpites perdeu de comprar e esquecer, neste período.'}{' '}
            Foram {r.operacoes} compras e vendas, e o dinheiro ficou em ETH {pct(r.tempo_comprado)} do tempo.
          </p>
          <h3>Os dois jeitos, dia a dia</h3>
          <GraficoLinhas
            series={[
              { nome: 'Seguindo os palpites', pontos: r.seguindo, cor: cor('--serie-1') },
              { nome: 'Comprando e esquecendo', pontos: r.esperando, cor: cor('--serie-2') },
            ]}
            referencia={{ valor, rotulo: `o que você colocou: ${moeda(valor)}` }}
            altura={340}
          />
        </div>
      )}
      <Explica>
        <p>
          Imagina seguir à risca o palpite de cada dia: comprar ETH quando o palpite é "subir", vender quando é "cair"
          e, quando é "sem palpite", não mexer em nada. Começa com o dinheiro parado.
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
    </>
  )
}

export function Simular() {
  const [aba, setAba] = useState<Aba>('compra')
  const { dado: limites, erro } = useDado<Limites>('/api/limites')
  return (
    <section className="cartao">
      <h2>Simular</h2>
      <Abas opcoes={ABAS} atual={aba} mudar={setAba} rotulo="Simulações" pequenas />
      {erro && <p className="erro" role="alert">{erro}</p>}
      {limites && (
        <>
          {aba === 'compra' && <TivesseComprado limites={limites} />}
          {aba === 'hoje' && <ComprarHoje />}
          {aba === 'palpites' && <SeguirPalpites limites={limites} />}
        </>
      )}
    </section>
  )
}

