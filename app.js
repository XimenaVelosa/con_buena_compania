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
let currentStep = 0;

function setStep(step) {
  currentStep = step;
  panels.forEach((panel, index) => panel.classList.toggle('active', index === step));
  steps.forEach((item, index) => {
    item.classList.toggle('active', index === step);
    item.classList.toggle('complete', index < step);
  });
  progressFill.style.width = `${(step / (steps.length - 1)) * 100}%`;
  backButton.hidden = step === 0;
  nextButton.hidden = step === panels.length - 1;
  saveButton.hidden = step !== panels.length - 1;
  errorMessage.textContent = '';
}

function saveDraft() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.knowsVisit = form.elements.knowsVisit.checked;
  localStorage.setItem(draftKey, JSON.stringify(data));
}

function restoreDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.type === 'checkbox') field.checked = value === true || value === 'on';
    else field.value = value;
  });
}

function validateCurrentStep() {
  if (currentStep !== 1) return true;
  const fullName = form.elements.fullName.value.trim();
  if (!fullName) {
    errorMessage.textContent = 'Escribe el nombre completo de la persona usuaria para continuar.';
    form.elements.fullName.focus();
    return false;
  }
  return true;
}

nextButton.addEventListener('click', () => {
  if (!validateCurrentStep()) return;
  saveDraft();
  setStep(Math.min(currentStep + 1, panels.length - 1));
});

backButton.addEventListener('click', () => setStep(Math.max(currentStep - 1, 0)));
steps.forEach((step) => step.addEventListener('click', () => {
  const target = Number(step.dataset.step);
  if (target <= currentStep || validateCurrentStep()) setStep(target);
}));

form.addEventListener('input', saveDraft);
form.addEventListener('change', saveDraft);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateCurrentStep()) return;
  saveButton.disabled = true;
  saveButton.textContent = 'Guardando…';
  const data = Object.fromEntries(new FormData(form).entries());
  data.approximateAge = data.approximateAge ? Number(data.approximateAge) : undefined;
  data.knowsVisit = form.elements.knowsVisit.checked;
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  try {
    const response = await fetch(`${apiUrl}/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error('No se pudo guardar el registro.');
    form.hidden = true;
    document.querySelector('.progress').hidden = true;
    successMessage.hidden = false;
    localStorage.removeItem(draftKey);
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Guardar cliente';
  }
});

document.querySelector('#new-client-button').addEventListener('click', () => window.location.reload());
restoreDraft();
setStep(0);
