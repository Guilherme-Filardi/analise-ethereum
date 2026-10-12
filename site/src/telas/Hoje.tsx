import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { pedir, type Atualizacao, type Hoje as TipoHoje, type Previsao } from '../api'
import { cor } from '../cores'
import { Explica } from '../Explica'
import { GraficoFaixa } from '../Grafico'
import { Icone } from '../Icones'
import { ChanceDividida, FaixaVisual, Kpi, SeloPalpite, fraseDaForca, fraseDoPalpite, larguraDaFaixa } from '../Pecas'
import { data, deCada100, moeda, pct, pctEixo, somarDias, subiuCaiu } from '../formato'
import { useDado } from '../usar'

// ------------------------------------------------------------------ o que pesou hoje

/** Cada sinal numa barra a partir do meio: para a direita empurra para subir, para a esquerda, para cair. */
function OQuePesou({ itens }: { itens: Previsao['por_que'] }) {
  const maior = Math.max(...itens.map((i) => Math.abs(i.empurrao)), 1e-9)
  const [verde, vermelho] = [cor('--sobe-marca'), cor('--cai-marca')]
  return (
    <div>
      {itens.map((i) => {
        const largura = (Math.abs(i.empurrao) / maior) * 50
        return (
          <div className="barra-sinal" key={i.sinal}>
            <span>{i.sinal}</span>
            <div className="trilho-sinal" role="img"
              aria-label={`${i.sinal}: empurra para ${i.empurrao >= 0 ? 'subir' : 'cair'}`}>
              <div className="preenchido" style={i.empurrao >= 0
                ? { left: '50%', width: `${largura}%`, background: verde }
                : { right: '50%', width: `${largura}%`, background: vermelho }} />
            </div>
          </div>
        )
      })}
      <div className="escala-medidor" style={{ marginTop: 8 }}>
        <span>◀ empurra para cair</span><span>empurra para subir ▶</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ calibração

function rotuloFaixa(de: number, ate: number) {
  if (de === 0) return `abaixo de ${Math.round(ate * 100)}%`
  if (ate === 1) return `${Math.round(de * 100)}% ou mais`
  return `${Math.round(de * 100)} a ${Math.round(ate * 100)}%`
}

type LinhaCal = { nome: string; prevista: number; subiu: number; dias: number }

function DicaCalibracao({ active, payload }: { active?: boolean; payload?: { payload: LinhaCal }[] }) {
  if (!active || !payload?.length) return null
  const l = payload[0].payload
  return (
    <div className="dica">
      <strong>Chance prevista {l.nome}</strong>
      <div className="terciario">{l.dias.toLocaleString('pt-BR')} dias</div>
      <table>
        <tbody>
          <tr><td>Chance média prevista</td><td className="num">{pct(l.prevista)}</td></tr>
          <tr><td>Subiu de verdade</td><td className="num">{pct(l.subiu)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

/** Duas barras por faixa de chance: o que a previsão disse e o que aconteceu. */
function GraficoCalibracao({ grupos }: { grupos: Previsao['calibracao'] }) {
  const linhas: LinhaCal[] = grupos.map((g) => ({ nome: rotuloFaixa(g.de, g.ate), prevista: g.prevista, subiu: g.subiu, dias: g.dias }))
  const corTexto = cor('--texto-3')
  const [c1, c2] = [cor('--serie-2'), cor('--serie-1')]
  return (
    <div className="grafico-caixa">
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={linhas} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barCategoryGap="22%" barGap={2}>
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <XAxis dataKey="nome" stroke={corTexto} fontSize={11} tickLine={false} interval={0} />
          <YAxis domain={[0.4, 0.6]} ticks={[0.4, 0.45, 0.5, 0.55, 0.6]} tickFormatter={pctEixo} width={44}
            stroke={corTexto} fontSize={12} axisLine={false} tickLine={false} allowDataOverflow />
          <ReferenceLine y={0.5} stroke={cor('--eixo')} />
          <Tooltip content={<DicaCalibracao />} cursor={{ fill: cor('--superficie-2') }} />
          <Bar dataKey="prevista" fill={c1} maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="subiu" fill={c2} maxBarSize={22} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <table className="sr">
        <caption>Chance prevista e quantas vezes subiu</caption>
        <thead><tr><th>Faixa de chance</th><th>Dias</th><th>Chance média prevista</th><th>Subiu de verdade</th></tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}><td>{l.nome}</td><td>{l.dias}</td><td>{pct(l.prevista)}</td><td>{pct(l.subiu)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="legenda">
        <span><i className="caixa" style={{ background: c1 }} />chance que a previsão deu</span>
        <span><i className="caixa" style={{ background: c2 }} />quantas vezes subiu de verdade</span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ regra antiga

const APARENCIA_1 = {
  'momento bom': { classe: 'sobe', texto: '▲ Palpite: subir' },
  'momento ruim': { classe: 'cai', texto: '▼ Palpite: cair' },
  'sem vantagem': { classe: 'neutro', texto: '● Sem palpite' },
} as const

function RegraAntiga({ h }: { h: TipoHoje }) {
  const subiram = Math.round(h.chance_subir * h.dias_parecidos)
  const a = APARENCIA_1[h.veredito]
  return (
    <section className="cartao" aria-labelledby="titulo-v1">
      <div className="cartao-cab">
        <div>
          <h2 id="titulo-v1" className="cartao-titulo">Regra antiga (versão 1)</h2>
          <p className="cartao-sub">congelada desde 10/10/2026, rodando ao lado para comparar</p>
        </div>
        <span className={`selo ${a.classe}`}>{a.texto}</span>
      </div>
      <p className="frase" style={{ marginTop: 0 }}>
        Ela procura no passado os <strong>dias parecidos com hoje</strong> e só dá palpite quando eles pendem para um
        lado (55% ou mais). Hoje foram {h.dias_parecidos} dias parecidos: no dia seguinte, {subiram} subiram e{' '}
        {h.dias_parecidos - subiram} caíram.
      </p>
      <div className="kpis">
        <Kpi rotulo="Direção das semanas" valor={h.tendencia === 'alta' ? '▲ subindo' : '▼ descendo'}
          nota={`média de 7 dias ${moeda(h.media_7)}; de 30, ${moeda(h.media_30)}`} />
        <Kpi rotulo="Abaixo do recorde" valor={pct(h.abaixo_do_recorde)} nota={`faixa de ${h.distancia_do_recorde}`} />
        <Kpi rotulo="Última semana" valor={`${h.variacao_semana >= 0 ? '▲' : '▼'} ${pct(Math.abs(h.variacao_semana))}`}
          nota={`${subiuCaiu(h.variacao_semana)} em 7 dias`} />
      </div>
      <p className="frase">
        No último ano ficou <strong>sem palpite em {deCada100(h.sem_palpite_1_ano)}</strong> dias.
        {h.placar_historico && <> No teste desde {data(h.historico_desde)}, quando arriscou, acertou{' '}
          {h.placar_historico.acertos} de {h.placar_historico.dias} ({pct(h.placar_historico.taxa)}).</>}
      </p>
    </section>
  )
}

// ------------------------------------------------------------------ a tela

export function Hoje() {
  const prev = useDado<Previsao>('/api/previsao')
  const v1 = useDado<TipoHoje>('/api/hoje')
  const [atualizando, setAtualizando] = useState(false)
  const [resultado, setResultado] = useState<Atualizacao | null>(null)

  async function atualizar() {
    setAtualizando(true)
    setResultado(null)
    try {
      setResultado(await pedir<Atualizacao>('/api/atualizar', { method: 'POST' }))
      prev.recarregar()
      v1.recarregar()
    } catch (e) {
      setResultado({ ok: false, saida: (e as Error).message })
    } finally {
      setAtualizando(false)
    }
  }

  if (prev.erro) return <p className="erro" role="alert">{prev.erro}</p>
  if (!prev.dado) return <p className="carregando">Calculando a previsão...</p>

  const p = prev.dado
  const h = p.hoje
  const amanha = somarDias(h.dia, 1)
  const fcr = p.faixa_contra_real
  const dentro = fcr.filter((f) => f.real >= f.min && f.real <= f.max).length
  const placar = p.placar_prova
  const tudo = p.placar

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Previsão</h1>
          <p>Feita com o fechamento de {data(h.dia)} ({moeda(h.preco)}). Vale para o fechamento de {data(amanha)}, às 21h.</p>
        </div>
        {v1.dado?.pode_atualizar && (
          <button className="acao" onClick={atualizar} disabled={atualizando}>
            <Icone nome="atualizar" />{atualizando ? 'Buscando...' : 'Buscar preço agora'}
          </button>
        )}
      </header>

      <div role="status" aria-live="polite">
        {resultado && (
          <div className={`status ${resultado.ok ? 'ok' : 'falha'}`} style={{ marginBottom: 16 }}>
            <div>
              <strong>{resultado.ok ? 'Pronto: preço e previsões atualizados.' : 'Não deu certo.'}</strong>
              <details className="explica" open={!resultado.ok} style={{ borderTop: 'none', marginTop: 4, paddingTop: 0 }}>
                <summary>Detalhe técnico</summary>
                <pre className="relatorio">{resultado.saida}</pre>
              </details>
            </div>
          </div>
        )}
      </div>

      <div className="grade">
        <section className="cartao s7" aria-labelledby="titulo-faixas">
          <div className="cartao-cab">
            <h2 id="titulo-faixas" className="cartao-titulo">Onde o preço deve fechar</h2>
            <span className="selo neutro pequeno">80% de chance</span>
          </div>
          <div className="rotulo">Amanhã, {data(amanha)}</div>
          <p className="valor-grande num">{moeda(h.faixa1_min)} a {moeda(h.faixa1_max)}</p>
          <FaixaVisual min={h.faixa1_min} max={h.faixa1_max} hoje={h.preco} />
          <p className="nota">{larguraDaFaixa(h, h.faixa1_min, h.faixa1_max)}</p>
          <div className="rotulo" style={{ marginTop: 20 }}>Daqui a 7 dias, {data(somarDias(h.dia, 7))}</div>
          <p className="valor-grande num">{moeda(h.faixa7_min)} a {moeda(h.faixa7_max)}</p>
          <FaixaVisual min={h.faixa7_min} max={h.faixa7_max} hoje={h.preco} />
          <p className="nota">{larguraDaFaixa(h, h.faixa7_min, h.faixa7_max)}</p>
          <Explica titulo="Como a faixa é calculada">
            <p>
              O tamanho do movimento do ETH é previsível: dia agitado costuma puxar dia agitado, e dia calmo puxa dia
              calmo. A faixa mede a agitação dos últimos dias (com mais peso para os mais recentes) e vê, em todo o
              passado, até onde o preço costuma andar com essa agitação.
            </p>
            <p>
              Ela deixa de fora os 10% de movimentos maiores para cima e os 10% para baixo. Por isso, em 2 de cada 10
              vezes o preço deve ficar fora. Errar 2 em 10 é o combinado, e não defeito.
            </p>
          </Explica>
        </section>

        <section className="cartao s5" aria-labelledby="titulo-chance">
          <div className="cartao-cab">
            <h2 id="titulo-chance" className="cartao-titulo">Sobe ou cai amanhã?</h2>
            <SeloPalpite palpite={h.palpite} forca={h.forca} pequeno />
          </div>
          {h.chance_subir !== null && (
            <>
              <p className="valor-resposta">{fraseDoPalpite(h.palpite, h.forca)}</p>
              <ChanceDividida chance={h.chance_subir} />
              <p className="frase">
                {placar?.taxa != null && <>Desde 2022, na prova, o palpite acertou <strong>{pct(placar.taxa)}</strong> das
                  vezes. Um chute acerta 50%.</>}
              </p>
            </>
          )}
          <h3>O que mais pesou hoje</h3>
          <OQuePesou itens={p.por_que.slice(0, 6)} />
          <Explica titulo="Como a chance é calculada">
            <p>
              Uma regressão logística (uma conta que junta vários sinais numa chance entre 0 e 100%) olha 12 sinais de
              hoje: as variações de 1, 3, 7 e 30 dias, as médias, a distância do recorde, a agitação, o volume e onde o
              preço fechou dentro do dia.
            </p>
            <p>
              A cada 30 dias ela reaprende com todo o passado conhecido até ali
              {p.modelo && <> (a de agora aprendeu com {p.modelo.dias_treino.toLocaleString('pt-BR')} dias e vale desde{' '}
                {data(p.modelo.desde)})</>}. Ela foi escolhida entre 10 jeitos testados, olhando só 2017 a 2021.
            </p>
          </Explica>
        </section>

        <section className="cartao" aria-labelledby="titulo-180">
          <div className="cartao-cab">
            <div>
              <h2 id="titulo-180" className="cartao-titulo">A faixa nos últimos {fcr.length} dias</h2>
              <p className="cartao-sub">cada dia, a faixa que foi prevista na véspera e o preço que veio</p>
            </div>
            <span className="selo neutro pequeno">{dentro} de {fcr.length} dentro ({pct(dentro / Math.max(1, fcr.length))})</span>
          </div>
          <GraficoFaixa pontos={fcr} altura={300} />
        </section>

        <section className="cartao s6" aria-labelledby="titulo-cal">
          <div className="cartao-cab">
            <div>
              <h2 id="titulo-cal" className="cartao-titulo">A chance acerta o que promete?</h2>
              <p className="cartao-sub">dias agrupados pela chance de subir que a previsão deu</p>
            </div>
          </div>
          <GraficoCalibracao grupos={p.calibracao} />
          <Explica titulo="Como ler">
            <p>
              Se a previsão diz "48%" em muitos dias, o preço deveria ter subido em uns 48% deles. Barras do mesmo
              tamanho lado a lado querem dizer que a chance é honesta.
            </p>
            <p>Todas ficam perto de 50%: a direção de um dia é quase cara ou coroa.</p>
          </Explica>
        </section>

        <section className="cartao s6" aria-labelledby="titulo-forca">
          <div className="cartao-cab">
            <div>
              <h2 id="titulo-forca" className="cartao-titulo">Acerto do sobe ou cai</h2>
              <p className="cartao-sub">na prova: de {data(p.prova_desde)} em diante, anos que a regra não viu ao ser escolhida</p>
            </div>
          </div>
          {placar && placar.taxa !== null && (
            <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 12 }}>
              <Kpi rotulo="Acertou" valor={pct(placar.taxa)} nota={`${(placar.acertos ?? 0).toLocaleString('pt-BR')} de ${placar.dias.toLocaleString('pt-BR')} dias`} />
              <Kpi rotulo='Dizer "sobe" todo dia' valor={placar.sempre_sobe != null ? pct(placar.sempre_sobe) : '–'} nota="o mínimo a superar" />
            </div>
          )}
          <div className="rolagem">
            <table>
              <thead><tr><th>Força do palpite</th><th className="num">Dias</th><th className="num">Acertou</th></tr></thead>
              <tbody>
                {p.por_forca.map((f) => (
                  <tr key={f.forca}>
                    <td>{f.forca} <span className="terciario">({fraseDaForca(f.forca)})</span></td>
                    <td className="num">{f.dias.toLocaleString('pt-BR')}</td>
                    <td className="num">{pct(f.acerto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: 8 }}>
            Força: a distância da chance até 50%. Fraca, menos de 2 pontos; média, de 2 a 4; forte, 4 ou mais. A tabela
            usa todo o teste{p.teste_desde && <> desde {data(p.teste_desde)}</>}
            {tudo?.taxa != null && <> (acerto geral de {pct(tudo.taxa)})</>}, incluindo os anos em que a regra foi escolhida.
          </p>
        </section>

        <section className="cartao" aria-labelledby="titulo-ano">
          <div className="cartao-cab">
            <h2 id="titulo-ano" className="cartao-titulo">Ano a ano</h2>
            <span className="cartao-sub">a faixa deve ficar perto de 80%; o acerto, acima do "sobe" todo dia</span>
          </div>
          <div className="rolagem">
            <table>
              <thead>
                <tr>
                  <th>Ano</th><th className="num">Faixa de amanhã</th><th className="num">Faixa de 7 dias</th>
                  <th className="num">Sobe ou cai</th><th className="num">"Sobe" todo dia</th>
                </tr>
              </thead>
              <tbody>
                {p.por_ano.map((a) => (
                  <tr key={a.ano}>
                    <td>{a.ano}</td>
                    <td className="num">{a.faixa_1 !== null ? pct(a.faixa_1) : '–'}</td>
                    <td className="num">{a.faixa_7 !== null ? pct(a.faixa_7) : '–'}</td>
                    <td className="num">{a.acerto !== null ? pct(a.acerto) : '–'}</td>
                    <td className="num terciario">{a.sempre_sobe !== null ? pct(a.sempre_sobe) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="nota" style={{ marginTop: 8 }}>
            Até 2021 é o período em que a regra foi escolhida. De 2022 em diante é a prova: dados que ela não tinha visto.
          </p>
        </section>
      </div>

      {v1.dado && <div style={{ marginTop: 16 }}><RegraAntiga h={v1.dado} /></div>}
    </>
  )
}
