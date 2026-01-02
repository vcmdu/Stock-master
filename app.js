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
        'settings': 'Settings'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'StockMaster';

    // View Visibility
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    // Reset Forms
    resetForms(viewName);

    // Specific Init
    if (viewName === 'sell') initSellForm();
    if (viewName === 'buy') initBuyForm();
    if (viewName === 'inventory') renderInventory();
    if (viewName === 'dashboard') updateDashboard();

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
        stockDisplay.textContent = match.stock;
        stockDisplay.style.color = match.stock <= match.minStock ? 'var(--danger)' : 'var(--text-main)';

        if (!priceInput.value || priceInput.value == 0) {
            priceInput.value = type === 'IN' ? match.buyPrice : match.sellPrice;
        }
        form.dataset.matchedId = match.id;
    } else {
        infoGroup.style.display = 'none';
        delete form.dataset.matchedId;
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
};

const initSellForm = () => {
    document.getElementById('sell-date').valueAsDate = new Date();
    updateDatalists();
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
            product = {
                id: Date.now(),
                name, brand, category: cat, size, kg,
                stock: 0, minStock: 5, buyPrice: 0, sellPrice: 0
            };
            products.push(product);
            prodId = product.id;
        }
    } else {
        product = products.find(p => p.id == prodId);
        if (!product) {
            showToast('Internal Error: Product ID match failed.', 'error');
            return;
        }
    }

    const date = document.getElementById(`${prefix}-date`).value;
    const qty = parseInt(document.getElementById(`${prefix}-qty`).value);
    const price = parseFloat(document.getElementById(`${prefix}-price`).value);
    const notes = document.getElementById(`${prefix}-notes`).value;

    if (isNaN(qty) || qty <= 0) {
        showToast('Invalid Quantity', 'error');
        return;
    }

    if (type === 'OUT' && product.stock < qty) {
        showToast(`Insufficient Stock! Available: ${product.stock}`, 'error');
        return;
    }

    // Process
    const total = qty * price;
    transactions.push({
        id: Date.now(),
        date, type, productId: product.id,
        productName: product.name, productBrand: product.brand, productCategory: product.category, productSize: product.size, productKG: product.kg,
        quantity: qty, price, total, notes
    });

    if (type === 'IN') {
        product.stock += qty;
        product.buyPrice = price;
    } else {
        product.stock -= qty;
    }

    saveInfo();
    showToast(type === 'IN' ? 'Purchase Recorded' : 'Sale Recorded');

    e.target.reset();
    document.getElementById(`${prefix}-date`).valueAsDate = new Date();
    delete document.getElementById(`${prefix}-form`).dataset.matchedId;
    document.getElementById(`${prefix}-info-group`).style.display = 'none';

    handleProductInput(type);
    if (type === 'IN') initBuyForm();
    if (type === 'OUT') initSellForm();
};

// --- CHARTING & DASHBOARD ---
let mainChart = null;
let pieChart = null;

window.updateChartPeriod = (period) => {
    currentChartPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.period === period);
    });
    renderDashboardChart();
};

