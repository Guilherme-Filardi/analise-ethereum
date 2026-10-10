"""Etapa 6: guia de risco e jeitos de comprar ETH, com o histórico da Binance desde 2017.

Responde 3 perguntas com o preço real do passado:
1. Se eu comprasse num dia qualquer, como estaria 1, 3, 6 e 12 meses depois?
   (E nos dias parecidos com hoje, com o preço igualmente longe do recorde?)
2. É melhor comprar tudo de uma vez ou um pouco por mês (preço médio)?
3. Os sinais famosos de médias móveis teriam ganhado de comprar e esperar?

Grava saidas/guia.txt (o relatório) e 3 gráficos: saidas/guia_1_comprar_qualquer_dia.png,
saidas/guia_2_aporte.png e saidas/guia_3_sinais.png.

Não é previsão nem recomendação: mostra o que aconteceu no passado, com os limites dele.

Uso:
    python src/06_guia.py                                          (lê dados/eth_diario_binance.csv)
    python src/06_guia.py dados/exemplo_eth_diario_binance.csv     (lê outro arquivo, para teste)
"""

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # só grava o arquivo; não abre janela (roda igual na nuvem e no Windows)
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "eth_diario_binance.csv"
SAIDAS = PASTA / "saidas"

# Pergunta 1: quanto tempo depois da compra olhar o resultado (em dias).
PRAZOS = {"1 mês": 30, "3 meses": 91, "6 meses": 182, "12 meses": 365}
# "Parecido com hoje": a distância do recorde a até 10 pontos da de hoje, para mais ou menos.
FAIXA_PARECIDO = 0.10
# Pergunta 2: o valor simulado e em quantos meses o preço médio divide a compra.
VALOR = 1000.0
MESES = 12
# Pergunta 3: os pares de médias testados e a taxa da corretora por operação (0,1% na Binance).
SINAIS = {"Médias 7 e 30 dias": (7, 30), "Médias 50 e 200 dias": (50, 200)}
TAXA = 0.001

# Cores (paleta de referência do guia de gráficos), as mesmas das outras etapas.
COR_TEXTO = "#0b0b0b"
COR_TEXTO_2 = "#52514e"
COR_GRADE = "#e4e3df"
COR_FUNDO = "#fcfcfb"
COR_1 = "#2a78d6"  # azul
COR_2 = "#eb6834"  # laranja
COR_3 = "#1baf7a"  # verde-água


def pct(valor, sinal=False):
    """Porcentagem com vírgula: -0.0672 vira "-6,7%"."""
    return (f"{valor:+.1%}" if sinal else f"{valor:.1%}").replace(".", ",")


def inteiro(valor):
    """Número inteiro com ponto no milhar: 1319 vira "1.319"."""
    return f"{valor:,.0f}".replace(",", ".")


def moeda(valor):
    """US$ no jeito brasileiro: 2480.81 vira "US$ 2.480,81"."""
    return "US$ " + f"{valor:,.2f}".translate(str.maketrans(",.", ".,"))


# ---------------------------------------------------------------- pergunta 1

def a_frente(precos, dias):
    """Para cada dia de compra: o retorno `dias` depois e o pior momento no caminho.

    "Pior momento no caminho" é o quanto a compra chegou a estar no vermelho em algum dia
    até o prazo, mesmo que tenha terminado no lucro. É o susto que você teria de aguentar.
    """
    retorno = precos.shift(-dias) / precos - 1
    # Mínimo dos próximos `dias` dias (incluindo o da compra): rolagem na série invertida.
    invertida = pd.Series(precos.values[::-1])
    minimo = invertida.rolling(dias + 1).min().values[::-1]
    pior = pd.Series(minimo, index=precos.index) / precos - 1
    return pd.DataFrame({"retorno": retorno, "pior_no_caminho": pior}).dropna()


def resumir(resultado):
    r = resultado["retorno"]
    return {
        "compras": len(r),
        "no_prejuizo": (r < 0).mean(),
        "mediana": r.median(),
        "p10": r.quantile(0.10),
        "p90": r.quantile(0.90),
        "pior": r.min(),
        "melhor": r.max(),
        "susto_mediano": resultado["pior_no_caminho"].median(),
    }


def queda_do_topo(precos):
    """Quanto o preço está abaixo do maior valor visto até aquele dia (0 = no recorde)."""
    return precos / precos.cummax() - 1


