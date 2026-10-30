import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Package,
  AlertTriangle,
  Edit,
  Trash2,
  X,
} from 'lucide-react';
import useAuth from '../store/useAuth';
import { useDb } from '../store/useDb';
import useSettings from '../store/useSettings';
import useToast from '../store/useToast';
import { useModal } from '../components/Modal';
import { formatMoney, formatNum } from '../lib/format';

export default function SuppliersPage() {
  const session = useAuth((s) => s.session);
  const isAdmin = session?.role === 'admin';

  const {
    suppliers,
    inventory,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    updateInventoryItem,
    stockStatus,
    recordActivity,
  } = useDb();

  const { currency, nairaPerUSD, globalLowStockThreshold } = useSettings();
  const addToast = useToast((s) => s.addToast);
  const { open: openModal } = useModal();

  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    document.title = 'Suppliers — SaleStew';
  }, []);

  const fmt = useCallback(
    (n) => formatMoney(n, currency, nairaPerUSD),
    [currency, nairaPerUSD]
  );

  // Stats calculation
  const stats = useMemo(() => {
    const totalSuppliers = suppliers.length;
    let productsLinked = 0;
    let productsNotLinked = 0;

    inventory.forEach((item) => {
      if (item.supplierId) productsLinked++;
      else productsNotLinked++;
    });

    let totalLeadTime = 0;
    let countWithLead = 0;
    suppliers.forEach((s) => {
      if (s.leadTimeDays) {
        totalLeadTime += Number(s.leadTimeDays);
        countWithLead++;
      }
    });

    const avgLeadTime = countWithLead > 0 ? Math.round(totalLeadTime / countWithLead) : 7;

    return {
      totalSuppliers,
      productsLinked,
      productsNotLinked,
      avgLeadTime,
    };
  }, [suppliers, inventory]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    if (!searchQ.trim()) return suppliers;
    const q = searchQ.toLowerCase();
    return suppliers.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.contact || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q)
    );
  }, [suppliers, searchQ]);

  // Selected supplier linked products
  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const linkedProducts = useMemo(() => {
    if (!selectedSupplierId) return [];
    return inventory.filter((item) => item.supplierId === selectedSupplierId);
  }, [inventory, selectedSupplierId]);

  // Add Supplier Modal
  const openAddModal = () => {
    let formState = {
      name: '',
      contact: '',
      phone: '',
      email: '',
      address: '',
      leadTimeDays: 7,
      notes: '',
      selectedItemIds: new Set(),
    };

    openModal({
      title: 'Add New Supplier',
      saveLabel: 'Add Supplier',
      size: 'lg',
      content: (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Supplier / Company Name *</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Lagos Wholesale Hub"
                defaultValue={formState.name}
                onChange={(e) => { formState.name = e.target.value; }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. Emeka Okafor"
                defaultValue={formState.contact}
                onChange={(e) => { formState.contact = e.target.value; }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="text"
                placeholder="+234..."
                defaultValue={formState.phone}
                onChange={(e) => { formState.phone = e.target.value; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="sales@supplier.com"
                defaultValue={formState.email}
                onChange={(e) => { formState.email = e.target.value; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Time (Days)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                defaultValue={formState.leadTimeDays}
                onChange={(e) => { formState.leadTimeDays = parseInt(e.target.value, 10) || 7; }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Physical Address</label>
            <input
              className="form-input"
              type="text"
              placeholder="Warehouse location / city"
              defaultValue={formState.address}
              onChange={(e) => { formState.address = e.target.value; }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes &amp; Terms</label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="Payment terms, min order quantity, banking..."
              defaultValue={formState.notes}
              onChange={(e) => { formState.notes = e.target.value; }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Link Products from Catalog</label>
            <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded p-2 bg-[var(--bg2)] space-y-1">
              {inventory.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-xs text-[var(--text)] cursor-pointer hover:bg-[var(--bg3)] p-1 rounded">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) formState.selectedItemIds.add(item.id);
                      else formState.selectedItemIds.delete(item.id);
                    }}
                  />
                  <span>{item.name} ({item.sku || 'No SKU'})</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      ),
      onSave: async () => {
        if (!formState.name.trim()) throw new Error('Supplier name is required.');

        const newSup = {
          name: formState.name.trim(),
          contact: formState.contact.trim(),
          phone: formState.phone.trim(),
          email: formState.email.trim(),
          address: formState.address.trim(),
          leadTimeDays: Number(formState.leadTimeDays) || 7,
          notes: formState.notes.trim(),
        };

        addSupplier(newSup);

        // Note: newSup will get nextId in store. Retrieve highest id.
        const updatedList = useDb.getState().suppliers;
        const created = updatedList[updatedList.length - 1];
        if (created && formState.selectedItemIds.size > 0) {
          formState.selectedItemIds.forEach((itemId) => {
            updateInventoryItem(itemId, { supplierId: created.id });
          });
        }

        recordActivity?.('supplier_add', `Added supplier ${newSup.name}`, session?.username, 'Suppliers');
        addToast({ msg: `Supplier "${newSup.name}" created!`, type: 'success' });
      },
    });
  };

  // Edit Supplier Modal
  const openEditModal = (sup) => {
    let formState = {
      name: sup.name,
      contact: sup.contact || '',
      phone: sup.phone || '',
      email: sup.email || '',
      address: sup.address || '',
      leadTimeDays: sup.leadTimeDays || 7,
      notes: sup.notes || '',
    };

    openModal({
      title: `Edit ${sup.name}`,
      saveLabel: 'Save Changes',
      size: 'lg',
      content: (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Supplier / Company Name *</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.name}
                onChange={(e) => { formState.name = e.target.value; }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Person</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.contact}
                onChange={(e) => { formState.contact = e.target.value; }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                type="text"
                defaultValue={formState.phone}
                onChange={(e) => { formState.phone = e.target.value; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                defaultValue={formState.email}
                onChange={(e) => { formState.email = e.target.value; }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Time (Days)</label>
              <input
                className="form-input"
                type="number"
                min="1"
                defaultValue={formState.leadTimeDays}
                onChange={(e) => { formState.leadTimeDays = parseInt(e.target.value, 10) || 7; }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Physical Address</label>
            <input
              className="form-input"
              type="text"
              defaultValue={formState.address}
              onChange={(e) => { formState.address = e.target.value; }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes &amp; Terms</label>
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
        if (!formState.name.trim()) throw new Error('Supplier name is required.');

        updateSupplier(sup.id, {
          name: formState.name.trim(),
          contact: formState.contact.trim(),
          phone: formState.phone.trim(),
          email: formState.email.trim(),
          address: formState.address.trim(),
          leadTimeDays: Number(formState.leadTimeDays) || 7,
          notes: formState.notes.trim(),
        });

        recordActivity?.('supplier_edit', `Updated supplier ${sup.name}`, session?.username, 'Suppliers');
        addToast({ msg: `Supplier "${formState.name}" updated!`, type: 'success' });
      },
    });
  };

  // Delete Supplier with unlink and undo
  const handleDelete = (sup) => {
    if (!isAdmin) {
      addToast({ msg: 'Admin permission required to remove suppliers', type: 'error' });
      return;
    }

    const previousSuppliers = [...suppliers];
    const previousInventory = [...inventory];

    // Unlink products
    inventory.forEach((item) => {
      if (item.supplierId === sup.id) {
        updateInventoryItem(item.id, { supplierId: null });
      }
    });

    deleteSupplier(sup.id);
    if (selectedSupplierId === sup.id) setSelectedSupplierId(null);

    recordActivity?.('supplier_delete', `Deleted supplier ${sup.name}`, session?.username, 'Suppliers');

    addToast({
      msg: `Deleted supplier "${sup.name}"`,
      type: 'warning',
      actions: [
        {
          label: 'Undo',
          onClick: () => {
            useDb.setState({ suppliers: previousSuppliers, inventory: previousInventory });
            addToast({ msg: `Restored supplier "${sup.name}"`, type: 'success' });
          },
        },
      ],
    });
  };

  return (
    <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-serif font-bold text-[var(--text)]">Suppliers</h1>
          <p className="page-sub text-xs text-[var(--text-2)]">// vendor contacts, lead times &amp; purchase origins</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openAddModal} className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="stat-grid grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="stat-card__lbl">Active Vendors</div>
          <div className="stat-card__val font-mono">{formatNum(stats.totalSuppliers)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">managed partners</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Products Linked</div>
          <div className="stat-card__val font-mono text-[var(--green)]">{formatNum(stats.productsLinked)}</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">tied to suppliers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Unassigned Items</div>
          <div className={`stat-card__val font-mono ${stats.productsNotLinked > 0 ? 'text-[var(--warn)]' : 'text-[var(--text)]'}`}>
            {formatNum(stats.productsNotLinked)}
          </div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">no vendor assigned</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lbl">Avg Lead Time</div>
          <div className="stat-card__val font-mono">{stats.avgLeadTime} days</div>
          <div className="stat-card__sub text-xs text-[var(--text-3)]">restock transit estimate</div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="panel space-y-4">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search vendor name, contact person, phone..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="form-input text-xs py-1.5 px-3 max-w-sm"
          />
          <span className="text-xs text-[var(--text-3)] font-mono">
            {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} found
          </span>
        </div>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full py-8 text-center text-[var(--text-3)] text-xs">
              No suppliers found matching your query.
            </div>
          ) : (
            filteredSuppliers.map((sup) => {
              const linkedCount = inventory.filter((i) => i.supplierId === sup.id).length;
              const hasLowStock = inventory.some(
                (i) => i.supplierId === sup.id && (stockStatus(i, globalLowStockThreshold).t === 'low' || stockStatus(i, globalLowStockThreshold).t === 'out')
              );
              const isSelected = selectedSupplierId === sup.id;

              return (
                <div
                  key={sup.id}
                  className={`p-4 rounded border transition-all ${
                    isSelected
                      ? 'border-[var(--green)] bg-[rgba(78,148,99,0.06)]'
                      : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-2)]'
                  } space-y-3 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-bold text-base text-[var(--text)]">{sup.name}</h3>
                      <span className="badge badge-info text-[10px] whitespace-nowrap inline-flex items-center gap-1">
                        <Clock size={11} />
                        <span>{sup.leadTimeDays || 7}d lead</span>
                      </span>
                    </div>

                    {sup.contact && (
                      <p className="text-xs text-[var(--text-2)] font-mono mt-1 flex items-center gap-1">
                        <User size={12} className="opacity-60" />
                        <span>{sup.contact}</span>
                      </p>
                    )}

                    <div className="text-xs text-[var(--text-3)] space-y-1 mt-2">
                      {sup.phone && <div className="flex items-center gap-1.5"><Phone size={12} className="opacity-60" /><span>{sup.phone}</span></div>}
                      {sup.email && <div className="flex items-center gap-1.5"><Mail size={12} className="opacity-60" /><span>{sup.email}</span></div>}
                      {sup.address && <div className="flex items-center gap-1.5"><MapPin size={12} className="opacity-60" /><span>{sup.address}</span></div>}
                    </div>

                    {sup.notes && (
                      <p className="text-[11px] text-[var(--text-2)] mt-2 italic line-clamp-2">
                        "{sup.notes}"
                      </p>
                    )}
                  </div>

                  <div className="border-t border-[var(--border)] pt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[var(--text-2)] flex items-center gap-1">
                        <Package size={12} className="opacity-60" />
                        <span>{linkedCount} item{linkedCount !== 1 ? 's' : ''}</span>
                      </span>
                      {hasLowStock && (
                        <span className="badge badge-warning text-[9px] px-1.5 py-0.5 inline-flex items-center gap-1">
                          <AlertTriangle size={10} />
                          <span>Needs Reorder</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSupplierId(isSelected ? null : sup.id)}
                        className={`btn btn-sm text-[11px] py-1 px-2 ${
                          isSelected ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {isSelected ? 'Hide Items' : 'View Items'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(sup)}
                        className="p-1 hover:text-[var(--green)] text-xs text-[var(--text-2)] opacity-70 hover:opacity-100"
                        title="Edit Supplier"
                      >
                        <Edit size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(sup)}
                          className="p-1 hover:text-[var(--down)] text-xs text-[var(--text-3)] opacity-70 hover:opacity-100"
                          title="Delete Supplier"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Linked Products Drawer/Panel */}
      {selectedSupplier && (
        <div className="panel space-y-4 border-2 border-[var(--green)]">
          <div className="flex items-center justify-between">
            <h2 className="panel-title text-sm font-semibold font-mono text-[var(--text)]">
              // PRODUCTS SUPPLIED BY: {selectedSupplier.name.toUpperCase()} ({linkedProducts.length} items)
            </h2>
            <button
              onClick={() => setSelectedSupplierId(null)}
              className="text-xs text-[var(--text-3)] hover:text-[var(--text)] inline-flex items-center gap-1"
            >
              <X size={13} />
              <span>Close</span>
            </button>
          </div>

          <div className="table-wrap overflow-x-auto">
            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-3)] font-mono">
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Current Stock</th>
                  <th className="py-2 px-3 text-right">Reorder Level</th>
                  <th className="py-2 px-3 text-right">Cost Price</th>
                  <th className="py-2 px-3 text-right">Selling Price</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] font-mono">
                {linkedProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-4 text-center text-[var(--text-3)]">
                      No products are linked to this supplier yet.
                    </td>
                  </tr>
                ) : (
                  linkedProducts.map((p) => {
                    const st = stockStatus(p, globalLowStockThreshold);
                    return (
                      <tr key={p.id} className="hover:bg-[var(--card-h)]">
                        <td className="py-2 px-3 text-[var(--text-2)]">{p.sku || '—'}</td>
                        <td className="py-2 px-3 font-sans font-medium text-[var(--text)]">{p.name}</td>
                        <td className="py-2 px-3 text-[var(--text-2)]">{p.category || 'General'}</td>
                        <td className="py-2 px-3 text-right font-bold text-[var(--text)]">{formatNum(p.stock || 0)}</td>
                        <td className="py-2 px-3 text-right text-[var(--text-3)]">
                          {p.globalThreshold ? `Global (${globalLowStockThreshold})` : (p.lowStockThreshold ?? 10)}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-2)]">{fmt(p.costPrice || 0)}</td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--text)]">{fmt(p.sellingPrice || 0)}</td>
                        <td className="py-2 px-3">
                          <span className={`badge ${
                            st.t === 'ok' ? 'badge-success' : st.t === 'low' ? 'badge-warning' : 'badge-error'
                          }`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}

