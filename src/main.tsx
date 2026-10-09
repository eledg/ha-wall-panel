import { render } from 'preact';

import './index.css';
import { App } from './app.tsx';
import { startAutoReload } from './auto-reload.ts';

render(<App />, document.getElementById('app')!);

if (!import.meta.env.DEV) startAutoReload(__BUILD_INFO__);
