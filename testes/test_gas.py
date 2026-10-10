"""Testes das contas da etapa 3 (gás), com dado fixo e pequeno.

Roda com: python -m pytest testes   ou   python testes/test_gas.py
"""

import importlib.util
from pathlib import Path

SRC = Path(__file__).parent.parent / "src"

# O script começa com número (03_), e o Python não importa esse nome direto.
_spec = importlib.util.spec_from_file_location("gas", SRC / "03_gas.py")
gas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gas)


def test_para_linhas_tira_a_taxa_prevista_do_fim():
    # Resposta do eth_feeHistory para 2 blocos (16 e 17): 3 taxas, a última é a prevista.
    historico = {
        "oldestBlock": "0x10",
        "baseFeePerGas": ["0x3b9aca00", "0x77359400", "0x1"],  # 1 gwei, 2 gwei, prevista
        "gasUsedRatio": [0.5, 0.25],
    }
    assert gas.para_linhas(historico) == [(16, 1.0, 0.5), (17, 2.0, 0.25)]


def test_estimar_horas_distribui_por_igual():
    # 10 blocos em 120 s: 12 s por bloco.
    horas = gas.estimar_horas([100, 105, 110], 100, 1000, 110, 1120)
    assert horas == [1000, 1060, 1120]


def test_baixar_pega_todos_os_blocos_uma_vez_so():
    # Nó de mentira: o bloco 5000 é o último; a taxa de cada bloco é o próprio número em gwei.
    # Ele devolve só 1.000 blocos por chamada (menos que os 1.024 pedidos), para testar a
    # continuação de onde parou.
    chamadas = []

    def rpc(metodo, params):
        chamadas.append(metodo)
        if metodo == "eth_blockNumber":
            return hex(5000)
        if metodo == "eth_feeHistory":
            fim = int(params[1], 16)
            quantos = min(int(params[0], 16), 1000)
            ini = fim - quantos + 1
            return {
                "oldestBlock": hex(ini),
                "baseFeePerGas": [hex(b * 10**9) for b in range(ini, fim + 2)],
                "gasUsedRatio": [0.5] * quantos,
            }
        bloco = int(params[0], 16)
        return {"timestamp": hex(bloco * 12)}

    tabela = gas.baixar(rpc, 2500)
    assert tabela["bloco"].tolist() == list(range(2501, 5001))
    assert tabela["taxa_base_gwei"].tolist() == [float(b) for b in range(2501, 5001)]
    assert chamadas.count("eth_feeHistory") == 3  # 1.000 + 1.000 + 500
    # Hora do bloco 2501 = 2501 x 12 s depois de 01/01/1970.
    assert str(tabela["data_hora_utc_estimada"].iloc[0]) == "1970-01-01 08:20:12+00:00"


def test_tenta_o_proximo_no_quando_um_falha():
    tentados = []
    original = gas.chamar

    def chamar_de_mentira(url, metodo, params):
        tentados.append(url)
        if url == gas.NOS[0]:
            raise RuntimeError("HTTP 403")
        return "0x10"

    gas.chamar = chamar_de_mentira
    try:
        assert gas.rpc_do_no("eth_blockNumber", []) == "0x10"
    finally:
        gas.chamar = original
    assert tentados == gas.NOS[:2]


if __name__ == "__main__":
    for nome, funcao in list(globals().items()):
        if nome.startswith("test_"):
            funcao()
            print("ok", nome)
