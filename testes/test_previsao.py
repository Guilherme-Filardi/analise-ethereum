"""Testes da etapa 8 (previsão versão 2), com dado fixo.

Roda com: python -m pytest testes   ou   python testes/test_previsao.py
"""

import contextlib
import importlib.util
import io
import math
import random
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

SRC = Path(__file__).parent.parent / "src"

# O script começa com número (08_), e o Python não importa esse nome direto.
_spec = importlib.util.spec_from_file_location("previsao", SRC / "08_previsao.py")
previsao = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(previsao)

COLUNAS_PREVISAO = ["chance_subir", "faixa1_min", "faixa1_max", "faixa7_min", "faixa7_max"]


def velas_inventadas(dias=900, semente=1, agitacao=0.03):
    """Passeio aleatório com abertura, máxima, mínima, fechamento e volume, como o da Binance."""
    gerador = random.Random(semente)
    valor, linhas = 1000.0, []
    for _ in range(dias):
        abertura = valor
        valor *= math.exp(gerador.gauss(0, agitacao))
        linhas.append({
            "abertura": abertura, "fechamento": valor,
            "maxima": max(abertura, valor) * (1 + abs(gerador.gauss(0, 0.01))),
            "minima": min(abertura, valor) * (1 - abs(gerador.gauss(0, 0.01))),
            "volume_usdt": 1e9 * math.exp(gerador.gauss(0, 0.3)),
        })
    return pd.DataFrame(linhas, index=pd.date_range("2020-01-01", periods=dias))


def test_nao_espia_o_futuro():
    # A previsão de cada dia tem que ser a mesma, tendo ou não os dias seguintes.
    t = velas_inventadas()
    curto, _ = previsao.previsoes(t.iloc[:700])
    longo, _ = previsao.previsoes(t)
    assert curto["chance_subir"].notna().sum() > 50  # a série é longa o bastante para ter chance
    pd.testing.assert_frame_equal(curto[COLUNAS_PREVISAO], longo.loc[curto.index, COLUNAS_PREVISAO])
    # Um corte só não pega um vazamento dentro do bloco de 30 dias da regressão (ele aconteceria
    # dos dois lados do corte). Cortando dia a dia ao longo de um bloco inteiro, o último dia de
    # cada corte tem que bater com o mesmo dia da série inteira.
    for n in range(671, 671 + previsao.PASSO + 1):
        ultimo = previsao.previsoes(t.iloc[:n])[0].iloc[-1]
        esperado = longo.iloc[n - 1]
        for coluna in COLUNAS_PREVISAO:
            assert ultimo[coluna] == esperado[coluna] or (pd.isna(ultimo[coluna]) and pd.isna(esperado[coluna])), (n, coluna)


def test_faixa_cobre_80_por_cento():
    # Num passeio aleatório comprido, o preço do dia seguinte cai dentro da faixa ~8 de cada 10 vezes.
    p = velas_inventadas(3000, semente=3)["fechamento"]
    for dias in (1, 7):
        f = previsao.faixa(p, dias)
        depois = p.shift(-dias)
        valido = f["min"].notna() & depois.notna()
        dentro = depois[valido].between(f["min"][valido], f["max"][valido]).mean()
        assert 0.74 <= dentro <= 0.86, (dias, dentro)


def test_ajustar_acha_o_sinal_e_nao_freia_a_constante():
    gerador = np.random.default_rng(5)
    X = gerador.normal(size=(5000, 2))
    chance = 1 / (1 + np.exp(-(0.5 + 1.0 * X[:, 0] - 1.0 * X[:, 1])))
    y = (gerador.random(5000) < chance).astype(float)
    w = previsao.ajustar(X, y, l2=1.0)
    assert w[0] > 0 and w[1] > 0.5 and w[2] < -0.5
    # Freio enorme: os pesos vão a zero, mas a constante fica na proporção de "subiu" (não é freada).
    w = previsao.ajustar(X, y, l2=1e9)
    assert abs(w[1]) < 1e-3 and abs(w[2]) < 1e-3
    assert abs(w[0] - math.log(y.mean() / (1 - y.mean()))) < 1e-6


def test_forca():
    assert previsao.forca(0.55) == "forte" and previsao.forca(0.45) == "forte"
    assert previsao.forca(0.53) == "média" and previsao.forca(0.47) == "média"
    assert previsao.forca(0.51) == "fraca" and previsao.forca(0.5) == "fraca"


def test_placar():
    nada = np.nan
    d = pd.DataFrame({
        "acertou": [True, False, True, nada, nada],
        "subiu": [True, True, False, nada, nada],
        "dentro_1": [True, True, False, True, nada],
        "dentro_7": [True, nada, nada, nada, nada],
    }, dtype=object)
    r = previsao.placar(d)
    assert r["dias"] == 3 and r["acertos"] == 2
    assert abs(r["taxa"] - 2 / 3) < 1e-12 and abs(r["sempre_sobe"] - 2 / 3) < 1e-12
    assert r["faixa_1_dias"] == 4 and r["faixa_1_dentro"] == 0.75
    assert r["faixa_7_dias"] == 1 and r["faixa_7_dentro"] == 1.0
    assert previsao.placar(d.iloc[3:].assign(dentro_1=nada)) is None


