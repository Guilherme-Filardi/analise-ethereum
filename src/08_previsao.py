"""Etapa 8: previsão versão 2. Uma faixa de preço para amanhã e para daqui a 7 dias, e a
chance de o preço subir amanhã, com palpite todo dia.

Roda uma vez por dia, depois da etapa 5 (que atualiza dados/eth_diario_binance.csv), ao lado
da etapa 7 (a regra versão 1, que continua congelada e anotando o diário dela). A cada rodada:
1. confere as previsões anteriores cujo prazo já fechou (caiu dentro da faixa? acertou?);
2. anota a previsão do último dia fechado no diário;
3. mostra o placar ao vivo e o placar do teste com o passado.

As duas partes, e por que cada uma é assim (escolhidas olhando só 2017 a 2021, e conferidas
em 2022 a 2026, que elas não tinham visto; o estudo está no README):
- A FAIXA de 80%: o tamanho do movimento é previsível, porque dia agitado puxa dia agitado.
  A volatilidade de hoje (uma média dos movimentos recentes que pesa mais os últimos dias,
  a "EWMA" de 0,94) vezes os quantis de 10% e 90% do passado. Na prova, o preço caiu dentro
  dela em 80,3% dos dias seguintes e em 80,8% das semanas seguintes.
- A CHANCE DE SUBIR: uma regressão logística (a conta que transforma 12 sinais numa chance
  entre 0 e 100%) que se reajusta a cada 30 dias só com o que já se sabia. Na prova, o palpite
  acertou 51,7% dos dias, contra 50,3% de dizer "sobe" todo dia. A direção de um dia do ETH
  é quase cara ou coroa; o palpite existe para medir isso ao vivo, e não para comprar.

Grava saidas/previsao_hoje.txt e saidas/diario_previsao.csv.

Uso:
    python src/08_previsao.py                                          (dados/eth_diario_binance.csv)
    python src/08_previsao.py dados/exemplo_eth_diario_binance.csv     (outro arquivo, para teste)
"""

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "eth_diario_binance.csv"
SAIDAS = PASTA / "saidas"

# ------------------------------------------------------------------ A REGRA (congelada)
# Como na versão 1: não mude estes números depois que o diário começar. Mudança vira versão 3.
VERSAO = "2 (11/10/2026)"
COBERTURA = 0.80     # a faixa deve conter o preço em 8 de cada 10 vezes
LAMBDA = 0.94        # peso da volatilidade de ontem na de hoje (o padrão do mercado, RiskMetrics)
MINIMO_FAIXA = 200   # dias de passado antes da primeira faixa
TREINO = 400         # dias com todos os sinais antes da primeira chance de subir
PASSO = 30           # a regressão se reajusta a cada 30 dias
L2 = 300.0           # freio da regressão: quanto maior, mais perto de 50% ela fica
FORCA = [(0.04, "forte"), (0.02, "média"), (0.0, "fraca")]  # distância da chance até 50%
# ------------------------------------------------------------------

# A regra foi escolhida olhando os resultados até 2021. O placar que vale é o dos anos seguintes
# (a "prova"): somar 2019 a 2021 inflaria o acerto. O mesmo corte do src/09_estatistica.py.
INICIO_PROVA = "2022-01-01"

NOMES_SINAIS = {
    "r1": "variação de ontem",
    "r3": "variação de 3 dias",
    "r7": "variação de 7 dias",
    "r30": "variação de 30 dias",
    "ma7_30": "média de 7 contra a de 30 dias",
    "ma50_200": "média de 50 contra a de 200 dias",
    "topo": "distância do recorde",
    "vol30": "agitação de 30 dias",
    "vol_ratio": "agitação da semana contra a do mês",
    "pos_dia": "fechou perto da máxima ou da mínima do dia",
    "volume": "volume contra o do mês",
    "r1_z": "variação de ontem, pelo tamanho normal",
}


def br_pct(valor, sinal=False):
    return (f"{valor:+.1%}" if sinal else f"{valor:.1%}").replace(".", ",")


def moeda(valor):
    return "US$ " + f"{valor:,.2f}".translate(str.maketrans(",.", ".,"))


def ler(caminho=ENTRADA):
    tabela = pd.read_csv(caminho, parse_dates=["data"])
    return tabela.set_index("data")[["abertura", "maxima", "minima", "fechamento", "volume_usdt"]].astype(float)


