import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App.js';

const root = document.getElementById('root') as HTMLElement;
createRoot(root).render(<App />);
