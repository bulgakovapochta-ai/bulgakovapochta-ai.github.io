(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const closeMenu = () => {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded','false');
    nav.classList.remove('open');
    document.body.classList.remove('menu-open');
  };
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
      document.body.classList.toggle('menu-open', !open);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    window.addEventListener('resize', () => { if (innerWidth > 980) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const data = Array.isArray(window.KOBZEV_DOCUMENTS) ? window.KOBZEV_DOCUMENTS : [];
  const track = document.getElementById('documents-track');
  const viewport = document.getElementById('documents-viewport');
  const prev = document.getElementById('docs-prev');
  const next = document.getElementById('docs-next');
  const counter = document.getElementById('docs-counter');
  let index = 0;
  let visible = 3;

  const esc = value => String(value).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  if (track) {
    data.forEach((doc, i) => {
      const card = document.createElement('article');
      card.className = 'document-card';
      card.innerHTML = `
        <div class="document-preview">
          <object data="${esc(doc.file)}#page=1&view=FitH&toolbar=0&navpanes=0&scrollbar=0" type="application/pdf" aria-label="Превью PDF: ${esc(doc.title)}">
            <div class="pdf-fallback"><div><strong>PDF</strong><span>${esc(doc.title)}</span></div></div>
          </object>
          <a class="pdf-open-overlay" href="${esc(doc.file)}" target="_blank" rel="noopener" aria-label="Открыть PDF: ${esc(doc.title)}"><span>Открыть PDF ↗</span></a>
        </div>
        <div class="document-info">
          <div class="document-meta"><span>PDF · материал</span><span>${String(i+1).padStart(2,'0')}</span></div>
          <h3>${esc(doc.title)}</h3>
          <p>${esc(doc.description)}</p>
          <a class="document-link" href="${esc(doc.file)}" target="_blank" rel="noopener">Открыть в новой вкладке <span>↗</span></a>
        </div>`;
      track.appendChild(card);
    });
  }

  function calcVisible() {
    if (innerWidth <= 640) visible = 1;
    else if (innerWidth <= 1260) visible = 2;
    else visible = 3;
  }
  function maxIndex() { return Math.max(0, data.length - visible); }
  function updateCarousel() {
    if (!track || !viewport) return;
    calcVisible();
    index = Math.min(index, maxIndex());
    const card = track.querySelector('.document-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    track.style.transform = `translateX(${-index * step}px)`;
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= maxIndex();
    if (counter) counter.textContent = `${index + 1} / ${maxIndex() + 1}`;
  }
  prev?.addEventListener('click', () => { index = Math.max(0,index-1); updateCarousel(); });
  next?.addEventListener('click', () => { index = Math.min(maxIndex(),index+1); updateCarousel(); });
  let touchX = null;
  viewport?.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, {passive:true});
  viewport?.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 45) { index = Math.max(0, Math.min(maxIndex(), index + (dx < 0 ? 1 : -1))); updateCarousel(); }
    touchX = null;
  }, {passive:true});
  window.addEventListener('resize', updateCarousel);
  requestAnimationFrame(updateCarousel);


  // Contact form: AJAX on hosting, clear message in local preview.
  const leadForm = document.getElementById('lead-form');
  const formStatus = document.getElementById('form-status');
  const formStarted = document.getElementById('form-started');
  if (formStarted) formStarted.value = String(Math.floor(Date.now() / 1000));
  if (leadForm) {
    leadForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = leadForm.querySelector('[type="submit"]');
      const phone = leadForm.elements.phone?.value.trim() || '';
      const email = leadForm.elements.email?.value.trim() || '';
      if (!leadForm.checkValidity()) {
        leadForm.reportValidity();
        if (formStatus) { formStatus.textContent = 'Заполните обязательные поля и отметьте согласие.'; formStatus.className = 'form-status error'; }
        return;
      }
      if (!phone && !email) {
        if (formStatus) { formStatus.textContent = 'Укажите телефон или e-mail для обратной связи.'; formStatus.className = 'form-status error'; }
        return;
      }
      if (location.protocol === 'file:') {
        if (formStatus) { formStatus.textContent = 'Локальный просмотр: отправка заработает после загрузки сайта на PHP-хостинг.'; formStatus.className = 'form-status'; }
        return;
      }
      try {
        if (submit) submit.disabled = true;
        if (formStatus) { formStatus.textContent = 'Отправляю…'; formStatus.className = 'form-status'; }
        const response = await fetch(leadForm.action, { method: 'POST', body: new FormData(leadForm), headers: {'X-Requested-With':'XMLHttpRequest'} });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось отправить заявку.');
        leadForm.reset();
        if (formStarted) formStarted.value = String(Math.floor(Date.now() / 1000));
        if (formStatus) { formStatus.textContent = 'Заявка отправлена. Я получу её по e-mail.'; formStatus.className = 'form-status success'; }
      } catch (error) {
        if (formStatus) { formStatus.textContent = error.message || 'Ошибка отправки. Можно написать в VK или позвонить.'; formStatus.className = 'form-status error'; }
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  // Cookie preference notice. Only a technical preference cookie is used in this build.
  const cookieBanner = document.getElementById('cookie-banner');
  const getCookie = (name) => document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1] || '';
  const setCookieChoice = (choice) => {
    document.cookie = `kobzev_cookie_choice=${encodeURIComponent(choice)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    if (cookieBanner) cookieBanner.hidden = true;
  };
  if (cookieBanner && !getCookie('kobzev_cookie_choice')) cookieBanner.hidden = false;
  document.querySelectorAll('[data-cookie-choice]').forEach(btn => btn.addEventListener('click', () => setCookieChoice(btn.dataset.cookieChoice || 'essential')));

})();
\n\n// v0.4 — pointer-reactive service cards. Visual only: cards remain non-clickable.\n(() => {\n  const cards = document.querySelectorAll('.service-card');\n  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');\n  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');\n\n  if (!finePointer.matches || reducedMotion.matches) return;\n\n  cards.forEach((card) => {\n    const image = card.querySelector('.service-image img');\n\n    card.addEventListener('pointermove', (event) => {\n      const rect = card.getBoundingClientRect();\n      const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));\n      const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));\n      const rotateY = (px - 0.5) * 5.5;\n      const rotateX = (0.5 - py) * 5.5;\n      const imageX = (0.5 - px) * 5;\n      const imageY = (0.5 - py) * 5;\n\n      card.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);\n      card.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);\n      card.style.setProperty('--glow-x', `${(px * 100).toFixed(1)}%`);\n      card.style.setProperty('--glow-y', `${(py * 100).toFixed(1)}%`);\n\n      if (image) {\n        image.style.setProperty('--img-x', `${imageX.toFixed(2)}px`);\n        image.style.setProperty('--img-y', `${imageY.toFixed(2)}px`);\n      }\n    });\n\n    card.addEventListener('pointerleave', () => {\n      card.style.setProperty('--tilt-x', '0deg');\n      card.style.setProperty('--tilt-y', '0deg');\n      card.style.setProperty('--glow-x', '50%');\n      card.style.setProperty('--glow-y', '50%');\n      if (image) {\n        image.style.setProperty('--img-x', '0px');\n        image.style.setProperty('--img-y', '0px');\n      }\n    });\n  });\n})();\n