"""Testes das etapas 5 (download da Binance) e 6 (guia), com dado fixo e pequeno.

Roda com: python -m pytest testes   ou   python testes/test_guia.py
"""

import importlib.util
from pathlib import Path

import pandas as pd

SRC = Path(__file__).parent.parent / "src"


def carregar(nome):
    # Os scripts começam com número (05_, 06_), e o Python não importa esse nome direto.
    spec = importlib.util.spec_from_file_location(nome, SRC / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


binance = carregar("05_historico_binance")
guia = carregar("06_guia")

DIA = 86_400_000


def precos_diarios(valores, inicio="2020-01-01"):
    return pd.Series(valores, index=pd.date_range(inicio, periods=len(valores)), dtype=float)


def test_baixar_pega_todos_os_dias_e_tira_o_dia_aberto():
    # Binance de mentira com 2.500 dias; o último ainda está aberto (fecha depois de "agora").
    todos = [[i * DIA, "1", "1", "1", f"{i}.5", "1", (i + 1) * DIA - 1, "1", 1, "1", "1", "0"]
             for i in range(2500)]
    pedidos = []

    def pedir(inicio_ms):
        pedidos.append(inicio_ms)
        return [d for d in todos if d[0] >= inicio_ms][:1000]

    tabela = binance.baixar(pedir, agora_ms=2499 * DIA + 1)
    assert pedidos == [0, 1000 * DIA, 2000 * DIA]  # 1.000 + 1.000 + 500
    assert len(tabela) == 2499
    assert str(tabela["data"].iloc[-1]) == "1976-11-03"  # 2.498 dias depois de 01/01/1970
    assert tabela["fechamento"].iloc[-1] == "2498.5"  # texto, do jeito que a Binance mandou


def test_a_frente_retorno_e_susto_no_caminho():
    # Compra a 100, cai para 50, sobe para 200: em 2 dias rendeu 100%, mas passou por -50%.
    p = precos_diarios([100, 50, 200, 150])
    r = guia.a_frente(p, 2)
    assert r["retorno"].tolist() == [1.0, 2.0]
    assert r["pior_no_caminho"].tolist() == [-0.5, 0.0]


def test_episodios_conta_trechos_seguidos():
    marcados = pd.Series([False, True, True, False, True, False, True, True])
    assert guia.episodios(marcados) == 3


def test_aporte_por_mes_compra_mais_barato_quando_o_preco_cai():
    # Seis meses a 100, seis meses a 50, e no 13º mês volta a 100. Sem taxa.
    # Tudo de uma vez: 10 cotas x 100 = 1.000. Por mês: 5 + 10 = 15 cotas x 100 = 1.500.
    meses = pd.date_range("2020-01-01", periods=13, freq="MS")
    valores = [100] * 6 + [50] * 6 + [100]
    p = pd.Series(valores, index=meses, dtype=float)
    ap = guia.aporte(p, valor=1000, meses=12, taxa=0)
    assert len(ap) == 1
    assert round(ap["tudo_de_uma_vez"].iloc[0], 6) == 1000
    assert round(ap["por_mes"].iloc[0], 6) == 1500


def test_estrategia_usa_o_sinal_so_no_dia_seguinte_e_paga_taxa():
    # Médias de 1 e 2 dias: o sinal liga quando o preço sobe. Preços 10, 11, 12, 6.
    # Sinal: dia 1 e 2 ligado. Posição (sinal de ontem): só nos dias 2 e 3.
    p = precos_diarios([10, 11, 12, 6])
    carteira, posicao = guia.estrategia(p, 1, 2, taxa=0.01)
    assert posicao.tolist() == [0, 0, 1, 1]
    # Dia 2: +1/11 menos 1% de taxa da compra; dia 3: -50%.
    esperado = (1 + 1 / 11 - 0.01) * 0.5
    assert abs(carteira.iloc[-1] - esperado) < 1e-12


def test_maior_queda():
    assert guia.maior_queda(pd.Series([1.0, 2.0, 1.0, 3.0, 2.4])) == -0.5


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