window.renderDashboardChart = () => {
    const ctxMain = document.getElementById('dashboard-line-chart');
    const ctxPie = document.getElementById('dashboard-pie-chart');
    if (!ctxMain || !ctxPie) return;

    // --- ACCURATE HISTORY RECONSTRUCTION (Forward Replay) ---
    // 1. Sort all transactions chronologically
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Identify all dates with activity + Today
    const dates = new Set(sortedTx.map(t => t.date));
    const todayStr = new Date().toISOString().split('T')[0];
    dates.add(todayStr); // Ensure today is included
    const sortedDates = [...dates].sort();

    // 3. Replay State Day by Day
    const prePeriodState = {};
    const periodStart = new Date();
    const lastDate = new Date(todayStr);

    if (currentChartPeriod === 'week') periodStart.setDate(periodStart.getDate() - 6);
    if (currentChartPeriod === 'month') periodStart.setDate(periodStart.getDate() - 30);
    if (currentChartPeriod === 'year') periodStart.setFullYear(periodStart.getFullYear() - 1);

    // Generate Dense Date Range for the Period (Daily)
    const denseDates = [];
    const d = new Date(periodStart);
    while (d <= lastDate) {
        denseDates.push(new Date(d));
        d.setDate(d.getDate() + 1);
    }

    // 1. Calculate Stock State AT START of period. (Replay all tx BEFORE periodStart).
    sortedTx.filter(t => new Date(t.date) < periodStart).forEach(t => {
        if (!prePeriodState[t.productId]) prePeriodState[t.productId] = 0;
        if (t.type === 'IN') prePeriodState[t.productId] += t.quantity;
        else prePeriodState[t.productId] -= t.quantity;
    });

    // 2. Walk through denseDates. Apply daily tx.
    const periodTx = sortedTx.filter(t => new Date(t.date) >= periodStart);
    let pTxIdx = 0;

    // Helper to calc value
    const calcVal = (state) => {
        return products.reduce((sum, p) => sum + ((state[p.id] || 0) * p.buyPrice), 0);
    };

    const chartLabels = [];
    const chartData = [];

    denseDates.forEach((dateObj, idx) => {
        const dateStr = dateObj.toISOString().split('T')[0];

        // Apply transactions for this date
        while (pTxIdx < periodTx.length && periodTx[pTxIdx].date === dateStr) {
            const t = periodTx[pTxIdx];
            if (!prePeriodState[t.productId]) prePeriodState[t.productId] = 0;
            if (t.type === 'IN') prePeriodState[t.productId] += t.quantity;
            else prePeriodState[t.productId] -= t.quantity;
            pTxIdx++;
        }

        const shouldAdd =
            (currentChartPeriod === 'week') || // Every day
            (currentChartPeriod === 'month') || // Every day
            (currentChartPeriod === 'year' && dateObj.getDate() === 1); // 1st of month

        // Always add Today
        const isToday = idx === denseDates.length - 1;

        if (shouldAdd || isToday) {
            let label = dateObj.toLocaleDateString('en-IN', {
                weekday: currentChartPeriod === 'week' ? 'short' : undefined,
                day: 'numeric',
                month: 'short',
                year: currentChartPeriod === 'year' ? '2-digit' : undefined
            });

            // Avoid duplicate labels for Year view if Today is also 1st
            if (chartLabels.length > 0 && chartLabels[chartLabels.length - 1] === label) return;

            chartLabels.push(label);
            chartData.push(calcVal(prePeriodState));
        }
    });

    // --- SCROLLING LOGIC REMOVED in favor of Zoom/Pan ---
    // The previous scroll container logic is replaced by the chartjs-plugin-zoom
    const chartBody = document.querySelector('.chart-body');
    if (chartBody) chartBody.style.width = '100%';

    // --- RENDER MAIN CHART (BAR) ---
    if (mainChart) mainChart.destroy();

    mainChart = new Chart(ctxMain, {
        type: 'bar', // Changed to Bar
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Asset Value',
                data: chartData,
                borderColor: '#4f46e5',
                backgroundColor: '#4f46e5', // Solid Blue
                borderRadius: 4,
                barPercentage: 0.6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => formatCurrency(ctx.raw) },
                    backgroundColor: '#1e293b',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        threshold: 5 // Default threshold
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    limits: {
                        x: { min: 'original', max: 'original' },
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                    ticks: { color: '#94a3b8', callback: (val) => val >= 1000 ? (val / 1000) + 'k' : val },
                    beginAtZero: true
                }
            }
        }
    });

    // --- PIE CHART (Doughnut) - PRODUCT DISTRIBUTION ---
    const productData = {};
    products.forEach(p => {
        if (p.stock > 0) {
            // Group by Product Name instead of Category
            const key = p.name;
            productData[key] = (productData[key] || 0) + (p.stock * p.buyPrice);
        }
    });

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: Object.keys(productData),
            datasets: [{
                data: Object.values(productData),
                backgroundColor: [
                    '#6366f1', '#10b981', '#f59e0b', '#ef4444',
                    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
                    '#f97316', '#06b6d4', '#84cc16', '#a855f7'
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false // Hide legend to save space
                }
            }
        }
    });
};

