import type { LinhaDiario } from '../api'
import { Explica } from '../Explica'
import { data, moeda, somarDias } from '../formato'
import { useDado } from '../usar'

const PALPITE: Record<string, string> = {
  'momento bom': '▲ subir',
  'momento ruim': '▼ cair',
  'sem vantagem': '● sem palpite',
}

function acertou(l: LinhaDiario): string {
  if (!l.resultado) return 'esperando o dia fechar'
  if (l.acertou === '-') return 'não conta (sem palpite)'
  return l.acertou === 'sim' ? '✓ acertou' : '✗ errou'
}

export function Diario() {
  const { dado, erro } = useDado<LinhaDiario[]>('/api/diario')
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!dado) return <p className="secundario">Carregando...</p>
  return (
    <section className="cartao">
      <h2>Histórico de palpites</h2>
      <p className="secundario">Cada linha é um palpite anotado antes de o dia acontecer, e o que aconteceu depois.</p>
      {dado.length === 0 ? (
        <p className="frase">Ainda não há palpites. O primeiro entra na próxima busca de preço (todo dia às 21h30).</p>
      ) : (
        <div className="rolagem">
          <table>
            <thead>
              <tr>
                <th>Palpite para o dia</th>
                <th>Palpite</th>
                <th>O que aconteceu</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {dado.map((l) => (
                <tr key={l.dia}>
                  <td>{data(somarDias(l.dia, 1))}</td>
                  <td>{PALPITE[l.veredito] ?? l.veredito}</td>
                  <td>
                    {l.resultado
                      ? `${l.resultado}: de ${moeda(Number(l.preco))} para ${moeda(Number(l.preco_seguinte))}`
                      : `ainda aberto (partiu de ${moeda(Number(l.preco))})`}
                  </td>
                  <td>{acertou(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Explica titulo="Como ler esta tabela?">
        <p>"Palpite para o dia" é o dia que o palpite tentou adivinhar. Ele fecha às 21h em Brasília.</p>
        <p>"Sem palpite" não conta como acerto nem como erro: a regra não arriscou.</p>
        <p>O arquivo com tudo isso fica em saidas\diario_veredictos.csv (abre no Excel).</p>
      </Explica>
    </section>
  )
}
