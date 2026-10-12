import { useState, type ReactNode } from 'react'
import { Abas } from '../Abas'
import type { LinhaDiario } from '../api'
import { Explica } from '../Explica'
import { data, moeda, moedaCurta, somarDias } from '../formato'
import { useDado } from '../usar'
import './telas.css'

type Aba = 'v2' | 'v1'

const ABAS: { id: Aba; nome: string }[] = [
  { id: 'v2', nome: 'Previsão nova (versão 2)' },
  { id: 'v1', nome: 'Regra antiga (versão 1)' },
]

const VAZIO = 'Ainda não há registros. O primeiro registro entra na próxima busca de preço (todo dia às 21h30).'

/** Célula com o nome da coluna guardado: no celular, a linha vira cartão e o nome aparece ao lado. */
function Celula({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <td data-rotulo={rotulo}><div>{children}</div></td>
}

/** "sim", "não" ou vazio (ainda não se sabe) vira ✓, ✗ ou o texto de espera. */
function SimNao({ valor, sim, nao, esperando = '–' }: { valor: string; sim: string; nao: string; esperando?: string }) {
  if (valor === 'sim') return <span className="positivo">✓ {sim}</span>
  if (valor === 'não') return <span className="negativo">✗ {nao}</span>
  return <span className="terciario">{esperando}</span>
}

/** Quantos dias já foram conferidos e em quantos deu "sim". Só contagem, sem conta. */
function Contagem({ rotulo, linhas, campo, nota }: { rotulo: string; linhas: LinhaDiario[]; campo: string; nota: string }) {
  const conferidas = linhas.filter((l) => l[campo] === 'sim' || l[campo] === 'não').length
  const sim = linhas.filter((l) => l[campo] === 'sim').length
  return (
    <div className="kpi">
      <div className="rotulo">{rotulo}</div>
      <div className="valor-grande num">{conferidas ? `${sim} de ${conferidas}` : '–'}</div>
      <div className="nota">{conferidas ? nota : 'nenhum dia conferido ainda'}</div>
    </div>
  )
}

function Anotados({ linhas }: { linhas: LinhaDiario[] }) {
  return (
    <div className="kpi">
      <div className="rotulo">Dias anotados</div>
      <div className="valor-grande num">{linhas.length}</div>
      <div className="nota">desde {data(linhas[linhas.length - 1].dia)}</div>
    </div>
  )
}

// ------------------------------------------------------------- versão 2

function TabelaV2({ linhas }: { linhas: LinhaDiario[] }) {
  return (
    <>
      <div className="kpis quatro">
        <Anotados linhas={linhas} />
        <Contagem rotulo="Acertou o palpite" linhas={linhas} campo="acertou" nota="dias conferidos" />
        <Contagem rotulo="Dentro da faixa de amanhã" linhas={linhas} campo="dentro_1" nota="dias conferidos" />
        <Contagem rotulo="Dentro da faixa de 7 dias" linhas={linhas} campo="dentro_7" nota="dias conferidos" />
      </div>
      <div className="rolagem">
        <table className="tabela-cartoes">
          <thead>
            <tr>
              <th>Previsão para</th>
              <th>Faixa de amanhã</th>
              <th>Palpite</th>
              <th>O que veio</th>
              <th>Dentro da faixa?</th>
              <th>Acertou o palpite?</th>
              <th>Faixa de 7 dias</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.dia}>
                <Celula rotulo="Previsão para">
                  <strong>{data(somarDias(l.dia, 1))}</strong>
                  <span className="nota">partiu de {moeda(Number(l.preco))}</span>
                </Celula>
                <Celula rotulo="Faixa de amanhã">
                  <span className="num">{moedaCurta(Number(l.faixa1_min))} a {moedaCurta(Number(l.faixa1_max))}</span>
                </Celula>
                <Celula rotulo="Palpite">
                  {l.palpite ? (
                    <>
                      <span className={`selo pequeno ${l.palpite}`}>{l.palpite === 'sobe' ? '▲ sobe' : '▼ cai'}</span>
                      {l.forca && <span className="nota">força {l.forca}</span>}
                    </>
                  ) : <span className="terciario">sem palpite</span>}
                </Celula>
                <Celula rotulo="O que veio">
                  {l.preco_1 ? (
                    <>
                      <span className="num">{moeda(Number(l.preco_1))}</span>
                      {l.subiu && <span className="nota">{l.subiu === 'sim' ? '▲ subiu' : '▼ caiu'}</span>}
                    </>
                  ) : <span className="terciario">esperando o dia fechar</span>}
                </Celula>
                <Celula rotulo="Dentro da faixa?"><SimNao valor={l.dentro_1} sim="dentro" nao="fora" /></Celula>
                <Celula rotulo="Acertou o palpite?"><SimNao valor={l.acertou} sim="acertou" nao="errou" /></Celula>
                <Celula rotulo="Faixa de 7 dias">
                  <SimNao valor={l.dentro_7} sim="dentro" nao="fora"
                    esperando={`esperando até ${data(somarDias(l.dia, 7)).slice(0, 5)}`} />
                  <span className="nota num">{moedaCurta(Number(l.faixa7_min))} a {moedaCurta(Number(l.faixa7_max))}</span>
                </Celula>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Explica titulo="Como ler esta tabela?">
        <p>Cada linha é uma previsão anotada antes de o dia acontecer, e o que veio depois.</p>
        <p>"Previsão para" é o dia que a previsão tentou adivinhar. Ele fecha às 21h em Brasília.</p>
        <p>A faixa é onde o preço deve fechar em 8 de cada 10 dias. A de 7 dias vale para uma semana depois.</p>
        <p>A força diz o quanto a previsão confia no palpite (forte, média ou fraca).</p>
        <p>O arquivo com tudo isso fica em saidas\diario_previsao.csv (abre no Excel).</p>
      </Explica>
    </>
  )
}

