// app.js
document.addEventListener('DOMContentLoaded', () => {
  // CodePen Serverless Function.
  const DEPLOYED_CHAT_ENDPOINT = 'https://notebot-ten.vercel.app/api/chat';
  const IS_CODEPEN =
    /(^|\.)codepen\.io$|(^|\.)cdpn\.io$/.test(location.hostname) ||
    location.hostname.includes('codepen');

  const API_CHAT_ENDPOINT = IS_CODEPEN ? DEPLOYED_CHAT_ENDPOINT : '/api/chat';

  // ---------- State ----------
  const state = {
    view: 'notes',
    currentNoteId: null,
    notes: [],
    archived: [],
    chat: [],
    settings: {
      theme: localStorage.getItem('notebot-theme') || 'dark',
      aiMode: localStorage.getItem('notebot-ai-mode') || 'simulated', // "simulated" | "serverless"
    },
    confirmAction: null,
  };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {
    navItems: document.querySelectorAll('.nav-item'),
    notesView: $('notes-view'),
    archivedView: $('archived-view'),
    chatbotView: $('chatbot-view'),
    settingsView: $('settings-view'),

    notesSearch: $('notes-search-input'),
    newNoteBtn: $('new-note-btn'),
    notesList: $('notes-list'),

    title: $('note-title-input'),
    content: $('note-content-input'),
    tags: $('note-tags-input'),
    tagsDisplay: $('note-tags-display'),
    preview: $('note-preview'),

    pinBtn: $('note-pin-btn'),
    pinText: document.querySelector('#note-pin-btn .pin-text'),
    archiveBtn: $('note-archive-btn'),
    sendToAiBtn: $('note-send-to-ai-btn'),
    exportMdBtn: $('note-export-md-btn'),
    exportTxtBtn: $('note-export-txt-btn'),
    deleteBtn: $('note-delete-btn'),

    archivedList: $('archived-notes-list'),

    aiModeSelect: $('ai-mode-select'),
    chatNewBtn: $('chatbot-new-session-btn'),
    chatHistory: $('chat-history'),
    chatInput: $('chat-input'),
    chatSend: $('send-chat-btn'),
    typing: $('chatbot-typing-indicator'),
    promptBtns: document.querySelectorAll('.prompt-template-btn'),

    darkToggle: $('dark-mode-toggle'),

    modalContainer: $('modal-container'),
    modalTitle: $('modal-title'),
    modalMessage: $('modal-message'),
    modalCancel: $('modal-cancel-btn'),
    modalConfirm: $('modal-confirm-btn'),
    modalClose: $('modal-close-btn'),

    toastContainer: $('toast-container'),
  };

  // ---------- Utilities ----------
  const nowIso = () => new Date().toISOString();
  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2);

  function showToast(msg, type = 'info', ms = 2200) {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon =
      type === 'success'
        ? 'fa-check-circle'
        : type === 'error'
        ? 'fa-exclamation-circle'
        : 'fa-info-circle';
    t.innerHTML = `<i class="fas ${icon}"></i><span>${msg}</span>`;
    els.toastContainer.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, ms);
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function saveStorage() {
    localStorage.setItem('notebot-notes', JSON.stringify(state.notes));
    localStorage.setItem('notebot-archived', JSON.stringify(state.archived));
    localStorage.setItem('notebot-theme', state.settings.theme);
    localStorage.setItem('notebot-ai-mode', state.settings.aiMode);
  }

  function loadStorage() {
    state.notes = JSON.parse(localStorage.getItem('notebot-notes') || '[]');
    state.archived = JSON.parse(
      localStorage.getItem('notebot-archived') || '[]'
    );

    if (state.notes.length === 0 && state.archived.length === 0) {
      state.notes.push({
        id: uid(),
        title: 'Welcome to Notebot.ai',
        content: `# Welcome

This is a clean demo build.

## Try:
- Create a note
- Write markdown
- Pin / archive
- Send note to chatbot`,
        tags: ['welcome', 'demo'],
        pinned: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      saveStorage();
    }
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    state.settings.theme = theme;
    saveStorage();
  }

  // ---------- Views ----------
  function showView(view) {
    state.view = view;

    els.notesView.classList.add('hidden');
    els.archivedView.classList.add('hidden');
    els.chatbotView.classList.add('hidden');
    els.settingsView.classList.add('hidden');

    if (view === 'notes') els.notesView.classList.remove('hidden');
    if (view === 'archived') els.archivedView.classList.remove('hidden');
    if (view === 'chatbot') els.chatbotView.classList.remove('hidden');
    if (view === 'settings') els.settingsView.classList.remove('hidden');

    els.navItems.forEach((it) => {
      const active = it.getAttribute('data-view') === view;
      it.classList.toggle('bg-primary', active);
      it.classList.toggle('text-white', active);
    });

    // keep selects/toggles in sync regardless of view
    if (els.aiModeSelect) els.aiModeSelect.value = state.settings.aiMode;
    if (els.darkToggle)
      els.darkToggle.checked = state.settings.theme === 'dark';

    if (view === 'notes') {
      renderNotesList();
      if (!state.currentNoteId && state.notes.length)
        selectNote(state.notes[0].id);
      if (!state.currentNoteId && state.notes.length === 0) createNote();
    }
    if (view === 'archived') renderArchivedList();
    if (view === 'chatbot') {
      ensureChatToolbar();
      renderChat({ forceScroll: true });
    }
  }

  // ---------- Notes ----------
  function createNoteWithContent(title, content, tags = []) {
    const n = {
      id: uid(),
      title: title || 'New Note',
      content: content || '',
      tags,
      pinned: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.notes.unshift(n);
    state.currentNoteId = n.id;
    saveStorage();
    renderNotesList(els.notesSearch.value);
    selectNote(n.id);
    return n;
  }

  function createNote() {
    const n = createNoteWithContent('New Note', '', []);
    showToast('New note created', 'success');
    return n;
  }

  function selectNote(id) {
    state.currentNoteId = id;
    const n = state.notes.find((x) => x.id === id);
    if (!n) return;

    els.title.value = n.title;
    els.content.value = n.content;
    els.tags.value = n.tags.join(', ');
    els.pinText.textContent = n.pinned ? 'Unpin' : 'Pin';
    els.pinBtn.classList.toggle('bg-primary', n.pinned);
    els.pinBtn.classList.toggle('text-white', n.pinned);

    document.querySelectorAll('.note-item').forEach((el) => {
      el.classList.toggle('selected', el.dataset.noteId === id);
    });

    renderTags();
    renderPreview();
  }

  function updateCurrentNote(partial) {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    if (!n) return;
    Object.assign(n, partial, { updatedAt: nowIso() });
    saveStorage();
  }

  function renderTags() {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    els.tagsDisplay.innerHTML = '';
    if (!n) return;
    n.tags.forEach((t) => {
      const s = document.createElement('span');
      s.className = 'tag-neo';
      s.textContent = t;
      els.tagsDisplay.appendChild(s);
    });
  }

  function renderPreview() {
    const html = marked.parse(els.content.value || '');
    els.preview.querySelector('.prose').innerHTML = html;
    els.preview
      .querySelectorAll('pre code')
      .forEach((b) => hljs.highlightElement(b));
  }

  function renderNotesList(filterTerm = '') {
    const term = filterTerm.trim().toLowerCase();
    const list = term
      ? state.notes.filter(
          (n) =>
            n.title.toLowerCase().includes(term) ||
            n.content.toLowerCase().includes(term) ||
            n.tags.some((t) => t.toLowerCase().includes(term))
        )
      : state.notes;

    const sorted = [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    els.notesList.innerHTML = '';
    if (sorted.length === 0) {
      els.notesList.innerHTML = `<p class="text-center text-muted-text py-8">No notes found.</p>`;
      return;
    }

    sorted.forEach((n) => {
      const item = document.createElement('div');
      item.className =
        'note-item border-neo p-3 cursor-pointer hover:bg-primary hover:text-white transition-colors';
      item.dataset.noteId = n.id;
      if (n.id === state.currentNoteId) item.classList.add('selected');

      const preview = n.content
        .replace(/^#+\s/gm, '')
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/\*|_/g, '')
        .slice(0, 120);

      item.innerHTML = `
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-lg truncate">${escapeHtml(n.title)}</h3>
          <div class="text-xs text-muted-text">${n.pinned ? '📌' : ''}</div>
        </div>
        <p class="text-sm mb-2 line-clamp-2">${escapeHtml(preview)}${
        n.content.length > 120 ? '…' : ''
      }</p>
        <div class="flex justify-between items-center text-xs text-muted-text">
          <span>${new Date(n.updatedAt).toLocaleDateString()}</span>
          <span>${n.tags.length ? `🏷️ ${n.tags.length}` : ''}</span>
        </div>
      `;
      item.addEventListener('click', () => selectNote(n.id));
      els.notesList.appendChild(item);
    });
  }

  function togglePin() {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    if (!n) return showToast('No note selected', 'error');
    updateCurrentNote({ pinned: !n.pinned });
    renderNotesList(els.notesSearch.value);
    selectNote(n.id);
    showToast(n.pinned ? 'Unpinned' : 'Pinned', 'info');
  }

  function confirmModal(title, message, action) {
    els.modalTitle.textContent = title;
    els.modalMessage.textContent = message;
    state.confirmAction = action;
    els.modalContainer.classList.remove('hidden');
    els.modalConfirm.focus();
  }

  function closeModal() {
    els.modalContainer.classList.add('hidden');
    state.confirmAction = null;
  }

  function archiveNote() {
    const id = state.currentNoteId;
    const idx = state.notes.findIndex((n) => n.id === id);
    if (idx === -1) return showToast('No note selected', 'error');

    confirmModal(
      'Archive Note',
      'Archive this note? You can restore it later.',
      () => {
        const n = state.notes[idx];
        n.pinned = false;
        n.updatedAt = nowIso();
        state.archived.unshift(n);
        state.notes.splice(idx, 1);
        saveStorage();
        renderNotesList(els.notesSearch.value);
        renderArchivedList();
        if (state.notes[0]) selectNote(state.notes[0].id);
        else {
          state.currentNoteId = null;
          createNote();
        }
        showToast('Archived', 'success');
      }
    );
  }

  function deleteNote() {
    const id = state.currentNoteId;
    const idx = state.notes.findIndex((n) => n.id === id);
    if (idx === -1) return showToast('No note selected', 'error');

    confirmModal(
      'Delete Note',
      'Delete permanently? This cannot be undone.',
      () => {
        const title = state.notes[idx].title;
        state.notes.splice(idx, 1);
        saveStorage();
        renderNotesList(els.notesSearch.value);
        if (state.notes[0]) selectNote(state.notes[0].id);
        else {
          state.currentNoteId = null;
          createNote();
        }
        showToast(`Deleted "${title}"`, 'error');
      }
    );
  }

  function exportMD() {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    if (!n) return showToast('No note selected', 'error');
    const body = `# ${n.title}\n\n${n.content}`;
    downloadFile(`${safeName(n.title)}.md`, body, 'text/markdown');
    showToast('Exported .md', 'success');
  }

  function exportTXT() {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    if (!n) return showToast('No note selected', 'error');
    const body = n.content.replace(/[#*`>-]/g, '').trim();
    downloadFile(`${safeName(n.title)}.txt`, body, 'text/plain');
    showToast('Exported .txt', 'success');
  }

  function renderArchivedList() {
    els.archivedList.innerHTML = '';
    if (state.archived.length === 0) {
      els.archivedList.innerHTML = `<p class="text-center text-muted-text py-8">No archived notes yet.</p>`;
      return;
    }

    state.archived.forEach((n) => {
      const item = document.createElement('div');
      item.className = 'border-neo bg-surface p-3';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-lg truncate">${escapeHtml(n.title)}</h3>
          <span class="text-xs text-muted-text">${new Date(
            n.updatedAt
          ).toLocaleDateString()}</span>
        </div>
        <p class="text-sm mb-2 line-clamp-2">${escapeHtml(
          n.content.slice(0, 140)
        )}${n.content.length > 140 ? '…' : ''}</p>
        <div class="flex justify-end gap-2">
          <button class="btn-neo text-xs" data-action="restore">Restore</button>
          <button class="btn-neo text-xs btn-danger" data-action="delete">Delete</button>
        </div>
      `;

      item
        .querySelector('[data-action="restore"]')
        .addEventListener('click', () => restoreArchived(n.id));
      item
        .querySelector('[data-action="delete"]')
        .addEventListener('click', () => deleteArchived(n.id));
      els.archivedList.appendChild(item);
    });
  }

  function restoreArchived(id) {
    confirmModal('Restore Note', 'Restore to active notes?', () => {
      const idx = state.archived.findIndex((n) => n.id === id);
      if (idx === -1) return;
      const n = state.archived[idx];
      n.updatedAt = nowIso();
      state.notes.unshift(n);
      state.archived.splice(idx, 1);
      saveStorage();
      renderArchivedList();
      showView('notes');
      selectNote(n.id);
      showToast('Restored', 'success');
    });
  }

  function deleteArchived(id) {
    confirmModal(
      'Delete Archived Note',
      'Delete permanently? This cannot be undone.',
      () => {
        const idx = state.archived.findIndex((n) => n.id === id);
        if (idx === -1) return;
        const t = state.archived[idx].title;
        state.archived.splice(idx, 1);
        saveStorage();
        renderArchivedList();
        showToast(`Deleted "${t}"`, 'error');
      }
    );
  }

  function sendCurrentNoteToChat() {
    const n = state.notes.find((x) => x.id === state.currentNoteId);
    if (!n) return showToast('No note selected', 'error');
    showView('chatbot');
    els.chatInput.value = `Summarize this note titled "${n.title}":\n\n${n.content}`;
    els.chatInput.focus();
    autoResize(els.chatInput);
    showToast('Copied note to chatbot', 'info');
  }

  // ---------- Chat ----------
  function ensureChatToolbar() {
    // Adds "Save Chat" button next to "New Session" if missing
    const existing = document.getElementById('chatbot-save-session-btn');
    if (existing || !els.chatNewBtn) return;

    const btn = document.createElement('button');
    btn.id = 'chatbot-save-session-btn';
    btn.className = 'btn-neo bg-accent text-background ml-2';
    btn.innerHTML = `<i class="fas fa-save mr-1"></i> Save Chat`;
    btn.addEventListener('click', saveFullChatToNote);

    els.chatNewBtn.parentElement.insertBefore(btn, els.chatNewBtn.nextSibling);
  }

  function isNearBottom(el, threshold = 80) {
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  function scrollToBottom() {
    if (!els.chatHistory) return;
    els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
  }

  function saveFullChatToNote() {
    if (!state.chat.length) return showToast('No chat to save', 'error');
    const transcript = state.chat
      .map((m) => `${m.role === 'user' ? 'User' : 'AI'}:\n${m.content}`)
      .join('\n\n');

    const title = `Chat ${new Date().toLocaleString()}`;
    createNoteWithContent(title, transcript, ['chat']);
    showView('notes');
    showToast('Chat saved to notes', 'success');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied', 'success');
    } catch {
      showToast('Copy failed', 'error');
    }
  }

  function renderChat({ forceScroll = false } = {}) {
    const stick = forceScroll || isNearBottom(els.chatHistory);

    els.chatHistory.innerHTML = '';
    if (state.chat.length === 0) {
      els.chatHistory.innerHTML = `<p class="text-center text-muted-text py-8">Start a conversation.</p>`;
      return;
    }

    state.chat.forEach((m) => {
      const row = document.createElement('div');
      row.className = `flex ${
        m.role === 'user' ? 'justify-end' : 'justify-start'
      }`;

      const bubble = document.createElement('div');
      bubble.className = `message-bubble max-w-[80%] p-3 border-neo ${
        m.role === 'user' ? 'bg-primary text-white' : 'bg-surface text-text'
      }`;

      const contentDiv = document.createElement('div');
      contentDiv.className = 'prose prose-sm max-w-none';
      contentDiv.innerHTML = marked.parse(m.content);
      bubble.appendChild(contentDiv);

      // Actions for assistant messages
      if (m.role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'flex gap-2 justify-end mt-2';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-neo text-xs';
        saveBtn.textContent = 'Save to Notes';
        saveBtn.addEventListener('click', () => {
          const title = `AI Reply ${new Date().toLocaleString()}`;
          createNoteWithContent(title, m.content, ['chat', 'ai']);
          showView('notes');
          showToast('Reply saved to notes', 'success');
        });

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-neo text-xs';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => copyText(m.content));

        actions.appendChild(copyBtn);
        actions.appendChild(saveBtn);
        bubble.appendChild(actions);
      }

      row.appendChild(bubble);
      els.chatHistory.appendChild(row);
    });

    els.chatHistory
      .querySelectorAll('pre code')
      .forEach((b) => hljs.highlightElement(b));
    if (stick) scrollToBottom();
  }

  function startNewChat() {
    state.chat = [];
    renderChat({ forceScroll: true });
    els.chatInput.value = '';
    autoResize(els.chatInput);
    showToast('New chat session', 'info');
  }

  async function sendChat() {
    const msg = els.chatInput.value.trim();
    if (!msg) return showToast('Type a message', 'error');

    state.chat.push({ role: 'user', content: msg, ts: nowIso() });
    els.chatInput.value = '';
    autoResize(els.chatInput);
    renderChat({ forceScroll: true });

    els.typing.classList.remove('hidden');
    try {
      const mode = state.settings.aiMode;
      const reply =
        mode === 'serverless'
          ? await callServerlessChat(state.chat)
          : await callSimulatedChat(msg);

      state.chat.push({ role: 'assistant', content: reply, ts: nowIso() });
      renderChat({ forceScroll: true });
    } catch (e) {
      state.chat.push({
        role: 'assistant',
        content: `Error: ${e.message}`,
        ts: nowIso(),
      });
      renderChat({ forceScroll: true });
      showToast('Chat failed', 'error');
    } finally {
      els.typing.classList.add('hidden');
    }
  }

  async function callSimulatedChat(latest) {
    await sleep(650 + Math.random() * 700);
    const s = latest.toLowerCase();
    if (s.includes('summarize'))
      return 'Simulated summary: this note contains key points and recommended next steps.';
    if (s.includes('action'))
      return 'Simulated action items:\n- Item 1\n- Item 2\n- Item 3';
    if (s.includes('rewrite'))
      return 'Simulated rewrite: a more professional version would tighten language and clarify intent.';
    return 'Simulated response: switch to Serverless mode in GitHub/Vercel to use real models.';
  }

  async function callServerlessChat(messages) {
    // Always send only what the API needs (role/content) to avoid schema issues.
    const clean = (messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const res = await fetch(API_CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: clean }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || data.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (!data || !data.content) throw new Error('Bad response');
    return data.content;
  }

  // ---------- Events ----------
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  }

  els.navItems.forEach((it) =>
    it.addEventListener('click', () => showView(it.dataset.view))
  );

  els.notesSearch.addEventListener('input', (e) =>
    renderNotesList(e.target.value)
  );
  els.newNoteBtn.addEventListener('click', createNote);

  els.title.addEventListener('input', () => {
    updateCurrentNote({ title: els.title.value || 'Untitled' });
    renderNotesList(els.notesSearch.value);
  });

  els.content.addEventListener('input', () => {
    updateCurrentNote({ content: els.content.value });
    renderPreview();
  });

  els.tags.addEventListener('input', () => {
    const raw = els.tags.value;
    const parsed = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateCurrentNote({ tags: parsed });
    renderTags();
    renderNotesList(els.notesSearch.value);
  });

  els.pinBtn.addEventListener('click', togglePin);
  els.archiveBtn.addEventListener('click', archiveNote);
  els.deleteBtn.addEventListener('click', deleteNote);
  els.exportMdBtn.addEventListener('click', exportMD);
  els.exportTxtBtn.addEventListener('click', exportTXT);
  els.sendToAiBtn.addEventListener('click', sendCurrentNoteToChat);

  els.chatNewBtn.addEventListener('click', startNewChat);
  els.chatSend.addEventListener('click', sendChat);
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });
  els.chatInput.addEventListener('input', () => autoResize(els.chatInput));

  els.promptBtns.forEach((b) =>
    b.addEventListener('click', () => {
      els.chatInput.value = b.dataset.template;
      autoResize(els.chatInput);
      els.chatInput.focus();
    })
  );

  els.aiModeSelect.addEventListener('change', () => {
    state.settings.aiMode = els.aiModeSelect.value;
    saveStorage();
    showToast(`Chat mode: ${state.settings.aiMode}`, 'info');
  });

  els.darkToggle.addEventListener('change', () => {
    applyTheme(els.darkToggle.checked ? 'dark' : 'light');
    showToast('Theme updated', 'info');
  });

  els.modalCancel.addEventListener('click', closeModal);
  els.modalClose.addEventListener('click', closeModal);
  els.modalConfirm.addEventListener('click', () => {
    const fn = state.confirmAction;
    closeModal();
    if (fn) fn();
  });
  els.modalContainer.addEventListener('click', (e) => {
    if (e.target === els.modalContainer) closeModal();
  });

  // ---------- Helpers ----------
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function safeName(s) {
    return (s || 'note').replace(/[^a-z0-9]/gi, '_').slice(0, 60);
  }
  function escapeHtml(str) {
    return (str || '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        }[c])
    );
  }

  // ---------- Init ----------
  loadStorage();
  applyTheme(state.settings.theme);
  if (els.aiModeSelect) els.aiModeSelect.value = state.settings.aiMode;
  if (els.darkToggle) els.darkToggle.checked = state.settings.theme === 'dark';
  showView('notes');
});
