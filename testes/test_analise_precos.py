"""Testes das contas das etapas 1 e 2, com dado fixo e pequeno (conta feita à mão).

Roda com: python -m pytest testes   ou   python testes/test_analise_precos.py
"""

import importlib.util
import math
from pathlib import Path

import pandas as pd

SRC = Path(__file__).parent.parent / "src"


def carregar(nome):
    # Os scripts começam com número (01_, 02_), e o Python não importa esse nome direto.
    spec = importlib.util.spec_from_file_location(nome, SRC / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


precos = carregar("01_precos")
analise = carregar("02_analise_precos")

DIA = 86_400_000  # um dia em milissegundos


def test_para_tabela_junta_pela_hora():
    # O volume chega com um ponto a menos: a linha fica, com o volume vazio.
    bruto = {
        "prices": [[0, 10.0], [DIA, 11.0]],
        "market_caps": [[0, 100.0], [DIA, 110.0]],
        "total_volumes": [[0, 5.0]],
    }
    t = precos.para_tabela(bruto)
    assert list(t.columns) == ["data_hora_utc", "preco_usd", "valor_mercado_usd", "volume_usd"]
    assert len(t) == 2
    assert str(t["data_hora_utc"].iloc[1]) == "1970-01-02 00:00:00+00:00"
    assert t["valor_mercado_usd"].iloc[1] == 110.0
    assert math.isnan(t["volume_usd"].iloc[1])


def test_um_por_dia_fica_com_o_ultimo_ponto_do_dia():
    tabela = pd.DataFrame({
        "data_hora_utc": ["2026-10-09 00:00:00+00:00", "2026-10-10 00:00:00+00:00",
                          "2026-10-10 01:45:00+00:00"],
        "preco_usd": [100.0, 110.0, 115.0],
    })
    d = analise.um_por_dia(tabela)
    assert len(d) == 2
    assert d["preco_usd"].tolist() == [100.0, 115.0]
    assert d.index[-1] == pd.Timestamp("2026-10-10")


def test_retorno_e_drawdown():
    # Sobe para 120, cai para 90 (25% abaixo do topo), volta a 108.
    datas = pd.date_range("2026-01-01", periods=4)
    d = analise.calcular(pd.DataFrame({"preco_usd": [100.0, 120.0, 90.0, 108.0]}, index=datas))
    assert math.isnan(d["retorno"].iloc[0])
    assert d["retorno"].iloc[1:].round(6).tolist() == [0.2, -0.25, 0.2]
    assert d["drawdown"].round(6).tolist() == [0.0, 0.0, -0.25, -0.1]

    queda, topo, fundo = analise.maior_queda(d["preco_usd"])
    assert round(queda, 6) == -0.25
    assert topo == pd.Timestamp("2026-01-02")
    assert fundo == pd.Timestamp("2026-01-03")


def test_medias_moveis():
    datas = pd.date_range("2026-01-01", periods=30)
    d = analise.calcular(pd.DataFrame({"preco_usd": [float(i) for i in range(1, 31)]}, index=datas))
    # Média de 7 dias no 7º dia: (1+...+7)/7 = 4; antes disso não existe.
    assert math.isnan(d["mm7"].iloc[5])
    assert d["mm7"].iloc[6] == 4.0
    # Média de 30 dias no 30º dia: (1+...+30)/30 = 15,5.
    assert d["mm30"].iloc[-1] == 15.5
    assert math.isnan(d["mm30"].iloc[-2])


def test_volatilidade_30_dias():
    # Retornos alternando +1% e -1%: desvio padrão conhecido, levado para o ano.
    retornos = [0.01, -0.01] * 15
    valores = [100.0]
    for r in retornos:
        valores.append(valores[-1] * (1 + r))
    datas = pd.date_range("2026-01-01", periods=len(valores))
    d = analise.calcular(pd.DataFrame({"preco_usd": valores}, index=datas))
    esperado = pd.Series(retornos).std() * math.sqrt(365)
    assert math.isnan(d["vol_30d_anual"].iloc[-2])  # só 29 retornos até ali
    assert abs(d["vol_30d_anual"].iloc[-1] - esperado) < 1e-12


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
