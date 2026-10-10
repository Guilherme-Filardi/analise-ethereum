# Análise Ethereum

Estudo simples do Ethereum com dado público e gratuito, sem chave de API. Responde quatro
perguntas:

1. Como o preço do ETH (a moeda) se comportou no último ano?
2. Em qual hora do dia e dia da semana a taxa da rede (o **gás**) fica mais barata?
3. Qual o risco de comprar ETH, e qual o melhor jeito de comprar, olhando o passado desde 2017?
4. Hoje é um bom momento? Um **veredito diário** que é conferido no dia seguinte e monta um
   placar de acertos.

Não é recomendação de investimento: é estudo com dado do passado.

O plano das etapas e as regras de trabalho estão no [`CLAUDE.md`](CLAUDE.md).

---

## O resultado (rodado em 10/10/2026)

### Preço do ETH, 365 dias

![Preço do ETH](saidas/precos.png)

- Caiu de US$ 3.841,67 para US$ 2.493,78 no período (-35,1%).
- A maior queda a partir de um topo foi de -63,1%: de US$ 4.245,45 (14/10/2025) a
  US$ 1.566,01 (26/06/2026).
- A volatilidade de 30 dias (quanto o preço chacoalha, em escala de um ano) está em 45%. A
  média do ano foi 60%.
- Resumo completo: [`saidas/resumo_precos.txt`](saidas/resumo_precos.txt).

### Gás por hora e dia da semana, 7 dias (02/10 a 09/10/2026)

![Gás por hora](saidas/gas_por_hora.png)

- Das 9h às 17h (Brasília) o gás custou 3,6 vezes mais que no resto do dia (mediana de
  0,436 contra 0,122 gwei).
- A hora mais cara foi 13h (1,321 gwei), igual nos 5 dias úteis. 13h em Brasília é 16h em
  UTC, quando o mercado dos EUA está aberto e a Europa ainda trabalha.
- O sábado saiu quase 5 vezes mais barato que a terça (0,076 contra 0,373 gwei).
- Cuidado: é uma semana só, então cada dia da semana aparece uma vez. É pista, não regra.

### Guia de risco e jeitos de comprar (17/08/2017 a 09/10/2026)

Relatório completo: [`saidas/guia.txt`](saidas/guia.txt).

![Comprar num dia qualquer](saidas/guia_1_comprar_qualquer_dia.png)

- Comprar num dia qualquer foi quase cara ou coroa: em 12 meses, 47% das compras terminaram
  no prejuízo. Metade rendeu mais que +9%; o pior caso foi -92% e o melhor, +2.147%.
- Mesmo nos casos comuns, a compra chegou a cair ~38% em algum momento do ano ("susto típico").
- Nos dias parecidos com hoje (preço de 38% a 58% abaixo do recorde), 58% das compras estavam
  no prejuízo 12 meses depois. Mas isso vem de só 2 ou 3 grandes quedas (2018 e 2022).

![Tudo de uma vez ou por mês](saidas/guia_2_aporte.png)

- Comprar um pouco por mês ganhou só em 38% das vezes, e o valor típico saiu igual
  (US$ 1.122 contra US$ 1.118). O que muda são os extremos: no pior caso, US$ 283 contra
  US$ 102; no melhor, US$ 6.881 contra US$ 14.490. É um cinto de segurança, não um atalho.

![Sinais de médias móveis](saidas/guia_3_sinais.png)

- O sinal de médias de 7 e 30 dias transformou US$ 1.000 em US$ 21.813, contra US$ 2.868 de
  comprar e esperar. Quase tudo veio de ter saído antes dos tombos de 2018 e 2022. Na segunda
  metade do período (2022 a 2026), perdeu de comprar e esperar (+82% contra +137%). Imposto
  e custo de cada operação ficaram de fora.

### Veredito diário

O veredito de hoje fica em [`saidas/veredito_hoje.txt`](saidas/veredito_hoje.txt) e o
diário com todos os vereditos e acertos, em
[`saidas/diario_veredictos.csv`](saidas/diario_veredictos.csv).

