FROM python:3.12-slim

# Türkçe karakter desteği için fontları kur
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# SSL/network hatalarında retry; trusted-host bazı proxy/VPN ortamlarında yardımcı olur
RUN pip install --no-cache-dir --retries 5 --timeout 120 \
    --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org \
    -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
