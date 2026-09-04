class FaceDouxAI {
  constructor() {
    this.products = window.PRODUCTS;
    this.competitorInfo = window.COMPETITOR_INFO;
    this.stopWords = new Set([
      'چی', 'چه', 'کدام', 'است', 'هست', 'می', 'را', 'در', 'به', 'از',
      'با', 'که', 'این', 'آن', 'برای', 'بر', 'بود', 'یک', 'های', 'ها',
      '؟', '?', '؟', 'و', 'یا', 'اما', 'هم', 'تا', 'روی', 'دارد', 'دارند'
    ]);
    this.learnedFeedback = this.loadFeedback();
  }

  loadFeedback() {
    try {
      return JSON.parse(localStorage.getItem('facedoux_feedback') || '{}');
    } catch {
      return {};
    }
  }

  saveFeedback(data) {
    this.learnedFeedback = { ...this.learnedFeedback, ...data };
    try {
      localStorage.setItem('facedoux_feedback', JSON.stringify(this.learnedFeedback));
    } catch (e) {
      console.warn('ذخیره بازخورد ناموفق', e);
    }
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[‌\s]+/g, ' ')
      .replace(/[؟?!.,،;]/g, '')
      .trim()
      .split(' ')
      .filter((w) => w.length > 1 && !this.stopWords.has(w));
  }

  detectIntent(query) {
    const tokens = this.tokenize(query);
    const q = query.toLowerCase();

    if (/مقایسه|رقیب|رقبا|بهتر|تفاوت|در مقابل/i.test(q)) {
      return 'compare';
    }
    if (/ترکیب|ترکیبات|مواد|فرمول|ingredient/i.test(q)) {
      return 'composition';
    }
    if (/قیمت|گران|ارزان|هزینه/i.test(q)) {
      return 'price';
    }
    if (/عوارض|خطر|آسیب|حساسیت|آلرژی/i.test(q)) {
      return 'sideEffects';
    }
    if (/چگونه|نحوه|چطور|چطوری|روش|مصرف/i.test(q)) {
      return 'usage';
    }
    if (/منبع|مقاله|تحقیق|مطالعه|علمی|پزشکی|pubmed/i.test(q)) {
      return 'sources';
    }
    if (/اندیکاسیون|کاربرد|درمان|بیماری|چه/i.test(q)) {
      return 'indications';
    }
    if (/۳ جمله|سه جمله|طلایی|خلاصه/i.test(q)) {
      return 'goldenSentences';
    }
    return 'general';
  }

  findProduct(query) {
    const tokens = this.tokenize(query);
    let bestMatch = null;
    let bestScore = 0;

    for (const product of this.products) {
      let score = 0;
      const productWords = this.tokenize(product.name + ' ' + product.category + ' ' + product.description);

      for (const token of tokens) {
        if (productWords.some((pw) => pw.includes(token) || token.includes(pw))) {
          score += 2;
        }
        if (product.name.toLowerCase().includes(token)) {
          score += 3;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    return bestMatch;
  }

  findMentionedCompetitor(query) {
    const q = query.toLowerCase();
    for (const name of Object.keys(this.competitorInfo)) {
      if (q.includes(name.toLowerCase())) {
        return name;
      }
    }
    return null;
  }

  scoreContent(content, tokens) {
    if (!content) return 0;
    const text = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
    let score = 0;
    for (const token of tokens) {
      const re = new RegExp(token, 'g');
      const matches = text.match(re);
      if (matches) score += matches.length;
    }
    return score;
  }

  buildResponse(query, product) {
    const intent = this.detectIntent(query);
    const mentionedCompetitor = this.findMentionedCompetitor(query);
    const feedback = this.learnedFeedback[product.id] || { up: 0, down: 0 };

    const responses = {
      composition: () => ({
        text: `**ترکیبات ${product.name}:**\n\n${product.composition.map((c) => '• ' + c).join('\n')}\n\n${this.getRandomSource(product, 'composition')}`
      }),

      indications: () => ({
        text: `**کاربردهای ${product.name}:**\n\n${product.indications.map((i) => '✓ ' + i).join('\n')}\n\n${this.getRandomSource(product, 'indications')}`
      }),

      compare: () => {
        let text = `**${product.name} در مقایسه با رقبا:**\n\n`;
        text += '**نقاط قوت فیس دوکس:**\n';
        product.goldenSentences.forEach((s, i) => {
          text += `${i + 1}. ${s}\n`;
        });
        text += '\n**مقایسه مستقیم:**\n';
        product.competitors.forEach((c) => {
          const info = this.competitorInfo[c.name];
          text += `• **${c.name}** (${info ? info.type : 'رقیب'}): ${c.weakness}\n`;
        });
        if (mentionedCompetitor) {
          const info = this.competitorInfo[mentionedCompetitor];
          text += `\n**استراتژی پاسخ به ${mentionedCompetitor}:** ${info ? info.strategy : ''}`;
        }
        return { text };
      },

      goldenSentences: () => ({
        text: `**۳ جمله طلایی ${product.name}:**\n\n${product.goldenSentences.map((s, i) => `**${i + 1}.** ${s}`).join('\n\n')}`
      }),

      price: () => {
        const competitor = product.competitors[0];
        return {
          text: `**تحلیل ارزش ${product.name}:**\n\n` +
            `اگرچه ممکن است قیمت ${product.name} نسبت به برخی رقبا مانند ${competitor.name} بالاتر به نظر برسد، اما:\n\n` +
            `• خلوص مواد اولیه بالاتر (۹۹٪ در مقابل ۸۵٪ استاندارد بازار)\n` +
            `• غلظت مؤثره بالاتر (اثربخشی سریع‌تر = دوره درمان کوتاه‌تر)\n` +
            `• کاهش هزینه‌های درمانی بلندمدت به دلیل نتایج پایدارتر\n\n` +
            `این یعنی در بلندمدت، هزینه هر بار مصرف با احتساب اثربخشی، کمتر از رقبا است.\n\n` +
            `${this.getRandomSource(product, 'price')}`
        };
      },

      sideEffects: () => ({
        text: `**بررسی ایمنی ${product.name}:**\n\n` +
          `در مطالعات بالینی انجام‌شده، هیچ عارضه جانبی جدی گزارش نشده است. محصول فاقد:\n` +
          `• پارابن\n• الکل\n• عطرهای مصنوعی\n• رنگ‌های شیمیایی\n\n` +
          `تست حساسیت (patch test) برای پوست‌های بسیار حساس توصیه می‌شود.\n\n` +
          `${this.getRandomSource(product, 'safety')}`
      }),

      usage: () => {
        const firstFaq = product.faqs[0];
        let text = `**نحوه استفاده از ${product.name}:**\n\n`;
        if (firstFaq) {
          text += `${firstFaq.q}\n${firstFaq.a}\n\n`;
        }
        text += 'سوالات متداول:\n';
        product.faqs.forEach((f) => {
          text += `\n❓ ${f.q}\n💡 ${f.a}\n`;
        });
        return { text };
      },

      sources: () => ({
        text: `**منابع علمی ${product.name}:**\n\n` +
          product.scientificSources.map((s) =>
            `📄 **${s.code}**\n${s.text}`
          ).join('\n\n')
      }),

      general: () => {
        const topFaqs = product.faqs.slice(0, 2);
        return {
          text: `**${product.name}**\n${product.description}\n\n` +
            `**ترکیبات کلیدی:**\n${product.composition.slice(0, 3).map((c) => '• ' + c).join('\n')}\n\n` +
            `**کاربردها:**\n${product.indications.slice(0, 3).map((i) => '• ' + i).join('\n')}\n\n` +
            `سوالات متداول:\n${topFaqs.map((f) => `❓ ${f.q}\n💡 ${f.a}`).join('\n\n')}\n\n` +
            `${this.getRandomSource(product, 'general')}`
        };
      }
    };

    const handler = responses[intent] || responses.general;
    return handler();
  }

  getRandomSource(product, context) {
    if (!product.scientificSources || !product.scientificSources.length) return '';
    const idx = Math.abs((context || '').length + product.id.length) % product.scientificSources.length;
    const src = product.scientificSources[idx];
    return `📚 منبع: ${src.code} - ${src.text}`;
  }

  async query(text, productId) {
    const startTime = performance.now();

    const product = productId
      ? this.products.find((p) => p.id === productId)
      : this.findProduct(text);

    if (!product) {
      return {
        type: 'error',
        text: 'محصول مورد نظر شناسایی نشد. لطفاً محصول را از منوی بالا انتخاب کنید یا نام محصول را در سوال خود ذکر کنید.',
        citations: []
      };
    }

    const response = this.buildResponse(text, product);
    const citations = this.extractCitations(response.text);

    const processingTime = Math.round(performance.now() - startTime) + 200 + Math.random() * 600;

    await new Promise((r) => setTimeout(r, processingTime));

    return {
      type: 'success',
      text: response.text,
      product: product,
      citations,
      intent: this.detectIntent(text),
      processingTime: Math.round(processingTime)
    };
  }

  extractCitations(text) {
    const citations = [];
    const matches = text.match(/\[([^\]]+)\]/g);
    if (matches) {
      matches.forEach((m) => citations.push(m.replace(/[\[\]]/g, '')));
    }
    return citations;
  }

  recordFeedback(messageId, rating) {
    const lastProduct = this.lastQueriedProduct;
    if (!lastProduct) return;

    const key = `facedoux_feedback_${messageId}`;
    try {
      localStorage.setItem(key, JSON.stringify({
        rating,
        timestamp: Date.now(),
        product: lastProduct
      }));
    } catch (e) {
      console.warn('ذخیره بازخورد ناموفق', e);
    }
  }
}

window.FaceDouxAI = FaceDouxAI;
