const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: (username, password) => ipcRenderer.invoke('login', username, password),
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  sellProduct: (barcode, qty) => ipcRenderer.invoke('sell-product', barcode, qty),
  bulkInsert: (products) => ipcRenderer.invoke('bulk-insert', products),
  editProduct: (product) => ipcRenderer.invoke('edit-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  getSalesStats: () => ipcRenderer.invoke('get-sales-stats'),
  exportSalesExcel: () => ipcRenderer.invoke('export-sales-excel'),
  getRecentSales: () => ipcRenderer.invoke('get-recent-sales'),
  deleteSale: (id) => ipcRenderer.invoke('delete-sale', id),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  exportStockExcel: () => ipcRenderer.invoke('export-stock-excel'),
  addSeller: (username, password) => ipcRenderer.invoke('add-seller', username, password),
  getSellers: () => ipcRenderer.invoke('get-sellers'),
  deleteSeller: (id) => ipcRenderer.invoke('delete-seller', id),
  updateUser: (id, newUsername, newPassword) => ipcRenderer.invoke('update-user', id, newUsername, newPassword),
  confirm: (message) => ipcRenderer.invoke('confirm', message),
});