def test_diario_de_ponta_a_ponta():
    t = velas_inventadas()
    p, longo = t["fechamento"], previsao.previsoes(t)[0]
    with tempfile.TemporaryDirectory() as pasta:
        caminho = Path(pasta) / "diario.csv"
        # Dia 1: anota a previsão do dia 800. Rodar de novo no mesmo dia não duplica.
        d = previsao.previsoes(t.iloc[:800])[0]
        previsao.atualizar_diario(caminho, d, "agora")
        diario = previsao.atualizar_diario(caminho, d, "agora")
        assert len(diario) == 1 and diario["preco_1"].iloc[0] == ""
        assert diario["dia"].iloc[0] == f"{t.index[799]:%Y-%m-%d}"
        # Dia 2: chegou o dia 801. Confere o dia seguinte do 800 e anota o 801.
        diario = previsao.atualizar_diario(caminho, previsao.previsoes(t.iloc[:801])[0], "agora")
        assert len(diario) == 2
        primeiro, dia = diario.iloc[0], t.index[799]
        assert primeiro["preco_1"] == f"{p.iloc[800]:.2f}"
        assert primeiro["subiu"] == previsao.sim_nao(longo.loc[dia, "subiu"])
        assert primeiro["acertou"] == previsao.sim_nao(longo.loc[dia, "acertou"])
        assert primeiro["dentro_1"] == previsao.sim_nao(longo.loc[dia, "dentro_1"])
        assert primeiro["preco_7"] == "" and diario["preco_1"].iloc[1] == ""
        # Uma semana depois (os dias no meio se perderam, e ficam de fora): confere os 7 dias.
        diario = previsao.atualizar_diario(caminho, previsao.previsoes(t.iloc[:807])[0], "agora")
        assert len(diario) == 3
        primeiro = diario.iloc[0]
        assert primeiro["preco_7"] == f"{p.iloc[806]:.2f}"
        assert primeiro["dentro_7"] == previsao.sim_nao(longo.loc[dia, "dentro_7"])
        assert diario["preco_1"].iloc[1] == f"{p.iloc[801]:.2f}"  # o dia 801 também foi conferido
        # O histórico voltou no tempo (download incompleto, arquivo velho): o dia 790 já tem
        # resultado conhecido e não pode entrar no diário ao vivo.
        diario = previsao.atualizar_diario(caminho, previsao.previsoes(t.iloc[:790])[0], "agora")
        assert len(diario) == 3 and f"{t.index[789]:%Y-%m-%d}" not in set(diario["dia"])


def test_placar_ao_vivo_so_da_versao_atual():
    diario = pd.DataFrame({
        "versao_regra": [previsao.VERSAO, "outra", previsao.VERSAO],
        "acertou": ["sim", "não", "não"], "dentro_1": ["sim", "não", "sim"], "dentro_7": ["", "", ""],
    })
    p = previsao.placar_do_diario(diario)
    assert p["dias"] == 2 and p["taxa"] == 0.5 and p["faixa_1_dentro"] == 1.0 and p["faixa_7_dias"] == 0


def rodar_main(t):
    """Roda o main() com o dado `t` gravado num CSV de teste, e devolve o que ele imprimiu e gravou."""
    with tempfile.TemporaryDirectory() as pasta:
        entrada = Path(pasta) / "teste.csv"
        t.rename_axis("data").reset_index().to_csv(entrada, index=False)
        saidas, argv = previsao.SAIDAS, sys.argv
        previsao.SAIDAS, sys.argv = Path(pasta) / "saidas", ["08_previsao.py", str(entrada)]
        texto = io.StringIO()
        try:
            with contextlib.redirect_stdout(texto):
                previsao.main()
        finally:
            previsao.SAIDAS, sys.argv = saidas, argv
        gravados = sorted(x.name for x in (Path(pasta) / "saidas").glob("*"))
    return texto.getvalue(), gravados


def test_dado_curto_ou_dia_sem_sinal_sai_sem_gravar():
    # Curto demais: avisa e não grava nada (antes quebrava no meio do texto).
    texto, gravados = rodar_main(velas_inventadas(300))
    assert "curto demais" in texto and gravados == []
    # Último dia com máxima igual à mínima: o sinal "fechou perto da máxima" não existe.
    t = velas_inventadas(700)
    t.iloc[-1, t.columns.get_loc("maxima")] = t["minima"].iloc[-1]
    texto, gravados = rodar_main(t)
    assert "faltou o sinal" in texto and gravados == []
    # A primeira chance cai no último dia: grava, e o teste diz que ainda não há palpite conferido
    # (antes quebrava, porque a taxa do teste era None).
    t = velas_inventadas(700)
    primeira = t.index.get_loc(previsao.previsoes(t)[0]["chance_subir"].first_valid_index())
    texto, gravados = rodar_main(t.iloc[:primeira + 1])
    assert "ainda nenhum dia conferido" in texto
    assert gravados == ["diario_previsao.csv", "previsao_hoje.txt"]


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
