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
  sem_palpite_1_ano: number
  pode_atualizar: boolean
  ultimos_90_dias: Ponto[]
}

export type LinhaDiario = Record<string, string>

/** Uma vela: um dia, uma semana ou um mês. `data` é o primeiro dia dela; `fim`, o último. */
export type Vela = {
  data: string
  fim: string
  abertura: number
  maxima: number
  minima: number
  fechamento: number
  variacao: number
  dias: number
  aberta: boolean
}

export type Escala = 'dia' | 'semana' | 'mes'

export type Velas = {
  velas: Vela[]
  subiu: number
  caiu: number
  maior_alta_dia: string
  maior_alta: number
  maior_queda_dia: string
  maior_queda: number
  mexida_tipica: number
}

// ------------------------------------------------------------- previsão versão 2 e painel

export type PrevisaoHoje = {
  dia: string
  preco: number
  faixa1_min: number
  faixa1_max: number
  faixa7_min: number
  faixa7_max: number
  chance_subir: number | null
  palpite: 'sobe' | 'cai' | ''
  forca: 'forte' | 'média' | 'fraca' | ''
  versao: string
  cobertura: number
}

export type PlacarV2 = {
  dias: number
  acertos?: number
  taxa: number | null
  sempre_sobe?: number | null
  faixa_1_dias: number
  faixa_1_dentro: number | null
  faixa_7_dias: number
  faixa_7_dentro: number | null
} | null

/** O preço que veio num dia e a faixa que tinha sido prevista para ele na véspera. */
export type FaixaReal = { data: string; real: number; min: number; max: number }

export type Painel = {
  dia: string
  preco: number
  variacoes: { '1d': number | null; '7d': number | null; '30d': number | null; '1a': number | null }
  recorde: number
  recorde_dia: string
  abaixo_do_recorde: number
  mexida_tipica_30: number
  ultimos_30: Ponto[]
  previsao: PrevisaoHoje
  placar_2: { teste: PlacarV2; teste_desde: string | null; prova: PlacarV2; prova_desde: string; vivo: PlacarV2 }
  palpite_1: {
    veredito: 'momento bom' | 'momento ruim' | 'sem vantagem'
    chance_subir: number | null
    dias_parecidos: number
    teste: Placar
    sem_palpite_1_ano: number
    vivo: Placar
    versao: string
  }
  faixa_recente: FaixaReal[]
  pode_atualizar: boolean
}

export type Previsao = {
  hoje: PrevisaoHoje
  por_que: { sinal: string; empurrao: number; valor: number }[]
  modelo: { desde: string; dias_treino: number } | null
  regra: { versao: string; cobertura: number; lambda: number; passo: number; treino: number; l2: number }
  placar: PlacarV2
  teste_desde: string | null
  placar_prova: PlacarV2
  prova_desde: string
  calibracao: { de: number; ate: number; dias: number; prevista: number; subiu: number }[]
  por_forca: { forca: string; dias: number; acerto: number }[]
  por_ano: { ano: number; dias: number; acerto: number | null; sempre_sobe: number | null; faixa_1: number | null; faixa_7: number | null }[]
  faixa_contra_real: FaixaReal[]
}

// ------------------------------------------------------------- estatística (etapa 9)

export type Intervalo = {
  nome: string
  acertos: number
  dias: number
  taxa: number
  de: number
  ate: number
  referencia: number
  p: number
  dias_efetivos: number
}

export type ConferenciaVar = {
  metodo: 'historico' | 'ewma'
  nome: string
  dias: number
  rompimentos: number
  taxa: number
  kupiec_p: number
  seguidos: number
  independencia_p: number
}

export type Estatistica = {
  periodo: { inicio: string; fim: string; dias: number }
  distribuicao: {
    media: number
    desvio: number
    assimetria: number
    curtose_excesso: number
    jarque_bera: { estatistica: number; p: number }
    histograma: { de: number; ate: number; meio: number; dias: number; normal: number }[]
    extremos: { limite: number; reais: number; normal: number }[]
    pior_dia: { data: string; variacao: number }
    melhor_dia: { data: string; variacao: number }
  }
  autocorrelacao: {
    limite: number
    direcao: { defasagem: number; valor: number }[]
    tamanho: { defasagem: number; valor: number }[]
    fora_direcao: number
    fora_tamanho: number
    ljung_box: { defasagens: number; direcao_p: number; tamanho_p: number }
  }
  dia_da_semana: {
    treino: { de: string; ate: string }
    prova: { de: string; ate: string }
    dias: { dia: string; treino_media: number; treino_n: number; prova_media: number; prova_n: number }[]
    pior_no_treino: string
    prova_diferenca: number
    prova_p: number
  }
  cone: {
    inicio: string
    preco: number
    dias: number
    simulacoes: number
    bloco: number
    pontos: { dia: number; data: string; p5: number; p25: number; p50: number; p75: number; p95: number }[]
    chance_acima_hoje: number
    chance_cair_metade: number
    chance_dobrar: number
    conferencia: { testes: number; dentro_90: number; abaixo_p5: number; acima_p95: number; desde: string; anos_abaixo: number[]; anos_acima: number[] }
  }
  var: {
    nivel: number
    hoje: { historico: { var: number; es: number }; ewma: { var: number; es: number } }
    conferencia: ConferenciaVar[]
    ultimos_365: { data: string; variacao: number; var_ewma: number; var_historico: number; rompeu_ewma: boolean; rompeu_historico: boolean }[]
  }
  intervalos: Intervalo[]
}

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
    // "X-Pedido: site" diz à API que o pedido veio desta tela (outra página não consegue mandar).
    resposta = await fetch(endereco, { ...opcoes, headers: { 'X-Pedido': 'site', ...opcoes?.headers } })
  } catch {
    throw new Error('A API não respondeu. Ela está ligada? Abra pelo abrir_site.bat.')
  }
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    throw new Error(corpo?.detail ?? `A API respondeu com erro ${resposta.status}.`)
  }
  return corpo as T
}
