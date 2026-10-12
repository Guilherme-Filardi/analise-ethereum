import { MESES } from './formato'

const dois = (n: number) => String(n).padStart(2, '0')
const diasNoMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

/**
 * Escolha de dia, mês e ano, no lugar do calendário do navegador (o botão "Hoje" dele escolhia
 * um dia sem preço fechado e travava). Nunca devolve um dia fora do histórico com preço.
 */
export function EscolhaMes({ rotulo, valor, mudar, primeiro, ultimo }: {
  rotulo: string
  valor: string // "2021-01-15"
  mudar: (iso: string) => void
  primeiro: string // primeiro dia com preço
  ultimo: string // último dia com preço
}) {
  const [ano, mes, dia] = valor.split('-').map(Number)
  const anoMin = Number(primeiro.slice(0, 4))
  const anoMax = Number(ultimo.slice(0, 4))
  const anos = Array.from({ length: anoMax - anoMin + 1 }, (_, i) => anoMin + i)
  const dias = Array.from({ length: diasNoMes(ano, mes) }, (_, i) => i + 1)

  function escolher(novoAno: number, novoMes: number, novoDia: number) {
    // Do dia 31 para um mês de 30 (ou para fevereiro), fica no último dia do mês novo.
    const d = Math.min(novoDia, diasNoMes(novoAno, novoMes))
    let iso = `${novoAno}-${dois(novoMes)}-${dois(d)}`
    if (iso < primeiro) iso = primeiro
    if (iso > ultimo) iso = ultimo
    mudar(iso)
  }

  // Meses e dias fora do histórico ficam desligados (antes de 17/08/2017 e depois do último dia).
  const mesFora = (m: number) => {
    const chave = `${ano}-${dois(m)}`
    return chave < primeiro.slice(0, 7) || chave > ultimo.slice(0, 7)
  }
  const diaFora = (d: number) => {
    const iso = `${ano}-${dois(mes)}-${dois(d)}`
    return iso < primeiro || iso > ultimo
  }

  return (
    <fieldset className="campo-grupo">
      <legend>{rotulo}</legend>
      <div className="selecoes">
      <label>
        <span className="sr">Dia</span>
        <select value={dia} onChange={(e) => escolher(ano, mes, Number(e.target.value))}>
          {dias.map((d) => <option key={d} value={d} disabled={diaFora(d)}>{d}</option>)}
        </select>
      </label>
      <label>
        <span className="sr">Mês</span>
        <select value={mes} onChange={(e) => escolher(ano, Number(e.target.value), dia)}>
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1} disabled={mesFora(i + 1)}>{nome}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr">Ano</span>
        <select value={ano} onChange={(e) => escolher(Number(e.target.value), mes, dia)}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      </div>
    </fieldset>
  )
}
