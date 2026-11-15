import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const Root = import.meta.env.VITE_SMV_RELEASE_MODE !== 'frontend-demo' && location.pathname === '/gaze-experiment'
  ? (await import('./gaze/GazeExperiment')).GazeExperiment : App;
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
