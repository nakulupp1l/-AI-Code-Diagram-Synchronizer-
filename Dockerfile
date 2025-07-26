# Step 1: Use an official Python runtime as a parent image
FROM python:3.11-slim

# Step 2: Set the working directory inside the container
WORKDIR /app

# Step 3: Install system dependencies needed for tree-sitter compilation
RUN apt-get update && apt-get install -y git build-essential && rm -rf /var/lib/apt/lists/*

# Step 4: Copy the requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Step 5: Copy the rest of your application code into the container
COPY . .

# Step 6: Expose the port the app runs on
EXPOSE 5000

# Step 7: Define the command to run your application
CMD ["flask", "run", "--host=0.0.0.0"]