// ------------------------------------------------------------- versão 1

const PALPITE_1: Record<string, { texto: string; selo: string }> = {
  'momento bom': { texto: '▲ subir', selo: 'sobe' },
  'momento ruim': { texto: '▼ cair', selo: 'cai' },
  'sem vantagem': { texto: '● sem palpite', selo: 'neutro' },
}

function resultado1(l: LinhaDiario) {
  if (!l.resultado) return <span className="terciario">esperando o dia fechar</span>
  if (l.acertou === '-') return <span className="terciario">não conta (sem palpite)</span>
  return <SimNao valor={l.acertou} sim="acertou" nao="errou" />
}

function TabelaV1({ linhas }: { linhas: LinhaDiario[] }) {
  const semPalpite = linhas.filter((l) => l.veredito === 'sem vantagem').length
  return (
    <>
      <div className="kpis">
        <Anotados linhas={linhas} />
        <Contagem rotulo="Acertou o palpite" linhas={linhas} campo="acertou" nota="dias com palpite conferidos" />
        <div className="kpi">
          <div className="rotulo">Sem palpite</div>
          <div className="valor-grande num">{semPalpite} de {linhas.length}</div>
          <div className="nota">dias em que a regra não arriscou</div>
        </div>
      </div>
      <div className="rolagem">
        <table className="tabela-cartoes">
          <thead>
            <tr>
              <th>Palpite para o dia</th>
              <th>Palpite</th>
              <th>O que aconteceu</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const p = PALPITE_1[l.veredito]
              return (
                <tr key={l.dia}>
                  <Celula rotulo="Palpite para o dia"><strong>{data(somarDias(l.dia, 1))}</strong></Celula>
                  <Celula rotulo="Palpite">
                    {p ? <span className={`selo pequeno ${p.selo}`}>{p.texto}</span> : l.veredito}
                  </Celula>
                  <Celula rotulo="O que aconteceu">
                    {l.resultado
                      ? `${l.resultado}: de ${moeda(Number(l.preco))} para ${moeda(Number(l.preco_seguinte))}`
                      : `ainda aberto (partiu de ${moeda(Number(l.preco))})`}
                  </Celula>
                  <Celula rotulo="Resultado">{resultado1(l)}</Celula>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Explica titulo="Como ler esta tabela?">
        <p>A regra antiga segue anotando todo dia, para comparar com a nova. Ela está congelada desde 10/10/2026.</p>
        <p>"Palpite para o dia" é o dia que o palpite tentou adivinhar. Ele fecha às 21h em Brasília.</p>
        <p>"Sem palpite" não conta como acerto nem como erro: a regra não arriscou.</p>
        <p>O arquivo com tudo isso fica em saidas\diario_veredictos.csv (abre no Excel).</p>
      </Explica>
    </>
  )
}

// ------------------------------------------------------------- a tela

export function Diario() {
  const [aba, setAba] = useState<Aba>('v2')
  // As duas versões são pedidas juntas (são pequenas): trocar de aba não mostra a tabela errada.
  const v2 = useDado<LinhaDiario[]>('/api/diario?versao=2')
  const v1 = useDado<LinhaDiario[]>('/api/diario?versao=1')
  const { dado, erro } = aba === 'v2' ? v2 : v1

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Histórico</h1>
          <p>Cada linha é um palpite anotado antes de o dia acontecer, e o que veio depois. O mais novo fica em cima.</p>
        </div>
      </header>
      <div className="abas-largas">
        <Abas opcoes={ABAS} atual={aba} mudar={setAba} rotulo="Versão da previsão" />
      </div>
      <section className="cartao">
        {erro && <p className="erro" role="alert">{erro}</p>}
        {!dado && !erro && <p className="carregando">Carregando...</p>}
        {dado && dado.length === 0 && <p className="frase">{VAZIO}</p>}
        {dado && dado.length > 0 && (aba === 'v2' ? <TabelaV2 linhas={dado} /> : <TabelaV1 linhas={dado} />)}
      </section>
    </>
  )
}