const updateDashboard = () => {
    // Stats
    const totalAsset = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
    document.getElementById('dash-total-value').textContent = formatCurrency(totalAsset);
    document.getElementById('dash-total-products').textContent = products.length;
    document.getElementById('dash-low-stock').textContent = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length;
    document.getElementById('dash-out-of-stock').textContent = products.filter(p => p.stock === 0).length;

    renderDashboardChart();

    // Recent Lists
    const recents = document.getElementById('recent-activity-list');
    recents.innerHTML = transactions.slice().reverse().slice(0, 5).map(t => `
        <div class="transaction-item list-item">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px">
                <strong style="color:var(--text-main)">${t.productName}</strong>
                <span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span>
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; justify-content:space-between;">
                <span>${t.date}</span>
                <span style="font-weight:600">${formatCurrency(t.total)}</span>
            </div>
        </div>
    `).join('');

    const lowStockList = document.getElementById('low-stock-list');
    const lowStock = products.filter(p => p.stock <= p.minStock);
    if (lowStock.length === 0) {
        lowStockList.innerHTML = '<div style="color:var(--text-muted); padding:16px; text-align:center">All stocks good</div>';
    } else {
        lowStockList.innerHTML = lowStock.slice(0, 5).map(p => `
            <div class="list-item" style="border-left: 3px solid ${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'}">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${p.name}</strong>
                    <strong style="color:${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.stock}</strong>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary)">Min: ${p.minStock}</div>
            </div>
        `).join('');
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
        filtered = filtered.filter(p => p.stock <= p.minStock && p.stock > 0);
    } else if (currentInvFilter === 'out') {
        filtered = filtered.filter(p => p.stock === 0);
    }
    // 'all' does no additional filtering

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding:20px; color:var(--text-muted)">
            No products found ${currentInvFilter !== 'all' ? `(${currentInvFilter} stock)` : ''}
        </td></tr>`;
        return;
    }

    filtered.forEach((p, i) => {
        const status = p.stock === 0 ? '<span class="badge out">Out</span>' :
            (p.stock <= p.minStock ? '<span class="badge low">Low</span>' : '<span class="badge ok">OK</span>');

        tbody.innerHTML += `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${p.name}</strong></td>
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
};

window.saveProduct = (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const brand = document.getElementById('prod-brand').value;
    const cat = document.getElementById('prod-category').value;
    const size = document.getElementById('prod-size').value;
    const kg = document.getElementById('prod-kg').value;
    const min = parseInt(document.getElementById('prod-min').value);
    const buy = parseFloat(document.getElementById('prod-buy').value);
    const sell = parseFloat(document.getElementById('prod-sell').value);
    const initialStock = parseInt(document.getElementById('prod-stock').value || 0);

    if (id) {
        const p = products.find(x => x.id == id);
        if (p) {
            Object.assign(p, { name, brand, category: cat, size, kg, minStock: min, buyPrice: buy, sellPrice: sell });
        }
    } else {
        const newP = {
            id: Date.now(),
            name, brand, category: cat, size, kg, minStock: min, buyPrice: buy, sellPrice: sell,
            stock: initialStock || 0
        };
        products.push(newP);
        if (initialStock > 0) {
            transactions.push({
                id: Date.now() + 1, date: new Date().toISOString().split('T')[0],
                type: 'IN', productId: newP.id, productName: name, quantity: initialStock, price: buy, total: initialStock * buy, notes: 'Opening Balance'
            });
        }
    }
    saveInfo();
    closeProductModal();
    showToast('Product Saved');
    renderInventory();
};

window.editProduct = (id) => {
    const p = products.find(x => x.id == id);
    if (!p) return;
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-brand').value = p.brand || '';
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-size').value = p.size || '';
    document.getElementById('prod-kg').value = p.kg || '';
    document.getElementById('prod-min').value = p.minStock;
    document.getElementById('prod-buy').value = p.buyPrice;
    document.getElementById('prod-sell').value = p.sellPrice;
    document.getElementById('initial-stock-group').style.display = 'none';
    document.getElementById('product-modal').classList.add('active');
};

window.deleteProduct = (id) => {
    if (confirm('Delete this product?')) {
        products = products.filter(p => p.id !== id);
        saveInfo();
        renderInventory();
    }
};

window.openProductModal = () => {
    document.getElementById('product-modal').classList.add('active');
    document.getElementById('prod-id').value = '';
    document.querySelector('#product-modal form').reset();
    document.getElementById('initial-stock-group').style.display = 'block';
};
window.closeProductModal = () => document.getElementById('product-modal').classList.remove('active');
window.toggleSidebar = () => document.body.classList.toggle('sidebar-active');

const init = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'dashboard';
    // Initial load: don't push state, just replace
    history.replaceState({ view }, document.title, `?view=${view}`);
    switchView(view, null, false);
};

window.addEventListener('DOMContentLoaded', init);
