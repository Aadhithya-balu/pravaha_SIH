const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Project root and directory paths
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const isWin = process.platform === 'win32';

// Detect Python executable in backend venv or system
function getPythonExec() {
  const venvPythonWin = path.join(backendDir, '.venv', 'Scripts', 'python.exe');
  const venvPythonUnix = path.join(backendDir, '.venv', 'bin', 'python');

  if (isWin && fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }
  if (!isWin && fs.existsSync(venvPythonUnix)) {
    return venvPythonUnix;
  }
  return isWin ? 'python' : 'python3';
}

const pythonExec = getPythonExec();

console.log('====================================================');
console.log('  PRAVAHA — AICTE Regulatory Operations Platform');
console.log('  Backend:  http://127.0.0.1:8000');
console.log('  Frontend: http://localhost:5173');
console.log(`  Python:   ${pythonExec}`);
console.log('====================================================\n');

// 1. Launch FastAPI Backend
const backend = spawn(
  pythonExec,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
  {
    cwd: backendDir,
    stdio: ['inherit', 'pipe', 'pipe']
  }
);

backend.stdout.on('data', (chunk) => {
  process.stdout.write(`\x1b[34m[BACKEND]\x1b[0m ${chunk}`);
});

backend.stderr.on('data', (chunk) => {
  process.stderr.write(`\x1b[34m[BACKEND]\x1b[0m ${chunk}`);
});

backend.on('error', (err) => {
  console.error('\x1b[31m[BACKEND ERROR]\x1b[0m', err.message);
});

// 2. Launch Vite Frontend via cmd.exe on Windows to prevent EINVAL error
const frontendCmd = isWin ? 'cmd.exe' : 'npm';
const frontendArgs = isWin ? ['/c', 'npm', 'run', 'dev'] : ['run', 'dev'];

const frontend = spawn(frontendCmd, frontendArgs, {
  cwd: frontendDir,
  stdio: ['inherit', 'pipe', 'pipe']
});

frontend.stdout.on('data', (chunk) => {
  process.stdout.write(`\x1b[32m[FRONTEND]\x1b[0m ${chunk}`);
});

frontend.stderr.on('data', (chunk) => {
  process.stderr.write(`\x1b[32m[FRONTEND]\x1b[0m ${chunk}`);
});

frontend.on('error', (err) => {
  console.error('\x1b[31m[FRONTEND ERROR]\x1b[0m', err.message);
});

// Graceful termination of child processes on SIGINT / Ctrl+C
function cleanExit() {
  console.log('\nGracefully shutting down backend and frontend services...');
  try {
    if (backend && !backend.killed) {
      if (isWin) {
        spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t']);
      } else {
        backend.kill('SIGINT');
      }
    }
  } catch (e) {}

  try {
    if (frontend && !frontend.killed) {
      if (isWin) {
        spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t']);
      } else {
        frontend.kill('SIGINT');
      }
    }
  } catch (e) {}

  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);
