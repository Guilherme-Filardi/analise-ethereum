import type { ReactNode } from 'react'
import { irPara } from '../App'
import type { Painel as TipoPainel } from '../api'
import { Explica } from '../Explica'
import { GraficoFaixa, Mini } from '../Grafico'
import { Icone } from '../Icones'
import { ChanceDividida, FaixaVisual, Sinal, Variacao, fraseDoPalpite } from '../Pecas'
import { data, deCada100, hora, moeda, moedaCurta, pct, somarDias } from '../formato'
import { useAoVivo, useDado } from '../usar'
import { Preco } from './Preco'

const PALPITE_1: Record<string, string> = {
  'momento bom': '▲ palpite de subir',
  'momento ruim': '▼ palpite de cair',
  'sem vantagem': '● sem palpite',
}

/** Uma linha "rótulo ... valor", para listas curtas de números. */
function Linha({ rotulo, valor, nota }: { rotulo: string; valor: ReactNode; nota?: string }) {
  return (
    <div className="linha-numero">
      <div>
        <div>{rotulo}</div>
        {nota && <div className="nota">{nota}</div>}
      </div>
      <div className="linha-valor num">{valor}</div>
    </div>
  )
}

/**
 * A página inicial. Em cima, as três perguntas que importam, com a resposta grande:
 * quanto vale agora, onde deve fechar no próximo fechamento, e se sobe ou cai até lá. Embaixo, o detalhe.
 */
