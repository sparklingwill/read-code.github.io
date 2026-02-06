document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const inputView = document.getElementById('input-view');
    const outputView = document.getElementById('output-view');
    const codeInput = document.getElementById('code-input');
    const codeOutput = document.getElementById('code-output');

    // Controls
    const renderBtn = document.getElementById('render-btn');
    const clearBtn = document.getElementById('clear-btn');
    const pasteBtn = document.getElementById('paste-btn');
    const copyBtn = document.getElementById('copy-btn');
    const backEditBtn = document.getElementById('back-edit-btn');
    const langBadge = document.getElementById('language-badge');
    const structureSidebar = document.getElementById('structure-sidebar');
    const structureList = document.getElementById('structure-list');
    const structureToggleBtn = document.getElementById('structure-toggle-btn');

    const contentArea = document.getElementById('content-area'); // New wrapper

    // Elements - Sidebar & Settings
    const autoCopyToggle = document.getElementById('auto-copy-toggle');
    const autoHighlightToggle = document.getElementById('auto-highlight-toggle');
    // const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn'); // Removed
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('ai-sidebar');
    const agentSelector = document.getElementById('agent-selector');
    const accountSelector = document.getElementById('account-selector');
    const accountControlsWrapper = document.getElementById('account-controls-wrapper');
    const renameAccountBtn = document.getElementById('rename-account-btn');
    const agentPlaceholder = document.getElementById('agent-placeholder');
    const mainContainer = document.querySelector('.container');

    // State
    // Base URLs (Gemini is dynamic)
    const agentUrls = {
        gemini: 'https://gemini.google.com/app',
        grok: 'https://x.com/i/grok',
        chatgpt: 'https://chatgpt.com/',
        perplexity: 'https://www.perplexity.ai/'
    };
    let activeAgent = null;
    let accountLabels = {
        '0': 'Acc 0',
        '1': 'Acc 1',
        '2': 'Acc 2'
    };

    // --- Persistence Functions ---
    const STORAGE_KEY = 'codereader_state';

    const autoFormatToggle = document.getElementById('auto-format-toggle');
    const queryTemplateInput = document.getElementById('query-template');

    const saveState = () => {
        const state = {
            content: codeInput.value,
            autoCopy: autoCopyToggle.checked,
            autoHighlight: autoHighlightToggle.checked,
            autoFormat: autoFormatToggle.checked, // New
            queryTemplate: queryTemplateInput.value, // New
            lastAgent: activeAgent || 'gemini',
            sidebarOpen: !sidebar.classList.contains('hidden'),
            activeView: outputView.classList.contains('active-view') ? 'output' : 'input',
            googleAccount: accountSelector.value,
            accountLabels: accountLabels
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    const updateAccountDropdown = () => {
        for (const [value, label] of Object.entries(accountLabels)) {
            const option = accountSelector.querySelector(`option[value="${value}"]`);
            if (option) option.textContent = label;
        }
    };

    const loadState = () => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const state = JSON.parse(saved);

                // Restore settings
                if (state.content) codeInput.value = state.content;
                autoCopyToggle.checked = state.autoCopy !== undefined ? state.autoCopy : false;
                autoHighlightToggle.checked = state.autoHighlight !== undefined ? state.autoHighlight : true;

                // New Settings
                autoFormatToggle.checked = state.autoFormat !== undefined ? state.autoFormat : false;
                if (state.queryTemplate) queryTemplateInput.value = state.queryTemplate;

                // Restore Account Labels
                if (state.accountLabels) {
                    accountLabels = { ...accountLabels, ...state.accountLabels };
                    updateAccountDropdown();
                }

                // Restore Account Index
                if (state.googleAccount) {
                    accountSelector.value = state.googleAccount;
                }

                // Restore Agent
                const savedAgent = state.lastAgent || 'gemini';
                if (agentSelector.querySelector(`option[value="${savedAgent}"]`)) {
                    agentSelector.value = savedAgent;
                }

                // Set active agent internally but don't force load unless sidebar is open
                activeAgent = savedAgent;

                // Restore View
                if (state.activeView === 'output' && state.content) {
                    // Re-render if we were in output mode
                    renderCode(false); // Pass false to avoid saving state again during load
                } else {
                    switchView('input');
                }

                // Restore Sidebar
                // If sidebar was open, let's open it and load the agent
                if (state.sidebarOpen) {
                    toggleSidebar(true);
                    switchAgent(savedAgent);
                }

            } catch (e) {
                console.warn('Failed to load state', e);
            }
        } else {
            // Default first load state
            switchAgent('gemini');
        }
    };

    // Listeners for New Inputs
    autoFormatToggle.addEventListener('change', () => {
        if (autoFormatToggle.checked) autoCopyToggle.checked = false;
        saveState();
    });
    queryTemplateInput.addEventListener('input', saveState);

    // Helper to get correct Gemini URL
    const getGeminiUrl = () => {
        const accIndex = accountSelector.value;
        if (accIndex === '0') return 'https://gemini.google.com/app';
        return `https://gemini.google.com/u/${accIndex}/app`;
    };

    // Rename Handler
    renameAccountBtn.addEventListener('click', () => {
        const currentVal = accountSelector.value;
        const currentLabel = accountLabels[currentVal];
        const newLabel = prompt(`Enter a display name for Account ${currentVal} (e.g. "Personal"):`, currentLabel);

        if (newLabel && newLabel.trim() !== "") {
            accountLabels[currentVal] = newLabel.trim();
            updateAccountDropdown();
            saveState();
            showToast(`Renamed to "${newLabel.trim()}"`, 2000);
        }
    });

    // Toggle Account Switcher Visibility Logic Update
    const updateAccountVisibility = (agentKey) => {
        if (agentKey === 'gemini') {
            accountControlsWrapper.style.display = 'flex'; // Use wrapper now
        } else {
            accountControlsWrapper.style.display = 'none';
        }
    };

    // --- Resizer Logic ---
    const resizer = document.getElementById('sidebar-resizer');
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.classList.add('resizing-active'); // Enable iframe passthrough
        resizer.classList.add('resizing');

        // Disable transitions during drag for performance
        sidebar.style.transition = 'none';
        mainContainer.style.transition = 'none';

        e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        e.preventDefault(); // Prevent selection even harder

        // Calculate new width (Right edge is window.innerWidth, mouse is left edge of sidebar)
        // Sidebar Width = Window Width - Mouse X
        let newWidth = window.innerWidth - e.clientX;

        // Constraints (Min 300px, Max 90% screen)
        if (newWidth < 300) newWidth = 300;
        if (newWidth > window.innerWidth * 0.9) newWidth = window.innerWidth * 0.9;

        // Apply
        sidebar.style.width = `${newWidth}px`;
        if (!sidebar.classList.contains('hidden')) {
            mainContainer.style.marginRight = `${newWidth}px`;
            mainContainer.style.width = `calc(100% - ${newWidth}px)`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.classList.remove('resizing-active'); // Re-enable iframe interaction
            resizer.classList.remove('resizing');

            // Re-enable transitions
            sidebar.style.transition = '';
            mainContainer.style.transition = '';

            // Should prompt save state if we tracked width in state,
            // but for now let's just leave it as session-based or strictly visual.
            // (Optional: saveState() with width if desired by user later)
        }
    });

    // --- Helper Functions ---

    const showToast = (message, duration = 2000) => {
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: #333; color: #fff; padding: 12px 24px; border-radius: 4px;
                z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                transition: opacity 0.3s ease; opacity: 0; pointer-events: none;
                font-family: var(--font-ui); font-size: 0.9rem;
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
        }, duration);
    };

    // Robust Copy Function (Handles file:/// protocol restrictions)
    const secureCopy = async (text) => {
        if (!text) return false;

        try {
            // 1. Try Modern Async API (Best for HTTPS/Localhost)
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            // 2. Fallback: execCommand (Best for file:/// protocol)
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;

                // Ensure it's not visible but part of DOM
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);

                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (successful) return true;
                throw new Error("execCommand failed");
            } catch (fallbackErr) {
                console.warn("Copy failed:", fallbackErr);
                return false;
            }
        }
    };

    // --- Core Editor Functions ---

    const switchView = (viewName) => {
        // Clear any text selection
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }

        // Cancel pending auto-actions
        if (window.copyTimeout) clearTimeout(window.copyTimeout);

        if (viewName === 'output') {
            inputView.classList.remove('active-view');
            inputView.classList.add('hidden-view');
            outputView.classList.remove('hidden-view');
            outputView.classList.add('active-view');
        } else {
            outputView.classList.remove('active-view');
            outputView.classList.add('hidden-view');
            inputView.classList.remove('hidden-view');
            inputView.classList.add('active-view');
            codeInput.focus();
        }
        saveState(); // Save view state change
    };

    const renderCode = (shouldSave = true) => {
        const rawCode = codeInput.value;
        if (!rawCode.trim()) return;

        if (shouldSave) saveState();

        try {
            const result = hljs.highlightAuto(rawCode);
            codeOutput.innerHTML = result.value;
            langBadge.textContent = 'Detected: ' + (result.language ? result.language : 'Plain Text');
            codeOutput.className = 'hljs language-' + (result.language || 'text');

            // --- Structure Analysis (Language Analyzer) ---
            if (structureList) structureList.innerHTML = '';
            // Heuristic to find interesting nodes (titles, sections, classes)
            const symbols = codeOutput.querySelectorAll('.hljs-title, .hljs-section, .hljs-selector-class, .hljs-selector-id');

            if (symbols.length > 0 && structureSidebar) {
                structureSidebar.classList.remove('hidden');
                symbols.forEach((el, index) => {
                    const id = `sym-${index}`;
                    el.id = id; // Add scroll anchor

                    const item = document.createElement('button');
                    item.className = 'structure-item';
                    item.textContent = el.textContent.substring(0, 40);
                    item.title = el.textContent;

                    item.onclick = () => {
                        const target = document.getElementById(id);
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            target.style.backgroundColor = 'rgba(253, 224, 71, 0.4)';
                            setTimeout(() => target.style.backgroundColor = '', 1500);
                        }
                    };

                    structureList.appendChild(item);
                });
            } else if (structureSidebar) {
                structureSidebar.classList.add('hidden');
            }

            // Auto-collapse header
            const hdr = document.getElementById('app-header');
            const chev = document.getElementById('header-chevron');
            if (hdr) hdr.classList.add('collapsed');
            if (chev) chev.classList.add('rotate-180');

            switchView('output');
        } catch (e) {
            console.error(e);
            langBadge.textContent = 'Error parsing';
        }
    };

    // Toggle Structure Sidebar
    if (structureToggleBtn && structureSidebar) {
        structureToggleBtn.addEventListener('click', () => {
            structureSidebar.classList.toggle('collapsed');
        });
    }

    // --- Sidebar & Agent Functions ---

    const sidebarHeader = document.querySelector('.sidebar-header h3');

    const toggleSidebar = (show) => {
        const toggleInput = document.getElementById('sidebar-toggle-input');
        if (toggleInput) toggleInput.checked = show;

        if (show) {
            sidebar.classList.remove('hidden');
            mainContainer.classList.add('sidebar-open');
            if (sidebarHeader) sidebarHeader.classList.add('text-glow');

            if (!activeAgent) activeAgent = 'gemini';
            switchAgent(activeAgent);

            // Ensure layout syncs with current width
            const width = sidebar.offsetWidth || 400;
            mainContainer.style.marginRight = `${width}px`;
            mainContainer.style.width = `calc(100% - ${width}px)`;
        } else {
            sidebar.classList.add('hidden');
            mainContainer.classList.remove('sidebar-open');
            if (sidebarHeader) sidebarHeader.classList.remove('text-glow');

            // Allow CSS to control layout (centering)
            mainContainer.style.marginRight = '';
            mainContainer.style.width = '';
        }
        if (typeof updateToggleIcon === 'function') updateToggleIcon(show);
        saveState();
    };

    // Listener for Sidebar Toggle Input
    const sidebarToggleInput = document.getElementById('sidebar-toggle-input');
    if (sidebarToggleInput) {
        sidebarToggleInput.addEventListener('change', () => {
            toggleSidebar(sidebarToggleInput.checked);
        });
    }

    // Unified Opener for External Agents
    window.agentWindows = window.agentWindows || {};

    window.openExternalAgent = (agentKey) => {
        const url = agentUrls[agentKey];
        if (!url) return;

        const popupWindowName = `${agentKey}Window`;
        const existingWin = window.agentWindows[agentKey];

        if (existingWin && !existingWin.closed) {
            existingWin.focus();
        } else {
            const popupFeatures = "width=600,height=900,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no";
            window.agentWindows[agentKey] = window.open(url, popupWindowName, popupFeatures);
        }
    };

    const switchAgent = (agentKey) => {
        // Hide all frames
        document.querySelectorAll('.agent-frame').forEach(frame => {
            frame.classList.add('hidden-frame');
        });

        // Clear placeholder state
        agentPlaceholder.style.display = 'none';

        // Remove existing external links if any
        const existingLink = document.getElementById('agent-external-link');
        if (existingLink) existingLink.remove();

        activeAgent = agentKey;

        // Toggle Account Switcher Visibility
        updateAccountVisibility(agentKey);

        // Check if agent allows embedding (Currently only Gemini)
        if (agentKey === 'gemini') {
            const targetFrame = document.getElementById(`frame-${agentKey}`);
            if (targetFrame) {
                targetFrame.classList.remove('hidden-frame');

                // Dynamic URL logic
                const requiredUrl = getGeminiUrl();
                const currentSrc = targetFrame.getAttribute('src');

                // Initial load or Account Change
                if (!currentSrc || currentSrc !== requiredUrl) {
                    targetFrame.src = requiredUrl;
                }
            }
        } else {
            // For restricted agents (ChatGPT, Grok, Perplexity), show a specific prompt
            agentPlaceholder.style.display = 'flex';
            const cleanName = agentKey.charAt(0).toUpperCase() + agentKey.slice(1);

            let autoCopyText = "If <strong>Auto Copy & Switch to AI</strong> is enabled, selecting text will also trigger this window.";
            if (agentKey === 'chatgpt') {
                autoCopyText += ` <br><span style="color: #ef4444; font-weight: 500;">(Note: ChatGPT opens a NEW window for every auto-trigger).</span>`;
            }

            agentPlaceholder.innerHTML = `
                <div id="agent-external-link" class="external-agent-prompt" style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; text-align: center;">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                        ${cleanName} cannot be embedded directly.
                    </p>
                    <button onclick="window.openExternalAgent('${agentKey}')" 
                            class="primary-btn" style="justify-content: center; text-decoration: none;">
                        Open ${cleanName} Window ↗
                    </button>
                    <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary); opacity: 0.7;">
                        (Opens as a floating popup window)
                        <br><br>
                        ${autoCopyText}
                    </p>
                </div>
            `;
        }
    };

    // Add Listener for Account Change
    accountSelector.addEventListener('change', () => {
        saveState();
        if (activeAgent === 'gemini') {
            switchAgent('gemini'); // Re-trigger to update URL
        }
    });



    // --- Event Listeners ---

    // Editor
    renderBtn.addEventListener('click', renderCode);
    backEditBtn.addEventListener('click', () => switchView('input'));

    codeInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            renderCode();
        }
    });

    // Help Button Logic
    const helpBtn = document.getElementById('help-btn');
    const helpDropdown = document.getElementById('help-dropdown');

    if (helpBtn && helpDropdown) {
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            helpDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!helpDropdown.classList.contains('hidden') && !helpBtn.contains(e.target) && !helpDropdown.contains(e.target)) {
                helpDropdown.classList.add('hidden');
            }
        });
    }

    clearBtn.addEventListener('click', () => {
        codeInput.value = '';
        codeOutput.textContent = '';
        langBadge.textContent = 'Detected: None';
        codeInput.focus();
    });

    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            codeInput.value = text;
        } catch (err) {
            codeInput.placeholder = "Pasting failed. Use Ctrl+V.";
        }
    });

    copyBtn.addEventListener('click', async () => {
        const textToCopy = codeInput.value;
        if (!textToCopy) return;
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            copyBtn.style.color = 'var(--accent)';
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.color = '';
            }, 2000);
        } catch (err) { console.error(err); }
    });

    // --- Helper for AI Activation ---
    const activateAI = (query, interactionDelay = 0) => {
        // Open sidebar if closed
        if (sidebar.classList.contains('hidden')) {
            toggleSidebar(true);
            updateToggleIcon(true);
            interactionDelay = 350; // Needs time to slide
        }

        // Initialize agent if needed
        if (!activeAgent) {
            switchAgent(agentSelector.value);
        }

        // Save current agent
        const currentAgent = activeAgent || agentSelector.value;

        secureCopy(query).then(success => {
            if (success) {
                const cleanName = currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1);
                const msg = autoFormatToggle.checked
                    ? `Copied & formatted, paste it to ${cleanName}`
                    : "Copied!";
                showToast(msg, 2500);
            } else {
                showToast("Copy failed.", 2000);
            }
        });

        // 1. Gemini: Open Sidebar & Focus
        // Note: We cannot pre-fill the chat input due to Cross-Origin (CORS) security restrictions.
        // Gemini also does not support a public URL parameter (like ?q=...) for the web UI.
        if (currentAgent === 'gemini') {
            // Open sidebar if closed
            if (sidebar.classList.contains('hidden')) {
                toggleSidebar(true);
                updateToggleIcon(true);
                interactionDelay = 350;
            }

            setTimeout(() => {
                const targetFrame = document.getElementById(`frame-${currentAgent}`);
                if (targetFrame) {
                    document.activeElement.blur();

                    // Visual Cue: Pulse
                    targetFrame.classList.remove('pulse-focus'); // Reset
                    void targetFrame.offsetWidth; // Force Reflow
                    targetFrame.classList.add('pulse-focus');
                    targetFrame.setAttribute('data-pulse-start', Date.now().toString()); // Timestamp
                    setTimeout(() => { targetFrame.classList.remove('pulse-focus'); }, 4000);

                    // Aggressive Focus Strategy
                    const tryFocus = () => {
                        targetFrame.focus();
                        if (targetFrame.contentWindow) targetFrame.contentWindow.focus();
                    };

                    tryFocus();
                    [100, 300, 600].forEach(delay => setTimeout(tryFocus, delay));
                    if (targetFrame.contentWindow) targetFrame.contentWindow.focus();
                    showToast(`Ready to Paste! (Ctrl+V)`, 3000);
                }
            }, interactionDelay);

        } else {
            // 2. External Agents: Use Helper
            setTimeout(() => window.openExternalAgent(currentAgent), 100); return;
            // Legacy code disabled: window.agentWindows = ...
            const popupWindowName = `${currentAgent}Window`;

            setTimeout(() => {
                const existingWin = window.agentWindows[currentAgent];
                if (existingWin && !existingWin.closed) {
                    existingWin.focus();
                } else {
                    const popupFeatures = "width=600,height=900,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no";
                    window.agentWindows[currentAgent] = window.open(agentUrls[currentAgent], popupWindowName, popupFeatures);
                }
            }, 100);
        }
    };

    // --- Auto Selection Logic ---
    const handleSelection = (e) => {
        // Guard: Only run in Rendered View
        if (outputView.classList.contains('hidden-view')) return;

        // Guard: Ignore interactions with Sidebar or Toolbar
        if (e && e.target) {
            if (e.target.closest('.settings-bar')) return;
            const sidebarEl = document.getElementById('ai-sidebar');
            if (sidebarEl && sidebarEl.contains(e.target)) return;
        }

        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text.length > 0) {
            // Re-query toggles to ensure fresh state
            const highlightToggle = document.getElementById('auto-highlight-toggle');
            const copyToggle = document.getElementById('auto-copy-toggle');
            const formatToggle = document.getElementById('auto-format-toggle');
            const templateInput = document.getElementById('query-template'); // Query template too

            // Auto Highlight
            if (highlightToggle && highlightToggle.checked && CSS.highlights) {
                const range = selection.getRangeAt(0);
                const highlight = new Highlight(range);
                CSS.highlights.set("autohighlight-marker", highlight);
            }

            // Auto Copy / Format Trigger
            const isCopy = copyToggle && copyToggle.checked;
            const isFormat = formatToggle && formatToggle.checked;

            if (isCopy || isFormat) {
                // Debounce to avoid rapid firing while dragging
                if (window.copyTimeout) clearTimeout(window.copyTimeout);
                window.copyTimeout = setTimeout(() => {

                    if (isFormat) {
                        const template = (templateInput && templateInput.value) || 'What does "{text}" mean';
                        const formattedText = template.replace('{text}', text);
                        // "Auto-Copy & Format" -> Invoke AI (includes formatting)
                        activateAI(formattedText);
                        window.getSelection().removeAllRanges(); // Consume selection
                    } else { // isCopy (Exclusive due to previous logic, but fallback safe)
                        // Just Copy Raw
                        secureCopy(text).then(success => {
                            if (success) showToast("Auto-Copied!", 1500);
                            window.getSelection().removeAllRanges(); // Consume selection
                        });
                    }
                }, 600);
            }
        }
    };

    // Sidebar


    closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));

    agentSelector.addEventListener('change', (e) => {
        switchAgent(e.target.value);
        saveState();
    });

    // Persistence Listeners
    codeInput.addEventListener('input', () => {
        // Debounce slightly if needed, but direct save is fine for local text
        saveState();
    });

    autoCopyToggle.addEventListener('change', () => {
        if (autoCopyToggle.checked) autoFormatToggle.checked = false;
        saveState();
    });

    autoHighlightToggle.addEventListener('change', () => {
        saveState();
        if (!autoHighlightToggle.checked && CSS.highlights) {
            CSS.highlights.delete("autohighlight-marker");
        }
    });

    // Document-level Selection & Shortcuts
    document.addEventListener('mouseup', handleSelection);

    // Sidebar Shortcuts & Toggles
    const toggleHandle = document.getElementById('sidebar-toggle-handle');

    // Function to rotate arrow
    const updateToggleIcon = (isOpen) => {
        const svg = toggleHandle.querySelector('svg');
        if (isOpen) {
            svg.innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>'; // Point right (close)
        } else {
            svg.innerHTML = '<polyline points="15 18 9 12 15 6"></polyline>'; // Point left (open)
        }
    };

    toggleHandle.addEventListener('click', () => {
        const isOpening = sidebar.classList.contains('hidden');
        toggleSidebar(isOpening);
        updateToggleIcon(isOpening);
    });

    closeSidebarBtn.addEventListener('click', () => {
        toggleSidebar(false);
        updateToggleIcon(false);
    });

    // Key triggers (Using Capture Phase to override browser/textarea defaults)
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + B (Toggle Sidebar)
        if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'b')) {
            event.preventDefault();
            event.stopPropagation(); // Stop bubbling

            const isOpening = sidebar.classList.contains('hidden');
            toggleSidebar(isOpening);
            updateToggleIcon(isOpening);
            if (isOpening) {
                // Optional: Switch to agent if opening via shortcut
                if (!activeAgent) switchAgent(agentSelector.value);
            }
            return; // Exit
        }

        // Ctrl/Cmd + I (AI Query)
        if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'i')) {
            const selection = window.getSelection();
            const text = selection.toString().trim();

            if (text.length > 0) {
                event.preventDefault();
                event.stopPropagation();

                // Format prompt
                const promptTemplate = queryTemplateInput.value || 'What does "{text}" mean';
                const query = promptTemplate.replace('{text}', text);

                activateAI(query);
            }
        }
    }, true); // TRUE = Capture Phase (Triggers before bubbling)

    // Add Highlight API Styles if supported
    if (CSS.highlights) {
        const style = document.createElement("style");
        style.textContent = `
            ::highlight(autohighlight-marker) {
                background-color: rgba(253, 224, 71, 0.4); /* Yellow-ish transparent */
                color: inherit;
            }
        `;
        document.head.appendChild(style);
    }



    // Cancel pulse animation when focus moves to an iframe (User clicked or Auto-focus succeeded)
    window.addEventListener('blur', () => {
        const active = document.activeElement;
        if (active && active.tagName === 'IFRAME') {
            const startStr = active.getAttribute('data-pulse-start');
            const now = Date.now();
            // Minimum blink time (1.2s) before allowing focus to cancel it
            if (startStr && (now - parseInt(startStr) < 1200)) {
                return;
            }
            active.classList.remove('pulse-focus');
        }
    });

    // Helper for External Agent Opening
    window.openExternalAgent = (agentKey) => {
        const url = agentUrls[agentKey];
        if (!url) return;
        const popupWindowName = `CodeReader_Popup_${agentKey}`;
        const existingWin = window.agentWindows[agentKey];
        if (existingWin && !existingWin.closed) {
            existingWin.focus();
        } else {
            const popupFeatures = "width=600,height=900,scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no";
            window.agentWindows[agentKey] = window.open(url, popupWindowName, popupFeatures);
        }
    };

    // --- Header Collapse Logic ---
    const appHeader = document.getElementById('app-header');
    const headerToggleBtn = document.getElementById('header-toggle-btn');
    const headerChevron = document.getElementById('header-chevron');

    if (appHeader && headerToggleBtn) {
        headerToggleBtn.addEventListener('click', () => {
            appHeader.classList.toggle('collapsed');
            if (headerChevron) headerChevron.classList.toggle('rotate-180');
        });
    }

    // --- Search Functionality ---
    const searchInput = document.getElementById('search-input');
    const searchCount = document.getElementById('search-count');
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchClose = document.getElementById('search-close');

    let searchRanges = [];
    let searchIndex = -1;

    const activateMatch = (idx) => {
        if (searchRanges.length === 0) return;
        // Wrap index
        if (idx >= searchRanges.length) idx = 0;
        if (idx < 0) idx = searchRanges.length - 1;

        searchIndex = idx;
        const range = searchRanges[idx];

        // Highlight Active
        CSS.highlights.set('search-active', new Highlight(range));

        // Scroll
        const rect = range.getBoundingClientRect();
        // If out of view? Just scrollIntoView
        const element = range.startContainer.parentElement;
        // Range doesn't have scrollIntoView.
        // Use span?
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        searchCount.textContent = `${idx + 1}/${searchRanges.length}`;
    };

    const runSearch = (term) => {
        // Clear old
        CSS.highlights.delete('search-result');
        CSS.highlights.delete('search-active');
        searchRanges = [];
        searchIndex = -1;

        if (!term) {
            searchCount.classList.add('hidden');
            return;
        }

        try {
            const root = document.getElementById('code-output');
            if (!root) return;
            const fullText = root.textContent;
            // Escape regex chars
            const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safeTerm, 'gi');

            // Map Text Nodes
            const textNodes = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let offset = 0;
            while (walker.nextNode()) {
                const node = walker.currentNode;
                const len = node.textContent.length;
                textNodes.push({ node, start: offset, length: len });
                offset += len;
            }

            const ranges = [];
            let match;
            while ((match = regex.exec(fullText)) !== null) {
                const start = match.index;
                const end = start + match[0].length;

                // Find start/end nodes
                const startObj = textNodes.find(n => start >= n.start && start < n.start + n.length);
                const endObj = textNodes.find(n => end > n.start && end <= n.start + n.length);

                if (startObj && endObj) {
                    const range = new Range();
                    range.setStart(startObj.node, start - startObj.start);
                    range.setEnd(endObj.node, end - endObj.start);
                    ranges.push(range);
                }
            }

            searchRanges = ranges;

            if (ranges.length > 0) {
                CSS.highlights.set('search-result', new Highlight(...ranges));
                searchCount.classList.remove('hidden');
                activateMatch(0);
            } else {
                searchCount.textContent = "0/0";
                searchCount.classList.remove('hidden');
            }
        } catch (e) {
            console.error("Search Error:", e);
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            runSearch(e.target.value);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.shiftKey) activateMatch(searchIndex - 1);
                else activateMatch(searchIndex + 1);
            }
        });
    }

    if (searchNext) searchNext.onclick = () => activateMatch(searchIndex + 1);
    if (searchPrev) searchPrev.onclick = () => activateMatch(searchIndex - 1);
    if (searchClose) searchClose.onclick = () => {
        searchInput.value = '';
        runSearch('');
    };

    // Ctrl+F Listener
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
            const outputView = document.getElementById('output-view');
            // Only hijack if Output View is visible
            if (outputView && outputView.classList.contains('active-view')) {
                e.preventDefault();
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        }
    });

    // Initialize State
    loadState();
});