def episodios(marcados):
    """Quantos trechos seguidos de dias marcados existem (dias colados contam como um só)."""
    marcados = marcados.astype(bool)
    return int((marcados & ~marcados.shift(1, fill_value=False)).sum())


# ---------------------------------------------------------------- pergunta 2

def aporte(precos, valor=VALOR, meses=MESES, taxa=TAXA):
    """Compara, para cada mês de início, comprar tudo de uma vez com dividir em `meses` meses.

    Usa o primeiro fechamento de cada mês. Os dois jeitos são avaliados no mesmo dia: o
    começo do mês `meses` depois do início.
    """
    mensal = precos.resample("MS").first().dropna()
    linhas = []
    for i in range(len(mensal) - meses):
        fim = mensal.iloc[i + meses]
        unica = valor * (1 - taxa) / mensal.iloc[i] * fim
        cotas = sum(valor / meses * (1 - taxa) / mensal.iloc[i + k] for k in range(meses))
        linhas.append((mensal.index[i], unica, cotas * fim))
    return pd.DataFrame(linhas, columns=["inicio", "tudo_de_uma_vez", "por_mes"]).set_index("inicio")


# ---------------------------------------------------------------- pergunta 3

def estrategia(precos, curta, longa, taxa=TAXA):
    """Carteira que fica comprada só quando a média curta está acima da longa.

    O sinal de um dia só vale a partir do dia seguinte: no fechamento você vê o sinal e
    compra ou vende ali, então o retorno de hoje não pode usar o sinal de hoje (seria espiar
    o futuro). Cada troca paga a taxa. Devolve o valor da carteira (começando em 1) e a
    posição de cada dia (1 = comprado, 0 = fora).
    """
    sinal = (precos.rolling(curta).mean() > precos.rolling(longa).mean()).astype(int)
    posicao = sinal.shift(1).fillna(0)
    trocas = posicao.diff().abs().fillna(posicao.iloc[0])
    retorno = posicao * precos.pct_change().fillna(0) - trocas * taxa
    return (1 + retorno).cumprod(), posicao


def maior_queda(carteira):
    return (carteira / carteira.cummax() - 1).min()


def comparar_sinais(precos):
    """Roda cada sinal e o "comprar e esperar" a partir do mesmo dia, para ser justo."""
    inicio = max(longa for _, longa in SINAIS.values())  # primeiro dia com todas as médias
    trecho = precos.iloc[inicio - 1:]
    carteiras = {"Comprar e esperar": trecho / trecho.iloc[0] * (1 - TAXA)}
    operacoes = {"Comprar e esperar": 1}
    tempo_dentro = {"Comprar e esperar": 1.0}
    for nome, (curta, longa) in SINAIS.items():
        carteira, posicao = estrategia(precos, curta, longa)
        carteira = carteira.loc[trecho.index]
        carteiras[nome] = carteira / carteira.iloc[0]
        posicao = posicao.loc[trecho.index]
        operacoes[nome] = int(posicao.diff().abs().sum())
        tempo_dentro[nome] = posicao.mean()
    return pd.DataFrame(carteiras), operacoes, tempo_dentro


def por_metade(carteiras):
    """Retorno de cada carteira na primeira e na segunda metade do período."""
    meio = len(carteiras) // 2
    primeira = carteiras.iloc[meio] / carteiras.iloc[0] - 1
    segunda = carteiras.iloc[-1] / carteiras.iloc[meio] - 1
    return primeira, segunda, carteiras.index[meio]


# ---------------------------------------------------------------- relatório

