"""Testes da etapa 9 (fundamentos estatísticos e risco), com dado fixo.

Roda com: python -m pytest testes   ou   python testes/test_estatistica.py
"""

import importlib.util
from pathlib import Path

import numpy as np
import pandas as pd

SRC = Path(__file__).parent.parent / "src"

# O script começa com número (09_), e o Python não importa esse nome direto.
_spec = importlib.util.spec_from_file_location("estatistica", SRC / "09_estatistica.py")
estatistica = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(estatistica)


def variacoes(n, semente=1, agitacao=0.03):
    gerador = np.random.default_rng(semente)
    return pd.Series(gerador.normal(0, agitacao, n), index=pd.date_range("2017-01-01", periods=n))


def agitado_e_calmo(n=4000, semente=2):
    # Alterna 100 dias calmos (1%) e 100 agitados (5%): o tamanho do movimento tem memória.
    gerador = np.random.default_rng(semente)
    agitacao = np.where((np.arange(n) // 100) % 2 == 0, 0.01, 0.05)
    return pd.Series(gerador.normal(0, 1, n) * agitacao, index=pd.date_range("2017-01-01", periods=n))


def test_qui_quadrado_bate_com_a_tabela():
    # Os valores críticos de 5% das tabelas de qui-quadrado.
    for x, gl in ((3.841, 1), (5.991, 2), (18.307, 10)):
        assert abs(estatistica.qui2_p(x, gl) - 0.05) < 2e-4, (x, gl)
    assert estatistica.qui2_p(0, 1) == 1.0


def test_wilson_e_p_da_proporcao():
    de, ate = estatistica.wilson(0.5, 100)
    assert abs(de - 0.4038) < 1e-3 and abs(ate - 0.5962) < 1e-3
    assert abs(estatistica.p_proporcao(0.5, 100, 0.5) - 1.0) < 1e-12
    # 60 em 100 contra 50%: z = 2, p bilateral ≈ 0,0455.
    assert abs(estatistica.p_proporcao(0.6, 100, 0.5) - 0.0455) < 1e-3


def test_kupiec():
    assert estatistica.kupiec(50, 1000) > 0.99    # exatamente os 5% prometidos
    assert estatistica.kupiec(100, 1000) < 1e-6   # o dobro: o VaR está apertado demais
    assert estatistica.kupiec(0, 1000) < 1e-6     # nunca rompe: largo demais


def test_christoffersen_ve_rajada():
    espalhado = np.zeros(1000, dtype=bool)
    espalhado[::20] = True
    rajada = np.zeros(1000, dtype=bool)
    rajada[100:150] = True
    p_espalhado, seguidos = estatistica.christoffersen(espalhado)
    assert seguidos == 0 and p_espalhado > 0.01
    p_rajada, seguidos = estatistica.christoffersen(rajada)
    assert seguidos == 49 and p_rajada < 1e-6


def test_autocorrelacao():
    ruido = variacoes(4000)
    rho = estatistica.autocorrelacao(ruido)
    limite = 1.96 / np.sqrt(len(ruido))
    assert max(abs(x) for x in rho) < 2 * limite
    assert estatistica.ljung_box(rho, len(ruido)) > 0.01
    r = agitado_e_calmo()
    tamanho = estatistica.autocorrelacao(r.abs())
    assert tamanho[0] > 0.2 and min(tamanho) > limite
    assert estatistica.ljung_box(tamanho, len(r)) < 1e-6


def test_histograma_e_extremos():
    r = variacoes(3000, agitacao=0.06)
    m = estatistica.momentos(r)
    h = estatistica.histograma(r, m["media"], m["desvio"])
    assert len(h) == 32 and h[0]["de"] == -1.0 and h[-1]["ate"] == 1.0
    assert sum(x["dias"] for x in h) == len(r)
    assert abs(sum(x["normal"] for x in h) - len(r)) < 1e-6
    # No sino, a curtose em excesso é ~0 e o Jarque-Bera não rejeita.
    assert abs(m["curtose_excesso"]) < 0.3 and m["jarque_bera"]["p"] > 0.01
    e = estatistica.extremos(r, m["media"], m["desvio"])
    assert e[0]["reais"] == int((r.abs() > 0.05).sum())


def test_var_nao_espia_o_futuro():
    # O VaR de cada dia tem que ser o mesmo, tendo ou não os dias seguintes.
    r = agitado_e_calmo(1500)
    curto = estatistica.var_diario(r.iloc[:900])
    longo = estatistica.var_diario(r)
    assert curto["var_historico"].notna().sum() > 400 and curto["var_ewma"].notna().sum() > 600
    pd.testing.assert_frame_equal(curto, longo.iloc[:900])
    # E não usa o dia seguinte: mudar o dia 900 não muda o VaR calculado no fechamento do 899.
    mexido = r.copy()
    mexido.iloc[900] = -0.9
    assert estatistica.var_diario(mexido).iloc[899].equals(longo.iloc[899])


def test_var_rompe_perto_de_5_por_cento():
    # Sorteio sem agitação mudando: os dois jeitos rompem ~5% (a margem é ~4 erros padrão).
    r = variacoes(4000, semente=1)
    conferencia, ultimos = estatistica.conferir_var(r, estatistica.var_diario(r))
    for x in conferencia:
        assert 0.035 <= x["taxa"] <= 0.065, x
    assert len(ultimos) == 365


def test_cone_so_usa_o_passado():
    # Acrescentar dias no fim não muda os cones já montados (mesma semente, mesmos sorteios).
    precos = 1000 * np.exp(variacoes(1800, semente=3).cumsum())
    curto = estatistica.conferir_cone(precos.iloc[:1400], np.random.default_rng(1), simulacoes=200)
    longo = estatistica.conferir_cone(precos, np.random.default_rng(1), simulacoes=200)
    assert len(curto) >= 10 and len(longo) > len(curto)
    assert curto == longo[:len(curto)]
    # E nenhum cone usa o futuro: estragar o preço depois do primeiro começo não muda o cone dele.
    estragado = precos.copy()
    estragado.iloc[estatistica.CONE_PRIMEIRO + 1:] *= 3
    outro = estatistica.conferir_cone(estragado, np.random.default_rng(1), simulacoes=200)
    assert (outro[0]["p5"], outro[0]["p95"]) == (longo[0]["p5"], longo[0]["p95"])


def test_cone_de_hoje():
    precos = 1000 * np.exp(variacoes(900, semente=4).cumsum())
    c = estatistica.cone(precos, np.random.default_rng(1), simulacoes=500)
    assert c["pontos"][0]["p5"] == c["pontos"][0]["p95"] == precos.iloc[-1]
    assert [p["dia"] for p in c["pontos"]][-2:] == [364, 365]
    fim = c["pontos"][-1]
    assert fim["p5"] < fim["p25"] < fim["p50"] < fim["p75"] < fim["p95"]
    assert 0 <= c["chance_dobrar"] <= c["chance_acima_hoje"] <= 1


def test_dia_da_semana_escolhe_no_treino():
    r = variacoes(3000, semente=5)
    r[(r.index.dayofweek == 3) & (r.index <= "2021-12-31")] -= 0.05  # quinta ruim só no treino
    s = estatistica.dia_da_semana(r)
    assert s["pior_no_treino"] == "qui"
    assert abs(s["prova_diferenca"]) < 0.01 and s["prova_p"] > 0.01  # na prova, não se confirma
    assert sum(x["treino_n"] + x["prova_n"] for x in s["dias"]) == len(r)


def test_analisar_sai_pronto_para_json():
    import json
    precos = 1000 * np.exp(variacoes(1200, semente=6).cumsum())
    placar_2 = {"dias": 100, "acertos": 55, "faixa_1_dias": 100, "faixa_1_dentro": 0.8,
                "faixa_7_dias": 98, "faixa_7_dentro": 0.75}
    e = estatistica.analisar(precos, placar_2, {"dias": 50, "acertos": 26})
    texto = json.dumps(e, allow_nan=False)  # quebra se sobrar NaN ou número do numpy
    assert "NaN" not in texto
    assert [x["dias_efetivos"] for x in e["intervalos"]] == [100, 100, 14, 50]
    assert isinstance(e["var"]["ultimos_365"][0]["rompeu_ewma"], bool)


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
