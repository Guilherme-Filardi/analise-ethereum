import { MESES } from './formato'

/**
 * Escolha de mês e ano, no lugar do calendário do navegador (o botão "Hoje" dele escolhia um
 * dia sem preço fechado e travava). Devolve sempre o primeiro dia com preço daquele mês.
 */
export function EscolhaMes({ rotulo, valor, mudar, primeiro, ultimo }: {
  rotulo: string
  valor: string // "2021-01-01"
  mudar: (iso: string) => void
  primeiro: string // primeiro dia com preço
  ultimo: string // último dia com preço
}) {
  const [ano, mes] = valor.split('-').map(Number)
  const anoMin = Number(primeiro.slice(0, 4))
  const anoMax = Number(ultimo.slice(0, 4))
  const anos = Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i)

  function escolher(novoAno: number, novoMes: number) {
    let iso = `${novoAno}-${String(novoMes).padStart(2, '0')}-01`
    if (iso < primeiro) iso = primeiro // antes do primeiro dia com preço: usa o primeiro
    if (iso > ultimo) iso = `${ultimo.slice(0, 7)}-01` // depois do último: usa o último mês
    mudar(iso)
  }

  // Meses fora do histórico ficam desligados (antes de ago/2017 e depois do último mês).
  const fora = (m: number) => {
    const chave = `${ano}-${String(m).padStart(2, '0')}`
    return chave < primeiro.slice(0, 7) || chave > ultimo.slice(0, 7)
  }

  return (
    <fieldset className="mes-ano">
      <legend>{rotulo}</legend>
      <label>
        <span className="sr">Mês</span>
        <select value={mes} onChange={(e) => escolher(ano, Number(e.target.value))}>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1} disabled={fora(i + 1)}>{nome}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr">Ano</span>
        <select value={ano} onChange={(e) => escolher(Number(e.target.value), mes)}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
    </fieldset>
  )
}
