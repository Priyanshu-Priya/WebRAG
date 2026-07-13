FROM python:3.12-slim

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies needed for compiling python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Remove heavy packages that are not needed for cloud-based embeddings
# onnxruntime is installed by chromadb but unused (we provide our own embeddings)
# This saves ~300MB of RAM at startup
RUN pip uninstall -y onnxruntime 2>/dev/null || true

# Copy codebase
COPY . ./backend/

# Expose port
EXPOSE 8000

# Start app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
