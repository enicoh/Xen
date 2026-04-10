import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  PlusCircle,
  MinusCircle,
  LayoutDashboard,
  UploadCloud,
  Search,
  Trash2,
  TrendingUp,
  Coins,
  Archive,
  Edit,
  AlertTriangle,
  Settings,
} from "lucide-react";
import * as XLSX from "xlsx";

const mapAzertyToNumber = (str) => {
  const azertyMap = {
    "&": "1",
    é: "2",
    '"': "3",
    "'": "4",
    "(": "5",
    "-": "6",
    è: "7",
    _: "8",
    ç: "9",
    à: "0",
  };
  return str
    .split("")
    .map((c) => azertyMap[c] || c)
    .join("");
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [notification, setNotification] = useState(null);
  const [pendingBarcode, setPendingBarcode] = useState("");

  const bufferRef = useRef("");
  const scanTimeoutRef = useRef(null);

  const fetchProducts = async () => {
    if (window.api) {
      try {
        const data = await window.api.getProducts();
        if (Array.isArray(data)) setProducts(data);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeTab]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleNotFound = (barcode) => {
    setPendingBarcode(barcode);
    setActiveTab("add");
  };

  const triggerGlobalScan = async (barcode) => {
    if (activeTab === "add") {
      handleNotFound(barcode);
      return;
    }

    if (window.api) {
      const res = await window.api.sellProduct(barcode);
      if (res.success) {
        showNotification(
          `Sold 1x ${res.product.name} (Profit: ${(res.profit || 0).toFixed(2)} DZD)`,
          "success",
        );
        fetchProducts();
      } else {
        if (res.message === "Product not found") {
          handleNotFound(barcode);
        } else {
          showNotification(res.message, "error");
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ["INPUT", "TEXTAREA"].includes(e.target?.tagName);
      if (isInput) return; // Let native inputs handle normal typing

      if (e.key === "Enter") {
        if (bufferRef.current.length > 2) {
          const barcode = bufferRef.current;
          bufferRef.current = "";
          e.preventDefault();
          triggerGlobalScan(barcode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += mapAzertyToNumber(e.key);

        // Auto-finalize if no more keys are pressed within 150ms
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length > 2) {
            const barcode = bufferRef.current;
            bufferRef.current = "";
            triggerGlobalScan(barcode);
          } else {
            bufferRef.current = ""; // discard random weak typing
          }
        }, 150);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(scanTimeoutRef.current);
    };
  }, [activeTab]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="bg-brand-500 p-2 rounded-xl">
            <Package className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">
              Inventory
            </h1>
            <p className="text-xs text-gray-500 font-medium">Manager Pro</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarButton
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
          />
          <SidebarButton
            icon={<PlusCircle size={20} />}
            label="Add Stock"
            active={activeTab === "add"}
            onClick={() => setActiveTab("add")}
          />

          <SidebarButton
            icon={<UploadCloud size={20} />}
            label="Import Excel"
            active={activeTab === "import"}
            onClick={() => setActiveTab("import")}
          />
          <SidebarButton
            icon={<Settings size={20} />}
            label="Settings"
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Placeholder */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shadow-sm z-10 shrink-0">
          <h2 className="text-xl font-semibold text-gray-800 capitalize">
            {activeTab.replace("-", " ")}
          </h2>
          <div className="ml-auto">
            {/* Quick stats or user profile could go here */}
          </div>
        </header>

        {/* Notification Toast */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 transform transition-all duration-300 translate-y-0 ${notification.type === "error" ? "bg-red-500 text-white" : "bg-gray-800 text-white"}`}
          >
            {notification.message}
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            {activeTab === "dashboard" && (
              <DashboardView
                products={products}
                fetchProducts={fetchProducts}
                showNotification={showNotification}
              />
            )}
            {activeTab === "add" && (
              <AddStockView
                showNotification={showNotification}
                initialBarcode={pendingBarcode}
                clearPending={() => setPendingBarcode("")}
              />
            )}

            {activeTab === "import" && (
              <ImportExcelView
                showNotification={showNotification}
                fetchProducts={fetchProducts}
              />
            )}
            {activeTab === "settings" && (
              <SettingsView
                showNotification={showNotification}
                fetchProducts={fetchProducts}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ------ COMPONENTS ------

function SidebarButton({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
        ${
          active
            ? "bg-brand-50 text-brand-600 shadow-sm border border-brand-100"
            : "text-gray-600 hover:bg-gray-100"
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// --- Views ---

function DashboardView({ products, fetchProducts, showNotification }) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [salesStats, setSalesStats] = useState({
    totalProfit: 0,
    totalRevenue: 0,
    totalSalesCount: 0,
  });
  const [recentSales, setRecentSales] = useState([]);

  const fetchStats = async () => {
    if (window.api) {
      if (window.api.getSalesStats) {
        try {
          const res = await window.api.getSalesStats();
          if (res.success) setSalesStats(res.data);
        } catch (err) {
          console.error("Failed to fetch sales stats", err);
        }
      }
      if (window.api.getRecentSales) {
        try {
          const res = await window.api.getRecentSales();
          if (res.success) setRecentSales(res.data);
        } catch (err) {
          console.error("Failed to fetch recent sales", err);
        }
      }
    }
  };

  useEffect(() => {
    fetchStats();
  }, [products]);

  const totalItems = products.reduce((acc, p) => acc + (p.quantity || 0), 0);
  const totalValuation = products.reduce(
    (acc, p) => acc + (p.quantity || 0) * (p.sell_price || 0),
    0,
  );
  const potentialProfit = products.reduce(
    (acc, p) =>
      acc + (p.quantity || 0) * ((p.sell_price || 0) - (p.buy_price || 0)),
    0,
  );

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      await window.api.deleteProduct(id);
      fetchProducts();
    }
  };

  const handleExportSales = async () => {
    if (window.api && window.api.exportSalesExcel) {
      const res = await window.api.exportSalesExcel();
      if (res.success) {
        showNotification(res.message, "success");
      } else {
        showNotification(res.message, "error");
      }
    }
  };

  // Stock level helpers
  const getStockColor = (qty) => {
    if (qty <= 5) return "bg-red-100 text-red-700 ring-1 ring-red-300";
    if (qty <= 10)
      return "bg-orange-100 text-orange-700 ring-1 ring-orange-300";
    return "bg-green-100 text-green-700";
  };

  const criticalProducts = products.filter((p) => p.quantity <= 5);
  const lowProducts = products.filter(
    (p) => p.quantity > 5 && p.quantity <= 10,
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Stock Items"
          value={totalItems.toLocaleString()}
          icon={<Archive className="text-blue-500" />}
        />
        <StatCard
          title="Total Valuation"
          value={`${totalValuation.toFixed(2)} DZD`}
          icon={<Coins className="text-green-500" />}
        />
        <StatCard
          title="Potential Profit"
          value={`${potentialProfit.toFixed(2)} DZD`}
          icon={<TrendingUp className="text-purple-500" />}
        />
        <StatCard
          title="Realized Profit"
          value={`${salesStats.totalProfit.toFixed(2)} DZD`}
          icon={<TrendingUp className="text-emerald-600" />}
        />
      </div>

      {/* Stock Alerts */}
      {criticalProducts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle
            className="text-red-500 mt-0.5 flex-shrink-0"
            size={20}
          />
          <div>
            <p className="font-bold text-red-800 text-sm">
              🚨 Critical Stock Alert — Restock Immediately!
            </p>
            <ul className="mt-1 space-y-0.5">
              {criticalProducts.map((p) => (
                <li key={p.id} className="text-sm text-red-700">
                  <span className="font-semibold">{p.name}</span> — only{" "}
                  <span className="font-bold">{p.quantity}</span> left
                  {p.quantity === 0 ? " (OUT OF STOCK!)" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {lowProducts.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-start gap-3 shadow-sm">
          <AlertTriangle
            className="text-orange-500 mt-0.5 flex-shrink-0"
            size={20}
          />
          <div>
            <p className="font-bold text-orange-800 text-sm">
              ⚠️ Low Stock Warning — Consider Restocking Soon
            </p>
            <ul className="mt-1 space-y-0.5">
              {lowProducts.map((p) => (
                <li key={p.id} className="text-sm text-orange-700">
                  <span className="font-semibold">{p.name}</span> —{" "}
                  <span className="font-bold">{p.quantity}</span> remaining
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Search size={18} className="text-gray-400" /> Inventory List
          </h3>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (window.api && window.api.exportStockExcel) {
                  const res = await window.api.exportStockExcel();
                  showNotification(
                    res.message,
                    res.success ? "success" : "error",
                  );
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium rounded-lg transition-colors text-sm border border-blue-200"
            >
              <Archive size={16} /> Export Stock (Excel)
            </button>
            <button
              onClick={handleExportSales}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium rounded-lg transition-colors text-sm border border-emerald-200"
            >
              <UploadCloud size={16} /> Export Sales (Excel)
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="px-4 py-4 font-semibold w-16">Image</th>
                <th className="px-6 py-4 font-semibold">Barcode</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Buy Price</th>
                <th className="px-6 py-4 font-semibold">Sell Price</th>
                <th className="px-6 py-4 font-semibold text-right">Quantity</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                        <Package size={18} className="text-gray-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-600">
                    {p.barcode}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {Number(p.buy_price || 0).toFixed(2)} DZD
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {Number(p.sell_price || 0).toFixed(2)} DZD
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full ${getStockColor(p.quantity)}`}
                    >
                      {p.quantity === 0 ? "OUT" : p.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => setEditingProduct(p)}
                      className="text-gray-400 hover:text-blue-500 transition-colors p-2 rounded-md hover:bg-blue-50 mr-1"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-md hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-12 text-center text-gray-400"
                  >
                    No products found. Start by adding stock or importing Excel
                    data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Sales Widget */}
      <div className="glass-panel overflow-hidden mt-6">
        <div className="p-5 border-b border-gray-100 bg-white">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Coins size={18} className="text-emerald-500" /> Recent Sales
            History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Barcode</th>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Sale Price</th>
                <th className="px-6 py-4 font-semibold">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {recentSales.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {new Date(s.sale_date).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm font-mono text-gray-600">
                    {s.barcode}
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="px-6 py-3 text-green-600 font-medium">
                    {Number(s.sell_price || 0).toFixed(2)} DZD
                  </td>
                  <td className="px-6 py-3 text-emerald-600 font-bold">
                    +{Number(s.profit || 0).toFixed(2)} DZD
                  </td>
                </tr>
              ))}
              {recentSales.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-gray-400"
                  >
                    No recent sales found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          fetchProducts={fetchProducts}
          showNotification={showNotification}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="glass-panel p-6 flex items-center gap-4 bg-white/60">
      <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function AddStockView({ showNotification, initialBarcode, clearPending }) {
  const [formData, setFormData] = useState({
    barcode: initialBarcode || "",
    name: "",
    buy_price: "",
    sell_price: "",
    quantity: 1,
    image: null,
  });
  const [imagePreview, setImagePreview] = useState(null);
  const barcodeInputRef = useRef(null);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (initialBarcode) {
      setFormData((prev) => ({ ...prev, barcode: initialBarcode }));
      showNotification("New product detected! Please add details.", "success");
      nameInputRef.current?.focus();
    } else {
      barcodeInputRef.current?.focus();
    }
  }, [initialBarcode]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormData((prev) => ({ ...prev, image: ev.target.result }));
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.barcode)
      return showNotification("Barcode is required", "error");

    const payload = {
      ...formData,
      buy_price: parseFloat(formData.buy_price || 0),
      sell_price: parseFloat(formData.sell_price || 0),
      quantity: parseInt(formData.quantity || 1),
    };

    if (window.api) {
      const res = await window.api.addProduct(payload);
      if (res.success) {
        showNotification(res.message, "success");
        setFormData({
          barcode: "",
          name: "",
          buy_price: "",
          sell_price: "",
          quantity: 1,
          image: null,
        });
        setImagePreview(null);
        if (clearPending) clearPending();
        barcodeInputRef.current?.focus();
      } else {
        showNotification(res.message, "error");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto glass-panel p-8 bg-white">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Add New Stock</h2>
        <p className="text-gray-500 text-sm mt-1">
          Scan a barcode to quickly add or increment existing inventory.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Product Image */}
        <div className="flex items-center gap-5">
          <label
            htmlFor="product-image"
            className="cursor-pointer flex-shrink-0"
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-300 shadow-md hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:bg-gray-50 hover:border-brand-400 transition-colors">
                <Package size={24} className="text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Photo</span>
              </div>
            )}
          </label>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Product Photo (optional)
            </label>
            <input
              id="product-image"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
              onChange={handleImageChange}
            />
            <p className="text-xs text-gray-400 mt-1">
              Click the square or browse to choose a photo.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Barcode (Scan Here) *
          </label>
          <input
            ref={barcodeInputRef}
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow font-mono text-lg bg-gray-50"
            value={formData.barcode}
            onChange={(e) =>
              setFormData({
                ...formData,
                barcode: mapAzertyToNumber(e.target.value),
              })
            }
            placeholder="e.g. 84102948293"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Product Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Wireless Mouse"
          />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Buy Price (DZD)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
              value={formData.buy_price}
              onChange={(e) =>
                setFormData({ ...formData, buy_price: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Sell Price (DZD)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
              value={formData.sell_price}
              onChange={(e) =>
                setFormData({ ...formData, sell_price: e.target.value })
              }
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Quantity to Add
          </label>
          <input
            type="number"
            min="1"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-shadow"
            value={formData.quantity}
            onChange={(e) =>
              setFormData({ ...formData, quantity: e.target.value })
            }
          />
        </div>

        <button
          type="submit"
          className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
        >
          Save Product / Update Stock
        </button>
      </form>
    </div>
  );
}

function ImportExcelView({ showNotification, fetchProducts }) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to JSON
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        // Map rows to our schema. Expecting columns roughly named barcode, name, buy_price, sell_price, quantity
        const payload = rawRows
          .map((r) => ({
            barcode: String(r.barcode || r.Barcode || r.BARCODE || "").trim(),
            name: String(r.name || r.Name || r.NAME || "Unnamed Item"),
            buy_price: parseFloat(
              r.buy_price || r.BuyPrice || r["Buy Price"] || 0,
            ),
            sell_price: parseFloat(
              r.sell_price || r.SellPrice || r["Sell Price"] || 0,
            ),
            quantity: parseInt(r.quantity || r.Quantity || r.QTY || 0),
          }))
          .filter((r) => r.barcode); // only include rows with barcodes

        if (payload.length === 0) {
          showNotification(
            "No valid items found. Ensure 'barcode' column exists.",
            "error",
          );
          setLoading(false);
          return;
        }

        if (window.api) {
          const res = await window.api.bulkInsert(payload);
          if (res.success) {
            showNotification(res.message, "success");
            fetchProducts();
          } else {
            showNotification("Import failed: " + res.message, "error");
          }
        }
      } catch (err) {
        showNotification("Failed to parse file: " + err.message, "error");
      }
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="max-w-3xl mx-auto glass-panel p-10 bg-white text-center">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">
          Bulk Import via Excel
        </h2>
        <p className="text-gray-500 mt-2">
          Upload an .xlsx or .csv file to bulk inject items into your inventory.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Expected columns: barcode, name, buy_price, sell_price, quantity
        </p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-colors duration-200 ease-in-out
          ${dragActive ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100"} 
          ${loading ? "opacity-50 pointer-events-none" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".xlsx, .xls, .csv"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud
            size={48}
            className={`mb-4 ${dragActive ? "text-brand-500" : "text-gray-400"}`}
          />
          <p className="text-lg font-medium text-gray-700">
            {dragActive ? "Drop the file here" : "Drag and drop your file here"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or click to browse from your computer
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-6 flex items-center justify-center gap-2 text-brand-600 font-medium">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
          Processing Import...
        </div>
      )}
    </div>
  );
}

function EditProductModal({
  product,
  onClose,
  fetchProducts,
  showNotification,
}) {
  const [formData, setFormData] = useState({ ...product });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.barcode)
      return showNotification("Barcode is required", "error");

    const payload = {
      ...formData,
      buy_price: parseFloat(formData.buy_price || 0),
      sell_price: parseFloat(formData.sell_price || 0),
      quantity: parseInt(formData.quantity || 0),
    };

    if (window.api && window.api.editProduct) {
      const res = await window.api.editProduct(payload);
      if (res.success) {
        showNotification(res.message, "success");
        fetchProducts();
        onClose();
      } else {
        showNotification(res.message, "error");
      }
    } else {
      showNotification("API error: Cannot edit product", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">Edit Product</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="edit-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Product Image */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product Photo
              </label>
              <div className="flex items-center gap-4">
                <label
                  htmlFor="edit-product-image"
                  className="cursor-pointer flex-shrink-0"
                >
                  {formData.image ? (
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-brand-300 shadow hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:bg-gray-50 hover:border-brand-400 transition-colors">
                      <Package size={20} className="text-gray-400" />
                      <span className="text-xs text-gray-400 mt-0.5">
                        Photo
                      </span>
                    </div>
                  )}
                </label>
                <div className="flex-1">
                  <input
                    id="edit-product-image"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        setFormData((prev) => ({
                          ...prev,
                          image: ev.target.result,
                        }));
                      reader.readAsDataURL(file);
                    }}
                  />
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, image: null }))
                      }
                      className="text-xs text-red-500 hover:text-red-700 mt-1"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Barcode *
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none font-mono text-gray-600"
                value={formData.barcode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    barcode: mapAzertyToNumber(e.target.value),
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Product Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Buy Price (DZD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={formData.buy_price}
                  onChange={(e) =>
                    setFormData({ ...formData, buy_price: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Sell Price (DZD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  value={formData.sell_price}
                  onChange={(e) =>
                    setFormData({ ...formData, sell_price: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Quantity in Stock
              </label>
              <input
                type="number"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
              />
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-form"
            className="px-5 py-2.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsView({ showNotification, fetchProducts }) {
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (confirmText !== "RESET") {
      showNotification("You must type exactly 'RESET' to confirm.", "error");
      return;
    }

    if (
      window.confirm(
        "FINAL WARNING: This will permanently delete ALL products and ALL sales history. Are you absolutely sure?",
      )
    ) {
      setIsResetting(true);
      if (window.api && window.api.resetDatabase) {
        const res = await window.api.resetDatabase();
        if (res.success) {
          showNotification(
            "Database has been completely reset. Starting fresh.",
            "success",
          );
          fetchProducts();
          setConfirmText("");
        } else {
          showNotification(res.message, "error");
        }
      }
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in-up">
      <div className="glass-panel p-8 bg-white">
        <div className="mb-6 border-b border-red-100 pb-4">
          <h2 className="text-2xl font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle size={24} /> Reset
          </h2>
          <p className="text-gray-500 mt-2">
            This will permanently delete your entire inventory and all sales
            records. This action cannot be undone. You should backup your stock
            to Excel first if you want to keep a record.
          </p>
        </div>

        <div className="bg-red-50 p-6 rounded-xl border border-red-200">
          <label className="block text-sm font-semibold text-red-800 mb-2">
            Type "RESET" to confirm deletion:
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 rounded-xl border border-red-300 focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition-shadow font-mono text-lg bg-white text-red-900 placeholder-red-300 mb-4 text-center"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
          />
          <button
            onClick={handleReset}
            disabled={isResetting || confirmText !== "RESET"}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2"
          >
            <Trash2 size={20} />{" "}
            {isResetting ? "WIPING DATA..." : "PERMANENTLY WIPE DATABASE"}
          </button>
        </div>
      </div>
    </div>
  );
}
