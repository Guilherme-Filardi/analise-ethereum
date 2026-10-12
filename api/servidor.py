"""API do site da análise: faz as contas em Python e entrega em JSON para a tela (React).

Também entrega a própria tela já construída (site/dist), para tudo abrir numa porta só:
http://127.0.0.1:8010. Quem liga é o abrir_site.bat.

Ligar à mão, da pasta do projeto:
    "..\\.venv\\Scripts\\python.exe" -m uvicorn api.servidor:app --host 127.0.0.1 --port 8010
"""

import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).parent))
import simulador  # noqa: E402 (precisa do caminho acima)

PASTA = Path(__file__).parent.parent
SAIDAS = PASTA / "saidas"
TELA = (PASTA / "site" / "dist").resolve()
DIARIO = SAIDAS / "diario_veredictos.csv"
DIARIO_2 = SAIDAS / "diario_previsao.csv"

app = FastAPI(title="Análise Ethereum", docs_url=None, redoc_url=None)


def numero(valor):
    """Número do pandas ou do numpy vira número comum do Python (o JSON não aceita os outros)."""
    return None if pd.isna(valor) else float(valor)


def serie(valores):
    """Série com data no índice vira uma lista [{data, valor}] para o gráfico."""
    return [{"data": f"{d:%Y-%m-%d}", "valor": round(float(v), 2)} for d, v in valores.items()]


# Cabeçalhos que túneis e proxies (Tailscale Funnel, Cloudflare...) acrescentam ao repassar uma
# visita da internet. Se aparecer algum, a visita veio de fora, mesmo chegando por 127.0.0.1.
CABECALHOS_DE_FORA = ("x-forwarded-for", "forwarded", "x-real-ip", "cf-connecting-ip",
                      "tailscale-funnel-request")


def neste_computador(pedido: Request) -> bool:
    """A visita é do próprio computador (e não da internet, por um túnel)?

    Confere três coisas: veio de 127.0.0.1, o endereço digitado foi 127.0.0.1 ou localhost
    (pelo túnel, é o endereço público), e nenhum túnel deixou a sua marca nos cabeçalhos.
    """
    endereco = (pedido.headers.get("host") or "").rsplit(":", 1)[0].strip("[]")
    return (
        pedido.client is not None
        and pedido.client.host in ("127.0.0.1", "::1")
        and endereco in ("127.0.0.1", "localhost", "::1")
        and not any(c in pedido.headers for c in CABECALHOS_DE_FORA)
    )


def precos():
    if not simulador.HISTORICO.exists():
        raise HTTPException(503, "Falta o histórico: rode o src\\05_historico_binance.py.")
    return simulador.ler_precos()


@app.get("/api/saude")
def saude():
    return {"ok": True}


@app.get("/api/hoje")
def hoje(pedido: Request):
    v = simulador.veredito
    p = precos()
    d = v.vereditos(v.caracteristicas(p))
    ultimo = d.iloc[-1]

    vivo = None
    if DIARIO.exists():
        diario = pd.read_csv(DIARIO, dtype=str, keep_default_na=False, encoding="utf-8-sig")
        conferidos = diario[diario["resultado"] != ""]
        vivo = v.placar(conferidos["veredito"], conferidos["resultado"] == "subiu")
    historico = v.placar(d["veredito"].iloc[:-1], d["amanha_subiu"].iloc[:-1])

    # Os mesmos 3 sinais da regra, em números que dá para escrever numa frase.
    recorde_dia = p.loc[:d.index[-1]].idxmax()
    return {
        "dia": f"{d.index[-1]:%Y-%m-%d}",
        "preco": numero(ultimo["preco"]),
        "media_7": numero(p.rolling(7).mean().iloc[-1]),
        "media_30": numero(p.rolling(30).mean().iloc[-1]),
        "recorde": numero(p.loc[recorde_dia]),
        "recorde_dia": f"{recorde_dia:%Y-%m-%d}",
        "abaixo_do_recorde": numero(1 - p.iloc[-1] / p.loc[recorde_dia]),
        "preco_7_dias_antes": numero(p.iloc[-8]),
        "variacao_semana": numero(p.iloc[-1] / p.iloc[-8] - 1),
        "veredito": ultimo["veredito"],
        "tendencia": "alta" if ultimo["tendencia_alta"] else "baixa",
        "distancia_do_recorde": v.DESCRICAO_FAIXA[int(ultimo["faixa_queda"])],
        "semana": "subiu" if ultimo["semana_subiu"] else "caiu",
        "dias_parecidos": int(ultimo["dias_parecidos"]),
        "chance_subir": numero(ultimo["chance_subir"]),
        "regra": {"versao": v.VERSAO, "bom": v.BOM, "ruim": v.RUIM, "minimo": v.MINIMO},
        "placar_vivo": vivo,
        "placar_historico": historico,
        "historico_desde": f"{d.index[0]:%Y-%m-%d}",
        # Quantos dos últimos 365 dias a regra ficou sem palpite (só o passado, sem mudar a regra).
        "sem_palpite_1_ano": numero((d["veredito"].iloc[-365:] == "sem vantagem").mean()),
        "pode_atualizar": neste_computador(pedido),
        "ultimos_90_dias": serie(p.iloc[-90:]),
    }


