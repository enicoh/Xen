const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  sellProduct: (barcode) => ipcRenderer.invoke('sell-product', barcode),
  bulkInsert: (products) => ipcRenderer.invoke('bulk-insert', products),
  editProduct: (product) => ipcRenderer.invoke('edit-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  getSalesStats: () => ipcRenderer.invoke('get-sales-stats'),
  exportSalesExcel: () => ipcRenderer.invoke('export-sales-excel'),
  getRecentSales: () => ipcRenderer.invoke('get-recent-sales'),
  resetDatabase: () => ipcRenderer.invoke('reset-database'),
  exportStockExcel: () => ipcRenderer.invoke('export-stock-excel'),
});
