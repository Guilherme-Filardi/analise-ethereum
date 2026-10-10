"""Testes das contas da etapa 4 (gás por hora e dia da semana), com dado fixo e pequeno.

Roda com: python -m pytest testes   ou   python testes/test_analise_gas.py
"""

import importlib.util
from pathlib import Path

import pandas as pd

SRC = Path(__file__).parent.parent / "src"

# O script começa com número (04_), e o Python não importa esse nome direto.
_spec = importlib.util.spec_from_file_location("analise_gas", SRC / "04_analise_gas.py")
analise = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(analise)


def tabela(linhas):
    return analise.hora_brasilia(
        pd.DataFrame(linhas, columns=["data_hora_utc_estimada", "taxa_base_gwei"])
    )


def test_hora_brasilia_volta_tres_horas_e_pode_mudar_o_dia():
    # 02h de sábado em UTC é 23h de sexta em Brasília.
    t = tabela([["2026-10-10 02:00:00+00:00", 1.0]])
    assert t["hora_brasilia"].iloc[0] == pd.Timestamp("2026-10-09 23:00:00")
    assert analise.por_dia(t).index.tolist() == ["sex"]


def test_por_hora_usa_a_mediana_e_nao_a_media():
    # Às 10h de Brasília (13h UTC): 1, 2 e um pico de 90. Mediana 2; a média daria 31.
    t = tabela([
        ["2026-10-05 13:00:00+00:00", 1.0],
        ["2026-10-05 13:20:00+00:00", 2.0],
        ["2026-10-05 13:40:00+00:00", 90.0],
        ["2026-10-05 14:00:00+00:00", 5.0],  # 11h
    ])
    horas = analise.por_hora(t)
    assert horas.to_dict() == {10: 2.0, 11: 5.0}


def test_por_dia_nomeia_os_dias_em_portugues():
    # 05/10/2026 é segunda; 11/10/2026 é domingo (meio-dia em Brasília = 15h UTC).
    t = tabela([
        ["2026-10-05 15:00:00+00:00", 0.3],
        ["2026-10-11 15:00:00+00:00", 0.1],
    ])
    assert analise.por_dia(t).to_dict() == {"seg": 0.3, "dom": 0.1}


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
