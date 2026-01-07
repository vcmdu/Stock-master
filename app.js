// Data Models
let products = [];
let transactions = [];
let currentInvFilter = 'all'; // 'all', 'low', 'out'
let currentChartPeriod = 'month'; // 'week', 'month', 'year'

// --- INITIAL DATA LOAD & MIGRATION ---
try {
    const rawProducts = JSON.parse(localStorage.getItem('sm_products')) || [];
    if (Array.isArray(rawProducts)) {
        products = rawProducts.map(p => {
            if (p.category && !p.brand) {
                return { ...p, brand: p.category, category: '' };
            }
            return p;
        });
    } else {
        products = [];
    }
} catch (e) {
    console.error('Failed to load products', e);
    products = [];
}

try {
    transactions = JSON.parse(localStorage.getItem('sm_transactions')) || [];
    if (!Array.isArray(transactions)) transactions = [];
} catch (e) {
    console.error('Failed to load transactions', e);
    transactions = [];
}

// --- CORE FUNCTIONS ---
const saveInfo = () => {
    localStorage.setItem('sm_products', JSON.stringify(products));
    localStorage.setItem('sm_transactions', JSON.stringify(transactions));
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'error' ? 'alert-circle' : 'checkmark-circle';
    toast.innerHTML = `<ion-icon name="${icon}"></ion-icon><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

// --- NAVIGATION & FILTERING ---
// New Click Handlers for Dashboard Stats
window.showAllStock = () => {
    currentInvFilter = 'all';
    switchView('inventory');
};

window.showLowStock = () => {
    currentInvFilter = 'low';
    switchView('inventory');
    showToast('Showing Low Stock Items', 'info');
};

window.showOutOfStock = () => {
    currentInvFilter = 'out';
    switchView('inventory');
    showToast('Showing Out of Stock Items', 'error');
};

// Aliases for HTML onclick compatibility
window.showInventory = window.showAllStock;

window.switchView = (viewName, element, updateHistory = true) => {
    if (element && viewName === 'inventory') {
        currentInvFilter = 'all';
    }

    // Clear Toasts
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) toastContainer.innerHTML = '';

    // Update Menu
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        const link = document.querySelector(`.nav-links li[onclick*="'${viewName}'"]`);
        if (link) link.classList.add('active');
    }

    // Title
    const titles = {
        'dashboard': 'Dashboard',
        'inventory': 'Inventory',
        'buy': 'Buy Stock',
        'sell': 'Sell Stock',
        'reports': 'Reports',
        'growth': 'Growth Trajectory',
        'settings': 'Settings'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'StockMaster';

    // View Visibility
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        v.style.display = 'none';
        v.style.opacity = '0';
    });
    const view = document.getElementById(`view-${viewName}`);
    if (view) {
        view.classList.add('active');
        view.style.display = 'block';
        // Motion Animation
        if (window.Motion) {
            Motion.animate(view, { opacity: [0, 1], y: [20, 0] }, { duration: 0.5, easing: [0.4, 0, 0.2, 1] });
        }
    }

    // Reset Forms
    resetForms(viewName);

    // Specific Init
    if (viewName === 'sell') initSellForm();
    if (viewName === 'buy') initBuyForm();
    if (viewName === 'inventory') renderInventory();
    if (viewName === 'dashboard') updateDashboard();
    if (viewName === 'growth') initGrowthChart();
    if (viewName === 'reports') runReports('ALL', true); // true = silent mode


    // Mobile Sidebar Close
    if (window.innerWidth <= 768) {
        document.body.classList.remove('sidebar-active');
    }

    // History API
    if (updateHistory) {
        history.pushState({ view: viewName }, titles[viewName], `?view=${viewName}`);
    }
};

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.view) {
        switchView(event.state.view, null, false);
    } else {
        // Fallback or default
        switchView('dashboard', null, false);
    }
});

const resetForms = (viewName) => {
    if (viewName !== 'buy') {
        const form = document.getElementById('buy-form');
        if (form) {
            form.reset();
            document.getElementById('buy-info-group').style.display = 'none';
        }
    }
    if (viewName !== 'sell') {
        const form = document.getElementById('sell-form');
        if (form) {
            form.reset();
            document.getElementById('sell-info-group').style.display = 'none';
        }
    }
    // Always hide new product fields on reset
    const newFields = document.getElementById('buy-new-product-fields');
    if (newFields) newFields.style.display = 'none';
};

// --- DATA LISTS ---
const updateDatalists = () => {
    const nameListBuy = document.getElementById('buy-names-list');
    const names = [...new Set(products.map(p => p.name))].sort();
    if (nameListBuy) nameListBuy.innerHTML = names.map(n => `<option value="${n}">`).join('');

    const sellSelect = document.getElementById('sell-product-name');
    if (sellSelect) {
        const inStockNames = [...new Set(products.filter(p => p.stock > 0).map(p => p.name))].sort();
        const current = sellSelect.value;
        const options = ['<option value="">Select Product...</option>'];
        inStockNames.forEach(n => {
            options.push(`<option value="${n}" ${n === current ? 'selected' : ''}>${n}</option>`);
        });
        sellSelect.innerHTML = options.join('');
    }
};

window.handleProductInput = (type) => {
    const prefix = type === 'IN' ? 'buy' : 'sell';
    const nameInput = document.getElementById(`${prefix}-product-name`);
    const brandInput = document.getElementById(`${prefix}-brand`);
    const catInput = document.getElementById(`${prefix}-category`);
    const sizeInput = document.getElementById(`${prefix}-size`);
    const kgInput = document.getElementById(`${prefix}-kg`);

    const name = nameInput.value;
    const brand = brandInput.value;
    const cat = catInput.value;
    const size = sizeInput.value;
    const kg = kgInput.value;

    let available = products;
    if (type === 'OUT') available = products.filter(p => p.stock > 0);

    if (name) available = available.filter(p => p.name.toLowerCase() === name.toLowerCase());

    const brands = [...new Set(available.map(p => p.brand).filter(Boolean))].sort();
    updateFieldOptions(brandInput, brands, 'Brand', prefix);
    if (brand) available = available.filter(p => (p.brand || '').toLowerCase() === brand.toLowerCase());

    const categories = [...new Set(available.map(p => p.category).filter(Boolean))].sort();
    updateFieldOptions(catInput, categories, 'Category', prefix);
    if (cat) available = available.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());

    const sizes = [...new Set(available.map(p => p.size).filter(Boolean))].sort();
    updateFieldOptions(sizeInput, sizes, 'Size', prefix);
    if (size) available = available.filter(p => (p.size || '').toLowerCase() === size.toLowerCase());

    const kgs = [...new Set(available.map(p => p.kg).filter(Boolean))].sort();
    updateFieldOptions(kgInput, kgs, 'KG', prefix);
    if (kg) available = available.filter(p => (p.kg || '').toLowerCase() === kg.toLowerCase());

    let match = null;
    if (available.length === 1 && name) {
        match = available[0];
    }

    const infoGroup = document.getElementById(`${prefix}-info-group`);
    const stockDisplay = document.getElementById(`${prefix}-stock-display`);
    const priceInput = document.getElementById(`${prefix}-price`);
    const form = document.getElementById(`${prefix}-form`);

    if (match) {
        infoGroup.style.display = 'block';
        stockDisplay.textContent = `${match.stock} ${match.unitType || 'Units'}`;
        stockDisplay.style.color = match.stock <= match.minStock ? 'var(--danger)' : 'var(--text-main)';

        // Update Labels based on Unit Type
        let unitLabel = 'Quantity (Units)';
        if (match.unitType === 'KG') unitLabel = 'Weight (KG)';
        else if (match.unitType === 'Meter') unitLabel = 'Length (Meters)';

        // Find the quantity label for this specific form and update it
        const qtyLabel = form.querySelector('label[for$="-qty"]'); // buy-qty or sell-qty
        if (qtyLabel) qtyLabel.textContent = unitLabel;

        // Dynamic Fields Visibility (Buy/Sell Form)
        const sizeInput = document.getElementById(`${prefix}-size`).parentElement; // get form-group
        const kgInput = document.getElementById(`${prefix}-kg`).parentElement;

        // Default: Hide
        sizeInput.style.display = 'none';
        kgInput.style.display = 'none';

        // Show based on Unit Type of matched product
        if (match.unitType === 'Box') {
            sizeInput.style.display = 'block';
            kgInput.style.display = 'block';
        } else if (match.unitType === 'Piece' || match.unitType === 'KG') {
            sizeInput.style.display = 'block';
        }
        // Meter: Remain Hidden

        // --- CONVERSION TOGGLE LOGIC ---
        const toggleId = `${prefix}-unit-toggle`;
        const toggleDiv = document.getElementById(toggleId);
        if (match.conversionRate && match.conversionRate > 1 && match.purchaseUnit) {
            toggleDiv.style.display = 'flex';
            // Update Toggle Labels
            toggleDiv.querySelector('[data-mode="stock"]').textContent = match.unitType || 'Base';
            toggleDiv.querySelector('[data-mode="bulk"]').textContent = match.purchaseUnit;
            // Reset to stock mode by default
            window.setUnitMode(type, 'stock');
        } else {
            toggleDiv.style.display = 'none';
        }


        // Show Unit Cost on Sell Screen
        if (type === 'OUT') {
            const costDisplay = document.getElementById('sell-buy-price-display');
            if (costDisplay) {
                costDisplay.textContent = formatCurrency(match.buyPrice || 0);
            }
        }

        if (!priceInput.value || priceInput.value == 0) {
            priceInput.value = type === 'IN' ? match.buyPrice : match.sellPrice;
        }
        form.dataset.matchedId = match.id;
    } else {
        infoGroup.style.display = 'none';
        delete form.dataset.matchedId;
        // Reset Label
        const qtyLabel = form.querySelector('label[for$="-qty"]');
        if (qtyLabel) qtyLabel.textContent = 'Quantity / Weight (Total)';

        // Reset Fields to Default (Hidden for Clean UI, user selects Unit Type from Modal if creating new)
        // Wait, if creating new product via Buy form, we rely on Modal? 
        // Actually, Buy form has these inputs. 
        // Let's keep them HIDDEN by default to match "Inventory" logic. 
        // If user types a new name, they effectively can't set Size/KG here easily unless we auto-show?
        // But the prompt says "default only show inventory new product".
        // Let's set them to HIDDEN.
        const sizeInput = document.getElementById(`${prefix}-size`).parentElement;
        const kgInput = document.getElementById(`${prefix}-kg`).parentElement;
        if (sizeInput) sizeInput.style.display = 'none';
        if (sizeInput) sizeInput.style.display = 'none';
        if (kgInput) kgInput.style.display = 'none';
    }

    // --- NEW PRODUCT DETECTION LOGIC (BUY FORM) ---
    if (type === 'IN') {
        const newFields = document.getElementById('buy-new-product-fields');
        if (newFields) {
            if (!match && name && name.length > 1) {
                // No match, but user typed a name -> Likely a new product
                newFields.style.display = 'block';
            } else {
                // Match found OR empty name -> Hide new product fields
                newFields.style.display = 'none';
            }
        }
    }
};

const updateFieldOptions = (el, options, placeholder, prefix) => {
    if (!el) return;
    if (el.tagName === 'SELECT') {
        const current = el.value;
        const opts = [`<option value="">Select ${placeholder}...</option>`];
        options.forEach(o => {
            opts.push(`<option value="${o}" ${o === current ? 'selected' : ''}>${o}</option>`);
        });
        el.innerHTML = opts.join('');
    } else {
        const listSuffix = placeholder === 'Category' ? 'cats' : placeholder.toLowerCase() + 's';
        const list = document.getElementById(`${prefix}-${listSuffix}-list`);
        if (list) {
            list.innerHTML = options.map(o => `<option value="${o}">`).join('');
        }
    }
};

const initBuyForm = () => {
    document.getElementById('buy-date').valueAsDate = new Date();
    updateDatalists();
    renderTransactionHistory('IN');
};

const initSellForm = () => {
    document.getElementById('sell-date').valueAsDate = new Date();
    updateDatalists();
    renderTransactionHistory('OUT');
};

// --- TRANSACTIONS ---
window.handleTransaction = (e, type) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'buy' : 'sell';

    const name = document.getElementById(`${prefix}-product-name`).value.trim();
    const brand = document.getElementById(`${prefix}-brand`).value.trim();
    const cat = document.getElementById(`${prefix}-category`).value.trim();
    const size = document.getElementById(`${prefix}-size`) ? document.getElementById(`${prefix}-size`).value.trim() : '';
    const kg = document.getElementById(`${prefix}-kg`) ? document.getElementById(`${prefix}-kg`).value.trim() : '';

    const date = document.getElementById(`${prefix}-date`).value;
    const qty = parseFloat(document.getElementById(`${prefix}-qty`).value);
    const price = parseFloat(document.getElementById(`${prefix}-price`).value);
    const notes = document.getElementById(`${prefix}-notes`).value;

    if (isNaN(qty) || qty <= 0) {
        showToast('Invalid Quantity', 'error');
        return;
    }

    let prodId = document.getElementById(`${prefix}-form`).dataset.matchedId;
    let product;

    if (!prodId) {
        if (type === 'OUT') {
            showToast('Product not found in inventory. Cannot sell unknown item.', 'error');
            return;
        }
        const existing = products.find(p =>
            p.name.toLowerCase() === name.toLowerCase() &&
            (p.brand || '').toLowerCase() === brand.toLowerCase() &&
            (p.category || '').toLowerCase() === cat.toLowerCase()
        );

        if (existing) {
            product = existing;
            prodId = existing.id;
        } else {
            // "Simply Buy" - Create new product on the fly during purchase
            product = {
                id: Date.now(),
                name, brand, category: cat, size, kg,
                stock: 0,
                // Read from "Smart" fields in Buy form
                unitType: document.getElementById('buy-new-unit') ? document.getElementById('buy-new-unit').value : 'Piece',
                minStock: document.getElementById('buy-new-min-stock') ? parseInt(document.getElementById('buy-new-min-stock').value) || 5 : 5,
                buyPrice: price, // Now correctly defined
                sellPrice: document.getElementById('buy-new-sell-price') ? parseFloat(document.getElementById('buy-new-sell-price').value) || 0 : 0
            };
            products.push(product);
            prodId = product.id;
            showToast(`New product "${name}" added to inventory`, 'info');
        }
    } else {
        product = products.find(p => p.id == prodId);
        if (!product) {
            showToast('Internal Error: Product ID match failed.', 'error');
            return;
        }
    }


    if (type === 'OUT' && product.stock < qty) {
        showToast(`Insufficient Stock! Available: ${product.stock}`, 'error');
        return;
    }

    // Process
    let finalQty = qty;
    let finalPrice = price; // This is Unit Price

    // Check Conversion Mode
    const form = document.getElementById(`${prefix}-form`);
    const mode = form.dataset.unitMode || 'stock';

    if (mode === 'bulk' && product.conversionRate) {
        // User entered Bulk Qty (e.g. 2 Packs)
        // Rate = 50 KG/Pack
        // Final Qty = 2 * 50 = 100 KG
        finalQty = qty * product.conversionRate;

        // Price Logic:
        // If Type IN: User usually enters "Price per Pack" or "Total Price".
        // The form asks for "Unit Price".
        // If I buy 1 Pack at 500rs. Qty=1. Price=500.
        // Final Qty = 50. Final Unit Cost = 500 / 50 = 10.
        // So: Final Unit Price = Input Price / Conversion Rate.
        finalPrice = price / product.conversionRate;
    }

    const total = finalQty * finalPrice;

    transactions.push({
        id: Date.now(),
        date, type, productId: product.id,
        productName: product.name, productBrand: product.brand, productCategory: product.category, productSize: product.size, productKG: product.kg,
        quantity: finalQty, price: finalPrice, total, notes,
        unitMode: mode, // Track which unit was used
        unitType: product.unitType || 'Piece' // Store the unit type explicitly
    });

    if (type === 'IN') {
        product.stock += finalQty;
        product.buyPrice = finalPrice;
    } else {
        product.stock -= finalQty;
    }

    saveInfo();
    showToast(type === 'IN' ? 'Purchase Recorded' : 'Sale Recorded');

    e.target.reset();
    document.getElementById(`${prefix}-date`).valueAsDate = new Date();
    delete document.getElementById(`${prefix}-form`).dataset.matchedId;
    document.getElementById(`${prefix}-info-group`).style.display = 'none';

    handleProductInput(type);
    if (type === 'IN') {
        initBuyForm();
        renderTransactionHistory('IN'); // Refresh list
    }
    if (type === 'OUT') {
        initSellForm();
        renderTransactionHistory('OUT'); // Refresh list
    }

    // Real-time update for analytics if active
    if (document.getElementById('view-growth').classList.contains('active')) {
        initGrowthChart();
    }
};

window.renderTransactionHistory = (type) => {
    const listId = type === 'IN' ? 'buy-history-list' : 'sell-history-list';
    const container = document.getElementById(listId);
    if (!container) return;

    // Filter relevant transactions, reverse to show newest first, take top 5
    const history = transactions.filter(t => t.type === type).reverse().slice(0, 5);

    if (history.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted); padding:10px; text-align:center; font-size:0.9rem;">No recent ${type === 'IN' ? 'purchases' : 'sales'}</div>`;
        return;
    }

    container.innerHTML = history.map(t => {
        // Fallback for old data: Find product to get unit type
        let unit = t.unitType;
        if (!unit) {
            const p = products.find(prod => prod.id === t.productId);
            unit = p ? p.unitType : 'Units';
        }

        return `
        <div class="list-item" style="border-left: 3px solid ${type === 'IN' ? 'var(--success)' : 'var(--danger)'}">
            <div style="display:flex; justify-content:space-between;">
                <strong>${t.productName}</strong>
                <span class="badge ${type === 'IN' ? 'in' : 'out'}">${formatCurrency(t.total)}</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; justify-content:space-between; margin-top:2px;">
                <span>${t.date}</span>
                <span>${t.quantity} ${unit || 'Units'}</span>
            </div>
        </div>
        `;
    }).join('');

    // Animate list items if Motion is available
    if (window.Motion) {
        Motion.animate(`#${listId} .list-item`, { opacity: [0, 1], x: [-10, 0] }, {
            duration: 0.3,
            delay: Motion.stagger(0.05)
        });
    }
};

