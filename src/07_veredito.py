"""Etapa 7: veredito diário. O dia de amanhã é um bom momento para o ETH, ruim ou sem vantagem?

Roda uma vez por dia, depois que o dia da Binance fecha (21h em Brasília), logo após a
etapa 5 (que atualiza dados/eth_diario_binance.csv). A cada rodada:
1. confere os vereditos anteriores cujo dia já fechou (subiu ou caiu? acertou?);
2. dá o veredito do dia mais recente para o dia seguinte e anota no diário;
3. mostra o placar ao vivo e o placar histórico desde 2017.

Como o veredito é decidido: procura no passado os dias parecidos com hoje (mesma tendência,
mesma faixa de distância do recorde, mesma direção na última semana) e vê em quantos deles o
dia seguinte subiu. Só usa o que já se sabia no dia; nunca espia o futuro.

Grava saidas/diario_veredictos.csv (o diário, uma linha por veredito) e saidas/veredito_hoje.txt.

Uso:
    python src/07_veredito.py                                          (dados/eth_diario_binance.csv)
    python src/07_veredito.py dados/exemplo_eth_diario_binance.csv     (outro arquivo, para teste)
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PASTA = Path(__file__).parent.parent
ENTRADA = PASTA / "dados" / "eth_diario_binance.csv"
SAIDAS = PASTA / "saidas"

# ------------------------------------------------------------------ A REGRA (congelada)
# Não mude estes números depois que o diário começar: ajustar a regra depois de ver os
# erros é "decorar a prova", e o placar perde o valor. Se um dia precisar mudar, crie uma
# versão nova (VERSAO) e o diário passa a separar as duas.
VERSAO = "1 (10/10/2026)"
FAIXAS_QUEDA = [0.10, 0.30, 0.50]  # distância do recorde: 0-10%, 10-30%, 30-50%, 50%+
BOM = 0.55        # nos dias parecidos, o seguinte subiu em 55% ou mais: "momento bom"
RUIM = 0.45       # subiu em 45% ou menos: "momento ruim"; entre os dois: "sem vantagem"
MINIMO = 30       # com menos de 30 dias parecidos no passado: "sem vantagem"
# ------------------------------------------------------------------

DESCRICAO_FAIXA = ["0 a 10%", "10 a 30%", "30 a 50%", "mais de 50%"]


def br_pct(valor):
    return f"{valor:.1%}".replace(".", ",")


def moeda(valor):
    return "US$ " + f"{valor:,.2f}".translate(str.maketrans(",.", ".,"))


def caracteristicas(precos):
    """As 3 coisas que definem um dia "parecido", calculadas só com o passado de cada dia."""
    d = pd.DataFrame({"preco": precos})
    d["tendencia_alta"] = precos.rolling(7).mean() > precos.rolling(30).mean()
    queda = 1 - precos / precos.cummax()
    d["faixa_queda"] = sum((queda >= limite).astype(int) for limite in FAIXAS_QUEDA)
    d["semana_subiu"] = precos > precos.shift(7)
    # O dia seguinte subiu? (o último dia ainda não tem resposta)
    d["amanha_subiu"] = (precos.shift(-1) > precos).where(precos.shift(-1).notna())
    # Os primeiros 30 dias não têm média de 30 dias: ficam de fora.
    return d.iloc[29:]


def vereditos(d):
    """Para cada dia, o veredito com base só nos dias parecidos ANTERIORES a ele.

    O resultado de um dia anterior só é conhecido no dia seguinte a ele, ou seja, até hoje.
    Por isso todos os dias anteriores entram, e o próprio dia não.
    """
    d = d.copy()
    chave = ["tendencia_alta", "faixa_queda", "semana_subiu"]
    subiu = d["amanha_subiu"].astype(float)
    grupo = subiu.groupby([d[c] for c in chave])
    d["dias_parecidos"] = grupo.transform(lambda x: x.notna().cumsum().shift(1).fillna(0))
    d["subiu_nos_parecidos"] = grupo.transform(lambda x: x.fillna(0).cumsum().shift(1).fillna(0))
    d["chance_subir"] = d["subiu_nos_parecidos"] / d["dias_parecidos"]
    d["veredito"] = "sem vantagem"
    tem_base = d["dias_parecidos"] >= MINIMO
    d.loc[tem_base & (d["chance_subir"] >= BOM), "veredito"] = "momento bom"
    d.loc[tem_base & (d["chance_subir"] <= RUIM), "veredito"] = "momento ruim"
    return d


def acertou(veredito, subiu):
    """Bom e subiu, ou ruim e caiu: acerto. "Sem vantagem" não conta no placar."""
    if veredito == "sem vantagem" or pd.isna(subiu):
        return None
    return (veredito == "momento bom") == bool(subiu)


def placar(vereditos_, subiu):
    """Acertos entre os dias com veredito, comparados com dizer "sobe" nesses mesmos dias."""
    conta = [(v, s) for v, s in zip(vereditos_, subiu) if acertou(v, s) is not None]
    if not conta:
        return None
    acertos = sum(acertou(v, s) for v, s in conta)
    sempre_sobe = sum(bool(s) for _, s in conta)
    return {"dias": len(conta), "acertos": acertos, "taxa": acertos / len(conta),
            "sempre_sobe": sempre_sobe / len(conta)}


def atualizar_diario(caminho, d, hoje_utc):
    """Confere os vereditos pendentes e acrescenta o de hoje (uma vez por dia de dado)."""
    colunas = ["dia", "preco", "tendencia", "distancia_do_recorde", "semana", "dias_parecidos",
               "chance_subir", "veredito", "dia_conferido", "preco_seguinte", "resultado",
               "acertou", "versao_regra", "anotado_em"]
    if caminho.exists():
        diario = pd.read_csv(caminho, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    else:
        diario = pd.DataFrame(columns=colunas)

    # 1. Conferir os pendentes cujo dia seguinte já fechou.
    precos = d["preco"]
    for i, linha in diario.iterrows():
        if linha["resultado"]:
            continue
        dia = pd.Timestamp(linha["dia"])
        posicao = precos.index.get_indexer([dia])[0]
        if posicao == -1 or posicao + 1 >= len(precos):
            continue
        seguinte = precos.iloc[posicao + 1]
        subiu = seguinte > precos.iloc[posicao]
        certo = acertou(linha["veredito"], subiu)
        diario.loc[i, "dia_conferido"] = f"{precos.index[posicao + 1]:%Y-%m-%d}"
        diario.loc[i, "preco_seguinte"] = f"{seguinte:.2f}"
        diario.loc[i, "resultado"] = "subiu" if subiu else "caiu"
        diario.loc[i, "acertou"] = "-" if certo is None else ("sim" if certo else "não")

    # 2. Anotar o veredito do último dia fechado, se ainda não estiver no diário.
    #    Só o último: um dia perdido (computador desligado) fica de fora, porque anotar
    #    depois, já sabendo o resultado, não seria um veredito "ao vivo".
    ultimo = d.iloc[-1]
    dia = f"{d.index[-1]:%Y-%m-%d}"
    if dia not in set(diario["dia"]):
        nova = {
            "dia": dia,
            "preco": f"{ultimo['preco']:.2f}",
            "tendencia": "alta" if ultimo["tendencia_alta"] else "baixa",
            "distancia_do_recorde": DESCRICAO_FAIXA[int(ultimo["faixa_queda"])],
            "semana": "subiu" if ultimo["semana_subiu"] else "caiu",
            "dias_parecidos": str(int(ultimo["dias_parecidos"])),
            "chance_subir": f"{ultimo['chance_subir']:.4f}",
            "veredito": ultimo["veredito"],
            "dia_conferido": "", "preco_seguinte": "", "resultado": "", "acertou": "",
            "versao_regra": VERSAO,
            "anotado_em": hoje_utc,
        }
        diario = pd.concat([diario, pd.DataFrame([nova])], ignore_index=True)

    caminho.parent.mkdir(exist_ok=True)
    # "utf-8-sig" faz o Excel abrir os acentos certos ("não", "distância").
    diario.to_csv(caminho, index=False, encoding="utf-8-sig")
    return diario


def texto_placar(nome, p):
    if p is None:
        return f"{nome}: ainda sem dias com veredito conferido."
    return (f"{nome}: {p['acertos']} acertos em {p['dias']} dias com veredito"
            f" = {br_pct(p['taxa'])}. Dizer 'sobe' nesses mesmos dias acertaria"
            f" {br_pct(p['sempre_sobe'])}; chutar acertaria 50%.")


def relatorio(d, diario, exemplo):
    ultimo = d.iloc[-1]
    dia = d.index[-1]
    linhas = ["*** EXEMPLO: DADO FICTÍCIO, SÓ PARA TESTAR O SCRIPT ***", ""] if exemplo else []
    linhas += [
        f"VEREDITO PARA O DIA SEGUINTE A {dia:%d/%m/%Y}",
        f"(o dia da Binance de {dia + pd.Timedelta(days=1):%d/%m}, que fecha às 21h em Brasília)",
        "",
        f"  >>> {ultimo['veredito'].upper()} <<<",
        "",
        f"Fechamento de {dia:%d/%m/%Y}: {moeda(ultimo['preco'])}",
        "Hoje o mercado está assim:",
        f"  - tendência: {'alta' if ultimo['tendencia_alta'] else 'baixa'}"
        " (média de 7 dias acima ou abaixo da de 30)",
        f"  - distância do recorde: {DESCRICAO_FAIXA[int(ultimo['faixa_queda'])]}",
        f"  - última semana: {'subiu' if ultimo['semana_subiu'] else 'caiu'}",
        f"No passado houve {int(ultimo['dias_parecidos'])} dias assim; o dia seguinte subiu em"
        f" {br_pct(ultimo['chance_subir'])} deles.",
        f"Regra: 'bom' com {br_pct(BOM)} ou mais; 'ruim' com {br_pct(RUIM)} ou menos;"
        f" 'sem vantagem' entre os dois ou com menos de {MINIMO} dias parecidos.",
        "",
    ]
    conferidos = diario[diario["resultado"] != ""]
    if len(conferidos):
        ontem = conferidos.iloc[-1]
        linhas.append(f"Último conferido: {pd.Timestamp(ontem['dia']):%d/%m} disse"
                      f" '{ontem['veredito']}', e o dia seguinte {ontem['resultado']}"
                      f" (acertou: {ontem['acertou']}).")
    vivo = placar(conferidos["veredito"], conferidos["resultado"] == "subiu")
    historico = placar(d["veredito"].iloc[:-1], d["amanha_subiu"].iloc[:-1])
    linhas += [
        texto_placar("Placar ao vivo (diário)", vivo),
        texto_placar(f"Placar histórico (desde {d.index[0]:%d/%m/%Y})", historico),
        "",
        "O placar histórico usa a mesma regra, dia a dia, só com o que se sabia em cada dia.",
        "A regra só presta se ganhar de dizer 'sobe' todo dia. Não é recomendação de compra.",
    ]
    return "\n".join(linhas) + "\n"


def main():
    entrada = Path(sys.argv[1]) if len(sys.argv) > 1 else ENTRADA
    exemplo = "exemplo" in entrada.name
    prefixo = "exemplo_" if exemplo else ""

    tabela = pd.read_csv(entrada, parse_dates=["data"])
    precos = tabela.set_index("data")["fechamento"].astype(float)
    d = vereditos(caracteristicas(precos))

    # Aviso se o dado está velho (a etapa 5 falhou ou não rodou hoje).
    hoje = datetime.now(timezone.utc)
    atraso = (hoje.date() - d.index[-1].date()).days
    if not exemplo and atraso > 1:
        print(f"ATENÇÃO: o último dia do dado é {d.index[-1]:%d/%m/%Y}, {atraso} dias atrás."
              " Rode antes a etapa 5 (src/05_historico_binance.py).")

    SAIDAS.mkdir(exist_ok=True)
    diario = atualizar_diario(SAIDAS / f"{prefixo}diario_veredictos.csv", d,
                              hoje.strftime("%Y-%m-%d %H:%M UTC"))
    texto = relatorio(d, diario, exemplo)
    (SAIDAS / f"{prefixo}veredito_hoje.txt").write_text(texto, encoding="utf-8")
    print(texto)
    print(f"Gravado: saidas/{prefixo}veredito_hoje.txt e saidas/{prefixo}diario_veredictos.csv")


if __name__ == "__main__":
    main()
