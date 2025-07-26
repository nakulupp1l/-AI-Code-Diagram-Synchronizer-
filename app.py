import os
import re
import json
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

# For Advanced Code Analysis (RAG)
from tree_sitter import Language, Parser
import sentence_transformers
import faiss
import numpy as np

# --- Configuration ---
load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# --- Flask App Initialization ---
app = Flask(__name__)

# --- Tree-sitter and RAG Setup ---
Language.build_library('build/my-languages.so', ['tree-sitter-python'])
PYTHON_LANGUAGE = Language('build/my-languages.so', 'python')
parser = Parser()
parser.set_language(PYTHON_LANGUAGE)
embedding_model = sentence_transformers.SentenceTransformer('all-MiniLM-L6-v2')

# --- Helper Functions ---
def get_code_chunks(code_content):
    tree = parser.parse(bytes(code_content, "utf8"))
    root_node = tree.root_node
    chunks = []
    query = PYTHON_LANGUAGE.query("[(function_definition) @func (class_definition) @class]")
    captures = query.captures(root_node)
    for node, _ in captures:
        chunks.append(node.text.decode('utf8'))
    if not chunks:
        chunks.append(code_content)
    return chunks

def build_mermaid_from_json(graph_data):
    try:
        if not isinstance(graph_data, dict) or "nodes" not in graph_data or "edges" not in graph_data:
            return "graph TD\n  A[Error: Invalid JSON structure from AI]"
        mermaid_string = "graph TD\n"
        shapes = {"rect": "[{}]", "rhombus": "{{{}}}", "stadium": "([{}])", "round": "({})"}
        for node in graph_data.get("nodes", []):
            node_id = node.get("id", "error")
            node_text = json.dumps(node.get("text", ""))
            node_shape = shapes.get(node.get("shape", "rect"), "[{}]")
            mermaid_string += f'    {node_id}{node_shape.format(node_text)}\n'
        for edge in graph_data.get("edges", []):
            from_node = edge.get("from", "error")
            to_node = edge.get("to", "error")
            label = edge.get("label")
            if label:
                mermaid_string += f'    {from_node} -- "{label}" --> {to_node}\n'
            else:
                mermaid_string += f'    {from_node} --> {to_node}\n'
        return mermaid_string
    except Exception as e:
        return f"graph TD\n  A[Error building diagram from AI response: {e}]"

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/process', methods=['POST'])
def process():
    action = request.form.get('action')
    model = genai.GenerativeModel("gemini-1.5-flash")
    
    if action == 'generate_diagram':
        code_files = request.files.getlist('code_files')
        if not code_files: return jsonify({'error': 'No code file uploaded.'}), 400
        full_code = "\n".join([f.read().decode('utf-8') for f in code_files])
        prompt = f"""
        Analyze the following Python code and convert it into a JSON object representing a flowchart. The JSON must have "nodes" and "edges" keys.
        - "nodes": list of objects with "id", "text", and "shape" ('rect', 'rhombus', 'stadium', 'round').
        - "edges": list of objects with "from", "to", and optional "label".
        Your response must be ONLY the JSON object, enclosed in ```json ... ```.

        Python Code:
        ```python
        {full_code}
        ```
        """
        response = model.generate_content(prompt)
        raw_json_text = response.text.strip()
        
        clean_json_string = raw_json_text
        match = re.search(r"```(?:json)?(.*)```", raw_json_text, re.DOTALL)
        if match: clean_json_string = match.group(1).strip()
        
        try:
            graph_data = json.loads(clean_json_string)
            final_mermaid_code = build_mermaid_from_json(graph_data)
            return jsonify({'diagram': final_mermaid_code})
        except json.JSONDecodeError:
            return jsonify({'diagram': "graph TD\n  A[Error: AI failed to generate valid JSON.]"})

    elif action == 'generate_code':
        diagram_file = request.files.get('diagram_file')
        if not diagram_file: return jsonify({'error': 'No diagram file uploaded.'}), 400
        prompt = "Analyze this flowchart and generate the complete Python code."
        img = {'mime_type': diagram_file.mimetype, 'data': diagram_file.read()}
        response = model.generate_content([prompt, img])
        return jsonify({'code': response.text})

    elif action == 'ask_question':
        query = request.form.get('query')
        if not query: return jsonify({'error': 'No question was asked.'}), 400
        code_files = request.files.getlist('code_files')
        diagram_file = request.files.get('diagram_file')
        
        context = ""
        prompt_parts = []
        if diagram_file:
            diagram_file.seek(0)
            img = {'mime_type': diagram_file.mimetype, 'data': diagram_file.read()}
            prompt_parts.append(img)
        if code_files:
            all_code_chunks = []
            for f in code_files:
                f.seek(0)
                code_content = f.read().decode('utf-8')
                all_code_chunks.extend(get_code_chunks(code_content))
            chunk_embeddings = embedding_model.encode(all_code_chunks)
            index = faiss.IndexFlatL2(chunk_embeddings.shape[1])
            index.add(chunk_embeddings.astype('float32'))
            query_embedding = embedding_model.encode([query])
            _, I = index.search(query_embedding.astype('float32'), k=min(5, len(all_code_chunks)))
            retrieved_chunks = [all_code_chunks[i] for i in I[0]]
            context += "RELEVANT CODE CONTEXT:\n---\n" + "\n---\n".join(retrieved_chunks) + "\n---\n"
        
        # --- THIS PROMPT IS UPDATED ---
        final_prompt = f"""
        Based on the provided context, answer the following question.
        **Format your answer using Markdown.** Use headings, bold text, and lists to make the answer clear and readable.

        CONTEXT:
        {context}
        
        QUESTION: {query}
        
        ANSWER:
        """
        prompt_parts.insert(0, final_prompt)
        response = model.generate_content(prompt_parts)
        return jsonify({'qa_answer': response.text})

    else:
        return jsonify({'error': 'Invalid action specified.'}), 400

if __name__ == '__main__':
    app.run(debug=True)