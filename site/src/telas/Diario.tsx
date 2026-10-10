import type { LinhaDiario } from '../api'
import { data, moeda, pct } from '../formato'
import { useDado } from '../usar'

export function Diario() {
  const { dado, erro } = useDado<LinhaDiario[]>('/api/diario')
  if (erro) return <p className="erro" role="alert">{erro}</p>
  if (!dado) return <p className="secundario">Carregando...</p>
  if (dado.length === 0) {
    return <p className="secundario">O diário ainda está vazio. O primeiro veredito entra na primeira atualização.</p>
  }
  return (
    <section className="cartao">
      <h2>Diário de vereditos (o mais recente em cima)</h2>
      <div className="rolagem">
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th className="num">Fechamento</th>
              <th>Veredito</th>
              <th className="num">Chance de subir</th>
              <th>O dia seguinte</th>
              <th>Acertou?</th>
            </tr>
          </thead>
          <tbody>
            {dado.map((l) => (
              <tr key={l.dia}>
                <td>{data(l.dia)}</td>
                <td className="num">{moeda(Number(l.preco))}</td>
                <td>{l.veredito}</td>
                <td className="num">{pct(Number(l.chance_subir))}</td>
                <td>{l.resultado || 'ainda aberto'}</td>
                <td>{l.acertou === '-' ? 'não conta' : l.acertou || 'falta conferir'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="aviso">"Sem vantagem" não conta no placar. O arquivo é o saidas\diario_veredictos.csv.</p>
    </section>
  )
}
