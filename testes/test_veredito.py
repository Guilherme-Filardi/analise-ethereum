"""Testes da etapa 7 (veredito diário), com dado fixo.

Roda com: python -m pytest testes   ou   python testes/test_veredito.py
"""

import importlib.util
import math
import random
import tempfile
from pathlib import Path

import pandas as pd

SRC = Path(__file__).parent.parent / "src"

# O script começa com número (07_), e o Python não importa esse nome direto.
_spec = importlib.util.spec_from_file_location("veredito", SRC / "07_veredito.py")
veredito = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(veredito)


def precos_inventados(dias=400, semente=1):
    gerador = random.Random(semente)
    valor, valores = 1000.0, []
    for _ in range(dias):
        valor *= math.exp(gerador.gauss(0, 0.03))
        valores.append(valor)
    return pd.Series(valores, index=pd.date_range("2020-01-01", periods=dias))


def test_caracteristicas_de_um_dia():
    # 30 dias subindo de 1 em 1 (100 a 129) e depois cai para 90.
    valores = [float(v) for v in range(100, 130)] + [90.0]
    d = veredito.caracteristicas(pd.Series(valores, index=pd.date_range("2020-01-01", periods=31)))
    ultimo = d.iloc[-1]
    assert ultimo["tendencia_alta"]         # média de 7 (121,3) ainda acima da de 30 (114,2)
    assert ultimo["faixa_queda"] == 2       # 90 está 30,2% abaixo do recorde 129: faixa 30-50%
    assert not ultimo["semana_subiu"]       # 90 < 123 (7 dias antes)
    assert pd.isna(ultimo["amanha_subiu"])  # o dia seguinte ainda não existe
    assert not d["amanha_subiu"].iloc[0]    # o dia do 129 foi seguido pelo 90: caiu


def test_veredito_nao_espia_o_futuro():
    # O veredito de cada dia tem que ser o mesmo, tendo ou não os 100 dias seguintes.
    p = precos_inventados(400)
    curto = veredito.vereditos(veredito.caracteristicas(p.iloc[:300]))
    longo = veredito.vereditos(veredito.caracteristicas(p))
    colunas = ["dias_parecidos", "chance_subir", "veredito"]
    pd.testing.assert_frame_equal(curto[colunas], longo.loc[curto.index, colunas])


def test_acertou_e_placar():
    assert veredito.acertou("momento bom", True) is True
    assert veredito.acertou("momento ruim", True) is False
    assert veredito.acertou("sem vantagem", True) is None
    p = veredito.placar(["momento bom", "momento ruim", "sem vantagem", "momento bom"],
                        [True, True, False, False])
    # Conta só 3 dias (o "sem vantagem" fica de fora); acertou 1. Dizer "sobe" acertaria 2.
    assert p == {"dias": 3, "acertos": 1, "taxa": 1 / 3, "sempre_sobe": 2 / 3}


def test_diario_confere_ontem_e_anota_hoje_uma_vez_so():
    p = precos_inventados(200)
    with tempfile.TemporaryDirectory() as pasta:
        caminho = Path(pasta) / "diario.csv"
        # Dia 1: dado até o dia 150. Anota o veredito do dia 150.
        d1 = veredito.vereditos(veredito.caracteristicas(p.iloc[:150]))
        diario = veredito.atualizar_diario(caminho, d1, "agora")
        assert len(diario) == 1 and diario["resultado"].iloc[0] == ""
        # Dia 2: chegou o dia 151. Confere o 150 e anota o 151.
        d2 = veredito.vereditos(veredito.caracteristicas(p.iloc[:151]))
        diario = veredito.atualizar_diario(caminho, d2, "agora")
        assert len(diario) == 2
        subiu = p.iloc[150] > p.iloc[149]
        assert diario["resultado"].iloc[0] == ("subiu" if subiu else "caiu")
        assert diario["resultado"].iloc[1] == ""
        # Rodar de novo no mesmo dia não duplica nada.
        diario = veredito.atualizar_diario(caminho, d2, "agora")
        assert len(diario) == 2


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
