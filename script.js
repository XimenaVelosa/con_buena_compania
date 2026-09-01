
const track = document.getElementById('cardsTrack');
const prev = document.querySelector('.prev');
const next = document.querySelector('.next');

function cardStep() {
  const card = track.querySelector('.service-card');
  return card ? card.getBoundingClientRect().width + 18 : 220;
}

prev?.addEventListener('click', () => {
  track.scrollBy({ left: -cardStep() * 2, behavior: 'smooth' });
});

next?.addEventListener('click', () => {
  track.scrollBy({ left: cardStep() * 2, behavior: 'smooth' });
});

const menuBtn = document.querySelector('.menu-btn');
const header = document.querySelector('.site-header');

menuBtn?.addEventListener('click', () => {
  header.classList.toggle('menu-open');
});

document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => header.classList.remove('menu-open'));
});

document.getElementById('contactForm')?.addEventListener('submit', (e) => {
  e.preventDefault();

  const data = new FormData(e.currentTarget);
  const nombre = data.get('nombre') || '';
  const telefono = data.get('telefono') || '';
  const correo = data.get('correo') || '';
  const mensaje = data.get('mensaje') || '';

  const texto = `Hola, soy ${nombre}.%0A%0ATeléfono: ${telefono}%0ACorreo: ${correo}%0A%0A${mensaje}`;
  window.open(`https://wa.me/573001234567?text=${texto}`, '_blank');
});
