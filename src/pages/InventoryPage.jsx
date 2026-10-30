import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sliders,
  Download,
  Plus,
  AlertTriangle,
  Package,
  Edit,
  Trash2,
} from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatMoney, formatNum } from '../lib/format';
import { csvStringify, csvDownload } from '../lib/csv';

const CATEGORIES = ['All', 'Low Stock', 'Electronics', 'Apparel', 'Food & Bev', 'Home', 'Sports', 'General'];

export default function InventoryPage() {
  const session = useAuth((s) => s.session);
  const isAdmin = session?.role === 'admin';

  const {
    inventory,
    suppliers,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    setInventory,
    stockStatus,
    recordActivity,
  } = useDb();

  const { currency, nairaPerUSD, globalLowStockThreshold, setThreshold } = useSettings();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  const [activeTab, setActiveTab] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState(1);

  useEffect(() => {
    document.title = 'Inventory — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  // Helper for computing cost in NGN regardless of input format
  const getCostNGN = useCallback(
    (item) => {
      if (item.costUSD != null && item.costUSD !== '') {
        return Number(item.costUSD) * nairaPerUSD;
      }
      return Number(item.costPrice || item.costNGN || item.cost || 0);
    },
    [nairaPerUSD]
  );

  const getSellingNGN = useCallback((item) => {
    return Number(item.sellingPrice || item.selling || 0);
  }, []);

  // Summary statistics
  const stats = useMemo(() => {
    let totalItems = inventory.length;
    let lowOrOutCount = 0;
    let stockCostTotal = 0;
    let retailValueTotal = 0;

    inventory.forEach((item) => {
      const st = stockStatus(item, globalLowStockThreshold);
      if (st.t === 'low' || st.t === 'out') lowOrOutCount++;
      const stock = Number(item.stock) || 0;
      stockCostTotal += stock * getCostNGN(item);
      retailValueTotal += stock * getSellingNGN(item);
    });

    return { totalItems, lowOrOutCount, stockCostTotal, retailValueTotal };
  }, [inventory, globalLowStockThreshold, stockStatus, getCostNGN, getSellingNGN]);

  // Supplier lookup map
  const supplierMap = useMemo(() => {
    const map = {};
    suppliers.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [suppliers]);

  // Filtered & sorted list
  const filteredList = useMemo(() => {
    return inventory.filter((item) => {
      // Category tab filter
      if (activeTab === 'Low Stock') {
        const st = stockStatus(item, globalLowStockThreshold);
        if (st.t !== 'low' && st.t !== 'out') return false;
      } else if (activeTab !== 'All' && item.category !== activeTab) {
        return false;
      }

      // Search query
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const name = (item.name || '').toLowerCase();
        const sku = (item.sku || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const sup = (supplierMap[item.supplierId] || '').toLowerCase();
        if (!name.includes(q) && !sku.includes(q) && !cat.includes(q) && !sup.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [inventory, activeTab, searchQ, globalLowStockThreshold, stockStatus, supplierMap]);

  const sortedList = useMemo(() => {
    return [...filteredList].sort((a, b) => {
      let va = a[sortCol];
      let vb = b[sortCol];

      if (sortCol === 'cost') {
        va = getCostNGN(a);
        vb = getCostNGN(b);
      } else if (sortCol === 'selling') {
        va = getSellingNGN(a);
        vb = getSellingNGN(b);
      } else if (sortCol === 'margin') {
        const ca = getCostNGN(a);
        const sa = getSellingNGN(a);
        const cb = getCostNGN(b);
        const sb = getSellingNGN(b);
        va = sa > 0 ? (sa - ca) / sa : 0;
        vb = sb > 0 ? (sb - cb) / sb : 0;
      } else if (sortCol === 'status') {
        va = stockStatus(a, globalLowStockThreshold).t;
        vb = stockStatus(b, globalLowStockThreshold).t;
      } else if (sortCol === 'supplier') {
        va = supplierMap[a.supplierId] || '';
        vb = supplierMap[b.supplierId] || '';
      }

      if (typeof va === 'string') {
        return sortDir * va.localeCompare(vb || '');
      }
      return sortDir * ((va || 0) - (vb || 0));
    });
  }, [filteredList, sortCol, sortDir, getCostNGN, getSellingNGN, stockStatus, globalLowStockThreshold, supplierMap]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((d) => -d);
    } else {
      setSortCol(col);
      setSortDir(1);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (inventory.length === 0) {
      addToast({ msg: 'No inventory data to export', type: 'error' });
      return;
    }
    const rows = inventory.map((item) => ({
      ID: item.id,
      SKU: item.sku || '',
      Product: item.name,
      Category: item.category || 'General',
      Stock: item.stock || 0,
      'Reorder Point': item.globalThreshold ? `Global (${globalLowStockThreshold})` : (item.lowStockThreshold ?? item.reorderPoint ?? 10),
      'Cost NGN': getCostNGN(item),
      'Cost USD': item.costUSD || (getCostNGN(item) / nairaPerUSD).toFixed(2),
      'Selling Price': getSellingNGN(item),
      'Margin %': getSellingNGN(item) > 0 ? Math.round(((getSellingNGN(item) - getCostNGN(item)) / getSellingNGN(item)) * 100) : 0,
      Supplier: supplierMap[item.supplierId] || 'None',
      Notes: item.notes || '',
    }));
    const csv = csvStringify(rows);
    csvDownload(csv, `inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast({ msg: 'Inventory exported successfully', type: 'success' });
    recordActivity?.('inventory_export', 'Exported inventory CSV', session?.username, 'Inventory');
  };

  // Open Add Product Modal
  const openAddModal = () => {
    let formState = {
      name: '',
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      category: 'Electronics',
      stock: 10,
      costCurrency: 'NGN',
      costPrice: '',
      sellingPrice: '',
      reorderPoint: 5,
      globalThreshold: false,
      supplierId: suppliers[0]?.id || '',
      notes: '',
      imageUrl: '',
    };

    openModal({
      title: 'Add New Product',
      saveLabel: 'Add Product',
      size: 'lg',
      content: (
        <form id="add-prod-form" className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Wireless Mouse"
                defaultValue={formState.name}
                onChange={(e) => { formState.name = e.target.value; }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.sku}
                onChange={(e) => { formState.sku = e.target.value; }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                defaultValue={formState.category}
                onChange={(e) => { formState.category = e.target.value; }}
              >
                {CATEGORIES.filter((c) => c !== 'All' && c !== 'Low Stock').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Initial Stock Qty</label>
              <input
                className="form-input"
                type="number"
                min="0"
                defaultValue={formState.stock}
                onChange={(e) => { formState.stock = parseInt(e.target.value, 10) || 0; }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Cost Price (NGN)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="₦ Cost"
                defaultValue={formState.costPrice}
                onChange={(e) => { formState.costPrice = parseFloat(e.target.value) || 0; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (NGN) *</label>
              <input
                className="form-input"
                type="number"
                min="0"
                placeholder="₦ Retail"
                defaultValue={formState.sellingPrice}
                onChange={(e) => { formState.sellingPrice = parseFloat(e.target.value) || 0; }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Reorder / Low Stock Alert Level</label>
              <input
                className="form-input"
                type="number"
                min="1"
                defaultValue={formState.reorderPoint}
                onChange={(e) => { formState.reorderPoint = parseInt(e.target.value, 10) || 1; }}
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-[var(--text-2)] cursor-pointer">
                <input
                  type="checkbox"
                  onChange={(e) => { formState.globalThreshold = e.target.checked; }}
                />
                Use global threshold ({globalLowStockThreshold})
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select
                className="form-select"
                defaultValue={formState.supplierId}
                onChange={(e) => { formState.supplierId = e.target.value ? Number(e.target.value) : null; }}
              >
                <option value="">-- None / Unknown --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="Specs, variant details, location..."
              defaultValue={formState.notes}
              onChange={(e) => { formState.notes = e.target.value; }}
            />
          </div>
        </form>
      ),
      onSave: async () => {
        if (!formState.name.trim()) throw new Error('Product name is required.');
        if (!formState.sellingPrice || formState.sellingPrice <= 0) {
          throw new Error('Valid selling price is required.');
        }

        const newItem = {
          name: formState.name.trim(),
          sku: formState.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
          category: formState.category,
          stock: Number(formState.stock) || 0,
          costPrice: Number(formState.costPrice) || 0,
          sellingPrice: Number(formState.sellingPrice) || 0,
          lowStockThreshold: formState.globalThreshold ? null : Number(formState.reorderPoint),
          globalThreshold: Boolean(formState.globalThreshold),
          supplierId: formState.supplierId || null,
          notes: formState.notes.trim(),
          imageUrl: formState.imageUrl,
        };

        addInventoryItem(newItem);
        recordActivity?.('inventory_add', `Added product ${newItem.name} (${newItem.sku})`, session?.username, 'Inventory');
        addToast({ msg: `Product "${newItem.name}" added!`, type: 'success' });
      },
    });
  };

  // Open Edit Product Modal
  const openEditModal = (item) => {
    let formState = {
      name: item.name,
      sku: item.sku || '',
      category: item.category || 'General',
      stock: item.stock || 0,
      costPrice: getCostNGN(item),
      sellingPrice: getSellingNGN(item),
      reorderPoint: item.lowStockThreshold ?? item.reorderPoint ?? 10,
      globalThreshold: Boolean(item.globalThreshold),
      supplierId: item.supplierId || '',
      notes: item.notes || '',
    };

    openModal({
      title: `Edit ${item.name}`,
      saveLabel: 'Save Changes',
      size: 'lg',
      content: (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.name}
                onChange={(e) => { formState.name = e.target.value; }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.sku}
                onChange={(e) => { formState.sku = e.target.value; }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select"
                defaultValue={formState.category}
                onChange={(e) => { formState.category = e.target.value; }}
              >
                {CATEGORIES.filter((c) => c !== 'All' && c !== 'Low Stock').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Stock Quantity</label>
              <input
                className="form-input"
                type="number"
                min="0"
                defaultValue={formState.stock}
                onChange={(e) => { formState.stock = parseInt(e.target.value, 10) || 0; }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Cost Price (NGN)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                defaultValue={formState.costPrice}
                onChange={(e) => { formState.costPrice = parseFloat(e.target.value) || 0; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price (NGN) *</label>
              <input
                className="form-input"
                type="number"
                min="0"
                defaultValue={formState.sellingPrice}
                onChange={(e) => { formState.sellingPrice = parseFloat(e.target.value) || 0; }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Reorder / Alert Threshold</label>
              <input
                className="form-input"
                type="number"
                min="1"
                defaultValue={formState.reorderPoint}
                onChange={(e) => { formState.reorderPoint = parseInt(e.target.value, 10) || 1; }}
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-[var(--text-2)] cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={formState.globalThreshold}
                  onChange={(e) => { formState.globalThreshold = e.target.checked; }}
                />
                Use global threshold ({globalLowStockThreshold})
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select
                className="form-select"
                defaultValue={formState.supplierId}
                onChange={(e) => { formState.supplierId = e.target.value ? Number(e.target.value) : null; }}
              >
                <option value="">-- None / Unknown --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-input"
              rows="2"
              defaultValue={formState.notes}
              onChange={(e) => { formState.notes = e.target.value; }}
            />
          </div>
        </form>
      ),
      onSave: async () => {
        if (!formState.name.trim()) throw new Error('Product name is required.');
        if (!formState.sellingPrice || formState.sellingPrice <= 0) {
          throw new Error('Valid selling price is required.');
        }

        updateInventoryItem(item.id, {
          name: formState.name.trim(),
          sku: formState.sku.trim(),
          category: formState.category,
          stock: Number(formState.stock) || 0,
          costPrice: Number(formState.costPrice) || 0,
          sellingPrice: Number(formState.sellingPrice) || 0,
          lowStockThreshold: formState.globalThreshold ? null : Number(formState.reorderPoint),
          globalThreshold: Boolean(formState.globalThreshold),
          supplierId: formState.supplierId || null,
          notes: formState.notes.trim(),
        });

        recordActivity?.('inventory_edit', `Updated product ${item.name}`, session?.username, 'Inventory');
        addToast({ msg: `Product "${formState.name}" updated!`, type: 'success' });
      },
    });
  };

  // Delete product with undo toast
  const handleDelete = (item) => {
    if (!isAdmin) {
      addToast({ msg: 'Admin permission required to delete items', type: 'error' });
      return;
    }

    const previousList = [...inventory];
    deleteInventoryItem(item.id);
    recordActivity?.('inventory_delete', `Deleted product ${item.name}`, session?.username, 'Inventory');

    addToast({
      msg: `Deleted "${item.name}"`,
      type: 'warning',
      actions: [
        {
          label: 'Undo',
          onClick: () => {
            setInventory(previousList);
            addToast({ msg: `Restored "${item.name}"`, type: 'success' });
          },
        },
      ],
    });
  };

  // Quick Threshold Modal
  const openThresholdModal = () => {
    let val = globalLowStockThreshold;
    openModal({
      title: 'Global Low Stock Threshold',
      saveLabel: 'Save Threshold',
      size: 'sm',
      content: (
        <div>
          <p className="text-xs text-[var(--text-2)] mb-3">
            Products marked to follow the global threshold will trigger warning banners when stock falls to or below this level.
          </p>
          <div className="form-group">
            <label className="form-label">Alert Quantity</label>
            <input
              className="form-input"
              type="number"
              min="1"
              defaultValue={val}
              onChange={(e) => { val = parseInt(e.target.value, 10); }}
            />
          </div>
        </div>
      ),
      onSave: async () => {
        if (!val || val < 1) throw new Error('Threshold must be at least 1.');
        setThreshold(val);
        addToast({ msg: `Global threshold updated to ${val} units`, type: 'success' });
      },
    });
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Inventory</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// catalog, stock levels &amp; pricing</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={openThresholdModal} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <Sliders size={13} />
            <span>Threshold: {globalLowStockThreshold}</span>
          </button>
          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm flex items-center gap-1.5">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
          <button onClick={openAddModal} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-card__lbl">Total Products</div>
          <div className="stat-card__val font-mono">{formatNum(stats.totalItems)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">across all categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Low / Out of Stock</div>
          <div className={`stat-card__val font-mono ${stats.lowOrOutCount > 0 ? 'text-[var(--warn)]' : 'text-[var(--green)]'}`}>
            {formatNum(stats.lowOrOutCount)}
          </div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">requires reordering</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Stock Value (Cost)</div>
          <div className="stat-card__val font-mono">{fmt(stats.stockCostTotal)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">capital locked in stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Retail Value</div>
          <div className="stat-card__val font-mono">{fmt(stats.retailValueTotal)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">potential gross sales</div>
        </div>
      </div>

      {/* Main Content Panel */}
      <div className="panel space-y-4">
        {/* Category Tabs & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {CATEGORIES.map((cat) => {
              const count = cat === 'All'
                ? inventory.length
                : cat === 'Low Stock'
                ? stats.lowOrOutCount
                : inventory.filter((i) => i.category === cat).length;
              const active = activeTab === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1 ${
                    active
                      ? 'bg-[var(--green)] text-white font-semibold'
                      : 'bg-[var(--bg2)] text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--bg3)]'
                  }`}
                >
                  {cat === 'Low Stock' && <AlertTriangle size={11} className="text-amber-300" />}
                  <span>{cat} ({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search product, SKU, supplier..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="form-input text-xs py-1.5 px-3 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Inventory Data Table */}
        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-mono">
                <th className="py-2.5 px-3 w-10">#</th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('sku')}>
                  SKU {sortCol === 'sku' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('name')}>
                  Product {sortCol === 'name' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('category')}>
                  Category {sortCol === 'category' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('stock')}>
                  Stock {sortCol === 'stock' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 text-right">Reorder</th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('cost')}>
                  Cost {sortCol === 'cost' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('selling')}>
                  Selling {sortCol === 'selling' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer text-right" onClick={() => handleSort('margin')}>
                  Margin {sortCol === 'margin' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('status')}>
                  Status {sortCol === 'status' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 cursor-pointer" onClick={() => handleSort('supplier')}>
                  Supplier {sortCol === 'supplier' ? (sortDir > 0 ? '▲' : '▼') : ''}
                </th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {sortedList.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-8 text-center text-[var(--text-3)] font-sans">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                sortedList.map((item, idx) => {
                  const cost = getCostNGN(item);
                  const sell = getSellingNGN(item);
                  const marginPct = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;
                  const status = stockStatus(item, globalLowStockThreshold);
                  const isLow = status.t === 'low' || status.t === 'out';
                  const reorderDisplay = item.globalThreshold
                    ? `Global (${globalLowStockThreshold})`
                    : item.lowStockThreshold ?? item.reorderPoint ?? 10;

                  return (
                    <tr key={item.id} className="hover:bg-[var(--card-h)] transition-colors">
                      <td className="py-2.5 px-3 text-[var(--text-3)]">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-[var(--text-2)]">{item.sku || '—'}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-[var(--text)]">
                        <div className="flex items-center gap-2">
                          <Package size={14} className="opacity-50 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-2)]">{item.category || 'General'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`font-bold ${isLow ? 'text-[var(--warn)]' : 'text-[var(--text)]'}`}>
                          {formatNum(item.stock || 0)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-3)]">{reorderDisplay}</td>
                      <td className="py-2.5 px-3 text-right text-[var(--text-2)]">{fmt(cost)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-[var(--text)]">{fmt(sell)}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          marginPct >= 30 ? 'bg-[rgba(78,148,99,0.15)] text-[var(--green)]' :
                          marginPct >= 15 ? 'bg-[rgba(184,98,42,0.15)] text-[var(--orange)]' :
                          'bg-[rgba(160,72,72,0.15)] text-[var(--down)]'
                        }`}>
                          {marginPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`badge ${
                          status.t === 'ok' ? 'badge-success' :
                          status.t === 'low' ? 'badge-warning' :
                          'badge-error'
                        }`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-2)]">
                        {supplierMap[item.supplierId] || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1 hover:text-[var(--green)] transition-colors opacity-70 hover:opacity-100"
                            title="Edit Product"
                          >
                            <Edit size={13} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="p-1 hover:text-[var(--down)] transition-colors opacity-70 hover:opacity-100"
                              title="Delete Product"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="text-right text-xs text-[var(--text-3)] font-mono">
          Showing {sortedList.length} of {inventory.length} total items
        </div>
      </div>
    </main>
  );
}

