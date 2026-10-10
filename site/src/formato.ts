// Números e datas no jeito brasileiro.

const dolar = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function moeda(valor: number): string {
  return `US$ ${dolar.format(valor)}`
}

export function moedaCurta(valor: number): string {
  return `US$ ${inteiro.format(valor)}`
}

export function pct(valor: number, sinal = false): string {
  const texto = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: sinal ? 'exceptZero' : 'auto',
  }).format(valor)
  return texto
}

/** "2026-10-09" vira "09/10/2026". */
export function data(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** "2026-10-09" vira "09/10/26", para o eixo dos gráficos. */
export function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano.slice(2)}`
}

/** Classe de cor para ganho (verde) ou perda (vermelho). */
export function corDoSinal(valor: number): string {
  return valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : ''
}
