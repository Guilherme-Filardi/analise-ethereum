import { useState, type FormEvent } from 'react'
import { Abas } from '../Abas'
import { pedir, type Cenario, type Cenarios, type Compra, type Limites, type SeguirVereditos } from '../api'
import { cor } from '../cores'
import { GraficoLinhas } from '../Grafico'
import { corDoSinal, data, moeda, pct } from '../formato'
import { useDado } from '../usar'

type Aba = 'compra' | 'hoje' | 'vereditos'

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'compra', nome: 'E se eu tivesse comprado?' },
  { id: 'hoje', nome: 'E se eu comprar hoje?' },
  { id: 'vereditos', nome: 'E se eu seguisse os vereditos?' },
]

/** Um formulário que pede um endereço da API ao enviar e guarda a resposta ou o erro. */
function useEnvio<T>() {
  const [resposta, setResposta] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  async function enviar(endereco: string) {
    setEnviando(true)
    setErro(null)
    try {
      setResposta(await pedir<T>(endereco))
    } catch (e) {
      setResposta(null)
      setErro((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return { resposta, erro, enviando, enviar }
}

function CampoValor({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <label className="campo">
      Valor (US$)
      <input type="number" min="1" step="any" required value={valor} onChange={(e) => mudar(e.target.value)} />
    </label>
  )
}

function CampoData({ rotulo, valor, mudar, limites }: {
  rotulo: string; valor: string; mudar: (v: string) => void; limites: Limites | null
}) {
  return (
    <label className="campo">
      {rotulo}
      <input type="date" required value={valor} min={limites?.primeiro} max={limites?.ultimo}
        onChange={(e) => mudar(e.target.value)} />
    </label>
  )
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? <p className="erro" role="alert">{texto}</p> : null
}

// ------------------------------------------------------------- "e se eu tivesse comprado?"

function TivesseComprado({ limites }: { limites: Limites | null }) {
  const [valor, setValor] = useState('1000')
  const [compra, setCompra] = useState('2021-01-01')
  const [venda, setVenda] = useState('2022-01-01')
  const { resposta: r, erro, enviando, enviar } = useEnvio<Compra>()

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(`/api/simular/compra?valor=${valor}&compra=${compra}&venda=${venda}`)
  }

  return (
    <>
      <form className="linha" onSubmit={aoEnviar}>
        <CampoValor valor={valor} mudar={setValor} />
        <CampoData rotulo="Dia da compra" valor={compra} mudar={setCompra} limites={limites} />
        <CampoData rotulo="Dia da venda" valor={venda} mudar={setVenda} limites={limites} />
        <button className="acao" disabled={enviando}>{enviando ? 'Calculando...' : 'Simular'}</button>
      </form>
      <p className="aviso">Compra e venda no fechamento do dia (21h em Brasília), com taxa de 0,1% em cada uma.</p>
      <Erro texto={erro} />
      {r && (
        <div role="status">
          <div className="numeros">
            <div className="numero">
              <div className="rotulo">Teria virado</div>
              <div className={`valor ${corDoSinal(r.retorno)}`}>{moeda(r.valor_final)}</div>
              <div className="nota">{pct(r.retorno, true)}</div>
            </div>
            <div className="numero">
              <div className="rotulo">Pior momento no caminho</div>
              <div className={`valor ${corDoSinal(r.pior_retorno)}`}>{moeda(r.pior_valor)}</div>
              <div className="nota">{pct(r.pior_retorno, true)} em {data(r.pior_dia)}</div>
            </div>
            <div className="numero">
              <div className="rotulo">Preço do ETH</div>
              <div className="valor">{moeda(r.preco_compra)}</div>
              <div className="nota">na compra; {moeda(r.preco_venda)} na venda</div>
            </div>
          </div>
          <GraficoLinhas
            series={[{ nome: 'Carteira', pontos: r.carteira, cor: cor('--serie-1') }]}
            referencia={{ valor: Number(valor), rotulo: 'investido' }}
          />
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------- "e se eu comprar hoje?"

function Faixa({ c }: { c: Cenario }) {
  if (!c) return <td colSpan={4} className="secundario">sem casos com o prazo completo</td>
  return (
    <>
      <td className="num">{moeda(c.ruim)}</td>
      <td className="num"><strong>{moeda(c.tipico)}</strong></td>
      <td className="num">{moeda(c.bom)}</td>
      <td className="num">{pct(c.no_prejuizo)}</td>
    </>
  )
}

function ComprarHoje() {
  const [valor, setValor] = useState('1000')
  const { resposta: r, erro, enviando, enviar } = useEnvio<Cenarios>()

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(`/api/simular/hoje?valor=${valor}`)
  }

  return (
    <>
      <form className="linha" onSubmit={aoEnviar}>
        <CampoValor valor={valor} mudar={setValor} />
        <button className="acao" disabled={enviando}>{enviando ? 'Calculando...' : 'Ver cenários'}</button>
      </form>
      <p className="aviso">
        O que aconteceu no passado com compras parecidas. Não é previsão. "Ruim": 9 em cada 10 compras
        foram melhores. "Típico": a metade. "Bom": só 1 em cada 10 foi melhor.
      </p>
      <Erro texto={erro} />
      {r && (
        <div role="status">
          {(['todos', 'parecidos'] as const).map((grupo) => (
            <div key={grupo}>
              <h3>
                {grupo === 'todos'
                  ? 'Comprando num dia qualquer desde 2017'
                  : `Comprando em dias parecidos com hoje (preço de ${pct(Math.max(0, r.queda_hoje - r.faixa))} a ${pct(r.queda_hoje + r.faixa)} abaixo do recorde; hoje ${pct(r.queda_hoje)}). Aconteceu em ${r.episodios_parecidos} trechos separados.`}
              </h3>
              <div className="rolagem">
                <table>
                  <thead>
                    <tr>
                      <th>Esperando</th>
                      <th className="num">Ruim</th>
                      <th className="num">Típico</th>
                      <th className="num">Bom</th>
                      <th className="num">Ficou no prejuízo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.prazos.map((p) => (
                      <tr key={p.prazo}>
                        <td>{p.prazo}</td>
                        <Faixa c={p[grupo]} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="aviso">
            Os dias parecidos vêm de poucas grandes quedas (2018 e 2022). Compras de dias vizinhos dão resultados
            quase iguais, então há menos exemplos independentes do que o número de compras sugere.
          </p>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------- "e se eu seguisse os vereditos?"

function SeguirVereditosAba({ limites }: { limites: Limites | null }) {
  const [valor, setValor] = useState('1000')
  const [desde, setDesde] = useState('2018-01-01')
  const { resposta: r, erro, enviando, enviar } = useEnvio<SeguirVereditos>()

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(`/api/simular/vereditos?valor=${valor}&desde=${desde}`)
  }

  const final = (pontos: { valor: number }[]) => pontos[pontos.length - 1].valor
  return (
    <>
      <form className="linha" onSubmit={aoEnviar}>
        <CampoValor valor={valor} mudar={setValor} />
        <CampoData rotulo="Começar em" valor={desde} mudar={setDesde} limites={limites} />
        <button className="acao" disabled={enviando}>{enviando ? 'Calculando...' : 'Simular'}</button>
      </form>
      <p className="aviso">
        Compra no dia seguinte a um "momento bom", vende depois de um "momento ruim" e, no "sem vantagem",
        fica como está. Começa fora. Taxa de 0,1% por operação. Os vereditos do passado usam só o que se
        sabia em cada dia.
      </p>
      <Erro texto={erro} />
      {r && (
        <div role="status">
          <div className="numeros">
            <div className="numero">
              <div className="rotulo">Seguindo os vereditos</div>
              <div className={`valor ${corDoSinal(final(r.seguindo) - Number(valor))}`}>{moeda(final(r.seguindo))}</div>
              <div className="nota">pior queda {pct(r.maior_queda_seguindo)}</div>
            </div>
            <div className="numero">
              <div className="rotulo">Comprando e esperando</div>
              <div className={`valor ${corDoSinal(final(r.esperando) - Number(valor))}`}>{moeda(final(r.esperando))}</div>
              <div className="nota">pior queda {pct(r.maior_queda_esperando)}</div>
            </div>
            <div className="numero">
              <div className="rotulo">Operações</div>
              <div className="valor">{r.operacoes}</div>
              <div className="nota">comprado {pct(r.tempo_comprado)} do tempo</div>
            </div>
            <div className="numero">
              <div className="rotulo">Amanhã, seguindo</div>
              <div className="valor">{r.comprado_amanha ? 'comprado' : 'fora'}</div>
            </div>
          </div>
          <GraficoLinhas
            series={[
              { nome: 'Seguindo os vereditos', pontos: r.seguindo, cor: cor('--serie-1') },
              { nome: 'Comprando e esperando', pontos: r.esperando, cor: cor('--serie-2') },
            ]}
            referencia={{ valor: Number(valor), rotulo: 'investido' }}
            altura={320}
          />
        </div>
      )}
    </>
  )
}

export function Simular() {
  const [aba, setAba] = useState<Aba>('compra')
  const { dado: limites } = useDado<Limites>('/api/limites')
  return (
    <section className="cartao">
      <Abas opcoes={ABAS} atual={aba} mudar={setAba} rotulo="Simulações" pequenas />
      {limites && (
        <p className="aviso">Histórico disponível: {data(limites.primeiro)} a {data(limites.ultimo)}.</p>
      )}
      {aba === 'compra' && <TivesseComprado limites={limites} />}
      {aba === 'hoje' && <ComprarHoje />}
      {aba === 'vereditos' && <SeguirVereditosAba limites={limites} />}
    </section>
  )
}