@app.get("/api/diario")
def diario(versao: int = 1):
    caminho = {1: DIARIO, 2: DIARIO_2}.get(versao)
    if caminho is None:
        raise HTTPException(422, "versão desconhecida; use 1 ou 2")
    tabela = ler_diario(caminho)
    if tabela is None:
        return []
    return tabela.iloc[::-1].to_dict(orient="records")  # o mais recente em cima


# ------------------------------------------------------------------ previsão (versão 2) e painel
# As contas da previsão levam ~1 s; ficam guardadas até o arquivo de preços mudar (a busca
# das 21h30 ou o botão "Buscar agora" trocam a data do arquivo, e a conta se refaz sozinha).

def marca_do_historico():
    precos()  # mesma mensagem de erro se faltar o histórico
    return simulador.HISTORICO.stat().st_mtime_ns


@lru_cache(maxsize=2)
def contas(marca):
    prev = simulador.previsao
    t = prev.ler(simulador.HISTORICO)
    d, modelo = prev.previsoes(t)
    v = simulador.veredito
    v1 = v.vereditos(v.caracteristicas(t["fechamento"]))
    return t, d, modelo, v1


def ler_diario(caminho):
    if not caminho.exists():
        return None
    return pd.read_csv(caminho, dtype=str, keep_default_na=False, encoding="utf-8-sig")


def previsao_de_hoje(d):
    hoje = d.iloc[-1]
    prev = simulador.previsao
    tem_chance = pd.notna(hoje["chance_subir"])
    return {
        "dia": f"{d.index[-1]:%Y-%m-%d}",
        "preco": numero(hoje["preco"]),
        "faixa1_min": numero(hoje["faixa1_min"]), "faixa1_max": numero(hoje["faixa1_max"]),
        "faixa7_min": numero(hoje["faixa7_min"]), "faixa7_max": numero(hoje["faixa7_max"]),
        "chance_subir": numero(hoje["chance_subir"]),
        "palpite": hoje["palpite"],
        "forca": prev.forca(hoje["chance_subir"]) if tem_chance else "",
        "versao": prev.VERSAO,
        "cobertura": prev.COBERTURA,
    }


def faixa_contra_real(d, dias):
    """A faixa prevista para cada dia (na véspera dele) e o preço que veio de verdade."""
    x = d.iloc[-dias - 1:]
    return [
        {"data": f"{amanha:%Y-%m-%d}", "real": round(float(x.loc[amanha, "preco"]), 2),
         "min": round(float(x.loc[ontem, "faixa1_min"]), 2), "max": round(float(x.loc[ontem, "faixa1_max"]), 2)}
        for ontem, amanha in zip(x.index[:-1], x.index[1:])
        if pd.notna(x.loc[ontem, "faixa1_min"])
    ]


def desde(d):
    primeiro = d["chance_subir"].first_valid_index()
    return f"{primeiro:%Y-%m-%d}" if primeiro is not None else None


