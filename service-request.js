(() => {
  const $ = (selector) => document.querySelector(selector);
  const dialog = $('#request-dialog');
  const form = $('#request-form');
  const opener = $('#request-open');
  const submit = $('#request-send');
  const activityStep = $('#request-activities');
  const detailsStep = $('#request-details');
  const activityError = $('#request-activity-error');
  const submitError = $('#request-submit-error');
  const department = form.elements.namedItem('department');
  const municipality = form.elements.namedItem('municipality');
  const normalize = (value) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fieldErrors = {
    fullName: 'Escribe tu nombre completo.',
    email: 'Revisa tu correo electrónico. Usa un formato como nombre@ejemplo.com.',
    phone: 'Escribe un número de celular válido.',
    alternatePhone: 'Revisa el celular alternativo o deja ese campo vacío.',
    department: 'Selecciona un departamento de la lista.',
    municipality: 'Selecciona una ciudad o municipio del departamento indicado.',
    hoursPerDay: 'Indica entre un cuarto de hora y 24 horas, en intervalos de 15 minutos.',
    days: 'Selecciona al menos un día.',
    activities: 'Vuelve al primer paso y revisa las actividades seleccionadas.',
    authorized: 'Marca la autorización para poder enviar tu solicitud.',
  };
  let options;
  let departmentCode;
  let loading = false;
  let lastSubmission;

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    return node;
  }

  function checkbox(name, value, title) {
    const label = element('label');
    const input = element('input');
    input.type = 'checkbox';
    input.name = name;
    input.value = value;
    label.append(input, element('span', title));
    return label;
  }

  function fillList(list, names) {
    names.sort((a, b) => a.localeCompare(b, 'es'));
    list.replaceChildren(...names.map((name) => {
      const option = element('option');
      option.value = name;
      return option;
    }));
  }

  async function loadOptions() {
    if (options || loading) return;
    loading = true;
    $('#request-retry').hidden = true;
    $('#request-loading').hidden = false;
    $('#request-loading').textContent = 'Cargando actividades…';
    try {
      const response = await fetch(`${window.CBC_API_URL}/service-requests/options`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      const groups = result.groups.map((group) => {
        const fieldset = element('fieldset');
        fieldset.className = 'request-group';
        fieldset.append(element('legend', group.title));
        for (const activity of group.activities) {
          const item = element('div');
          const label = checkbox('activities', activity.id, activity.title);
          const description = element('p', activity.description);
          description.id = `request-description-${activity.id}`;
          label.firstElementChild.setAttribute('aria-describedby', description.id);
          const exclusions = element('details');
          const list = element('ul');
          list.append(...activity.exclusions.map((text) => element('li', text)));
          exclusions.append(element('summary', 'Qué no incluye'), list);
          item.append(label, description, exclusions);
          fieldset.append(item);
        }
        return fieldset;
      });
      $('#request-groups').replaceChildren(...groups);
      $('#request-days').replaceChildren(...result.days.map((day) => checkbox('days', day, day)));
      $('#request-scope').textContent = result.scope;
      $('#request-notice').textContent = result.notice.text;
      $('#request-policy').hidden = !result.notice.policyUrl;
      if (result.notice.policyUrl) $('#request-policy').href = result.notice.policyUrl;
      fillList($('#request-departments'), Object.values(result.departments).map((entry) => entry.name));
      options = result;
      syncLocations();
      $('#request-loading').hidden = true;
      form.hidden = false;
    } catch {
      $('#request-loading').textContent = 'No pudimos cargar el formulario. Puedes reintentar o escribirnos por correo.';
      $('#request-retry').hidden = false;
    } finally {
      loading = false;
    }
  }

  function syncLocations() {
    const selected = Object.entries(options.departments).find(([, entry]) => normalize(entry.name) === normalize(department.value));
    if (departmentCode !== selected?.[0]) {
      departmentCode = selected?.[0];
      fillList($('#request-municipalities'), selected ? Object.values(selected[1].municipalities) : []);
    }
    municipality.disabled = !selected;
    const cityCode = selected && Object.entries(selected[1].municipalities)
      .find(([, name]) => normalize(name) === normalize(municipality.value))?.[0];
    department.setCustomValidity(department.value && !selected ? 'Selecciona un departamento de la lista.' : '');
    municipality.setCustomValidity(municipality.value && !cityCode ? 'Selecciona una ciudad o municipio de la lista.' : '');
    return cityCode;
  }

  function showStep(showDetails) {
    activityStep.hidden = showDetails;
    detailsStep.hidden = !showDetails;
    activityStep.disabled = showDetails;
    detailsStep.disabled = !showDetails;
    dialog.scrollTop = 0;
    (showDetails ? detailsStep : activityStep).querySelector('legend').focus();
  }

  function checked(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  opener.addEventListener('click', () => {
    dialog.showModal();
    document.body.classList.add('dialog-open');
    $('#request-title').focus();
    loadOptions();
  });
  $('#request-close').addEventListener('click', () => dialog.close());
  $('#request-done').addEventListener('click', () => dialog.close());
  $('#request-retry').addEventListener('click', loadOptions);
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (!$('#request-success').hidden) {
      $('#request-success').hidden = true;
      form.reset();
      syncLocations();
      showStep(false);
      form.hidden = false;
      lastSubmission = undefined;
    }
    opener.focus();
  });
  $('#request-next').addEventListener('click', () => {
    if (!checked('activities').length) {
      activityError.textContent = 'Selecciona al menos una actividad para continuar.';
      return;
    }
    activityError.textContent = '';
    showStep(true);
  });
  $('#request-back').addEventListener('click', () => showStep(false));
  for (const field of [department, municipality]) {
    field.addEventListener('input', syncLocations);
    field.addEventListener('change', syncLocations);
  }
  for (const name of ['phone', 'alternatePhone']) {
    const input = form.elements.namedItem(name);
    input.addEventListener('input', () => input.setCustomValidity(''));
  }

  function validationMessage(data) {
    const messages = Array.isArray(data?.message) ? data.message : [data?.message];
    for (const message of messages) {
      if (typeof message !== 'string') continue;
      if (message === fieldErrors.municipality) return message;
      const field = /^(?:each value in )?(\w+)/.exec(message)?.[1];
      if (field === 'departmentCode') return fieldErrors.department;
      if (field === 'municipalityCode') return fieldErrors.municipality;
      if (Object.hasOwn(fieldErrors, field)) return fieldErrors[field];
    }
    return 'Revisa los datos de contacto y las opciones seleccionadas antes de enviar.';
  }

  function submissionError(status) {
    if (status === 403) return 'El servidor rechazó el envío (403). Abre el formulario desde con-buena-compania.vercel.app.';
    if (status === 404) return 'El servidor no encontró el formulario (404). Comprueba que estés en con-buena-compania.vercel.app.';
    return `El servidor no confirmó el envío (HTTP ${status}). Tus datos siguen en el formulario. Vuelve a intentar.`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || detailsStep.hidden) return;
    submitError.textContent = '';
    const municipalityCode = syncLocations();
    const data = new FormData(form);
    const fullName = String(data.get('fullName')).trim();
    form.elements.namedItem('fullName').setCustomValidity(fullName.length >= 2 ? '' : fieldErrors.fullName);
    const days = checked('days');
    const contact = {};
    for (const name of ['phone', 'alternatePhone']) {
      const value = String(data.get(name)).trim().replace(/[\s().-]/g, '');
      const required = name === 'phone';
      const valid = !required && !value || /^\+?\d{7,15}$/.test(value);
      form.elements.namedItem(name).setCustomValidity(valid ? '' : fieldErrors[name]);
      if (value || required) contact[name] = value;
    }
    if (!form.reportValidity()) {
      const invalidField = detailsStep.querySelector('input:invalid');
      submitError.textContent = fieldErrors[invalidField?.name] || 'Revisa los campos obligatorios.';
      return;
    }
    if (!municipalityCode) {
      submitError.textContent = fieldErrors.municipality;
      municipality.focus();
      return;
    }
    if (!days.length) {
      submitError.textContent = fieldErrors.days;
      $('#request-days input').focus();
      return;
    }

    const payload = {
      fullName, email: String(data.get('email')).trim(),
      ...contact, departmentCode, municipalityCode, hoursPerDay: Number(data.get('hoursPerDay')),
      days, activities: checked('activities'), authorized: data.has('authorized'), noticeVersion: options.notice.version,
    };
    const serialized = JSON.stringify(payload);
    if (lastSubmission?.serialized !== serialized) lastSubmission = { serialized, id: crypto.randomUUID() };
    submit.disabled = true;
    $('#request-back').disabled = true;
    submit.textContent = 'Enviando…';
    try {
      const response = await fetch(`${window.CBC_API_URL}/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CRM-Request': '1' },
        body: JSON.stringify({ ...payload, id: lastSubmission.id }),
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 400 || response.status === 422) {
        submitError.textContent = validationMessage(result);
        return;
      }
      if (!response.ok || !result?.received) {
        submitError.textContent = submissionError(response.status);
        return;
      }
      form.hidden = true;
      $('#request-success').hidden = false;
      dialog.scrollTop = 0;
      if (dialog.open) $('#request-success h3').focus();
    } catch (error) {
      submitError.textContent = error.name === 'TimeoutError'
        ? 'Se agotó el tiempo de espera. Tus datos siguen en el formulario. Vuelve a intentar.'
        : 'El navegador no pudo conectar con el servidor. Tus datos siguen en el formulario. Vuelve a intentar.';
    } finally {
      submit.disabled = false;
      $('#request-back').disabled = false;
      submit.textContent = 'Enviar solicitud';
    }
  });
})();
