(() => {
  const form = document.querySelector('#client-form');
  const panel = document.querySelector('[data-panel="1"]');
  const personal = document.querySelector('#privacy-personal');
  const truth = document.querySelector('#privacy-truth');
  const sensitive = document.querySelector('#privacy-sensitive');
  const signer = document.querySelector('#privacy-signer');
  const role = document.querySelector('#privacy-role');
  const basis = document.querySelector('#privacy-basis');
  const error = document.querySelector('#privacy-error');
  const status = document.querySelector('#privacy-status');
  const sensitiveFields = ['mobilityNeeds', 'mobilityNotes', 'medicationSupport', 'personalCareSupport'];
  let notice = null;
  let pendingDraft = null;
  let requestId = 0;

  function allowed() {
    return Boolean(notice && personal.checked && truth.checked && signer.value.trim().length >= 2 && ['titular', 'representante'].includes(role.value) && (role.value !== 'representante' || basis.value.trim().length >= 10));
  }

  function serialize() {
    return { personalData: personal.checked, truthfulness: truth.checked, sensitiveData: sensitive.checked, signerName: signer.value.trim(), signerRole: role.value, ...(role.value === 'representante' ? { representativeBasis: basis.value.trim() } : {}), version: notice?.version || '', noticeHash: notice?.hash || '' };
  }

  function sync() {
    document.querySelector('#privacy-basis-group').hidden = role.value !== 'representante';
    personal.disabled = truth.disabled = sensitive.disabled = !notice;
    signer.disabled = role.disabled = basis.disabled = !notice;
    const basic = allowed();
    for (const element of form.querySelectorAll('input, textarea, select, .location-button')) {
      if (panel.contains(element)) continue;
      if (['visitDate', 'visitTime', 'visitAgentName'].includes(element.name)) continue;
      // The emergency component also controls whether its optional fields are enabled.
      const otherContactInactive = element.matches('[data-emergency-field]') && !document.querySelector('#emergency-add-other').checked;
      element.disabled = !basic || (!sensitive.checked && sensitiveFields.includes(element.name)) || otherContactInactive;
    }
    form.querySelectorAll('[data-sensitive-help]').forEach((item) => { item.hidden = sensitive.checked && basic; });
    document.querySelector('#visit-privacy-help').hidden = basic;
    error.textContent = '';
  }

  function validate() {
    if (allowed()) return true;
    if (!notice) error.textContent = 'Espera a que cargue el aviso o pulsa Actualizar aviso para volver a intentarlo.';
    else if (signer.value.trim().length < 2) { error.textContent = 'Escribe el nombre de quien manifiesta la autorización.'; signer.focus(); }
    else if (!['titular', 'representante'].includes(role.value)) { error.textContent = 'Indica si autoriza el titular o una persona legitimada para representarlo.'; role.focus(); }
    else if (role.value === 'representante' && basis.value.trim().length < 10) { error.textContent = 'Describe el soporte o fundamento de la representación. El parentesco por sí solo no la acredita.'; basis.focus(); }
    else { error.textContent = 'La persona debe manifestar la autorización de datos personales y la declaración de veracidad para continuar. Los datos de salud siguen siendo opcionales.'; personal.focus(); }
    return false;
  }

  function render() {
    const body = document.querySelector('#privacy-notice-body');
    body.replaceChildren();
    for (const paragraph of notice.paragraphs) {
      const section = document.createElement('section');
      const heading = document.createElement('h3');
      const text = document.createElement('p');
      heading.textContent = paragraph.title;
      text.textContent = paragraph.text;
      section.append(heading, text);
      body.append(section);
    }
    document.querySelector('#privacy-version').textContent = `Versión ${notice.version}`;
    const link = document.querySelector('#privacy-policy-link');
    link.hidden = !notice.policyUrl;
    if (notice.policyUrl && /^https:\/\//.test(notice.policyUrl)) link.href = notice.policyUrl;
    else link.removeAttribute('href');
    status.textContent = 'Lee este aviso a la persona y deja que confirme sus decisiones. No marques las casillas de oficio.';
    sync();
  }

  function restore(data) {
    if (!notice) { pendingDraft = data; return; }
    const current = data?.version === notice.version && data?.noticeHash === notice.hash;
    signer.value = typeof data?.signerName === 'string' ? data.signerName : '';
    role.value = ['titular', 'representante'].includes(data?.signerRole) ? data.signerRole : '';
    basis.value = typeof data?.representativeBasis === 'string' ? data.representativeBasis : '';
    personal.checked = current && data.personalData === true;
    truth.checked = current && data.truthfulness === true;
    sensitive.checked = current && data.sensitiveData === true;
    sync();
  }

  async function load() {
    const id = ++requestId;
    status.textContent = 'Cargando el aviso de autorización…';
    document.querySelector('#privacy-reload').disabled = true;
    try {
      const result = await window.CBC_CRM.api('/clients/privacy-notice');
      if (id !== requestId || !window.CBC_CRM.user) return;
      if (!Array.isArray(result.paragraphs) || !result.hash || !result.version) throw new Error('No se pudo cargar el aviso de autorización.');
      const previous = pendingDraft || (notice ? serialize() : null);
      notice = result;
      render();
      if (previous) restore(previous);
      pendingDraft = null;
    } catch (exception) {
      if (id !== requestId) return;
      notice = null;
      sync();
      status.textContent = exception.message;
    } finally {
      if (id === requestId) document.querySelector('#privacy-reload').disabled = false;
    }
  }

  function reset() {
    personal.checked = truth.checked = sensitive.checked = false;
    signer.value = basis.value = '';
    role.value = '';
    pendingDraft = null;
    sync();
  }

  form.addEventListener('input', (event) => { if (panel.contains(event.target)) sync(); });
  form.addEventListener('change', (event) => { if (panel.contains(event.target)) sync(); });
  document.querySelector('#privacy-reload').addEventListener('click', load);
  document.addEventListener('cbc:authenticated', load);
  document.addEventListener('cbc:logout', () => { requestId++; notice = null; reset(); });
  form.querySelectorAll('[data-edit-privacy]').forEach((button) => button.addEventListener('click', () => document.dispatchEvent(new Event('cbc:edit-authorization'))));
  window.CBC_PRIVACY = { allowed, validate, serialize, restore, reset, sync, sensitiveFields };
  sync();
})();