- Placar histórico da regra, de 2017 a 2026, sem espiar o futuro: 51,5% de acerto em 660
  dias com veredito, contra 49,1% de quem dissesse "sobe" nesses mesmos dias. A diferença é
  pequena, do tamanho que a sorte explica. O diário vai mostrar se ela se repete ao vivo.

---

## Como funciona

O projeto é uma linha de montagem com 7 scripts. Os scripts **ímpares buscam** dado na
internet e guardam do jeito que chegou (o 7 é a exceção: só calcula). Os **pares calculam**
e desenham.

```
Internet                 dados/ (bruto)               saidas/ (resultado)
CoinGecko  ── 01 ──>  precos_eth.csv         ── 02 ──>  precos.png + resumo_precos.txt
Nós do ETH ── 03 ──>  gas.csv                ── 04 ──>  gas_por_hora.png
Binance    ── 05 ──>  eth_diario_binance.csv ── 06 ──>  guia.txt + guia_1..3.png
                                             ── 07 ──>  veredito_hoje.txt + diario_veredictos.csv
```

Separar buscar de calcular tem dois ganhos. Os scripts 2 e 4 rodam sem internet, quantas
vezes quiser. E se uma conta estiver errada, o dado original continua intacto para refazer.

### 1. Busca o preço (`src/01_precos.py`)

- Faz um pedido à CoinGecko: "me dá 365 dias do ETH em dólar".
- Recebe três listas de pares (hora, valor): preço, valor de mercado e volume negociado.
- Junta as três numa tabela pela hora e grava `dados/precos_eth.csv` (366 linhas: uma por
  dia, mais o preço da hora em que rodou).
- Se a internet falhar, avisa e não grava nada.

### 2. Analisa o preço (`src/02_analise_precos.py`)

- Fica com um preço por dia: o da meia-noite UTC (21h do dia anterior em Brasília). No
  último dia, vale o preço da hora da consulta.
- Calcula:
  - **retorno diário:** quanto subiu ou caiu de um dia para o outro;
  - **médias de 7 e 30 dias:** suavizam o sobe e desce e mostram a tendência;
  - **volatilidade de 30 dias:** o desvio padrão do retorno diário em 30 dias, vezes a raiz
    de 365 (o ETH negocia todo dia), para ficar em escala de um ano;
  - **maior queda a partir de um topo (drawdown):** o pior tombo, do pico até o fundo seguinte.
- Grava `saidas/precos.png` (3 painéis) e `saidas/resumo_precos.txt`.

### 3. Busca o gás (`src/03_gas.py`)

- Conversa com um **nó**: um computador que guarda a cópia da rede do Ethereum. A conversa
  é por JSON-RPC (um pedido em texto, enviado por POST).
- Pergunta o número do último bloco (`eth_blockNumber`) e volta no tempo pedindo a taxa
  base (`eth_feeHistory`), 1.024 blocos por pedido. São ~50 pedidos para 50.400 blocos
  (7 dias, um bloco a cada 12 s).
- Tem três nós na lista (`eth.drpc.org`, `eth.merkle.io`, `1rpc.io/eth`). Se um recusar,
  tenta o seguinte. O `ethereum-rpc.publicnode.com` saiu porque, sem chave, só entrega ~31
  horas de história.
- O nó não diz a hora de cada bloco. O script pega a hora real só do primeiro e do último
  bloco (`eth_getBlockByNumber`) e espalha os do meio por igual. Por isso a hora é
  **estimada** (o erro é de segundos).
- Grava `dados/gas.csv`: bloco, hora estimada (UTC), taxa base em gwei e quanto o bloco
  ficou cheio (de 0 a 1).

### 4. Analisa o gás (`src/04_analise_gas.py`)

- Passa a hora para Brasília: UTC menos 3 horas. É uma conta fixa, porque o Brasil não tem
  horário de verão desde 2019.
