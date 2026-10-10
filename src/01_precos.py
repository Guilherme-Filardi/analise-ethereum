"""Etapa 1: baixa da CoinGecko o preço, o valor de mercado e o volume do ETH no último ano.

Grava dados/precos_eth.csv com um ponto por linha, do jeito que a fonte mandou.
A limpeza (um valor por dia) acontece na etapa 2, para o dado bruto ficar intacto.

Uso:
    python src/01_precos.py                                  (baixa da CoinGecko)
    python src/01_precos.py dados/exemplo_coingecko.json     (lê um arquivo local, para teste)
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

DIAS = 365
URL = (
    "https://api.coingecko.com/api/v3/coins/ethereum/market_chart"
    f"?vs_currency=usd&days={DIAS}"
)
PASTA = Path(__file__).parent.parent
SAIDA = PASTA / "dados" / "precos_eth.csv"


def baixar(url):
    # Sem User-Agent, alguns servidores recusam a chamada de script.
    pedido = urllib.request.Request(url, headers={"User-Agent": "analise-ethereum"})
    with urllib.request.urlopen(pedido, timeout=30) as resposta:
        return json.load(resposta)


def para_tabela(bruto):
    """Junta as três listas da CoinGecko ([milissegundos, valor]) numa tabela só.

    Junta pela hora, e não pela posição, porque as listas podem vir com tamanhos diferentes.
    """
    colunas = {
        "prices": "preco_usd",
        "market_caps": "valor_mercado_usd",
        "total_volumes": "volume_usd",
    }
    tabela = None
    for chave, nome in colunas.items():
        parte = pd.DataFrame(bruto[chave], columns=["ms", nome])
        tabela = parte if tabela is None else tabela.merge(parte, on="ms", how="outer")
    tabela = tabela.sort_values("ms")
    tabela.insert(0, "data_hora_utc", pd.to_datetime(tabela.pop("ms"), unit="ms", utc=True))
    return tabela.reset_index(drop=True)


def main():
    if len(sys.argv) > 1:
        origem = Path(sys.argv[1])
        bruto = json.loads(origem.read_text(encoding="utf-8"))
        # Dado de arquivo local pode ser de exemplo; o nome de saída avisa, para não se
        # confundir com o dado real.
        saida = SAIDA.with_name("exemplo_precos_eth.csv") if "exemplo" in origem.name else SAIDA
    else:
        print(f"Baixando {DIAS} dias da CoinGecko...")
        try:
            bruto = baixar(URL)
        except (urllib.error.URLError, TimeoutError) as erro:
            # Sem dado, para aqui: não grava nada e não mexe no CSV que já existir.
            sys.exit(f"Falhou o download da CoinGecko ({erro}). Nada foi gravado.")
        saida = SAIDA

    tabela = para_tabela(bruto)
    saida.parent.mkdir(exist_ok=True)
    tabela.to_csv(saida, index=False)

    primeiro = tabela["data_hora_utc"].iloc[0]
    ultimo = tabela["data_hora_utc"].iloc[-1]
    print(f"Gravado: {saida.relative_to(PASTA)}")
    print(f"{len(tabela)} pontos, de {primeiro:%d/%m/%Y} a {ultimo:%d/%m/%Y %H:%M} (UTC)")
    preco = f"{tabela['preco_usd'].iloc[-1]:,.2f}".translate(str.maketrans(",.", ".,"))
    print(f"Último preço: US$ {preco}")


if __name__ == "__main__":
    main()
