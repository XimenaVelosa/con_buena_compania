const form = document.querySelector('#client-form');
const panels = [...document.querySelectorAll('[data-panel]')];
const steps = [...document.querySelectorAll('.progress-step')];
const progressFill = document.querySelector('#progress-line-fill');
const backButton = document.querySelector('#back-button');
const nextButton = document.querySelector('#next-button');
const saveButton = document.querySelector('#save-button');
const errorMessage = document.querySelector('#form-error');
const successMessage = document.querySelector('#success-message');
const draftKey = 'cbc-client-draft';
const apiUrl = window.CBC_API_URL || 'http://localhost:3001';
const multiSelectFields = ['mobilityNeeds', 'independentActivities', 'homeAccessConditions'];
let currentStep = 0;

function collectFormData() {
  const data = {};
  for (const field of form.elements) {
    if (!field.name) continue;
    if (field.type === 'checkbox') {
      if (field.name === 'knowsVisit') data.knowsVisit = field.checked;
      else if (field.checked) { data[field.name] ??= []; data[field.name].push(field.value); }
    } else if (field.value) data[field.name] = field.value;
  }
  for (const field of multiSelectFields) data[field] = JSON.stringify(data[field] || []);
  if (data.approximateAge) data.approximateAge = Number(data.approximateAge);
  return data;
}

function setStep(step) {
  currentStep = step;
  panels.forEach((panel, index) => panel.classList.toggle('active', index === step));
  steps.forEach((item, index) => { item.classList.toggle('active', index === step); item.classList.toggle('complete', index < step); });
  progressFill.style.width = `${(step / (steps.length - 1)) * 100}%`;
  backButton.hidden = step === 0; nextButton.hidden = step === panels.length - 1; saveButton.hidden = step !== panels.length - 1; errorMessage.textContent = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function saveDraft() { localStorage.setItem(draftKey, JSON.stringify(collectFormData())); }
function restoreDraft() {
  const raw = localStorage.getItem(draftKey); if (!raw) return;
  const data = JSON.parse(raw);
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
}
function validateCurrentStep() {
  if (currentStep !== 1) return true;
  const fullName = form.elements.fullName.value.trim();
  if (!fullName) { errorMessage.textContent = 'Escribe el nombre completo de la persona usuaria para continuar.'; form.elements.fullName.focus(); return false; }
  return true;
}
nextButton.addEventListener('click', () => { if (!validateCurrentStep()) return; saveDraft(); setStep(Math.min(currentStep + 1, panels.length - 1)); });
backButton.addEventListener('click', () => setStep(Math.max(currentStep - 1, 0)));
steps.forEach((step) => step.addEventListener('click', () => { const target = Number(step.dataset.step); if (target <= currentStep || validateCurrentStep()) setStep(target); }));
form.addEventListener('input', saveDraft); form.addEventListener('change', saveDraft);
form.addEventListener('submit', async (event) => {
  event.preventDefault(); if (!validateCurrentStep()) return;
  saveButton.disabled = true; saveButton.textContent = 'Guardando…';
  try {
    const response = await fetch(`${apiUrl}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectFormData()) });
    if (!response.ok) throw new Error('No se pudo guardar el informe.');
    form.hidden = true; document.querySelector('.progress').hidden = true; successMessage.hidden = false; localStorage.removeItem(draftKey); window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) { errorMessage.textContent = error.message; }
  finally { saveButton.disabled = false; saveButton.textContent = 'Guardar cliente'; }
});
document.querySelector('#new-client-button').addEventListener('click', () => window.location.reload());
restoreDraft(); setStep(0);