@app.get("/api/painel")
def painel(pedido: Request):
    """Tudo o que a página inicial mostra, numa resposta só."""
    t, d, _, v1 = contas(marca_do_historico())
    p = t["fechamento"]
    prev, v = simulador.previsao, simulador.veredito

    def variacao(dias):
        return numero(p.iloc[-1] / p.iloc[-1 - dias] - 1) if len(p) > dias else None

    diario_1, diario_2 = ler_diario(DIARIO), ler_diario(DIARIO_2)
    vivo_1 = None
    if diario_1 is not None:
        conferidos = diario_1[diario_1["resultado"] != ""]
        vivo_1 = v.placar(conferidos["veredito"], conferidos["resultado"] == "subiu")
    ultimo_v1 = v1.iloc[-1]
    return {
        "dia": f"{p.index[-1]:%Y-%m-%d}",
        "preco": numero(p.iloc[-1]),
        "variacoes": {"1d": variacao(1), "7d": variacao(7), "30d": variacao(30), "1a": variacao(365)},
        "recorde": numero(p.max()),
        "recorde_dia": f"{p.idxmax():%Y-%m-%d}",
        "abaixo_do_recorde": numero(1 - p.iloc[-1] / p.max()),
        "mexida_tipica_30": numero(p.pct_change().iloc[-30:].abs().median()),
        "ultimos_30": serie(p.iloc[-30:]),
        "previsao": previsao_de_hoje(d),
        "placar_2": {"teste": prev.placar(d), "teste_desde": desde(d),
                     "vivo": prev.placar_do_diario(diario_2) if diario_2 is not None else None},
        "palpite_1": {
            "veredito": ultimo_v1["veredito"], "chance_subir": numero(ultimo_v1["chance_subir"]),
            "dias_parecidos": int(ultimo_v1["dias_parecidos"]),
            "teste": v.placar(v1["veredito"].iloc[:-1], v1["amanha_subiu"].iloc[:-1]),
            "sem_palpite_1_ano": numero((v1["veredito"].iloc[-365:] == "sem vantagem").mean()),
            "vivo": vivo_1, "versao": v.VERSAO,
        },
        "faixa_recente": faixa_contra_real(d, 60),
        "pode_atualizar": neste_computador(pedido),
    }


@app.get("/api/previsao")
def previsao():
    """A previsão versão 2 por dentro: por que deu o que deu, e como ela se saiu no passado."""
    t, d, modelo, _ = contas(marca_do_historico())
    prev = simulador.previsao
    com = d.dropna(subset=["chance_subir", "subiu"]).copy()
    com["subiu"] = com["subiu"].astype(bool)
    com["acertou"] = com["acertou"].astype(bool)

    # Calibração: quando a chance prevista estava numa faixa, quantas vezes subiu de verdade?
    cortes = [0, 0.47, 0.49, 0.5, 0.51, 0.53, 1]
    grupos = pd.cut(com["chance_subir"], cortes, right=False)
    calibracao = [
        {"de": float(g.left), "ate": float(g.right), "dias": int(len(x)),
         "prevista": numero(x["chance_subir"].mean()), "subiu": numero(x["subiu"].mean())}
        for g, x in com.groupby(grupos, observed=True) if len(x)
    ]
    forcas = com["chance_subir"].map(prev.forca)
    por_forca = [
        {"forca": nome, "dias": int((forcas == nome).sum()),
         "acerto": numero(com.loc[forcas == nome, "acertou"].mean())}
        for _, nome in reversed(prev.FORCA) if (forcas == nome).any()
    ]
    por_ano = []
    for ano, x in d.groupby(d.index.year):
        a = x["acertou"].dropna().astype(bool)
        f1, f7 = x["dentro_1"].dropna().astype(bool), x["dentro_7"].dropna().astype(bool)
        if len(a) == 0 and len(f1) == 0:
            continue
        por_ano.append({
            "ano": int(ano), "dias": int(len(a)),
            "acerto": numero(a.mean()) if len(a) else None,
            "sempre_sobe": numero(x.loc[a.index, "subiu"].astype(bool).mean()) if len(a) else None,
            "faixa_1": numero(f1.mean()) if len(f1) else None,
            "faixa_7": numero(f7.mean()) if len(f7) else None,
        })
    return {
        "hoje": previsao_de_hoje(d),
        "por_que": prev.por_que(t, modelo) if modelo else [],
        "modelo": {"desde": f"{modelo['desde']:%Y-%m-%d}", "dias_treino": modelo["dias_treino"]} if modelo else None,
        "regra": {"versao": prev.VERSAO, "cobertura": prev.COBERTURA, "lambda": prev.LAMBDA,
                  "passo": prev.PASSO, "treino": prev.TREINO, "l2": prev.L2},
        "placar": prev.placar(d),
        "teste_desde": desde(d),
        "calibracao": calibracao,
        "por_forca": por_forca,
        "por_ano": por_ano,
        "faixa_contra_real": faixa_contra_real(d, 180),
    }


