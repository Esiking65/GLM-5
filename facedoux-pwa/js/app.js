class FaceDouxApp {
  constructor() {
    this.ai = new FaceDouxAI();
    this.products = window.PRODUCTS;
    this.currentTab = 'home';
    this.selectedProduct = this.products[0].id;
    this.conversationHistory = this.loadHistory();
    this.reports = this.loadReports();
    this.recognition = null;
    this.isRecording = false;
    this.messageCounter = 0;
    this.queriesToday = this.getTodayQueries();
  }

  init() {
    this.registerServiceWorker();
    this.bindTabs();
    this.renderHome();
    this.renderProducts();
    this.renderQuickQuestions();
    this.populateProductSelect();
    this.bindChat();
    this.bindModal();
    this.bindMic();
    this.bindReports();
    this.bindSearch();
    this.updateStats();
    this.checkOnlineStatus();
    this.bindOnlineEvents();
    this.handleHash();
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('sw.js')
          .then((reg) => {
            console.log('Service Worker ثبت شد:', reg.scope);
          })
          .catch((err) => {
            console.warn('خطا در ثبت Service Worker:', err);
          });
      });
    }
  }

  bindTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        this.switchTab(target);
      });
    });
  }

  switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${name}"]`)?.classList.add('active');
    document.getElementById(`panel-${name}`)?.classList.add('active');
    this.currentTab = name;
    if (name === 'reports') this.renderReports();
  }

  handleHash() {
    if (location.hash === '#chat') this.switchTab('chat');
  }

  renderHome() {
    const grid = document.getElementById('quickGrid');
    grid.innerHTML = this.products.slice(0, 4).map((p) => `
      <button class="quick-item" data-product="${p.id}">
        <span class="qi-icon">${p.icon}</span>
        <span>${p.name}</span>
      </button>
    `).join('');

    grid.querySelectorAll('.quick-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openProductModal(btn.dataset.product);
      });
    });
  }

  renderProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = this.products.map((p) => `
      <div class="product-card" data-product="${p.id}">
        <div class="product-card-head">
          <div>
            <div class="product-name">${p.icon} ${p.name}</div>
            <span class="product-cat">${p.category}</span>
          </div>
        </div>
        <div class="product-desc">${p.description}</div>
        <div class="product-actions">
          <button class="btn btn-primary" data-action="golden" data-product="${p.id}">
            ۳ جمله طلایی
          </button>
          <button class="btn btn-secondary" data-action="detail" data-product="${p.id}">
            جزئیات کامل
          </button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const pid = btn.dataset.product;
        if (action === 'golden') {
          this.openGoldenSentences(pid);
        } else {
          this.openProductModal(pid);
        }
      });
    });

    grid.querySelectorAll('.product-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.openProductModal(card.dataset.product);
      });
    });
  }

  bindSearch() {
    const input = document.getElementById('productSearch');
    input.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.product-card').forEach((card) => {
        const name = card.querySelector('.product-name').textContent.toLowerCase();
        const desc = card.querySelector('.product-desc').textContent.toLowerCase();
        const visible = !term || name.includes(term) || desc.includes(term);
        card.style.display = visible ? '' : 'none';
      });
    });
  }

  populateProductSelect() {
    const select = document.getElementById('chatProductSelect');
    select.innerHTML = this.products.map((p) =>
      `<option value="${p.id}">${p.icon} ${p.name}</option>`
    ).join('');
    select.value = this.selectedProduct;
    select.addEventListener('change', (e) => {
      this.selectedProduct = e.target.value;
    });
  }

  renderQuickQuestions() {
    const container = document.getElementById('quickQuestions');
    container.innerHTML = window.QUICK_QUESTIONS.map((q) =>
      `<button class="quick-q">${q}</button>`
    ).join('');

    container.querySelectorAll('.quick-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('chatInput').value = btn.textContent;
        this.handleChatSubmit(btn.textContent);
      });
    });
  }

  bindChat() {
    const form = document.getElementById('chatForm');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;
      this.handleChatSubmit(text);
      input.value = '';
    });

    this.renderChatHistory();
  }

  async handleChatSubmit(text) {
    if (!text) return;

    if (this.conversationHistory.length === 0) {
      const empty = document.querySelector('.chat-empty');
      if (empty) empty.remove();
    }

    this.appendMessage('user', text);
    this.queriesToday++;
    this.updateStats();

    const typingEl = this.appendTyping();

    try {
      const result = await this.ai.query(text, this.selectedProduct);

      typingEl.remove();

      if (result.type === 'error') {
        this.appendMessage('bot', result.text);
        return;
      }

      const botMsgEl = this.appendMessage('bot', result.text, {
        citations: result.citations,
        product: result.product,
        processingTime: result.processingTime,
        intent: result.intent
      });

      this.conversationHistory.push({
        id: ++this.messageCounter,
        role: 'user',
        text,
        product: this.selectedProduct,
        timestamp: Date.now()
      });
      this.conversationHistory.push({
        id: ++this.messageCounter,
        role: 'bot',
        text: result.text,
        product: result.product.id,
        timestamp: Date.now()
      });
      this.saveHistory();
    } catch (err) {
      typingEl.remove();
      this.appendMessage('bot', 'خطا در پردازش سوال. لطفاً دوباره تلاش کنید.');
      console.error(err);
    }
  }

  appendMessage(role, text, meta = {}) {
    const container = document.getElementById('chatMessages');
    const msgId = `msg-${++this.messageCounter}`;

    const msgEl = document.createElement('div');
    msgEl.className = `msg ${role}`;
    msgEl.id = msgId;

    let html = `<div class="msg-bubble">${this.formatMessage(text)}`;
    if (meta.citations && meta.citations.length) {
      html += '<div style="margin-top:8px;">';
      meta.citations.forEach((c) => {
        html += `<span class="citation-tag">📄 ${c}</span>`;
      });
      html += '</div>';
    }
    html += '</div>';

    if (role === 'bot' && meta.product) {
      html += `<div class="msg-meta">`;
      html += `<span>${meta.processingTime || 0}ms</span>`;
      html += `<span>•</span>`;
      html += `<span>${meta.product.name}</span>`;
      html += `<div class="feedback-btns">`;
      html += `<button class="feedback-btn" data-feedback="up" data-msg="${msgId}">👍</button>`;
      html += `<button class="feedback-btn" data-feedback="down" data-msg="${msgId}">👎</button>`;
      html += `</div>`;
      html += `</div>`;
    }

    msgEl.innerHTML = html;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;

    if (role === 'bot') {
      msgEl.querySelectorAll('.feedback-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rating = btn.dataset.feedback;
          msgEl.querySelectorAll('.feedback-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.ai.recordFeedback(msgId, rating);
          this.showToast(rating === 'up' ? 'بازخورد ثبت شد ✓' : 'گزارش شما بررسی می‌شود', 'success');

          if (rating === 'down') {
            this.addReport(text, meta.product, 'پاسخ نامطلوب - نیاز به بررسی');
          }
        });
      });
    }

    return msgEl;
  }

  appendTyping() {
    const container = document.getElementById('chatMessages');
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `
      <div class="msg-bubble">
        <div class="typing">
          <span></span><span></span><span></span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
          در حال تحلیل منابع علمی...
        </div>
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  formatMessage(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^• /gm, '◦ ')
      .replace(/^(\d+)\. /gm, '$1. ')
      .replace(/\n/g, '<br>')
      .replace(/❓|💡|📄|📚|✓/g, (m) => `<span style="font-size:14px">${m}</span>`);
  }

  bindMic() {
    const btn = document.getElementById('micBtn');
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      btn.title = 'مرورگر شما از ضبط صوتی پشتیبانی نمی‌کند';
      btn.style.opacity = '0.5';
      btn.disabled = true;
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'fa-IR';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      document.getElementById('chatInput').value = text;
      this.handleChatSubmit(text);
    };

    this.recognition.onerror = (e) => {
      this.stopRecording();
      this.showToast('خطا در ضبط صدا', 'error');
    };

    this.recognition.onend = () => {
      this.stopRecording();
    };

    btn.addEventListener('click', () => {
      if (this.isRecording) {
        this.recognition.stop();
        this.stopRecording();
      } else {
        try {
          this.recognition.start();
          this.isRecording = true;
          btn.classList.add('recording');
          this.showToast('در حال ضبط... سوال خود را بگویید', 'warning');
        } catch (err) {
          this.showToast('خطا در شروع ضبط', 'error');
        }
      }
    });
  }

  stopRecording() {
    this.isRecording = false;
    document.getElementById('micBtn').classList.remove('recording');
  }

  bindModal() {
    const modal = document.getElementById('productModal');
    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', () => this.closeModal());
    });
  }

  openProductModal(productId) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;

    const body = document.getElementById('modalBody');
    body.innerHTML = `
      <div class="modal-title">${product.icon} ${product.name}</div>
      <span class="modal-cat">${product.category}</span>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">${product.description}</p>

      <div class="info-section">
        <h4>🧪 ترکیبات کلیدی</h4>
        <ul>${product.composition.map((c) => `<li>${c}</li>`).join('')}</ul>
      </div>

      <div class="info-section">
        <h4>💊 کاربردها و اندیکاسیون‌ها</h4>
        <ul>${product.indications.map((i) => `<li>${i}</li>`).join('')}</ul>
      </div>

      <div class="info-section">
        <h4>⚖️ مقایسه با رقبا</h4>
        <div class="competitor-compare">
          ${product.competitors.map((c) => `
            <div class="compare-row">
              <strong>${c.name}</strong>
              <p>${c.weakness}</p>
            </div>
          `).join('')}
          <div class="compare-row us">
            <strong>${product.name} (فیس دوکس) ✓</strong>
            <p>${product.goldenSentences[0]}</p>
          </div>
        </div>
      </div>

      <div class="info-section">
        <h4>📚 منابع علمی</h4>
        <ul>${product.scientificSources.map((s) =>
          `<li><strong>${s.code}</strong>: ${s.text}</li>`
        ).join('')}</ul>
      </div>

      <div class="info-section">
        <h4>❓ سوالات متداول</h4>
        ${product.faqs.map((f) => `
          <div style="margin-bottom:8px;">
            <strong style="color:var(--text);font-size:12px;">${f.q}</strong>
            <p style="margin-top:2px;">${f.a}</p>
          </div>
        `).join('')}
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-primary" id="modalGoldenBtn">
          نمایش ۳ جمله طلایی
        </button>
        <button class="btn btn-secondary" id="modalChatBtn">
          پرسش سوال
        </button>
      </div>
    `;

    document.getElementById('productModal').classList.add('open');
    document.body.style.overflow = 'hidden';

    document.getElementById('modalGoldenBtn').addEventListener('click', () => {
      this.closeModal();
      this.openGoldenSentences(productId);
    });

    document.getElementById('modalChatBtn').addEventListener('click', () => {
      this.closeModal();
      this.selectedProduct = productId;
      document.getElementById('chatProductSelect').value = productId;
      this.switchTab('chat');
    });
  }

  openGoldenSentences(productId) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;

    const body = document.getElementById('modalBody');
    body.innerHTML = `
      <div class="modal-title">⭐ ${product.name}</div>
      <span class="modal-cat">${product.category}</span>
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
        ۳ جمله طلایی برای استفاده در پرزنت
      </p>

      <div class="golden-section">
        <div class="golden-title">✨ جملات آماده پرزنت</div>
        <ol class="golden-list">
          ${product.goldenSentences.map((s) => `<li>${s}</li>`).join('')}
        </ol>
      </div>

      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-primary" id="copyGoldenBtn">
          📋 کپی متن
        </button>
        <button class="btn btn-secondary" id="useInChatBtn">
          استفاده در چت
        </button>
      </div>
    `;

    document.getElementById('productModal').classList.add('open');

    document.getElementById('copyGoldenBtn').addEventListener('click', () => {
      const text = product.goldenSentences.join('\n\n');
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('متن کپی شد ✓', 'success');
      }).catch(() => {
        this.showToast('خطا در کپی', 'error');
      });
    });

    document.getElementById('useInChatBtn').addEventListener('click', () => {
      this.closeModal();
      this.selectedProduct = productId;
      document.getElementById('chatProductSelect').value = productId;
      this.switchTab('chat');
      document.getElementById('chatInput').value = '۳ جمله طلایی محصول را بگو';
      this.handleChatSubmit('۳ جمله طلایی محصول را بگو');
    });
  }

  closeModal() {
    document.getElementById('productModal').classList.remove('open');
    document.body.style.overflow = '';
  }

  bindReports() {
    document.getElementById('exportReportsBtn').addEventListener('click', () => {
      this.exportReports();
    });
  }

  addReport(text, product, note = '') {
    this.reports.push({
      id: Date.now(),
      product: product.name,
      productId: product.id,
      text,
      note,
      timestamp: Date.now()
    });
    this.saveReports();
    this.updateStats();
  }

  renderReports() {
    const list = document.getElementById('reportsList');
    if (this.reports.length === 0) {
      list.innerHTML = '<div class="report-empty">هنوز گزارشی ثبت نشده است.</div>';
      return;
    }

    list.innerHTML = this.reports
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((r) => `
        <div class="report-item">
          <div class="report-head">
            <span class="report-product">${r.product}</span>
            <span>${new Date(r.timestamp).toLocaleString('fa-IR')}</span>
          </div>
          <div class="report-text">${r.text}</div>
          ${r.note ? `<div style="font-size:11px;color:var(--danger);margin-top:4px;">⚠ ${r.note}</div>` : ''}
        </div>
      `).join('');
  }

  exportReports() {
    if (this.reports.length === 0) {
      this.showToast('گزارشی برای خروجی وجود ندارد', 'warning');
      return;
    }
    const data = JSON.stringify(this.reports, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facedoux-reports-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('گزارش‌ها خروجی گرفته شد ✓', 'success');
  }

  showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.className = 'toast';
    }, 2500);
  }

  updateStats() {
    document.getElementById('statProducts').textContent = this.products.length;
    document.getElementById('statQueries').textContent = this.queriesToday;
    document.getElementById('statReports').textContent = this.reports.length;
  }

  checkOnlineStatus() {
    const indicator = document.getElementById('statusIndicator');
    const dot = indicator.querySelector('.status-dot');
    const text = document.getElementById('statusText');

    if (navigator.onLine) {
      dot.classList.remove('offline');
      text.textContent = 'آماده';
    } else {
      dot.classList.add('offline');
      text.textContent = 'آفلاین';
    }
  }

  bindOnlineEvents() {
    window.addEventListener('online', () => {
      this.checkOnlineStatus();
      this.showToast('اتصال اینترنت برقرار شد', 'success');
    });
    window.addEventListener('offline', () => {
      this.checkOnlineStatus();
      this.showToast('حالت آفلاین - پاسخ‌های محلی فعال است', 'warning');
    });
  }

  loadHistory() {
    try {
      return JSON.parse(localStorage.getItem('facedoux_history') || '[]');
    } catch {
      return [];
    }
  }

  saveHistory() {
    try {
      const trimmed = this.conversationHistory.slice(-50);
      localStorage.setItem('facedoux_history', JSON.stringify(trimmed));
    } catch (e) {
      console.warn('ذخیره تاریخچه ناموفق', e);
    }
  }

  loadReports() {
    try {
      return JSON.parse(localStorage.getItem('facedoux_reports') || '[]');
    } catch {
      return [];
    }
  }

  saveReports() {
    try {
      localStorage.setItem('facedoux_reports', JSON.stringify(this.reports));
    } catch (e) {
      console.warn('ذخیره گزارش‌ها ناموفق', e);
    }
  }

  getTodayQueries() {
    try {
      const data = JSON.parse(localStorage.getItem('facedoux_today') || '{}');
      const today = new Date().toDateString();
      if (data.date === today) return data.count || 0;
      return 0;
    } catch {
      return 0;
    }
  }

  saveTodayQueries() {
    try {
      localStorage.setItem('facedoux_today', JSON.stringify({
        date: new Date().toDateString(),
        count: this.queriesToday
      }));
    } catch (e) {
      console.warn(e);
    }
  }

  renderChatHistory() {
    if (this.conversationHistory.length === 0) return;
    const container = document.getElementById('chatMessages');
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    this.conversationHistory.forEach((msg) => {
      if (msg.role === 'user') {
        this.appendMessage('user', msg.text);
      } else {
        const product = this.products.find((p) => p.id === msg.product);
        this.appendMessage('bot', msg.text, { product });
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new FaceDouxApp();
  app.init();
  window.facedouxApp = app;
});
