"""Etapa 4: em qual hora do dia e dia da semana o gás fica mais barato?

Lê dados/gas.csv (etapa 3), passa a hora para Brasília e calcula a taxa base mediana por
hora do dia e por dia da semana. Grava saidas/gas_por_hora.png.

Usa a mediana (o valor do meio) e não a média: poucos momentos de rede congestionada
chegam a 90 vezes o normal e puxariam a média para cima.

Uso:
    python src/04_analise_gas.py                           (lê dados/gas.csv)
    python src/04_analise_gas.py dados/exemplo_gas.csv     (lê outro arquivo, para teste)
"""

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # só grava o arquivo; não abre janela (roda igual na nuvem e no Windows)
import matplotlib.pyplot as plt
import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "gas.csv"
SAIDAS = PASTA / "saidas"
# Brasília está 3 horas atrás do UTC o ano todo (o horário de verão acabou em 2019).
# Conta fixa, sem tabela de fusos, que no Windows exigiria uma biblioteca a mais.
FUSO_BRASILIA = pd.Timedelta(hours=-3)
DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]

# Cores (paleta de referência do guia de gráficos), as mesmas da etapa 2.
COR_TEXTO = "#0b0b0b"
COR_TEXTO_2 = "#52514e"
COR_GRADE = "#e4e3df"
COR_FUNDO = "#fcfcfb"
COR_BARRA = "#2a78d6"


def br(numero, casas=3):
    """Número com vírgula: 0.145 vira "0,145"."""
    return f"{numero:.{casas}f}".replace(".", ",")


def hora_brasilia(tabela):
    """Acrescenta a coluna hora_brasilia (sem fuso, já com as 3 horas a menos)."""
    tabela = tabela.copy()
    utc = pd.to_datetime(tabela["data_hora_utc_estimada"], utc=True)
    tabela["hora_brasilia"] = (utc + FUSO_BRASILIA).dt.tz_localize(None)
    return tabela


def por_hora(tabela):
    """Taxa base mediana de cada hora do dia (0 a 23, em Brasília)."""
    return tabela.groupby(tabela["hora_brasilia"].dt.hour)["taxa_base_gwei"].median()


def por_dia(tabela):
    """Taxa base mediana de cada dia da semana (seg a dom, em Brasília)."""
    medianas = tabela.groupby(tabela["hora_brasilia"].dt.dayofweek)["taxa_base_gwei"].median()
    return medianas.rename(index=dict(enumerate(DIAS)))


def barras(ax, serie, titulo):
    """Desenha as barras e escreve o valor da mais barata e da mais cara."""
    rotulos = [str(i) for i in serie.index]
    ax.bar(rotulos, serie.values, color=COR_BARRA, width=0.7)
    for posicao, (chave, valor) in enumerate(serie.items()):
        if chave in (serie.idxmin(), serie.idxmax()):
            ax.annotate(br(valor), (posicao, valor), textcoords="offset points", xytext=(0, 4),
                        ha="center", fontsize=9, color=COR_TEXTO)
    ax.set_title(titulo, loc="left", fontsize=11, color=COR_TEXTO)
    ax.set_ylabel("gwei (mediana)")
    ax.yaxis.set_major_formatter(lambda v, _: f"{v:g}".replace(".", ","))
    ax.set_facecolor(COR_FUNDO)
    ax.grid(axis="y", color=COR_GRADE, lw=0.8)
    ax.set_axisbelow(True)
    for lado in ("top", "right"):
        ax.spines[lado].set_visible(False)


def grafico(horas, dias, inicio, fim, caminho, exemplo):
    plt.rcParams.update({
        "font.size": 10,
        "axes.labelcolor": COR_TEXTO_2,
        "xtick.color": COR_TEXTO_2,
        "ytick.color": COR_TEXTO_2,
        "axes.edgecolor": COR_GRADE,
    })
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 8), gridspec_kw={"height_ratios": [1.2, 1]})
    fig.patch.set_facecolor(COR_FUNDO)
    barras(ax1, horas, "Por hora do dia (hora de Brasília)")
    ax1.set_xlabel("hora")
    barras(ax2, dias, "Por dia da semana")

    titulo = (f"Taxa base de gás do Ethereum, de {inicio:%d/%m/%Y %H:%M}"
              f" a {fim:%d/%m/%Y %H:%M} (Brasília)")
    if exemplo:
        titulo = "EXEMPLO (dado fictício)  " + titulo
    fig.suptitle(titulo, x=0.01, ha="left", fontsize=13, color=COR_TEXTO)
    fig.text(0.01, 0.005,
             "Fonte: nós públicos do Ethereum (eth_feeHistory). Hora de cada bloco ESTIMADA"
             " (distribuída entre o primeiro e o último bloco). Uma semana: cada dia aparece uma vez.",
             color=COR_TEXTO_2, fontsize=8)
    fig.tight_layout(rect=(0, 0.02, 1, 0.97))
    fig.savefig(caminho, dpi=130, facecolor=COR_FUNDO)
    plt.close(fig)


def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    tabela = hora_brasilia(pd.read_csv(entrada))
    horas, dias = por_hora(tabela), por_dia(tabela)
    inicio, fim = tabela["hora_brasilia"].iloc[0], tabela["hora_brasilia"].iloc[-1]

    SAIDAS.mkdir(exist_ok=True)
    png = SAIDAS / f"{'exemplo_' if exemplo else ''}gas_por_hora.png"
    grafico(horas, dias, inicio, fim, png, exemplo)

    if exemplo:
        print("*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***")
    blocos = f"{len(tabela):,}".replace(",", ".")
    print(f"{blocos} blocos, de {inicio:%d/%m/%Y %H:%M} a {fim:%d/%m/%Y %H:%M}"
          " (Brasília; hora de cada bloco estimada)")
    print(f"Mediana geral: {br(tabela['taxa_base_gwei'].median())} gwei")
    print(f"Hora mais barata: {horas.idxmin()}h ({br(horas.min())} gwei) |"
          f" mais cara: {horas.idxmax()}h ({br(horas.max())} gwei),"
          f" {br(horas.max() / horas.min(), 1)} vezes mais")
    print(f"Dia mais barato: {dias.idxmin()} ({br(dias.min())} gwei) |"
          f" mais caro: {dias.idxmax()} ({br(dias.max())} gwei),"
          f" {br(dias.max() / dias.min(), 1)} vezes mais")
    print(f"Gravado: {png.relative_to(PASTA)}")


if __name__ == "__main__":
    main()
