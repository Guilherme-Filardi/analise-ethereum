@echo off
rem Veredito diario do ETH: atualiza o historico da Binance, da o veredito do dia (versao 1)
rem e a previsao (versao 2: faixa de preco e chance de subir).
rem Feito para o Agendador de Tarefas do Windows, as 21h30 (o dia da Binance fecha as 21h).
rem Tudo o que os scripts escrevem vai para saidas\log_diario.txt.
cd /d "%~dp0"
set PYTHONUTF8=1
echo ===== %date% %time% >> saidas\log_diario.txt
"..\.venv\Scripts\python.exe" src\05_historico_binance.py >> saidas\log_diario.txt 2>&1
"..\.venv\Scripts\python.exe" src\07_veredito.py >> saidas\log_diario.txt 2>&1
"..\.venv\Scripts\python.exe" src\08_previsao.py >> saidas\log_diario.txt 2>&1
rem Os relatorios sao UTF-8: sem isto, o "type" mostra os acentos trocados.
chcp 65001 >nul
type saidas\veredito_hoje.txt
type saidas\previsao_hoje.txt
