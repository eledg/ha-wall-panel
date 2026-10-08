/** @type {import('semantic-release').GlobalConfig} */
const config = {
  branches: ['main'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'angular',
        releaseRules: [
          { type: 'chore', release: 'patch' },
          { type: 'fix', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'ci', release: 'patch' },
          { type: 'test', release: 'patch' },
          { type: 'pipeline', release: 'patch' },
          { type: 'infra', release: 'minor' },
          { type: 'feat', release: 'minor' },
          { type: 'minor', release: 'minor' },
          { type: 'major', release: 'major' },
          { release: 'patch' },
        ],
      },
    ],
  ],
};

export default config;
