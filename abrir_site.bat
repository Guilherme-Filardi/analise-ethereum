@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Analise Ethereum - site

REM Abre o site da analise numa janela so, como o abrir_papel.bat do PAPEL.
REM A API (porta 8010) entrega a tela construida (site\dist) e as contas em /api.
REM A API escuta so neste computador (127.0.0.1). Quem abre para a internet e o Tailscale Funnel:
REM ele recebe as visitas no link publico e repassa para ca. Se o Tailscale nao estiver
REM instalado, o site abre so neste computador. O passo a passo esta no README ("Abrir para a internet").
REM Portas fora das do PAPEL (5173, 4173 e 8000): os dois podem ficar abertos juntos.
REM A tela se reconstroi quando algum arquivo dela e mais novo que o site\dist\index.html.

set "PY=..\.venv\Scripts\python.exe"
set "PYTHONUTF8=1"
set "LOGS=%TEMP%\AnaliseEthereum"
set "LOG_API=%LOGS%\api.log"
set "LOG_BUILD=%LOGS%\build.log"

if not exist "%PY%" (
    echo.
    echo   Nao achei o Python do Lab em C:\Lab\.venv.
    echo   Esta pasta precisa estar dentro do C:\Lab.
    echo.
    pause
    exit /b 1
)
"%PY%" -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Falta o fastapi ou o uvicorn no Python do Lab.
    echo   No "C:\Lab\00 - Ambiente", rode:  instalar.bat fastapi   e   instalar.bat uvicorn
    echo.
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo   O Node.js nao esta instalado neste computador: falta o npm.
    echo   Instale em https://nodejs.org e abra este de novo.
    echo.
    pause
    exit /b 1
)
if not exist "%LOGS%" mkdir "%LOGS%"

echo.
echo   Abrindo o site da analise...
call :liberar 8010

if not exist "site\node_modules" (
    echo   Primeira vez neste computador: instalando a tela, uns minutos...
    pushd site
    call npm install --no-fund --no-audit >"%LOGS%\npm_install.log" 2>&1
    if errorlevel 1 (
        popd
        echo.
        echo   O npm install falhou. O que ele disse esta em:
        echo     %LOGS%\npm_install.log
        echo.
        pause
        exit /b 1
    )
    popd
)

powershell -NoProfile -Command "$d='site\dist\index.html'; if(-not (Test-Path $d)){ exit 1 }; $t=(Get-Item $d).LastWriteTimeUtc; $f=@(Get-ChildItem 'site\src' -Recurse -File) + @(Get-Item 'site\index.html','site\package.json','site\vite.config.ts' -ErrorAction SilentlyContinue); if(@($f | Where-Object { $_.LastWriteTimeUtc -gt $t }).Count){ exit 1 }; exit 0"
if errorlevel 1 (
    echo   A tela mudou desde a ultima vez: reconstruindo, uns segundos...
    pushd site
    call npm run build >"%LOG_BUILD%" 2>&1
    if errorlevel 1 (
        popd
        echo.
        echo   Nao consegui construir a tela. O que o build disse esta em:
        echo     %LOG_BUILD%
        echo.
        pause
        exit /b 1
    )
    popd
)

start "" /b cmd /c ..\.venv\Scripts\python.exe -m uvicorn api.servidor:app --host 127.0.0.1 --port 8010 ^<nul ^>"%LOG_API%" 2^>^&1

powershell -NoProfile -Command "function ok($u){ curl.exe -sf -o NUL --max-time 2 --noproxy '*' $u; $LASTEXITCODE -eq 0 }; $api=$false; $limite=(Get-Date).AddSeconds(60); while(-not $api -and (Get-Date) -lt $limite){ $api=ok 'http://127.0.0.1:8010/api/saude'; if(-not $api){ Start-Sleep -Milliseconds 300 } }; if(-not $api){ exit 2 }; Write-Host '  Site no ar: http://127.0.0.1:8010'; Start-Process 'http://127.0.0.1:8010'"
if errorlevel 2 goto api_nao_subiu

REM O link da internet (Tailscale Funnel), se o Tailscale estiver instalado.
set "TS="
where tailscale >nul 2>&1 && set "TS=tailscale"
if not defined TS if exist "%ProgramFiles%\Tailscale\tailscale.exe" set "TS=%ProgramFiles%\Tailscale\tailscale.exe"
if not defined TS (
    echo.
    echo   O Tailscale nao esta instalado: o site abre so neste computador.
    echo   Para abrir pela internet, veja "Abrir para a internet" no README.
    goto esperar
)
echo.
echo   Ligando o link da internet ^(Tailscale Funnel^)...
"%TS%" funnel --bg 8010
if errorlevel 1 (
    echo.
    echo   Nao consegui ligar o link da internet. O site segue so neste computador.
    echo   Primeira vez? Siga "Abrir para a internet" no README ^(passo 3^).
    goto esperar
)
powershell -NoProfile -Command "$nome=(& $env:TS status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.'); $link='https://'+$nome; Set-Clipboard $link; Write-Host ''; Write-Host '  Link para mandar (ja copiado, e so colar):'; Write-Host ('    '+$link)"

:esperar
echo.
echo   Deixe esta janela aberta enquanto usa o site.
echo   Fechar esta janela desliga o site.
echo   Para desligar por aqui, aperte Q ou Ctrl + C.
echo.
powershell -NoProfile -Command "[Console]::TreatControlCAsInput=$true; do { $k=[Console]::ReadKey($true) } until ($k.Key -eq 'Q' -or ($k.Key -eq 'C' -and ($k.Modifiers -band 4)))"
if errorlevel 1 pause >nul
echo   Desligando...
if defined TS "%TS%" funnel reset >nul 2>&1
call :desligar
echo   Site desligado. O link da internet parou e a porta 8010 esta livre.
ping -n 3 127.0.0.1 >nul
exit /b 0

:api_nao_subiu
echo.
echo   A API nao respondeu em 60 s. O que ela disse esta em:
echo     %LOG_API%
call :desligar
echo.
echo   Desliguei o que tinha subido. Aperte uma tecla para fechar.
pause >nul
exit /b 1

:liberar
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%1 .*LISTENING"') do call :fechar %1 %%p
exit /b 0

:fechar
set "NOME="
for /f "tokens=1 delims=," %%n in ('tasklist /fi "PID eq %2" /nh /fo csv 2^>nul ^| findstr /i /c:".exe"') do set "NOME=%%~n"
if not defined NOME exit /b 0
taskkill /pid %2 /t /f >nul 2>&1
echo   A porta %1 estava ocupada por %NOME%, PID %2, resto de outra rodada. Fechei.
exit /b 0

:desligar
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":8010 .*LISTENING"') do taskkill /pid %%p /t /f >nul 2>&1
exit /b 0
