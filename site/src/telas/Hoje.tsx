import { useState } from 'react'
import { pedir, type Atualizacao, type Hoje as TipoHoje } from '../api'
import { Explica } from '../Explica'
import { corDoSinal, data, moeda, pct, somarDias, subiuCaiu } from '../formato'
import { useDado } from '../usar'

// O palpite nunca é só cor: vem com símbolo e frase. (No projeto, o palpite se chama "veredito".)
const APARENCIA = {
  'momento bom': { classe: 'bom', simbolo: '▲', titulo: 'Palpite: subir' },
  'momento ruim': { classe: 'ruim', simbolo: '▼', titulo: 'Palpite: cair' },
  'sem vantagem': { classe: 'neutro', simbolo: '●', titulo: 'Sem palpite' },
} as const

function porQue(dado: TipoHoje): string {
  if (dado.dias_parecidos < dado.regra.minimo) {
    return `Houve só ${dado.dias_parecidos} dias parecidos no passado. É pouco para dizer qualquer coisa (o mínimo é ${dado.regra.minimo}).`
  }
  if (dado.veredito === 'sem vantagem') {
    return 'Nos dias parecidos com hoje, o dia seguinte subiu e caiu quase o mesmo número de vezes. O passado não ajuda a prever esse dia.'
  }
  return dado.veredito === 'momento bom'
    ? 'Nos dias parecidos com hoje, o dia seguinte subiu mais vezes do que caiu.'
    : 'Nos dias parecidos com hoje, o dia seguinte caiu mais vezes do que subiu.'
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
  const subiram = Math.round(dado.chance_subir * dado.dias_parecidos)
  const cairam = dado.dias_parecidos - subiram
  const amanha = somarDias(dado.dia, 1)
  const historico = dado.placar_historico
  const vivo = dado.placar_vivo

  return (
    <>
      <section className="cartao" aria-labelledby="titulo-palpite">
        <h2 id="titulo-palpite">O preço vai subir ou cair até o fechamento de {data(amanha)}, às 21h?</h2>
        <div className={`veredito ${aparencia.classe}`}>
          <div className="grande">{aparencia.simbolo} {aparencia.titulo}</div>
          <div>{porQue(dado)}</div>
        </div>
        <p className="frase">
          No passado houve <strong>{dado.dias_parecidos} dias parecidos com hoje</strong>. No dia seguinte a
          eles, o preço subiu em {subiram} e caiu em {cairam}. Para dar palpite, um dos dois precisaria
          acontecer em pelo menos {Math.round(dado.regra.bom * 100)} de cada 100 vezes.
        </p>
        <Explica titulo="O que é este palpite?">
          <p>É um teste: será que olhar o passado ajuda a adivinhar se o preço sobe ou cai no dia seguinte?</p>
          <p>
            O "dia" aqui vai das 21h às 21h (horário de Brasília), porque é quando a Binance, de onde vem o preço,
            fecha cada dia. Por isso, depois das 21h o palpite já é para o fechamento do dia seguinte.
          </p>
          <p>
            Todo dia o computador olha como o mercado está, procura no passado os dias que estavam igual e vê
            o que aconteceu no dia seguinte a eles. Anota o palpite e, no outro dia, confere se acertou.
          </p>
          <p>
            A regra está congelada desde 10/10/2026: ela não pode ser ajustada depois de ver os erros, senão
            seria como decorar as respostas da prova.
          </p>
          <p><strong>Não é recomendação de compra.</strong> É um estudo para medir se dá para prever.</p>
        </Explica>
      </section>

      <section className="cartao" aria-labelledby="titulo-parecido">
        <h2 id="titulo-parecido">O que é um "dia parecido com hoje"?</h2>
        <p className="secundario">Um dia em que estas 3 coisas estavam iguais às de hoje:</p>
        <ol className="lista">
          <li>
            <strong>A direção das últimas semanas: {dado.tendencia === 'alta' ? 'subindo' : 'descendo'}.</strong>{' '}
            A média do preço nos últimos 7 dias ({moeda(dado.media_7)}) está{' '}
            {dado.tendencia === 'alta' ? 'acima' : 'abaixo'} da média dos últimos 30 dias ({moeda(dado.media_30)}).
          </li>
          <li>
            <strong>A distância do maior preço já visto: {dado.distancia_do_recorde} abaixo.</strong>{' '}
            Hoje o preço está {pct(dado.abaixo_do_recorde)} abaixo do recorde de {moeda(dado.recorde)},
            de {data(dado.recorde_dia)}.
          </li>
          <li>
            <strong>A última semana: {dado.semana}.</strong> O preço{' '}
            <span className={corDoSinal(dado.variacao_semana)}>{subiuCaiu(dado.variacao_semana)} {pct(Math.abs(dado.variacao_semana))}</span>{' '}
            em 7 dias, de {moeda(dado.preco_7_dias_antes)} para {moeda(dado.preco)}.
          </li>
        </ol>
        <p className="aviso">Preço de fechamento de {data(dado.dia)}: {moeda(dado.preco)}.</p>
      </section>

      <div className="grade-2">
        <section className="cartao" aria-labelledby="titulo-acerta">
          <h2 id="titulo-acerta">Ele acerta?</h2>
          {historico && (
            <p className="frase">
              Testando a mesma regra em todos os dias desde {data(dado.historico_desde)}, quando ela deu palpite
              (subir ou cair), acertou <strong>{historico.acertos} de {historico.dias}</strong> vezes:{' '}
              <strong>{pct(historico.taxa)}</strong>. Jogando uma moeda, você acertaria 50%.
            </p>
          )}
          <p className="frase">
            {vivo
              ? <>Desde que o diário começou: acertou <strong>{vivo.acertos} de {vivo.dias}</strong> palpites.</>
              : 'Desde que o diário começou, ainda não houve palpite de subir ou cair para conferir.'}
          </p>
          <Explica>
            <p>"Sem palpite" não entra na conta: só vale quando a regra arrisca subir ou cair.</p>
            <p>
              O teste com o passado usa, em cada dia, só o que se sabia naquele dia. O diário é o teste ao vivo:
              o palpite é anotado antes de o dia acontecer.
            </p>
            <p>Acertar pouco mais da metade é quase o mesmo que chutar.</p>
          </Explica>
        </section>

        <section className="cartao" aria-labelledby="titulo-atualizar">
          <h2 id="titulo-atualizar">Buscar o preço mais novo</h2>
          <p className="secundario">
            O computador já faz isso sozinho todo dia às 21h30. Use o botão se quiser agora (leva uns segundos).
          </p>
          <button className="acao" onClick={atualizar} disabled={atualizando}>
            {atualizando ? 'Buscando...' : 'Buscar agora'}
          </button>
          <div role="status" aria-live="polite">
            {resultado && (
              <>
                <p className={resultado.ok ? 'positivo' : 'erro'}>
                  {resultado.ok ? 'Pronto: preço e palpite atualizados.' : 'Não deu certo. Veja o detalhe abaixo.'}
                </p>
                <details className="explica" open={!resultado.ok}>
                  <summary>Detalhe técnico</summary>
                  <pre className="relatorio">{resultado.saida}</pre>
                </details>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
