// Números e datas no jeito brasileiro.

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

const dolar = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function moeda(valor: number): string {
  return `US$ ${dolar.format(valor)}`
}

export function moedaCurta(valor: number): string {
  return `US$ ${inteiro.format(valor)}`
}

export function pct(valor: number, sinal = false): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: sinal ? 'exceptZero' : 'auto',
  }).format(valor)
}

/** Fração vira "X de cada 100": 0.467 vira "47 de cada 100". */
export function deCada100(fracao: number): string {
  return `${Math.round(fracao * 100)} de cada 100`
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

/** "2021-01-01" vira "janeiro de 2021". */
export function mesAno(iso: string): string {
  const [ano, mes] = iso.split('-')
  return `${MESES[Number(mes) - 1]} de ${ano}`
}

/** Soma dias a uma data "aaaa-mm-dd". */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Classe de cor para ganho (verde) ou perda (vermelho). A palavra sempre vem junto. */
export function corDoSinal(valor: number): string {
  return valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : ''
}

/** "subiu" ou "caiu", para a cor nunca ser a única pista. */
export function subiuCaiu(valor: number): string {
  if (valor > 0) return 'subiu'
  if (valor < 0) return 'caiu'
  return 'ficou igual'
}
