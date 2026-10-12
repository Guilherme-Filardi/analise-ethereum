import { useState } from 'react'
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts'
import { Abas } from '../Abas'
import type { ConferenciaVar, Estatistica as TipoEstatistica, Intervalo } from '../api'
import { cor } from '../cores'
import { Explica } from '../Explica'
import { Kpi } from '../Pecas'
import { data, dataCurta, deCada100, mesAnoCurto, moeda, moedaCurta, moedaEixo, pct, pctEixo } from '../formato'
import { useDado } from '../usar'

// A tela "Estatística": os fundamentos que sustentam as frases do site, cada um com teste.
// Toda conta vem pronta da API (src/09_estatistica.py); aqui só se escreve e se desenha.

type Aba = 'fundamentos' | 'risco'
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'fundamentos', nome: 'Fundamentos' },
  { id: 'risco', nome: 'Risco e simulação' },
]

/** p-valor por extenso: 0.018 vira "p = 0,018"; abaixo de 0,001, "p < 0,001". */
function valorP(p: number): string {
  if (p < 0.001) return 'p < 0,001'
  return `p = ${p.toLocaleString('pt-BR', { maximumFractionDigits: 3, minimumFractionDigits: 3 })}`
}

const decimal = (x: number, casas = 1) => x.toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })

function eixos() {
  const c = cor('--texto-3')
  return { stroke: c, fontSize: 12, tickLine: false, axisLine: { stroke: cor('--eixo') } }
}

function Pergunta({ id, pergunta, resposta, children }: { id: string; pergunta: string; resposta: string; children?: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="pergunta">{pergunta}</h2>
      <p className="valor-resposta">{resposta}</p>
      {children}
    </>
  )
}

// ================================================================== FUNDAMENTOS

// ------------------------------------------------------------------ 1. os dias extremos

type Barra = { nome: string; dias: number; normal: number; de: number; ate: number }

function nomeBarra(de: number, ate: number) {
  if (de <= -1) return `queda maior que ${pct(-ate)}`
  if (ate >= 1) return `alta maior que ${pct(de)}`
  return `de ${pct(de, true)} a ${pct(ate, true)}`
}

