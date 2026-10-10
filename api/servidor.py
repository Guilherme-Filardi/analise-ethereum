"""API do site da análise: faz as contas em Python e entrega em JSON para a tela (React).

Também entrega a própria tela já construída (site/dist), para tudo abrir numa porta só:
http://127.0.0.1:8010. Quem liga é o abrir_site.bat.

Ligar à mão, da pasta do projeto:
    "..\\.venv\\Scripts\\python.exe" -m uvicorn api.servidor:app --host 127.0.0.1 --port 8010
"""

import subprocess
import sys
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, str(Path(__file__).parent))
import simulador  # noqa: E402 (precisa do caminho acima)

PASTA = Path(__file__).parent.parent
SAIDAS = PASTA / "saidas"
TELA = (PASTA / "site" / "dist").resolve()
DIARIO = SAIDAS / "diario_veredictos.csv"

app = FastAPI(title="Análise Ethereum", docs_url=None, redoc_url=None)


def numero(valor):
    """Número do pandas ou do numpy vira número comum do Python (o JSON não aceita os outros)."""
    return None if pd.isna(valor) else float(valor)


def serie(valores):
    """Série com data no índice vira uma lista [{data, valor}] para o gráfico."""
    return [{"data": f"{d:%Y-%m-%d}", "valor": round(float(v), 2)} for d, v in valores.items()]


def precos():
    if not simulador.HISTORICO.exists():
        raise HTTPException(503, "Falta o histórico: rode o src\\05_historico_binance.py.")
    return simulador.ler_precos()


@app.get("/api/saude")
def saude():
    return {"ok": True}


@app.get("/api/hoje")
def hoje():
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
        "ultimos_90_dias": serie(p.iloc[-90:]),
    }


@app.get("/api/diario")
def diario():
    if not DIARIO.exists():
        return []
    tabela = pd.read_csv(DIARIO, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    return tabela.iloc[::-1].to_dict(orient="records")  # o mais recente em cima


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
def atualizar():
    """Roda o download da Binance (05) e o veredito (07), como o rodar_diario.bat."""
    saida = []
    for script in ("05_historico_binance.py", "07_veredito.py"):
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
