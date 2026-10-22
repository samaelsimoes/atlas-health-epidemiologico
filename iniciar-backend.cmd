@echo off
cd /d "%~dp0"
powershell -NoProfile -Command "try { $atlasResponse=Invoke-WebRequest 'http://127.0.0.1:8085/api/surveillance?source=infodengue' -UseBasicParsing -TimeoutSec 5; if($atlasResponse.StatusCode -eq 200){exit 0} } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
 echo O backend Atlas atualizado ja esta em execucao na porta 8085.
 echo Acesse http://127.0.0.1:5173/#official para ver os dados das APIs.
 pause
 exit /b 0
)
for /d %%J in ("%~dp0.tools\jdk-*") do set "JAVA_HOME=%%~fJ"
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"
cd backend
if exist "..\.tools\apache-maven-3.9.9\bin\mvn.cmd" (
 call "..\.tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run
) else (
 call mvn spring-boot:run
)
pause
