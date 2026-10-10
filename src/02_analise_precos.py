"""Etapa 2: analisa o preço do ETH gravado pela etapa 1.

Calcula o retorno diário, a volatilidade de 30 dias, a maior queda a partir de um topo
(drawdown) e as médias móveis de 7 e 30 dias. Grava saidas/precos.png e
saidas/resumo_precos.txt.

Uso:
    python src/02_analise_precos.py                                (lê dados/precos_eth.csv)
    python src/02_analise_precos.py dados/exemplo_precos_eth.csv   (lê outro arquivo, para teste)
"""

import math
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # só grava o arquivo; não abre janela (roda igual na nuvem e no Windows)
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "precos_eth.csv"
SAIDAS = PASTA / "saidas"
JANELA_VOL = 30
# O ETH negocia todo dia, sem fim de semana nem feriado; por isso o ano tem 365 pregões.
DIAS_NO_ANO = 365

# Cores (paleta de referência do guia de gráficos): tinta neutra para o preço, azul e
# laranja para as médias, vermelho para a queda.
COR_TEXTO = "#0b0b0b"
COR_TEXTO_2 = "#52514e"
COR_GRADE = "#e4e3df"
COR_FUNDO = "#fcfcfb"
COR_PRECO = "#52514e"
COR_MM7 = "#2a78d6"
COR_MM30 = "#eb6834"
COR_QUEDA = "#e34948"
COR_VOL = "#6250d6"


def moeda(valor):
    """US$ no jeito brasileiro: 2480.81 vira "US$ 2.480,81"."""
    return "US$ " + f"{valor:,.2f}".translate(str.maketrans(",.", ".,"))


def pct(valor, sinal=False):
    """Porcentagem com vírgula: -0.0672 vira "-6,7%"."""
    return (f"{valor:+.1%}" if sinal else f"{valor:.1%}").replace(".", ",")


def um_por_dia(tabela):
    """Fica com um preço por dia.

    A CoinGecko manda um ponto à meia-noite UTC de cada dia (21h do dia anterior em
    Brasília) e, no fim, mais um ponto com o preço da hora da chamada. Esse último cai no
    mesmo dia do anterior e o substitui.
    """
    tabela = tabela.copy()
    tabela["data"] = pd.to_datetime(tabela["data_hora_utc"], utc=True).dt.tz_localize(None).dt.normalize()
    tabela = tabela.sort_values("data_hora_utc").drop_duplicates("data", keep="last")
    return tabela.set_index("data").drop(columns="data_hora_utc")


def calcular(diario):
    """Acrescenta as colunas de análise a uma tabela com a coluna preco_usd, um dia por linha."""
    d = diario.copy()
    d["retorno"] = d["preco_usd"].pct_change()
    # Desvio padrão do retorno diário em 30 dias, levado para a escala de um ano
    # (multiplica pela raiz de 365). É a medida usual de "quanto o preço chacoalha".
    d["vol_30d_anual"] = d["retorno"].rolling(JANELA_VOL).std() * math.sqrt(DIAS_NO_ANO)
    d["mm7"] = d["preco_usd"].rolling(7).mean()
    d["mm30"] = d["preco_usd"].rolling(30).mean()
    # Quanto o preço está abaixo do maior valor visto até aquele dia (0 = no topo).
    d["drawdown"] = d["preco_usd"] / d["preco_usd"].cummax() - 1
    return d


def maior_queda(precos):
    """Devolve (queda, data do topo, data do fundo) da maior queda a partir de um topo."""
    drawdown = precos / precos.cummax() - 1
    fundo = drawdown.idxmin()
    topo = precos.loc[:fundo].idxmax()
    return drawdown.min(), topo, fundo


