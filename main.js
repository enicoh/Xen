const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

const isDev = !app.isPackaged;

// Initialize Database
const dbPath = isDev ? 'database.db' : path.join(app.getPath('userData'), 'database.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    name TEXT,
    buy_price DECIMAL(10, 2),
    sell_price DECIMAL(10, 2),
    quantity INTEGER DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    barcode TEXT,
    name TEXT,
    buy_price DECIMAL(10, 2),
    sell_price DECIMAL(10, 2),
    profit DECIMAL(10, 2),
    sale_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migration: add image column if it doesn't exist yet
try { db.exec('ALTER TABLE products ADD COLUMN image TEXT;'); } catch(e) {}


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
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

// --- IPC HANDLERS ---

// Get all products
ipcMain.handle('get-products', () => {
  const stmt = db.prepare('SELECT * FROM products ORDER BY id DESC');
  return stmt.all();
});

// Add or increment stock by barcode
ipcMain.handle('add-product', (event, product) => {
  const { barcode, name, buy_price, sell_price, quantity, image } = product;

  // Check if product exists by barcode
  const existingProduct = db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);

  if (existingProduct) {
    // Increment quantity, optionally update image if provided
    if (image) {
      db.prepare('UPDATE products SET quantity = quantity + ?, image = ? WHERE barcode = ?').run(quantity, image, barcode);
    } else {
      db.prepare('UPDATE products SET quantity = quantity + ? WHERE barcode = ?').run(quantity, barcode);
    }
    return { success: true, message: 'Stock updated', action: 'updated' };
  } else {
    // Insert new product
    const stmt = db.prepare(`
      INSERT INTO products (barcode, name, buy_price, sell_price, quantity, image) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(barcode, name, buy_price, sell_price, quantity, image || null);
    return { success: true, message: 'Product added', action: 'added', id: info.lastInsertRowid };
  }
});

// Sell product (minus stock)
ipcMain.handle('sell-product', (event, barcode) => {
  const existingProduct = db.prepare('SELECT * FROM products WHERE barcode = ?').get(barcode);

  if (!existingProduct) {
    return { success: false, message: 'Product not found' };
  }

  if (existingProduct.quantity <= 0) {
    return { success: false, message: 'Out of stock' };
  }

  const stmt = db.prepare('UPDATE products SET quantity = quantity - 1 WHERE id = ?');
  stmt.run(existingProduct.id);

  const profit = existingProduct.sell_price - existingProduct.buy_price;

  // Record the sale
  const insertSale = db.prepare(`
    INSERT INTO sales (product_id, barcode, name, buy_price, sell_price, profit)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertSale.run(existingProduct.id, existingProduct.barcode, existingProduct.name, existingProduct.buy_price, existingProduct.sell_price, profit);

  return {
    success: true,
    message: 'Sale successful',
    product: existingProduct,
    profit: profit
  };
});

// Bulk Insert Products
ipcMain.handle('bulk-insert', (event, products) => {
  const insert = db.prepare(`
    INSERT INTO products (barcode, name, buy_price, sell_price, quantity) 
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(barcode) DO UPDATE SET 
      quantity = quantity + excluded.quantity,
      buy_price = excluded.buy_price,
      sell_price = excluded.sell_price,
      name = excluded.name
  `);

  const insertMany = db.transaction((prods) => {
    for (const p of prods) {
      insert.run(p.barcode, p.name, p.buy_price, p.sell_price, p.quantity);
    }
  });

  try {
    insertMany(products);
    return {
      success: true, message: 'Imported ' + products.length + ' products successfully'
    };
  } catch (error) {
      return { success: false, message: error.message };
    }
  });

ipcMain.handle('edit-product', (event, product) => {
  try {
    const stmt = db.prepare('UPDATE products SET barcode=?, name=?, buy_price=?, sell_price=?, quantity=?, image=? WHERE id=?');
    stmt.run(product.barcode, product.name, product.buy_price, product.sell_price, product.quantity, product.image || null, product.id);
    return { success: true, message: 'Product updated successfully' };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, message: 'Barcode already exists on another product.' };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle('delete-product', (event, id) => {
  const stmt = db.prepare('DELETE FROM products WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

ipcMain.handle('get-sales-stats', () => {
  const result = db.prepare('SELECT SUM(profit) as totalProfit, SUM(sell_price) as totalRevenue, COUNT(id) as totalSalesCount FROM sales').get();
  return {
    success: true,
    data: {
      totalProfit: result.totalProfit || 0,
      totalRevenue: result.totalRevenue || 0,
      totalSalesCount: result.totalSalesCount || 0
    }
  };
});

ipcMain.handle('export-sales-excel', async () => {
  try {
    const XLSX = require('xlsx');
    const stmt = db.prepare('SELECT barcode, name, buy_price, sell_price, profit, sale_date FROM sales ORDER BY sale_date DESC');
    const sales = stmt.all();
    
    if (sales.length === 0) return { success: false, message: 'No sales recorded yet.' };

    let totalProfit = 0;
    let totalRevenue = 0;
    sales.forEach(s => {
      totalProfit += s.profit;
      totalRevenue += s.sell_price;
    });

    const summary = [
      { },
      { name: 'TOTAL REVENUE (DZD)', profit: totalRevenue },
      { name: 'TOTAL BENEFICE (DZD)', profit: totalProfit }
    ];

    const worksheet = XLSX.utils.json_to_sheet([...sales, ...summary]);
    // Widen columns a bit for readability
    worksheet['!cols'] = [ {wch: 20}, {wch: 25}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 25} ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales History");

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Sales History',
      defaultPath: 'Sales_Benefice_Record.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) {
      return { success: false, message: 'Export cancelled' };
    }

    XLSX.writeFile(workbook, filePath);
    return { success: true, message: 'Excel file generated successfully!' };
  } catch (error) {
    return { success: false, message: 'Export failed: ' + error.message };
  }
});

ipcMain.handle('get-recent-sales', () => {
  const stmt = db.prepare('SELECT * FROM sales ORDER BY sale_date DESC LIMIT 50');
  return { success: true, data: stmt.all() };
});

ipcMain.handle('reset-database', () => {
  try {
    db.exec(`
      DELETE FROM products;
      DELETE FROM sales;
      DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales');
    `);
    return { success: true, message: 'Database reset successfully!' };
  } catch (error) {
    return { success: false, message: 'Failed to reset database: ' + error.message };
  }
});

ipcMain.handle('export-stock-excel', async () => {
  try {
    const XLSX = require('xlsx');
    const stmt = db.prepare('SELECT barcode, name, buy_price, sell_price, quantity FROM products ORDER BY name ASC');
    const products = stmt.all();
    
    if (products.length === 0) return { success: false, message: 'No products in stock to export.' };

    const worksheet = XLSX.utils.json_to_sheet(products);
    worksheet['!cols'] = [ {wch: 20}, {wch: 35}, {wch: 15}, {wch: 15}, {wch: 15} ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Inventory");

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: 'Export Stock Inventory',
      defaultPath: 'Stock_Inventory_Backup.xlsx',
      filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
    });

    if (canceled || !filePath) return { success: false, message: 'Export cancelled' };

    XLSX.writeFile(workbook, filePath);
    return { success: true, message: 'Stock exported generated successfully!' };
  } catch (error) {
    return { success: false, message: 'Export failed: ' + error.message };
  }
});