# ---------------------------------------------------------------- a faixa

def faixa(precos, dias):
    """Preço mínimo e máximo esperados `dias` depois de cada dia, com 80% de chance.

    A volatilidade (EWMA) mede a agitação de hoje. Os quantis dizem quantas "agitações" o
    preço costuma andar em `dias`: vêm de todos os movimentos já terminados até o dia, sem
    espiar o futuro (o movimento que começou `dias` atrás termina hoje, e é o último que entra).
    """
    r = np.log(precos).diff()
    sigma = np.sqrt((r ** 2).ewm(alpha=1 - LAMBDA, adjust=False).mean() * dias)
    andou = np.log(precos.shift(-dias) / precos) / sigma
    conhecido = andou.shift(dias)
    baixo = conhecido.expanding(MINIMO_FAIXA).quantile((1 - COBERTURA) / 2)
    alto = conhecido.expanding(MINIMO_FAIXA).quantile(1 - (1 - COBERTURA) / 2)
    return pd.DataFrame({"min": precos * np.exp(baixo * sigma), "max": precos * np.exp(alto * sigma)})


# ---------------------------------------------------------------- a chance de subir

def sinais(t):
    """Os 12 sinais de cada dia, todos com o que se sabia no fechamento dele."""
    p = t["fechamento"]
    r = np.log(p).diff()
    vol = r.rolling(30).std()
    s = pd.DataFrame(index=t.index)
    s["r1"] = r
    s["r3"] = np.log(p / p.shift(3))
    s["r7"] = np.log(p / p.shift(7))
    s["r30"] = np.log(p / p.shift(30))
    s["ma7_30"] = np.log(p.rolling(7).mean() / p.rolling(30).mean())
    s["ma50_200"] = np.log(p.rolling(50).mean() / p.rolling(200).mean())
    s["topo"] = np.log(p / p.cummax())
    s["vol30"] = np.log(vol)
    s["vol_ratio"] = np.log(r.rolling(7).std() / vol)
    s["pos_dia"] = (t["fechamento"] - t["minima"]) / (t["maxima"] - t["minima"]) - 0.5
    s["volume"] = np.log(t["volume_usdt"] / t["volume_usdt"].rolling(30).mean())
    s["r1_z"] = r / vol
    return s.replace([np.inf, -np.inf], np.nan)


def ajustar(X, y, l2=L2):
    """Regressão logística com freio (L2), pelo método de Newton. Devolve [constante, pesos...]."""
    X = np.c_[np.ones(len(X)), X]
    freio = l2 * np.diag(np.r_[0.0, np.ones(X.shape[1] - 1)])  # a constante não é freada
    w = np.zeros(X.shape[1])
    for _ in range(30):
        q = 1 / (1 + np.exp(-(X @ w)))
        passo = np.linalg.solve((X * (q * (1 - q))[:, None]).T @ X + freio, X.T @ (q - y) + freio @ w)
        w -= passo
        if np.abs(passo).max() < 1e-10:
            break
    return w


def chance_de_subir(t):
    """A chance de o dia seguinte fechar acima, para cada dia, só com o passado.

    A cada 30 dias a regressão é refeita com todos os dias cujo resultado já se conhecia, e vale
    para os 30 dias seguintes. Um dia novo no fim nunca muda a chance dos dias anteriores.
    Devolve a chance de cada dia e o último modelo (para explicar a chance de hoje).
    """
    s = sinais(t)
    p = t["fechamento"]
    subiu = (p.shift(-1) > p).astype(float).where(p.shift(-1).notna())
    dias = s.index[s.notna().all(axis=1)]
    chance = pd.Series(np.nan, index=t.index)
    modelo = None
    for inicio in range(TREINO, len(dias), PASSO):
        bloco = dias[inicio:inicio + PASSO]
        treino = dias[:inicio]
        treino = treino[subiu.loc[treino].notna()]  # o dia anterior ao bloco já tem resposta
        media, desvio = s.loc[treino].mean(), s.loc[treino].std()
        w = ajustar(((s.loc[treino] - media) / desvio).values, subiu.loc[treino].values)
        z = ((s.loc[bloco] - media) / desvio).values
        chance.loc[bloco] = 1 / (1 + np.exp(-(w[0] + z @ w[1:])))
        modelo = {"media": media, "desvio": desvio, "pesos": pd.Series(w[1:], index=s.columns),
                  "constante": w[0], "desde": bloco[0], "dias_treino": len(treino)}
    return chance, modelo


