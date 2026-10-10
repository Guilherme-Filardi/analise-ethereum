// Conversa com a API em Python. Toda conta é feita lá; aqui só se pede e se mostra.

export type Ponto = { data: string; valor: number }

export type Placar = { dias: number; acertos: number; taxa: number; sempre_sobe: number } | null

export type Hoje = {
  dia: string
  preco: number
  media_7: number
  media_30: number
  recorde: number
  recorde_dia: string
  abaixo_do_recorde: number
  preco_7_dias_antes: number
  variacao_semana: number
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
  pode_atualizar: boolean
  ultimos_90_dias: Ponto[]
}

export type LinhaDiario = Record<string, string>

export type Limites = { primeiro: string; ultimo: string }

export type Precos = {
  serie: Ponto[]
  inicio: string
  preco_inicio: number
  fim: string
  preco_fim: number
  variacao: number
  maior_dia: string
  maior: number
  menor_dia: string
  menor: number
}

export type Estudo = {
  historico_inicio: string
  historico_fim: string
  compra_1_ano: { compras: number; no_prejuizo: number; mediana: number; pior: number; melhor: number; susto_mediano: number }
  aporte: {
    meses: number; por_mes_ganhou: number; mediana_tudo: number; mediana_por_mes: number
    pior_tudo: number; pior_por_mes: number; melhor_tudo: number; melhor_por_mes: number
  }
  sinais: {
    inicio: string
    meio: string
    jeitos: { nome: string; final: number; pior_queda: number; operacoes: number; primeira_metade: number; segunda_metade: number }[]
  }
  palpites: { inicio: string; seguindo: number; esperando: number }
  gas: {
    inicio: string; fim: string; comercial: number; resto: number; hora_mais_cara: number
    hora_mais_barata: number; dia_mais_caro: string; dia_mais_barato: string; razao_dias: number
  } | null
}

export type Compra = {
  preco_compra: number
  preco_venda: number
  dia_compra: string
  dia_venda: string
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
