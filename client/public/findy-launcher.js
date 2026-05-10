      (function() {
        // Configuration - Using backend API proxy
        const API_ENDPOINT = '/api/chat';

        // Read authenticated user from the React app's session store so we can
        // send the x-user-id header (backend uses it to enable admin debug data).
        function getSession() {
          try {
            return JSON.parse(localStorage.getItem('fas_session') || '{}');
          } catch { return {}; }
        }

        // DOM Elements
        const launcher = document.getElementById('findy-launcher');
        const button = document.getElementById('findy-button');
        const minimizeBtn = document.getElementById('findy-minimize');
        const chatWindow = document.getElementById('findy-chat');
        const closeBtn = document.getElementById('findy-close');
        const messagesContainer = document.getElementById('findy-messages');
        const input = document.getElementById('findy-input');
        const sendBtn = document.getElementById('findy-send');
        const toastEl = document.getElementById('findy-toast');
        
        let sessionId = generateSessionId();
        let isChatOpen = false;
        let isMinimized = localStorage.getItem('findy-minimized') === 'true';
        // Rolling conversation history sent to the backend (max 10 messages = 5 exchanges).
        let conversationHistory = [];

        // Snapshot the static welcome message so we can restore it whenever
        // the active user changes (login/logout/account switch). Without this,
        // the previous user's chat bubbles would keep sitting in the DOM and
        // the next user (e.g. an agent right after an admin) would see them.
        const welcomeHTML = messagesContainer.innerHTML;

        // Track which user the visible chat belongs to so we can detect a
        // switch even when the SPA navigates without a full page reload.
        // Anonymous = empty string so the first login is also a "change".
        // Persisted to localStorage so the "did the user change?" check
        // survives full-page reloads (otherwise the very first reload after
        // a logout would re-render whatever HTML happened to be cached).
        let lastUserId = (function() {
          try {
            const stored = localStorage.getItem('findy-last-user') || '';
            const current = JSON.parse(localStorage.getItem('fas_session') || '{}')?.user?.id || '';
            return stored || current;
          } catch { return ''; }
        })();

        // Reset the entire chat surface (DOM bubbles, in-memory history,
        // session id) when the authenticated user changes. We must not reuse
        // the same sessionId across users — the backend binds it to user_id
        // in findy_conversations and the rolling `history` we send would
        // otherwise leak the previous user's exchange to the LLM context.
        // Monotonic counter incremented on every user change. Each in-flight
        // sendMessage() captures the current epoch at request time and drops
        // its response if the epoch has moved on — preventing the previous
        // user's late-arriving reply from being rendered into the new
        // user's chat. Also tracks the active AbortController so we can
        // proactively cancel pending fetches at switch time.
        let chatEpoch = 0;
        let activeAbort = null;

        function resetChatForUserChange(newUserId) {
          messagesContainer.innerHTML = welcomeHTML;
          conversationHistory = [];
          sessionId = generateSessionId();
          lastUserId = newUserId || '';
          try { localStorage.setItem('findy-last-user', lastUserId); } catch { /* ignore */ }
          chatEpoch++;
          // Abort any pending request from the previous user so its response
          // never lands in the new user's view.
          if (activeAbort) {
            try { activeAbort.abort(); } catch { /* ignore */ }
            activeAbort = null;
          }
          removeTypingIndicator();
          sendBtn.disabled = !input.value.trim();
        }

        // Compare current logged-in user against last seen and reset if
        // different. Called on every chat open and before each send so we
        // never miss a switch (the React app does not currently dispatch a
        // dedicated logout event we could subscribe to).
        function ensureCurrentUser() {
          const sess = getSession();
          const uid = sess?.user?.id || '';
          if (uid !== lastUserId) {
            resetChatForUserChange(uid);
          }
        }

        // Cross-tab safety: if the user logs out / switches in another tab,
        // the `fas_session` localStorage entry changes — react to it here.
        window.addEventListener('storage', function(ev) {
          if (ev.key === 'fas_session') ensureCurrentUser();
        });

        // Apply minimized state on load
        if (isMinimized) {
          launcher.classList.add('minimized');
        }

        // Generate unique session ID
        function generateSessionId() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }

        // Show toast notification
        function showToast(message, type = 'info') {
          toastEl.textContent = message;
          toastEl.className = 'findy-toast show ' + type;
          
          setTimeout(() => {
            toastEl.className = 'findy-toast ' + type;
          }, 3000);
        }

        // Toggle chat window
        function toggleChat() {
          isChatOpen = !isChatOpen;
          chatWindow.style.display = isChatOpen ? 'flex' : 'none';

          if (isChatOpen) {
            // Wipe any stale bubbles that belong to a previously logged-in
            // user before showing the chat to the new user.
            ensureCurrentUser();
            input.focus();
            scrollToBottom();
          }
        }
        
        // Toggle minimize/maximize
        function toggleMinimize() {
          isMinimized = !isMinimized;
          
          if (isMinimized) {
            launcher.classList.add('minimized');
            localStorage.setItem('findy-minimized', 'true');
            // Close chat if open
            if (isChatOpen) {
              toggleChat();
            }
          } else {
            launcher.classList.remove('minimized');
            localStorage.setItem('findy-minimized', 'false');
          }
        }

        // Scroll to bottom of messages
        function scrollToBottom() {
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 100);
        }

        // Format time
        // Minimal markdown -> HTML renderer for bot replies. Whitelist:
        //   ### / ## / # headings, **bold**, *italic*, `code`, [text](url),
        //   bullet lists (-, *, •), numbered lists, paragraphs.
        // We escape the input first so the model can't sneak raw HTML through.
        function renderMarkdown(raw) {
          const text = String(raw == null ? '' : raw);
          const escape = (s) => s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
          let s = escape(text);

          // Stash code spans behind placeholder tokens so subsequent
          // regexes (bold/italic/link/list) don't reformat their contents.
          // We restore them at the very end.
          const codeStash = [];
          s = s.replace(/`([^`\n]+)`/g, (_m, body) => {
            codeStash.push(body);
            return '\u0001CODE' + (codeStash.length - 1) + '\u0001';
          });

          // Headings
          s = s.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
          s = s.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
          s = s.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');
          // Bold + italic
          s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
          s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
          // Links: [text](url) — only http/https/mailto
          s = s.replace(
            /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
          );

          // Bullet lists (consecutive lines starting with -, *, •).
          // Surround the produced <ul> with blank lines so the paragraph
          // splitter treats it as its own block instead of swallowing it
          // into a surrounding <p>...<ul></p>.
          s = s.replace(/(?:^|\n)((?:[ \t]*[-*•][ \t]+.+(?:\n|$))+)/g, function (_, block) {
            const items = block
              .trim()
              .split(/\n/)
              .map((l) => l.replace(/^[ \t]*[-*•][ \t]+/, ''))
              .map((l) => '<li>' + l + '</li>')
              .join('');
            return '\n\n<ul>' + items + '</ul>\n\n';
          });
          // Numbered lists (consecutive lines starting with N.)
          s = s.replace(/(?:^|\n)((?:[ \t]*\d+\.[ \t]+.+(?:\n|$))+)/g, function (_, block) {
            const items = block
              .trim()
              .split(/\n/)
              .map((l) => l.replace(/^[ \t]*\d+\.[ \t]+/, ''))
              .map((l) => '<li>' + l + '</li>')
              .join('');
            return '\n\n<ol>' + items + '</ol>\n\n';
          });

          // Paragraphs: split on blank lines, wrap leftover plain blocks in <p>
          const blocks = s.split(/\n{2,}/).map((b) => {
            const t = b.trim();
            if (!t) return '';
            if (/^<(h[1-6]|ul|ol|p|blockquote|pre)/i.test(t)) return t;
            return '<p>' + t.replace(/\n/g, '<br>') + '</p>';
          });
          let html = blocks.filter(Boolean).join('\n');

          // Restore code spans last so their contents stay literal (the
          // body was already HTML-escaped at the top).
          html = html.replace(/\u0001CODE(\d+)\u0001/g, (_m, i) => {
            return '<code>' + codeStash[Number(i)] + '</code>';
          });
          return html;
        }

        function formatTime() {
          const now = new Date();
          return now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        }

        // Build a collapsible debug panel (admin-only) beneath a bot reply.
        // debugData = { queryTokens, expandedTerms, activeFilters, chunks }
        function buildDebugPanel(debugData) {
          if (!debugData) return null;
          const panel = document.createElement('div');
          panel.className = 'findy-debug-panel';

          // Toggle button
          const toggle = document.createElement('button');
          toggle.className = 'findy-debug-toggle';
          toggle.type = 'button';
          const arrow = document.createElement('i');
          arrow.className = 'findy-debug-toggle-arrow';
          arrow.textContent = '\u25B6'; // right-pointing triangle
          toggle.appendChild(arrow);
          const chunkCount = (debugData.chunks || []).length;
          toggle.appendChild(document.createTextNode(
            '\u00A0Debug trace \u2014 ' + chunkCount + ' chunk' + (chunkCount !== 1 ? 's' : '') + ' matched'
          ));
          panel.appendChild(toggle);

          // Body (hidden by default)
          const body = document.createElement('div');
          body.className = 'findy-debug-body';

          // Helper to add a section
          function addSection(label, content) {
            const sec = document.createElement('div');
            sec.className = 'findy-debug-section';
            const lbl = document.createElement('div');
            lbl.className = 'findy-debug-label';
            lbl.textContent = label;
            sec.appendChild(lbl);
            sec.appendChild(content);
            body.appendChild(sec);
          }

          // Query tokens
          if (debugData.queryTokens && debugData.queryTokens.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'findy-debug-tags';
            debugData.queryTokens.forEach(function(t) {
              const tag = document.createElement('span');
              tag.className = 'findy-debug-tag';
              tag.textContent = t;
              tags.appendChild(tag);
            });
            addSection('Normalized query tokens', tags);
          }

          // Expanded / matched terms
          if (debugData.expandedTerms && debugData.expandedTerms.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'findy-debug-tags';
            debugData.expandedTerms.forEach(function(t) {
              const tag = document.createElement('span');
              tag.className = 'findy-debug-tag term';
              tag.textContent = t;
              tags.appendChild(tag);
            });
            addSection('Expanded / matched terms', tags);
          }

          // Active filters
          const af = debugData.activeFilters || {};
          const activeFilters = [
            af.university && ('university: ' + af.university),
            af.country && ('country: ' + af.country),
            af.city && ('near: ' + af.city),
          ].filter(Boolean);
          if (activeFilters.length > 0) {
            const tags = document.createElement('div');
            tags.className = 'findy-debug-tags';
            activeFilters.forEach(function(f) {
              const tag = document.createElement('span');
              tag.className = 'findy-debug-tag filter';
              tag.textContent = f;
              tags.appendChild(tag);
            });
            addSection('Active filters', tags);
          } else {
            const none = document.createElement('span');
            none.style.color = '#94a3b8';
            none.style.fontStyle = 'italic';
            none.textContent = 'none';
            addSection('Active filters', none);
          }

          // Top chunks
          if (debugData.chunks && debugData.chunks.length > 0) {
            const container = document.createElement('div');
            debugData.chunks.forEach(function(ch, idx) {
              const chunkEl = document.createElement('div');
              chunkEl.className = 'findy-debug-chunk';
              const meta = document.createElement('div');
              meta.className = 'findy-debug-chunk-meta';
              const scoreEl = document.createElement('span');
              scoreEl.className = 'findy-debug-chunk-score';
              scoreEl.textContent = '#' + (idx + 1) + '\u00A0score: ' + (typeof ch.score === 'number' ? ch.score.toFixed(3) : ch.score);
              meta.appendChild(scoreEl);
              const idEl = document.createElement('span');
              idEl.className = 'findy-debug-chunk-id';
              idEl.title = ch.id;
              idEl.textContent = ch.id;
              meta.appendChild(idEl);
              chunkEl.appendChild(meta);
              if (ch.matchedTerms && ch.matchedTerms.length > 0) {
                const termTags = document.createElement('div');
                termTags.className = 'findy-debug-tags';
                termTags.style.marginBottom = '3px';
                ch.matchedTerms.forEach(function(t) {
                  const tag = document.createElement('span');
                  tag.className = 'findy-debug-tag term';
                  tag.textContent = t;
                  termTags.appendChild(tag);
                });
                chunkEl.appendChild(termTags);
              }
              const preview = document.createElement('div');
              preview.className = 'findy-debug-chunk-preview';
              preview.textContent = ch.preview;
              chunkEl.appendChild(preview);
              container.appendChild(chunkEl);
            });
            addSection('Top-' + debugData.chunks.length + ' scored chunks', container);
          }

          panel.appendChild(body);

          // Toggle click handler
          toggle.addEventListener('click', function() {
            const isOpen = body.classList.toggle('open');
            arrow.classList.toggle('open', isOpen);
          });

          return panel;
        }

        // Add message to chat
        function addMessage(text, isUser = false, debugData = null) {
          const messageDiv = document.createElement('div');
          messageDiv.className = `findy-message ${isUser ? 'user' : 'bot'}`;
          
          const avatarDiv = document.createElement('div');
          avatarDiv.className = 'findy-message-avatar';
          
          if (!isUser) {
            avatarDiv.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16ZM7 9H9V11H7V9ZM11 9H13V11H11V9ZM15 9H17V11H15V9Z" fill="currentColor"/>
              </svg>
            `;
          } else {
            avatarDiv.innerHTML = `
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            `;
          }
          
          const contentWrapper = document.createElement('div');
          const contentDiv = document.createElement('div');
          contentDiv.className = 'findy-message-content';
          if (isUser) {
            contentDiv.textContent = text;
          } else {
            // Bot replies often contain markdown (headings, bold, lists,
            // links). Render a small whitelist via renderMarkdown(). User
            // input goes through textContent so it can never inject HTML.
            contentDiv.innerHTML = renderMarkdown(text);
          }
          
          const timeDiv = document.createElement('div');
          timeDiv.className = 'findy-message-time';
          timeDiv.textContent = formatTime();
          
          contentWrapper.appendChild(contentDiv);
          contentWrapper.appendChild(timeDiv);

          // Append admin debug panel below bot replies when debug data is present.
          // Defense-in-depth: the server already gates `debug` to admin callers,
          // but we re-check the role on the client too so a non-admin can never
          // see the debug trace even if the response was somehow tampered with
          // or if a stale admin response is replayed in a non-admin session.
          if (!isUser && debugData) {
            const sess = getSession();
            const role = sess?.user?.role || '';
            if (role === 'admin') {
              const panel = buildDebugPanel(debugData);
              if (panel) contentWrapper.appendChild(panel);
            }
          }
          
          messageDiv.appendChild(avatarDiv);
          messageDiv.appendChild(contentWrapper);
          
          messagesContainer.appendChild(messageDiv);
          scrollToBottom();
        }

        // Show typing indicator
        function showTypingIndicator() {
          const typingDiv = document.createElement('div');
          typingDiv.className = 'findy-message bot';
          typingDiv.id = 'findy-typing';
          
          typingDiv.innerHTML = `
            <div class="findy-message-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16ZM7 9H9V11H7V9ZM11 9H13V11H11V9ZM15 9H17V11H15V9Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="findy-typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          `;
          
          messagesContainer.appendChild(typingDiv);
          scrollToBottom();
        }

        // Remove typing indicator
        function removeTypingIndicator() {
          const typingEl = document.getElementById('findy-typing');
          if (typingEl) {
            typingEl.remove();
          }
        }

        // Send message
        async function sendMessage() {
          const message = input.value.trim();
          if (!message) return;

          // Belt-and-braces: if the user changed since the chat was opened
          // (e.g. they logged out and re-logged-in another tab), make sure
          // we don't ship the previous user's history to the LLM.
          ensureCurrentUser();

          // Add user message
          addMessage(message, true);
          input.value = '';
          sendBtn.disabled = true;
          autoResizeTextarea();

          showTypingIndicator();

          // Read current session to send user identity header (the backend uses
          // this to gate admin-only debug data in the response).
          const session = getSession();
          const userId = session?.user?.id || '';

          // Snapshot the request's identity. If the active user changes (or
          // the chat is reset for any other reason) before this request
          // resolves, `chatEpoch` will have moved on and we will silently
          // drop the response instead of leaking it into a new account.
          const reqEpoch = chatEpoch;
          const reqSessionId = sessionId;
          const reqUserId = userId;

          // Use a real AbortController (not just AbortSignal.timeout) so
          // resetChatForUserChange() can cancel an in-flight request the
          // moment the user switches.
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          activeAbort = controller;

          const isStale = () => chatEpoch !== reqEpoch || sessionId !== reqSessionId;

          try {
            const response = await fetch(API_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(reqUserId ? { 'x-user-id': reqUserId } : {}),
              },
              body: JSON.stringify({
                message: message,
                sessionId: reqSessionId,
                history: conversationHistory
              }),
              signal: controller.signal
            });

            // If a user switch happened while we were waiting, drop the
            // response on the floor — the new user must not see it.
            if (isStale()) return;

            removeTypingIndicator();

            if (response.ok) {
              const result = await response.json();
              if (isStale()) return;
              // Backend returns { success: true, message: "...", data: {...} }
              const botMessage = result.data?.message || result.data?.response || result.message || 'No response received';
              // The server already gates the debug object to admin callers only;
              // trust that as the source of truth rather than re-checking local role.
              const debugData = result.debug || null;
              addMessage(botMessage, false, debugData);

              // Update rolling history (keep last 10 = 5 exchanges).
              conversationHistory.push({ role: 'user', content: message });
              conversationHistory.push({ role: 'assistant', content: botMessage });
              if (conversationHistory.length > 10) {
                conversationHistory = conversationHistory.slice(conversationHistory.length - 10);
              }
            } else {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.message || 'Request failed');
            }
          } catch (error) {
            // Aborts triggered by a user switch are intentional — never
            // surface them as a chat error in the (now different) account.
            if (isStale() || (error && error.name === 'AbortError' && chatEpoch !== reqEpoch)) {
              return;
            }
            removeTypingIndicator();
            console.error('Findy message error:', error);
            // Use the server's error message when one was returned (it is already
            // gated server-side: admins get a verbose diagnostic, regular users
            // get the generic friendly message). Only fall back to the hardcoded
            // Turkish string for pure network failures where no server message
            // is available (fetch failed, request timed out, etc.).
            const serverMsg = error instanceof Error ? error.message : '';
            const isNetworkLevel = !serverMsg
              || serverMsg === 'Request failed'
              || serverMsg === 'Failed to fetch'
              || serverMsg.toLowerCase().includes('networkerror')
              || serverMsg.toLowerCase().includes('timeout');
            addMessage(
              isNetworkLevel
                ? 'Üzgünüm, şu anda yanıt veremiyorum. Lütfen daha sonra tekrar deneyin.'
                : serverMsg,
              false
            );
          } finally {
            clearTimeout(timeoutId);
            if (activeAbort === controller) activeAbort = null;
          }
        }

        // Auto resize textarea
        function autoResizeTextarea() {
          input.style.height = 'auto';
          input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        }

        // Update send button state
        function updateSendButton() {
          sendBtn.disabled = !input.value.trim();
        }

        // Event Listeners
        button.addEventListener('click', () => {
          if (isMinimized) {
            // If minimized, first maximize then toggle chat
            toggleMinimize();
          }
          toggleChat();
        });
        closeBtn.addEventListener('click', toggleChat);
        minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMinimize();
        });
        
        sendBtn.addEventListener('click', sendMessage);
        
        input.addEventListener('input', () => {
          autoResizeTextarea();
          updateSendButton();
        });
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.value.trim()) {
              sendMessage();
            }
          }
        });

        // Keyboard support for button
        button.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleChat();
          }
        });
      })();
