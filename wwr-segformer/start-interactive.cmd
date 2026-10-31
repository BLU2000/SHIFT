@echo off
setlocal
cd /d "%~dp0"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "PYTHONUTF8=1"
echo Open http://127.0.0.1:8765 in your browser.
echo Keep this window open while using Detect. Ctrl+C stops the local service.
".runtime\python\python.exe" interactive_server.py
pause
