"""Etapa 3: baixa de um nó público do Ethereum a taxa base de gás dos últimos ~7 dias de blocos.

Grava dados/gas.csv com um bloco por linha: número, hora (estimada), taxa base em gwei e
quanto do bloco foi ocupado.

A hora é ESTIMADA. O eth_feeHistory não traz a hora de cada bloco, e baixar os ~50 mil
blocos um a um seria lento demais. Então o script pega a hora real do primeiro e do último
bloco e distribui os do meio por igual entre eles (sai perto de um bloco a cada 12 s).

Uso:
    python src/03_gas.py                                (baixa dos nós públicos)
    python src/03_gas.py dados/exemplo_gas_rpc.json     (repete respostas gravadas, para teste)
"""

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

# Nós públicos e gratuitos, sem chave. Testados em 10/10/2026: os três devolveram os mesmos
# números para blocos de 7 dias atrás. Se um falhar, o script tenta o seguinte.
# (O ethereum-rpc.publicnode.com saiu: só entrega ~31 horas sem chave pessoal.)
NOS = [
    "https://eth.drpc.org",
    "https://eth.merkle.io",
    "https://1rpc.io/eth",
]
# 7 dias x 7.200 blocos por dia (um bloco a cada 12 s).
BLOCOS = 7 * 7_200
# O eth_feeHistory devolve no máximo 1.024 blocos por chamada.
POR_CHAMADA = 1024
# Pausa entre chamadas, para não ser barrado pelo limite do nó público.
PAUSA = 0.2
PASTA = Path(__file__).parent.parent
SAIDA = PASTA / "dados" / "gas.csv"


def br(numero, casas=0):
    """Número no jeito brasileiro: 50400 vira "50.400" e 0.125 vira "0,125"."""
    return f"{numero:,.{casas}f}".translate(str.maketrans(",.", ".,"))


def rpc_do_no(metodo, params):
    """Faz a chamada no primeiro nó da lista que responder."""
    falhas = []
    for url in NOS:
        try:
            return chamar(url, metodo, params)
        except (urllib.error.URLError, TimeoutError, RuntimeError) as erro:
            falhas.append(f"{url}: {erro}")
    raise RuntimeError("todos os nós falharam. " + " | ".join(falhas))


def chamar(url, metodo, params):
    """Faz uma chamada JSON-RPC (um POST com o nome do método) a um nó."""
    corpo = json.dumps({"jsonrpc": "2.0", "id": 1, "method": metodo, "params": params}).encode()
    # Nós atrás da Cloudflare barram o nome padrão do Python ("Python-urllib") com
    # "error code: 1010". Os cabeçalhos abaixo são os mesmos que o curl manda e passa.
    pedido = urllib.request.Request(
        url, data=corpo,
        headers={"Content-Type": "application/json", "Accept": "*/*",
                 "User-Agent": "analise-ethereum"},
    )
    try:
        with urllib.request.urlopen(pedido, timeout=30) as resposta:
            resultado = json.load(resposta)
    except urllib.error.HTTPError as erro:
        # Mostra qual chamada falhou e o texto do servidor, que diz o motivo.
        texto = erro.read(200).decode(errors="replace").strip()
        raise RuntimeError(f"o nó recusou {metodo} com HTTP {erro.code}: {texto}") from erro
    if "error" in resultado:
        raise RuntimeError(f"o nó recusou {metodo}: {resultado['error']}")
    time.sleep(PAUSA)
    return resultado["result"]


def rpc_gravado(caminho):
    """Devolve uma função que responde como o nó, mas lendo respostas gravadas num arquivo."""
    chamadas = json.loads(Path(caminho).read_text(encoding="utf-8"))["chamadas"]
    respostas = {
        (c["pedido"]["method"], json.dumps(c["pedido"]["params"])): c["resposta"]["result"]
        for c in chamadas
    }

    def rpc(metodo, params):
        return respostas[(metodo, json.dumps(params))]

    return rpc


