@echo off
title 🇰🇭 KHMER HELP KHMER - Server and Bot
echo ============================================================
echo 🇰🇭 Starting Khmer Help Khmer Platform...
echo ============================================================

REM Check if .env exists, if not copy from .env.example
if not exist .env (
    echo [Setup] Creating .env from .env.example...
    copy .env.example .env
)

REM Run application
node src/index.js
pause