export function Painel() {
  const { dado: p, erro } = useDado<TipoPainel>('/api/painel')
  const aoVivo = useAoVivo()
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!p) return <p className="carregando">Carregando o painel...</p>

  const prev = p.previsao
  const amanha = somarDias(p.dia, 1)
  // O placar da prova (2022 em diante): os anos que a regra não viu ao ser escolhida.
  const teste = p.placar_2.prova
  const vivo = p.placar_2.vivo
  const recentes = p.faixa_recente
  const dentroRecentes = recentes.filter((f) => f.real >= f.min && f.real <= f.max).length
  const v1 = p.palpite_1
  const agora = aoVivo.dado

  return (
    <>
      <header className="cabecalho">
        <div>
          <h1>Painel do Ethereum</h1>
          <p>
            Preço de 1 ETH em dólar. O de agora vem da Binance a cada minuto. As previsões partem do fechamento de{' '}
            {data(p.dia)} (21h em Brasília) e se refazem sozinhas todo dia às 21h30.
          </p>
        </div>
      </header>

      <div className="grade">
        {/* ------------------------------------------------ as três respostas */}
        <section className="cartao s4" aria-labelledby="p1">
          <h2 id="p1" className="pergunta">Quanto vale agora</h2>
          <p className="heroi-valor">{moeda(agora ? agora.preco : p.preco)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 4px' }}>
            {agora
              ? <Variacao valor={agora.desde_21h} texto="desde as 21h" />
              : <Variacao valor={p.variacoes['1d']} texto="no dia" />}
            <Variacao valor={p.variacoes['7d']} texto="em 7 dias" />
          </div>
          {agora
            ? <Mini pontos={agora.pontos} rotulo="Preço das últimas 24 horas" altura={56} />
            : <Mini pontos={p.ultimos_30} rotulo="Preço dos últimos 30 dias" altura={56} />}
          <p className="nota">
            {agora
              ? <>Ao vivo, às {hora(agora.hora)}. Linha: as últimas 24 horas. Fechamento de {data(p.dia)}, às 21h: {moeda(p.preco)}.</>
              : aoVivo.erro
                ? <>Sem o preço ao vivo agora: este é o fechamento de {data(p.dia)}, às 21h. Linha: os últimos 30 dias.</>
                : <>Buscando o preço de agora... Este é o fechamento de {data(p.dia)}, às 21h.</>}
          </p>
        </section>

        <section className="cartao s4" aria-labelledby="p2">
          <h2 id="p2" className="pergunta">Onde deve fechar em {data(amanha).slice(0, 5)}, às 21h</h2>
          <p className="valor-resposta num">{moedaCurta(prev.faixa1_min)} a {moedaCurta(prev.faixa1_max)}</p>
          <FaixaVisual min={prev.faixa1_min} max={prev.faixa1_max} hoje={prev.preco} />
          <p className="nota">
            Faixa com 80% de chance.
            {teste?.faixa_1_dentro != null && <> Desde 2022, o preço caiu dentro dela em{' '}
              <strong>{deCada100(teste.faixa_1_dentro)}</strong> dias.</>}
          </p>
        </section>

        <section className="cartao s4" aria-labelledby="p3">
          <h2 id="p3" className="pergunta">Sobe ou cai até {data(amanha).slice(0, 5)}, às 21h</h2>
          {prev.chance_subir !== null ? (
            <>
              <p className="valor-resposta">{fraseDoPalpite(prev.palpite, prev.forca)}</p>
              <ChanceDividida chance={prev.chance_subir} />
              <p className="nota" style={{ marginTop: 8 }}>
                Palpite feito com o fechamento de {data(p.dia).slice(0, 5)}, às 21h. O próximo sai em{' '}
                {data(amanha).slice(0, 5)}, às 21h30.
              </p>
              <p className="nota" style={{ marginTop: 4 }}>
                {teste?.taxa != null && <>Desde 2022, o palpite acertou <strong>{pct(teste.taxa)}</strong> das vezes. Um chute acerta 50%.</>}
              </p>
            </>
          ) : <p className="frase">Sem previsão para hoje.</p>}
        </section>

        {/* ------------------------------------------------ o gráfico e os números do preço */}
        <div className="s8 xl-s9"><Preco altura={380} /></div>

        <section className="cartao s4 xl-s3" aria-labelledby="titulo-andou">
          <h2 id="titulo-andou" className="cartao-titulo" style={{ marginBottom: 6 }}>Como o preço andou</h2>
          <Linha rotulo="Em 7 dias" valor={<Sinal valor={p.variacoes['7d']} />} />
          <Linha rotulo="Em 30 dias" valor={<Sinal valor={p.variacoes['30d']} />} />
          <Linha rotulo="Em 1 ano" valor={<Sinal valor={p.variacoes['1a']} />} />
          <Linha rotulo="Maior preço da história" nota={`em ${data(p.recorde_dia)}`} valor={moedaCurta(p.recorde)} />
          <Linha rotulo="Hoje, abaixo do recorde" valor={pct(p.abaixo_do_recorde)} />
          <Linha rotulo="Quanto mexe num dia normal" nota="metade dos dias do último mês mexeu menos"
            valor={pct(p.mexida_tipica_30)} />
          <h3 style={{ marginTop: 18 }}>Daqui a 7 dias ({data(somarDias(p.dia, 7)).slice(0, 5)})</h3>
          <p className="num" style={{ fontWeight: 650 }}>{moedaCurta(prev.faixa7_min)} a {moedaCurta(prev.faixa7_max)}</p>
          <FaixaVisual min={prev.faixa7_min} max={prev.faixa7_max} hoje={prev.preco} rotulos={false} />
          <p className="nota">Faixa com 80% de chance.</p>
          <button className="link" style={{ marginTop: 12 }} onClick={() => irPara('previsao')}>
            Ver a previsão em detalhe <Icone nome="seta" />
          </button>
        </section>

        {/* ------------------------------------------------ a previsão funciona? */}
        <section className="cartao s8 esticar" aria-labelledby="titulo-funciona">
          <div className="cartao-cab">
            <div>
              <h2 id="titulo-funciona" className="cartao-titulo">A faixa de amanhã acertou nos últimos {recentes.length} dias?</h2>
              <p className="cartao-sub">Faixa azul: o que foi previsto na véspera. Linha: o preço que veio. Ponto vermelho: ficou fora.</p>
            </div>
            <span className="selo neutro">✓ {dentroRecentes} de {recentes.length} dias dentro</span>
          </div>
          <GraficoFaixa pontos={recentes} altura={320} />
        </section>

        <section className="cartao s4" aria-labelledby="titulo-placar">
          <h2 id="titulo-placar" className="cartao-titulo" style={{ marginBottom: 2 }}>As previsões acertam?</h2>
          <p className="cartao-sub" style={{ marginBottom: 10 }}>
            na prova: de {data(p.placar_2.prova_desde)} em diante, anos que a regra não viu ao ser escolhida
          </p>
          {teste && (
            <>
              <Linha rotulo="Faixa de amanhã" nota="prometido: 80%"
                valor={teste.faixa_1_dentro !== null ? <span className="positivo">✓ {pct(teste.faixa_1_dentro)}</span> : '–'} />
              <Linha rotulo="Faixa de 7 dias" nota="prometido: 80%"
                valor={teste.faixa_7_dentro !== null ? <span className="positivo">✓ {pct(teste.faixa_7_dentro)}</span> : '–'} />
              <Linha rotulo="Sobe ou cai"
                nota={`um chute acerta 50%; dizer "sobe" todo dia, ${teste.sempre_sobe != null ? pct(teste.sempre_sobe) : '–'}`}
                valor={teste.taxa !== null ? pct(teste.taxa) : '–'} />
            </>
          )}
          <Linha rotulo="Ao vivo (anotado antes de acontecer)"
            nota={vivo && vivo.dias ? `${vivo.dias} ${vivo.dias === 1 ? 'dia conferido' : 'dias conferidos'}` : `a primeira conferência sai em ${data(amanha).slice(0, 5)}, às 21h30`}
            valor={vivo && vivo.dias && vivo.taxa !== null ? pct(vivo.taxa) : '–'} />
          <p className="frase" style={{ fontSize: '0.9rem' }}>
            <strong>Resumo:</strong> a faixa cumpre o que promete. O sobe ou cai é quase cara ou coroa.
          </p>
          <Linha rotulo="Regra antiga (versão 1)" nota={`sem palpite em ${deCada100(v1.sem_palpite_1_ano)} dias do último ano`}
            valor={<span className="terciario">{PALPITE_1[v1.veredito]}</span>} />
          <Explica titulo="O que são essas duas regras">
            <p>
              A <strong>previsão nova (versão 2)</strong> dá todo dia uma faixa de preço e a chance de subir. Foi
              escolhida olhando só 2017 a 2021 e conferida em 2022 a 2026, anos que ela não tinha visto.
            </p>
            <p>
              A <strong>regra antiga (versão 1)</strong> continua rodando, congelada, para comparar. Ela só dá palpite
              quando os dias parecidos com hoje pendem para um lado, e isso quase nunca acontece.
            </p>
            <p>É um projeto de estudo de dados: ninguém deve comprar ou vender por causa disso.</p>
          </Explica>
        </section>
      </div>
    </>
  )
}
