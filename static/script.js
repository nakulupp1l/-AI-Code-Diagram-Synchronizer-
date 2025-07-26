document.addEventListener('DOMContentLoaded', function() {
    // --- Theme Logic ---
    const themeToggleButton = document.getElementById('theme-toggle');
    const darkIcon = document.getElementById('theme-toggle-dark-icon');
    const lightIcon = document.getElementById('theme-toggle-light-icon');
    const htmlEl = document.documentElement;

    function applyTheme(isDark) {
        htmlEl.classList.toggle('dark', isDark);
        darkIcon.classList.toggle('hidden', !isDark);
        lightIcon.classList.toggle('hidden', isDark);
        mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'default' });
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    themeToggleButton.addEventListener('click', () => applyTheme(!htmlEl.classList.contains('dark')));
    applyTheme(localStorage.getItem('theme') !== 'light');

    // --- Main Elements ---
    const form = document.getElementById('main-form');
    const spinner = document.getElementById('spinner');
    const chatHistory = document.getElementById('chat-history');
    const diagramContainer = document.getElementById('mermaid-container');
    const codeDisplay = document.getElementById('code-display');
    const queryInput = document.getElementById('query-input');
    const codeUploadInput = document.getElementById('code-upload');
    const diagramUploadInput = document.getElementById('diagram-upload');
    const diagramFilenameDisplay = document.getElementById('diagram-filename-display');
    const codeFilenameDisplay = document.getElementById('code-filename-display');

    // --- Action Buttons ---
    const btnGenerateDiagram = document.getElementById('btn-generate-diagram');
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const btnAskQuestion = document.getElementById('btn-ask-question');
    const btnStartOver = document.getElementById('btn-start-over');
    const btnExportSvg = document.getElementById('btn-export-svg');
    const btnExportCode = document.getElementById('btn-export-code');

    // --- Fullscreen Modal Elements ---
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const fullscreenContent = document.getElementById('fullscreen-content');
    const btnCloseFullscreen = document.getElementById('btn-close-fullscreen');

    // --- Fullscreen Modal Logic ---
    function openFullscreen() {
        const diagramSvg = diagramContainer.querySelector('svg');
        if (diagramSvg) {
            fullscreenContent.innerHTML = '';
            fullscreenContent.appendChild(diagramSvg.cloneNode(true));
            fullscreenModal.classList.remove('hidden');
        } else {
            alert('No diagram to display in fullscreen.');
        }
    }

    function closeFullscreen() {
        fullscreenModal.classList.add('hidden');
        fullscreenContent.innerHTML = '';
    }

    btnFullscreen.addEventListener('click', openFullscreen);
    btnCloseFullscreen.addEventListener('click', closeFullscreen);
    fullscreenModal.addEventListener('click', (e) => {
        if (e.target === fullscreenModal) closeFullscreen();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape" && !fullscreenModal.classList.contains('hidden')) closeFullscreen();
    });

    // --- Export Logic ---
    btnExportSvg.addEventListener('click', () => {
        const svgElement = diagramContainer.querySelector('svg');
        if (!svgElement) {
            alert('No diagram available to export.');
            return;
        }
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diagram.svg';
        link.click();
        URL.revokeObjectURL(url);
    });

    btnExportCode.addEventListener('click', () => {
        const codeText = codeDisplay.textContent;
        if (!codeText || codeText.trim().startsWith('Your code')) {
            alert('No code available to export.');
            return;
        }
        const blob = new Blob([codeText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'code.py';
        link.click();
        URL.revokeObjectURL(url);
    });
    
    // --- File Preview & Filename Logic ---
    codeUploadInput.addEventListener('change', (event) => {
        const files = event.target.files;
        codeDisplay.innerHTML = '';
        if (files.length === 0) {
            codeDisplay.innerHTML = '<span class="text-gray-400 dark:text-gray-500">Your code will appear here</span>';
            codeFilenameDisplay.textContent = 'No file(s) chosen';
            return;
        }
        codeFilenameDisplay.textContent = Array.from(files).map(f => f.name).join(', ');
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = e.target.result;
                pre.appendChild(code);
                codeDisplay.appendChild(pre);
            };
            reader.readAsText(file);
        });
    });

    diagramUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            diagramFilenameDisplay.textContent = file.name;
            const reader = new FileReader();
            reader.onload = e => {
                diagramContainer.innerHTML = '';
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'max-w-full max-h-full object-contain mx-auto';
                diagramContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        } else {
            diagramFilenameDisplay.textContent = 'No file chosen';
            diagramContainer.innerHTML = '<span class="text-gray-400 dark:text-gray-500">Your diagram will appear here</span>';
        }
    });

    // --- Action Button Listeners ---
    btnGenerateDiagram.addEventListener('click', () => {
        const formData = new FormData(form);
        formData.append('action', 'generate_diagram');
        sendRequest(formData);
    });
    btnGenerateCode.addEventListener('click', () => {
        const formData = new FormData(form);
        formData.append('action', 'generate_code');
        sendRequest(formData);
    });
    btnAskQuestion.addEventListener('click', () => {
        const formData = new FormData(form);
        formData.append('action', 'ask_question');
        sendRequest(formData, queryInput.value);
    });
    btnStartOver.addEventListener('click', () => {
        form.reset();
        chatHistory.innerHTML = '';
        diagramContainer.innerHTML = '<span class="text-gray-400 dark:text-gray-500">Your diagram will appear here</span>';
        codeDisplay.innerHTML = '<span class="text-gray-400 dark:text-gray-500">Your code will appear here</span>';
        diagramFilenameDisplay.textContent = 'No file chosen';
        codeFilenameDisplay.textContent = 'No file(s) chosen';
    });

    // --- Core Communication & Response Handling ---
    async function sendRequest(formData, userQuery = '') {
        spinner.classList.remove('hidden');
        try {
            const response = await fetch('/process', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `HTTP error! status: ${response.status}`);
            await handleResponse(result, userQuery);
        } catch (error) {
            console.error('Error:', error);
            addToChat(`<strong>Error:</strong> ${error.message}`, 'ai');
        } finally {
            spinner.classList.add('hidden');
        }
    }

    async function handleResponse(data, userQuery) {
        let diagramRenderedSuccessfully = false;
        if (data.diagram) {
            try {
                const isDark = document.documentElement.classList.contains('dark');
                mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'default' });
                const { svg } = await mermaid.render('graphDiv-' + Date.now(), data.diagram);
                diagramContainer.innerHTML = svg;
                diagramRenderedSuccessfully = true;
            } catch (e) {
                diagramContainer.innerHTML = `<div class="p-4 text-red-500 dark:text-red-400"><strong>Diagram Syntax Error:</strong><br><pre>${escapeHtml(e.message)}</pre></div>`;
                addToChat('<strong>AI:</strong> Could not generate diagram.', 'ai');
            }
        }
        if (data.code) {
            codeDisplay.innerHTML = `<pre><code>${escapeHtml(data.code)}</code></pre>`;
            addToChat('<strong>AI:</strong> Code generated successfully!', 'ai');
        }
        if (data.qa_answer) {
            addToChat(escapeHtml(userQuery), 'user');
            const formattedHtml = marked.parse(data.qa_answer);
            addToChat(formattedHtml, 'ai');
            queryInput.value = '';
        } else if (diagramRenderedSuccessfully) {
            addToChat('<strong>AI:</strong> Diagram generated successfully!', 'ai');
        }
    }
    
    function addToChat(message, role) {
        const bubble = document.createElement('div');
        bubble.classList.add('prose', 'p-3', 'rounded-lg', 'max-w-md', 'text-sm');
        if (role === 'user') {
            bubble.classList.add('bg-indigo-600', 'text-white', 'self-end', 'ml-auto');
        } else {
            bubble.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-gray-300', 'self-start', 'mr-auto');
        }
        bubble.innerHTML = message;
        chatHistory.appendChild(bubble);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
    
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
});