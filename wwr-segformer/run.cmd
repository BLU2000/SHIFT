@echo off
setlocal
cd /d "%~dp0\.."
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "PYTHONUTF8=1"
"%~dp0.runtime\python\python.exe" "%~dp0batch.py" %*
