const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const crypto = require('crypto');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
    })

    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        console.log(deviceList)

        event.preventDefault()
        if (deviceList && deviceList.length > 0) {
            callback(deviceList[0].deviceId)
        }
    })
    // open dev tools
    // mainWindow.webContents.openDevTools();

    mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})


ipcMain.on('wakuwaku:xxx', async (event, arg) => {
    console.log('receive message: wakuwaku:xxx')
    console.log(arg)
    await sleep(3)
    event.sender.send('wakuwaku:yyy', {message: 'pong'})
})

ipcMain.on('sha256-hash', (event, arg) => {
    console.log(arg)  // "ping"を表示
    const hashHex = crypto.createHash('sha256').update(arg, 'utf8').digest('hex');
    event.sender.send('sha256-hash', {message: hashHex})
})
