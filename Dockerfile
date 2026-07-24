# Use Node.js 22 Debian-based slim image
FROM node:22-slim

# Install Python 3, pip, venv, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy dependency manifests
COPY package.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install Node.js dependencies
RUN npm install
RUN cd frontend && npm install
RUN cd backend && npm install

# Copy Python requirements and install in a virtual environment
COPY backend/requirements.txt ./backend/
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt

# Copy all source files
COPY . .

# Build the React frontend
RUN cd frontend && npm run build

# Expose port (Express runs on PORT env var, defaults to 5001 or Railway's assigned port)
EXPOSE 5001

# Start the application
CMD ["node", "backend/server.js"]
