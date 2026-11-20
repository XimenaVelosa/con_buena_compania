(() => {
  const form = document.querySelector('#client-form');
  const panel = document.querySelector('[data-panel="5"]');
  const options = document.querySelector('#activities-options');
  const status = document.querySelector('#activities-status');
  const error = document.querySelector('#activity-selection-error');
  const contacts = document.querySelector('#activity-taxi-contacts');
  const authorization = document.querySelector('#activity-taxi-authorization');
  const authorizer = document.querySelector('#activity-taxi-authorizer');
  const modeInputs = [...panel.querySelectorAll('[data-activity-transport-mode]')];
  const modes = ['trusted-taxi', 'authorize-taxi', 'not-needed'];
  let catalog = null;
  let pending = null;
  let requestId = 0;
  let contactSequence = 0;
  let previousMode = 'pending';
  const mode = () => modeInputs.find((input) => input.checked)?.value || 'pending';
  const cards = () => [...contacts.querySelectorAll('[data-taxi-contact]')];
  const create = (tag, className = '', text) => {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function readContacts() {
    return cards().map((card) => Object.fromEntries([...card.querySelectorAll('[data-taxi-field]')].map((input) => [input.dataset.taxiField, input.value.trim()])));
  }

  function addContact(data = {}) {
    if (cards().length >= 5) return;
    const card = create('section', 'taxi-contact-card');
    card.dataset.taxiContact = '';
    const header = create('div', 'taxi-contact-heading');
    header.append(create('h4'));
    const remove = create('button', 'crm-text-button', 'Quitar contacto');
    remove.type = 'button';
    remove.dataset.activityAction = 'remove';
    remove.addEventListener('click', () => {
      card.remove(); sync(); form.dispatchEvent(new Event('input', { bubbles: true }));
    });
    header.append(remove);
    const fields = create('div', 'field-grid');
    const sequence = ++contactSequence;
    for (const [key, label, maximum] of [['name', 'Nombre del conductor o contacto', 160], ['phone', 'Teléfono del taxi o contacto', 40], ['company', 'Empresa / central (opcional)', 160], ['plate', 'Placa del vehículo (opcional)', 20]]) {
      const field = create('label', '', label);
      const input = create('input');
      input.type = key === 'phone' ? 'tel' : 'text';
      input.dataset.taxiField = key;
      input.id = `activity-taxi-${sequence}-${key}`;
      input.maxLength = maximum;
      input.value = typeof data[key] === 'string' ? data[key] : '';
      field.append(input);
      fields.append(field);
    }
    card.append(header, fields);
    contacts.append(card);
  }

  function isUnavailable(element) {
    if (!panel.contains(element)) return false;
    if (!catalog) return true;
    if (element.closest('#activity-trusted-taxis-panel') && mode() !== 'trusted-taxi') return true;
    if (element.closest('#activity-taxi-authorization-panel') && mode() !== 'authorize-taxi') return true;
    if (element.id === 'activity-add-taxi') return cards().length >= 5;
    if (element.dataset.activityAction === 'remove') return cards().length <= 1;
    return false;
  }

  function sync() {
    const currentMode = mode();
    document.querySelector('#activity-trusted-taxis-panel').hidden = currentMode !== 'trusted-taxi';
    document.querySelector('#activity-taxi-authorization-panel').hidden = currentMode !== 'authorize-taxi';
    cards().forEach((card, index) => {
      card.querySelector('h4').textContent = `Contacto de taxi ${index + 1}`;
      card.querySelectorAll('[data-taxi-field]').forEach((input) => { input.required = currentMode === 'trusted-taxi' && ['name', 'phone'].includes(input.dataset.taxiField); });
    });
    authorizer.required = authorization.required = currentMode === 'authorize-taxi';
    if (currentMode === 'authorize-taxi' && previousMode !== currentMode && !authorizer.value.trim() && window.CBC_PRIVACY?.allowed()) authorizer.value = window.CBC_PRIVACY.serialize().signerName;
    previousMode = currentMode;
    if (window.CBC_PRIVACY) window.CBC_PRIVACY.sync();
    else panel.querySelectorAll('input, [data-activity-action]').forEach((element) => { element.disabled = true; });
  }

  function serialize() {
    if (!catalog) return undefined;
    return {
      catalogVersion: catalog?.version || '', catalogHash: catalog?.hash || '',
      selectedIds: [...options.querySelectorAll('input:checked')].map((input) => input.dataset.activityId),
      transportMode: mode(),
      taxiContacts: mode() === 'trusted-taxi' ? readContacts() : [],
      taxiCoordinationAuthorized: mode() === 'authorize-taxi' && authorization.checked,
      ...(mode() === 'authorize-taxi' ? { taxiAuthorizationName: authorizer.value.trim() } : {}),
    };
  }

  function draft() {
    if (!catalog && pending) return { ...pending.savedDraft, selection: pending.selection || pending.savedDraft?.selection, legacyActivities: pending.legacyActivities };
    return { transportMode: mode(), taxiContacts: readContacts(), authorizationChecked: authorization.checked, authorizationName: authorizer.value };
  }

  function restore(selection, savedDraft, legacyActivities) {
    selection ||= savedDraft?.selection;
    legacyActivities ||= savedDraft?.legacyActivities;
    if (!catalog) { pending = { selection, savedDraft, legacyActivities }; return; }
    const current = selection?.catalogVersion === catalog.version && selection?.catalogHash === catalog.hash;
    const ids = current && Array.isArray(selection.selectedIds) ? selection.selectedIds : [];
    options.querySelectorAll('input').forEach((input) => { input.checked = ids.includes(input.dataset.activityId); });
    const savedMode = savedDraft?.transportMode || selection?.transportMode;
    modeInputs.forEach((input) => { input.checked = modes.includes(savedMode) && input.value === savedMode; });
    let oldSelections = [];
    try { oldSelections = JSON.parse(legacyActivities || '[]'); } catch { /* Older drafts may have free text. */ }
    document.querySelector('#activities-updated').hidden = current || !(selection || (Array.isArray(oldSelections) && oldSelections.length));
    contacts.replaceChildren();
    const previousContacts = savedDraft?.taxiContacts || selection?.taxiContacts || [];
    if (Array.isArray(previousContacts)) previousContacts.slice(0, 5).forEach((contact) => addContact(contact && typeof contact === 'object' ? contact : {}));
    if (!cards().length) addContact();
    authorization.checked = Boolean(current && (savedDraft?.authorizationChecked ?? selection?.taxiCoordinationAuthorized));
    authorizer.value = savedDraft?.authorizationName || selection?.taxiAuthorizationName || '';
    sync();
  }

  function render() {
    document.querySelector('#activities-introduction').textContent = catalog.introduction;
    const scope = document.querySelector('#activities-scope');
    scope.textContent = catalog.scopeNotice;
    scope.hidden = false;
    document.querySelector('#activity-taxi-authorization-text').textContent = catalog.taxiAuthorizationText;
    options.replaceChildren();
    catalog.activities.forEach((activity, index) => {
      const card = create('article', 'activity-card');
      const heading = create('div', 'activity-card-heading');
      const title = create('h3');
      const label = create('label', '', activity.title);
      label.htmlFor = `activity-${activity.id}`;
      title.append(label);
      const input = create('input');
      input.type = 'checkbox'; input.name = 'independentActivities'; input.value = activity.title;
      input.id = label.htmlFor; input.dataset.activityId = activity.id;
      input.setAttribute('aria-describedby', `activity-description-${activity.id} activity-exclusions-${activity.id}`);
      heading.append(create('span', 'activity-number', String(index + 1).padStart(2, '0')), title, input);
      const description = create('p', 'activity-description', activity.description);
      description.id = `activity-description-${activity.id}`;
      const exclusions = create('div', 'activity-exclusions');
      exclusions.id = `activity-exclusions-${activity.id}`;
      exclusions.append(create('h4', '', 'No incluye ni se permite'));
      const list = create('ul');
      activity.exclusions.forEach((text) => list.append(create('li', '', text)));
      exclusions.append(list, create('p', 'activity-common-exclusion', catalog.commonExclusion));
      card.append(heading, description, exclusions);
      options.append(card);
    });
  }

  async function load() {
    const id = ++requestId;
    status.textContent = 'Cargando las actividades…';
    document.querySelector('#activities-reload').disabled = true;
    try {
      const result = await window.CBC_CRM.api('/clients/activity-options');
      if (id !== requestId || !window.CBC_CRM.user) return;
      if (!result.version || !/^[a-f0-9]{64}$/.test(result.hash || '') || !Array.isArray(result.activities) || !result.activities.length || !result.activities.every((item) => typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && Array.isArray(item.exclusions)) || new Set(result.activities.map((item) => item.id)).size !== result.activities.length) throw new Error('No se pudieron cargar las actividades. Pulsa Actualizar actividades para volver a intentar.');
      const previous = pending || { selection: catalog ? serialize() : undefined, savedDraft: draft() };
      catalog = result;
      render();
      restore(previous.selection, previous.savedDraft, previous.legacyActivities);
      pending = null;
      status.textContent = 'Selecciona las actividades de interés después de revisar su descripción y sus exclusiones.';
    } catch (exception) {
      if (id !== requestId) return;
      status.textContent = exception.message;
      sync();
    } finally { if (id === requestId) document.querySelector('#activities-reload').disabled = false; }
  }

  function validate() {
    error.textContent = '';
    if (!catalog) { error.textContent = 'Carga y revisa las actividades antes de continuar.'; document.querySelector('#activities-reload').focus(); return false; }
    const selection = serialize();
    if (selection.selectedIds.length && selection.transportMode === 'pending') { error.textContent = 'Indica cómo se resolverán los traslados de las actividades de interés.'; modeInputs[0].focus(); return false; }
    if (selection.transportMode === 'trusted-taxi') {
      for (const card of cards()) {
        const name = card.querySelector('[data-taxi-field="name"]');
        const phone = card.querySelector('[data-taxi-field="phone"]');
        const digits = phone.value.replace(/\D/g, '');
        if (name.value.trim().length < 2) { error.textContent = 'Escribe el nombre de cada contacto de taxi.'; name.focus(); return false; }
        if (!/^\+?[\d\s().-]{7,40}$/.test(phone.value.trim()) || digits.length < 7 || digits.length > 15) { error.textContent = 'Escribe un teléfono válido para cada contacto de taxi.'; phone.focus(); return false; }
      }
    }
    if (selection.transportMode === 'authorize-taxi') {
      if (authorizer.value.trim().length < 2) { error.textContent = 'Indica quién autoriza la coordinación del taxi.'; authorizer.focus(); return false; }
      if (!authorization.checked) { error.textContent = 'La persona debe marcar la autorización para que podamos buscar y coordinar un taxi de confianza.'; authorization.focus(); return false; }
    }
    return true;
  }

  document.querySelector('#activity-add-taxi').addEventListener('click', () => { addContact(); sync(); form.dispatchEvent(new Event('input', { bubbles: true })); });
  for (const name of ['input', 'change']) form.addEventListener(name, (event) => { if (panel.contains(event.target)) { error.textContent = ''; sync(); } });
  document.querySelector('#activities-reload').addEventListener('click', load);
  document.addEventListener('cbc:authenticated', load);
  document.addEventListener('cbc:logout', () => {
    requestId++; catalog = null; pending = null; options.replaceChildren();
    document.querySelector('#activities-introduction').textContent = '';
    document.querySelector('#activities-scope').hidden = true;
    reset();
  });
  function reset() {
    pending = null;
    options.querySelectorAll('input').forEach((input) => { input.checked = false; });
    modeInputs.forEach((input) => { input.checked = false; });
    contacts.replaceChildren(); addContact();
    authorizer.value = ''; authorization.checked = false; error.textContent = '';
    document.querySelector('#activities-updated').hidden = true;
    sync();
  }
  window.CBC_ACTIVITIES = { serialize, draft, restore, validate, sync, reset, isUnavailable };
  reset();
})();
