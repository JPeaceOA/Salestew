/**
 * useDb.js — Zustand store for all app data (entries, inventory, suppliers, goals, alerts, actLog).
 * Persisted to localStorage using zustand persist middleware.
 *
 * localStorage keys (backward-compat with v3):
 *   ss_entries, ss_inventory, ss_suppliers, ss_goals,
 *   ss_alerts_dismissed, ss_actlog
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------- Helpers ----------

/** Generate a new unique numeric ID for an array of objects with .id fields. */
function nextId(arr) {
  if (!arr || arr.length === 0) return 1;
  return Math.max(...arr.map((x) => Number(x.id) || 0)) + 1;
}

/** Cap an array to the last N items. */
function capArray(arr, max) {
  return arr.length > max ? arr.slice(arr.length - max) : arr;
}

// ---------- Stock status ----------

/**
 * Compute the stock status for an inventory item.
 * @param {{ stock: number, lowStockThreshold?: number }} item
 * @param {number} globalThreshold
 * @returns {{ label: string, cls: string, color: string, t: 'out'|'low'|'ok' }}
 */
function stockStatus(item, globalThreshold) {
  const threshold =
    item.lowStockThreshold !== undefined && item.lowStockThreshold !== null
      ? Number(item.lowStockThreshold)
      : Number(globalThreshold);
  const stock = Number(item.stock) || 0;

  if (stock <= 0) {
    return { label: 'Out of Stock', cls: 'badge-error', color: '#ef4444', t: 'out' };
  }
  if (stock <= threshold) {
    return { label: 'Low Stock', cls: 'badge-warning', color: '#f59e0b', t: 'low' };
  }
  return { label: 'In Stock', cls: 'badge-success', color: '#22c55e', t: 'ok' };
}

// ---------- Period filter ----------

/**
 * Filter entries by a named period or custom date range.
 * @param {Object[]} entries
 * @param {'today'|'week'|'month'|'quarter'|'year'|'custom'|'all'} period
 * @param {string} [from] - ISO date string (for 'custom')
 * @param {string} [to] - ISO date string (for 'custom')
 * @returns {Object[]}
 */
