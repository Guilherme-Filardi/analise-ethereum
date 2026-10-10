"""Contas do simulador do site: reaproveitam as funções testadas do guia (etapa 6) e do
veredito (etapa 7), com o histórico da Binance (etapa 5).

Três perguntas:
- comprar_e_vender: "e se eu tivesse comprado US$ X no dia A e vendido no dia B?"
- cenarios_hoje: "e se eu comprar hoje, o que o passado diz para daqui a 1 a 12 meses?"
- seguir_vereditos: "e se eu tivesse seguido os vereditos desde o dia A?"

Não é previsão nem recomendação: tudo é o que aconteceu no passado.
"""

import importlib.util
from pathlib import Path

import pandas as pd

PASTA = Path(__file__).parent.parent
HISTORICO = PASTA / "dados" / "eth_diario_binance.csv"
TAXA = 0.001  # 0,1% por compra ou venda, a taxa padrão da Binance


def carregar(nome):
    # Os scripts começam com número (06_, 07_), e o Python não importa esse nome direto.
    spec = importlib.util.spec_from_file_location(nome, PASTA / "src" / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


guia = carregar("06_guia")
veredito = carregar("07_veredito")


def ler_precos(caminho=HISTORICO):
    """Fechamento diário (em US$) indexado pela data."""
    tabela = pd.read_csv(caminho, parse_dates=["data"])
    return tabela.set_index("data")["fechamento"].astype(float)


def comprar_e_vender(precos, valor, compra, venda, taxa=TAXA):
    """Compra no fechamento do dia `compra` e vende no fechamento do dia `venda`.

    Paga a taxa na compra e na venda. Devolve o resultado e a carteira dia a dia, para o
    gráfico (o valor de cada dia já desconta a taxa de venda, como se vendesse ali).
    """
    compra, venda = pd.Timestamp(compra), pd.Timestamp(venda)
    if compra >= venda:
        raise ValueError("o dia da venda precisa ser depois do dia da compra")
    if compra < precos.index[0] or venda > precos.index[-1]:
        raise ValueError(f"escolha datas entre {precos.index[0]:%d/%m/%Y}"
                         f" e {precos.index[-1]:%d/%m/%Y}")
    trecho = precos.loc[compra:venda]
    cotas = valor * (1 - taxa) / trecho.iloc[0]
    carteira = cotas * trecho * (1 - taxa)
    pior = carteira.idxmin()
    return {
        "preco_compra": trecho.iloc[0],
        "preco_venda": trecho.iloc[-1],
        "cotas": cotas,
        "valor_final": carteira.iloc[-1],
        "retorno": carteira.iloc[-1] / valor - 1,
        "pior_dia": pior,
        "pior_valor": carteira.loc[pior],
        "pior_retorno": carteira.loc[pior] / valor - 1,
        "carteira": carteira,
    }


def cenarios_hoje(precos, valor):
    """Para cada prazo do guia: um caso ruim, um típico e um bom, em todos os dias e nos
    dias parecidos com hoje (mesma distância do recorde, mais ou menos 10 pontos).

    "Ruim" é o retorno que 9 em cada 10 compras superaram (10%); "bom", o que só 1 em cada
    10 superou (90%); "típico", a metade (mediana).
    """
    queda = guia.queda_do_topo(precos)
    parecido = (queda - queda.iloc[-1]).abs() <= guia.FAIXA_PARECIDO
    grupos = {"todos": None, "parecidos": parecido}
    saida = {"queda_hoje": -queda.iloc[-1], "faixa": guia.FAIXA_PARECIDO,
             "episodios_parecidos": guia.episodios(parecido), "prazos": []}
    for prazo, dias in guia.PRAZOS.items():
        linha = {"prazo": prazo, "dias": dias}
        for nome, filtro in grupos.items():
            resultado = guia.a_frente(precos, dias)
            if filtro is not None:
                resultado = resultado[filtro.loc[resultado.index]]
            if len(resultado) == 0:
                linha[nome] = None
                continue
            r = guia.resumir(resultado)
            linha[nome] = {
                "compras": r["compras"],
                "no_prejuizo": r["no_prejuizo"],
                "ruim": valor * (1 + r["p10"]),
                "tipico": valor * (1 + r["mediana"]),
                "bom": valor * (1 + r["p90"]),
                "susto_tipico": r["susto_mediano"],
            }
        saida["prazos"].append(linha)
    return saida


def posicoes_dos_vereditos(vereditos_):
    """Comprado (1) ou fora (0) em cada dia, seguindo o veredito do dia anterior.

    "Momento bom" compra, "momento ruim" vende, "sem vantagem" mantém como está. O
    veredito sai no fechamento de um dia e só vale para o dia seguinte. Começa fora.
    """
    posicoes, atual = [], 0
    for v in vereditos_:
        posicoes.append(atual)  # a posição de hoje vem do veredito de ontem
        if v == "momento bom":
            atual = 1
        elif v == "momento ruim":
            atual = 0
    return pd.Series(posicoes, index=vereditos_.index)


def seguir_vereditos(precos, valor, desde, taxa=TAXA):
    """Carteira que segue os vereditos desde o dia `desde`, contra comprar e esperar."""
    desde = pd.Timestamp(desde)
    d = veredito.vereditos(veredito.caracteristicas(precos))
    if desde < d.index[0] or desde >= d.index[-1]:
        raise ValueError(f"escolha um início entre {d.index[0]:%d/%m/%Y}"
                         f" e {d.index[-2]:%d/%m/%Y}")
    d = d.loc[desde:]
    posicao = posicoes_dos_vereditos(d["veredito"])
    trocas = posicao.diff().abs().fillna(posicao.iloc[0])
    retorno = posicao * d["preco"].pct_change().fillna(0) - trocas * taxa
    seguindo = valor * (1 + retorno).cumprod()
    esperando = valor * (1 - taxa) * d["preco"] / d["preco"].iloc[0]
    # A posição de amanhã, pelo veredito de hoje (o mesmo jeito de posicoes_dos_vereditos).
    hoje = d["veredito"].iloc[-1]
    amanha = {"momento bom": 1, "momento ruim": 0}.get(hoje, int(posicao.iloc[-1]))
    return {
        "seguindo": seguindo,
        "esperando": esperando,
        "operacoes": int(trocas.sum()),
        "tempo_comprado": posicao.mean(),
        "maior_queda_seguindo": guia.maior_queda(seguindo),
        "maior_queda_esperando": guia.maior_queda(esperando),
        "comprado_amanha": bool(amanha),
    }
