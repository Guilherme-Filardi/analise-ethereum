# Análise Ethereum: como trabalhar aqui

Atualizado em 10/10/2026

Este arquivo é para o Claude Code, na nuvem (claude.ai/code, pelo aplicativo) ou no computador
do Guilherme. Leia inteiro antes de responder.

## Quem conduz

Guilherme Silva Filardi. Engenheiro eletricista, **não é desenvolvedor**. A palavra final é dele.

- Português do Brasil, palavra simples, uma ideia por frase. Termo técnico só explicado na mesma frase.
- Conclusão na primeira linha. Número sempre que der ("o gás médio caiu de 12 para 4 gwei").
- Sem travessão em texto corrido: vírgula ou parênteses.
- Decisão vai em opções a), b), c), a recomendada primeiro, com o que se ganha e o que se perde.
- No fim de toda entrega: o que ele precisa FAZER, o que precisa DECIDIR e os PRÓXIMOS PASSOS
  ("nada" no que estiver vazio).
- Não invente escopo: ele pediu A, faça A e pergunte sobre B.

## Onde este projeto mora

No computador dele, a pasta é `C:\Lab\04 - Analise Ethereum\`. O `C:\Lab` é o laboratório de
Python dele, com vários projetos lado a lado. No GitHub, é o repositório `analise-ethereum`.

**Na nuvem você não enxerga o `C:\Lab`.** Você recebe só uma cópia deste repositório. Tudo que o
projeto precisa tem que estar aqui dentro.

## O Python: uma `.venv` só, e ela já existe

🔴 **Não crie `.venv` (nem `venv`, nem `env`) dentro deste projeto.** O `C:\Lab` tem uma `.venv`
só, em `C:\Lab\.venv\`, que serve a todos os projetos (Python 3.14). Ela já tem `pandas` e
`matplotlib`. A exceção que existe lá (`extrator-eventos-corporativos`, com `.venv` própria) não
vale para cá.

| Onde você roda | Como instala | Como roda |
|---|---|---|
| Na nuvem | `pip install -r requirements.txt` direto no Python da máquina da nuvem, sem criar `.venv`. Ela é descartada no fim da sessão | `python src/01_precos.py` |
| No computador dele | **Nunca `pip install` solto.** Biblioteca nova entra só por `C:\Lab\00 - Ambiente\instalar.bat nome`, que instala na `.venv` do Lab e anota a versão | `cd /d "C:\Lab\04 - Analise Ethereum"` e `"..\.venv\Scripts\python.exe" src\01_precos.py` |

- **Prefira a biblioteca padrão do Python.** Para baixar dado, `urllib.request` + `json` bastam;
  não traga `requests` nem `web3` sem motivo.
- **Biblioteca nova:** anote no `requirements.txt` daqui, com `==` e a versão, e avise o Guilherme
  na resposta: *"rode `instalar.bat nome` no `00 - Ambiente`"*. Sem esse aviso, o script quebra no
  computador dele.

## O Git

Este projeto, ao contrário do resto do Lab, **está no Git e no GitHub, a pedido dele (09/10/2026)**.

- **Na nuvem:** trabalhe no ramo que a sessão criar, faça commits pequenos com mensagem em
  português dizendo o que mudou, dê push e abra um pull request (o pedido para juntar o seu ramo
  ao `main`). **Nunca dê push direto no `main`.** Quem junta é ele, pelo botão do GitHub.
- **No computador dele:** commit e push só quando ele pedir. Para trazer o que a nuvem fez:
  `git pull`, dentro da pasta do projeto.
- Nunca suba chave de API, senha ou arquivo `.env`. O `.gitignore` já barra.
- 🔴 **Sem assinatura do Claude, em lugar nenhum** (pedido dele, 09/10/2026). Nada de
  `Co-Authored-By: Claude`, "Generated with Claude Code", "made by Claude" ou parecido no commit,
  no pull request, no README ou no código. O autor do commit é o Guilherme.

## As travas

1. **Script, só o que ele pediu.** Pedido de gráfico não autoriza reescrever o download.
2. **Nada se apaga.** No computador dele, o que sai vai para `C:\Lab\claude\_to_delete\`. No
   repositório, apagar arquivo só com ok dele.
3. **Dado baixado é dado bruto.** Fica em `dados/` como chegou; conta e limpeza acontecem no
   script, e o resultado nasce em `saidas/`.
4. **Não invente número.** Se a fonte falhar, diga que falhou. Nunca preencha com dado fictício
   sem marcar no nome do arquivo (`exemplo_`) e na resposta.

## A rede da nuvem pode bloquear as fontes

A máquina da nuvem, no modo de rede padrão, só acessa sites de confiança (PyPI, GitHub...). A
CoinGecko e o nó público do Ethereum podem dar erro de conexão. Se der:

1. Não insista nem troque de fonte por conta própria.
2. Escreva o script assim mesmo e teste com um arquivo pequeno de exemplo em `dados/exemplo_*.json`,
   no formato exato que a fonte devolve.
3. Diga a ele que o teste real roda no computador dele (o comando está acima), ou que ele pode
   liberar a rede nas configurações do ambiente do Claude Code na nuvem.

---

## O estudo

**Objetivo:** entender o comportamento do Ethereum (o ETH, a moeda; e a rede, que cobra uma taxa
chamada gás por transação) com dado público e gratuito, sem chave de API. Simples primeiro.

### As fontes (as duas sem chave)

| Fonte | Endereço | O que dá |
|---|---|---|
| CoinGecko | `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=365` | preço, valor de mercado e volume diários do último ano. Limite: ~30 chamadas por minuto, 365 dias sem chave |
| Nós públicos do Ethereum | `https://eth.drpc.org`, `https://eth.merkle.io` e `https://1rpc.io/eth` (JSON-RPC, por POST; o script tenta um depois do outro) | `eth_blockNumber`, `eth_getBlockByNumber`, `eth_feeHistory` (a taxa base de gás dos últimos blocos). O `ethereum-rpc.publicnode.com` saiu em 10/10/2026: sem chave, só entrega ~31 horas de história |
| Binance | `https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1d` (reserva: `https://data-api.binance.vision`, mesmo formato) | fechamento diário do ETH em USDT (≈ dólar) desde 17/08/2017, 1.000 dias por pedido. Escolhida em 10/10/2026 para ter vários ciclos de alta e queda |

