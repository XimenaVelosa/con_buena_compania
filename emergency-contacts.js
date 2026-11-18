// Emergency contacts are serialized into the existing emergencyContacts field.
// Guardian data is read again at save time, so edits in the guardian panel stay in sync.
(() => {
  const form = document.querySelector('#client-form');
  const useGuardian = document.querySelector('#emergency-use-guardian');
  const addOther = document.querySelector('#emergency-add-other');
  const guardianPanel = document.querySelector('#emergency-guardian-panel');
  const otherPanel = document.querySelector('#emergency-other-panel');
  const summary = document.querySelector('#emergency-guardian-summary');
  const error = document.querySelector('#emergency-contact-error');
  const legacyPanel = document.querySelector('#emergency-legacy-panel');
  const legacyNotes = document.querySelector('#emergency-legacy-notes');
  const otherFields = Object.fromEntries(['fullName', 'idNumber', 'address', 'phone'].map((key) => [key, document.querySelector(`[data-emergency-field="${key}"]`)]));
  const guardianFields = { fullName: 'payerName', idNumber: 'guardianIdNumber', address: 'guardianAddress', phone: 'guardianPhone' };
  const labels = { fullName: 'Nombre completo', idNumber: 'Cédula', address: 'Dirección', phone: 'Celular' };
  const value = (input) => input.value.trim();
  const readGuardian = () => Object.fromEntries(Object.entries(guardianFields).map(([key, name]) => [key, value(form.elements[name])]));
  const readOther = () => Object.fromEntries(Object.entries(otherFields).map(([key, input]) => [key, value(input)]));

  function serialize() {
    const contacts = [];
    if (useGuardian.checked) contacts.push({ type: 'guardian', ...readGuardian() });
    if (addOther.checked) contacts.push({ type: 'additional', ...readOther() });
    if (value(legacyNotes)) contacts.push({ type: 'note', text: value(legacyNotes) });
    return JSON.stringify(contacts);
  }

  function sync() {
    guardianPanel.hidden = !useGuardian.checked;
    otherPanel.hidden = !addOther.checked;
    useGuardian.setAttribute('aria-expanded', String(useGuardian.checked));
    addOther.setAttribute('aria-expanded', String(addOther.checked));
    Object.values(otherFields).forEach((input) => { input.disabled = !addOther.checked; });
    otherFields.fullName.required = addOther.checked;
    otherFields.phone.required = addOther.checked;
    if (useGuardian.checked) {
      const guardian = readGuardian();
      summary.replaceChildren();
      for (const [key, label] of Object.entries(labels)) {
        const item = document.createElement('div');
        const title = document.createElement('dt');
        const content = document.createElement('dd');
        title.textContent = label;
        content.textContent = guardian[key] || 'Sin registrar';
        item.append(title, content);
        summary.append(item);
      }
      document.querySelector('#emergency-guardian-hint').textContent = guardian.fullName && guardian.phone
        ? 'Estos datos se toman del panel 4 y se actualizan si modificas el acudiente.'
        : 'Completa el nombre y el celular del acudiente en el panel 4 para usarlo como contacto de emergencia.';
    }
    error.textContent = '';
    form.elements.emergencyContacts.value = serialize();
  }

  function draft() {
    return { useGuardian: useGuardian.checked, addOther: addOther.checked, other: readOther(), legacyNotes: value(legacyNotes) };
  }

  function restore(serialized, savedDraft) {
    let contacts = [];
    let previousNotes = '';
    if (typeof serialized === 'string' && serialized.trim()) {
      try {
        const parsed = JSON.parse(serialized);
        if (Array.isArray(parsed) && parsed.every((contact) => contact && ['guardian', 'additional', 'note'].includes(contact.type))) contacts = parsed;
        else previousNotes = serialized;
      } catch { previousNotes = serialized; }
    }
    const other = savedDraft?.other || contacts.find((contact) => contact.type === 'additional') || {};
    useGuardian.checked = typeof savedDraft?.useGuardian === 'boolean' ? savedDraft.useGuardian : contacts.some((contact) => contact.type === 'guardian');
    addOther.checked = typeof savedDraft?.addOther === 'boolean' ? savedDraft.addOther : contacts.some((contact) => contact.type === 'additional');
    for (const [key, input] of Object.entries(otherFields)) input.value = typeof other[key] === 'string' ? other[key] : '';
    const notes = contacts.filter((contact) => contact.type === 'note').map((contact) => typeof contact.text === 'string' ? contact.text : '').filter(Boolean).join('\n');
    legacyNotes.value = typeof savedDraft?.legacyNotes === 'string' ? savedDraft.legacyNotes : previousNotes || notes;
    legacyPanel.hidden = !legacyNotes.value;
    sync();
  }

  function validate() {
    error.textContent = '';
    const guardian = readGuardian();
    if (useGuardian.checked && (!guardian.fullName || !guardian.phone)) {
      error.textContent = 'Completa el nombre y el celular del acudiente en el panel 4, o desmarca esta opción.';
      document.querySelector('#emergency-edit-guardian').focus();
      return false;
    }
    if (addOther.checked && (!value(otherFields.fullName) || !value(otherFields.phone))) {
      error.textContent = 'Escribe el nombre y el celular del contacto de emergencia adicional.';
      (value(otherFields.fullName) ? otherFields.phone : otherFields.fullName).focus();
      return false;
    }
    return true;
  }

  useGuardian.addEventListener('change', sync);
  addOther.addEventListener('change', sync);
  form.addEventListener('input', (event) => {
    if (Object.values(guardianFields).includes(event.target.name) || event.target.matches('[data-emergency-field], #emergency-legacy-notes')) sync();
  });
  document.querySelector('#emergency-edit-guardian').addEventListener('click', () => document.dispatchEvent(new Event('cbc:edit-guardian')));
  window.CBC_EMERGENCY = { serialize, draft, restore, sync, validate, reset: () => restore('[]') };
  sync();
})();