// --- DASHBOARD ---
const updateDashboard = () => {
    // Stats
    const totalAsset = products.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.buyPrice || 0)), 0);
    document.getElementById('dash-total-value').textContent = formatCurrency(totalAsset);
    document.getElementById('dash-total-products').textContent = products.length;

    // Robust checks for Low/Out of Stock
    const lowStockCount = products.filter(p => {
        const stock = Number(p.stock) || 0;
        const min = Number(p.minStock) || 0;
        return stock > 0 && stock <= min;
    }).length;

    const outStockCount = products.filter(p => (Number(p.stock) || 0) <= 0).length;

    document.getElementById('dash-low-stock').textContent = lowStockCount;
    document.getElementById('dash-out-of-stock').textContent = outStockCount;

    // Out of Stock Details
    const outListBody = document.getElementById('dashboard-out-of-stock-body');
    const outOfStockItems = products.filter(p => (Number(p.stock) || 0) <= 0);

    if (outListBody) {
        if (outOfStockItems.length === 0) {
            outListBody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:15px; color:var(--text-muted)">All products in stock!</td></tr>';
        } else {
            outListBody.innerHTML = outOfStockItems.map(p => `
                <tr>
                    <td>
                        <strong style="color:var(--text-main)">${p.name}</strong><br>
                        <small style="color:var(--text-secondary)">${p.brand || '-'}</small>
                    </td>
                    <td>
                        <button class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="quickReorder(${p.id})">
                            Buy
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Recent Lists (Activity)
    const recents = document.getElementById('recent-activity-list');
    recents.innerHTML = transactions.slice().reverse().slice(0, 5).map(t => {
        // Resolve Unit
        let unit = t.unitType;
        if (!unit) {
            const p = products.find(prod => prod.id === t.productId);
            unit = p ? p.unitType : 'Units';
        }

        return `
        <div class="transaction-item list-item" style="border-left: 3px solid ${t.type === 'IN' ? 'var(--success)' : 'var(--danger)'}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <strong style="color:var(--text-main); display:block; margin-bottom:2px;">${t.productName || 'Unknown Item'}</strong>
                    <span style="font-size:0.75rem; color:var(--text-secondary);">
                        <span style="color:${t.type === 'IN' ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">
                            ${t.type === 'IN' ? 'Bought' : 'Sold'}
                        </span> 
                        ${t.quantity} ${unit}
                    </span>
                </div>
                <div style="text-align:right;">
                    <span style="font-weight:700; display:block; margin-bottom:2px;">${formatCurrency(t.total)}</span>
                    <span style="font-size:0.7rem; color:var(--text-muted);">${t.date}</span>
                </div>
            </div>
        </div>
    `}).join('');

    const lowStockList = document.getElementById('low-stock-list');
    const lowStock = products.filter(p => {
        const stock = Number(p.stock) || 0;
        const min = Number(p.minStock) || 0;
        return stock > 0 && stock <= min;
    });
    if (lowStock.length === 0) {
        lowStockList.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center">All stocks good</div>';
    } else {
        lowStockList.innerHTML = lowStock.slice(0, 5).map(p => `
            <div class="list-item" style="border-left: 3px solid var(--warning)">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${p.name}</strong>
                    <strong style="color:var(--warning)">${p.stock}</strong>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Min: ${p.minStock}</div>
            </div>
        `).join('');
    }

    // Animate list items if Motion is available
    if (window.Motion) {
        Motion.animate(".list-item", { opacity: [0, 1], x: [-10, 0] }, {
            duration: 0.3,
            delay: Motion.stagger(0.05)
        });
        Motion.animate(".stat-card", { opacity: [0, 1], scale: [0.95, 1] }, {
            duration: 0.4,
            delay: Motion.stagger(0.1)
        });
    }
};

// --- INVENTORY ---
window.renderInventory = () => {
    const search = document.getElementById('inv-search').value.toLowerCase();
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';

    // Advanced Filtering
    let filtered = products.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.brand || '').toLowerCase().includes(search) ||
        (p.category || '').toLowerCase().includes(search)
    );

    if (currentInvFilter === 'low') {
        filtered = filtered.filter(p => {
            const stock = Number(p.stock) || 0;
            const min = Number(p.minStock) || 0;
            return stock > 0 && stock <= min;
        });
    } else if (currentInvFilter === 'out') {
        filtered = filtered.filter(p => (Number(p.stock) || 0) <= 0);
    }
    // 'all' does no additional filtering

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; color:var(--text-muted)">
                No products found ${currentInvFilter !== 'all' ? `(${currentInvFilter} stock)` : ''}
            </td></tr>`;
        return;
    }

    // Sort: Newest First (reverse index order basically, but safer to sort by ID if IDs are timestamps)
    // Actually IDs are timestamps, so sorting by ID desc is Newest First
    filtered.sort((a, b) => b.id - a.id).forEach((p, i) => {
        const stockNum = Number(p.stock) || 0;
        const minNum = Number(p.minStock) || 0;
        const status = stockNum <= 0 ? '<span class="badge out">Out</span>' :
            (stockNum <= minNum ? '<span class="badge low">Low</span>' : '<span class="badge ok">OK</span>');

        tbody.innerHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>
                    <strong>${p.name}</strong><br>
                    <span style="font-size:0.75rem; color:var(--text-secondary)">${p.unitType || 'Piece'}</span>
                </td>
                <td>${p.brand || '-'}</td>
                <td>${p.category || '-'}</td>
                <td>${p.size || '-'}</td>
                <td>${p.kg || '-'}</td>
                <td>${p.stock}</td>
                <td>${p.minStock}</td>
                <td>${formatCurrency(p.buyPrice)}</td>
                <td>${formatCurrency(p.sellPrice)}</td>
                <td>${status}</td>
                <td>
                    <button class="icon-btn" onclick="editProduct(${p.id})"><ion-icon name="create-outline"></ion-icon></button>
                    <button class="icon-btn" onclick="deleteProduct(${p.id})"><ion-icon name="trash"></ion-icon></button>
                </td>
            </tr>
        `;
    });

    // Animate rows if Motion is available
    if (window.Motion) {
        Motion.animate("#inventory-table-body tr", { opacity: [0, 1], y: [10, 0] }, {
            duration: 0.3,
            delay: Motion.stagger(0.01)
        });
    }
};

window.saveProduct = (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const unit = document.getElementById('prod-unit').value || 'Piece';
    const brand = document.getElementById('prod-brand').value;
    const cat = document.getElementById('prod-category').value;
    const size = document.getElementById('prod-size').value;
    const kg = document.getElementById('prod-kg').value;
    const min = parseInt(document.getElementById('prod-min').value);
    const buy = parseFloat(document.getElementById('prod-buy').value);
    const sell = parseFloat(document.getElementById('prod-sell').value);
    const initialStock = parseInt(document.getElementById('prod-stock').value || 0);

    // Conversion Data
    const hasConversion = document.getElementById('prod-has-conversion').checked;
    const purchaseUnit = hasConversion ? document.getElementById('prod-buy-unit').value : null;
    const conversionRate = hasConversion ? parseFloat(document.getElementById('prod-conversion-rate').value) : null;

    if (id) {
        const p = products.find(x => x.id == id);
        if (p) {
            Object.assign(p, {
                name, unitType: unit, brand, category: cat, size, kg, minStock: min, buyPrice: buy, sellPrice: sell,
                purchaseUnit, conversionRate
            });
        }
    } else {
        // Fallback for direct creation if still used, though 'Buy' is preferred
        const newP = {
            id: Date.now(),
            name, unitType: unit, brand, category: cat, size, kg, minStock: min, buyPrice: buy, sellPrice: sell,
            purchaseUnit, conversionRate,
            stock: 0
        };
        products.push(newP);
    }
    saveInfo();
    closeProductModal();
    showToast('Product Information Updated');
    renderInventory();
};

// --- CONVERSION LOGIC ---
window.toggleConversionFields = () => {
    const isChecked = document.getElementById('prod-has-conversion').checked;
    const fields = document.getElementById('prod-conversion-fields');
    if (fields) fields.style.display = isChecked ? 'block' : 'none';
};

window.setUnitMode = (type, mode) => {
    const prefix = type === 'IN' ? 'buy' : 'sell';
    const form = document.getElementById(`${prefix} -form`);

    // Update active state of buttons
    const btns = document.querySelectorAll(`#${prefix} -unit - toggle.unit - btn`);
    btns.forEach(b => {
        if (b.dataset.mode === mode) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Store current mode in form dataset
    form.dataset.unitMode = mode;

    // Update Placeholder/Label
    const product = products.find(p => p.id == form.dataset.matchedId);
    if (!product) return;

    const qtyInput = document.getElementById(`${prefix} -qty`);
    if (mode === 'bulk') {
        qtyInput.placeholder = `Qty in ${product.purchaseUnit || 'Units'} `;
    } else {
        qtyInput.placeholder = `Qty in ${product.unitType || 'Units'} `;
    }
};

window.editProduct = (id) => {
    const p = products.find(x => x.id == id);
    if (!p) return;
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-unit').value = p.unitType || 'Piece';
    document.getElementById('prod-brand').value = p.brand || '';
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-size').value = p.size || '';
    document.getElementById('prod-kg').value = p.kg || '';
    document.getElementById('prod-min').value = p.minStock;
    document.getElementById('prod-buy').value = p.buyPrice;
    document.getElementById('prod-sell').value = p.sellPrice;
    document.getElementById('prod-buy').value = p.buyPrice;
    document.getElementById('prod-sell').value = p.sellPrice;

    // Load Conversion
    document.getElementById('prod-has-conversion').checked = !!p.conversionRate;
    toggleConversionFields();
    if (p.conversionRate) {
        document.getElementById('prod-buy-unit').value = p.purchaseUnit || '';
        document.getElementById('prod-conversion-rate').value = p.conversionRate;
    }

    document.getElementById('initial-stock-group').style.display = 'none';
    document.getElementById('product-modal').classList.add('active');
    updateRefinedModalFields(); // Restore fields based on type
};

window.deleteProduct = (id) => {
    if (confirm('Delete this product?')) {
        products = products.filter(p => p.id !== id);
        saveInfo();
        renderInventory();
        updateDashboard();
    }
};

window.quickReorder = (id) => {
    const p = products.find(x => x.id == id);
    if (!p) return;

    // Switch to buy view
    switchView('buy');

    // Pre-fill fields
    document.getElementById('buy-product-name').value = p.name;
    document.getElementById('buy-brand').value = p.brand || '';
    document.getElementById('buy-category').value = p.category || '';
    if (document.getElementById('buy-size')) document.getElementById('buy-size').value = p.size || '';
    if (document.getElementById('buy-kg')) document.getElementById('buy-kg').value = p.kg || '';
    document.getElementById('buy-price').value = p.buyPrice || 0;

    // Trigger logic to show stock etc.
    handleProductInput('IN');

    // Focus quantity
    setTimeout(() => document.getElementById('buy-qty').focus(), 300);
    showToast(`Quick Reorder: ${p.name}`);
};

window.openProductModal = (id = '') => {
    document.getElementById('product-modal').classList.add('active');
    document.getElementById('prod-id').value = id;
    if (!id) {
        document.querySelector('#product-modal form').reset();
    }
    updateRefinedModalFields();
};
window.closeProductModal = () => document.getElementById('product-modal').classList.remove('active');
window.toggleSidebar = () => document.body.classList.toggle('sidebar-active');

const init = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'dashboard';
    // Initial load: don't push state, just replace
    history.replaceState({ view }, document.title, `? view = ${view} `);
    switchView(view, null, false);
};

// --- REPORTS ---
let currentReportFilter = 'ALL';

window.runReports = (type = 'ALL', silent = false) => {
    currentReportFilter = type; // Store for PDF
    const fromDateStr = document.getElementById('report-date-from').value;
    const toDateStr = document.getElementById('report-date-to').value;

    // 1. Filter for Stats (Always ALL types within date range)
    let statsFiltered = transactions;
    if (fromDateStr) statsFiltered = statsFiltered.filter(t => t.date >= fromDateStr);
    if (toDateStr) statsFiltered = statsFiltered.filter(t => t.date <= toDateStr);
    updateReportStats(statsFiltered);

    // 2. Filter for Table Display (Date + Type)
    let displayFiltered = statsFiltered;
    if (type !== 'ALL') {
        displayFiltered = displayFiltered.filter(t => t.type === type);
    }

    renderReportTable(displayFiltered);

    if (!silent) {
        const typeLabel = type === 'ALL' ? 'All' : (type === 'IN' ? 'Purchase' : 'Sales');
        showToast(`${typeLabel} Report Generated`);
    }
};

window.clearReportFilters = () => {
    currentReportFilter = 'ALL';
    document.getElementById('report-date-from').value = '';
    document.getElementById('report-date-to').value = '';
    runReports('ALL');
    showToast('Filters Cleared');
};

const updateReportStats = (txList) => {
    // Stat cards should always be visible for comparison
    const salesCard = document.getElementById('report-sales').closest('.card');
    const costCard = document.getElementById('report-cost').closest('.card');
    const profitCard = document.getElementById('report-profit').closest('.card');

    salesCard.style.display = 'flex';
    costCard.style.display = 'flex';
    profitCard.style.display = 'flex';

    // Calculate total sales revenue
    const salesRevenue = txList.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.total, 0);

    // Calculate total purchases cost
    const purchasesCost = txList.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.total, 0);

    // Calculate actual cost of goods sold (COGS) for profit calculation
    let cogs = 0;
    txList.filter(t => t.type === 'OUT').forEach(sale => {
        const product = products.find(p => p.id === sale.productId);
        if (product) {
            // Use the product's buy price to calculate actual cost
            cogs += sale.quantity * (product.buyPrice || 0);
        }
    });

    // Net Profit = Sales Revenue - Cost of Goods Sold
    const profit = salesRevenue - cogs;

    document.getElementById('report-sales').textContent = formatCurrency(salesRevenue);
    document.getElementById('report-cost').textContent = formatCurrency(purchasesCost);

    const profitEl = document.getElementById('report-profit');
    profitEl.textContent = formatCurrency(profit);
    profitEl.className = profit >= 0 ? 'text-success' : 'text-danger';
    profitEl.style.color = profit >= 0 ? 'var(--success)' : 'var(--danger)';

    // Make cards clickable to filter
    salesCard.style.cursor = 'pointer';
    salesCard.onclick = () => runReports('OUT');

    costCard.style.cursor = 'pointer';
    costCard.onclick = () => runReports('IN');

    profitCard.style.cursor = 'pointer';
    profitCard.onclick = () => runReports('ALL');
};

// --- DYNAMIC FIELDS ---
window.updateRefinedModalFields = () => {
    const unit = document.getElementById('prod-unit').value;
    const sizeGroup = document.getElementById('prod-size-group');
    const kgGroup = document.getElementById('prod-kg-group');

    // Default: Hide All (Clean UI)
    sizeGroup.style.display = 'none';
    kgGroup.style.display = 'none';

    if (unit === 'Box') {
        // Box: Show Size and Weight (per box)
        sizeGroup.style.display = 'block';
        kgGroup.style.display = 'block';
    }
    else if (unit === 'Piece') {
        // Piece: Show Size (optional). Hide Weight (usually)
        sizeGroup.style.display = 'block';
    }
    // KG, Meter, Liter: Hide both (Quantity handles the amount)
};

const renderReportTable = (txList) => {
    const tbody = document.getElementById('report-table-body');
    if (!tbody) return;

    if (txList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:15px; color:var(--text-muted)">No transactions found</td></tr>';
        return;
    }

    // Sort Descending Date
    const sorted = [...txList].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map((t, i) => {
        // Fallback for old data
        let unit = t.unitType;
        if (!unit) {
            const p = products.find(prod => prod.id === t.productId);
            unit = p ? p.unitType : 'Units';
        }

        return `
            <tr>
            <td>${i + 1}</td>
            <td>${t.date}</td>
            <td><span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span></td>
            <td>${t.productName}</td>
            <td>${t.quantity} ${unit || 'Units'}</td>
            <td>${formatCurrency(t.total)}</td>
            <td>${t.notes || '-'}</td>
        </tr>
            `}).join('');
};

// Removed Duplicate Function


window.downloadBackupJSON = () => {
    const data = {
        products,
        transactions,
        exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "stock_backup.json");
    dlAnchorElem.click();
};

window.restoreData = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.products && Array.isArray(data.products)) {
                products = data.products;
                transactions = data.transactions || [];
                saveInfo();
                alert('Data Restored Successfully. Refreshing...');
                location.reload();
            } else {
                alert('Invalid Backup File');
            }
        } catch (err) {
            console.error(err);
            alert('Error parsing file');
        }
    };
    reader.readAsText(file);
};

