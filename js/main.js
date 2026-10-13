// Entry point: builds the app into the page.
import { createApp } from './core/app.js';

const app = createApp({ appEl: document.getElementById('app'), uiEl: document.getElementById('ui') });
window.addEventListener('error', (e) => console.error(e.message));
export default app;
