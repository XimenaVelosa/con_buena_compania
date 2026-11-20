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
      municipality.value = '';
      departmentCode = selected?.[0];
    }
    municipality.disabled = !selected;
    fillList($('#request-municipalities'), selected ? Object.values(selected[1].municipalities) : []);
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
  department.addEventListener('input', syncLocations);
  municipality.addEventListener('input', syncLocations);
  for (const name of ['phone', 'alternatePhone']) {
    const input = form.elements.namedItem(name);
    input.addEventListener('input', () => input.setCustomValidity(''));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit.disabled || detailsStep.hidden) return;
    submitError.textContent = '';
    const municipalityCode = syncLocations();
    const data = new FormData(form);
    const days = checked('days');
    const contact = {};
    for (const name of ['phone', 'alternatePhone']) {
      const value = String(data.get(name)).trim().replace(/[\s().-]/g, '');
      if (value || name === 'phone') {
        const input = form.elements.namedItem(name);
        input.setCustomValidity(/^\+?\d{7,15}$/.test(value) ? '' : 'Escribe un número de celular válido.');
        contact[name] = value;
      }
    }
    if (!form.reportValidity() || !municipalityCode) return;
    if (!days.length) {
      submitError.textContent = 'Selecciona al menos un día.';
      $('#request-days input').focus();
      return;
    }

    const payload = {
      fullName: String(data.get('fullName')).trim(), email: String(data.get('email')).trim(),
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
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok || !(await response.json()).received) throw new Error();
      form.hidden = true;
      $('#request-success').hidden = false;
      dialog.scrollTop = 0;
      if (dialog.open) $('#request-success h3').focus();
    } catch {
      submitError.textContent = 'No pudimos enviar la solicitud. Tus datos siguen en el formulario. Vuelve a intentar.';
    } finally {
      submit.disabled = false;
      $('#request-back').disabled = false;
      submit.textContent = 'Enviar solicitud';
    }
  });
})();
