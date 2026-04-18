const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const crypto = require("crypto");

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

const isDev = !app.isPackaged;

// Initialize Database
const dbPath = isDev
  ? "database.db"
  : path.join(app.getPath("userData"), "database.db");
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );

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
try {
  db.exec("ALTER TABLE products ADD COLUMN image TEXT;");
} catch (e) {}

try {
  db.exec("ALTER TABLE sales ADD COLUMN quantity INTEGER DEFAULT 1;");
} catch (e) {}

// Insert default users if none exist
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
if (userCount === 0) {
  const insertUser = db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
  );
  insertUser.run("admin", hashPassword("admin"), "admin");
  insertUser.run("seller", hashPassword("seller"), "seller");
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenu(null);

  if (isDev) {
    win.loadURL("http://localhost:5173");
    // win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- IPC HANDLERS ---

// Login
ipcMain.handle("login", (event, username, password) => {
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  if (user) {
    const hashed = hashPassword(password);
    if (user.password === hashed || user.password === password) {
      return {
        success: true,
        role: user.role,
        username: user.username,
        id: user.id,
      };
    }
  }
  return { success: false, message: "Invalid username or password" };
});

// Get all products
ipcMain.handle("get-products", () => {
  const stmt = db.prepare("SELECT * FROM products ORDER BY id DESC");
  return stmt.all();
});

// Add or increment stock by barcode
ipcMain.handle("add-product", (event, product) => {
  const { barcode, name, buy_price, sell_price, quantity, image } = product;

  // Check if product exists by barcode
  const existingProduct = db
    .prepare("SELECT * FROM products WHERE barcode = ?")
    .get(barcode);

  if (existingProduct) {
    // Increment quantity, optionally update image if provided
    if (image) {
      db.prepare(
        "UPDATE products SET quantity = quantity + ?, image = ? WHERE barcode = ?",
      ).run(quantity, image, barcode);
    } else {
      db.prepare(
        "UPDATE products SET quantity = quantity + ? WHERE barcode = ?",
      ).run(quantity, barcode);
    }
    return { success: true, message: "Stock updated", action: "updated" };
  } else {
    // Insert new product
    const stmt = db.prepare(`
      INSERT INTO products (barcode, name, buy_price, sell_price, quantity, image) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      barcode,
      name,
      buy_price,
      sell_price,
      quantity,
      image || null,
    );
    return {
      success: true,
      message: "Product added",
      action: "added",
      id: info.lastInsertRowid,
    };
  }
});

// Sell product (minus stock)
ipcMain.handle("sell-product", (event, barcode, qty = 1) => {
  const existingProduct = db
    .prepare("SELECT * FROM products WHERE barcode = ?")
    .get(barcode);

  if (!existingProduct) {
    return { success: false, message: "Product not found" };
  }

  if (existingProduct.quantity < qty) {
    return { success: false, message: "Out of stock / Not enough quantity" };
  }

  const stmt = db.prepare(
    "UPDATE products SET quantity = quantity - ? WHERE id = ?",
  );
  stmt.run(qty, existingProduct.id);

  const profitPerItem = existingProduct.sell_price - existingProduct.buy_price;
  const totalProfit = profitPerItem * qty;
  const totalSellPrice = existingProduct.sell_price * qty;
  const totalBuyPrice = existingProduct.buy_price * qty;

  // Record the sale
  const insertSale = db.prepare(`
    INSERT INTO sales (product_id, barcode, name, buy_price, sell_price, profit, quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertSale.run(
    existingProduct.id,
    existingProduct.barcode,
    existingProduct.name,
    totalBuyPrice,
    totalSellPrice,
    totalProfit,
    qty,
  );

  return {
    success: true,
    message: "Sale successful",
    product: existingProduct,
    profit: totalProfit,
    quantity: qty,
  };
});

// Bulk Insert Products
ipcMain.handle("bulk-insert", (event, products) => {
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
      success: true,
      message: "Imported " + products.length + " products successfully",
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle("edit-product", (event, product) => {
  try {
    const stmt = db.prepare(
      "UPDATE products SET barcode=?, name=?, buy_price=?, sell_price=?, quantity=?, image=? WHERE id=?",
    );
    stmt.run(
      product.barcode,
      product.name,
      product.buy_price,
      product.sell_price,
      product.quantity,
      product.image || null,
      product.id,
    );
    return { success: true, message: "Product updated successfully" };
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return {
        success: false,
        message: "Barcode already exists on another product.",
      };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle("delete-product", (event, id) => {
  const stmt = db.prepare("DELETE FROM products WHERE id = ?");
  stmt.run(id);
  return { success: true };
});

ipcMain.handle("get-sales-stats", () => {
  const result = db
    .prepare(
      "SELECT SUM(profit) as totalProfit, SUM(sell_price) as totalRevenue, SUM(quantity) as totalSalesCount FROM sales",
    )
    .get();
  return {
    success: true,
    data: {
      totalProfit: result.totalProfit || 0,
      totalRevenue: result.totalRevenue || 0,
      totalSalesCount: result.totalSalesCount || 0,
    },
  };
});

ipcMain.handle("export-sales-excel", async () => {
  try {
    const XLSX = require("xlsx");
    const stmt = db.prepare(
      "SELECT barcode, name, COALESCE(quantity, 1) as quantity, buy_price, sell_price, profit, sale_date FROM sales ORDER BY sale_date DESC",
    );
    const sales = stmt.all();

    if (sales.length === 0)
      return { success: false, message: "No sales recorded yet." };

    let totalProfit = 0;
    let totalRevenue = 0;
    sales.forEach((s) => {
      totalProfit += s.profit;
      totalRevenue += s.sell_price;
    });

    const summary = [
      {},
      { name: "TOTAL REVENUE (DZD)", profit: totalRevenue },
      { name: "TOTAL BENEFICE (DZD)", profit: totalProfit },
    ];

    const worksheet = XLSX.utils.json_to_sheet([...sales, ...summary]);
    // Widen columns a bit for readability
    worksheet["!cols"] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales History");

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Export Sales History",
      defaultPath: "Sales_Benefice_Record.xlsx",
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) {
      return { success: false, message: "Export cancelled" };
    }

    XLSX.writeFile(workbook, filePath);
    return { success: true, message: "Excel file generated successfully!" };
  } catch (error) {
    return { success: false, message: "Export failed: " + error.message };
  }
});

ipcMain.handle("get-recent-sales", () => {
  const stmt = db.prepare(
    "SELECT * FROM sales ORDER BY sale_date DESC LIMIT 50",
  );
  return { success: true, data: stmt.all() };
});

ipcMain.handle("delete-sale", (event, saleId) => {
  try {
    const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId);
    if (!sale) return { success: false, message: "Sale not found" };

    db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(
      sale.quantity || 1,
      sale.product_id,
    );
    db.prepare("DELETE FROM sales WHERE id = ?").run(saleId);

    return { success: true, message: "Sale deleted and stock restored" };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle("reset-database", () => {
  try {
    db.exec(`
      DELETE FROM products;
      DELETE FROM sales;
      DELETE FROM sqlite_sequence WHERE name IN ('products', 'sales');
    `);
    return { success: true, message: "Database reset successfully!" };
  } catch (error) {
    return {
      success: false,
      message: "Failed to reset database: " + error.message,
    };
  }
});

ipcMain.handle("export-stock-excel", async () => {
  try {
    const XLSX = require("xlsx");
    const stmt = db.prepare(
      "SELECT barcode, name, buy_price, sell_price, quantity FROM products ORDER BY name ASC",
    );
    const products = stmt.all();

    if (products.length === 0)
      return { success: false, message: "No products in stock to export." };

    const worksheet = XLSX.utils.json_to_sheet(products);
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 35 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Inventory");

    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Export Stock Inventory",
      defaultPath: "Stock_Inventory_Backup.xlsx",
      filters: [{ name: "Excel Files", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath)
      return { success: false, message: "Export cancelled" };

    XLSX.writeFile(workbook, filePath);
    return { success: true, message: "Stock exported generated successfully!" };
  } catch (error) {
    return { success: false, message: "Export failed: " + error.message };
  }
});

// Manage Sellers
ipcMain.handle("add-seller", (event, username, password) => {
  try {
    const stmt = db.prepare(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    );
    stmt.run(username, hashPassword(password), "seller");
    return { success: true, message: "Seller created successfully" };
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { success: false, message: "Username already exists" };
    }
    return { success: false, message: error.message };
  }
});

ipcMain.handle("get-sellers", () => {
  return db
    .prepare("SELECT id, username, role FROM users WHERE role = 'seller'")
    .all();
});

ipcMain.handle("delete-seller", (event, id) => {
  db.prepare("DELETE FROM users WHERE id = ? AND role = 'seller'").run(id);
  return { success: true, message: "Seller deleted" };
});

ipcMain.handle("update-user", (event, id, newUsername, newPassword) => {
  try {
    if (newPassword) {
      db.prepare(
        "UPDATE users SET username = ?, password = ? WHERE id = ?",
      ).run(newUsername, hashPassword(newPassword), id);
    } else {
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(
        newUsername,
        id,
      );
    }
    return { success: true, message: "Credentials updated successfully" };
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return { success: false, message: "Username already exists" };
    }
    return { success: false, message: error.message };
  }
});
