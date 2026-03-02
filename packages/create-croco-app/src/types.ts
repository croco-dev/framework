export type GeneratorOptions = {
  projectName: string;
  scope: string;
  preset: 'ddd-fullstack' | 'ddd-api' | 'blank';
  webApps: string[];
  api?: 'graphql' | 'trpc';
  apiHosting: 'standalone' | 'nextjs';
  backendDeploy?: 'docker' | 'lambda';
  frontendDeploy?: 'opennext' | 'vercel' | 'docker';
  db: ('postgres' | 'mongodb' | 'redis')[];
  agentRules: boolean;
  installDeps: boolean;
  initGit: boolean;
};
