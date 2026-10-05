// Runs the game server and the Vite dev client together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const run = (cmd, args, name) => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => { console.log(`${name} exited (${code})`); process.exit(code ?? 0); });
  return p;
};
const server = run('node', ['--watch', 'server/index.js'], 'server');
const client = run('npx', ['vite'], 'client');
process.on('SIGINT', () => { server.kill(); client.kill(); });
