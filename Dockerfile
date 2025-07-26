# Step 1: Use an official Python runtime as a parent image
FROM python:3.11-slim

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Install system dependencies (git and C compiler)
RUN apt-get update && apt-get install -y git build-essential && rm -rf /var/lib/apt/lists/*

# Step 4: Copy only the requirements file first
COPY requirements.txt .

# Step 5: Install the Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# --- YEH NAYA AUR IMPORTANT STEP HAI ---
# Step 6: tree-sitter-python repository ko સીધા download karein
RUN git clone https://github.com/tree-sitter/tree-sitter-python.git

# Step 7: Apne baaki application code ko copy karein
COPY . .

# Step 8: Port ko expose karein
EXPOSE 5000

# Step 9: Application chalaane ke liye command define karein
CMD ["flask", "run", "--host=0.0.0.0"]