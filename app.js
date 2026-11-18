const form = document.querySelector('#client-form');
const panels = [...document.querySelectorAll('[data-panel]')];
const steps = [...document.querySelectorAll('.progress-step')];
const progressFill = document.querySelector('#progress-line-fill');
const backButton = document.querySelector('#back-button');
const nextButton = document.querySelector('#next-button');
const saveButton = document.querySelector('#save-button');
const errorMessage = document.querySelector('#form-error');
const successMessage = document.querySelector('#success-message');
const locationButton = document.querySelector('#location-button');
const locationStatus = document.querySelector('#location-status');
const draftKey = () => `cbc-client-draft:${window.CBC_CRM?.user?.id || 'pending'}`;
const multiSelectFields = ['mobilityNeeds', 'independentActivities', 'homeAccessConditions'];
let currentStep = 0;

function bindLocation(locationField, locationButton, locationStatus, includeVisitCoordinates) {
const locationHelp = document.createElement('section');
locationHelp.className = 'location-permission-help wide';
locationHelp.hidden = true;
locationHelp.setAttribute('aria-label', 'Activar permiso de ubicación');
locationHelp.innerHTML = `
  <h3>Activa el permiso de ubicación</h3>
  <p>En el menú del sitio junto a la dirección web, abre los permisos y permite la ubicación. Si sigue bloqueada, revisa también los permisos del dispositivo:</p>
  <ul>
    <li><strong>iPhone / iPad:</strong> Ajustes → Privacidad y seguridad → Localización. Activa la localización y permite el acceso al navegador mientras lo usas.</li>
    <li><strong>Android:</strong> Ajustes → Aplicaciones → tu navegador → Permisos → Ubicación → Permitir mientras se usa.</li>
    <li><strong>Computador:</strong> revisa el permiso de ubicación del sitio y el acceso a la ubicación en los ajustes del sistema.</li>
  </ul>
  <p>Si abriste el formulario desde WhatsApp u otra aplicación, ábrelo en Safari o Chrome. Después vuelve aquí y pulsa «Volver a intentar». También puedes escribir el lugar manualmente.</p>
  <button type="button" class="location-button">Volver a intentar</button>`;
locationStatus.parentElement.after(locationHelp);
locationHelp.querySelector('button').addEventListener('click', () => locationButton.click());
locationStatus.setAttribute('role', 'status');
locationStatus.setAttribute('aria-live', 'polite');
const locationNotice = document.createElement('small');
locationNotice.className = 'field-help';
locationNotice.innerHTML = 'Al usar esta función se consultará la dirección con Photon (Komoot). Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>. Revisa y corrige la dirección aproximada antes de guardar.';
locationStatus.after(locationNotice);
const addressCache = new Map();

async function resolveAddress(latitude, longitude) {
  const key = `${latitude},${longitude}`;
  if (addressCache.has(key)) return addressCache.get(key);
  const url = new URL(window.CBC_GEOCODING_URL || 'https://photon.komoot.io/reverse');
  url.search = new URLSearchParams({ lat: latitude, lon: longitude, limit: '1', radius: '0.1' }).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error('No se pudo consultar la dirección.');
    const result = await response.json();
    const place = result.features?.[0]?.properties;
    if (!place) throw new Error('No hay dirección disponible en esta zona.');
    const street = [place.street, place.housenumber].filter(Boolean).join(' ');
    const parts = [street || place.name, place.district, place.city || place.county, place.state, place.country];
    const address = [...new Set(parts.filter((part) => typeof part === 'string' && part.trim()))].join(', ');
    if (!address) throw new Error('La respuesta no contiene una dirección.');
    addressCache.set(key, address);
    return address;
  } finally {
    clearTimeout(timeout);
  }
}

