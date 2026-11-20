// Videos públicos por actividad: enlace directo MP4/WebM o ruta local /videos/.
// Ejemplo: { src: '/videos/citas-medicas.mp4', poster: '/images/service-medical.jpg' }
window.CBC_ACTIVITY_VIDEOS = {
  'medical-appointments': null,
  groceries: null,
  'personal-errands': null,
  'delegated-errands': null,
  'personal-shopping': null,
  'pharmacy-pickup': null,
  'institutional-procedures': null,
  'digital-support': null,
  'wellbeing-company': null,
  'religious-companionship': null,
  ...(window.CBC_ACTIVITY_VIDEOS || {}),
};
