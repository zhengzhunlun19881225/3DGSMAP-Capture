// Public previews do not have a training server. Local development uses the
// localhost service; an explicit endpoint can be supplied at build time.
const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
export const reconstructionApi = (import.meta.env.VITE_RECONSTRUCTION_API_URL ||
  (local ? 'http://127.0.0.1:8787' : '')).replace(/\/$/, '');