window.removeAllData = () => {
    if (confirm('CRITICAL WARNING: This will permanently delete ALL data. Are you sure?')) {
        localStorage.removeItem('sm_products');
        localStorage.removeItem('sm_transactions');
        location.reload();
    }
};

window.downloadReportPDF = () => {
    if (typeof jspdf === 'undefined') {
        showToast('PDF library not loaded', 'error');
        return;
    }

    // PDF specific currency helper
    const pdfFormat = (val) => `RS ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Filter transactions based on current report view
    const fromDate = document.getElementById('report-date-from').value;
    const toDate = document.getElementById('report-date-to').value;

    let allFiltered = transactions;
    if (fromDate) allFiltered = allFiltered.filter(t => t.date >= fromDate);
    if (toDate) allFiltered = allFiltered.filter(t => t.date <= toDate);

    // Filter for table
    let tableData = allFiltered;
    if (currentReportFilter && currentReportFilter !== 'ALL') {
        tableData = tableData.filter(t => t.type === currentReportFilter);
    }
    tableData.sort((a, b) => new Date(b.date) - new Date(a.date));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Primary Color
    doc.text("StockMaster Report", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    const typeLabel = currentReportFilter === 'ALL' ? 'All Transactions' : (currentReportFilter === 'IN' ? 'Purchase Report' : 'Sales Report');
    doc.text(`${typeLabel} | ${new Date().toLocaleDateString()} `, 14, 30);

    // Summary Stats (Always show all 3 for context in PDF)
    const totalIn = allFiltered.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.total, 0);
    const totalOut = allFiltered.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.total, 0);
    const netProfit = totalOut - totalIn;

    const summaryY = 40;
    doc.setFillColor(245, 247, 250);
    doc.rect(14, summaryY - 5, 182, 20, 'F');
    doc.setFontSize(9);
    doc.setTextColor(0);

    doc.text(`Purchases: ${pdfFormat(totalIn)}`, 20, summaryY + 3);
    doc.text(`Sales: ${pdfFormat(totalOut)}`, 80, summaryY + 3);
    doc.setTextColor(netProfit >= 0 ? 16 : 220, netProfit >= 0 ? 185 : 38, netProfit >= 0 ? 129 : 38);
    doc.text(`Net Profit: ${pdfFormat(netProfit)}`, 140, summaryY + 3);

    doc.setTextColor(100);
    doc.setFontSize(8);
    doc.text(`Period: ${fromDate || 'Start'} to ${toDate || 'End'}`, 20, summaryY + 10);

    // Table
    const tableColumn = ["Date", "Type", "Product", "Quantity", "Total", "Remarks"];
    const tableRows = [];

    tableData.forEach(t => {
        let unit = t.unitType;
        if (!unit) {
            const p = products.find(prod => prod.id === t.productId);
            unit = p ? p.unitType : 'Units';
        }

        const rowData = [
            t.date,
            t.type,
            t.productName,
            `${t.quantity} ${unit || 'Units'} `,
            pdfFormat(t.total),
            t.notes || '-'
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    doc.save(`report_${currentReportFilter.toLowerCase()}_${Date.now()}.pdf`);
};

window.addEventListener('DOMContentLoaded', init);

// --- GROWTH TRAJECTORY ---
let growthChart = null;
let currentGrowthPeriod = 'monthly';
let currentGrowthMode = 'value'; // 'value' or 'qty'

window.setGrowthMode = (mode) => {
    currentGrowthMode = mode;
    document.getElementById('btn-mode-value').classList.toggle('active', mode === 'value');
    document.getElementById('btn-mode-qty').classList.toggle('active', mode === 'qty');
    initGrowthChart();
};

window.setGrowthPeriod = (period) => {
    currentGrowthPeriod = period;
    document.querySelectorAll('#view-growth .view-toggle:first-child .toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${period}'`));
    });
    initGrowthChart();
};