def relatorio(precos, exemplo):
    linhas = []
    if exemplo:
        linhas += ["*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***", ""]
    hoje = precos.index[-1]
    queda = queda_do_topo(precos)
    linhas += [
        "GUIA DE RISCO E JEITOS DE COMPRAR ETH",
        f"Histórico: {inteiro(len(precos))} dias, de {precos.index[0]:%d/%m/%Y} a {hoje:%d/%m/%Y}"
        " (fechamento diário na Binance, em dólar)",
        f"Último fechamento: {moeda(precos.iloc[-1])}, {pct(-queda.iloc[-1])} abaixo do recorde"
        f" de {moeda(precos.max())} ({precos.idxmax():%d/%m/%Y})",
        "",
        "Não é previsão nem recomendação. Mostra o que aconteceu no passado.",
        "",
    ]

    # Pergunta 1
    hoje_queda = queda.iloc[-1]
    parecido = (queda - hoje_queda).abs() <= FAIXA_PARECIDO
    linhas += [
        "=" * 78,
        "1. SE EU COMPRASSE NUM DIA QUALQUER, COMO ESTARIA DEPOIS?",
        "=" * 78,
        "",
        "Para cada dia do histórico, quanto a compra rendeu depois do prazo.",
        "'Susto típico' = quanto a compra costuma ficar no vermelho em algum momento",
        "antes do prazo, mesmo quando termina no lucro (é a mediana desse pior momento).",
        "",
    ]
    tabela_1 = {}
    for titulo, filtro in (("Todos os dias", None), ("Dias parecidos com hoje", parecido)):
        if filtro is not None:
            linhas += [
                f"{titulo}: preço entre {pct(max(0, -hoje_queda - FAIXA_PARECIDO))} e"
                f" {pct(-hoje_queda + FAIXA_PARECIDO)} abaixo do recorde da época"
                f" (hoje: {pct(-hoje_queda)}).",
                f"Aconteceu em {parecido.sum()} dias, em {episodios(parecido)} trechos separados.",
            ]
        else:
            linhas.append(f"{titulo}:")
        linhas.append(f"  {'Prazo':<9}{'compras':>8}{'no prejuízo':>13}{'metade rendeu mais que':>24}"
                      f"{'pior':>9}{'melhor':>10}{'susto típico':>14}")
        for prazo, dias in PRAZOS.items():
            resultado = a_frente(precos, dias)
            if filtro is not None:
                resultado = resultado[filtro.loc[resultado.index]]
            if len(resultado) == 0:
                linhas.append(f"  {prazo:<9}{0:>8}   (nenhum dia parecido com prazo completo)")
                continue
            r = resumir(resultado)
            tabela_1[(titulo, prazo)] = r
            linhas.append(f"  {prazo:<9}{r['compras']:>8}{pct(r['no_prejuizo']):>13}"
                          f"{pct(r['mediana'], True):>24}{pct(r['pior'], True):>9}"
                          f"{pct(r['melhor'], True):>10}{pct(r['susto_mediano'], True):>14}")
        linhas.append("")

    # Pergunta 2
    ap = aporte(precos)
    ganhou = (ap["por_mes"] > ap["tudo_de_uma_vez"]).mean()
    diferenca = (ap["por_mes"] / ap["tudo_de_uma_vez"] - 1)
    linhas += [
        "=" * 78,
        "2. TUDO DE UMA VEZ OU UM POUCO POR MÊS?",
        "=" * 78,
        "",
        f"{moeda(VALOR)} de dois jeitos: tudo no primeiro dia, ou {moeda(VALOR / MESES)} por mês"
        f" durante {MESES} meses.",
        f"Os dois avaliados {MESES} meses depois do início. Repetido para {len(ap)} meses de início"
        f" ({ap.index[0]:%m/%Y} a {ap.index[-1]:%m/%Y}).",
        "",
        f"  Um pouco por mês terminou com mais dinheiro em {pct(ganhou)} das vezes.",
        f"  Valor final típico (mediana): tudo de uma vez {moeda(ap['tudo_de_uma_vez'].median())}"
        f" | por mês {moeda(ap['por_mes'].median())}",
        f"  Pior caso: tudo de uma vez {moeda(ap['tudo_de_uma_vez'].min())}"
        f" | por mês {moeda(ap['por_mes'].min())}",
        f"  Melhor caso: tudo de uma vez {moeda(ap['tudo_de_uma_vez'].max())}"
        f" | por mês {moeda(ap['por_mes'].max())}",
        f"  Terminou abaixo dos {moeda(VALOR)} investidos: tudo de uma vez"
        f" {pct((ap['tudo_de_uma_vez'] < VALOR).mean())} das vezes"
        f" | por mês {pct((ap['por_mes'] < VALOR).mean())}",
        f"  Quando o 'por mês' perdeu, ficou em média {pct(-diferenca[diferenca < 0].mean())}"
        f" atrás; quando ganhou, ficou {pct(diferenca[diferenca > 0].mean())} à frente."
        if (diferenca < 0).any() and (diferenca > 0).any() else "",
        "",
    ]

    # Pergunta 3
    carteiras, operacoes, tempo_dentro = comparar_sinais(precos)
    primeira, segunda, meio = por_metade(carteiras)
    linhas += [
        "=" * 78,
        "3. OS SINAIS DE MÉDIAS MÓVEIS TERIAM GANHADO DE COMPRAR E ESPERAR?",
        "=" * 78,
        "",
        "Sinal: fica comprado enquanto a média curta está acima da longa; vende quando cruza",
        f"para baixo. Taxa de {pct(TAXA)} a cada compra ou venda. Todos começam com {moeda(VALOR)}"
        f" em {carteiras.index[0]:%d/%m/%Y}.",
        "",
        f"  {'Jeito':<22}{'valor final':>18}{'pior queda':>12}{'operações':>11}"
        f"{'tempo comprado':>16}",
    ]
    for nome in carteiras.columns:
        c = carteiras[nome]
        linhas.append(f"  {nome:<22}{moeda(VALOR * c.iloc[-1]):>18}{pct(maior_queda(c)):>12}"
                      f"{operacoes[nome]:>11}{pct(tempo_dentro[nome]):>16}")
    linhas += [
        "",
        f"  Teste de sorte: cada metade separada (a divisão é em {meio:%d/%m/%Y}).",
        f"  {'Jeito':<22}{'1ª metade':>12}{'2ª metade':>12}",
    ]
    for nome in carteiras.columns:
        linhas.append(f"  {nome:<22}{pct(primeira[nome], True):>12}{pct(segunda[nome], True):>12}")
    linhas += [
        "  Se um sinal só ganhou numa das metades, o resultado provavelmente foi sorte.",
        "",
        "=" * 78,
        "CUIDADOS",
        "=" * 78,
        "- O passado não garante o futuro. São poucos ciclos de alta e queda.",
        "- As compras de dias vizinhos dão resultados quase iguais (as janelas se sobrepõem),",
        "  então 'X% das vezes' tem menos exemplos independentes do que parece.",
        "- Tudo em dólar (USDT). Variação do real e imposto ficam de fora.",
        "- O 'parecido com hoje' olha só a distância do recorde; o resto do mercado muda.",
    ]
    return "\n".join(linhas) + "\n", tabela_1, ap, carteiras