function DicaHistograma({ active, payload }: { active?: boolean; payload?: { payload: Barra }[] }) {
  if (!active || !payload?.length) return null
  const b = payload[0].payload
  return (
    <div className="dica">
      <strong>Dias com {b.nome}</strong>
      <table>
        <tbody>
          <tr><td>Dias reais</td><td className="num">{b.dias.toLocaleString('pt-BR')}</td></tr>
          <tr><td>A curva normal esperaria</td><td className="num">{decimal(b.normal)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

function Extremos({ e }: { e: TipoEstatistica }) {
  const d = e.distribuicao
  const barras: Barra[] = d.histograma.map((h) => ({ ...h, nome: nomeBarra(h.de, h.ate) }))
  const e15 = d.extremos.find((x) => Math.abs(x.limite - 0.15) < 1e-9)
  const e5 = d.extremos.find((x) => Math.abs(x.limite - 0.05) < 1e-9)
  return (
    <section className="cartao" aria-labelledby="q-extremos">
      <Pergunta id="q-extremos" pergunta="Os dias de movimento enorme são raros?"
        resposta="Bem menos raros do que a curva normal prevê">
        <p className="frase">
          A "curva normal" (o formato de sino que a estatística usa como padrão) acerta o meio, mas erra os extremos.
          {e15 && <> Desde 2017 houve <strong>{e15.reais} dias</strong> em que o ETH subiu ou caiu mais de 15%; a curva
            normal esperaria só <strong>{decimal(e15.normal)}</strong>.</>}
          {e5 && e5.reais < e5.normal && <> Já os dias de mexida média (mais de 5%) são até menos comuns que na curva
            ({e5.reais.toLocaleString('pt-BR')} contra {Math.round(e5.normal).toLocaleString('pt-BR')}): o ETH passa
            mais tempo calmo e, quando sai da calma, sai de vez.</>}
        </p>
      </Pergunta>
      <div className="grade" style={{ marginTop: 8 }}>
        <div className="s8 xl-s8">
          <div className="grafico-caixa">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={barras} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barCategoryGap={1}>
                <CartesianGrid stroke={cor('--grade')} vertical={false} />
                <XAxis dataKey="nome" {...eixos()} interval="preserveStartEnd" minTickGap={40}
                  tickFormatter={(nome) => {
                    const b = barras.find((x) => x.nome === nome)
                    if (!b) return ''
                    if (b.de <= -1) return '◀'
                    if (b.ate >= 1) return '▶'
                    return pctEixo(b.de)
                  }} />
                <YAxis {...eixos()} axisLine={false} width={44} />
                <Tooltip content={<DicaHistograma />} cursor={{ fill: cor('--superficie-2') }} />
                <Bar dataKey="dias" isAnimationActive={false}>
                  {barras.map((b) => (
                    <Cell key={b.nome} fill={b.de <= -1 || b.ate >= 1 ? cor('--serie-2') : cor('--serie-1')} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="normal" stroke={cor('--texto')} strokeWidth={2} dot={false}
                  strokeDasharray="5 4" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legenda">
              <span><i className="caixa" style={{ background: cor('--serie-1') }} />dias reais, por tamanho do movimento</span>
              <span><i className="caixa" style={{ background: cor('--serie-2') }} />mais de 15% (as pontas)</span>
              <span><i style={{ background: cor('--texto') }} />o que a curva normal esperaria</span>
            </div>
          </div>
        </div>
        <div className="s4 xl-s4">
          <div className="rolagem">
            <table>
              <thead><tr><th>Subiu ou caiu mais de</th><th className="num">Dias reais</th><th className="num">Curva normal</th></tr></thead>
              <tbody>
                {d.extremos.map((x) => (
                  <tr key={x.limite}>
                    <td>{pct(x.limite).replace(',0', '')}</td>
                    <td className="num"><strong>{x.reais.toLocaleString('pt-BR')}</strong></td>
                    <td className="num terciario">{decimal(x.normal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginTop: 12 }}>
            <Kpi rotulo="Pior dia" valor={<span className="negativo">▼ {pct(Math.abs(d.pior_dia.variacao))}</span>} nota={data(d.pior_dia.data)} />
            <Kpi rotulo="Melhor dia" valor={<span className="positivo">▲ {pct(d.melhor_dia.variacao)}</span>} nota={data(d.melhor_dia.data)} />
          </div>
        </div>
      </div>
      <p className="frase"><strong>O que isso muda:</strong> conta de risco que usa só a média e o desvio padrão subestima os dias
        de tombo. Por isso a faixa da previsão usa os movimentos reais do passado, e não a curva normal.</p>
      <Explica titulo="Os números técnicos">
        <p>
          Desvio padrão diário: {pct(d.desvio)}. Assimetria: {decimal(d.assimetria, 2)}. Curtose em excesso:{' '}
          {decimal(d.curtose_excesso, 1)} (na curva normal é 0; quanto maior, mais pesadas as pontas).
        </p>
        <p>
          Teste de Jarque-Bera (se o formato é o da curva normal): {valorP(d.jarque_bera.p)}. Um p abaixo de 0,05 quer
          dizer que o formato não é normal, com folga.
        </p>
        <p>Variação diária simples, de fechamento a fechamento, de {data(e.periodo.inicio)} a {data(e.periodo.fim)} ({e.periodo.dias.toLocaleString('pt-BR')} dias).</p>
      </Explica>
    </section>
  )
}

// ------------------------------------------------------------------ 2. a memória do preço

function GraficoMemoria({ titulo, pontos, limite, cor1 }: {
  titulo: string; pontos: { defasagem: number; valor: number }[]; limite: number; cor1: string
}) {
  const maximo = Math.max(0.2, ...pontos.map((p) => Math.abs(p.valor)))
  return (
    <div className="grafico-caixa">
      <h3 style={{ marginTop: 4 }}>{titulo}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={pontos} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="25%">
          <CartesianGrid stroke={cor('--grade')} vertical={false} />
          <ReferenceArea y1={-limite} y2={limite} fill={cor('--texto-3')} fillOpacity={0.12} stroke="none" />
          <XAxis dataKey="defasagem" {...eixos()} ticks={[1, 7, 14, 21, 30]} />
          <YAxis {...eixos()} axisLine={false} width={44} domain={[-maximo, maximo]}
            tickFormatter={(v) => decimal(Number(v), 2)} allowDataOverflow />
          <ReferenceLine y={0} stroke={cor('--eixo')} />
          <Tooltip cursor={{ fill: cor('--superficie-2') }}
            content={({ active, payload }) => active && payload?.length ? (
              <div className="dica">
                <strong>{String(payload[0].payload.defasagem)} {payload[0].payload.defasagem === 1 ? 'dia' : 'dias'} depois</strong>
                <div className="valor-dica">{decimal(Number(payload[0].value), 3)}</div>
                <div className="terciario">{Math.abs(Number(payload[0].value)) > limite ? 'fora da faixa do acaso' : 'dentro da faixa do acaso'}</div>
              </div>
            ) : null} />
          <Bar dataKey="valor" fill={cor1} isAnimationActive={false} maxBarSize={12} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function Memoria({ e }: { e: TipoEstatistica }) {
  const a = e.autocorrelacao
  const direcaoFraca = a.ljung_box.direcao_p < 0.05
  return (
    <section className="cartao" aria-labelledby="q-memoria">
      <Pergunta id="q-memoria" pergunta="O dia de hoje diz algo sobre amanhã?"
        resposta="Sobre o tamanho do movimento, sim. Sobre a direção, quase nada">
        <p className="frase">
          Cada barra mostra o quanto um dia se parece com o dia de 1, 2... até 30 dias antes (a autocorrelação). A faixa
          cinza é o tamanho que o acaso dá. No <strong>tamanho</strong> do movimento, {a.fora_tamanho} de 30 barras passam
          da faixa: dia agitado puxa dia agitado. Na <strong>direção</strong>, só {a.fora_direcao} de 30, e todas pequenas.
        </p>
      </Pergunta>
      <div className="grade">
        <div className="s6"><GraficoMemoria titulo="A direção (subiu ou caiu)" pontos={a.direcao} limite={a.limite} cor1={cor('--serie-2')} /></div>
        <div className="s6"><GraficoMemoria titulo="O tamanho (quanto mexeu)" pontos={a.tamanho} limite={a.limite} cor1={cor('--serie-1')} /></div>
      </div>
      <p className="frase"><strong>O que isso muda:</strong> é a prova por trás do site. A faixa de preço funciona porque o
        tamanho tem memória; o sobe ou cai fica perto de cara ou coroa porque a direção quase não tem.</p>
      <Explica titulo="Os números técnicos">
        <p>
          Teste de Ljung-Box com {a.ljung_box.defasagens} defasagens (se existe memória, olhando 10 dias de uma vez):
          direção {valorP(a.ljung_box.direcao_p)}; tamanho {valorP(a.ljung_box.tamanho_p)}.
        </p>
        <p>
          {direcaoFraca
            ? 'A direção também passa no teste, mas parte disso vem da agitação: nos dias agitados, os números grandes inflam a conta. O que sobra é pequeno, troca de sinal e não chega a prever o dia seguinte (o placar do sobe ou cai na prova não se separa de cara ou coroa).'
            : 'A direção não passa no teste: o que aparece nela é do tamanho do acaso.'}
        </p>
        <p>A faixa do acaso é ±{decimal(a.limite, 3)} (1,96 dividido pela raiz do número de dias).</p>
      </Explica>
    </section>
  )
}

// ------------------------------------------------------------------ 3. margem de erro dos placares

function conclusao(i: Intervalo): { texto: string; classe: string } {
  if (i.referencia === 0.5) {
    if (i.de > 0.5) return { texto: 'Acima do acaso: não é só sorte, mas a vantagem é pequena', classe: 'positivo' }
    if (i.ate < 0.5) return { texto: 'Abaixo do acaso: erra mais que cara ou coroa', classe: 'negativo' }
    return { texto: 'Não dá para separar de cara ou coroa', classe: 'terciario' }
  }
  if (i.de <= i.referencia && i.referencia <= i.ate) return { texto: 'Cumpre o prometido', classe: 'positivo' }
  return i.ate < i.referencia
    ? { texto: 'Abaixo do prometido: a faixa é estreita demais', classe: 'negativo' }
    : { texto: 'Acima do prometido: a faixa é larga demais', classe: 'negativo' }
}

/** O resultado (o ponto), a margem de erro (a barra) e a meta (o risco), numa régua só. */
function ReguaIntervalo({ i }: { i: Intervalo }) {
  const de = i.referencia - 0.1
  const ate = i.referencia + 0.1
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - de) / (ate - de)) * 100))}%`
  return (
    <div className="regua" role="img"
      aria-label={`Resultado ${pct(i.taxa)}, margem de ${pct(i.de)} a ${pct(i.ate)}, meta ${pct(i.referencia)}`}>
      <div className="trilho" />
      <div className="margem" style={{ left: pos(i.de), width: `calc(${pos(i.ate)} - ${pos(i.de)})` }} />
      <div className="meta" style={{ left: pos(i.referencia) }} />
      <div className="ponto" style={{ left: pos(i.taxa) }} />
    </div>
  )
}

function Margens({ e }: { e: TipoEstatistica }) {
  const faixas = e.intervalos.filter((i) => i.referencia !== 0.5)
  const faixasOk = faixas.every((i) => i.de <= i.referencia && i.referencia <= i.ate)
  const palpite = e.intervalos.find((i) => i.nome.includes('versão 2') && i.referencia === 0.5)
  const resposta = `${faixasOk ? 'As faixas cumprem o prometido' : 'Uma das faixas erra o prometido'}; ${
    palpite && palpite.de > 0.5 ? 'o sobe ou cai passa do acaso, mas por pouco' : 'o sobe ou cai não se separa do acaso'}`
  return (
    <section className="cartao" aria-labelledby="q-margens">
      <Pergunta id="q-margens" pergunta="Os placares são de verdade ou sorte?" resposta={resposta}>
        <p className="frase">
          Todo placar tem margem de erro: com outros anos de dado, o número sairia um pouco diferente. A barra azul mostra
          até onde ele poderia ir só por sorte (95% de confiança); o risco preto é a meta.
        </p>
      </Pergunta>
      <div className="rolagem">
        <table className="tabela-margens">
          <thead>
            <tr><th>Medida</th><th className="num">Resultado</th><th>Margem de erro (95%)</th><th className="num">Meta</th><th>Conclusão</th></tr>
          </thead>
          <tbody>
            {e.intervalos.map((i) => {
              const c = conclusao(i)
              return (
                <tr key={i.nome}>
                  <td>
                    {i.nome}
                    <div className="nota">
                      {i.acertos.toLocaleString('pt-BR')} de {i.dias.toLocaleString('pt-BR')} dias
                      {i.dias_efetivos !== i.dias && <> (contam como {i.dias_efetivos.toLocaleString('pt-BR')}, porque as semanas se sobrepõem)</>}
                    </div>
                  </td>
                  <td className="num"><strong>{pct(i.taxa)}</strong></td>
                  <td style={{ minWidth: 180 }}>
                    <ReguaIntervalo i={i} />
                    <div className="nota num">{pct(i.de)} a {pct(i.ate)}</div>
                  </td>
                  <td className="num">{pct(i.referencia).replace(',0', '')}</td>
                  <td className={c.classe}>{c.texto}<div className="nota">{valorP(i.p)}</div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Explica titulo="Como ler o p">
        <p>
          O p é a chance de um resultado tão longe da meta aparecer só por sorte. Abaixo de 0,05 (5%), costuma-se dizer
          que não é sorte. Para o sobe ou cai, a meta é 50% (cara ou coroa); para as faixas, 80% (o prometido).
        </p>
        <p>Nas faixas, ficar perto da meta é o bom resultado: longe para cima quer dizer faixa larga demais, e para baixo, estreita demais.</p>
      </Explica>
    </section>
  )
}

// ------------------------------------------------------------------ 4. dia da semana

const NOME_DIA: Record<string, string> = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', 'sáb': 'sábado', dom: 'domingo' }

function DiaDaSemana({ e }: { e: TipoEstatistica }) {
  const s = e.dia_da_semana
  const pior = NOME_DIA[s.pior_no_treino] ?? s.pior_no_treino
  const repetiu = s.prova_p < 0.05
  const [c1, c2] = [cor('--serie-1'), cor('--serie-2')]
  return (
    <section className="cartao" aria-labelledby="q-semana">
      <Pergunta id="q-semana" pergunta="Algum dia da semana é pior para o preço?"
        resposta={repetiu ? `A ${pior} continuou pior na prova` : `Parecia que sim (a ${pior}), mas não se repetiu`}>
        <p className="frase">
          Escolhemos o pior dia olhando só {s.treino.de.slice(0, 4)} a 2021 (o treino): foi a <strong>{pior}</strong>. Depois
          conferimos em 2022 a {s.prova.ate.slice(0, 4)} (a prova), que não tinha sido olhada.{' '}
          {repetiu
            ? <>Na prova, ela seguiu abaixo dos outros dias ({pct(s.prova_diferenca, true)} por dia, {valorP(s.prova_p)}).
              É um efeito de verdade, mas pequeno: num dia comum o preço mexe uns {pct(e.distribuicao.desvio)}, muito
              mais que essa diferença.</>
            : <>Na prova, a diferença foi de {pct(s.prova_diferenca, true)} por dia, do tamanho do acaso ({valorP(s.prova_p)}).</>}
        </p>
      </Pergunta>
      <div className="grafico-caixa">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={s.dias} margin={{ top: 12, right: 8, bottom: 4, left: 0 }} barCategoryGap="22%" barGap={2}>
            <CartesianGrid stroke={cor('--grade')} vertical={false} />
            <XAxis dataKey="dia" {...eixos()} />
            <YAxis {...eixos()} axisLine={false} width={52} tickFormatter={(v) => pct(Number(v), true)} />
            <ReferenceLine y={0} stroke={cor('--eixo')} />
            <Tooltip cursor={{ fill: cor('--superficie-2') }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="dica">
                  <strong>{NOME_DIA[String(payload[0].payload.dia)]}</strong>
                  <table><tbody>
                    <tr><td>Média no treino</td><td className="num">{pct(Number(payload[0].payload.treino_media), true)}</td></tr>
                    <tr><td>Média na prova</td><td className="num">{pct(Number(payload[0].payload.prova_media), true)}</td></tr>
                  </tbody></table>
                </div>
              ) : null} />
            <Bar dataKey="treino_media" fill={c1} maxBarSize={22} radius={[3, 3, 3, 3]} isAnimationActive={false} />
            <Bar dataKey="prova_media" fill={c2} maxBarSize={22} radius={[3, 3, 3, 3]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <table className="sr">
          <caption>Variação média por dia da semana</caption>
          <thead><tr><th>Dia</th><th>Treino</th><th>Prova</th></tr></thead>
          <tbody>
            {s.dias.map((d) => (
              <tr key={d.dia}><td>{NOME_DIA[d.dia]}</td><td>{pct(d.treino_media, true)}</td><td>{pct(d.prova_media, true)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="legenda">
          <span><i className="caixa" style={{ background: c1 }} />média por dia no treino ({s.treino.de.slice(0, 4)} a 2021)</span>
          <span><i className="caixa" style={{ background: c2 }} />média por dia na prova (2022 em diante)</span>
        </div>
      </div>
      <p className="frase"><strong>O que isso muda:</strong> quando se procura padrão em 7 dias de uma vez, um deles quase sempre
        parece especial por acaso. Só a prova separa o padrão da coincidência.</p>
    </section>
  )
}

// ================================================================== RISCO E SIMULAÇÃO

// ------------------------------------------------------------------ 5. o cone de 1 ano

type PontoCone = TipoEstatistica['cone']['pontos'][0] & { faixa90: [number, number]; faixa50: [number, number] }

function DicaCone({ active, payload }: { active?: boolean; payload?: { payload: PontoCone }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="dica">
      <strong>{p.dia === 0 ? 'Hoje' : `Daqui a ${p.dia} dias (${data(p.data)})`}</strong>
      <table><tbody>
        <tr><td>9 em 10 caminhos entre</td><td className="num">{moedaCurta(p.p5)} e {moedaCurta(p.p95)}</td></tr>
        <tr><td>Metade entre</td><td className="num">{moedaCurta(p.p25)} e {moedaCurta(p.p75)}</td></tr>
        <tr><td>Caminho do meio</td><td className="num">{moedaCurta(p.p50)}</td></tr>
      </tbody></table>
    </div>
  )
}

function Cone({ e }: { e: TipoEstatistica }) {
  const c = e.cone
  const pontos: PontoCone[] = c.pontos.map((p) => ({ ...p, faixa90: [p.p5, p.p95], faixa50: [p.p25, p.p75] }))
  const fim = c.pontos[c.pontos.length - 1]
  const azul = cor('--serie-1')
  // Uma marca no eixo por mês (os pontos são semanais), e linhas que dobram o preço: na escala
  // comum, a parte de baixo do leque ficaria espremida no chão.
  const meses = pontos.filter((p, i) => i === 0 || p.data.slice(0, 7) !== pontos[i - 1].data.slice(0, 7)).map((p) => p.data)
  const menor = Math.min(...c.pontos.map((p) => p.p5))
  const maior = Math.max(...c.pontos.map((p) => p.p95))
  let base = 250
  while (base > menor) base /= 2
  while (base * 2 <= menor) base *= 2
  const dobras: number[] = [base]
  while (dobras[dobras.length - 1] < maior) dobras.push(dobras[dobras.length - 1] * 2)
  return (
    <section className="cartao" aria-labelledby="q-cone">
      <Pergunta id="q-cone" pergunta="Onde o preço pode estar daqui a 1 ano?"
        resposta={`Num leque enorme: de ${moedaCurta(fim.p5)} a ${moedaCurta(fim.p95)}`}>
        <p className="frase">
          O computador sorteou {c.simulacoes.toLocaleString('pt-BR')} caminhos possíveis para o próximo ano, montados com
          pedaços de {c.bloco} dias do passado real do ETH. O leque mostra onde eles terminaram: 9 em cada 10 ficaram
          dentro da parte clara, e metade dentro da parte escura.
        </p>
      </Pergunta>
      <div className="kpis" style={{ marginBottom: 12 }}>
        <Kpi rotulo="Terminar acima de hoje" valor={deCada100(c.chance_acima_hoje)} nota={`hoje: ${moeda(c.preco)}`} />
        <Kpi rotulo="Caminho do meio, em 1 ano" valor={moedaCurta(fim.p50)} nota="metade termina acima, metade abaixo" />
        <Kpi rotulo="Cair à metade em algum momento" valor={deCada100(c.chance_cair_metade)} nota={`abaixo de ${moedaCurta(c.preco / 2)} no caminho`} />
      </div>
      <div className="grafico-caixa">
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={pontos} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={cor('--grade')} vertical={false} />
            <XAxis dataKey="data" {...eixos()} tickFormatter={mesAnoCurto} ticks={meses} minTickGap={24} />
            <YAxis {...eixos()} axisLine={false} width={78} tickFormatter={moedaEixo} scale="log"
              domain={[dobras[0], dobras[dobras.length - 1]]} ticks={dobras} allowDataOverflow />
            <Tooltip content={<DicaCone />} cursor={{ stroke: cor('--eixo') }} />
            <Area dataKey="faixa90" stroke="none" fill={azul} fillOpacity={0.14} isAnimationActive={false} activeDot={false} />
            <Area dataKey="faixa50" stroke="none" fill={azul} fillOpacity={0.3} isAnimationActive={false} activeDot={false} />
            <ReferenceLine y={c.preco} stroke={cor('--texto-3')} strokeDasharray="4 4"
              label={{ value: `hoje: ${moedaCurta(c.preco)}`, position: 'insideTopLeft', fill: cor('--texto-2'), fontSize: 12 }} />
            <Line dataKey="p50" stroke={azul} strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legenda">
          <span><i className="caixa" style={{ background: azul, opacity: 0.25 }} />9 em cada 10 caminhos</span>
          <span><i className="caixa" style={{ background: azul, opacity: 0.5 }} />metade dos caminhos</span>
          <span><i style={{ background: azul }} />o caminho do meio</span>
          <span className="terciario">cada linha do eixo vale o dobro da de baixo</span>
        </div>
      </div>
      <div className="kpi" style={{ marginTop: 12 }}>
        <div className="rotulo">O leque acertou no passado?</div>
        <p style={{ margin: '4px 0' }}>
          Em {c.conferencia.testes} pontos de partida desde {data(c.conferencia.desde)}, montando o leque só com o que se
          sabia até ali, o preço real de 1 ano depois caiu dentro da parte clara em{' '}
          <strong>{pct(c.conferencia.dentro_90)}</strong> das vezes (o prometido é 90%).
          {' '}Ficou abaixo em {pct(c.conferencia.abaixo_p5)} e acima em {pct(c.conferencia.acima_p95)}.
        </p>
        <p className="nota">
          {c.conferencia.acima_p95 === 0 && c.conferencia.abaixo_p5 === 0
            ? 'Não errou nenhuma vez: pode ser um leque largo demais.'
            : c.conferencia.abaixo_p5 === 0
              ? `Quando errou, foi para cima: o preço subiu mais do que o leque imaginava (os leques que erraram começaram em ${
                c.conferencia.anos_acima.join(', ')}). Leia o leque como um guia do tamanho do risco, e não como limite.`
              : c.conferencia.acima_p95 === 0
                ? `Quando errou, foi para baixo: o preço caiu mais do que o leque imaginava (os leques que erraram começaram em ${
                  c.conferencia.anos_abaixo.join(', ')}).`
                : 'Errou dos dois lados.'}
        </p>
      </div>
      <Explica titulo="Como a simulação funciona">
        <p>
          É uma simulação de Monte Carlo com "bootstrap em blocos": cada caminho é montado colando pedaços de {c.bloco} dias
          seguidos do passado, sorteados. Pedaços inteiros guardam o jeito do ETH: semanas calmas e semanas agitadas.
        </p>
        <p>
          O leque não sabe de notícia nenhuma: ele supõe que o próximo ano vai se parecer com uma mistura dos anos
          passados. Chance de dobrar de preço: {deCada100(c.chance_dobrar)}.
        </p>
        <p>
          Os pontos de partida da conferência se sobrepõem (anos vizinhos dividem quase todos os dias), então o número
          da conferência vale menos do que parece: são poucos anos independentes.
        </p>
      </Explica>
    </section>
  )
}

// ------------------------------------------------------------------ 6. o dia ruim (VaR)

type DiaVar = TipoEstatistica['var']['ultimos_365'][0] & { linha_ewma: number; linha_hist: number }

function DicaVar({ active, payload }: { active?: boolean; payload?: { payload: DiaVar }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="dica">
      <strong>{data(d.data)}</strong>
      <div className={`valor-dica ${d.variacao >= 0 ? 'positivo' : 'negativo'}`}>{d.variacao >= 0 ? '▲' : '▼'} {pct(Math.abs(d.variacao))}</div>
      <table><tbody>
        <tr><td>Limite adaptável</td><td className="num">−{pct(d.var_ewma)}</td></tr>
        <tr><td>Limite histórico</td><td className="num">−{pct(d.var_historico)}</td></tr>
      </tbody></table>
      {d.rompeu_ewma && <div className="negativo" style={{ fontWeight: 600, marginTop: 4 }}>✗ passou do limite adaptável</div>}
    </div>
  )
}

function conclusaoVar(c: ConferenciaVar) {
  const taxaOk = c.kupiec_p >= 0.05
  const soltos = c.independencia_p >= 0.05
  if (taxaOk && soltos) return { texto: 'Aprovado: passa na medida certa e em dias soltos', classe: 'positivo' }
  if (taxaOk) return { texto: 'Passa na medida certa, mas os dias ruins vêm em grupo', classe: 'secundario' }
  return c.taxa < 0.05
    ? { texto: 'Folgado demais: avisa de quedas maiores do que as que vêm', classe: 'negativo' }
    : { texto: 'Apertado demais: é ultrapassado mais vezes do que promete', classe: 'negativo' }
}

function DiaRuim({ e }: { e: TipoEstatistica }) {
  const v = e.var
  const dias: DiaVar[] = v.ultimos_365.map((d) => ({ ...d, linha_ewma: -d.var_ewma, linha_hist: -d.var_historico }))
  const rompeu = v.ultimos_365.filter((d) => d.rompeu_ewma).length
  const [verde, vermelho] = [cor('--sobe-marca'), cor('--cai-marca')]
  return (
    <section className="cartao" aria-labelledby="q-var">
      <Pergunta id="q-var" pergunta="Num dia ruim, quanto o ETH pode cair?"
        resposta={`1 dia em cada 20, a queda passa de ${pct(v.hoje.ewma.var)}`}>
        <p className="frase">
          É o "valor em risco" (VaR, a perda que só é ultrapassada em 5% dos dias), calculado para amanhã com a agitação
          de agora. <strong>Quando passa</strong>, a queda média é de <strong>{pct(v.hoje.ewma.es)}</strong>.
          Com o jeito antigo, que usa todos os dias desde 2017 por igual, o limite seria {pct(v.hoje.historico.var)}.
        </p>
      </Pergunta>
      <div className="grafico-caixa">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dias} margin={{ top: 12, right: 12, bottom: 4, left: 0 }} barCategoryGap={1}>
            <CartesianGrid stroke={cor('--grade')} vertical={false} />
            <XAxis dataKey="data" {...eixos()} tickFormatter={dataCurta} minTickGap={48} />
            <YAxis {...eixos()} axisLine={false} width={52} tickFormatter={pctEixo} />
            <ReferenceLine y={0} stroke={cor('--eixo')} />
            <Tooltip content={<DicaVar />} cursor={{ fill: cor('--superficie-2') }} />
            <Bar dataKey="variacao" isAnimationActive={false}>
              {dias.map((d) => (
                <Cell key={d.data} fill={d.rompeu_ewma ? vermelho : d.variacao >= 0 ? verde : cor('--texto-3')}
                  fillOpacity={d.rompeu_ewma ? 1 : 0.55} />
              ))}
            </Bar>
            <Line dataKey="linha_ewma" stroke={cor('--texto')} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="linha_hist" stroke={cor('--serie-2')} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="legenda">
          <span><i style={{ background: cor('--texto') }} />limite adaptável (agitação recente)</span>
          <span><i style={{ background: cor('--serie-2') }} />limite histórico (desde 2017)</span>
          <span><i className="caixa" style={{ background: vermelho }} />dia que passou do limite adaptável ({rompeu} no último ano)</span>
        </div>
      </div>
      <h3>Os dois jeitos, conferidos dia a dia desde 2019</h3>
      <div className="rolagem">
        <table>
          <thead>
            <tr><th>Jeito</th><th className="num">Dias que passaram</th><th className="num">Prometido</th><th className="num">Seguidos</th><th>Conclusão</th></tr>
          </thead>
          <tbody>
            {v.conferencia.map((c) => {
              const k = conclusaoVar(c)
              return (
                <tr key={c.metodo}>
                  <td>{c.nome}<div className="nota">{c.dias.toLocaleString('pt-BR')} dias</div></td>
                  <td className="num"><strong>{pct(c.taxa)}</strong><div className="nota">{c.rompimentos} dias</div></td>
                  <td className="num">5%</td>
                  <td className="num">{c.seguidos}</td>
                  <td className={k.classe}>{k.texto}<div className="nota">taxa: {valorP(c.kupiec_p)}; grupos: {valorP(c.independencia_p)}</div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Explica titulo="Os testes">
        <p>
          <strong>Taxa (teste de Kupiec):</strong> o limite promete ser ultrapassado em 5% dos dias. Se passar muito mais
          ou muito menos que isso, o p fica abaixo de 0,05 e o limite está errado.
        </p>
        <p>
          <strong>Grupos (teste de Christoffersen):</strong> um bom limite erra em dias soltos. Se os erros vêm em
          sequência ("Seguidos": dias que passaram logo depois de outro), ele demora a perceber que o mercado ficou
          agitado.
        </p>
        <p>O limite de cada dia é calculado na véspera, só com o passado.</p>
      </Explica>
    </section>
  )
}

// ================================================================== a tela

export function Estatistica() {
  const [aba, setAba] = useState<Aba>('fundamentos')
  const { dado: e, erro } = useDado<TipoEstatistica>('/api/estatistica')
  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Estatística</h1>
          <p>Os fundamentos por trás das frases do site, cada um com teste. E o risco: o pior dia e o próximo ano.</p>
        </div>
      </header>
      <Abas opcoes={ABAS} atual={aba} mudar={setAba} rotulo="Partes da estatística" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      {!e && !erro && <p className="carregando">Calculando (leva uns segundos na primeira vez)...</p>}
      {e && aba === 'fundamentos' && (
        <div className="pilha">
          <Margens e={e} />
          <Memoria e={e} />
          <Extremos e={e} />
          <DiaDaSemana e={e} />
        </div>
      )}
      {e && aba === 'risco' && (
        <div className="pilha">
          <DiaRuim e={e} />
          <Cone e={e} />
        </div>
      )}
    </>
  )
}