### As etapas, uma por script

Cada etapa é um script em `src/`, numerado, que roda sozinho e grava o que produz. Ele pede uma
de cada vez.

| Script | Lê | Grava | O que responde |
|---|---|---|---|
| `src/01_precos.py` | CoinGecko | `dados/precos_eth.csv` | preço, volume e valor de mercado por dia, 365 dias |
| `src/02_analise_precos.py` | `dados/precos_eth.csv` | `saidas/precos.png` e `saidas/resumo_precos.txt` | retorno diário, volatilidade de 30 dias, maior queda a partir de um topo (drawdown), médias móveis de 7 e 30 dias |
| `src/03_gas.py` | nó público (`eth_feeHistory`) | `dados/gas.csv` | taxa base de gás (em gwei) dos últimos ~7 dias de blocos (~50 mil blocos, de 1.024 em 1.024 por chamada) |
| `src/04_analise_gas.py` | `dados/gas.csv` | `saidas/gas_por_hora.png` | o gás é mais barato em qual hora do dia e dia da semana? |
| `src/05_historico_binance.py` | Binance | `dados/eth_diario_binance.csv` | preço diário desde 2017, só dias fechados |
| `src/06_guia.py` | `dados/eth_diario_binance.csv` | `saidas/guia.txt` e `saidas/guia_1..3_*.png` | guia de risco: comprar num dia qualquer (e em dias parecidos com hoje), tudo de uma vez ou por mês, sinais de médias contra comprar e esperar |

O `eth_feeHistory` não traz a hora de cada bloco. Não baixe os 50 mil blocos: pegue a hora do
primeiro e do último com `eth_getBlockByNumber` e distribua entre eles (um bloco a cada ~12 s).
Diga no resumo que a hora é estimada.

Ideias para depois, só se ele pedir: ETH contra BTC (correlação); gás contra preço (a rede fica
mais cara quando o preço sobe?); um HTML simples juntando os gráficos; um teste automático no
GitHub (Actions) como o do `extrator-eventos-corporativos`.

**Próximo, já pedido (10/10/2026):** um veredito diário ("momento bom", "ruim" ou "sem
vantagem" para o dia seguinte), com diário de acertos em `saidas/`, rodando sozinho às 21h30
pelo Agendador de Tarefas do Windows. Regra congelada desde o primeiro dia, e placar histórico
desde 2017 sem espiar o futuro. Vem depois do guia. O ETH contra BTC fica para depois dele.

### Como cada script deve ser

- Curto e lido de cima para baixo: constantes no topo (endereço, número de dias), uma função
  `main()`, sem classe nem configuração que ele não pediu.
- Comentário em português explicando o **porquê**, não o óbvio.
- Caminhos relativos à pasta do projeto (`Path(__file__).parent.parent`), para rodar igual na
  nuvem e no Windows.
- Imprime no fim o que gravou e um número de conferência ("365 dias, de 10/10/2025 a 09/10/2026").
- Lógica com conta (retorno, drawdown, agrupamento por hora) deixa um teste pequeno em
  `testes/test_<nome>.py`, com `assert` sobre dado fixo, que roda com `python -m pytest` ou
  `python testes/test_<nome>.py`.
- `dados/` e `saidas/` vão para o Git (são pequenos, e o resultado fica visível no GitHub).

### A primeira tarefa

Se ele abrir a sessão sem dizer nada além de "comece", faça só o `src/01_precos.py` e o
`src/02_analise_precos.py`, rode, confira os números e abra o pull request com o gráfico.
