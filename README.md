# Inventory Manager Pro

Welcome to **Inventory Manager Pro**! This is a fast, offline, and secure desktop inventory management system built to handle stock intake, sales scanning, and bulk bulk data imports. 

---

## 🚀 How to Share with Your Friend (The Easy Way)
If your friend just wants to use the app and doesn't know about coding, **you do not need to share the source code with them.** You can just build a standalone Windows Installer (`.exe`) that they can install like any normal program!

**To build the installer for them:**
1. Open your terminal in this project folder.
2. Run the build command:
   ```bash
   npm run build
   ```
3. Wait for it to finish. Once done, go into the `dist-electron` folder. Inside, you will find a generated Windows Installer (e.g. `Inventory Manager Setup.exe`).
4. **Send that `.exe` file to your friend.** They can double-click it, install it, and use it right away! No internet or coding needed.

---

## 💻 Running the Source Code (For Developers)
If your friend is a developer and you are giving them this entire folder of source code, they need to follow these steps to run it on their machine:

### Prerequisites:
- Install **Node.js** (version 20 or 22+ recommended).

### Setup Steps:
1. Open a terminal in the project folder.
2. Install all dependencies:
   ```bash
   npm install
   ```
3. Re-link the local SQLite database to the Electron environment:
   ```bash
   npx @electron/rebuild -f -w better-sqlite3
   ```
4. Start the application in Developer Mode:
   ```bash
   npm run dev
   ```

---

## 🛠️ App Features & How to Use

When you open the application, you'll find a sidebar menu allowing you to navigate between different tools:

### 1. 📊 Dashboard
- Gives you an overview of your **Total Stock Items**, **Total Valuation**, and potential **Profit** based on your buying and selling prices.
- **Edit Item:** Click the blue Pencil icon on any item to update its barcode, name, pricing, or quantity.
- **Delete Item:** Click the red Trash icon to remove an item permanently.

### 2. ➕ Add Stock
- Create new products or increase the quantity of existing ones. 
- You can scan a barcode directly into the input field using a standard USB/Bluetooth barcode scanner.
- Add pricing details and hit save!

### 3. 🛒 Sell / Dispense
- The **Scan to Sell** screen is meant for ultra-fast checkouts.
- Simply scan your item's barcode while on this screen. It will instantly deduct `1` from the inventory and calculate your profit.

### 4. ☁️ Import Excel (Bulk Data)
- If you have an existing Excel (`.xlsx` or `.csv`) sheet with inventory, use this tab to import hundreds of items at once.
- Drag and drop your file into the box or click to browse.

**How your Excel file MUST be structured:**
The very first row in your Excel file must contain these exact Header names. Below them, fill in your product details.

| barcode       | name                  | buy_price | sell_price | quantity |
|---------------|-----------------------|-----------|------------|----------|
| 1928374650123 | Wireless Mouse Pro    | 1200      | 2500       | 50       |
| 5982138402128 | Mechanical Keyboard   | 4500      | 7000       | 15       |
| 9823412349012 | 1080p Web Camera      | 2000      | 3500       | 5        |

*Note: If an item in your Excel file has a `barcode` that already exists in the system, its quantity will simply be ADDED to the existing stock, and the prices will be updated.*

---

## 💾 Where is the data saved?
Since this is a privacy-first offline desktop app, the data isn't in the cloud. It's saved in a local SQLite file:
* **While Developing:** Saves to `database.db` inside your project folder.
* **When Packaged (Installed):** Saved deep in the user's AppData directory (so it persists through uninstalls/updates safely).