def forca(chance):
    distancia = abs(chance - 0.5)
    return next(nome for limite, nome in FORCA if distancia >= limite)


def por_que(t, modelo):
    """Quanto cada sinal de hoje empurrou a chance para cima ou para baixo (em pontos do logit)."""
    s = sinais(t).iloc[-1]
    z = (s - modelo["media"]) / modelo["desvio"]
    empurrao = (z * modelo["pesos"]).sort_values(key=abs, ascending=False)
    return [{"sinal": NOMES_SINAIS[k], "empurrao": float(v), "valor": float(s[k])} for k, v in empurrao.items()]


# ---------------------------------------------------------------- tudo junto

def previsoes(t):
    """Uma linha por dia: a previsão daquele dia e, quando já se sabe, o que aconteceu."""
    p = t["fechamento"]
    chance, modelo = chance_de_subir(t)
    f1, f7 = faixa(p, 1), faixa(p, 7)
    d = pd.DataFrame({
        "preco": p,
        "chance_subir": chance,
        "faixa1_min": f1["min"], "faixa1_max": f1["max"],
        "faixa7_min": f7["min"], "faixa7_max": f7["max"],
        "preco_1": p.shift(-1), "preco_7": p.shift(-7),
    })
    d["palpite"] = np.where(d["chance_subir"].isna(), "", np.where(d["chance_subir"] > 0.5, "sobe", "cai"))
    d["subiu"] = (d["preco_1"] > d["preco"]).where(d["preco_1"].notna())
    d["acertou"] = ((d["palpite"] == "sobe") == d["subiu"]).where(d["subiu"].notna() & (d["palpite"] != ""))
    d["dentro_1"] = d["preco_1"].between(d["faixa1_min"], d["faixa1_max"]).where(
        d["preco_1"].notna() & d["faixa1_min"].notna())
    d["dentro_7"] = d["preco_7"].between(d["faixa7_min"], d["faixa7_max"]).where(
        d["preco_7"].notna() & d["faixa7_min"].notna())
    return d, modelo


def placar(d):
    """Acerto do palpite e da faixa, só nos dias em que já se sabe o resultado."""
    com_palpite = d["acertou"].dropna().astype(bool)
    dias_subiu = d.loc[com_palpite.index, "subiu"].astype(bool)
    f1, f7 = d["dentro_1"].dropna().astype(bool), d["dentro_7"].dropna().astype(bool)
    if len(com_palpite) == 0 and len(f1) == 0:
        return None
    return {
        "dias": len(com_palpite),
        "acertos": int(com_palpite.sum()),
        "taxa": float(com_palpite.mean()) if len(com_palpite) else None,
        "sempre_sobe": float(dias_subiu.mean()) if len(dias_subiu) else None,
        "faixa_1_dias": len(f1),
        "faixa_1_dentro": float(f1.mean()) if len(f1) else None,
        "faixa_7_dias": len(f7),
        "faixa_7_dentro": float(f7.mean()) if len(f7) else None,
    }


# ---------------------------------------------------------------- o diário

COLUNAS = ["dia", "preco", "faixa1_min", "faixa1_max", "faixa7_min", "faixa7_max", "chance_subir",
           "palpite", "forca", "preco_1", "subiu", "acertou", "dentro_1", "preco_7", "dentro_7",
           "versao_regra", "anotado_em"]


def sim_nao(valor):
    return "" if pd.isna(valor) else ("sim" if valor else "não")


def gravar(tabela, caminho, **opcoes):
    """Grava num arquivo temporário e troca de uma vez (os.replace).

    Quem ler ao mesmo tempo (o site, ou o agendamento das 21h30 junto com o botão "Buscar
    agora") nunca vê o arquivo pela metade. Se der erro, o arquivo antigo fica como estava.
    """
    temporario = caminho.with_name(caminho.name + ".gravando")
    try:
        tabela.to_csv(temporario, index=False, **opcoes)
        os.replace(temporario, caminho)
    finally:
        temporario.unlink(missing_ok=True)


