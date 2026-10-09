import { render } from 'preact';

import './index.css';
import { App } from './app.tsx';
import { startAutoReload } from './auto-reload.ts';
import { connectHa } from './ha/connect.ts';
import { haStore, mockHa } from './ha/instance.ts';

render(<App />, document.getElementById('app')!);

void connectHa(haStore, mockHa?.getAuth);

if (!import.meta.env.DEV) startAutoReload(__BUILD_INFO__);