def resumo(d, exemplo):
    inicio, fim = d.index[0], d.index[-1]
    queda, topo, fundo = maior_queda(d["preco_usd"])
    melhor, pior = d["retorno"].idxmax(), d["retorno"].idxmin()
    ultimo = d.iloc[-1]
    tendencia = "acima" if ultimo["mm7"] > ultimo["mm30"] else "abaixo"
    linhas = []
    if exemplo:
        linhas += ["*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***", ""]
    linhas += [
        "Resumo do preço do ETH (em dólar)",
        f"Período: {len(d)} dias, de {inicio:%d/%m/%Y} a {fim:%d/%m/%Y}",
        "",
        f"Preço no início: {moeda(d['preco_usd'].iloc[0])}",
        f"Preço no fim:    {moeda(ultimo['preco_usd'])}",
        f"Variação no período: {pct(ultimo['preco_usd'] / d['preco_usd'].iloc[0] - 1, sinal=True)}",
        f"Maior preço: {moeda(d['preco_usd'].max())} em {d['preco_usd'].idxmax():%d/%m/%Y}",
        f"Menor preço: {moeda(d['preco_usd'].min())} em {d['preco_usd'].idxmin():%d/%m/%Y}",
        "",
        f"Maior alta em um dia:  {pct(d.loc[melhor, 'retorno'], sinal=True)} em {melhor:%d/%m/%Y}",
        f"Maior baixa em um dia: {pct(d.loc[pior, 'retorno'], sinal=True)} em {pior:%d/%m/%Y}",
        f"Dias de alta: {(d['retorno'] > 0).sum()} | dias de baixa: {(d['retorno'] < 0).sum()}",
        "",
        f"Volatilidade de 30 dias (anualizada), hoje: {ultimo['vol_30d_anual']:.0%}",
        f"Volatilidade de 30 dias, média do período: {d['vol_30d_anual'].mean():.0%}",
        "",
        f"Maior queda a partir de um topo: {pct(queda)}",
        f"  do topo em {topo:%d/%m/%Y} ({moeda(d.loc[topo, 'preco_usd'])})"
        f" ao fundo em {fundo:%d/%m/%Y} ({moeda(d.loc[fundo, 'preco_usd'])})",
        f"Hoje o preço está {pct(-ultimo['drawdown'])} abaixo do maior valor do período",
        "",
        f"Média de 7 dias: {moeda(ultimo['mm7'])} | média de 30 dias: {moeda(ultimo['mm30'])}",
        f"A média curta está {tendencia} da longa (acima costuma indicar alta recente).",
        "",
        "Observações:",
        "- Um preço por dia: o da meia-noite UTC, que é 21h do dia anterior em Brasília.",
        "  No último dia, vale o preço da hora da consulta.",
        "- Por isso, o retorno marcado num dia mede o que aconteceu no dia anterior",
        f"  (a maior alta, marcada em {melhor:%d/%m}, aconteceu ao longo de"
        f" {melhor - pd.Timedelta(days=1):%d/%m}, no horário UTC).",
        "- Volatilidade anualizada = desvio padrão do retorno diário em 30 dias x raiz de 365.",
    ]
    return "\n".join(linhas) + "\n"


def grafico(d, caminho, exemplo):
    plt.rcParams.update({
        "font.size": 10,
        "text.color": COR_TEXTO,
        "axes.labelcolor": COR_TEXTO_2,
        "xtick.color": COR_TEXTO_2,
        "ytick.color": COR_TEXTO_2,
        "axes.edgecolor": COR_GRADE,
    })
    fig, (ax1, ax2, ax3) = plt.subplots(
        3, 1, figsize=(11, 9), sharex=True, gridspec_kw={"height_ratios": [3, 1.3, 1.3]}
    )
    fig.patch.set_facecolor(COR_FUNDO)

    ax1.plot(d.index, d["preco_usd"], color=COR_PRECO, lw=1.2, label="Preço diário")
    ax1.plot(d.index, d["mm7"], color=COR_MM7, lw=2, label="Média de 7 dias")
    ax1.plot(d.index, d["mm30"], color=COR_MM30, lw=2, label="Média de 30 dias")
    ax1.set_ylabel("US$")
    ax1.yaxis.set_major_formatter(lambda v, _: f"{v:,.0f}".replace(",", "."))
    ax1.legend(loc="upper left", frameon=False, ncol=3)

    ax2.fill_between(d.index, d["drawdown"] * 100, 0, color=COR_QUEDA, alpha=0.25, lw=0)
    ax2.plot(d.index, d["drawdown"] * 100, color=COR_QUEDA, lw=1.5)
    ax2.set_ylabel("Abaixo do topo (%)")

    ax3.plot(d.index, d["vol_30d_anual"] * 100, color=COR_VOL, lw=2)
    ax3.set_ylabel("Volatilidade 30 d\n(% ao ano)")

    ax3.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m/%y"))
    for ax in (ax1, ax2, ax3):
        ax.set_facecolor(COR_FUNDO)
        ax.grid(axis="y", color=COR_GRADE, lw=0.8)
        for lado in ("top", "right"):
            ax.spines[lado].set_visible(False)

    titulo = f"ETH em dólar: {len(d)} dias, de {d.index[0]:%d/%m/%Y} a {d.index[-1]:%d/%m/%Y}"
    if exemplo:
        titulo = "EXEMPLO (dado fictício)  " + titulo
    ax1.set_title(titulo, loc="left", fontsize=13, pad=12)
    fig.text(0.01, 0.005, "Fonte: CoinGecko. Um preço por dia: o da meia-noite UTC (21h do dia anterior em Brasília).",
             color=COR_TEXTO_2, fontsize=8)
    fig.tight_layout(rect=(0, 0.02, 1, 1))
    fig.savefig(caminho, dpi=130, facecolor=COR_FUNDO)
    plt.close(fig)


def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    prefixo = "exemplo_" if exemplo else ""

    diario = um_por_dia(pd.read_csv(entrada))
    d = calcular(diario)

    SAIDAS.mkdir(exist_ok=True)
    png = SAIDAS / f"{prefixo}precos.png"
    txt = SAIDAS / f"{prefixo}resumo_precos.txt"
    grafico(d, png, exemplo)
    texto = resumo(d, exemplo)
    txt.write_text(texto, encoding="utf-8")

    print(texto)
    print(f"Gravado: {png.relative_to(PASTA)} e {txt.relative_to(PASTA)}")


if __name__ == "__main__":
    main()