@app.get("/api/precos")
def precos_do_periodo(periodo: str = "1a"):
    if periodo not in simulador.PERIODOS:
        raise HTTPException(422, f"período desconhecido; use um destes: {', '.join(simulador.PERIODOS)}")
    r = simulador.resumo_periodo(precos(), periodo)
    return {
        "serie": serie(r["serie"]),
        "inicio": f"{r['inicio']:%Y-%m-%d}",
        "preco_inicio": numero(r["preco_inicio"]),
        "fim": f"{r['fim']:%Y-%m-%d}",
        "preco_fim": numero(r["preco_fim"]),
        "variacao": numero(r["variacao"]),
        "maior_dia": f"{r['maior_dia']:%Y-%m-%d}",
        "maior": numero(r["maior"]),
        "menor_dia": f"{r['menor_dia']:%Y-%m-%d}",
        "menor": numero(r["menor"]),
    }


@app.get("/api/velas")
def velas(periodo: str = "3m", escala: str = "dia"):
    if periodo not in simulador.PERIODOS:
        raise HTTPException(422, f"período desconhecido; use um destes: {', '.join(simulador.PERIODOS)}")
    if escala not in simulador.ESCALAS:
        raise HTTPException(422, f"escala desconhecida; use uma destas: {', '.join(simulador.ESCALAS)}")
    precos()  # mesma mensagem de erro se faltar o histórico
    r = simulador.velas(simulador.ler_dias(), periodo, escala)
    return {
        "velas": [
            {"data": f"{d:%Y-%m-%d}", "fim": f"{x.fim:%Y-%m-%d}", "abertura": round(x.abertura, 2),
             "maxima": round(x.maxima, 2), "minima": round(x.minima, 2), "fechamento": round(x.fechamento, 2),
             "variacao": round(x.variacao, 5), "dias": int(x.dias), "aberta": bool(x.aberta)}
            for d, x in r["velas"].iterrows()
        ],
        "subiu": r["subiu"],
        "caiu": r["caiu"],
        "maior_alta_dia": f"{r['maior_alta_dia']:%Y-%m-%d}",
        "maior_alta": numero(r["maior_alta"]),
        "maior_queda_dia": f"{r['maior_queda_dia']:%Y-%m-%d}",
        "maior_queda": numero(r["maior_queda"]),
        "mexida_tipica": numero(r["mexida_tipica"]),
    }


@app.get("/api/limites")
def limites():
    p = precos()
    return {"primeiro": f"{p.index[0]:%Y-%m-%d}", "ultimo": f"{p.index[-1]:%Y-%m-%d}"}


