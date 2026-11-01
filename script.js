
(function() {
  'use strict';

  const STORAGE_KEY = 'travelDiary_trips';
  const DRAFT_KEY = 'travelDiary_draft';

  /* ===== Утилиты ===== */
  function uuid() {
    return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadTrips() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Ошибка загрузки:', e);
      return [];
    }
  }

  function saveTrips(trips) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      return true;
    } catch (e) {
      alert('Не удалось сохранить данные: превышен лимит хранилища браузера. Удалите часть фотографий.');
      return false;
    }
  }

  function parseDate(str) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(str || '');
    if (!m) return null;
    const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
    if (mo < 1 || mo > 12) return null;
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  function daysBetween(start, end) {
    const ms = end.getTime() - start.getTime();
    return Math.floor(ms / 86400000) + 1;
  }

  function formatDuration(days) {
    const mod10 = days % 10, mod100 = days % 100;
    let word = 'дней';
    if (mod10 === 1 && mod100 !== 11) word = 'день';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'дня';
    return days + ' ' + word;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[s]));
  }

  /* ===== Навигация ===== */
  const tabs = document.querySelectorAll('.tabs button');
  const sections = {
    list: document.getElementById('sec-list'),
    detail: document.getElementById('sec-detail'),
    add: document.getElementById('sec-add'),
    stats: document.getElementById('sec-stats')
  };
  const tabButtons = { list: tabs[0], add: tabs[1], stats: tabs[2] };

  function switchTab(name) {
    Object.values(sections).forEach(s => s.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    sections[name].classList.add('active');
    if (tabButtons[name]) tabButtons[name].classList.add('active');
    if (name === 'list') renderList();
    if (name === 'stats') renderStats();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'add' && editingId !== null) {
        resetFormToAddMode();
      }
      switchTab(btn.dataset.tab);
    });
  });

  /* ===== Список поездок ===== */
  const tripsContainer = document.getElementById('trips-container');

  function renderList() {
    const trips = loadTrips();
    if (trips.length === 0) {
      tripsContainer.innerHTML = '<div class="empty">Пока нет поездок. Добавьте первую!</div>';
      return;
    }
    const sorted = [...trips].sort((a, b) => {
      const da = parseDate(a.startDate) || new Date(0);
      const db = parseDate(b.startDate) || new Date(0);
      return db - da;
    });

    tripsContainer.innerHTML = '<div class="cards-grid">' + sorted.map(trip => {
      const mainPhoto = (trip.photos && trip.photos[0]) ?
        `background-image:url('${escapeHtml(trip.photos[0])}')` : '';
      const photoText = mainPhoto ? '' : 'Нет фото';
      return `
        <div class="card" data-id="${escapeHtml(trip.id)}">
          <div class="img" style="${mainPhoto}">${photoText}</div>
          <div class="body">
            <h3>${escapeHtml(trip.city)}</h3>
            <div class="country">${escapeHtml(trip.country)}</div>
            <div class="dates">${escapeHtml(trip.startDate)} — ${escapeHtml(trip.endDate)}</div>
          </div>
        </div>
      `;
    }).join('') + '</div>';

    tripsContainer.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => showDetail(card.dataset.id));
    });
  }

  /* ===== Детальный просмотр ===== */
  const detailContent = document.getElementById('detail-content');

  function showDetail(id) {
    const trips = loadTrips();
    const trip = trips.find(t => t.id === id);
    if (!trip) { switchTab('list'); return; }

    const start = parseDate(trip.startDate);
    const end = parseDate(trip.endDate);
    const days = (start && end) ? daysBetween(start, end) : 0;

    const photosHtml = (trip.photos && trip.photos.length)
      ? trip.photos.map(src =>
          `<img src="${escapeHtml(src)}" alt="Фото" loading="lazy">`
        ).join('')
      : '<div class="placeholder">Нет фотографий</div>';

    detailContent.innerHTML = `
      <h2>${escapeHtml(trip.city)}</h2>
      <div class="sub">${escapeHtml(trip.country)}</div>
      <div class="meta">
        ${escapeHtml(trip.startDate)} — ${escapeHtml(trip.endDate)}
        &nbsp;|&nbsp; ${formatDuration(days)}
      </div>
      <h3 style="margin-bottom:8px;">Галерея</h3>
      <div class="gallery">${photosHtml}</div>
      <h3 style="margin-top:16px;">Впечатления</h3>
      <div class="impressions">${trip.impressions ? escapeHtml(trip.impressions) : 'Впечатления не добавлены.'}</div>
      <div class="detail-actions">
        <button class="btn btn-ghost" id="back-btn">Назад к списку</button>
        <button class="btn btn-primary" id="edit-btn">Редактировать</button>
        <button class="btn btn-danger" id="delete-btn">Удалить поездку</button>
      </div>
    `;

    detailContent.querySelectorAll('.gallery img').forEach(img => {
      img.addEventListener('click', () => openLightbox(img.src));
    });

    document.getElementById('back-btn').addEventListener('click', () => switchTab('list'));
    document.getElementById('edit-btn').addEventListener('click', () => startEdit(trip));
    document.getElementById('delete-btn').addEventListener('click', () => {
      if (confirm('Удалить эту поездку?')) {
        const updated = loadTrips().filter(t => t.id !== id);
        saveTrips(updated);
        switchTab('list');
      }
    });

    Object.values(sections).forEach(s => s.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    sections.detail.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ===== Лайтбокс ===== */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.add('show');
  }
  document.getElementById('lightbox-close').addEventListener('click', () => {
    lightbox.classList.remove('show');
  });
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) lightbox.classList.remove('show');
  });

  /* ===== Форма ===== */
  const form = document.getElementById('trip-form');
  const formTitle = document.getElementById('form-title');
  const editBadge = document.getElementById('edit-badge');
  const submitBtn = document.getElementById('submit-btn');
  const cancelEditBtn = document.getElementById('cancel-edit');
  const countryInput = document.getElementById('country');
  const cityInput = document.getElementById('city');
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  const impressionsInput = document.getElementById('impressions');
  const photoInput = document.getElementById('photo-input');
  const photoFileInput = document.getElementById('photo-file-input');
  const uploadPhotoBtn = document.getElementById('upload-photo-btn');
  const addPhotoBtn = document.getElementById('add-photo-btn');
  const photoList = document.getElementById('photo-list');
  const durationInfo = document.getElementById('duration-info');
  const clearDraftBtn = document.getElementById('clear-draft');

  let draftPhotos = [];
  let editingId = null;

  const nameRegex = /^[A-Za-zА-Яа-яЁё\s\-']{2,50}$/;

  function setError(input, errEl, show) {
    input.classList.toggle('error', show);
    errEl.classList.toggle('show', show);
  }

  function validateCountry() {
    const ok = nameRegex.test(countryInput.value.trim());
    setError(countryInput, document.getElementById('err-country'), !ok);
    return ok;
  }
  function validateCity() {
    const ok = nameRegex.test(cityInput.value.trim());
    setError(cityInput, document.getElementById('err-city'), !ok);
    return ok;
  }
  function validateStart() {
    const ok = parseDate(startInput.value.trim()) !== null;
    setError(startInput, document.getElementById('err-startDate'), !ok);
    return ok;
  }
  function validateEnd() {
    const start = parseDate(startInput.value.trim());
    const end = parseDate(endInput.value.trim());
    const ok = end !== null && (!start || end >= start);
    setError(endInput, document.getElementById('err-endDate'), !ok);
    return ok;
  }

  function updateDuration() {
    const start = parseDate(startInput.value.trim());
    const end = parseDate(endInput.value.trim());
    if (start && end && end >= start) {
      const days = daysBetween(start, end);
      durationInfo.textContent = 'Длительность поездки: ' + formatDuration(days);
      durationInfo.classList.add('show');
    } else {
      durationInfo.classList.remove('show');
    }
  }

  [countryInput, cityInput, startInput, endInput].forEach(inp => {
    inp.addEventListener('input', () => {
      if (inp === countryInput) validateCountry();
      if (inp === cityInput) validateCity();
      if (inp === startInput) { validateStart(); validateEnd(); }
      if (inp === endInput) validateEnd();
      updateDuration();
      if (editingId === null) saveDraft();
    });
  });

  /* ===== Фотографии ===== */
  function normalizeUrl(raw) {
    let url = (raw || '').trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      const u = new URL(url);
      if (!u.hostname || u.hostname.indexOf('.') === -1) return null;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  function renderPhotos() {
    if (draftPhotos.length === 0) {
      photoList.innerHTML = '';
      return;
    }
    photoList.innerHTML = draftPhotos.map((src, i) => `
      <div class="photo-item">
        <img src="${escapeHtml(src)}" alt="Фото ${i + 1}" loading="lazy"
             onerror="this.style.display='none';this.parentNode.style.background='#fce4e4';">
        <button type="button" class="remove" data-index="${i}" title="Удалить">&times;</button>
      </div>
    `).join('');

    photoList.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', () => {
        draftPhotos.splice(parseInt(btn.dataset.index, 10), 1);
        renderPhotos();
        if (editingId === null) saveDraft();
      });
    });
  }

  function addPhotoByLink() {
    const normalized = normalizeUrl(photoInput.value);
    if (!normalized) {
      alert('Введите корректную ссылку на изображение (например: https://site.com/photo.jpg)');
      photoInput.focus();
      return;
    }
    if (draftPhotos.includes(normalized)) {
      photoInput.value = '';
      return;
    }
    draftPhotos.push(normalized);
    photoInput.value = '';
    renderPhotos();
    if (editingId === null) saveDraft();
  }

  addPhotoBtn.addEventListener('click', addPhotoByLink);
  photoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addPhotoByLink(); }
  });

  uploadPhotoBtn.addEventListener('click', () => photoFileInput.click());

  photoFileInput.addEventListener('change', () => {
    const files = Array.from(photoFileInput.files || []);
    if (files.length === 0) return;

    let pending = files.length;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        pending--;
        if (pending === 0) finishUpload();
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert('Файл "' + file.name + '" больше 2 МБ и будет пропущен.');
        pending--;
        if (pending === 0) finishUpload();
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target.result === 'string') {
          draftPhotos.push(ev.target.result);
        }
        pending--;
        if (pending === 0) finishUpload();
      };
      reader.onerror = () => {
        pending--;
        if (pending === 0) finishUpload();
      };
      reader.readAsDataURL(file);
    });

    function finishUpload() {
      photoFileInput.value = '';
      renderPhotos();
      if (editingId === null) saveDraft();
    }
  });

  /* ===== Черновик ===== */
  function saveDraft() {
    if (editingId !== null) return;
    const draft = {
      country: countryInput.value,
      city: cityInput.value,
      startDate: startInput.value,
      endDate: endInput.value,
      impressions: impressionsInput.value,
      photos: draftPhotos
    };
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) { /* ignore */ }
  }

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      countryInput.value = d.country || '';
      cityInput.value = d.city || '';
      startInput.value = d.startDate || '';
      endInput.value = d.endDate || '';
      impressionsInput.value = d.impressions || '';
      draftPhotos = Array.isArray(d.photos) ? d.photos : [];
      renderPhotos();
      updateDuration();
    } catch (e) { /* ignore */ }
  }

  impressionsInput.addEventListener('input', () => {
    if (editingId === null) saveDraft();
  });

  function resetFormToAddMode() {
    editingId = null;
    formTitle.textContent = 'Новая поездка';
    editBadge.style.display = 'none';
    submitBtn.textContent = 'Сохранить поездку';
    cancelEditBtn.style.display = 'none';
  }

  function clearForm() {
    form.reset();
    draftPhotos = [];
    renderPhotos();
    durationInfo.classList.remove('show');
    [countryInput, cityInput, startInput, endInput].forEach(inp => {
      inp.classList.remove('error');
    });
    document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));
  }

  clearDraftBtn.addEventListener('click', () => {
    if (!confirm('Очистить форму?')) return;
    clearForm();
    if (editingId !== null) {
      resetFormToAddMode();
      switchTab('list');
    } else {
      sessionStorage.removeItem(DRAFT_KEY);
    }
  });

  cancelEditBtn.addEventListener('click', () => {
    resetFormToAddMode();
    clearForm();
    sessionStorage.removeItem(DRAFT_KEY);
    switchTab('list');
  });

  /* ===== Режим редактирования ===== */
  function startEdit(trip) {
    editingId = trip.id;
    formTitle.textContent = 'Редактирование поездки';
    editBadge.style.display = 'inline-block';
    submitBtn.textContent = 'Сохранить изменения';
    cancelEditBtn.style.display = 'inline-block';

    countryInput.value = trip.country;
    cityInput.value = trip.city;
    startInput.value = trip.startDate;
    endInput.value = trip.endDate;
    impressionsInput.value = trip.impressions || '';
    draftPhotos = Array.isArray(trip.photos) ? [...trip.photos] : [];
    renderPhotos();
    updateDuration();

    [countryInput, cityInput, startInput, endInput].forEach(inp => {
      inp.classList.remove('error');
    });
    document.querySelectorAll('.error-msg').forEach(el => el.classList.remove('show'));

    Object.values(sections).forEach(s => s.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active'));
    sections.add.classList.add('active');
    tabButtons.add.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ===== Отправка формы ===== */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const okCountry = validateCountry();
    const okCity = validateCity();
    const okStart = validateStart();
    const okEnd = validateEnd();

    if (!(okCountry && okCity && okStart && okEnd)) {
      alert('Пожалуйста, исправьте ошибки в форме.');
      return;
    }

    const trips = loadTrips();

    if (editingId !== null) {
      const idx = trips.findIndex(t => t.id === editingId);
      if (idx === -1) {
        alert('Поездка не найдена.');
        resetFormToAddMode();
        switchTab('list');
        return;
      }
      trips[idx] = {
        ...trips[idx],
        country: countryInput.value.trim(),
        city: cityInput.value.trim(),
        startDate: startInput.value.trim(),
        endDate: endInput.value.trim(),
        photos: [...draftPhotos],
        impressions: impressionsInput.value.trim()
      };
      if (!saveTrips(trips)) return;
      alert('Изменения сохранены.');
      const editId = editingId;
      resetFormToAddMode();
      clearForm();
      showDetail(editId);
    } else {
      const trip = {
        id: uuid(),
        country: countryInput.value.trim(),
        city: cityInput.value.trim(),
        startDate: startInput.value.trim(),
        endDate: endInput.value.trim(),
        photos: [...draftPhotos],
        impressions: impressionsInput.value.trim()
      };
      trips.push(trip);
      if (!saveTrips(trips)) return;
      clearForm();
      sessionStorage.removeItem(DRAFT_KEY);
      alert('Поездка сохранена.');
      switchTab('list');
    }
  });

  /* ===== Статистика ===== */
  function renderStats() {
    const trips = loadTrips();
    const countriesMap = new Map();
    const citiesMap = new Map();
    let totalDays = 0;

    trips.forEach(t => {
      const c = t.country.trim();
      countriesMap.set(c, (countriesMap.get(c) || 0) + 1);

      const cityKey = t.city.trim() + '|' + c;
      const existing = citiesMap.get(cityKey);
      citiesMap.set(cityKey, {
        city: t.city.trim(),
        country: c,
        count: (existing ? existing.count : 0) + 1
      });

      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      if (s && e) totalDays += daysBetween(s, e);
    });

    document.getElementById('stat-trips').textContent = trips.length;
    document.getElementById('stat-countries').textContent = countriesMap.size;
    document.getElementById('stat-cities').textContent = citiesMap.size;
    document.getElementById('stat-days').textContent = totalDays;

    const countriesList = document.getElementById('list-countries');
    if (countriesMap.size === 0) {
      countriesList.innerHTML = '<li style="justify-content:center;color:#95a5a6;">Пока нет данных</li>';
    } else {
      const sorted = [...countriesMap.entries()].sort((a, b) => b[1] - a[1]);
      countriesList.innerHTML = sorted.map(([name, count]) =>
        `<li><span>${escapeHtml(name)}</span><span class="count">${count}</span></li>`
      ).join('');
    }

    const citiesList = document.getElementById('list-cities');
    if (citiesMap.size === 0) {
      citiesList.innerHTML = '<li style="justify-content:center;color:#95a5a6;">Пока нет данных</li>';
    } else {
      const sortedCities = [...citiesMap.values()].sort((a, b) => b.count - a.count);
      citiesList.innerHTML = sortedCities.map(c =>
        `<li><span>${escapeHtml(c.city)}, ${escapeHtml(c.country)}</span><span class="count">${c.count}</span></li>`
      ).join('');
    }
  }

  /* ===== Инициализация ===== */
  loadDraft();
  renderList();
})();