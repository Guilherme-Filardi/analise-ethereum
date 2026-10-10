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


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
