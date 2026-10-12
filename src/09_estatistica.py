"""Etapa 9: fundamentos estatísticos e risco. O que os números do ETH dizem quando medidos com
as ferramentas clássicas, e quanto se pode perder num dia ruim.

Seis perguntas, todas com a variação simples de cada dia (fechamento contra o da véspera),
que é a mais fácil de ler ("caiu 5%"):
1. DISTRIBUIÇÃO: os dias do ETH seguem a curva normal (o "sino")? Não: dia extremo aparece
   muito mais vezes do que o sino prevê. Medido pela curtose e pelo teste de Jarque-Bera.
2. AUTOCORRELAÇÃO: o dia de ontem diz algo do de hoje? Na direção (sobe ou cai), quase nada;
   no tamanho do movimento, sim (dia agitado puxa dia agitado). Teste de Ljung-Box.
3. DIA DA SEMANA: algum dia da semana é pior? Escolhido só em 2017 a 2021 e conferido em 2022
   a 2026, para não "achar" padrão no acaso.
4. CONE: onde o preço pode estar em 1 ano, sorteando pedaços de 30 dias do próprio passado
   (Monte Carlo). E conferido: quantas vezes o preço real caiu dentro do cone de 90%.
5. VaR (valor em risco): a perda de amanhã que só deve ser passada em 1 de cada 20 dias, por
   dois jeitos, e conferida dia a dia desde 2019 (testes de Kupiec e de Christoffersen).
6. INTERVALOS: os placares das previsões (etapas 7 e 8) com a margem de erro de 95% (Wilson).
   Um placar de 51% em 1.500 dias pode ser só sorte; o intervalo mostra se é.

Só numpy, pandas e a biblioteca padrão (as fórmulas do qui-quadrado e do intervalo de Wilson
estão escritas aqui). O sorteio usa semente fixa: rodar de novo dá os mesmos números.

Grava saidas/estatistica.txt.

Uso:
    python src/09_estatistica.py                                          (dados/eth_diario_binance.csv)
    python src/09_estatistica.py dados/exemplo_eth_diario_binance.csv     (outro arquivo, para teste)
"""

import importlib.util
import math
import sys
from bisect import bisect_right, insort
from pathlib import Path
from statistics import NormalDist

import numpy as np
import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "eth_diario_binance.csv"
SAIDAS = PASTA / "saidas"

# ------------------------------------------------------------------ os métodos (fixos)
# Escolhidos antes de olhar os resultados. Não ajuste olhando o placar: isso é decorar a prova.
NIVEL = 0.95             # VaR de 95%: a perda passada em 1 de cada 20 dias
LAMBDA = 0.94            # o mesmo peso da agitação da etapa 8 (RiskMetrics)
MINIMO_HISTORICO = 365   # dias de passado antes do primeiro VaR histórico
MINIMO_EWMA = 200        # dias de passado antes do primeiro VaR adaptável (como a faixa da etapa 8)
CONFERE_VAR_DESDE = "2019-01-01"
DEFASAGENS = 30          # autocorrelação de 1 a 30 dias
DEFASAGENS_LB = 10       # Ljung-Box com os 10 primeiros
EXTREMOS = [0.05, 0.10, 0.15, 0.20]
FIM_TREINO = "2021-12-31"   # dia da semana: escolhe até aqui, confere depois
# A previsão versão 2 foi escolhida olhando os resultados até 2021. A margem de erro dela só
# vale nos anos que ela não viu: contar 2019 a 2021 junto inflaria o placar.
INICIO_PROVA = "2022-01-01"
DIAS_CONE = 365
SIMULACOES = 10_000
SIMULACOES_CONFERENCIA = 2_000
BLOCO = 30               # pedaços de 30 dias seguidos: mantém juntos os períodos calmos e os agitados
PASSO_CONE = 7           # um ponto do cone por semana
CONE_PRIMEIRO = 730      # a conferência do cone começa com 2 anos de passado
CONE_INTERVALO = 30      # e testa um começo a cada 30 dias
SEMENTE = 2026
# ------------------------------------------------------------------

DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]  # dayofweek do pandas: 0 = segunda
NORMAL = NormalDist()
Z95 = NORMAL.inv_cdf(0.975)  # 1,96


