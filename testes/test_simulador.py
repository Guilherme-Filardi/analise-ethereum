"""Testes das contas do simulador do site (api/simulador.py), com dado fixo.

Roda com: python -m pytest testes   ou   python testes/test_simulador.py
"""

import importlib.util
import math
import random
from pathlib import Path

import pandas as pd

_spec = importlib.util.spec_from_file_location(
    "simulador", Path(__file__).parent.parent / "api" / "simulador.py")
simulador = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(simulador)


def precos_diarios(valores):
    return pd.Series(valores, index=pd.date_range("2020-01-01", periods=len(valores)), dtype=float)


def test_comprar_e_vender_sem_taxa():
    # Compra a 100, passa por 50, vende a 200: US$ 1.000 viram 2.000, com susto de -50%.
    p = precos_diarios([100, 50, 200])
    r = simulador.comprar_e_vender(p, 1000, "2020-01-01", "2020-01-03", taxa=0)
    assert r["valor_final"] == 2000
    assert r["retorno"] == 1.0
    assert str(r["pior_dia"].date()) == "2020-01-02"
    assert r["pior_retorno"] == -0.5


def test_comprar_e_vender_paga_taxa_nas_duas_pontas():
    p = precos_diarios([100, 100])
    r = simulador.comprar_e_vender(p, 1000, "2020-01-01", "2020-01-02", taxa=0.01)
    assert abs(r["valor_final"] - 1000 * 0.99 * 0.99) < 1e-9


def test_comprar_e_vender_recusa_datas_erradas():
    p = precos_diarios([100, 110, 120])
    for compra, venda in (("2020-01-03", "2020-01-01"), ("2019-12-31", "2020-01-02")):
        try:
            simulador.comprar_e_vender(p, 1000, compra, venda)
        except ValueError:
            continue
        raise AssertionError(f"deveria recusar {compra} a {venda}")


def test_posicoes_seguem_o_veredito_de_ontem():
    v = pd.Series(["momento bom", "sem vantagem", "momento ruim", "sem vantagem", "momento bom"])
    # Começa fora; compra no dia seguinte ao "bom"; o "sem vantagem" mantém; sai depois do "ruim".
    assert simulador.posicoes_dos_vereditos(v).tolist() == [0, 1, 1, 0, 0]


def test_seguir_vereditos_nao_espia_o_futuro():
    # A carteira até um dia tem que ser a mesma, tendo ou não os dias seguintes.
    gerador = random.Random(2)
    valor, valores = 1000.0, []
    for _ in range(500):
        valor *= math.exp(gerador.gauss(0, 0.03))
        valores.append(valor)
    p = precos_diarios(valores)
    curto = simulador.seguir_vereditos(p.iloc[:400], 1000, "2020-03-01")["seguindo"]
    longo = simulador.seguir_vereditos(p, 1000, "2020-03-01")["seguindo"]
    pd.testing.assert_series_equal(curto, longo.loc[curto.index])


def test_resumo_do_periodo():
    # 10 dias de 100 a 109, com um pico de 150 no dia 5. Período de 7 dias: do dia 3 ao 10.
    valores = [100.0 + i for i in range(10)]
    valores[4] = 150.0
    r = simulador.resumo_periodo(precos_diarios(valores), "7d")
    assert str(r["inicio"].date()) == "2020-01-03"
    assert r["preco_inicio"] == 102 and r["preco_fim"] == 109
    assert abs(r["variacao"] - (109 / 102 - 1)) < 1e-12
    assert r["maior"] == 150 and str(r["maior_dia"].date()) == "2020-01-05"
    assert r["menor"] == 102
    assert len(simulador.resumo_periodo(precos_diarios(valores), "tudo")["serie"]) == 10


def dias_ohlc(fechamentos, inicio="2020-01-01"):
    f = [float(x) for x in fechamentos]
    return pd.DataFrame({"abertura": f, "maxima": f, "minima": f, "fechamento": f},
                        index=pd.date_range(inicio, periods=len(f)))


def test_velas_por_dia():
    # Fechamentos 100, 110, 99, 99 e 108,9: +10%, -10%, 0% e +10%. O período de 3 dias
    # são os dias 3, 4 e 5, e mesmo assim a variação do dia 3 usa o fechamento do dia 2.
    dias = dias_ohlc([100, 110, 99, 99, 108.9])
    simulador.PERIODOS["3d"] = 3
    try:
        r = simulador.velas(dias, "3d")
    finally:
        del simulador.PERIODOS["3d"]
    assert [round(x, 9) for x in r["velas"]["variacao"]] == [-0.1, 0.0, 0.1]
    assert r["subiu"] == 1 and r["caiu"] == 1  # o dia parado não conta em nenhum
    assert str(r["maior_queda_dia"].date()) == "2020-01-03"
    t = simulador.velas(dias, "tudo")
    assert len(t["velas"]) == 4  # o primeiro dia da história não tem anterior
    assert abs(t["mexida_tipica"] - 0.1) < 1e-9


def test_velas_por_semana_e_mes():
    # 06/01/2020 é segunda. 14 dias: a semana 1 (06 a 12) e a 2 (13 a 19), mais o domingo 05/01
    # antes, que é uma semana de um dia só e não tem anterior (fica de fora).
    valores = [100] + [100 + i for i in range(1, 8)] + [200 + i for i in range(7)]
    dias = dias_ohlc(valores, "2020-01-05")
    dias.loc["2020-01-08", "maxima"] = 999
    r = simulador.velas(dias, "tudo", "semana")
    v = r["velas"]
    assert [str(d.date()) for d in v.index] == ["2020-01-06", "2020-01-13"]
    assert v["abertura"].iloc[0] == 101 and v["fechamento"].iloc[0] == 107 and v["maxima"].iloc[0] == 999
    assert abs(v["variacao"].iloc[0] - (107 / 100 - 1)) < 1e-12  # contra o domingo anterior
    assert abs(v["variacao"].iloc[1] - (206 / 107 - 1)) < 1e-12
    assert not v["aberta"].any()
    # Por mês, de 31/12/2019 a 09/02/2020: dezembro (um dia, sem anterior) fica de fora,
    # janeiro está completo e fevereiro ainda está aberto.
    m = simulador.velas(dias_ohlc(range(100, 141), "2019-12-31"), "tudo", "mes")["velas"]
    assert [str(d.date()) for d in m.index] == ["2020-01-01", "2020-02-01"]
    assert m["aberta"].tolist() == [False, True]
    assert abs(m["variacao"].iloc[0] - (131 / 100 - 1)) < 1e-12


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
