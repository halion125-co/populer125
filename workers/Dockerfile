FROM python:3.11-slim

# Playwright 의존 시스템 패키지 + Xvfb (가상 디스플레이)
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-6 libx11-xcb1 libxcb1 libxext6 \
    fonts-noto-cjk wget \
    xvfb x11-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright chromium 설치
RUN playwright install chromium

COPY . .

ENV PYTHONUNBUFFERED=1
ENV WORKER_PORT=8100
ENV DISPLAY=:99

EXPOSE 8100

# Xvfb 가상 디스플레이를 띄운 뒤 worker 서버 실행
CMD Xvfb :99 -screen 0 1920x1080x24 -ac & sleep 1 && python worker_server.py