# ---------------------------------------------------------------- gráficos

def estilo(ax):
    ax.set_facecolor(COR_FUNDO)
    ax.grid(axis="y", color=COR_GRADE, lw=0.8)
    ax.set_axisbelow(True)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)


def configurar():
    plt.rcParams.update({
        "font.size": 10,
        "text.color": COR_TEXTO,
        "axes.labelcolor": COR_TEXTO_2,
        "xtick.color": COR_TEXTO_2,
        "ytick.color": COR_TEXTO_2,
        "axes.edgecolor": COR_GRADE,
    })


def titulo(fig, texto, exemplo):
    if exemplo:
        texto = "EXEMPLO (dado fictício)  " + texto
    fig.suptitle(texto, x=0.01, ha="left", fontsize=13, color=COR_TEXTO)
    fig.text(0.01, 0.005, "Fonte: Binance, fechamento diário do ETH/USDT. Passado, não previsão.",
             color=COR_TEXTO_2, fontsize=8)


def grafico_1(tabela_1, caminho, exemplo):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 5))
    fig.patch.set_facecolor(COR_FUNDO)
    prazos = list(PRAZOS)
    grupos = (("Todos os dias", COR_1), ("Dias parecidos com hoje", COR_2))
    largura = 0.38
    for n, (grupo, cor) in enumerate(grupos):
        deslocamento = (n - 0.5) * largura
        perdas, medianas, baixos, altos = [], [], [], []
        for prazo in prazos:
            r = tabela_1.get((grupo, prazo))
            perdas.append(r["no_prejuizo"] * 100 if r else float("nan"))
            medianas.append(r["mediana"] * 100 if r else float("nan"))
            baixos.append(r["p10"] * 100 if r else float("nan"))
            altos.append(r["p90"] * 100 if r else float("nan"))
        x = [i + deslocamento for i in range(len(prazos))]
        ax1.bar(x, perdas, width=largura * 0.9, color=cor, label=grupo)
        # Faixa dos 80% do meio (de 10% a 90%) e a mediana como ponto.
        ax2.vlines(x, baixos, altos, color=cor, lw=6, alpha=0.35)
        ax2.plot(x, medianas, "o", color=cor, ms=8, label=grupo)
    for ax in (ax1, ax2):
        ax.set_xticks(range(len(prazos)), prazos)
        estilo(ax)
    ax1.set_title("Em quantas compras você ficou no prejuízo", loc="left", fontsize=11)
    ax1.set_ylabel("% das compras")
    ax1.legend(frameon=False, loc="upper right")
    ax2.axhline(0, color=COR_TEXTO_2, lw=0.8)
    ax2.set_title("Quanto rendeu: ponto = metade das vezes;\nbarra = 8 de cada 10 compras",
                  loc="left", fontsize=11)
    ax2.set_ylabel("retorno (%)")
    titulo(fig, "1. Se eu comprasse num dia qualquer, como estaria depois?", exemplo)
    fig.tight_layout(rect=(0, 0.03, 1, 0.95))
    fig.savefig(caminho, dpi=130, facecolor=COR_FUNDO)
    plt.close(fig)


