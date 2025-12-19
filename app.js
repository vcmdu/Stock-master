// Data Models
// Data Models
let products = [];
let transactions = [];

try {
    products = JSON.parse(localStorage.getItem('sm_products')) || [];
    if (!Array.isArray(products)) products = [];
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

/* 
Product: { id, name, sku, stock, minStock, buyPrice, sellPrice }
Transaction: { id, date, type(IN/OUT), productId, productName, quantity, price, total, notes }
*/

// --- CORE FUNCTIONS ---

const saveInfo = () => {
    localStorage.setItem('sm_products', JSON.stringify(products));
    localStorage.setItem('sm_transactions', JSON.stringify(transactions));
    refreshAll();
};

const refreshAll = () => {
    updateDashboard();
    renderInventory();
    renderTransactionHistory();
    updateDatalists(); // Replaces populateProductSelect logic
    runReports();
};

const removeAllData = window.removeAllData = () => {
    if (confirm('WARNING: Format DB? This will delete all products and transactions.')) {
        products = [];
        transactions = [];
        saveInfo();
    }
}

// --- VIEW NAVIGATION ---
// --- VIEW NAVIGATION ---
window.switchView = (viewName, element) => {
    // Nav Active State
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if (element) {
        element.classList.add('active');
    } else {
        // Fallback or initialization: find the link that matches the viewName
        // This is a bit specific to the current HTML structure
        const link = document.querySelector(`.nav-links li[onclick*="'${viewName}'"]`);
        if (link) link.classList.add('active');
    }

    // Title
    document.getElementById('page-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // View Visibility
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    // Reset Forms and UI States
    const transForm = document.getElementById('transaction-form');
    if (transForm) {
        transForm.reset();
        // Explicitly reset type to IN (Buy) and set current date
        const typeIn = transForm.querySelector('input[name="type"][value="IN"]');
        if (typeIn) typeIn.checked = true;
        document.getElementById('trans-date').valueAsDate = new Date();

        // Reset Form and UI States
        const infoGroup = document.getElementById('trans-info-group');
        if (infoGroup) infoGroup.style.display = 'none';
    }

    // Refresh data if needed
    refreshAll();

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.body.classList.remove('sidebar-active');
    }
}

window.toggleSidebar = () => {
    document.body.classList.toggle('sidebar-active');
};

// --- DASHBOARD ---
const updateDashboard = () => {
    // 1. Total Asset Value (Stock * BuyPrice)
    const totalAsset = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
    document.getElementById('dash-total-value').textContent = formatCurrency(totalAsset);

    // 2. Low Stock Count
    const lowStockItems = products.filter(p => p.stock <= p.minStock);
    document.getElementById('dash-low-stock').textContent = lowStockItems.length;

    // 3. Total Products
    document.getElementById('dash-total-products').textContent = products.length;

    // 4. Low Stock List
    const lowStockList = document.getElementById('low-stock-list');
    lowStockList.innerHTML = lowStockItems.length ? '' : '<div class="list-item">All items well stocked!</div>';

    lowStockItems.forEach(p => {
        lowStockList.innerHTML += `
            <div class="list-item alert">
                <div>
                    <strong>${p.name}</strong>
                    <div class="text-secondary" style="font-size:0.8rem">
                        ${[p.category, p.size, p.kg].filter(Boolean).join(' • ') || 'No variation'}
                    </div>
                </div>
                <div class="badge low">${p.stock} left</div>
            </div>
        `;
    });

    // 5. Recent Activity
    const recentDiv = document.getElementById('recent-activity-list');
    const recentTx = [...transactions].reverse().slice(0, 5);
    recentDiv.innerHTML = recentTx.length ? '' : '<div class="list-item">No recent activity.</div>';

    recentTx.forEach(t => {
        recentDiv.innerHTML += `
            <div class="transaction-item">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <div>
                        <strong>${t.productName}</strong>
                        ${t.productCategory || t.productSize || t.productKG ? `<span style="font-size:0.8rem; color:var(--text-secondary); margin-left:5px;">(${[t.productCategory, t.productSize, t.productKG].filter(Boolean).join(' • ')})</span>` : ''}
                    </div>
                    <span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; color:var(--text-secondary);">
                    <span>${t.quantity} @ ${formatCurrency(t.price)}</span>
                    <span>${t.date}</span>
                </div>
            </div>
        `;
    });

    renderDashboardChart();
};

let dashboardChart = null;

const renderDashboardChart = () => {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('dashboard-pie-chart');
    if (!ctx) return;

    // Prepare Data: Distribution by Total Value (Stock * BuyPrice)
    // Sort by value and take top 5, group rest as "Others"
    const dataPoints = products.map(p => ({
        label: p.name,
        value: p.stock * p.buyPrice
    })).sort((a, b) => b.value - a.value);

    let labels = [];
    let data = [];
    let colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

    if (dataPoints.length > 5) {
        const top5 = dataPoints.slice(0, 5);
        const others = dataPoints.slice(5).reduce((acc, curr) => acc + curr.value, 0);

        labels = top5.map(d => d.label);
        data = top5.map(d => d.value);

        labels.push('Others');
        data.push(others);
    } else {
        labels = dataPoints.map(d => d.label);
        data = dataPoints.map(d => d.value);
    }

    if (dashboardChart) {
        dashboardChart.destroy();
    }

    dashboardChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#94a3b8' }
                }
            }
        }
    });
};

