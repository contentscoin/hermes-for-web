const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.HERMES_WEBUI_PORT || '8788';
const repo = process.env.HERMES_WEBUI_REPO || path.join(app.getPath('home'), '.hermes', 'webui', 'workspace', 'hermes-for-web');
let server = null;

function startServer(){
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'python' : './start.sh';
  const args = isWin ? ['server.py', '--port', port] : [port];
  server = spawn(cmd, args, {cwd: repo, shell: isWin, stdio: 'ignore'});
}

function createWindow(){
  const win = new BrowserWindow({width: 1280, height: 860, title: 'Hermes CEO Console'});
  win.loadURL(`http://127.0.0.1:${port}`);
  win.webContents.setWindowOpenHandler(({url}) => { shell.openExternal(url); return {action:'deny'}; });
}

app.whenReady().then(()=>{ startServer(); setTimeout(createWindow, 1800); });
app.on('window-all-closed', ()=>{ if(server) server.kill(); if(process.platform !== 'darwin') app.quit(); });