def grafico_2(ap, caminho, exemplo):
    fig, ax = plt.subplots(figsize=(11, 5))
    fig.patch.set_facecolor(COR_FUNDO)
    ax.plot(ap.index, ap["tudo_de_uma_vez"], color=COR_1, lw=2, label="Tudo de uma vez")
    ax.plot(ap.index, ap["por_mes"], color=COR_2, lw=2, label=f"Um pouco por mês ({MESES} meses)")
    ax.axhline(VALOR, color=COR_TEXTO_2, lw=0.8, ls="--")
    ax.annotate(f"investido: {moeda(VALOR)}", (ap.index[0], VALOR), textcoords="offset points",
                xytext=(0, 5), fontsize=8, color=COR_TEXTO_2)
    ax.set_ylabel(f"valor {MESES} meses depois (US$)")
    ax.yaxis.set_major_formatter(lambda v, _: inteiro(v))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%Y"))
    ax.set_xlabel("mês em que começou a comprar")
    ax.legend(frameon=False, loc="upper left")
    estilo(ax)
    titulo(fig, f"2. {moeda(VALOR)}: tudo de uma vez ou um pouco por mês?", exemplo)
    fig.tight_layout(rect=(0, 0.03, 1, 0.95))
    fig.savefig(caminho, dpi=130, facecolor=COR_FUNDO)
    plt.close(fig)


def grafico_3(carteiras, caminho, exemplo):
    fig, ax = plt.subplots(figsize=(11, 5))
    fig.patch.set_facecolor(COR_FUNDO)
    for nome, cor in zip(carteiras.columns, (COR_1, COR_2, COR_3)):
        valores = VALOR * carteiras[nome]
        ax.plot(carteiras.index, valores, color=cor, lw=2, label=nome)
        ax.annotate(moeda(valores.iloc[-1]), (carteiras.index[-1], valores.iloc[-1]),
                    textcoords="offset points", xytext=(6, 0), va="center", fontsize=9)
    # Escala que multiplica: a mesma distância vale "dobrou", seja de 100 para 200 ou de
    # 1.000 para 2.000. Sem ela, os primeiros anos ficariam achatados.
    ax.set_yscale("log")
    ax.yaxis.set_major_formatter(lambda v, _: inteiro(v))
    ax.yaxis.set_minor_formatter(lambda v, _: inteiro(v))
    ax.set_ylabel("valor da carteira (US$, escala que multiplica)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%m/%Y"))
    ax.legend(frameon=False, loc="upper left")
    estilo(ax)
    titulo(fig, f"3. Sinais de médias móveis contra comprar e esperar ({moeda(VALOR)})", exemplo)
    fig.tight_layout(rect=(0, 0.03, 0.93, 0.95))
    fig.savefig(caminho, dpi=130, facecolor=COR_FUNDO)
    plt.close(fig)


def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    prefixo = "exemplo_" if exemplo else ""

    tabela = pd.read_csv(entrada, parse_dates=["data"])
    precos = tabela.set_index("data")["fechamento"].astype(float)

    texto, tabela_1, ap, carteiras = relatorio(precos, exemplo)
    SAIDAS.mkdir(exist_ok=True)
    txt = SAIDAS / f"{prefixo}guia.txt"
    txt.write_text(texto, encoding="utf-8")
    configurar()
    pngs = [SAIDAS / f"{prefixo}guia_{n}.png" for n in
            ("1_comprar_qualquer_dia", "2_aporte", "3_sinais")]
    grafico_1(tabela_1, pngs[0], exemplo)
    grafico_2(ap, pngs[1], exemplo)
    grafico_3(carteiras, pngs[2], exemplo)

    print(texto)
    print("Gravado: " + ", ".join(str(p.relative_to(PASTA)) for p in [txt] + pngs))


if __name__ == "__main__":
    main()
