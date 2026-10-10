import { useState } from 'react'
import { pedir, type Atualizacao, type Hoje as TipoHoje, type Placar } from '../api'
import { cor } from '../cores'
import { GraficoLinhas } from '../Grafico'
import { data, moeda, pct } from '../formato'
import { useDado } from '../usar'

// O veredito nunca é só cor: vem com símbolo e palavra.
const APARENCIA = {
  'momento bom': { classe: 'bom', simbolo: '▲' },
  'momento ruim': { classe: 'ruim', simbolo: '▼' },
  'sem vantagem': { classe: 'neutro', simbolo: '●' },
} as const

function amanha(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function NumeroPlacar({ titulo, placar }: { titulo: string; placar: Placar }) {
  return (
    <div className="numero">
      <div className="rotulo">{titulo}</div>
      {placar ? (
        <>
          <div className="valor">{pct(placar.taxa)}</div>
          <div className="nota">
            {placar.acertos} acertos em {placar.dias} dias. Dizer "sobe" acertaria {pct(placar.sempre_sobe)}.
          </div>
        </>
      ) : (
        <div className="nota">Ainda sem dias conferidos.</div>
      )}
    </div>
  )
}

export function Hoje() {
  const { dado, erro, recarregar } = useDado<TipoHoje>('/api/hoje')
  const [atualizando, setAtualizando] = useState(false)
  const [resultado, setResultado] = useState<Atualizacao | null>(null)

  async function atualizar() {
    setAtualizando(true)
    setResultado(null)
    try {
      setResultado(await pedir<Atualizacao>('/api/atualizar', { method: 'POST' }))
      recarregar()
    } catch (e) {
      setResultado({ ok: false, saida: (e as Error).message })
    } finally {
      setAtualizando(false)
    }
  }

  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!dado) return <p className="secundario">Carregando...</p>

  const aparencia = APARENCIA[dado.veredito]
  return (
    <>
      <section className="cartao" aria-labelledby="titulo-veredito">
        <h2 id="titulo-veredito">
          Veredito para {data(amanha(dado.dia))} (o dia que fecha às 21h em Brasília)
        </h2>
        <div className={`veredito ${aparencia.classe}`}>
          <div className="grande">{aparencia.simbolo} {dado.veredito.toUpperCase()}</div>
          <div>
            Em {dado.dias_parecidos} dias parecidos no passado, o dia seguinte subiu em {pct(dado.chance_subir)} deles.
          </div>
        </div>
        <div className="numeros">
          <div className="numero">
            <div className="rotulo">Fechamento de {data(dado.dia)}</div>
            <div className="valor">{moeda(dado.preco)}</div>
          </div>
          <div className="numero">
            <div className="rotulo">Tendência</div>
            <div className="valor">{dado.tendencia}</div>
            <div className="nota">média de 7 dias contra a de 30</div>
          </div>
          <div className="numero">
            <div className="rotulo">Abaixo do recorde</div>
            <div className="valor">{dado.distancia_do_recorde}</div>
          </div>
          <div className="numero">
            <div className="rotulo">Última semana</div>
            <div className="valor">{dado.semana}</div>
          </div>
        </div>
        <p className="aviso">
          Regra versão {dado.regra.versao}: "bom" com {pct(dado.regra.bom)} ou mais, "ruim" com {pct(dado.regra.ruim)} ou
          menos, "sem vantagem" no meio ou com menos de {dado.regra.minimo} dias parecidos.
        </p>
      </section>

      <div className="grade-2">
        <section className="cartao" aria-labelledby="titulo-placar">
          <h2 id="titulo-placar">Placar</h2>
          <div className="numeros">
            <NumeroPlacar titulo="Ao vivo (o diário)" placar={dado.placar_vivo} />
            <NumeroPlacar titulo={`Histórico (desde ${data(dado.historico_desde)})`} placar={dado.placar_historico} />
          </div>
          <p className="aviso">A regra só presta se ganhar de dizer "sobe" todo dia. "Sem vantagem" não conta.</p>
        </section>

        <section className="cartao" aria-labelledby="titulo-atualizar">
          <h2 id="titulo-atualizar">Atualizar agora</h2>
          <p className="secundario">
            Baixa o histórico da Binance e dá o veredito, como o agendamento das 21h30 faz sozinho.
          </p>
          <button className="acao" onClick={atualizar} disabled={atualizando}>
            {atualizando ? 'Atualizando...' : 'Atualizar agora'}
          </button>
          <div role="status" aria-live="polite">
            {resultado && (
              <>
                <p className={resultado.ok ? 'positivo' : 'erro'}>
                  {resultado.ok ? 'Atualizado.' : 'Não deu certo. Veja o que os scripts disseram:'}
                </p>
                <details open={!resultado.ok}>
                  <summary>O que os scripts disseram</summary>
                  <pre className="relatorio">{resultado.saida}</pre>
                </details>
              </>
            )}
          </div>
        </section>
      </div>

      <section className="cartao" aria-labelledby="titulo-90">
        <h2 id="titulo-90">Preço de fechamento, últimos 90 dias</h2>
        <GraficoLinhas series={[{ nome: 'Fechamento', pontos: dado.ultimos_90_dias, cor: cor('--serie-1') }]} />
      </section>
    </>
  )
}
