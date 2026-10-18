import { validateConfig } from '@/config/config.ts';
import type { ConfigIssue } from '@/config/config.ts';

export const ConfigWarning = ({
  issues = validateConfig(),
}: {
  issues?: ConfigIssue[];
}) =>
  issues.length === 0 ? null : (
    <div
      role="alert"
      class="fixed top-0 right-0 left-0 bg-warn p-2 text-label text-fg"
    >
      <strong>Config problem:</strong>
      <ul>
        {issues.map(({ key, message }) => (
          <li key={key}>
            <code>{key}</code>: {message}
          </li>
        ))}
      </ul>
    </div>
  );