locationButton.addEventListener('click', () => {
  if (!window.CBC_PRIVACY.allowed()) { document.dispatchEvent(new Event('cbc:edit-authorization')); return; }
  const requestingUserId = window.CBC_CRM?.user?.id;
  if (!requestingUserId) return;
  locationHelp.hidden = true;
  if (!window.isSecureContext) {
    locationStatus.textContent = 'Abre el formulario con HTTPS para utilizar la ubicación. Puedes escribir el lugar manualmente.';
    return;
  }
  if (!navigator.geolocation) { locationStatus.textContent = 'Este navegador no permite obtener la ubicación.'; return; }
  locationButton.disabled = true;
  locationButton.textContent = 'Obteniendo ubicación…';
  locationStatus.textContent = 'Acepta el permiso de ubicación para continuar.';
  navigator.geolocation.getCurrentPosition(async (position) => {
    if (window.CBC_CRM?.user?.id !== requestingUserId || !window.CBC_PRIVACY.allowed()) return;
    const latitude = position.coords.latitude.toFixed(6);
    const longitude = position.coords.longitude.toFixed(6);
    if (includeVisitCoordinates) {
      form.elements.visitLatitude.value = latitude;
      form.elements.visitLongitude.value = longitude;
    }
    if (/^Ubicación actual \(/.test(locationField.value)) locationField.value = '';
    const previousAddress = locationField.value;
    locationButton.textContent = 'Buscando dirección…';
    locationStatus.textContent = 'Ubicación capturada. Buscando una dirección cercana…';
    saveDraft();
    try {
      const address = await resolveAddress(latitude, longitude);
      if (window.CBC_CRM?.user?.id !== requestingUserId || !window.CBC_PRIVACY.allowed()) return;
      if (locationField.value === previousAddress) locationField.value = address;
      locationStatus.textContent = includeVisitCoordinates
        ? 'Revisa la dirección aproximada. Las coordenadas se incluirán por separado al guardar el informe.'
        : 'Revisa y confirma la dirección de residencia aproximada antes de guardar.';
    } catch {
      locationStatus.textContent = includeVisitCoordinates
        ? 'La ubicación fue capturada, pero no se pudo obtener la dirección. Escríbela manualmente; las coordenadas se incluirán al guardar.'
        : 'No se pudo obtener la dirección de residencia. Escríbela manualmente o vuelve a intentar.';
    } finally {
      locationButton.disabled = false;
      locationButton.textContent = '✓ Ubicación capturada';
      window.CBC_PRIVACY.sync();
      saveDraft();
    }
  }, (error) => {
    if (window.CBC_CRM?.user?.id !== requestingUserId || !window.CBC_PRIVACY.allowed()) { window.CBC_PRIVACY.sync(); return; }
    locationButton.disabled = false;
    locationButton.textContent = '⌖ Usar ubicación actual';
    locationStatus.textContent = 'No fue posible obtener la ubicación. Revisa el permiso del navegador.';
    if (error.code === 1) {
      locationStatus.textContent = 'El acceso a la ubicación está bloqueado. Sigue las instrucciones para activarlo y vuelve a intentar.';
      locationHelp.hidden = false;
    } else if (error.code === 3) {
      locationStatus.textContent = 'La ubicación tardó demasiado. Vuelve a intentar; si continúa, revisa que la localización del dispositivo esté activada.';
    } else {
      locationStatus.textContent = 'No se pudo determinar tu ubicación. Comprueba la localización del dispositivo y vuelve a intentar, o escribe el lugar manualmente.';
    }
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
});
}

bindLocation(form.elements.visitLocation, locationButton, locationStatus, true);
bindLocation(form.elements.address, document.querySelector('#residence-location-button'), document.querySelector('#residence-location-status'), false);

function prefillResidenceAddress() {
  if (!form.elements.address.value.trim() && form.elements.visitLocation.value.trim() && !/^Ubicación actual \(/.test(form.elements.visitLocation.value)) {
    form.elements.address.value = form.elements.visitLocation.value;
    saveDraft();
  }
}

function collectFormData() {
  const data = {};
  for (const field of form.elements) {
    if (!field.name || field.disabled) continue;
    if (field.type === 'checkbox') {
      if (field.name === 'knowsVisit') data.knowsVisit = field.checked;
      else if (field.checked) { data[field.name] ??= []; data[field.name].push(field.value); }
    } else if (field.value) data[field.name] = field.value;
  }
  for (const field of multiSelectFields) data[field] = JSON.stringify(data[field] || []);
  data.emergencyContacts = window.CBC_EMERGENCY.serialize();
  data.authorization = window.CBC_PRIVACY.serialize();
  if (!data.authorization.sensitiveData) for (const name of window.CBC_PRIVACY.sensitiveFields) delete data[name];
  if (data.approximateAge) data.approximateAge = Number(data.approximateAge);
  if (data.visitLatitude) data.visitLatitude = Number(data.visitLatitude);
  if (data.visitLongitude) data.visitLongitude = Number(data.visitLongitude);
  return data;
}

function setStep(step) {
  if (step > 1 && !window.CBC_PRIVACY.allowed()) step = 1;
  if (step === 2) prefillResidenceAddress();
  if (step === 7) window.CBC_EMERGENCY.sync();
  window.CBC_PRIVACY.sync();
  currentStep = step;
  panels.forEach((panel, index) => panel.classList.toggle('active', index === step));
  steps.forEach((item, index) => { item.classList.toggle('active', index === step); item.classList.toggle('complete', index < step); });
  progressFill.style.width = `${(step / (steps.length - 1)) * 100}%`;
  backButton.hidden = step === 0; nextButton.hidden = step === panels.length - 1; saveButton.hidden = step !== panels.length - 1; errorMessage.textContent = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveDraft() {
  if (!window.CBC_CRM?.user) return;
  if (!window.CBC_PRIVACY.allowed()) {
    try { sessionStorage.removeItem(draftKey()); } catch { /* Storage may be disabled. */ }
    return;
  }
  try { sessionStorage.setItem(draftKey(), JSON.stringify({ ...collectFormData(), _emergencyDraft: window.CBC_EMERGENCY.draft() })); } catch { /* The form stays usable when browser storage is unavailable. */ }
}
function restoreDraft() {
  let data;
  try { const raw = sessionStorage.getItem(draftKey()); if (!raw) return; data = JSON.parse(raw); } catch { return; }
  Object.entries(data).forEach(([key, value]) => {
    const fields = [...form.querySelectorAll(`[name="${key}"]`)]; if (!fields.length) return;
    if (fields[0].type === 'checkbox') {
      let parsedValue = value;
      if (multiSelectFields.includes(key) && typeof value === 'string') { try { parsedValue = JSON.parse(value); } catch { parsedValue = []; } }
      const selected = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
      fields.forEach((field) => { field.checked = key === 'knowsVisit' ? parsedValue === true : selected.includes(field.value); });
    }
    else fields[0].value = value;
  });
  window.CBC_EMERGENCY.restore(data.emergencyContacts, data._emergencyDraft);
  window.CBC_PRIVACY.restore(data.authorization);
}
function validateCurrentStep() {
  if (currentStep === 1) return window.CBC_PRIVACY.validate();
  if (currentStep === 7) return window.CBC_EMERGENCY.validate();
  if (currentStep !== 2) return true;
  const fullName = form.elements.fullName.value.trim();
  if (!fullName) { errorMessage.textContent = 'Escribe el nombre completo de la persona usuaria para continuar.'; form.elements.fullName.focus(); return false; }
  return true;
}
nextButton.addEventListener('click', () => { if (!validateCurrentStep()) return; saveDraft(); setStep(Math.min(currentStep + 1, panels.length - 1)); });
backButton.addEventListener('click', () => setStep(Math.max(currentStep - 1, 0)));
steps.forEach((step) => step.addEventListener('click', () => { const target = Number(step.dataset.step); if (target > 1 && !window.CBC_PRIVACY.allowed()) { setStep(1); window.CBC_PRIVACY.validate(); return; } if (target <= currentStep || validateCurrentStep()) setStep(target); }));
form.addEventListener('input', saveDraft); form.addEventListener('change', saveDraft);
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (!validateCurrentStep()) return;
  if (!window.CBC_PRIVACY.allowed()) { setStep(1); window.CBC_PRIVACY.validate(); return; }
  if (!form.elements.fullName.value.trim()) { setStep(2); form.elements.fullName.focus(); return; }
  saveButton.disabled = true; saveButton.textContent = 'Guardando…';
  try {
    await window.CBC_CRM.api('/clients', { method: 'POST', body: JSON.stringify(collectFormData()) });
    form.hidden = true; document.querySelector('.progress').hidden = true; successMessage.hidden = false;
    try { sessionStorage.removeItem(draftKey()); } catch { /* Storage may be disabled. */ }
    document.dispatchEvent(new Event('cbc:visit-saved'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) { errorMessage.textContent = error.message; }
  finally { saveButton.disabled = false; saveButton.textContent = 'Guardar y finalizar →'; }
});
function resetVisit() {
  form.reset();
  window.CBC_EMERGENCY.reset();
  window.CBC_PRIVACY.reset();
  form.hidden = false;
  document.querySelector('.progress').hidden = false;
  successMessage.hidden = true;
  document.querySelectorAll('.location-permission-help').forEach((help) => { help.hidden = true; });
  locationStatus.textContent = 'Se solicitará permiso al navegador para obtener la dirección de la visita.';
  document.querySelector('#residence-location-status').textContent = 'Se completará con la dirección de la visita si está vacía. Puedes editarla o usar otra ubicación.';
  [locationButton, document.querySelector('#residence-location-button')].forEach((button) => { button.textContent = '⌖ Usar ubicación actual'; });
  setStep(0);
}
document.querySelector('#new-client-button').addEventListener('click', () => {
  try { sessionStorage.removeItem(draftKey()); } catch { /* Storage may be disabled. */ }
  resetVisit();
});
document.addEventListener('cbc:edit-guardian', () => { saveDraft(); setStep(3); form.elements.payerName.focus(); });
document.addEventListener('cbc:edit-authorization', () => { saveDraft(); setStep(1); });
document.addEventListener('cbc:authenticated', () => { resetVisit(); restoreDraft(); });
document.addEventListener('cbc:logout', (event) => {
  if (event.detail?.id) { try { sessionStorage.removeItem(`cbc-client-draft:${event.detail.id}`); } catch { /* Storage may be disabled. */ } }
  resetVisit();
});
setStep(0);
