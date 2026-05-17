const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('or3Desktop', Object.freeze({}));
