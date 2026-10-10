# Análise Ethereum

Estudo simples do Ethereum com dado público e gratuito, sem chave de API: o preço do ETH no
último ano (CoinGecko) e a taxa de gás da rede (nó público do Ethereum).

O plano das etapas e as regras de trabalho estão no [`CLAUDE.md`](CLAUDE.md).

## Rodar no Windows (dentro do `C:\Lab`)

```
cd /d "C:\Lab\04 - Analise Ethereum"
"..\.venv\Scripts\python.exe" src\01_precos.py
```

## Rodar em outro lugar

```
pip install -r requirements.txt
python src/01_precos.py
```