- Separa os blocos por hora do dia (0h a 23h) e por dia da semana, e pega a **mediana** de
  cada grupo.
- Usa a mediana (o valor do meio) e não a média: poucos momentos de rede congestionada
  chegam a 90 vezes o normal e puxariam a média para cima.
- Grava `saidas/gas_por_hora.png`.

### 5. Busca o histórico desde 2017 (`src/05_historico_binance.py`)

- Pede à Binance o fechamento diário do par ETH/USDT desde 17/08/2017, 1.000 dias por
  pedido (4 pedidos). O USDT é uma moeda digital presa ao dólar.
- Cada "dia" da Binance vai da meia-noite à meia-noite em UTC: fecha às 21h em Brasília.
  O dia de hoje, ainda aberto, fica de fora.
- Se o endereço principal falhar, tenta o espelho oficial (`data-api.binance.vision`).
- Grava `dados/eth_diario_binance.csv`.

### 6. O guia de risco (`src/06_guia.py`)

Três perguntas, todas respondidas com o preço real do passado:

1. **Se eu comprasse num dia qualquer, como estaria 1, 3, 6 e 12 meses depois?** Para cada dia
   do histórico, mede o retorno depois do prazo e o "susto no caminho" (o quanto a compra
   chegou a ficar no vermelho antes do prazo). Repete só para os dias parecidos com hoje:
   preço a até 10 pontos da distância do recorde de hoje.
2. **Tudo de uma vez ou um pouco por mês?** Simula US$ 1.000 dos dois jeitos (de uma vez, ou
   1/12 por mês durante 12 meses), começando em cada mês desde 2017.
3. **Os sinais de médias móveis ganham de comprar e esperar?** Testa ficar comprado só quando
   a média curta está acima da longa (7 e 30 dias; 50 e 200 dias), com taxa de 0,1% por
   operação, e repete em cada metade do período para ver se foi sorte.

O sinal de um dia só vale a partir do dia seguinte (um teste garante isso), para não usar
um preço que ainda não se conhecia.

### 7. O veredito diário (`src/07_veredito.py`)

- Olha 3 coisas do último dia fechado: a **tendência** (média de 7 dias acima ou abaixo da
  de 30), a **distância do recorde** (0-10%, 10-30%, 30-50%, 50%+) e a **última semana**
  (subiu ou caiu).
- Procura no passado os dias com as mesmas 3 coisas e vê em quantos deles o dia seguinte subiu.
- **Momento bom:** subiu em 55% ou mais. **Momento ruim:** 45% ou menos. **Sem vantagem:**
  entre os dois, ou com menos de 30 dias parecidos.
- Anota o veredito no diário e, no dia seguinte, confere: acertou ou não. "Sem vantagem" não
  entra no placar.
- A regra é **congelada** (versão 1, de 10/10/2026). Mudar a regra depois de ver os erros
  seria decorar a prova.
- Dia em que o computador ficou desligado fica de fora do diário: anotar depois, já sabendo o
  resultado, não seria um veredito de verdade.
- Mostra dois placares: o **ao vivo** (do diário) e o **histórico** (a mesma regra aplicada
  dia a dia desde 2017, só com o que se sabia em cada dia). Os dois são comparados com dizer
  "sobe" todo dia, que é o mínimo que a regra precisa ganhar.

### Glossário rápido

| Termo | O que é |
|---|---|
| ETH | A moeda da rede Ethereum |
| Gás | A taxa paga para a rede processar uma transação |
| Taxa base | A parte mínima do gás, igual para todos no mesmo bloco. Sobe quando o bloco anterior ficou mais da metade cheio e cai quando ficou menos, no máximo 12,5% por bloco |
| gwei | Unidade do gás: 1 gwei = 0,000000001 ETH |
| Bloco | Um pacote de transações. Sai um a cada 12 segundos |
| UTC | O horário de referência mundial. Brasília = UTC menos 3 horas |
| USDT | Moeda digital presa ao dólar (1 USDT ≈ US$ 1) |
| Média móvel | A média dos últimos N dias, recalculada a cada dia. Alisa o sobe e desce |
| Recorde (topo) | O maior preço de fechamento visto até aquele dia |

