const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // ========== WEB SERIAL API HANDLERS ==========
  
  // 1. Automatically approve serial port permissions
  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'serial') {
      return true;
    }
    return false;
  });

  // 2. Automatically grant device permission
  win.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial') {
      return true;
    }
    return false;
  });

  // 3. Handle the prompt when navigator.serial.requestPort() is called
  win.webContents.session.on('select-serial-port', (event, portList, webContents, callback) => {
    // Prevent default behavior
    event.preventDefault();

    if (portList && portList.length > 0) {
      // Collect the COM port names (like "COM3", "COM4")
      const portNames = portList.map(port => port.portName);
      
      // Use Electron's native message box to prompt the user
      dialog.showMessageBox(win, {
        type: 'question',
        buttons: [...portNames, '取消 / Cancel'],
        defaultId: portNames.length,
        cancelId: portNames.length,
        title: '选择串口 / Select Serial Port',
        message: '请选择要连接的设备串口：\nPlease select a serial port to connect:',
      }).then(result => {
        const selectedIndex = result.response;
        // If the user selected a valid port (not the Cancel button)
        if (selectedIndex < portNames.length) {
          callback(portList[selectedIndex].portId);
        } else {
          callback(''); // User cancelled
        }
      });
    } else {
       dialog.showErrorBox('未找到设备', '未检测到任何可用的串口设备。请检查设备是否已连接。');
       callback(''); // No ports found
    }
  });
  // =============================================

  // check if we are in development mode indicated by Vite running
  const isDev = !app.isPackaged;

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});