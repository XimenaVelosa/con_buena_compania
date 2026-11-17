(() => {
  const $ = (selector) => document.querySelector(selector);
  let user = null;
  let records = [];
  let revision = 0;
  let detailId = null;
  const dialog = $('#client-detail');
  const knownRoutes = ['home', 'clients', 'visits', 'new-visit'];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const plain = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function notice(message) {
    $('#crm-notice').textContent = message;
    $('#crm-notice').hidden = !message;
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(`${window.CBC_API_URL}${path}`, { ...options, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-CRM-Request': '1', ...options.headers } });
    } catch {
      throw new Error('No pudimos conectar con el sistema. Comprueba tu conexión y vuelve a intentar.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && user) lock('Tu sesión venció. Ingresa nuevamente para continuar.');
      const message = Array.isArray(data.message) ? data.message.join(' ') : data.message;
      throw new Error(message || 'No se pudo completar la solicitud. Vuelve a intentar.');
    }
    return data;
  }

  function lock(message = '') {
    const oldUser = user;
    user = null;
    records = [];
    revision++;
    dialog.close();
    $('#crm-app').hidden = true;
    $('#password-screen').hidden = true;
    $('#login-screen').hidden = false;
    $('#login-error').textContent = message;
    $('#client-search').value = '';
    $('#visit-search').value = '';
    for (const selector of ['#recent-records', '#client-records', '#visit-records', '#detail-content']) $(selector).replaceChildren();
    document.dispatchEvent(new CustomEvent('cbc:logout', { detail: oldUser }));
  }

  function showPassword() {
    $('#login-screen').hidden = true;
    $('#crm-app').hidden = true;
    $('#password-screen').hidden = false;
    $('#password-error').textContent = '';
    $('#password-form').reset();
    $('#current-password').focus();
  }

  async function enter(account) {
    user = account;
    $('#login-form').reset();
    if (user.mustChangePassword) { showPassword(); return; }
    $('#login-screen').hidden = true;
    $('#password-screen').hidden = true;
    $('#crm-app').hidden = false;
    $('#admin-name').textContent = user.displayName;
    $('.admin-avatar').textContent = user.displayName.charAt(0).toUpperCase();
    notice('');
    document.dispatchEvent(new CustomEvent('cbc:authenticated', { detail: user }));
    route();
    await refresh();
  }

  function date(value) {
    if (!value) return 'Sin fecha';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
  }

  function recordCard(record, visit = false) {
    const initials = String(record.fullName || '?').trim().split(/\s+/).slice(0, 2).map((name) => name.charAt(0)).join('').toUpperCase();
    return `<article class="record-card"><div class="record-person"><span class="person-avatar" aria-hidden="true">${escape(initials)}</span><div><h3>${escape(record.fullName)}</h3><p>${escape(visit ? record.visitLocation || 'Lugar sin registrar' : record.phone || 'Teléfono sin registrar')}</p></div></div><div class="record-meta"><strong>${escape(visit ? `Visita: ${date(record.visitDate)}` : record.address || 'Dirección sin registrar')}</strong><span>${escape(visit ? record.visitAgentName || 'Responsable sin registrar' : `Registro: ${date(record.createdAt)}`)}</span></div><button type="button" class="crm-button secondary" data-detail="${escape(record.id)}">${visit ? 'Ver informe' : 'Ver ficha'} →</button></article>`;
  }

  function renderList(selector, data, visit = false) {
    $(selector).innerHTML = data.length ? data.map((record) => recordCard(record, visit)).join('') : '<div class="empty-state"><p>No hay registros para mostrar.</p><a class="crm-button secondary" href="#new-visit">Registrar una visita</a></div>';
  }

  function render() {
    $('#stat-clients').textContent = records.length;
    $('#stat-visits').textContent = records.length;
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    $('#stat-month').textContent = records.filter((record) => record.visitDate?.startsWith(month)).length;
    renderList('#recent-records', records.slice(0, 5));
    const query = plain($('#client-search').value.trim());
    const clients = records.filter((record) => plain([record.fullName, record.phone, record.address].join(' ')).includes(query));
    renderList('#client-records', clients);
    $('#clients-count').textContent = `${clients.length} de ${records.length} registros`;
    const visitQuery = plain($('#visit-search').value.trim());
    const visits = records.filter((record) => plain([record.fullName, record.visitLocation, record.visitAgentName].join(' ')).includes(visitQuery));
    renderList('#visit-records', visits, true);
    $('#visits-count').textContent = `${visits.length} de ${records.length} visitas`;
  }

  async function refresh() {
    if (!user || user.mustChangePassword) return;
    const currentRevision = ++revision;
    document.querySelectorAll('[data-refresh]').forEach((button) => { button.disabled = true; });
    if (!records.length) for (const selector of ['#recent-records', '#client-records', '#visit-records']) $(selector).innerHTML = '<p class="empty-state" role="status">Cargando registros…</p>';
    try {
      const result = await api('/clients');
      if (currentRevision !== revision || !user) return;
      if (!Array.isArray(result)) throw new Error('El sistema no devolvió un listado válido.');
      records = result;
      notice('');
      render();
    } catch (error) {
      if (user && currentRevision === revision) {
        notice(error.message);
        for (const selector of ['#recent-records', '#client-records', '#visit-records']) $(selector).innerHTML = '<p class="empty-state">No se pudieron cargar los registros. Pulsa Actualizar para volver a intentar.</p>';
      }
    } finally {
      document.querySelectorAll('[data-refresh]').forEach((button) => { button.disabled = false; });
    }
  }

  function route() {
    if (!user || user.mustChangePassword || !$('#password-screen').hidden) return;
    const requested = location.hash.slice(1) || 'home';
    const selected = knownRoutes.includes(requested) ? requested : 'home';
    document.querySelectorAll('[data-view]').forEach((view) => { view.hidden = view.dataset.view !== selected; });
    document.querySelectorAll('[data-route]').forEach((link) => {
      if (link.dataset.route === (selected === 'new-visit' ? 'visits' : selected)) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = `${{ home: 'Inicio', clients: 'Clientes', visits: 'Visitas', 'new-visit': 'Nueva visita' }[selected]} · Con Buena Compañía`;
    if (selected === 'new-visit') document.dispatchEvent(new Event('cbc:open-visit'));
  }

  const sections = [
    ['01 · Datos de la visita', [['visitDate', 'Fecha'], ['visitTime', 'Hora'], ['visitLocation', 'Lugar / zona'], ['visitAgentName', 'Responsable de la visita'], ['visitLatitude', 'Latitud'], ['visitLongitude', 'Longitud']]],
    ['02 · Información de la persona', [['fullName', 'Nombre completo'], ['approximateAge', 'Edad aproximada'], ['phone', 'Teléfono'], ['address', 'Dirección de residencia']]],
    ['03 · Solicitud y acudiente', [['requesterName', 'Persona que solicita'], ['requesterRelationship', 'Parentesco'], ['payerName', 'Nombre completo del acudiente'], ['guardianIdNumber', 'Cédula del acudiente'], ['guardianAddress', 'Dirección del acudiente'], ['guardianPhone', 'Celular del acudiente'], ['knowsVisit', 'Conoce y acepta la visita']]],
    ['04 · Movilidad', [['mobilityNeeds', 'Movilidad y apoyos'], ['mobilityNotes', 'Observaciones']]],
    ['05 · Autonomía y actividades', [['independentActivities', 'Actividades solicitadas'], ['independenceNotes', 'Observaciones y otras actividades solicitadas']]],
    ['06 · Entorno y seguridad', [['homeAccessConditions', 'Condiciones del entorno'], ['medicationSupport', 'Medicamentos y procedimientos'], ['personalCareSupport', 'Cuidado personal'], ['homeSafetyNotes', 'Seguridad'], ['homeSafetyConditions', 'Condiciones especiales']]],
    ['07 · Cierre', [['outingConditions', 'Condiciones para salidas'], ['transportPlan', 'Transporte'], ['emergencyContacts', 'Contactos de emergencia'], ['preferences', 'Preferencias'], ['visitConclusion', 'Conclusión'], ['recommendedServices', 'Servicios recomendados'], ['nextContact', 'Próximo contacto'], ['finalNotes', 'Observaciones finales']]],
  ];

  function fieldText(value) {
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (value === null || value === undefined || value === '') return 'Sin registrar';
    if (typeof value === 'string' && value.startsWith('[')) {
      try { const array = JSON.parse(value); if (Array.isArray(array)) return array.length ? array.join(' · ') : 'Sin selecciones'; } catch { /* Show the original value if older data is not JSON. */ }
    }
    return String(value);
  }

  async function openDetail(id) {
    detailId = id;
    $('#detail-title').textContent = 'Cargando ficha…';
    $('#detail-content').textContent = '';
    dialog.showModal();
    try {
      const record = await api(`/clients/${encodeURIComponent(id)}`);
      if (detailId !== id || !dialog.open || !user) return;
      $('#detail-title').textContent = record.fullName;
      $('#detail-content').innerHTML = sections.map(([title, fields]) => `<section class="detail-section"><h3>${escape(title)}</h3><dl>${fields.map(([key, label]) => `<div><dt>${escape(label)}</dt><dd>${escape(key === 'visitDate' ? date(record[key]) : fieldText(record[key]))}</dd></div>`).join('')}</dl></section>`).join('');
    } catch (error) {
      if (dialog.open && detailId === id) { $('#detail-title').textContent = 'No se pudo abrir la ficha'; $('#detail-content').textContent = error.message; }
    }
  }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#login-error').textContent = '';
    $('#login-submit').disabled = true;
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: $('#login-user').value.trim(), password: $('#login-password').value }) });
      await enter(result.user);
    } catch (error) { $('#login-error').textContent = error.message; }
    finally { $('#login-submit').disabled = false; }
  });

  $('#toggle-password').addEventListener('click', () => {
    const visible = $('#login-password').type === 'password';
    $('#login-password').type = visible ? 'text' : 'password';
    $('#toggle-password').textContent = visible ? 'Ocultar' : 'Ver';
    $('#toggle-password').setAttribute('aria-pressed', String(visible));
    $('#toggle-password').setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  $('#password-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('#password-error').textContent = '';
    if ($('#new-password').value !== $('#confirm-password').value) { $('#password-error').textContent = 'Las nuevas contraseñas no coinciden.'; return; }
    const submit = event.currentTarget.querySelector('button[type=submit]');
    submit.disabled = true;
    try {
      const result = await api('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#current-password').value, newPassword: $('#new-password').value }) });
      $('#password-form').reset();
      await enter(result.user);
    } catch (error) { $('#password-error').textContent = error.message; }
    finally { submit.disabled = false; }
  });

  async function logout() {
    try { await api('/auth/logout', { method: 'POST', body: '{}' }); lock(); }
    catch (error) { if ($('#crm-app').hidden) $('#password-error').textContent = error.message; else notice(error.message); }
  }
  $('#logout-button').addEventListener('click', logout);
  $('#password-cancel').addEventListener('click', logout);
  $('#account-button').addEventListener('click', showPassword);
  $('#close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { detailId = null; $('#detail-content').replaceChildren(); });
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-detail]'); if (button) openDetail(button.dataset.detail); });
  $('#client-search').addEventListener('input', render);
  $('#visit-search').addEventListener('input', render);
  document.querySelectorAll('[data-refresh]').forEach((button) => button.addEventListener('click', refresh));
  window.addEventListener('hashchange', route);
  document.addEventListener('cbc:visit-saved', refresh);
  window.CBC_CRM = { api, get user() { return user; } };
  $('#login-submit').disabled = true;
  api('/auth/session')
    .then((result) => enter(result.user))
    .catch((error) => { if (!error.message.includes('Ingresa')) $('#login-error').textContent = error.message; })
    .finally(() => { $('#login-submit').disabled = false; });
})();
