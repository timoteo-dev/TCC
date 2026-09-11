FROM python:3.11-slim

# Instala dependências de sistema necessárias para o OpenCV no Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala as dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia os arquivos do backend
COPY . .

# Baixa os pesos do modelo buffalo_s durante a construção da imagem
RUN python download_model.py

# O Hugging Face Spaces exige obrigatoriamente escutar na porta 7860
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
