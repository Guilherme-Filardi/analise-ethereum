import { useDado } from '../usar'

const GRAFICOS = [
  { arquivo: 'guia_1_comprar_qualquer_dia.png', titulo: '1. Se eu comprasse num dia qualquer, como estaria depois?' },
  { arquivo: 'guia_2_aporte.png', titulo: '2. Tudo de uma vez ou um pouco por mês?' },
  { arquivo: 'guia_3_sinais.png', titulo: '3. Os sinais de médias móveis ganham de comprar e esperar?' },
]

export function Guia() {
  const { dado, erro } = useDado<{ texto: string }>('/api/guia')
  return (
    <>
      {GRAFICOS.map((g) => (
        <section className="cartao" key={g.arquivo}>
          <h2>{g.titulo}</h2>
          <img className="grafico" src={`/saidas/${g.arquivo}`} alt={`Gráfico: ${g.titulo} Os números estão no relatório abaixo.`} />
        </section>
      ))}
      <section className="cartao">
        <h2>O relatório completo</h2>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {dado && <pre className="relatorio">{dado.texto}</pre>}
        <p className="aviso">Para refazer o guia com o histórico mais novo: rode o src\06_guia.py.</p>
      </section>
    </>
  )
}