---

## Como montar o ambiente

O projeto precisa de **Python 3.11 ou mais novo** e de duas bibliotecas, listadas em
[`requirements.txt`](requirements.txt) com a versão travada:

| Biblioteca | Para que serve |
|---|---|
| `pandas` | tabela e conta (médias, medianas, agrupamentos) |
| `matplotlib` | gráficos |

O resto (baixar da internet, ler JSON) vem pronto no Python.

### No computador do Guilherme (dentro do `C:\Lab`)

O `C:\Lab` tem um Python só para todos os projetos, em `C:\Lab\.venv\`, e ele já tem as
duas bibliotecas. Não crie outro dentro desta pasta.

1. Baixar o projeto (só na primeira vez):
   ```
   cd /d "C:\Lab"
   git clone https://github.com/Guilherme-Filardi/analise-ethereum "04 - Analise Ethereum"
   ```
2. Trazer o que mudou no GitHub (das outras vezes):
   ```
   cd /d "C:\Lab\04 - Analise Ethereum"
   git pull
   ```
3. Biblioteca nova entra só por `C:\Lab\00 - Ambiente\instalar.bat nome`, nunca com
   `pip install` solto.

### Em outro computador

1. Instalar o Python 3.11 ou mais novo ([python.org](https://www.python.org/downloads/)).
   No Windows, marque a caixa "Add Python to PATH" na instalação.
2. Baixar o projeto:
   ```
   git clone https://github.com/Guilherme-Filardi/analise-ethereum
   cd analise-ethereum
   ```
3. Instalar as bibliotecas:
   ```
   pip install -r requirements.txt
   ```
4. Opcional, para rodar os testes com `pytest`: `pip install pytest`. Sem ele, os testes
   também rodam um por um (veja abaixo).

---

## Como rodar

Os 7 scripts, em sequência. O 1, o 3 e o 5 precisam de internet; os outros, não.

**No `C:\Lab`:**
```
cd /d "C:\Lab\04 - Analise Ethereum"
"..\.venv\Scripts\python.exe" src\01_precos.py
"..\.venv\Scripts\python.exe" src\02_analise_precos.py
"..\.venv\Scripts\python.exe" src\03_gas.py
"..\.venv\Scripts\python.exe" src\04_analise_gas.py
"..\.venv\Scripts\python.exe" src\05_historico_binance.py
"..\.venv\Scripts\python.exe" src\06_guia.py
"..\.venv\Scripts\python.exe" src\07_veredito.py
```

**Em outro computador** (dentro da pasta do projeto):
```
python src/01_precos.py
python src/02_analise_precos.py
python src/03_gas.py
python src/04_analise_gas.py
python src/05_historico_binance.py
python src/06_guia.py
python src/07_veredito.py
```

### O veredito sozinho, todo dia (Agendador de Tarefas do Windows)

O arquivo `rodar_diario.bat` roda o 5 (atualiza o histórico) e o 7 (dá o veredito). Tudo o
que eles escrevem vai para `saidas\log_diario.txt`, que fica só no computador (fora do Git).

Para agendar às 21h30 todo dia (o dia da Binance fecha às 21h), uma vez só:
```
schtasks /create /tn "Analise Ethereum - veredito" /tr "\"C:\Lab\04 - Analise Ethereum\rodar_diario.bat\"" /sc daily /st 21:30
```
Para rodar na hora, sem esperar: `schtasks /run /tn "Analise Ethereum - veredito"`.
Para tirar o agendamento: `schtasks /delete /tn "Analise Ethereum - veredito" /f`.

O diário fica no computador. Para ele aparecer no GitHub, de vez em quando:
```
cd /d "C:\Lab\04 - Analise Ethereum"
git add dados saidas
git commit -m "Diário de vereditos atualizado"
git push
```

Cada script imprime no fim o que gravou e um número de conferência, por exemplo
`366 pontos, de 11/10/2025 a 10/10/2026` ou `Hora de cada bloco ESTIMADA: 12,0 s por bloco em média`.

### Testar sem internet

Os arquivos `exemplo_*` são **dado inventado**, no formato exato das fontes, para testar os
scripts sem rede. Tudo que sai deles também ganha `exemplo_` no nome, e os gráficos avisam
"EXEMPLO (dado fictício)" no título.
```
cd /d "C:\Lab\04 - Analise Ethereum"
"..\.venv\Scripts\python.exe" src\01_precos.py dados\exemplo_coingecko.json
"..\.venv\Scripts\python.exe" src\02_analise_precos.py dados\exemplo_precos_eth.csv
"..\.venv\Scripts\python.exe" src\03_gas.py dados\exemplo_gas_rpc.json
"..\.venv\Scripts\python.exe" src\04_analise_gas.py dados\exemplo_gas.csv
"..\.venv\Scripts\python.exe" src\05_historico_binance.py dados\exemplo_binance_rpc.json
"..\.venv\Scripts\python.exe" src\06_guia.py dados\exemplo_eth_diario_binance.csv
"..\.venv\Scripts\python.exe" src\07_veredito.py dados\exemplo_eth_diario_binance.csv
```

### Conferir as contas (testes)

São 22 testes com números pequenos e conta feita à mão. Se alguém mudar uma conta e
quebrar, eles avisam.
```
cd /d "C:\Lab\04 - Analise Ethereum"
"..\.venv\Scripts\python.exe" -m pytest testes
```
Sem `pytest`, um arquivo por vez:
```
cd /d "C:\Lab\04 - Analise Ethereum"
"..\.venv\Scripts\python.exe" testes\test_analise_precos.py
"..\.venv\Scripts\python.exe" testes\test_gas.py
"..\.venv\Scripts\python.exe" testes\test_analise_gas.py
"..\.venv\Scripts\python.exe" testes\test_guia.py
"..\.venv\Scripts\python.exe" testes\test_veredito.py
```

---

## Se der erro

| Mensagem | O que quer dizer | O que fazer |
|---|---|---|
| `can't open file ... src\01_precos.py` | O script não está na pasta | `git pull` para trazer a versão do GitHub |
| `Falhou o download da CoinGecko (...)` | A CoinGecko não respondeu ou limitou (~30 pedidos por minuto) | Esperar um minuto e rodar de novo. Nada foi gravado, o CSV antigo continua lá |
| `Falhou o download (todos os nós falharam ...)` | Os três nós recusaram. A mensagem mostra o motivo de cada um | Rodar de novo mais tarde. Se um nó mudar de regra, ele sai da lista `NOS`, no topo do `src/03_gas.py` |
| `Falhou o download (todos os endereços falharam ...)` | A Binance não respondeu nos dois endereços | Rodar de novo mais tarde. Nada foi gravado |
| `ATENÇÃO: o último dia do dado é ...` | O histórico está velho (a etapa 5 falhou ou não rodou) | Rodar o `src\05_historico_binance.py` e depois o `07` de novo |
| `No module named pandas` (ou `matplotlib`) | O Python usado não tem as bibliotecas | No `C:\Lab`, use o `"..\.venv\Scripts\python.exe"`. Fora dele, `pip install -r requirements.txt` |

---

## Organização das pastas

| Pasta | O que tem |
|---|---|
| `src/` | Os 7 scripts, numerados na ordem em que rodam |
| `dados/` | O dado bruto, do jeito que veio da fonte (e os `exemplo_*`) |
| `saidas/` | Gráficos e resumos. Nascem dos scripts; não edite à mão |
| `testes/` | Os testes das contas |
| `rodar_diario.bat` | Roda o veredito do dia; é o que o Agendador do Windows chama |

Cada script acha as pastas a partir de onde ele mesmo está. Por isso o mesmo código roda
igual no Windows, no Linux e no Mac.
