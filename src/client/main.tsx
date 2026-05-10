import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tailwind.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');
createRoot(container).render(<App />);