def para_linhas(historico):
    """Transforma uma resposta do eth_feeHistory em linhas (bloco, gwei, ocupação).

    A lista baseFeePerGas vem com um item a mais no fim: é a taxa prevista para o bloco
    seguinte, que ainda não existe. Esse item fica de fora.
    """
    primeiro = int(historico["oldestBlock"], 16)
    taxas = historico["baseFeePerGas"][:-1]
    ocupacoes = historico["gasUsedRatio"]
    return [
        (primeiro + i, int(taxa, 16) / 1e9, ocupacao)  # 1 gwei = 1 bilhão de wei
        for i, (taxa, ocupacao) in enumerate(zip(taxas, ocupacoes))
    ]


def estimar_horas(blocos, bloco_ini, hora_ini, bloco_fim, hora_fim):
    """Distribui por igual a hora entre o primeiro e o último bloco (horas em segundos Unix)."""
    por_bloco = (hora_fim - hora_ini) / (bloco_fim - bloco_ini)
    return [hora_ini + (b - bloco_ini) * por_bloco for b in blocos]


def baixar(rpc, blocos):
    """Busca a taxa base dos últimos `blocos` blocos, de trás para frente, 1.024 por vez."""
    ultimo = int(rpc("eth_blockNumber", []), 16)
    primeiro = ultimo - blocos + 1
    linhas = []
    fim = ultimo
    while fim >= primeiro:
        quantos = min(POR_CHAMADA, fim - primeiro + 1)
        historico = rpc("eth_feeHistory", [hex(quantos), hex(fim), []])
        novas = para_linhas(historico)
        if not novas:
            raise RuntimeError(f"o nó não devolveu blocos até o {fim}")
        linhas += novas
        # O nó pode devolver menos blocos do que o pedido; continua de onde ele parou.
        fim = novas[0][0] - 1
        print(f"  {br(len(linhas)):>6} de {br(blocos)} blocos", end="\r")
    print()

    tabela = pd.DataFrame(linhas, columns=["bloco", "taxa_base_gwei", "ocupacao_bloco"])
    tabela = tabela.sort_values("bloco").reset_index(drop=True)

    hora_ini = int(rpc("eth_getBlockByNumber", [hex(primeiro), False])["timestamp"], 16)
    hora_fim = int(rpc("eth_getBlockByNumber", [hex(ultimo), False])["timestamp"], 16)
    horas = estimar_horas(tabela["bloco"], primeiro, hora_ini, ultimo, hora_fim)
    tabela.insert(1, "data_hora_utc_estimada",
                  pd.to_datetime(pd.Series(horas), unit="s", utc=True).dt.round("s"))
    return tabela


def main():
    if len(sys.argv) > 1:
        origem = Path(sys.argv[1])
        rpc = rpc_gravado(origem)
        blocos = json.loads(origem.read_text(encoding="utf-8"))["blocos"]
        saida = SAIDA.with_name("exemplo_gas.csv") if "exemplo" in origem.name else SAIDA
    else:
        rpc, blocos, saida = rpc_do_no, BLOCOS, SAIDA

    print(f"Baixando a taxa base de {br(blocos)} blocos...")
    try:
        tabela = baixar(rpc, blocos)
    except (urllib.error.URLError, TimeoutError, RuntimeError) as erro:
        # Sem dado completo, para aqui: não grava nada e não mexe no CSV que já existir.
        print()  # pula a linha do contador, para a mensagem não ficar por cima dela
        sys.exit(f"Falhou o download ({erro}). Nada foi gravado.")

    saida.parent.mkdir(exist_ok=True)
    tabela.to_csv(saida, index=False)

    inicio = tabela["data_hora_utc_estimada"].iloc[0]
    fim = tabela["data_hora_utc_estimada"].iloc[-1]
    segundos = (fim - inicio).total_seconds() / (len(tabela) - 1)
    taxa = tabela["taxa_base_gwei"]
    print(f"Gravado: {saida.relative_to(PASTA)}")
    print(f"{br(len(tabela))} blocos, do {br(tabela['bloco'].iloc[0])}"
          f" ao {br(tabela['bloco'].iloc[-1])}")
    print(f"De {inicio:%d/%m/%Y %H:%M} a {fim:%d/%m/%Y %H:%M} (UTC)")
    print(f"Hora de cada bloco ESTIMADA: {br(segundos, 1)} s por bloco em média")
    print(f"Taxa base (gwei): mínima {br(taxa.min(), 3)} | mediana {br(taxa.median(), 3)}"
          f" | máxima {br(taxa.max(), 3)}")


if __name__ == "__main__":
    main()