// --- INVENTORY ---
const renderInventory = window.renderInventory = () => {
    const search = document.getElementById('inv-search').value.toLowerCase();
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(search) || (p.category || '').toLowerCase().includes(search));

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No products found.</td></tr>';
        return;
    }

    filtered.forEach(p => {
        const status = p.stock === 0 ? '<span class="badge out">Out of Stock</span>' :
            p.stock <= p.minStock ? '<span class="badge low">Low Stock</span>' :
                '<span class="badge ok">In Stock</span>';

        tbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td><span style="font-size:0.9rem; color:var(--text-secondary)">${p.category || '-'}</span></td>
                <td><span style="font-size:0.9rem; color:var(--text-secondary)">${p.size || '-'}</span></td>
                <td><span style="font-size:0.9rem; color:var(--text-secondary)">${p.kg || '-'}</span></td>
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

const openProductModal = window.openProductModal = () => {
    document.getElementById('product-modal').classList.add('active');
    document.getElementById('product-modal-title').textContent = 'New Product';
    document.getElementById('prod-id').value = ''; // Clear ID
    document.getElementById('prod-category').value = ''; // Clear Category
    document.getElementById('prod-size').value = ''; // Clear Size
    document.getElementById('prod-kg').value = ''; // Clear KG
    document.getElementById('initial-stock-group').style.display = 'grid'; // Enable for new
};
window.closeProductModal = () => document.getElementById('product-modal').classList.remove('active');

// Check if updating
// Check if updating
window.saveProduct = (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const category = document.getElementById('prod-category').value;
    const size = document.getElementById('prod-size').value;
    const kg = document.getElementById('prod-kg').value;
    const sku = document.getElementById('prod-sku').value;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const min = parseInt(document.getElementById('prod-min').value) || 0;
    const buy = parseFloat(document.getElementById('prod-buy').value) || 0;
    const sell = parseFloat(document.getElementById('prod-sell').value) || 0;

    if (id) {
        // Update existing
        const existing = products.find(p => p.id == id);
        if (existing) {
            existing.name = name;
            existing.category = category;
            existing.size = size;
            existing.kg = kg;
            existing.minStock = min;
            existing.buyPrice = buy;
            existing.sellPrice = sell;
            // Stock is not editable here directly to avoid sync issues, use Transactions for stock adjustments
            // Exception: If they really want to change stock manually, we could allow it but it's risky logic-wise.
            // For now, let's keep stock readonly in edit mode or ignore it.
            // But wait, the form has it. Let's ignore stock update for edit mode to preserve transaction history integrity,
            // or we would need to add a "Correction" transaction.
            // Let's assume Edit is for master data (Price/Name), not Qty.
        }
    } else {
        // New Product
        const newProd = {
            id: Date.now(),
            name, category, size, kg, stock, minStock: min, buyPrice: buy, sellPrice: sell
        };

        products.push(newProd);

        // If initial stock > 0, record a "Opening Balance" transaction
        if (stock > 0) {
            transactions.push({
                id: Date.now() + 1,
                date: new Date().toISOString().split('T')[0],
                type: 'IN',
                productId: newProd.id,
                productName: newProd.name,
                quantity: stock,
                price: buy,
                total: stock * buy,
                notes: 'Initial Stock Opening Balance'
            });
        }
    }

    saveInfo();
    closeProductModal();
    e.target.reset();
};

window.editProduct = (id) => {
    const p = products.find(p => p.id === id);
    if (!p) return;

    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-category').value = p.category || '';
    document.getElementById('prod-size').value = p.size || '';
    document.getElementById('prod-kg').value = p.kg || '';
    document.getElementById('prod-min').value = p.minStock;
    document.getElementById('prod-buy').value = p.buyPrice;
    document.getElementById('prod-sell').value = p.sellPrice;

    // Hide stock for edit to prevent direct manipulation bypassing transactions
    document.getElementById('initial-stock-group').style.display = 'none';
    document.getElementById('product-modal-title').textContent = 'Edit Product';

    document.getElementById('product-modal').classList.add('active');
};

window.deleteProduct = (id) => {
    if (confirm('Delete Product? History will remain but product will disappear from inventory.')) {
        products = products.filter(p => p.id !== id);
        saveInfo();
    }
};

// --- TRANSACTIONS ---
const initTransactionForm = () => {
    // List for Type change to flip price
    document.querySelectorAll('input[name="type"]').forEach(r => {
        r.onchange = () => {
            handleProductInput();
        };
    });
};

window.updateDatalists = () => {
    const nameList = document.getElementById('prod-names-list');
    const catList = document.getElementById('prod-cats-list');
    const sizeList = document.getElementById('prod-sizes-list');
    const kgList = document.getElementById('prod-kgs-list');

    if (!nameList || !catList || !sizeList || !kgList) return;

    const names = [...new Set(products.map(p => p.name))].sort();
    const cats = [...new Set(products.map(p => p.category))].sort();
    const sizes = [...new Set(products.map(p => p.size))].sort();
    const kgs = [...new Set(products.map(p => p.kg))].sort();

    nameList.innerHTML = names.map(n => `<option value="${n}">`).join('');
    catList.innerHTML = cats.map(c => `<option value="${c}">`).join('');
    sizeList.innerHTML = sizes.map(s => `<option value="${s}">`).join('');
    kgList.innerHTML = kgs.map(k => `<option value="${k}">`).join('');
};

window.handleProductInput = () => {
    const name = document.getElementById('trans-product-name').value.trim();
    const cat = document.getElementById('trans-category').value.trim();
    const size = document.getElementById('trans-size').value.trim();
    const kg = document.getElementById('trans-kg').value.trim();
    const typeElem = document.querySelector('input[name="type"]:checked');
    const type = typeElem ? typeElem.value : 'IN';

    const infoGroup = document.getElementById('trans-info-group');
    const stockDisplay = document.getElementById('trans-stock-display');
    const priceInput = document.getElementById('trans-price');
    const form = document.getElementById('transaction-form');

    // Filter products by typed values (case-insensitive and trimmed)
    const match = products.find(p =>
        p.name.toLowerCase() === name.toLowerCase() &&
        (p.category || '').toLowerCase() === cat.toLowerCase() &&
        (p.size || '').toLowerCase() === size.toLowerCase() &&
        (p.kg || '').toLowerCase() === kg.toLowerCase()
    );

    if (match) {
        infoGroup.style.display = 'block';
        stockDisplay.textContent = match.stock;
        stockDisplay.style.color = match.stock <= match.minStock ? 'var(--danger)' : 'var(--text-primary)';

        // Auto-fill price
        priceInput.value = type === 'IN' ? (match.buyPrice || 0) : (match.sellPrice || 0);

        // Store matched ID
        form.dataset.matchedId = match.id;
    } else {
        delete form.dataset.matchedId;
        infoGroup.style.display = 'none';
    }
};

window.toggleQuickAdd = () => { };

window.handleTransaction = (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked').value;
    const name = document.getElementById('trans-product-name').value;
    const cat = document.getElementById('trans-category').value;
    const size = document.getElementById('trans-size').value;
    const kg = document.getElementById('trans-kg').value;

    let prodId = document.getElementById('transaction-form').dataset.matchedId;
    let product;

    if (!prodId) {
        if (type === 'OUT') {
            alert('Product not found! You can only sell existing products.');
            return;
        }

        // Create New Product automatically
        product = {
            id: Date.now(),
            name, category: cat, size, kg, stock: 0, minStock: 5, buyPrice: 0, sellPrice: 0
        };
        products.push(product);
        prodId = product.id;
    } else {
        prodId = parseInt(prodId);
        product = products.find(p => p.id === prodId);
    }

    if (!product) return;

    const date = document.getElementById('trans-date').value;
    const qty = parseInt(document.getElementById('trans-qty').value);
    const price = parseFloat(document.getElementById('trans-price').value);
    const notes = document.getElementById('trans-notes').value;

    if (type === 'OUT' && product.stock < qty) {
        alert(`Insufficient Stock! You only have ${product.stock}.`);
        return;
    }

    // Record Transaction
    const total = qty * price;
    transactions.push({
        id: Date.now(),
        date, type, productId: prodId, productName: product.name, productCategory: product.category, productSize: product.size, productKG: product.kg, quantity: qty, price, total, notes
    });

    // Update Stock Logic
    if (type === 'IN') {
        product.stock += qty;
        product.buyPrice = price; // Update latest buy price
    } else {
        product.stock -= qty;
    }

    saveInfo();
    alert('Transaction Recorded!');

    // Refresh UI
    renderInventory();
    renderTransactionHistory();
    updateDashboard();
    updateDatalists(); // Refresh datalists with new product/variation

    // Reset Form and state
    e.target.reset();
    document.getElementById('trans-date').valueAsDate = new Date();
    handleProductInput(); // Reset UI (hide SKU input, info group, etc.)
};

const renderTransactionHistory = () => {
    const list = document.getElementById('transaction-history-list');
    list.innerHTML = '';
    const slice = [...transactions].reverse().slice(0, 20); // Last 20

    slice.forEach(t => {
        list.innerHTML += `
            <div class="transaction-item">
                 <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <div>
                        <strong>${t.productName}</strong>
                        ${t.productCategory || t.productSize || t.productKG ? `<span style="font-size:0.8rem; color:var(--text-secondary); margin-left:5px;">(${[t.productCategory, t.productSize, t.productKG].filter(Boolean).join(' • ')})</span>` : ''}
                    </div>
                    <div>
                        <span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span>
                        <button class="icon-btn small" onclick="editTransaction(${t.id})" style="margin-left:5px;"><ion-icon name="create-outline"></ion-icon></button>
                    </div>
                </div>
                <div style="font-size:0.9rem; display:flex; justify-content:space-between; color:var(--text-secondary)">
                    <span>${t.quantity} x ${formatCurrency(t.price)}</span>
                    <strong>${formatCurrency(t.total)}</strong>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">
                    ${t.date} ${t.notes ? '• ' + t.notes : ''}
                </div>
            </div>
        `;
    });
};

window.editTransaction = (id) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;

    document.getElementById('edit-trans-id').value = t.id;
    document.getElementById('edit-trans-date').value = t.date;
    document.getElementById('edit-trans-product').value = t.productName; // Read only
    document.getElementById('edit-trans-qty').value = t.quantity;
    document.getElementById('edit-trans-price').value = t.price;
    document.getElementById('edit-trans-notes').value = t.notes || '';

    if (t.type === 'IN') document.getElementById('edit-type-in').checked = true;
    else document.getElementById('edit-type-out').checked = true;

    document.getElementById('transaction-edit-modal').classList.add('active');
};

window.updateTransaction = (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-trans-id').value);
    const date = document.getElementById('edit-trans-date').value;
    const type = document.querySelector('input[name="edit-type"]:checked').value;
    const qty = parseInt(document.getElementById('edit-trans-qty').value);
    const price = parseFloat(document.getElementById('edit-trans-price').value);
    const notes = document.getElementById('edit-trans-notes').value;

    const tIndex = transactions.findIndex(x => x.id === id);
    if (tIndex === -1) return;
    const oldT = transactions[tIndex];

    const product = products.find(p => p.id === oldT.productId);
    if (!product) {
        alert('Associated product not found. Cannot update stock.');
        return;
    }

    // Revert old transaction effect
    if (oldT.type === 'IN') product.stock -= oldT.quantity;
    else product.stock += oldT.quantity;

    // Apply new transaction effect
    if (type === 'IN') product.stock += qty;
    else {
        if (product.stock < qty) {
            alert(`Insufficient Stock! Resulting stock would be negative.`);
            // Rollback revert?
            // Actually let's just re-apply oldT and stop.
            if (oldT.type === 'IN') product.stock += oldT.quantity;
            else product.stock -= oldT.quantity;
            return;
        }
        product.stock -= qty;
    }

    // Update Transaction
    transactions[tIndex] = {
        ...oldT,
        date, type, quantity: qty, price, total: qty * price, notes
    };

    saveInfo();
    document.getElementById('transaction-edit-modal').classList.remove('active');
};

// --- REPORTS ---
window.runReports = () => {
    const fromDate = document.getElementById('report-date-from').value;
    const toDate = document.getElementById('report-date-to').value;

    let filtered = transactions;

    if (fromDate) {
        filtered = filtered.filter(t => t.date >= fromDate);
    }

    if (toDate) {
        filtered = filtered.filter(t => t.date <= toDate);
    }

    // Update headers to show filtered status
    const title = document.querySelector('#view-reports .card-header h3');
    if (title) {
        if (fromDate || toDate) title.textContent = `Transaction Report Log (${fromDate || 'Start'} to ${toDate || 'End'})`;
        else title.textContent = 'Transaction Report Log (All Time)';
    }

    // Calculate Financials
    // Revenue = Total of OUT types
    const sales = filtered.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.total, 0);

    // Cost of Goods Sold (COGS) Approximation = Total of IN types (Simple Cash Flow)
    // For more advanced: we would track specific batch cost. For now, cash flow model:
    const purchases = filtered.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.total, 0);

    // For profit: This is strictly "Cash Profit" (Sales - Purchases) in this period.
    // A better metric for this user might be "Gross Profit on Sales"
    // Let's compute Gross Profit on Sales: (Sell Price - Buy Price of that item) * Qty
    // We need to look up the product's current buy price to estimate cost if specific cost wasn't tracked.
    // However, our transaction log has 'price' at the moment of happening.
    // A simple Cash Flow Profit (Cash In - Cash Out) is safest for this simple model unless they want accrual.
    // Let's stick to Cash Flow: Sales - Purchases.

    const net = sales - purchases;

    document.getElementById('report-sales').textContent = formatCurrency(sales);
    document.getElementById('report-cost').textContent = formatCurrency(purchases);

    const profitEl = document.getElementById('report-profit');
    profitEl.textContent = formatCurrency(net);
    profitEl.className = net >= 0 ? 'text-success' : 'text-danger';

    // Table
    const tbody = document.getElementById('report-table-body');
    tbody.innerHTML = '';
    filtered.forEach(t => {
        tbody.innerHTML += `
            <tr>
                <td>${t.date}</td>
                <td><span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span></td>
                <td>${t.productName} ${[t.productCategory, t.productSize, t.productKG].filter(Boolean).join(' • ')}</td>
                <td>${t.quantity}</td>
                <td>${formatCurrency(t.total)}</td>
                <td style="color:var(--text-secondary)">${t.notes}</td>
                <td>
                     <button class="icon-btn" onclick="editTransaction(${t.id})"><ion-icon name="create-outline"></ion-icon></button>
                </td>
            </tr>
        `;

    });

};




