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

# --- THIS IS THE FIX ---
# Step 6: Explicitly clone the tree-sitter-python repository
# This guarantees the source files are present for the build.
RUN git clone https://github.com/tree-sitter/tree-sitter-python.git

# Step 7: Copy the rest of your application code into the container
COPY . .

# Step 8: Expose the port the app runs on
EXPOSE 5000

# Step 9: Define the command to run your application
CMD ["flask", "run", "--host=0.0.0.0"]