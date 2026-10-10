import type { Estudo } from '../api'
import { Explica } from '../Explica'
import { data, deCada100, mesAno, moeda, pct } from '../formato'
import { useDado } from '../usar'

const DIAS = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta', 'sáb': 'sábado', dom: 'domingo' } as const
const nomeDia = (d: string) => DIAS[d as keyof typeof DIAS] ?? d

/** Um cartão de conclusão: a frase curta, o número grande e a explicação ao clicar. */
function Conclusao({ numero, titulo, children, grafico }: {
  numero: string; titulo: string; children: React.ReactNode; grafico?: string
}) {
  return (
    <section className="cartao conclusao">
      <div className="numero-grande">{numero}</div>
      <div>
        <h2>{titulo}</h2>
        {children}
        {grafico && (
          <Explica titulo="Ver o gráfico detalhado">
            <img className="grafico" src={`/saidas/${grafico}`} alt={`Gráfico detalhado: ${titulo}`} />
          </Explica>
        )}
      </div>
    </section>
  )
}

export function Guia() {
  const { dado: e, erro } = useDado<Estudo>('/api/estudo')
  const relatorio = useDado<{ texto: string }>('/api/guia')
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!e) return <p className="secundario">Calculando...</p>

  const c = e.compra_1_ano
  const a = e.aporte
  const esperar = e.sinais.jeitos[0]
  const media7 = e.sinais.jeitos[1]
  return (
    <>
      <p className="frase">
        O que os preços de {data(e.historico_inicio)} a {data(e.historico_fim)} mostram, em poucas frases.
        Tudo é passado: ajuda a entender o risco, não a adivinhar o futuro.
      </p>

      <Conclusao numero={deCada100(c.no_prejuizo)} titulo="Comprar num dia qualquer e esperar 1 ano foi quase cara ou coroa"
        grafico="guia_1_comprar_qualquer_dia.png">
        <p>
          Das {c.compras.toLocaleString('pt-BR')} compras possíveis desde 2017, {deCada100(c.no_prejuizo)} estavam
          no prejuízo 1 ano depois. Na metade das vezes, o ganho foi maior que {pct(c.mediana)}.
        </p>
        <p>
          Os extremos são enormes: o pior caso perdeu {pct(Math.abs(c.pior))} (quem comprou no topo de 2018) e o
          melhor ganhou {pct(c.melhor)}.
        </p>
      </Conclusao>

      <Conclusao numero={pct(c.susto_mediano)} titulo="Mesmo quando dá certo, dá susto">
        <p>
          Numa compra comum, o dinheiro chegou a cair {pct(Math.abs(c.susto_mediano))} em algum momento do ano, antes
          de terminar como terminou. Quem não aguenta ver isso tende a vender na pior hora.
        </p>
      </Conclusao>

      <Conclusao numero={deCada100(a.por_mes_ganhou)} titulo="Comprar um pouco por mês não rende mais, só suaviza"
        grafico="guia_2_aporte.png">
        <p>
          Comparando {moeda(1000)} de uma vez com {moeda(1000 / 12)} por mês durante 12 meses, em {a.meses} meses de
          início: o "por mês" ganhou em só {deCada100(a.por_mes_ganhou)} vezes, e o resultado típico foi quase
          igual ({moeda(a.mediana_tudo)} contra {moeda(a.mediana_por_mes)}).
        </p>
        <p>
          O que muda são os extremos. No pior caso: {moeda(a.pior_tudo)} de uma vez, contra {moeda(a.pior_por_mes)} por
          mês. No melhor: {moeda(a.melhor_tudo)} contra {moeda(a.melhor_por_mes)}. É um cinto de segurança.
        </p>
      </Conclusao>

      <Conclusao numero={moeda(e.palpites.seguindo).replace(/,\d\d$/, '')}
        titulo={`Seguir os palpites diários teria transformado ${moeda(1000)} em ${moeda(e.palpites.seguindo)}`}>
        <p>
          Começando em {mesAno(e.palpites.inicio)}. Só comprando e esquecendo, os mesmos {moeda(1000)} teriam
          virado {moeda(e.palpites.esperando)}. Acertar um pouco mais da metade dos dias não basta: o que pesa é o
          tamanho dos dias de alta que a regra perde.
        </p>
      </Conclusao>

      <Conclusao numero={moeda(media7.final).replace(/,\d\d$/, '')}
        titulo="Um sinal simples de médias fugiu das grandes quedas, mas não ganha sempre" grafico="guia_3_sinais.png">
        <p>
          Ficar com ETH só quando a média de 7 dias está acima da de 30 transformou {moeda(1000)} em{' '}
          {moeda(media7.final)}, contra {moeda(esperar.final)} de comprar e esquecer (desde {data(e.sinais.inicio)}).
        </p>
        <p>
          Quase tudo veio de ter saído antes dos tombos de 2018 e 2022. Depois de {data(e.sinais.meio)}, rendeu{' '}
          {pct(media7.segunda_metade, true)}, contra {pct(esperar.segunda_metade, true)} de comprar e esquecer. Foram{' '}
          {media7.operacoes} compras e vendas; imposto e custos ficaram de fora.
        </p>
      </Conclusao>

      {e.gas && (
        <Conclusao numero={`${(e.gas.comercial / e.gas.resto).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`}
          titulo="A taxa da rede é mais cara no horário comercial" grafico="gas_por_hora.png">
          <p>
            Para mandar ETH de uma carteira para outra, paga-se uma taxa (o "gás"). Na semana de {data(e.gas.inicio)} a{' '}
            {data(e.gas.fim)}, ela custou {(e.gas.comercial / e.gas.resto).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} vezes
            mais das 9h às 17h (Brasília) do que no resto do dia. A hora mais cara foi {e.gas.hora_mais_cara}h; o dia mais
            barato foi {nomeDia(e.gas.dia_mais_barato)}, e o mais caro, {nomeDia(e.gas.dia_mais_caro)}.
          </p>
          <p>Quem compra numa corretora brasileira não paga essa taxa: ela só aparece ao mover o ETH para fora.</p>
        </Conclusao>
      )}

      <section className="cartao">
        <h2>O relatório completo</h2>
        <Explica titulo="Abrir o relatório (texto técnico)">
          {relatorio.dado && <pre className="relatorio">{relatorio.dado.texto}</pre>}
        </Explica>
        <p className="aviso">Para refazer com o preço mais novo, rode o src\06_guia.py.</p>
      </section>
    </>
  )
}