window.downloadReportPDF = () => {
    const fromDate = document.getElementById('report-date-from').value;
    const toDate = document.getElementById('report-date-to').value;
    let filtered = transactions;
    if (fromDate) filtered = filtered.filter(t => t.date >= fromDate);
    if (toDate) filtered = filtered.filter(t => t.date <= toDate);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(); // Portrait is fine for transactions usually, or Landscape if many cols. Let's stick to Portrait or Auto.
    const margin = 14;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 44, 52);
    doc.text('Transaction Report', margin, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Period: ${fromDate || 'Start'} to ${toDate || 'Present'}`, margin, 26);

    // Summary Card
    const sales = filtered.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.total, 0);
    const purchases = filtered.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.total, 0);
    const net = sales - purchases;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 32, 200 - margin, 32);

    doc.setFontSize(11);
    doc.setTextColor(40, 44, 52);
    doc.text(`Total Sales: ${formatCurrencyPDF(sales)}`, margin, 40);
    doc.text(`Total Purchases: ${formatCurrencyPDF(purchases)}`, margin + 60, 40);

    doc.setTextColor(net >= 0 ? 16 : 239, net >= 0 ? 185 : 68, net >= 0 ? 129 : 68); // Green or Red
    doc.text(`Net Profit: ${formatCurrencyPDF(net)}`, margin + 120, 40);

    // Table
    const tableData = filtered.map(t => [
        t.date,
        t.type,
        t.productName,
        t.quantity,
        formatCurrencyPDF(t.total),
        t.notes
    ]);

    doc.autoTable({
        startY: 48,
        head: [['Date', 'Type', 'Product', 'Qty', 'Total', 'Notes']],
        body: filtered.map(t => [
            t.date,
            t.type,
            `${t.productName}${t.productCategory || t.productSize || t.productKG ? ` (${[t.productCategory, t.productSize, t.productKG].filter(Boolean).join(' • ')})` : ''}`,
            t.quantity,
            formatCurrencyPDF(t.total),
            t.notes
        ]),
        theme: 'striped', // Striped is nice for long lists
        headStyles: { fillColor: [66, 133, 244] }, // Blue header
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 1) {
                // Type Column Color
                if (data.cell.raw === 'IN') data.cell.styles.textColor = [16, 185, 129];
                else data.cell.styles.textColor = [239, 68, 68];
            }
        }
    });

    doc.save(`Report_${fromDate}_${toDate}.pdf`);
};

window.clearReportFilters = () => {
    document.getElementById('report-date-from').value = '';
    document.getElementById('report-date-to').value = '';
    runReports();
};

// Init
document.getElementById('trans-date').valueAsDate = new Date();

// --- BACKUP & RESTORE ---
window.downloadBackupJSON = () => {
    const data = {
        exportedAt: new Date().toISOString(),
        products,
        transactions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `StockMaster_Data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.downloadBackupPDF = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for better table fit
    const pageWidth = doc.internal.pageSize.getWidth();

    // Stats
    const totalAsset = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 44, 52);
    doc.text('System Summary', 14, 20);

    // Blue indicator Line
    doc.setDrawColor(66, 133, 244); // Blue
    doc.setLineWidth(1.5);
    doc.line(14, 25, 14, 45); // Vertical accent lines for cards? Image shows vertical bars?
    // Actually image has blue vertical bars for "Total Items" and "Total Inventory Value" containers. 
    // Let's draw 2 "cards" in the summary row.

    // Summary Row 1
    // Card 1: Total Items & Low Stock
    doc.setDrawColor(0, 123, 255);
    doc.setLineWidth(1);
    doc.line(14, 30, 14, 42); // Blue Bar left

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('Total Items: ' + products.length, 18, 34);

    doc.text('Low Stock Items: ' + lowStockCount, 18, 40);

    // Card 2: Total Value & Suppliers (Mock)
    doc.line(pageWidth / 2, 30, pageWidth / 2, 42); // Blue Bar middle

    doc.text('Total Inventory Value: ' + formatCurrencyPDF(totalAsset), (pageWidth / 2) + 4, 34);
    doc.text('Active Suppliers: 0', (pageWidth / 2) + 4, 40); // Mock

    // Section Header
    doc.setFontSize(16);
    doc.setTextColor(40, 44, 52);
    doc.text('Inventory Details', 14, 55);

    // Inventory Table
    doc.autoTable({
        startY: 60,
        head: [['Name', 'Category', 'Size', 'KG', 'Stock', 'Min Level', 'Buy Price', 'Total Value', 'Status']],
        body: products.map(p => {
            const status = p.stock === 0 ? 'Out of Stock' : (p.stock <= p.minStock ? 'Low Stock' : 'In Stock');
            return [
                p.name,
                p.category || '-',
                p.size || '-',
                p.kg || '-',
                p.stock,
                p.minStock,
                formatCurrencyPDF(p.buyPrice),
                formatCurrencyPDF(p.stock * p.buyPrice),
                status
            ];
        }),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [240, 242, 245], textColor: [40, 44, 52], fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' }, // Name
            8: { fontStyle: 'bold' }  // Status
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 8) {
                const val = data.cell.raw;
                if (val === 'In Stock') data.cell.styles.textColor = [16, 185, 129]; // Green
                else if (val === 'Low Stock') data.cell.styles.textColor = [245, 158, 11]; // Orange
                else data.cell.styles.textColor = [239, 68, 68]; // Red
            }
        }
    });

    doc.save(`StockMaster_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

window.restoreData = (input) => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.products || !data.transactions) {
                throw new Error('Invalid format');
            }

            if (confirm(`Restore backup from ${data.exportedAt || 'Unknown Date'}? This will replace your current data.`)) {
                products = data.products;
                transactions = data.transactions;
                saveInfo(); // Saves to localStorage and refreshes UI
                alert('Data Restored Successfully!');
            }
        } catch (err) {
            alert('Error: Invalid Backup File. ' + err.message);
        }
        input.value = ''; // Reset input
    };
    reader.readAsText(file);
};

// Helper
const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
// PDF Helper: jsPDF doesn't support Unicode '₹' by default, use 'Rs.'
const formatCurrencyPDF = (val) => `Rs. ${parseFloat(val).toFixed(2)}`;

const init = () => {
    initTransactionForm();
    refreshAll();
};

init();
