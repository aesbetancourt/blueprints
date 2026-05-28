import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.js';
import { workspaceStoreHandler } from './store/workspace';
import { settingsStoreHandler } from './store/settings';

async function initStores() {
  await workspaceStoreHandler.start();
  await settingsStoreHandler.start();
}

const root = document.getElementById('root') as HTMLElement;

initStores()
  .then(() => {
    createRoot(root).render(<App />);
  })
  .catch((err) => {
    // If stores fail to init (e.g. running in browser without Tauri),
    // render anyway with default state
    console.warn('Store initialization failed, using defaults:', err);
    createRoot(root).render(<App />);
  });
