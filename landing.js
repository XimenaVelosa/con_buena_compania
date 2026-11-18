(() => {
  const legacyViews = ['#home', '#clients', '#visits', '#new-visit'];
  function redirectLegacyView() {
    if (!legacyViews.includes(location.hash)) return false;
    location.replace(`/crm${location.hash}`);
    return true;
  }
  if (redirectLegacyView()) return;
  window.addEventListener('hashchange', redirectLegacyView);

  const email = 'gerencia@conbuenacompania.com';
  const rate = 25000;
  const money = (value) => `$${new Intl.NumberFormat('es-CO').format(value)}`;
  const mailLink = (subject, body) => `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const menuButton = document.querySelector('#menu-toggle');
  const navigation = document.querySelector('#public-navigation');

  function closeMenu(restoreFocus = false) {
    navigation.dataset.open = 'false';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menú de navegación');
    if (restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    navigation.dataset.open = String(open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
  });
  navigation.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') closeMenu(true); });
  const desktopLayout = matchMedia('(min-width:1040px)');
  if (desktopLayout.addEventListener) desktopLayout.addEventListener('change', () => closeMenu());
  else desktopLayout.addListener(() => closeMenu());

  const slider = document.querySelector('#public-activities');
  const cards = [...slider.querySelectorAll('.service-card')];
  const previousButton = document.querySelector('#activities-previous');
  const nextButton = document.querySelector('#activities-next');
  const pad = (value) => String(value).padStart(2, '0');
  let sliderFrame = 0;
  function sliderPosition() {
    const step = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(slider).columnGap || '16');
    return Math.max(0, Math.min(cards.length - 1, Math.round(slider.scrollLeft / step)));
  }
  function updateSlider() {
    previousButton.disabled = slider.scrollLeft <= 2;
    nextButton.disabled = slider.scrollWidth - slider.clientWidth - slider.scrollLeft <= 2;
    const viewport = slider.getBoundingClientRect();
    const visible = cards.map((card, index) => ({ index, rect: card.getBoundingClientRect() })).filter(({ rect }) => Math.min(viewport.right, rect.right) - Math.max(viewport.left, rect.left) > rect.width * .5);
    const first = visible[0]?.index ?? sliderPosition();
    const last = visible.at(-1)?.index ?? first;
    document.querySelector('#activities-position').textContent = `${pad(first + 1)}${last > first ? `–${pad(last + 1)}` : ''} / ${pad(cards.length)}`;
  }
  function slide(direction) {
    const step = cards[0].getBoundingClientRect().width + parseFloat(getComputedStyle(slider).columnGap || '16');
    slider.scrollBy({ left: step * direction, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }
  previousButton.addEventListener('click', () => slide(-1));
  nextButton.addEventListener('click', () => slide(1));
  slider.addEventListener('keydown', (event) => {
    if (event.target !== slider) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); slide(event.key === 'ArrowRight' ? 1 : -1); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); slider.scrollTo({ left: event.key === 'Home' ? 0 : slider.scrollWidth, behavior: reducedMotion.matches ? 'auto' : 'smooth' }); }
  });
  slider.addEventListener('scroll', () => { cancelAnimationFrame(sliderFrame); sliderFrame = requestAnimationFrame(updateSlider); }, { passive: true });
  window.addEventListener('resize', updateSlider);
  updateSlider();

  const commonExclusion = 'El acompañante no puede conducir vehículos ni realizar oficios domésticos, como lavar platos, cocinar, limpiar, lavar o planchar ropa. Estas tareas no se pueden acordar como adicionales.';
  const services = {
    'medical-appointments': {
      description: 'Acudimos al domicilio, coordinamos el traslado con un tercero y acompañamos a la persona durante el desplazamiento y su permanencia en la institución. Orientamos en trámites básicos y acompañamos su regreso a casa.',
      exclusions: ['Realizar valoraciones médicas, terapias o procedimientos de enfermería.', 'Interpretar diagnósticos o resultados, formular tratamientos o administrar medicamentos.'],
      conditions: 'Recoger significa acudir al domicilio y solicitar o coordinar transporte de un tercero. Con Buena Compañía no presta el servicio de transporte.',
      considerations: 'Pueden presentarse retrasos de terceros, dificultades de movilidad, caídas, pérdida de pertenencias o emergencias. Conversamos previamente sobre las condiciones del acompañamiento y la información que la persona decida compartir.',
    },
    groceries: {
      description: 'Acompañamiento personalizado al supermercado o tienda para ubicar los artículos elegidos por la persona, apoyar la compra y coordinar con un tercero el traslado al domicilio cuando se necesite.',
      exclusions: ['Decidir las compras por la persona o utilizar tarjetas o claves sin su autorización.', 'Realizar tareas de cocina, aseo o limpieza después de las compras.', 'Cargar objetos que superen las condiciones seguras acordadas para el acompañamiento.'],
      conditions: 'El encuentro puede realizarse en el establecimiento o en el domicilio. La persona decide qué comprar y realiza los pagos.',
      considerations: 'Se deben considerar las condiciones de movilidad, el manejo de pertenencias, los precios, la calidad de los productos y las condiciones del traslado.',
    },
    'personal-errands': {
      description: 'Acompañamiento durante desplazamientos, gestión de turnos, orientación y organización de documentos, respetando la privacidad, autonomía y decisiones de la persona.',
      exclusions: ['Solicitar o utilizar claves, tarjetas o contraseñas.', 'Firmar documentos, representar a la persona o realizar operaciones financieras en su nombre.', 'Retener documentos o dinero de la persona.'],
      conditions: 'La persona realiza las decisiones y los actos que requieren su voluntad. El acompañamiento respeta la privacidad de su información.',
      considerations: 'Conviene prever los documentos requeridos, los plazos y turnos, y las medidas para proteger la información, el dinero y las pertenencias personales.',
    },
    'personal-shopping': {
      description: 'Acompañamos a centros comerciales, farmacias y otros establecimientos para apoyar la búsqueda, selección y compra de artículos que la persona elige y autoriza. El traslado, cuando se necesita, se coordina con un tercero.',
      exclusions: ['Elegir o adquirir productos sin autorización de la persona.', 'Hacer recomendaciones médicas, cambiar fórmulas o decidir sustituciones de medicamentos.'],
      conditions: 'La persona elige y autoriza los productos. Podemos acordar el encuentro en el establecimiento o la recogida en el domicilio.',
      considerations: 'Es importante revisar los artículos elegidos, las condiciones de compra y devolución, y el cuidado del dinero, las pertenencias y los productos.',
    },
    'pharmacy-pickup': {
      description: 'Acompañamos a la persona en la diligencia o realizamos, sin su presencia, la solicitud, recogida y entrega de medicamentos previamente autorizados.',
      exclusions: ['Gestionar una recogida sin la autorización o documentación requerida.', 'Administrar medicamentos, modificar dosis o decidir sustituciones.', 'Brindar orientación clínica o asumir cuidados de enfermería.'],
      conditions: 'La gestión sin la presencia de la persona requiere su autorización y la documentación correspondiente.',
      considerations: 'Se deben confirmar la autorización, la documentación, los productos y las condiciones de entrega y conservación indicadas para la diligencia.',
    },
    'institutional-procedures': {
      description: 'Acompañamiento para desplazamientos, ubicación de oficinas, gestión de turnos, organización documental y comprensión de los procedimientos administrativos en EPS, bancos, cajas de compensación y entidades públicas.',
      exclusions: ['Ejercer representación legal, financiera o sanitaria.', 'Suplantar a la persona, firmar por ella o tomar decisiones sin su consentimiento.', 'Realizar transacciones bancarias o acceder a claves y datos financieros.'],
      conditions: 'La persona realiza personalmente los actos que requieren su voluntad y consentimiento. Las decisiones y los tiempos de las entidades dependen de terceros.',
      considerations: 'Es útil revisar los documentos, requisitos y plazos antes de la diligencia y proteger la información personal durante el trámite.',
    },
    'digital-support': {
      description: 'Apoyo paciente en el uso, configuración y ajustes básicos de celulares, televisores, computadores, tabletas y otros dispositivos. Incluye conectividad, accesibilidad, aplicaciones y funciones generales.',
      exclusions: ['Hacer transacciones bancarias, manejar contraseñas o claves, ni acceder a información financiera o sensible.', 'Realizar reparaciones electrónicas o instalaciones eléctricas.', 'Eliminar archivos o modificar información sin autorización de la persona.'],
      conditions: 'La persona conserva el control de sus dispositivos, su información y sus decisiones. Acordamos las funciones básicas en las que desea apoyo.',
      considerations: 'Los datos privados, los archivos y la configuración de los dispositivos requieren especial cuidado durante el acompañamiento.',
    },
    'wellbeing-company': {
      description: 'Compañía en el domicilio o fuera de él mediante juegos de mesa, lectura, conversación, actividades creativas, ejercicios recreativos de memoria, pasatiempos y actividades sociales.',
      exclusions: ['Realizar terapias clínicas o cuidados de enfermería.', 'Hacer higiene personal, suministrar medicamentos o prestar vigilancia permanente.', 'Realizar tareas del hogar o asumir actividades de servicio doméstico.'],
      conditions: 'Son actividades recreativas y de bienestar, acordadas según las preferencias y el ritmo de cada persona.',
      considerations: 'Conversamos sobre los intereses, el entorno y las condiciones de la actividad para respetar la comodidad, el ritmo y las pertenencias de la persona.',
    },
  };

  const dialog = document.querySelector('#service-dialog');
  let opener = null;
  function openService(link) {
    const service = services[link.dataset.service];
    if (!service) return;
    const card = link.closest('.service-card');
    const title = card.querySelector('h3').textContent;
    const photo = card.querySelector('img');
    opener = link;
    document.querySelector('#service-dialog-title').textContent = title;
    document.querySelector('#service-dialog-number').textContent = card.querySelector('.service-number').textContent;
    const modalPhoto = document.querySelector('#service-dialog-image');
    modalPhoto.src = photo.currentSrc || photo.src;
    modalPhoto.alt = photo.alt;
    document.querySelector('#service-dialog-description').textContent = service.description;
    document.querySelector('#service-dialog-conditions').textContent = service.conditions;
    document.querySelector('#service-dialog-considerations').textContent = service.considerations;
    document.querySelector('.service-considerations').open = false;
    const exclusions = document.querySelector('#service-dialog-exclusions');
    exclusions.replaceChildren(...[...service.exclusions, commonExclusion].map((text) => { const item = document.createElement('li'); item.textContent = text; return item; }));
    document.querySelector('#service-email').href = mailLink(`Consulta: ${title}`, `Hola, quisiera conocer la disponibilidad y las condiciones para la actividad: ${title}.`);
    document.body.classList.add('dialog-open');
    dialog.showModal();
  }
  slider.addEventListener('click', (event) => { const link = event.target.closest('[data-service]'); if (link) { event.preventDefault(); openService(link); } });
  document.querySelector('#service-dialog-close').addEventListener('click', () => dialog.close());
  document.querySelector('#service-dialog-back').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus(); });

  const durationButtons = [...document.querySelectorAll('[data-hours]')];
  function selectHours(hours) {
    if (![2, 4, 8].includes(hours)) return;
    durationButtons.forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.hours) === hours)));
    const total = money(hours * rate);
    document.querySelector('#price-estimate').textContent = total;
    document.querySelector('#quote-email').href = mailLink(`Solicitud de acompañamiento por ${hours} horas`, `Hola, quisiera información para un acompañamiento de ${hours} horas. Valor de referencia: ${total} COP, IVA incluido. Quisiera confirmar la disponibilidad y las condiciones del servicio.`);
  }
  durationButtons.forEach((button) => button.addEventListener('click', () => selectHours(Number(button.dataset.hours))));
  selectHours(2);
  document.querySelector('#copyright-year').textContent = String(new Date().getFullYear());

  document.querySelectorAll('.service-card img, .pricing-visual img, #service-dialog-image').forEach((image) => image.addEventListener('error', () => {
    if (!image.src.endsWith('/images/companionship-hero.jpg')) { image.src = '/images/companionship-hero.jpg'; image.alt = 'Imagen ilustrativa de acompañamiento cotidiano'; }
  }));
})();
