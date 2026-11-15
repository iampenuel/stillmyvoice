import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const Root = location.pathname === '/gaze-experiment'
  ? (await import('./gaze/GazeExperiment')).GazeExperiment : App;
createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