@app.get("/api/simular/compra")
def simular_compra(valor: float, compra: str, venda: str = "hoje"):
    p = precos()
    # "hoje" = o último dia fechado (o dia de hoje só fecha às 21h em Brasília).
    venda = f"{p.index[-1]:%Y-%m-%d}" if venda == "hoje" else venda
    try:
        r = simulador.comprar_e_vender(p, valor, compra, venda)
    except ValueError as erro:
        raise HTTPException(422, str(erro)) from erro
    return {
        "preco_compra": numero(r["preco_compra"]),
        "preco_venda": numero(r["preco_venda"]),
        "dia_compra": f"{r['carteira'].index[0]:%Y-%m-%d}",
        "dia_venda": f"{r['carteira'].index[-1]:%Y-%m-%d}",
        "valor_final": numero(r["valor_final"]),
        "retorno": numero(r["retorno"]),
        "pior_dia": f"{r['pior_dia']:%Y-%m-%d}",
        "pior_valor": numero(r["pior_valor"]),
        "pior_retorno": numero(r["pior_retorno"]),
        "carteira": serie(r["carteira"]),
    }


@app.get("/api/simular/hoje")
def simular_hoje(valor: float):
    c = simulador.cenarios_hoje(precos(), valor)
    for linha in c["prazos"]:
        for grupo in ("todos", "parecidos"):
            if linha[grupo]:
                linha[grupo] = {k: numero(x) for k, x in linha[grupo].items()}
    c["queda_hoje"] = numero(c["queda_hoje"])
    return c


@app.get("/api/simular/vereditos")
def simular_vereditos(valor: float, desde: str):
    try:
        r = simulador.seguir_vereditos(precos(), valor, desde)
    except ValueError as erro:
        raise HTTPException(422, str(erro)) from erro
    return {
        "seguindo": serie(r["seguindo"]),
        "esperando": serie(r["esperando"]),
        "operacoes": r["operacoes"],
        "tempo_comprado": numero(r["tempo_comprado"]),
        "maior_queda_seguindo": numero(r["maior_queda_seguindo"]),
        "maior_queda_esperando": numero(r["maior_queda_esperando"]),
        "comprado_amanha": r["comprado_amanha"],
    }


def para_json(valor):
    """Datas e números do pandas, dentro de dicionários e listas, viram texto e número comuns."""
    if isinstance(valor, dict):
        return {k: para_json(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [para_json(v) for v in valor]
    if isinstance(valor, pd.Timestamp):
        return f"{valor:%Y-%m-%d}"
    if isinstance(valor, str) or valor is None:
        return valor
    return numero(valor)


@app.get("/api/estudo")
def estudo():
    return para_json(simulador.estudo(precos()))


@app.get("/api/guia")
def guia():
    caminho = SAIDAS / "guia.txt"
    if not caminho.exists():
        raise HTTPException(404, "Falta o guia: rode o src\\06_guia.py.")
    return {"texto": caminho.read_text(encoding="utf-8")}


@app.post("/api/atualizar")
def atualizar(pedido: Request):
    """Roda o download da Binance (05), o veredito (07) e a previsão (08), como o rodar_diario.bat.

    Só para quem está no próprio computador: pela internet, ninguém pode mandar ele baixar nada.
    """
    if not neste_computador(pedido):
        raise HTTPException(403, "A busca de preço só pode ser pedida no computador onde o site roda.")
    saida = []
    for script in ("05_historico_binance.py", "07_veredito.py", "08_previsao.py"):
        rodada = subprocess.run(
            [sys.executable, str(PASTA / "src" / script)], cwd=PASTA,
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180,
        )
        saida.append(f"--- {script}\n{rodada.stdout}{rodada.stderr}")
        if rodada.returncode != 0:
            return {"ok": False, "saida": "\n".join(saida)}
    return {"ok": True, "saida": "\n".join(saida)}


# As imagens e relatórios de saidas/ (os gráficos do guia aparecem na tela por aqui).
app.mount("/saidas", StaticFiles(directory=SAIDAS), name="saidas")

# A tela construída. Qualquer endereço que não seja da API devolve o index.html, e o React
# decide o que mostrar.
if TELA.exists():
    app.mount("/assets", StaticFiles(directory=TELA / "assets"), name="assets")

    @app.get("/{caminho:path}")
    def tela(caminho: str):
        arquivo = TELA / caminho
        if caminho and arquivo.is_file() and TELA in arquivo.resolve().parents:
            return FileResponse(arquivo)
        return FileResponse(TELA / "index.html")
