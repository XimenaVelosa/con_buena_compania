// Public configuration only. Credentials belong to the backend environment.
window.CBC_API_URL = window.CBC_API_URL || (['localhost', '127.0.0.1'].includes(location.hostname) ? `http://${location.hostname}:3001` : '/api');