def atualizar_diario(caminho, d, agora_utc):
    """Confere o que já fechou e acrescenta a previsão do último dia (uma vez por dia de dado).

    Como na versão 1, só o último dia entra: dia perdido fica de fora, porque anotar depois,
    já sabendo o resultado, não seria previsão.
    """
    if caminho.exists():
        diario = pd.read_csv(caminho, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    else:
        diario = pd.DataFrame(columns=COLUNAS)

    for i, linha in diario.iterrows():
        dia = pd.Timestamp(linha["dia"])
        if dia not in d.index:
            continue
        x = d.loc[dia]
        if not linha["preco_1"] and pd.notna(x["preco_1"]):
            diario.loc[i, "preco_1"] = f"{x['preco_1']:.2f}"
            diario.loc[i, "subiu"] = sim_nao(x["preco_1"] > float(linha["preco"]))
            diario.loc[i, "acertou"] = sim_nao((linha["palpite"] == "sobe") == (x["preco_1"] > float(linha["preco"])))
            diario.loc[i, "dentro_1"] = sim_nao(float(linha["faixa1_min"]) <= x["preco_1"] <= float(linha["faixa1_max"]))
        if not linha["preco_7"] and pd.notna(x["preco_7"]):
            diario.loc[i, "preco_7"] = f"{x['preco_7']:.2f}"
            diario.loc[i, "dentro_7"] = sim_nao(float(linha["faixa7_min"]) <= x["preco_7"] <= float(linha["faixa7_max"]))

    ultimo = d.iloc[-1]
    dia = f"{d.index[-1]:%Y-%m-%d}"
    # Nunca um dia anterior ao último anotado: se o histórico voltar no tempo, esse dia já tem
    # resultado conhecido, e anotá-lo seria espiar.
    novo = diario.empty or dia > diario["dia"].max()
    if dia not in set(diario["dia"]) and novo and pd.notna(ultimo["chance_subir"]):
        nova = {c: "" for c in COLUNAS}
        nova.update({
            "dia": dia, "preco": f"{ultimo['preco']:.2f}",
            "faixa1_min": f"{ultimo['faixa1_min']:.2f}", "faixa1_max": f"{ultimo['faixa1_max']:.2f}",
            "faixa7_min": f"{ultimo['faixa7_min']:.2f}", "faixa7_max": f"{ultimo['faixa7_max']:.2f}",
            "chance_subir": f"{ultimo['chance_subir']:.4f}", "palpite": ultimo["palpite"],
            "forca": forca(ultimo["chance_subir"]), "versao_regra": VERSAO, "anotado_em": agora_utc,
        })
        diario = pd.concat([diario, pd.DataFrame([nova])], ignore_index=True)

    caminho.parent.mkdir(exist_ok=True)
    try:
        gravar(diario, caminho, encoding="utf-8-sig")  # "-sig": o Excel abre os acentos
    except PermissionError:
        print(f"ATENÇÃO: não consegui gravar {caminho.name} (está aberto no Excel?). Feche o"
              " arquivo e rode de novo ainda hoje: amanhã este dia não entra mais no diário.")

    return diario


def placar_do_diario(diario):
    """O placar ao vivo, só com o que foi anotado antes de acontecer, e só da versão atual."""
    diario = diario[diario["versao_regra"] == VERSAO]
    def taxa(coluna):
        x = diario.loc[diario[coluna] != "", coluna]
        return (len(x), float((x == "sim").mean())) if len(x) else (0, None)
    dias, acerto = taxa("acertou")
    d1, f1 = taxa("dentro_1")
    d7, f7 = taxa("dentro_7")
    return {"dias": dias, "taxa": acerto, "faixa_1_dias": d1, "faixa_1_dentro": f1,
            "faixa_7_dias": d7, "faixa_7_dentro": f7}


# ---------------------------------------------------------------- rodar

def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    prefixo = "exemplo_" if exemplo else ""

    t = ler(entrada)
    d, modelo = previsoes(t)
    # Sem chance no último dia não há o que anotar: ou o dado é curto (a regressão pede ~600
    # dias), ou falta um sinal hoje (máxima igual à mínima, volume zero). Sai sem gravar nada,
    # em vez de quebrar no meio do texto; o que já fechou no diário se confere na próxima rodada.
    if pd.isna(d["chance_subir"].iloc[-1]):
        if modelo is None:
            print(f"Dado curto demais para prever: {len(t)} dias, e a regressão pede cerca de"
                  f" {200 + TREINO} (200 de aquecimento das médias + {TREINO} de treino). Nada foi gravado.")
        else:
            faltam = [NOMES_SINAIS[k] for k, v in sinais(t).iloc[-1].items() if pd.isna(v)]
            print(f"Sem previsão para {d.index[-1]:%d/%m/%Y}: faltou o sinal {', '.join(faltam)}."
                  " Nada foi gravado.")
        return
    agora = datetime.now(timezone.utc)
    atraso = (agora.date() - d.index[-1].date()).days
    if not exemplo and atraso > 1:
        print(f"ATENÇÃO: o último dia do dado é {d.index[-1]:%d/%m/%Y}, {atraso} dias atrás."
              " Rode antes a etapa 5 (src/05_historico_binance.py).")

    SAIDAS.mkdir(exist_ok=True)
    diario = atualizar_diario(SAIDAS / f"{prefixo}diario_previsao.csv", d, agora.strftime("%Y-%m-%d %H:%M UTC"))

    hoje, dia = d.iloc[-1], d.index[-1]
    vivo = placar_do_diario(diario)
    prova = d.loc[INICIO_PROVA:]
    teste = placar(prova) if len(prova) else None
    if teste is None:  # dado que acaba antes da prova (só nos exemplos): usa o teste inteiro
        prova, teste = d, placar(d)
    inicio = prova["chance_subir"].first_valid_index() or prova.index[0]
    linhas = ["*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***", ""] if exemplo else []
    linhas += [
        f"PREVISÃO {VERSAO}, A PARTIR DO FECHAMENTO DE {dia:%d/%m/%Y}: {moeda(hoje['preco'])}",
        "",
        f"Amanhã ({dia + pd.Timedelta(days=1):%d/%m}, fecha às 21h em Brasília), com 80% de chance:",
        f"  entre {moeda(hoje['faixa1_min'])} e {moeda(hoje['faixa1_max'])}",
        f"Daqui a 7 dias ({dia + pd.Timedelta(days=7):%d/%m}), com 80% de chance:",
        f"  entre {moeda(hoje['faixa7_min'])} e {moeda(hoje['faixa7_max'])}",
        "",
        f"Chance de subir amanhã: {br_pct(hoje['chance_subir'])}"
        f"  ->  palpite: {hoje['palpite'].upper()} (força {forca(hoje['chance_subir'])})",
        "Os sinais que mais pesaram hoje (+ empurra para subir, - para cair):",
    ]
    for item in por_que(t, modelo)[:4]:
        linhas.append(f"  {item['empurrao']:+.3f}  {item['sinal']}")
    linhas += [
        "",
        f"Na prova ({inicio:%d/%m/%Y} em diante, anos que a regra não viu ao ser escolhida; cada dia só"
        " com o que se sabia nele):",
        # Com a primeira chance caindo no último dia, ainda não há palpite conferido no teste.
        f"  palpite: {teste['acertos']} acertos em {teste['dias']} dias = {br_pct(teste['taxa'])}"
        f" (dizer 'sobe' todo dia: {br_pct(teste['sempre_sobe'])})" if teste["dias"] else
        "  palpite: ainda nenhum dia conferido",
        f"  faixa de amanhã: o preço caiu dentro em {br_pct(teste['faixa_1_dentro'])} de {teste['faixa_1_dias']} dias",
        f"  faixa de 7 dias: o preço caiu dentro em {br_pct(teste['faixa_7_dentro'])} de {teste['faixa_7_dias']} dias",
        "Ao vivo (diário): "
        + (f"palpite {br_pct(vivo['taxa'])} em {vivo['dias']} dias" if vivo["dias"] else "ainda sem palpite conferido")
        + (f"; faixa de amanhã {br_pct(vivo['faixa_1_dentro'])} em {vivo['faixa_1_dias']} dias" if vivo["faixa_1_dias"] else ""),
        "",
        "A faixa é a parte forte: o tamanho do movimento é previsível. A direção de um dia é quase",
        "cara ou coroa, e o placar ao vivo é o que vai dizer se o palpite vale alguma coisa.",
    ]
    texto = "\n".join(linhas) + "\n"
    (SAIDAS / f"{prefixo}previsao_hoje.txt").write_text(texto, encoding="utf-8")
    print(texto)
    print(f"Gravado: saidas/{prefixo}previsao_hoje.txt e saidas/{prefixo}diario_previsao.csv"
          f" ({len(diario)} linhas no diário)")


if __name__ == "__main__":
    main()
