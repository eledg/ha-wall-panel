import { render } from 'preact';

import './index.css';
import { startAutoReload } from '@/lib/auto-reload.ts';
import { connectHa } from '@/services/ha/connect.ts';
import { haAuth, haStore } from '@/services/ha/instance.ts';
import { startPerf } from '@/services/perf/counters.ts';

import { App } from './app.tsx';

render(<App />, document.getElementById('app')!);
startPerf(haStore);

void connectHa(haStore, haAuth);

if (!import.meta.env.DEV) startAutoReload(__BUILD_INFO__);