def br_pct(valor, sinal=False, casas=1):
    if valor is None:
        return "-"
    return (f"{valor:+.{casas}%}" if sinal else f"{valor:.{casas}%}").replace(".", ",")


def br(valor, formato):
    """Número no jeito brasileiro: 1.234,5."""
    return f"{valor:{formato}}".translate(str.maketrans(",.", ".,"))


def br_p(p):
    return "-" if p is None else ("< 0,001" if p < 0.001 else f"{p:.3f}".replace(".", ","))


def moeda(valor):
    return "US$ " + f"{valor:,.2f}".translate(str.maketrans(",.", ".,"))


def carregar(nome):
    # Os scripts começam com número (07_, 08_), e o Python não importa esse nome direto.
    spec = importlib.util.spec_from_file_location(nome, PASTA / "src" / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


# ---------------------------------------------------------------- as fórmulas
# Sem scipy: só os casos que este estudo usa, em forma fechada.

def qui2_p(x, gl):
    """Chance de um qui-quadrado com `gl` graus de liberdade passar de x (o "p" do teste).

    1 grau: é o quadrado de uma normal, então 2 x (1 - Φ(√x)), escrito com o erfc, que não
    perde precisão quando o p é minúsculo. Grau par 2k: e^(-x/2) x Σ (x/2)^i / i!, i de 0 a k-1.
    """
    if x <= 0:
        return 1.0
    if gl == 1:
        return math.erfc(math.sqrt(x / 2))
    if gl % 2 == 0:
        return math.exp(-x / 2) * sum((x / 2) ** i / math.factorial(i) for i in range(gl // 2))
    raise ValueError("só 1 grau de liberdade ou grau par")


def wilson(taxa, n, z=Z95):
    """Intervalo de 95% de uma proporção (Wilson): não sai de 0 a 1 e funciona perto das pontas."""
    centro = (taxa + z * z / (2 * n)) / (1 + z * z / n)
    meia = z * math.sqrt(taxa * (1 - taxa) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centro - meia, centro + meia


def p_proporcao(taxa, n, referencia):
    """p bilateral: a taxa é diferente da referência? (aproximação normal, boa com centenas de dias)"""
    z = (taxa - referencia) / math.sqrt(referencia * (1 - referencia) / n)
    return math.erfc(abs(z) / math.sqrt(2))


def welch_menor(a, b):
    """p unilateral: a média de `a` é menor que a de `b`? (Welch, aproximação normal)"""
    z = (a.mean() - b.mean()) / math.sqrt(a.var(ddof=1) / len(a) + b.var(ddof=1) / len(b))
    return NORMAL.cdf(z)


def _verossimilhanca(k, n, p):
    """Log da chance de k rompimentos em n dias, com chance p cada (0 x log 0 = 0)."""
    return (k * math.log(p) if k else 0.0) + ((n - k) * math.log(1 - p) if n - k else 0.0)


def kupiec(rompimentos, dias, esperado=1 - NIVEL):
    """p do teste de Kupiec: a taxa de rompimentos do VaR bate com os 5% prometidos?"""
    lr = -2 * (_verossimilhanca(rompimentos, dias, esperado)
               - _verossimilhanca(rompimentos, dias, rompimentos / dias))
    return qui2_p(lr, 1)


def christoffersen(rompeu):
    """p do teste de independência de Christoffersen, e quantos rompimentos vieram logo depois
    de outro. Se os rompimentos vêm em rajada, o VaR demora a reagir à agitação."""
    a, b = rompeu[:-1], rompeu[1:]
    n00, n01 = int((~a & ~b).sum()), int((~a & b).sum())
    n10, n11 = int((a & ~b).sum()), int((a & b).sum())
    total = n00 + n01 + n10 + n11
    if total == 0:  # um dia só: não há par de dias seguidos para comparar
        return 1.0, 0
    pi = (n01 + n11) / total
    pi0 = n01 / (n00 + n01) if n00 + n01 else 0.0
    pi1 = n11 / (n10 + n11) if n10 + n11 else 0.0
    lr = -2 * (_verossimilhanca(n01 + n11, total, pi)
               - _verossimilhanca(n01, n00 + n01, pi0) - _verossimilhanca(n11, n10 + n11, pi1))
    return qui2_p(lr, 1), n11


# ---------------------------------------------------------------- 1. distribuição

def momentos(r):
    """Média, desvio, assimetria, curtose em excesso (0 no sino) e o teste de Jarque-Bera."""
    x = np.asarray(r, dtype=float)
    c = x - x.mean()
    m2, m3, m4 = (c ** 2).mean(), (c ** 3).mean(), (c ** 4).mean()
    assimetria, curtose = m3 / m2 ** 1.5, m4 / m2 ** 2 - 3
    jb = len(x) / 6 * (assimetria ** 2 + curtose ** 2 / 4)
    return {"media": x.mean(), "desvio": x.std(ddof=1), "assimetria": assimetria,
            "curtose_excesso": curtose, "jarque_bera": {"estatistica": jb, "p": qui2_p(jb, 2)}}


def histograma(r, media, desvio):
    """Dias por faixa de 1 ponto, de -15% a +15%, com as pontas abertas, contra o sino.

    "normal" é quantos dias cairiam na faixa se os dias seguissem o sino com a mesma média e o
    mesmo desvio. As pontas vão de -100% (de) e até +100% (ate), mas contam tudo além de 15%.
    """
    sino, n = NormalDist(media, desvio), len(r)
    bordas = [-1.0] + [i / 100 for i in range(-15, 16)] + [1.0]
    saida = []
    for de, ate in zip(bordas[:-1], bordas[1:]):
        baixo = -math.inf if de == -1.0 else de
        alto = math.inf if ate == 1.0 else ate
        # As pontas desenham meia faixa além dos 15%, para o gráfico não esticar até 100%.
        meio = ate - 0.005 if de == -1.0 else de + 0.005 if ate == 1.0 else (de + ate) / 2
        saida.append({"de": de, "ate": ate, "meio": meio, "dias": int(((r >= baixo) & (r < alto)).sum()),
                      "normal": n * (sino.cdf(alto) - sino.cdf(baixo))})
    return saida


def extremos(r, media, desvio):
    sino, n = NormalDist(media, desvio), len(r)
    return [{"limite": L, "reais": int((r.abs() > L).sum()),
             "normal": n * (sino.cdf(-L) + 1 - sino.cdf(L))} for L in EXTREMOS]


# ---------------------------------------------------------------- 2. autocorrelação

def autocorrelacao(x, defasagens=DEFASAGENS):
    """Correlação da série com ela mesma k dias antes, para k de 1 a `defasagens`."""
    c = np.asarray(x, dtype=float)
    c = c - c.mean()
    total = (c ** 2).sum()
    return [float((c[:-k] * c[k:]).sum() / total) for k in range(1, defasagens + 1)]


def ljung_box(rho, n, defasagens=DEFASAGENS_LB):
    """p do Ljung-Box: as primeiras `defasagens` autocorrelações, juntas, podem ser só acaso?"""
    q = n * (n + 2) * sum(rho[k - 1] ** 2 / (n - k) for k in range(1, defasagens + 1))
    return qui2_p(q, defasagens)


# ---------------------------------------------------------------- 3. dia da semana

def dia_da_semana(r):
    """Média de cada dia da semana; o pior é escolhido no treino e conferido só na prova."""
    treino, prova = r[r.index <= FIM_TREINO], r[r.index > FIM_TREINO]
    dias = []
    for i, nome in enumerate(DIAS_SEMANA):
        a, b = treino[treino.index.dayofweek == i], prova[prova.index.dayofweek == i]
        dias.append({"dia": nome, "treino_media": a.mean() if len(a) else None, "treino_n": len(a),
                     "prova_media": b.mean() if len(b) else None, "prova_n": len(b)})
    saida = {"treino": {"de": treino.index[0] if len(treino) else None, "ate": FIM_TREINO},
             "prova": {"de": "2022-01-01", "ate": prova.index[-1] if len(prova) else None},
             "dias": dias, "pior_no_treino": None, "prova_diferenca": None, "prova_p": None}
    if len(treino) == 0 or len(prova) == 0:
        return saida  # dado curto (o arquivo de exemplo começa em 2023): sem treino, sem teste
    pior = int(treino.groupby(treino.index.dayofweek).mean().idxmin())
    eh = prova.index.dayofweek == pior
    saida.update({"pior_no_treino": DIAS_SEMANA[pior],
                  "prova_diferenca": prova[eh].mean() - prova[~eh].mean(),
                  "prova_p": welch_menor(prova[eh], prova[~eh])})
    return saida


# ---------------------------------------------------------------- 4. o cone (Monte Carlo)

def sortear(lr, dias, simulacoes, gerador, bloco=BLOCO):
    """Variação acumulada (em log) de `simulacoes` caminhos de `dias` dias, montados com pedaços
    de `bloco` dias seguidos do passado, sorteados com reposição. O pedaço que passa do fim da
    história continua no começo (bloco circular), para todo dia ter a mesma chance de sair."""
    x = np.asarray(lr, dtype=float)
    blocos = -(-dias // bloco)
    inicios = gerador.integers(0, len(x), size=(simulacoes, blocos))
    indices = ((inicios[:, :, None] + np.arange(bloco)) % len(x)).reshape(simulacoes, -1)[:, :dias]
    return np.cumsum(x[indices], axis=1)


def cone(precos, gerador, simulacoes=SIMULACOES):
    lr = np.log(precos).diff().dropna()
    preco, inicio = float(precos.iloc[-1]), precos.index[-1]
    caminhos = preco * np.exp(sortear(lr, DIAS_CONE, simulacoes, gerador))  # coluna j = dia j + 1
    dias = list(range(0, DIAS_CONE + 1, PASSO_CONE))
    if dias[-1] != DIAS_CONE:
        dias.append(DIAS_CONE)
    pontos = []
    for dia in dias:
        q = [preco] * 5 if dia == 0 else np.percentile(caminhos[:, dia - 1], [5, 25, 50, 75, 95])
        pontos.append({"dia": dia, "data": inicio + pd.Timedelta(days=dia),
                       **dict(zip(["p5", "p25", "p50", "p75", "p95"], q))})
    final = caminhos[:, -1]
    return {"inicio": inicio, "preco": preco, "dias": DIAS_CONE, "simulacoes": simulacoes, "bloco": BLOCO,
            "pontos": pontos,
            "chance_acima_hoje": (final > preco).mean(),
            "chance_cair_metade": (caminhos.min(axis=1) <= preco / 2).mean(),
            "chance_dobrar": (final >= 2 * preco).mean()}


def conferir_cone(precos, gerador, simulacoes=SIMULACOES_CONFERENCIA):
    """O cone montado no passado acertou? Um começo a cada 30 dias, desde 2 anos de história.

    Cada cone usa só o que se sabia no fechamento do dia de começo (as variações até ele), e
    compara com o preço real 365 dias depois. As janelas de 1 ano se sobrepõem (dois testes
    seguidos dividem 11 meses), então os testes não são independentes: 70 testes valem bem
    menos que 70 provas separadas.
    """
    lr = np.log(precos).diff()
    linhas = []
    for i in range(CONE_PRIMEIRO, len(precos) - DIAS_CONE, CONE_INTERVALO):
        final = precos.iloc[i] * np.exp(sortear(lr.iloc[1:i + 1], DIAS_CONE, simulacoes, gerador)[:, -1])
        p5, p95 = np.percentile(final, [5, 95])
        linhas.append({"data": precos.index[i], "p5": p5, "p95": p95, "real": precos.iloc[i + DIAS_CONE]})
    return linhas


def resumo_conferencia(linhas):
    if not linhas:
        return {"testes": 0, "dentro_90": None, "abaixo_p5": None, "acima_p95": None, "desde": None,
                "anos_abaixo": [], "anos_acima": []}
    real = np.array([x["real"] for x in linhas])
    abaixo = real < np.array([x["p5"] for x in linhas])
    acima = real > np.array([x["p95"] for x in linhas])
    # Os anos em que começaram os cones que erraram, para a tela dizer de onde vêm os erros.
    anos = lambda marcados: sorted({x["data"].year for x, m in zip(linhas, marcados) if m})
    return {"testes": len(linhas), "dentro_90": (~abaixo & ~acima).mean(), "abaixo_p5": abaixo.mean(),
            "acima_p95": acima.mean(), "desde": linhas[0]["data"],
            "anos_abaixo": anos(abaixo), "anos_acima": anos(acima)}


# ---------------------------------------------------------------- 5. VaR

def quantil_crescente(x, minimo, nivel=NIVEL):
    """Para cada dia t: o quantil de (1 - nivel) e a média abaixo dele (ES), com os valores até t.

    Os dias vazios (NaN) não entram. Mesmo quantil "linear" do pandas.
    """
    ordenados, q, es = [], np.full(len(x), np.nan), np.full(len(x), np.nan)
    for t, valor in enumerate(x):
        if not np.isnan(valor):
            insort(ordenados, valor)
        m = len(ordenados)
        if m < minimo:
            continue
        h = (m - 1) * (1 - nivel)
        baixo = int(h)
        q[t] = ordenados[baixo] + (h - baixo) * (ordenados[min(baixo + 1, m - 1)] - ordenados[baixo])
        es[t] = np.mean(ordenados[:bisect_right(ordenados, q[t])])
    return q, es


def var_diario(r):
    """O VaR e o ES de 95% calculados no fechamento de cada dia, para o dia SEGUINTE.

    Perdas positivas (0,05 = perder 5%). Nenhum dos dois usa o dia seguinte:
    - histórico: o pior 5% de todas as variações até o dia;
    - adaptável: a agitação de hoje (EWMA, como a faixa da etapa 8) vezes o pior 5% das
      variações "padronizadas" do passado (variação do dia / agitação da véspera).
    """
    q, es = quantil_crescente(r.to_numpy(), MINIMO_HISTORICO)
    sigma = np.sqrt((r ** 2).ewm(alpha=1 - LAMBDA, adjust=False).mean())
    qz, esz = quantil_crescente((r / sigma.shift(1)).to_numpy(), MINIMO_EWMA)
    return pd.DataFrame({"var_historico": -q, "es_historico": -es,
                         "var_ewma": -qz * sigma, "es_ewma": -esz * sigma}, index=r.index)


def conferir_var(r, v):
    """Dia a dia desde 2019: a perda do dia passou do VaR calculado na véspera?"""
    previsto = v.shift(1)  # o VaR que valia para o dia, calculado no fechamento da véspera
    ok = (r.index >= CONFERE_VAR_DESDE) & previsto["var_historico"].notna() & previsto["var_ewma"].notna()
    nomes = {"historico": "Histórico (todos os dias desde 2017)", "ewma": "Adaptável (agitação recente)"}
    conferencia, rompeu = [], {}
    for metodo, nome in nomes.items():
        rompeu[metodo] = (r < -previsto[f"var_{metodo}"])[ok]
        x = rompeu[metodo].to_numpy()
        if len(x) == 0:
            continue
        independencia, seguidos = christoffersen(x)
        conferencia.append({"metodo": metodo, "nome": nome, "dias": len(x), "rompimentos": int(x.sum()),
                            "taxa": x.mean(), "kupiec_p": kupiec(int(x.sum()), len(x)),
                            "seguidos": seguidos, "independencia_p": independencia})
    ultimos = r.index[-365:]
    ultimos_365 = [{"data": dia, "variacao": r[dia],
                    "var_ewma": previsto.loc[dia, "var_ewma"], "var_historico": previsto.loc[dia, "var_historico"],
                    "rompeu_ewma": bool(r[dia] < -previsto.loc[dia, "var_ewma"]),
                    "rompeu_historico": bool(r[dia] < -previsto.loc[dia, "var_historico"])}
                   for dia in ultimos]
    return conferencia, ultimos_365


# ---------------------------------------------------------------- 6. intervalos dos placares

def intervalo(nome, acertos, dias, referencia, dias_efetivos=None):
    """O placar com a margem de erro de 95% e o p contra a referência (chutar, ou os 80% prometidos)."""
    efetivos = dias if dias_efetivos is None else dias_efetivos
    taxa = acertos / dias
    de, ate = wilson(taxa, efetivos)
    return {"nome": nome, "acertos": acertos, "dias": dias, "taxa": taxa, "de": de, "ate": ate,
            "referencia": referencia, "p": p_proporcao(taxa, efetivos, referencia), "dias_efetivos": efetivos}


def intervalos(placar_2, placar_1):
    """`placar_2` é o placar(d) da etapa 8 só na prova (d desde INICIO_PROVA); `placar_1`, o
    placar histórico da etapa 7 (regra com números fixados antes, sem escolha pelos resultados)."""
    saida = []
    if placar_2 and placar_2["dias"]:
        saida.append(intervalo("Sobe ou cai (versão 2), na prova", placar_2["acertos"], placar_2["dias"], 0.5))
    if placar_2 and placar_2["faixa_1_dias"]:
        n = placar_2["faixa_1_dias"]
        saida.append(intervalo("Faixa de amanhã (versão 2), na prova", round(placar_2["faixa_1_dentro"] * n), n, 0.8))
    if placar_2 and placar_2["faixa_7_dias"] >= 7:
        # Duas faixas de 7 dias seguidas dividem 6 dias: não são provas independentes. A margem
        # de erro usa 1 prova a cada 7 dias, que é o número de semanas que não se sobrepõem.
        n = placar_2["faixa_7_dias"]
        saida.append(intervalo("Faixa de 7 dias (versão 2), na prova", round(placar_2["faixa_7_dentro"] * n), n, 0.8,
                               dias_efetivos=n // 7))
    if placar_1:
        saida.append(intervalo("Palpite da regra antiga (versão 1)", placar_1["acertos"], placar_1["dias"], 0.5))
    return saida


# ---------------------------------------------------------------- tudo junto

def simples(valor):
    """Números do numpy e do pandas viram int, float e bool do Python; datas, "AAAA-MM-DD";
    NaN vira None. Assim o resultado vai direto para o JSON da API."""
    if isinstance(valor, dict):
        return {k: simples(v) for k, v in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [simples(v) for v in valor]
    if isinstance(valor, pd.Timestamp):
        return f"{valor:%Y-%m-%d}"
    if isinstance(valor, (bool, np.bool_)):
        return bool(valor)
    if isinstance(valor, (int, np.integer)):
        return int(valor)
    if isinstance(valor, (float, np.floating)):
        return None if math.isnan(valor) else float(valor)
    return valor


def analisar(precos, placar_2=None, placar_1=None):
    """As seis partes do estudo, num dicionário pronto para o JSON (o formato do /api/estatistica)."""
    r = precos.pct_change().dropna()
    m = momentos(r)
    rho_direcao, rho_tamanho = autocorrelacao(r), autocorrelacao(r.abs())
    limite = 1.96 / math.sqrt(len(r))
    v = var_diario(r)
    conferencia_var, ultimos_365 = conferir_var(r, v)
    gerador = np.random.default_rng(SEMENTE)
    cone_hoje = cone(precos, gerador)
    cone_hoje["conferencia"] = resumo_conferencia(conferir_cone(precos, np.random.default_rng(SEMENTE)))
    return simples({
        "periodo": {"inicio": r.index[0], "fim": r.index[-1], "dias": len(r)},
        "distribuicao": {
            **m,
            "histograma": histograma(r, m["media"], m["desvio"]),
            "extremos": extremos(r, m["media"], m["desvio"]),
            "pior_dia": {"data": r.idxmin(), "variacao": r.min()},
            "melhor_dia": {"data": r.idxmax(), "variacao": r.max()},
        },
        "autocorrelacao": {
            "limite": limite,
            "direcao": [{"defasagem": k, "valor": x} for k, x in enumerate(rho_direcao, 1)],
            "tamanho": [{"defasagem": k, "valor": x} for k, x in enumerate(rho_tamanho, 1)],
            "fora_direcao": sum(abs(x) > limite for x in rho_direcao),
            "fora_tamanho": sum(abs(x) > limite for x in rho_tamanho),
            "ljung_box": {"defasagens": DEFASAGENS_LB, "direcao_p": ljung_box(rho_direcao, len(r)),
                          "tamanho_p": ljung_box(rho_tamanho, len(r))},
        },
        "dia_da_semana": dia_da_semana(r),
        "cone": cone_hoje,
        "var": {
            "nivel": NIVEL,
            "hoje": {"historico": {"var": v["var_historico"].iloc[-1], "es": v["es_historico"].iloc[-1]},
                     "ewma": {"var": v["var_ewma"].iloc[-1], "es": v["es_ewma"].iloc[-1]}},
            "conferencia": conferencia_var,
            "ultimos_365": ultimos_365,
        },
        "intervalos": intervalos(placar_2, placar_1),
    })


def relatorio(e, exemplo=False):
    di, ac, sem, co, va = e["distribuicao"], e["autocorrelacao"], e["dia_da_semana"], e["cone"], e["var"]
    data = lambda s: pd.Timestamp(s).strftime("%d/%m/%Y")  # noqa: E731
    linhas = ["*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***", ""] if exemplo else []
    linhas += [
        f"FUNDAMENTOS ESTATÍSTICOS E RISCO DO ETH: {e['periodo']['dias']} dias,"
        f" de {data(e['periodo']['inicio'])} a {data(e['periodo']['fim'])}",
        "",
        "1. OS DIAS SEGUEM O SINO (A CURVA NORMAL)? NÃO.",
        f"  Variação média de um dia: {br_pct(di['media'], True, 2)}; desvio (o tamanho típico): {br_pct(di['desvio'], casas=2)}.",
        f"  Curtose em excesso: {br(di['curtose_excesso'], '.1f')} (no sino seria 0; acima de 0, ponta gorda)."
        f" Assimetria: {br(di['assimetria'], '.2f')}.",
        f"  Jarque-Bera: {br(di['jarque_bera']['estatistica'], ',.0f')}, p {br_p(di['jarque_bera']['p'])}"
        " (p pequeno: não é sino).",
        "  Dias com movimento maior que (para cima ou para baixo): reais contra o que o sino prevê",
    ]
    for x in di["extremos"]:
        # Perto do zero há MENOS dias que no sino (o ETH fica parado mais vezes); nas pontas, muito mais.
        vezes = ("menos que o sino" if x["reais"] < x["normal"]
                 else f"{br(x['reais'] / x['normal'], ',.1f')} vezes o sino")
        linhas.append(f"    {br_pct(x['limite'], casas=0):>4}: {x['reais']:>4} dias reais, sino {br(x['normal'], '.2f')} ({vezes})")
    linhas += [
        f"  Pior dia: {data(di['pior_dia']['data'])}, {br_pct(di['pior_dia']['variacao'], True)}."
        f" Melhor dia: {data(di['melhor_dia']['data'])}, {br_pct(di['melhor_dia']['variacao'], True)}.",
        "",
        "2. ONTEM DIZ ALGO DE HOJE?",
        f"  Direção (sobe ou cai): {ac['fora_direcao']} de 30 defasagens fora da margem de ±{br(ac['limite'], '.3f')};",
        f"  Ljung-Box (10 dias) p {br_p(ac['ljung_box']['direcao_p'])}.",
        f"  Tamanho do movimento: {ac['fora_tamanho']} de 30 fora da margem; Ljung-Box p {br_p(ac['ljung_box']['tamanho_p'])}.",
        f"  Correlação de 1 dia: direção {br(ac['direcao'][0]['valor'], '+.3f')}, tamanho {br(ac['tamanho'][0]['valor'], '+.3f')}.",
        "  Ou seja: a direção é quase cara ou coroa; dia agitado puxa dia agitado.",
        "",
        "3. ALGUM DIA DA SEMANA É PIOR? (escolhido em 2017 a 2021, conferido de 2022 em diante)",
    ]
    for x in sem["dias"]:
        linhas.append(f"    {x['dia']}: treino {br_pct(x['treino_media'], True, 2):>7} ({x['treino_n']} dias),"
                      f" prova {br_pct(x['prova_media'], True, 2):>7} ({x['prova_n']} dias)")
    if sem["pior_no_treino"]:
        linhas.append(f"  Pior no treino: {sem['pior_no_treino']}. Na prova, ele ficou"
                      f" {br_pct(sem['prova_diferenca'], True, 2)} contra os outros dias, p {br_p(sem['prova_p'])}"
                      f" ({'ainda pior' if sem['prova_p'] < 0.05 else 'não se confirmou'}).")
    else:
        linhas.append("  Sem dado de 2017 a 2021 para escolher: teste não feito.")
    c = co["conferencia"]
    fim = co["pontos"][-1]
    linhas += [
        "",
        f"4. ONDE O PREÇO PODE ESTAR EM 1 ANO ({br(co['simulacoes'], ',')} sorteios com pedaços de {co['bloco']} dias do passado)",
        f"  Hoje ({data(co['inicio'])}): {moeda(co['preco'])}. Em {data(fim['data'])}:",
        f"    90% dos caminhos entre {moeda(fim['p5'])} e {moeda(fim['p95'])}; metade entre"
        f" {moeda(fim['p25'])} e {moeda(fim['p75'])}; mediana {moeda(fim['p50'])}.",
        f"  Chance de terminar acima de hoje: {br_pct(co['chance_acima_hoje'])}; de dobrar:"
        f" {br_pct(co['chance_dobrar'])}; de cair à metade em algum momento: {br_pct(co['chance_cair_metade'])}.",
    ]
    if c["testes"]:
        linhas.append(f"  Conferência ({c['testes']} cones desde {data(c['desde'])}, só com o passado de cada um):"
                      f" o preço real caiu dentro do cone de 90% em {br_pct(c['dentro_90'])}, abaixo em"
                      f" {br_pct(c['abaixo_p5'])}, acima em {br_pct(c['acima_p95'])}. Os anos se sobrepõem:"
                      " os testes não são independentes.")
    linhas += ["", "5. QUANTO SE PODE PERDER AMANHÃ (VaR de 95%: só 1 dia em 20 deve perder mais)"]
    for metodo, nome in (("historico", "histórico"), ("ewma", "adaptável")):
        h = va["hoje"][metodo]
        linhas.append(f"  {nome}: perder mais de {br_pct(h['var'])} (nesses dias ruins, em média {br_pct(h['es'])})")
    for x in va["conferencia"]:
        linhas.append(f"  Conferido, {x['nome']}: {x['rompimentos']} rompimentos em {x['dias']} dias ="
                      f" {br_pct(x['taxa'])} (prometido 5%), Kupiec p {br_p(x['kupiec_p'])};"
                      f" {x['seguidos']} logo depois de outro, independência p {br_p(x['independencia_p'])}.")
    linhas += ["", "6. OS PLACARES COM A MARGEM DE ERRO DE 95%"]
    for x in e["intervalos"]:
        nota = f", contando {x['dias_efetivos']} semanas" if x["dias_efetivos"] != x["dias"] else ""
        linhas.append(f"  {x['nome']}: {x['acertos']} em {x['dias']} = {br_pct(x['taxa'])}, margem"
                      f" {br_pct(x['de'])} a {br_pct(x['ate'])}{nota}; contra {br_pct(x['referencia'], casas=0)},"
                      f" p {br_p(x['p'])}")
    linhas += ["", "p é a chance de ver um resultado assim só por acaso. Abaixo de 0,05, dificilmente é acaso."]
    return "\n".join(linhas) + "\n"


def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    prefixo = "exemplo_" if exemplo else ""

    previsao, veredito = carregar("08_previsao"), carregar("07_veredito")
    t = previsao.ler(entrada)
    d, _ = previsao.previsoes(t)
    v1 = veredito.vereditos(veredito.caracteristicas(t["fechamento"]))
    placar_1 = veredito.placar(v1["veredito"].iloc[:-1], v1["amanha_subiu"].iloc[:-1])
    e = analisar(t["fechamento"], previsao.placar(d.loc[INICIO_PROVA:]), placar_1)

    texto = relatorio(e, exemplo)
    SAIDAS.mkdir(exist_ok=True)
    (SAIDAS / f"{prefixo}estatistica.txt").write_text(texto, encoding="utf-8")
    print(texto)
    print(f"Gravado: saidas/{prefixo}estatistica.txt ({e['periodo']['dias']} dias,"
          f" de {e['periodo']['inicio']} a {e['periodo']['fim']})")


if __name__ == "__main__":
    main()