function filterByPeriod(entries, period, from, to) {
  if (!entries || entries.length === 0) return [];
  if (!period || period === 'all') return entries;

  const now = new Date();

  function startOf(unit) {
    const d = new Date(now);
    if (unit === 'day') {
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'week') {
      const day = d.getDay(); // 0 = Sunday
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'quarter') {
      const q = Math.floor(d.getMonth() / 3);
      d.setMonth(q * 3, 1);
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'year') {
      d.setMonth(0, 1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  }

  let start, end;

  if (period === 'custom') {
    start = from ? new Date(from) : new Date(0);
    end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);
  } else {
    const unitMap = {
      today: 'day',
      week: 'week',
      month: 'month',
      quarter: 'quarter',
      year: 'year',
    };
    start = startOf(unitMap[period] || 'month');
    end = new Date();
  }

  return entries.filter((e) => {
    const d = new Date(e.date || e.createdAt);
    return d >= start && d <= end;
  });
}

// ---------- Seed data ----------

function buildSeedData() {
  const now = new Date();
  function daysAgo(n) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  const supplier = {
    id: 1,
    name: 'Lagos Wholesale Depot',
    contact: 'Chukwuemeka Obi',
    phone: '+234 801 234 5678',
    email: 'info@lagoswholesale.ng',
    address: '14 Apapa Road, Lagos Island, Lagos',
    notes: 'Reliable supplier for electronics and consumer goods.',
    createdAt: daysAgo(60),
  };

  const inventory = [
    { id: 1,  name: 'Samsung Galaxy A55',        category: 'Electronics',  sku: 'EL-001', stock: 12, costPrice: 380000, sellingPrice: 450000, supplierId: 1, lowStockThreshold: 5,  imageUrl: '', notes: '128GB, 5G',              createdAt: daysAgo(50) },
    { id: 2,  name: 'Ankara Print Dress',         category: 'Fashion',      sku: 'FA-001', stock: 35, costPrice: 8500,   sellingPrice: 15000,  supplierId: 1, lowStockThreshold: 10, imageUrl: '', notes: 'Assorted sizes',          createdAt: daysAgo(45) },
    { id: 3,  name: 'Indomie Carton 40pk',        category: 'Food & Bev',   sku: 'FB-001', stock: 3,  costPrice: 4200,   sellingPrice: 5800,   supplierId: 1, lowStockThreshold: 10, imageUrl: '', notes: 'Chicken flavour',          createdAt: daysAgo(40) },
    { id: 4,  name: 'Tecno Camon 30',             category: 'Electronics',  sku: 'EL-002', stock: 8,  costPrice: 195000, sellingPrice: 240000, supplierId: 1, lowStockThreshold: 3,  imageUrl: '', notes: '256GB storage',           createdAt: daysAgo(38) },
    { id: 5,  name: 'Groundnut Oil 5L',           category: 'Food & Bev',   sku: 'FB-002', stock: 0,  costPrice: 7200,   sellingPrice: 9500,   supplierId: 1, lowStockThreshold: 5,  imageUrl: '', notes: 'Kings brand',             createdAt: daysAgo(35) },
    { id: 6,  name: 'Men\'s Agbada Set',          category: 'Fashion',      sku: 'FA-002', stock: 20, costPrice: 18000,  sellingPrice: 35000,  supplierId: 1, lowStockThreshold: 5,  imageUrl: '', notes: 'Traditional wear',        createdAt: daysAgo(30) },
    { id: 7,  name: 'HP Pavilion Laptop',         category: 'Electronics',  sku: 'EL-003', stock: 5,  costPrice: 520000, sellingPrice: 650000, supplierId: 1, lowStockThreshold: 3,  imageUrl: '', notes: 'Core i5, 8GB RAM',        createdAt: daysAgo(28) },
    { id: 8,  name: 'Peak Milk 48 Cans',          category: 'Food & Bev',   sku: 'FB-003', stock: 40, costPrice: 18500,  sellingPrice: 23000,  supplierId: 1, lowStockThreshold: 10, imageUrl: '', notes: 'Full cream',              createdAt: daysAgo(25) },
    { id: 9,  name: 'Ankara Tote Bag',            category: 'Fashion',      sku: 'FA-003', stock: 2,  costPrice: 4000,   sellingPrice: 7500,   supplierId: 1, lowStockThreshold: 5,  imageUrl: '', notes: 'Handmade',               createdAt: daysAgo(22) },
    { id: 10, name: 'Infinix Hot 40i',            category: 'Electronics',  sku: 'EL-004', stock: 15, costPrice: 130000, sellingPrice: 165000, supplierId: 1, lowStockThreshold: 5,  imageUrl: '', notes: '128GB',                  createdAt: daysAgo(20) },
    { id: 11, name: 'Golden Penny Pasta 20pk',   category: 'Food & Bev',   sku: 'FB-004', stock: 60, costPrice: 3800,   sellingPrice: 5200,   supplierId: 1, lowStockThreshold: 15, imageUrl: '', notes: 'Spaghetti',              createdAt: daysAgo(18) },
    { id: 12, name: 'Dashiki Shirt',              category: 'Fashion',      sku: 'FA-004', stock: 45, costPrice: 5500,   sellingPrice: 12000,  supplierId: 1, lowStockThreshold: 10, imageUrl: '', notes: 'Unisex L-XL',            createdAt: daysAgo(15) },
    { id: 13, name: 'JBL Flip 6 Speaker',        category: 'Electronics',  sku: 'EL-005', stock: 7,  costPrice: 62000,  sellingPrice: 80000,  supplierId: 1, lowStockThreshold: 3,  imageUrl: '', notes: 'Waterproof Bluetooth',  createdAt: daysAgo(12) },
    { id: 14, name: 'Titus Sardine 30pk',        category: 'Food & Bev',   sku: 'FB-005', stock: 25, costPrice: 9200,   sellingPrice: 12500,  supplierId: 1, lowStockThreshold: 8,  imageUrl: '', notes: 'Tomato sauce',           createdAt: daysAgo(10) },
    { id: 15, name: 'Aba Leather Sandals',       category: 'Fashion',      sku: 'FA-005', stock: 30, costPrice: 6000,   sellingPrice: 11000,  supplierId: 1, lowStockThreshold: 10, imageUrl: '', notes: 'Sizes 38–46',            createdAt: daysAgo(7)  },
    { id: 16, name: 'Hisense 43" Smart TV',      category: 'Electronics',  sku: 'EL-006', stock: 4,  costPrice: 320000, sellingPrice: 410000, supplierId: 1, lowStockThreshold: 2,  imageUrl: '', notes: '4K UHD, Android TV',    createdAt: daysAgo(3)  },
  ];

  const entries = [
    { id: 1,  inventoryId: 1,  productName: 'Samsung Galaxy A55',       category: 'Electronics', qty: 2, unitPrice: 450000, cost: 380000, revenue: 900000,  profit: 140000, date: daysAgo(28), notes: '',               paymentMethod: 'Transfer',  customer: 'Emeka Eze'       },
    { id: 2,  inventoryId: 3,  productName: 'Indomie Carton 40pk',      category: 'Food & Bev',  qty: 5, unitPrice: 5800,   cost: 4200,   revenue: 29000,   profit: 8000,   date: daysAgo(26), notes: '',               paymentMethod: 'Cash',      customer: 'Bisi Adeyemi'    },
    { id: 3,  inventoryId: 2,  productName: 'Ankara Print Dress',        category: 'Fashion',     qty: 3, unitPrice: 15000,  cost: 8500,   revenue: 45000,   profit: 19500,  date: daysAgo(24), notes: 'Wholesale order', paymentMethod: 'Transfer',  customer: 'Ngozi Okonkwo'   },
    { id: 4,  inventoryId: 7,  productName: 'HP Pavilion Laptop',        category: 'Electronics', qty: 1, unitPrice: 650000, cost: 520000, revenue: 650000,  profit: 130000, date: daysAgo(22), notes: '',               paymentMethod: 'Card',      customer: 'Taiwo Adeleke'   },
    { id: 5,  inventoryId: 8,  productName: 'Peak Milk 48 Cans',         category: 'Food & Bev',  qty: 4, unitPrice: 23000,  cost: 18500,  revenue: 92000,   profit: 18000,  date: daysAgo(20), notes: '',               paymentMethod: 'Cash',      customer: 'Amaka Chukwu'    },
    { id: 6,  inventoryId: 4,  productName: 'Tecno Camon 30',            category: 'Electronics', qty: 2, unitPrice: 240000, cost: 195000, revenue: 480000,  profit: 90000,  date: daysAgo(18), notes: '',               paymentMethod: 'Transfer',  customer: 'Kola Balogun'    },
    { id: 7,  inventoryId: 6,  productName: 'Men\'s Agbada Set',         category: 'Fashion',     qty: 1, unitPrice: 35000,  cost: 18000,  revenue: 35000,   profit: 17000,  date: daysAgo(16), notes: '',               paymentMethod: 'Cash',      customer: 'Rotimi Alade'    },
    { id: 8,  inventoryId: 10, productName: 'Infinix Hot 40i',           category: 'Electronics', qty: 3, unitPrice: 165000, cost: 130000, revenue: 495000,  profit: 105000, date: daysAgo(14), notes: '',               paymentMethod: 'Card',      customer: 'Chisom Obi'      },
    { id: 9,  inventoryId: 11, productName: 'Golden Penny Pasta 20pk',  category: 'Food & Bev',  qty: 6, unitPrice: 5200,   cost: 3800,   revenue: 31200,   profit: 8400,   date: daysAgo(12), notes: '',               paymentMethod: 'Cash',      customer: 'Funmi Salami'    },
    { id: 10, inventoryId: 12, productName: 'Dashiki Shirt',             category: 'Fashion',     qty: 5, unitPrice: 12000,  cost: 5500,   revenue: 60000,   profit: 32500,  date: daysAgo(10), notes: '',               paymentMethod: 'Transfer',  customer: 'Sola Martins'    },
    { id: 11, inventoryId: 13, productName: 'JBL Flip 6 Speaker',       category: 'Electronics', qty: 2, unitPrice: 80000,  cost: 62000,  revenue: 160000,  profit: 36000,  date: daysAgo(8),  notes: '',               paymentMethod: 'Card',      customer: 'Yemi Coker'      },
    { id: 12, inventoryId: 14, productName: 'Titus Sardine 30pk',       category: 'Food & Bev',  qty: 3, unitPrice: 12500,  cost: 9200,   revenue: 37500,   profit: 9900,   date: daysAgo(7),  notes: '',               paymentMethod: 'Cash',      customer: 'Ifunanya Nduka'  },
    { id: 13, inventoryId: 15, productName: 'Aba Leather Sandals',      category: 'Fashion',     qty: 4, unitPrice: 11000,  cost: 6000,   revenue: 44000,   profit: 20000,  date: daysAgo(5),  notes: 'Market day sale', paymentMethod: 'Cash',      customer: 'Tunde Fasanya'   },
    { id: 14, inventoryId: 16, productName: 'Hisense 43" Smart TV',     category: 'Electronics', qty: 1, unitPrice: 410000, cost: 320000, revenue: 410000,  profit: 90000,  date: daysAgo(3),  notes: '',               paymentMethod: 'Transfer',  customer: 'Adaeze Igwe'     },
    { id: 15, inventoryId: 9,  productName: 'Ankara Tote Bag',          category: 'Fashion',     qty: 8, unitPrice: 7500,   cost: 4000,   revenue: 60000,   profit: 28000,  date: daysAgo(2),  notes: '',               paymentMethod: 'Cash',      customer: 'Blessing Eze'    },
    { id: 16, inventoryId: 1,  productName: 'Samsung Galaxy A55',       category: 'Electronics', qty: 1, unitPrice: 450000, cost: 380000, revenue: 450000,  profit: 70000,  date: daysAgo(1),  notes: 'Repeat customer', paymentMethod: 'Transfer',  customer: 'Emeka Eze'       },
  ];

  return { entries, inventory, suppliers: [supplier] };
}

// ---------- Store ----------

const useDb = create(
  persist(
    (set, get) => ({
      entries: [],
      inventory: [],
      suppliers: [],
      goals: [],
      alertsDismissed: [],
      actLog: [],

      // ---- Entries ----

      addEntry: (entry) =>
        set((s) => {
          const newEntry = { ...entry, id: nextId(s.entries), createdAt: new Date().toISOString() };
          return { entries: [...s.entries, newEntry] };
        }),

      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
          ),
        })),

      deleteEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      setEntries: (arr) => set({ entries: arr }),

      // ---- Inventory ----

      addInventoryItem: (item) =>
        set((s) => {
          const newItem = { ...item, id: nextId(s.inventory), createdAt: new Date().toISOString() };
          return { inventory: [...s.inventory, newItem] };
        }),

      updateInventoryItem: (id, patch) =>
        set((s) => ({
          inventory: s.inventory.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i
          ),
        })),

      deleteInventoryItem: (id) =>
        set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) })),

      setInventory: (arr) => set({ inventory: arr }),

      // ---- Suppliers ----

      addSupplier: (s) =>
        set((state) => {
          const newSupplier = { ...s, id: nextId(state.suppliers), createdAt: new Date().toISOString() };
          return { suppliers: [...state.suppliers, newSupplier] };
        }),

      updateSupplier: (id, patch) =>
        set((s) => ({
          suppliers: s.suppliers.map((sup) =>
            sup.id === id ? { ...sup, ...patch, updatedAt: new Date().toISOString() } : sup
          ),
        })),

      deleteSupplier: (id) =>
        set((s) => ({ suppliers: s.suppliers.filter((sup) => sup.id !== id) })),

      // ---- Goals ----

      addGoal: (g) =>
        set((s) => {
          const newGoal = { ...g, id: nextId(s.goals), createdAt: new Date().toISOString() };
          return { goals: [...s.goals, newGoal] };
        }),

      deleteGoal: (id) =>
        set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

      // ---- Alerts ----

      dismissAlert: (alertId) =>
        set((s) => ({
          alertsDismissed: s.alertsDismissed.includes(alertId)
            ? s.alertsDismissed
            : [...s.alertsDismissed, alertId],
        })),

      clearDismissed: () => set({ alertsDismissed: [] }),

      // ---- Activity Log ----

      recordActivity: (type, detail, username, page) =>
        set((s) => {
          const entry = {
            id: Date.now(),
            type,
            detail,
            username: username || 'unknown',
            page: page || '',
            time: new Date().toISOString(),
          };
          return { actLog: capArray([...s.actLog, entry], 200) };
        }),

      clearActivityLog: () => set({ actLog: [] }),

      // ---- Seed ----

      seedData: () => {
        const { entries } = get();
        if (entries && entries.length > 0) return; // already has data
        const seed = buildSeedData();
        set({
          entries: seed.entries,
          inventory: seed.inventory,
          suppliers: seed.suppliers,
        });
      },

      // ---- Helpers ----

      nextId: (arr) => nextId(arr),

      stockStatus: (item, globalThreshold) => stockStatus(item, globalThreshold),

      lowStockItems: () => {
        const { inventory } = get();
        // Import threshold from settings store at call time
        let globalThreshold = 20;
        try {
          const raw = localStorage.getItem('ss_settings_react');
          if (raw) {
            const parsed = JSON.parse(raw);
            globalThreshold = parsed?.state?.globalLowStockThreshold ?? 20;
          }
        } catch {
          // ignore
        }
        return inventory.filter((item) => {
          const s = stockStatus(item, globalThreshold);
          return s.t === 'low' || s.t === 'out';
        });
      },

      filterByPeriod: (entries, period, from, to) =>
        filterByPeriod(entries, period, from, to),
    }),
    {
      name: 'ss_db_root', // root key — individual slices stored below
      storage: createJSONStorage(() => {
        // Custom storage that splits state into per-domain keys
        return {
          getItem: (_name) => {
            try {
              const entries = JSON.parse(localStorage.getItem('ss_entries') || 'null');
              const inventory = JSON.parse(localStorage.getItem('ss_inventory') || 'null');
              const suppliers = JSON.parse(localStorage.getItem('ss_suppliers') || 'null');
              const goals = JSON.parse(localStorage.getItem('ss_goals') || 'null');
              const alertsDismissed = JSON.parse(localStorage.getItem('ss_alerts_dismissed') || 'null');
              const actLog = JSON.parse(localStorage.getItem('ss_actlog') || 'null');

              const state = {
                entries: Array.isArray(entries) ? entries : [],
                inventory: Array.isArray(inventory) ? inventory : [],
                suppliers: Array.isArray(suppliers) ? suppliers : [],
                goals: Array.isArray(goals) ? goals : [],
                alertsDismissed: Array.isArray(alertsDismissed) ? alertsDismissed : [],
                actLog: Array.isArray(actLog) ? actLog : [],
              };

              return JSON.stringify({ state, version: 0 });
            } catch {
              return null;
            }
          },

          setItem: (_name, value) => {
            try {
              const parsed = JSON.parse(value);
              const state = parsed?.state ?? {};
              if (Array.isArray(state.entries))
                localStorage.setItem('ss_entries', JSON.stringify(state.entries));
              if (Array.isArray(state.inventory))
                localStorage.setItem('ss_inventory', JSON.stringify(state.inventory));
              if (Array.isArray(state.suppliers))
                localStorage.setItem('ss_suppliers', JSON.stringify(state.suppliers));
              if (Array.isArray(state.goals))
                localStorage.setItem('ss_goals', JSON.stringify(state.goals));
              if (Array.isArray(state.alertsDismissed))
                localStorage.setItem('ss_alerts_dismissed', JSON.stringify(state.alertsDismissed));
              if (Array.isArray(state.actLog))
                localStorage.setItem('ss_actlog', JSON.stringify(state.actLog));
            } catch {
              // ignore write errors
            }
          },

          removeItem: (_name) => {
            try {
              ['ss_entries', 'ss_inventory', 'ss_suppliers', 'ss_goals', 'ss_alerts_dismissed', 'ss_actlog']
                .forEach((k) => localStorage.removeItem(k));
            } catch {
              // ignore
            }
          },
        };
      }),
      partialize: (state) => ({
        entries: state.entries,
        inventory: state.inventory,
        suppliers: state.suppliers,
        goals: state.goals,
        alertsDismissed: state.alertsDismissed,
        actLog: state.actLog,
      }),
    }
  )
);

export { useDb, stockStatus, filterByPeriod };
export default useDb;