window.initGrowthChart = () => {
    const ctx = document.getElementById('growthChart').getContext('2d');
    if (growthChart) growthChart.destroy();

    if (!transactions || transactions.length === 0) {
        ctx.font = "16px Inter";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("No transactions recorded yet.", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    // 1. Group transactions by selected period
    const getGroupKey = (dateStr) => {
        const d = new Date(dateStr);
        if (currentGrowthPeriod === 'day') return dateStr;
        if (currentGrowthPeriod === 'week') {
            // Get start of week (Sunday)
            const day = d.getDay();
            const diff = d.getDate() - day;
            const startOfWeek = new Date(d.setDate(diff));
            return startOfWeek.toISOString().split('T')[0];
        }
        if (currentGrowthPeriod === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return `${d.getFullYear()}`;
    };

    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstTxDate = new Date(sortedTxs[0].date);
    const lastTxDate = new Date(sortedTxs[sortedTxs.length - 1].date);

    // Generate timeline (no gaps)
    const timelineKeys = [];
    let curr = new Date(firstTxDate);
    if (currentGrowthPeriod === 'monthly') curr.setDate(1);
    if (currentGrowthPeriod === 'yearly') curr.setMonth(0, 1);
    if (currentGrowthPeriod === 'week') {
        curr.setDate(curr.getDate() - curr.getDay());
    }

    const maxSafety = 1000; // Prevent infinite loop
    let count = 0;
    while (curr <= lastTxDate && count < maxSafety) {
        timelineKeys.push(getGroupKey(curr.toISOString().split('T')[0]));
        if (currentGrowthPeriod === 'day') curr.setDate(curr.getDate() + 1);
        else if (currentGrowthPeriod === 'week') curr.setDate(curr.getDate() + 7);
        else if (currentGrowthPeriod === 'monthly') curr.setMonth(curr.getMonth() + 1);
        else if (currentGrowthPeriod === 'yearly') curr.setFullYear(curr.getFullYear() + 1);
        count++;
    }
    // Final key check
    const lastKey = getGroupKey(lastTxDate.toISOString().split('T')[0]);
    if (!timelineKeys.includes(lastKey)) timelineKeys.push(lastKey);

    // Unique keys
    const uniqueKeys = [...new Set(timelineKeys)];

    // Aggregate Data
    const dataMap = {};
    uniqueKeys.forEach(k => dataMap[k] = { in: 0, out: 0, events: [] });

    sortedTxs.forEach(t => {
        const key = getGroupKey(t.date);
        if (dataMap[key]) {
            let val = 0;
            if (currentGrowthMode === 'qty') {
                val = t.quantity || 0;
            } else {
                // VALUE MODE logic
                if (t.type === 'IN') {
                    // For PURCHASES: Value is the total cost (Price * Qty)
                    val = t.total || 0;
                } else {
                    // For SALES: To determine "Remaining Stock Value", we must subtract the COST of the item, not the selling price.
                    // We approximations this using the current product Buy Price.
                    const p = products.find(prod => prod.id === t.productId);
                    const costPrice = p ? (Number(p.buyPrice) || 0) : 0;
                    val = (t.quantity || 0) * costPrice;
                }
            }

            if (t.type === 'IN') dataMap[key].in += val;
            else dataMap[key].out += val;
        }
    });

    // Calculate Cumulative Data for Net Trajectory
    let cumulativeIn = 0;
    let cumulativeOut = 0;
    const finalLabels = [];
    const pointsIn = [];
    const pointsOut = [];
    const pointsNet = [];
    const eventAnnotations = [];

    uniqueKeys.forEach((key, index) => {
        cumulativeIn += dataMap[key].in;
        cumulativeOut += dataMap[key].out;
        const net = cumulativeIn - cumulativeOut;

        // Label formatting
        let label = key;
        if (currentGrowthPeriod === 'monthly') {
            const [y, m] = key.split('-');
            label = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(m) - 1]} ${y.slice(-2)}`;
        } else if (currentGrowthPeriod === 'week') {
            label = `Wk ${key.split('-')[2]}/${key.split('-')[1]}`;
        }

        finalLabels.push(label);
        pointsIn.push(cumulativeIn);
        pointsOut.push(cumulativeOut);
        pointsNet.push(net);

        // Capture Stock-Outs / Low Stock events in this period if possible
        // For simplicity, we'll mark points where Net drops significantly or hits 0 if we were tracking individuals
        // But since we have the full logic, let's just mark if Net is < 10% of cumulative IN as "Low Stock" area
        if (net <= 0 && cumulativeIn > 0) {
            eventAnnotations.push({
                type: 'line',
                xMin: index,
                xMax: index,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderWidth: 2,
                label: { display: true, content: 'Stock Out', backgroundColor: 'var(--danger)', font: { size: 10 } }
            });
        }
    });

    // Update UI Stats Cards
    const latestNet = pointsNet[pointsNet.length - 1] || 0;
    const firstNet = pointsNet[0] || 0;
    const growth = firstNet !== 0 ? ((latestNet - firstNet) / firstNet) * 100 : (latestNet > 0 ? 100 : 0);

    // Get cumulative totals (not just the last period)
    const cumulativeInTotal = pointsIn[pointsIn.length - 1] || 0;
    const cumulativeOutTotal = pointsOut[pointsOut.length - 1] || 0;

    // Calculate actual current inventory from products
    let actualCurrentStock = 0;
    let actualCurrentValue = 0;
    products.forEach(p => {
        const stock = Number(p.stock) || 0;
        actualCurrentStock += stock;
        actualCurrentValue += stock * (Number(p.buyPrice) || 0);
    });

    // Display based on mode
    if (currentGrowthMode === 'value') {
        document.getElementById('growth-in-val').textContent = formatCurrency(cumulativeInTotal);
        document.getElementById('growth-out-val').textContent = formatCurrency(cumulativeOutTotal);
        document.getElementById('growth-net-val').textContent = formatCurrency(actualCurrentValue);
    } else {
        document.getElementById('growth-in-val').textContent = cumulativeInTotal.toFixed(2);
        document.getElementById('growth-out-val').textContent = cumulativeOutTotal.toFixed(2);
        document.getElementById('growth-net-val').textContent = actualCurrentStock.toFixed(2);
    }


    document.getElementById('growth-period-label').textContent = finalLabels[finalLabels.length - 1];

    // Calculate individual growth percentages for each metric
    const firstIn = pointsIn[0] || 0;
    const firstOut = pointsOut[0] || 0;

    const growthIn = firstIn !== 0 ? ((cumulativeInTotal - firstIn) / firstIn) * 100 : (cumulativeInTotal > 0 ? 100 : 0);
    const growthOut = firstOut !== 0 ? ((cumulativeOutTotal - firstOut) / firstOut) * 100 : (cumulativeOutTotal > 0 ? 100 : 0);

    // Update IN percentage
    const inPct = document.getElementById('growth-in-pct');
    if (inPct) {
        if (uniqueKeys.length <= 1) {
            inPct.style.display = 'none';
        } else {
            inPct.style.display = 'inline-block';
            inPct.textContent = `${growthIn >= 0 ? '+' : ''}${growthIn.toFixed(1)}%`;
            inPct.className = `growth-label ${growthIn >= 0 ? 'positive' : 'negative'}`;
        }
    }

    // Update OUT percentage
    const outPct = document.getElementById('growth-out-pct');
    if (outPct) {
        if (uniqueKeys.length <= 1) {
            outPct.style.display = 'none';
        } else {
            outPct.style.display = 'inline-block';
            outPct.textContent = `${growthOut >= 0 ? '+' : ''}${growthOut.toFixed(1)}%`;
            outPct.className = `growth-label ${growthOut >= 0 ? 'positive' : 'negative'}`;
        }
    }

    // Update Net percentage
    const netPct = document.getElementById('growth-net-pct');
    if (uniqueKeys.length <= 1) {
        netPct.style.display = 'none';
    } else {
        netPct.style.display = 'inline-block';
        netPct.textContent = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
        netPct.className = `growth-label ${growth >= 0 ? 'positive' : 'negative'}`;
    }


    const trendBadge = document.getElementById('chart-trend-badge');
    trendBadge.style.display = 'block';
    if (growth > 5) {
        trendBadge.textContent = 'Increasing';
        trendBadge.className = 'badge ok';
    } else if (growth < -5) {
        trendBadge.textContent = 'Decreasing';
        trendBadge.className = 'badge out';
    } else {
        trendBadge.textContent = 'Stable';
        trendBadge.className = 'badge low';
    }

    document.getElementById('growth-percentage-display').textContent = uniqueKeys.length <= 1 ? '' : `Period Growth: ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;

    // Update overall trend label
    const overallTrend = document.getElementById('growth-overall-trend');
    if (overallTrend) {
        const avgGrowth = (growthIn + growthOut + growth) / 3;
        if (avgGrowth > 10) {
            overallTrend.textContent = 'Strong Growth';
            overallTrend.className = 'growth-label positive';
        } else if (avgGrowth > 0) {
            overallTrend.textContent = 'Growing';
            overallTrend.className = 'growth-label positive';
        } else if (avgGrowth > -10) {
            overallTrend.textContent = 'Stable';
            overallTrend.className = 'growth-label';
        } else {
            overallTrend.textContent = 'Declining';
            overallTrend.className = 'growth-label negative';
        }
    }

    // Chart Configuration
    growthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: finalLabels,
            datasets: [
                {
                    label: 'Sold (Cumulative OUT)',
                    data: pointsOut,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.4)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    stack: 'stack1'
                },
                {
                    label: 'Net Stock (Available)',
                    data: pointsNet,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.4)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    stack: 'stack1'
                },
                {
                    label: 'Total Purchased (IN)',
                    data: pointsIn,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Inter', weight: '600' }, usePointStyle: true }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            let val = context.parsed.y;
                            let label = context.dataset.label;
                            if (currentGrowthMode === 'value') {
                                return `${label}: ${formatCurrency(val)}`;
                            }
                            return `${label}: ${val.toFixed(2)}`;
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x'
                    }
                },
                annotation: {
                    annotations: eventAnnotations
                }
            },
            scales: {
                y: {
                    stacked: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: function (value) {
                            if (currentGrowthMode === 'value') {
                                if (value >= 1000) return '₹' + (value / 1000).toFixed(1) + 'k';
                                return '₹' + value;
                            }
                            return value;
                        }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
};


