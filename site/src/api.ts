// Conversa com a API em Python. Toda conta é feita lá; aqui só se pede e se mostra.

export type Ponto = { data: string; valor: number }

export type Placar = { dias: number; acertos: number; taxa: number; sempre_sobe: number } | null

export type Hoje = {
  dia: string
  preco: number
  veredito: 'momento bom' | 'momento ruim' | 'sem vantagem'
  tendencia: string
  distancia_do_recorde: string
  semana: string
  dias_parecidos: number
  chance_subir: number
  regra: { versao: string; bom: number; ruim: number; minimo: number }
  placar_vivo: Placar
  placar_historico: Placar
  historico_desde: string
  ultimos_90_dias: Ponto[]
}

export type LinhaDiario = Record<string, string>

export type Limites = { primeiro: string; ultimo: string }

export type Compra = {
  preco_compra: number
  preco_venda: number
  valor_final: number
  retorno: number
  pior_dia: string
  pior_valor: number
  pior_retorno: number
  carteira: Ponto[]
}

export type Cenario = {
  compras: number
  no_prejuizo: number
  ruim: number
  tipico: number
  bom: number
  susto_tipico: number
} | null

export type Cenarios = {
  queda_hoje: number
  faixa: number
  episodios_parecidos: number
  prazos: { prazo: string; dias: number; todos: Cenario; parecidos: Cenario }[]
}

export type SeguirVereditos = {
  seguindo: Ponto[]
  esperando: Ponto[]
  operacoes: number
  tempo_comprado: number
  maior_queda_seguindo: number
  maior_queda_esperando: number
  comprado_amanha: boolean
}

export type Atualizacao = { ok: boolean; saida: string }

/** Pede um endereço da API. Se ela recusar, a mensagem dela (em português) vira o erro. */
export async function pedir<T>(endereco: string, opcoes?: RequestInit): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(endereco, opcoes)
  } catch {
    throw new Error('A API não respondeu. Ela está ligada? Abra pelo abrir_site.bat.')
  }
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    throw new Error(corpo?.detail ?? `A API respondeu com erro ${resposta.status}.`)
  }
  return corpo as T
}
