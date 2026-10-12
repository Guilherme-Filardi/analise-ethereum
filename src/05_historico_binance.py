"""Etapa 5: baixa da Binance o preço diário do ETH desde 2017 (par ETH/USDT).

Grava dados/eth_diario_binance.csv, um dia por linha: abertura, máxima, mínima, fechamento
e volume. O USDT é uma moeda digital presa ao dólar (1 USDT vale cerca de US$ 1).

Cada "dia" da Binance vai da meia-noite à meia-noite em UTC (21h a 21h em Brasília).
O dia de hoje, ainda aberto, fica de fora: o preço dele ainda vai mudar.

Uso:
    python src/05_historico_binance.py                                   (baixa da Binance)
    python src/05_historico_binance.py dados/exemplo_binance_rpc.json    (repete respostas gravadas)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd

# Endereço principal e o espelho oficial de dados públicos da Binance (mesmo formato).
# Se um falhar, o script tenta o seguinte.
ENDERECOS = [
    "https://api.binance.com/api/v3/klines",
    "https://data-api.binance.vision/api/v3/klines",
]
PAR = "ETHUSDT"
# A Binance entrega no máximo 1.000 dias por pedido.
POR_PEDIDO = 1000
DIA_MS = 86_400_000
PAUSA = 0.3
PASTA = Path(__file__).parent.parent
SAIDA = PASTA / "dados" / "eth_diario_binance.csv"
# Cada dia vem como uma lista; estas são as colunas na ordem em que a Binance manda.
COLUNAS = [
    "abertura_ms", "abertura", "maxima", "minima", "fechamento", "volume_eth",
    "fechamento_ms", "volume_usdt", "negocios", "compra_eth", "compra_usdt", "ignorar",
]


def pedir_na_binance(inicio_ms):
    """Pede até 1.000 dias a partir de inicio_ms, no primeiro endereço que responder."""
    consulta = f"?symbol={PAR}&interval=1d&startTime={inicio_ms}&limit={POR_PEDIDO}"
    falhas = []
    for endereco in ENDERECOS:
        # Cabeçalhos iguais aos do curl: alguns servidores barram o nome padrão do Python.
        pedido = urllib.request.Request(
            endereco + consulta, headers={"Accept": "*/*", "User-Agent": "analise-ethereum"}
        )
        try:
            with urllib.request.urlopen(pedido, timeout=30) as resposta:
                dias = json.load(resposta)
            time.sleep(PAUSA)
            return dias
        except urllib.error.HTTPError as erro:
            texto = erro.read(200).decode(errors="replace").strip()
            falhas.append(f"{endereco}: HTTP {erro.code} {texto}")
        except (urllib.error.URLError, TimeoutError) as erro:
            falhas.append(f"{endereco}: {erro}")
    raise RuntimeError("todos os endereços falharam. " + " | ".join(falhas))


def pedidos_gravados(caminho):
    """Devolve uma função que responde como a Binance, lendo respostas gravadas num arquivo."""
    chamadas = json.loads(Path(caminho).read_text(encoding="utf-8"))["chamadas"]
    respostas = {c["inicio_ms"]: c["resposta"] for c in chamadas}
    return lambda inicio_ms: respostas[inicio_ms]


def baixar(pedir, agora_ms):
    """Busca todos os dias desde o primeiro que a Binance tiver, 1.000 por vez."""
    dias = []
    inicio = 0  # 0 = "desde o começo": a Binance devolve a partir do primeiro dia que tem
    while True:
        lote = pedir(inicio)
        dias += lote
        if len(lote) < POR_PEDIDO:
            break
        inicio = lote[-1][0] + DIA_MS
    tabela = pd.DataFrame(dias, columns=COLUNAS).drop(columns="ignorar")
    # Só dias fechados: o de hoje ainda está mudando.
    tabela = tabela[tabela["fechamento_ms"] < agora_ms]
    tabela.insert(0, "data", pd.to_datetime(tabela.pop("abertura_ms"), unit="ms").dt.date)
    tabela = tabela.drop(columns="fechamento_ms")
    return tabela.drop_duplicates("data").reset_index(drop=True)


def gravar(tabela, caminho, **opcoes):
    """Grava num arquivo temporário e troca de uma vez (os.replace).

    Quem ler ao mesmo tempo (o site, ou o agendamento das 21h30 junto com o botão "Buscar
    agora") nunca vê o arquivo pela metade. Se der erro, o arquivo antigo fica como estava.
    """
    temporario = caminho.with_name(caminho.name + ".gravando")
    try:
        tabela.to_csv(temporario, index=False, **opcoes)
        os.replace(temporario, caminho)
    finally:
        temporario.unlink(missing_ok=True)


def main():
    if len(sys.argv) > 1:
        origem = Path(sys.argv[1])
        pedir = pedidos_gravados(origem)
        agora_ms = json.loads(origem.read_text(encoding="utf-8"))["agora_ms"]
        saida = SAIDA.with_name("exemplo_eth_diario_binance.csv") if "exemplo" in origem.name else SAIDA
    else:
        pedir, agora_ms, saida = pedir_na_binance, int(time.time() * 1000), SAIDA

    print(f"Baixando o histórico diário do {PAR} na Binance...")
    try:
        tabela = baixar(pedir, agora_ms)
    except RuntimeError as erro:
        # Sem dado completo, para aqui: não grava nada e não mexe no CSV que já existir.
        sys.exit(f"Falhou o download ({erro}). Nada foi gravado.")

    # Uma resposta vazia ou mais curta que o histórico que já existe é defeito da fonte, e não
    # dado novo: gravar por cima apagaria dias e faria o 07 e o 08 anotarem um dia velho.
    if tabela.empty:
        sys.exit("A Binance respondeu sem nenhum dia. Nada foi gravado.")
    if saida.exists():
        antes = pd.read_csv(saida, usecols=["data"], parse_dates=["data"])["data"]
        if len(tabela) < len(antes) or pd.Timestamp(tabela["data"].iloc[-1]) < antes.iloc[-1]:
            sys.exit(f"A resposta veio mais curta que o histórico ({len(tabela)} dias contra {len(antes)},"
                     f" até {tabela['data'].iloc[-1]:%d/%m/%Y}). Nada foi gravado.")
    saida.parent.mkdir(exist_ok=True)
    gravar(tabela, saida)

    ultimo = tabela.iloc[-1]
    fechamento = f"{float(ultimo['fechamento']):,.2f}".translate(str.maketrans(",.", ".,"))
    print(f"Gravado: {saida.relative_to(PASTA)}")
    print(f"{len(tabela):,} dias".replace(",", ".")
          + f", de {tabela['data'].iloc[0]:%d/%m/%Y} a {ultimo['data']:%d/%m/%Y}")
    print(f"Último fechamento: US$ {fechamento} (21h de {ultimo['data']:%d/%m} em Brasília)")


if __name__ == "__main__":
    main()
