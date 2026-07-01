# Node + Python in one image so `exec("python ...")` works
FROM node:20-slim

# Install Python + pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Make `python` resolve to python3
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# ── Python deps ───────────────────────────────────────────────
COPY python/requirements.txt ./python/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r python/requirements.txt

# ── Node deps ─────────────────────────────────────────────────
COPY package*.json ./
RUN npm install

# ── App code ──────────────────────────────────────────────────
COPY . .

# ── Prisma client generation ──────────────────────────────────
RUN npx prisma generate

EXPOSE 5000

# Migrate on start, then run the app
CMD sh -c "npx prisma migrate deploy && node index.js"