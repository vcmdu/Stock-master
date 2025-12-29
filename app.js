// Data Models
// Data Models
let products = [];
let transactions = [];
let currentInvFilter = 'all';

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
    
    // Update notification badges when data changes (debounced for performance)
    if (window.menuManager && window.menuManager.updateNotificationsDebounced) {
        window.menuManager.updateNotificationsDebounced();
    } else if (window.menuManager) {
        window.menuManager.updateNotifications();
    }
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'checkmark-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'info') icon = 'information-circle';

    toast.innerHTML = `
        <ion-icon name="${icon}"></ion-icon>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Animated Number Counter Utility
const animateValue = (element, start, end, duration = 800) => {
    const range = end - start;
    const increment = range / (duration / 16); // 60fps
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }

        // Format based on element type
        if (element.id && element.id.includes('value')) {
            element.textContent = formatCurrency(current);
        } else {
            element.textContent = Math.round(current);
        }
    }, 16);
};

// Polished refresh with skeleton loading simulation
const refreshAll = () => {
    // Show skeleton state briefly for modern "fetching" feel
    const showSkeletons = false; // Set to true to enable skeleton loaders

    if (showSkeletons) {
        // Add skeleton classes to dashboard cards
        document.querySelectorAll('.stat-card h2').forEach(el => {
            el.classList.add('skeleton', 'skeleton-text');
        });

        setTimeout(() => {
            document.querySelectorAll('.skeleton').forEach(el => {
                el.classList.remove('skeleton', 'skeleton-text');
            });
            performRefresh();
        }, 400);
    } else {
        performRefresh();
    }
};

const performRefresh = () => {
    updateDashboard();
    renderInventory();
    renderTransactionHistory();
    updateDatalists();
    runReports();
    
    // Update notification badges after data refresh
    if (window.menuManager) {
        window.menuManager.updateNotifications();
    }
};

const removeAllData = window.removeAllData = () => {
    if (confirm('WARNING: Format DB? This will delete all products and transactions.')) {
        products = [];
        transactions = [];
        saveInfo();
    }
}

// --- ENHANCED MENU INTERACTION SYSTEM ---

class KeyboardNavigationHandler {
    constructor(menuManager) {
        this.menuManager = menuManager;
        this.currentFocusIndex = -1;
        this.menuItems = [];
        this.isActive = false;
        this.initializeKeyboardNavigation();
    }

    initializeKeyboardNavigation() {
        // Get all menu items
        this.menuItems = Array.from(document.querySelectorAll('.nav-links li'));
        
        // Make menu items focusable
        this.menuItems.forEach((item, index) => {
            item.setAttribute('tabindex', index === 0 ? '0' : '-1');
            item.setAttribute('role', 'menuitem');
        });

        // Set up keyboard event listeners
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Set up focus events for menu items
        this.menuItems.forEach((item, index) => {
            item.addEventListener('focus', () => this.handleMenuFocus(index));
            item.addEventListener('blur', () => this.handleMenuBlur());
        });
    }

    handleKeyDown(event) {
        try {
            // Only handle keyboard navigation when focused on menu or during active navigation
            const isMenuFocused = this.menuItems.some(item => item === document.activeElement);
            
            if (!isMenuFocused && !this.isActive) return;

            switch (event.key) {
                case 'Tab':
                    this.handleTabNavigation(event);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.navigateUp();
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    this.navigateDown();
                    break;
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    this.activateCurrentItem();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.exitMenuNavigation();
                    break;
            }
        } catch (error) {
            console.error('Keyboard navigation error:', error);
            // Reset keyboard navigation state on error
            this.isActive = false;
            this.currentFocusIndex = -1;
        }
    }

    handleTabNavigation(event) {
        if (event.shiftKey) {
            // Shift+Tab - move to previous menu item
            event.preventDefault();
            this.navigateUp();
        } else {
            // Tab - move to next menu item
            event.preventDefault();
            this.navigateDown();
        }
    }

    navigateUp() {
        this.isActive = true;
        if (this.currentFocusIndex <= 0) {
            this.currentFocusIndex = this.menuItems.length - 1;
        } else {
            this.currentFocusIndex--;
        }
        this.focusMenuItem(this.currentFocusIndex);
    }

    navigateDown() {
        this.isActive = true;
        if (this.currentFocusIndex >= this.menuItems.length - 1) {
            this.currentFocusIndex = 0;
        } else {
            this.currentFocusIndex++;
        }
        this.focusMenuItem(this.currentFocusIndex);
    }

    focusMenuItem(index) {
        if (index >= 0 && index < this.menuItems.length) {
            // Update tabindex
            this.menuItems.forEach((item, i) => {
                item.setAttribute('tabindex', i === index ? '0' : '-1');
            });
            
            // Focus the item
            this.menuItems[index].focus();
            this.currentFocusIndex = index;
        }
    }

    activateCurrentItem() {
        if (this.currentFocusIndex >= 0 && this.currentFocusIndex < this.menuItems.length) {
            const currentItem = this.menuItems[this.currentFocusIndex];
            currentItem.click();
        }
    }

    exitMenuNavigation() {
        this.isActive = false;
        this.currentFocusIndex = -1;
        
        // Return focus to main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.focus();
        }
    }

    handleMenuFocus(index) {
        this.currentFocusIndex = index;
        this.isActive = true;
        
        // Add visual focus indicator
        this.menuItems[index].classList.add('keyboard-focused');
    }

    handleMenuBlur() {
        // Remove visual focus indicator from all items
        this.menuItems.forEach(item => {
            item.classList.remove('keyboard-focused');
        });
    }

    // Public method to focus on a specific menu item
    focusOnMenuItem(menuId) {
        const index = this.menuItems.findIndex(item => 
            item.getAttribute('onclick')?.includes(menuId)
        );
        if (index !== -1) {
            this.focusMenuItem(index);
        }
    }
}

class NotificationBadgeSystem {
    constructor() {
        this.badges = {
            inventory: { count: 0, visible: false },
            buy: { count: 0, visible: false },
            sell: { count: 0, visible: false },
            reports: { count: 0, visible: false }
        };
        this.initializeBadges();
    }

    initializeBadges() {
        // Create badge elements for each menu item
        const menuItems = [
            { id: 'inventory', selector: '.nav-links li[onclick*="inventory"]' },
            { id: 'buy', selector: '.nav-links li[onclick*="buy"]' },
            { id: 'sell', selector: '.nav-links li[onclick*="sell"]' },
            { id: 'reports', selector: '.nav-links li[onclick*="reports"]' }
        ];

        menuItems.forEach(item => {
            const element = document.querySelector(item.selector);
            if (element && !element.querySelector('.notification-badge')) {
                const badge = document.createElement('div');
                badge.className = 'notification-badge';
                badge.style.display = 'none';
                element.appendChild(badge);
            }
        });
    }

    updateInventoryBadge() {
        const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
        const outOfStockItems = products.filter(p => p.stock === 0);
        const totalAlerts = lowStockItems.length + outOfStockItems.length;

        this.setBadge('inventory', totalAlerts);
    }

    updateTransactionBadges() {
        const today = new Date().toISOString().split('T')[0];
        const recentTransactions = transactions.filter(t => t.date === today);
        
        const recentBuys = recentTransactions.filter(t => t.type === 'IN').length;
        const recentSells = recentTransactions.filter(t => t.type === 'OUT').length;

        this.setBadge('buy', recentBuys > 0 ? recentBuys : 0);
        this.setBadge('sell', recentSells > 0 ? recentSells : 0);
    }

    updateReportsBadge() {
        // Check if there's new data since last visit
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const lastWeekStr = lastWeek.toISOString().split('T')[0];
        
        const recentTransactions = transactions.filter(t => t.date >= lastWeekStr);
        const hasNewData = recentTransactions.length > 0;

        this.setBadge('reports', hasNewData ? 1 : 0);
    }

    setBadge(menuId, count) {
        const menuElement = document.querySelector(`.nav-links li[onclick*="${menuId}"]`);
        if (!menuElement) return;

        const badge = menuElement.querySelector('.notification-badge');
        if (!badge) return;

        this.badges[menuId].count = count;
        this.badges[menuId].visible = count > 0;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count.toString();
            badge.style.display = 'flex';
            badge.classList.add('badge-animate');
            
            // Remove animation class after animation completes
            setTimeout(() => {
                badge.classList.remove('badge-animate');
            }, 300);
        } else {
            badge.style.display = 'none';
        }
    }

    clearBadge(menuId) {
        this.setBadge(menuId, 0);
    }

    updateAllBadges() {
        try {
            this.updateInventoryBadge();
            this.updateTransactionBadges();
            this.updateReportsBadge();
        } catch (error) {
            console.error('Badge update error:', error);
            // Graceful degradation - continue without badges
        }
    }

    getBadgeState() {
        return { ...this.badges };
    }
}

class StateManager {
    constructor() {
        this.storageKey = 'sm_navigation_state';
        this.defaultState = {
            currentView: 'dashboard',
            previousView: null,
            lastVisited: Date.now()
        };
    }

    saveState(state) {
        try {
            const stateToSave = {
                ...state,
                lastVisited: Date.now()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
        } catch (error) {
            console.warn('Failed to save navigation state:', error);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate the loaded state
                if (this.isValidState(parsed)) {
                    return parsed;
                }
            }
        } catch (error) {
            console.warn('Failed to load navigation state:', error);
        }
        
        // Return default state if loading fails or state is invalid
        return this.defaultState;
    }

    isValidState(state) {
        return (
            state &&
            typeof state === 'object' &&
            typeof state.currentView === 'string' &&
            state.currentView.length > 0
        );
    }

    clearState() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear navigation state:', error);
        }
    }

    getDefaultView() {
        return this.defaultState.currentView;
    }
}

class TransitionController {
    constructor() {
        this.isTransitioning = false;
        this.transitionDuration = 300;
        this.loadingIndicator = null;
    }

    createLoadingIndicator() {
        if (this.loadingIndicator) return;

        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'view-loading-indicator';
        this.loadingIndicator.innerHTML = `
            <div class="loading-spinner">
                <ion-icon name="sync" class="spinner"></ion-icon>
            </div>
        `;
        document.body.appendChild(this.loadingIndicator);
    }

    showLoadingIndicator() {
        this.createLoadingIndicator();
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.add('active');
        }
    }

    hideLoadingIndicator() {
        if (this.loadingIndicator) {
            this.loadingIndicator.classList.remove('active');
        }
    }

    async transitionViews(fromView, toView, callback) {
        if (this.isTransitioning) return false;

        try {
            this.isTransitioning = true;
            this.showLoadingIndicator();

            // Fade out current view
            if (fromView) {
                fromView.classList.add('view-fade-out');
            }

            // Short delay for fade out
            await this.delay(100);

            // Execute the view switch callback
            if (callback) callback();

            // Fade in new view
            if (toView) {
                toView.classList.add('view-fade-in');
                
                // Remove fade classes after animation
                setTimeout(() => {
                    toView.classList.remove('view-fade-in');
                    if (fromView) fromView.classList.remove('view-fade-out');
                }, this.transitionDuration);
            }

            // Hide loading indicator and reset state
            setTimeout(() => {
                this.hideLoadingIndicator();
                this.isTransitioning = false;
            }, this.transitionDuration);

            return true;
        } catch (error) {
            console.error('Transition error:', error);
            // Fallback: immediate switch without animation
            if (callback) callback();
            this.hideLoadingIndicator();
            this.isTransitioning = false;
            return false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isInTransition() {
        return this.isTransitioning;
    }
}

class MenuManager {
    constructor() {
        this.stateManager = new StateManager();
        this.transitionController = new TransitionController();
        this.notificationSystem = new NotificationBadgeSystem();
        
        // Performance optimization: debounce rapid interactions
        this.lastClickTime = 0;
        this.updateNotificationsDebounced = this.debounce(this.updateNotifications.bind(this), 250);
        
        // Load saved state or use defaults
        const savedState = this.stateManager.loadState();
        this.currentView = savedState.currentView;
        this.previousView = savedState.previousView;
        this.transitionInProgress = false;
        
        this.menuItems = this.initializeMenuItems();
        this.initializeEventListeners();
        
        // Initialize keyboard navigation after menu items are set up
        this.keyboardHandler = new KeyboardNavigationHandler(this);
        
        // Restore the saved view on page load
        this.restoreView();
        
        // Update badges initially
        this.updateNotifications();
    }

    // Debounce utility for performance optimization
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    initializeMenuItems() {
        return [
            { id: 'dashboard', element: document.querySelector('.nav-links li[onclick*="dashboard"]') },
            { id: 'inventory', element: document.querySelector('.nav-links li[onclick*="inventory"]') },
            { id: 'buy', element: document.querySelector('.nav-links li[onclick*="buy"]') },
            { id: 'sell', element: document.querySelector('.nav-links li[onclick*="sell"]') },
            { id: 'reports', element: document.querySelector('.nav-links li[onclick*="reports"]') },
            { id: 'settings', element: document.querySelector('.nav-links li[onclick*="settings"]') }
        ];
    }

    initializeEventListeners() {
        // Add enhanced click handlers to menu items
        this.menuItems.forEach(item => {
            if (item.element) {
                // Store original onclick for fallback
                const originalOnclick = item.element.getAttribute('onclick');
                
                // Replace with enhanced handler
                item.element.removeAttribute('onclick');
                item.element.addEventListener('click', (e) => {
                    this.handleMenuClick(item.id, item.element, e);
                });
            }
        });

        // Add hover effects
        this.addHoverEffects();
        
        // Make main content focusable for keyboard navigation
        const mainContent = document.querySelector('.main-content');
        if (mainContent && !mainContent.hasAttribute('tabindex')) {
            mainContent.setAttribute('tabindex', '-1');
        }
    }

    handleMenuClick(viewName, element, event) {
        // Debounce rapid clicks
        if (this.lastClickTime && Date.now() - this.lastClickTime < 100) {
            event.preventDefault();
            return;
        }
        this.lastClickTime = Date.now();

        // Prevent multiple rapid clicks
        if (this.transitionInProgress) {
            event.preventDefault();
            return;
        }

        // Provide immediate visual feedback
        this.addClickFeedback(element);

        // Check if clicking the same active item
        if (this.currentView === viewName) {
            // Idempotent behavior - no action needed
            return;
        }

        // Start transition
        this.switchView(viewName, element);
    }

    addClickFeedback(element) {
        // Add immediate visual feedback class
        element.classList.add('menu-clicking');
        
        // Remove feedback after short delay
        setTimeout(() => {
            element.classList.remove('menu-clicking');
        }, 150);
    }

    updateActiveState(activeElement) {
        // Remove active class from all menu items
        this.menuItems.forEach(item => {
            if (item.element) {
                item.element.classList.remove('active');
            }
        });

        // Add active class to the selected element
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }

    addHoverEffects() {
        this.menuItems.forEach(item => {
            if (item.element) {
                // Enhanced hover effects
                item.element.addEventListener('mouseenter', (e) => {
                    if (!item.element.classList.contains('active') && !this.transitionInProgress) {
                        item.element.classList.add('menu-hover');
                    }
                });

                item.element.addEventListener('mouseleave', (e) => {
                    item.element.classList.remove('menu-hover');
                });
            }
        });
    }

    async switchView(viewName, element) {
        try {
            // Set transition state
            this.transitionInProgress = true;
            this.previousView = this.currentView;
            this.currentView = viewName;

            // Clear notification badge for visited menu item
            this.clearMenuBadge(viewName);

            // Save state to localStorage
            this.saveCurrentState();

            // Update active state immediately for visual consistency
            this.updateActiveState(element);

            // Add loading state to all menu items during transition
            this.setMenuLoadingState(true);

            // Get current and target views
            const fromView = document.getElementById(`view-${this.previousView}`);
            const toView = document.getElementById(`view-${viewName}`);

            // Use TransitionController for smooth transitions
            const success = await this.transitionController.transitionViews(fromView, toView, () => {
                // Call original switchView logic during transition
                originalSwitchView(viewName, element);
            });

            if (!success) {
                console.warn('Transition failed, using fallback');
                // Fallback to direct switch
                originalSwitchView(viewName, element);
            }

            // Reset loading state
            this.setMenuLoadingState(false);
            this.transitionInProgress = false;
        } catch (error) {
            console.error('Menu switch error:', error);
            // Emergency fallback
            this.handleSwitchError(viewName, element);
        }
    }

    handleSwitchError(viewName, element) {
        try {
            // Reset states
            this.transitionInProgress = false;
            this.setMenuLoadingState(false);
            
            // Try direct switch as fallback
            originalSwitchView(viewName, element);
            
            // Update internal state
            this.previousView = this.currentView;
            this.currentView = viewName;
            this.updateActiveState(element);
        } catch (fallbackError) {
            console.error('Fallback switch also failed:', fallbackError);
            // Last resort: reload page
            if (confirm('Menu system encountered an error. Reload the page?')) {
                window.location.reload();
            }
        }
    }

    clearMenuBadge(viewName) {
        // Clear badge when user visits the menu item
        if (this.notificationSystem.badges[viewName]) {
            this.notificationSystem.clearBadge(viewName);
        }
    }

    updateNotifications() {
        try {
            this.notificationSystem.updateAllBadges();
        } catch (error) {
            console.error('Notification update error:', error);
            // Graceful degradation - notifications are not critical
        }
    }

    getNotificationState() {
        try {
            return this.notificationSystem.getBadgeState();
        } catch (error) {
            console.error('Error getting notification state:', error);
            return {};
        }
    }

    saveCurrentState() {
        const state = {
            currentView: this.currentView,
            previousView: this.previousView
        };
        this.stateManager.saveState(state);
    }

    restoreView() {
        // Validate current view before restoring
        if (!this.isValidView(this.currentView)) {
            this.handleStateCorruption();
            return;
        }

        // Find the menu item for the current view and activate it
        const menuItem = this.menuItems.find(item => item.id === this.currentView);
        if (menuItem && menuItem.element) {
            // Set active state without triggering transition
            this.updateActiveState(menuItem.element);
            
            // Call original switchView to set up the view properly
            originalSwitchView(this.currentView, menuItem.element);
        } else {
            // Fallback to dashboard if current view is invalid
            this.handleStateCorruption();
        }
    }

    setMenuLoadingState(isLoading) {
        this.menuItems.forEach(item => {
            if (item.element) {
                if (isLoading) {
                    item.element.classList.add('menu-loading');
                } else {
                    item.element.classList.remove('menu-loading');
                }
            }
        });
    }

    getCurrentView() {
        return this.currentView;
    }

    getPreviousView() {
        return this.previousView;
    }

    isTransitionInProgress() {
        return this.transitionInProgress;
    }

    getMenuState() {
        return {
            currentView: this.currentView,
            previousView: this.previousView,
            transitionInProgress: this.transitionInProgress
        };
    }

    // Method to programmatically switch views (for external use)
    navigateTo(viewName) {
        const menuItem = this.menuItems.find(item => item.id === viewName);
        if (menuItem && menuItem.element) {
            this.handleMenuClick(viewName, menuItem.element, { preventDefault: () => {} });
        }
    }

    // Handle corrupted or invalid state
    handleStateCorruption() {
        console.warn('Navigation state corrupted, falling back to dashboard');
        this.stateManager.clearState();
        this.currentView = this.stateManager.getDefaultView();
        this.previousView = null;
        this.restoreView();
    }

    // Check if a view exists and is valid
    isValidView(viewName) {
        const validViews = ['dashboard', 'inventory', 'buy', 'sell', 'reports', 'settings'];
        return validViews.includes(viewName) && document.getElementById(`view-${viewName}`);
    }

    // Method to clean up resources (for memory optimization)
    destroy() {
        try {
            // Remove event listeners
            this.menuItems.forEach(item => {
                if (item.element) {
                    item.element.removeEventListener('click', this.handleMenuClick);
                    item.element.removeEventListener('mouseenter', this.addHoverEffects);
                    item.element.removeEventListener('mouseleave', this.addHoverEffects);
                }
            });

            // Clean up keyboard handler
            if (this.keyboardHandler) {
                document.removeEventListener('keydown', this.keyboardHandler.handleKeyDown);
            }

            // Clear debounced functions
            if (this.updateNotificationsDebounced) {
                clearTimeout(this.updateNotificationsDebounced);
            }
        } catch (error) {
            console.error('Error during MenuManager cleanup:', error);
        }
    }
}

// Make menuManager globally accessible when initialized
// window.menuManager will be set in the init() function

// Enhanced switchView function that extends the original
function enhancedSwitchView(viewName, element) {
    // Call original switchView logic with enhancements
    originalSwitchView(viewName, element);
}

// Store original switchView function
function originalSwitchView(viewName, element) {
    if (element || viewName !== 'inventory') currentInvFilter = 'all';
    
    // Active state is now managed by MenuManager, but keep fallback for direct calls
    if (!element) {
        const link = document.querySelector(`.nav-links li[onclick*="'${viewName}'"]`);
        if (link && menuManager) {
            menuManager.updateActiveState(link);
        }
    }

    // Title
    document.getElementById('page-title').textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // View Visibility
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    // Reset Forms and UI States
    const buyForm = document.getElementById('buy-form');
    if (buyForm) {
        buyForm.reset();
        document.getElementById('buy-date').valueAsDate = new Date();
        document.getElementById('buy-info-group').style.display = 'none';
        // Reset stock display
    }

    const sellForm = document.getElementById('sell-form');
    if (sellForm) {
        sellForm.reset();
        document.getElementById('sell-date').valueAsDate = new Date();
        document.getElementById('sell-info-group').style.display = 'none';
    }

    // Refresh data if needed
    refreshAll();

    // Close sidebar when switching views for better UX
    document.body.classList.remove('sidebar-active');

    // Sell View Specific Init
    if (viewName === 'sell') {
        const sellNameInput = document.getElementById('sell-product-name');
        if (sellNameInput) populateNames(sellNameInput, true);
        // Clear dependent dropdowns
        const catInput = document.getElementById('sell-category');
        const sizeInput = document.getElementById('sell-size');
        const kgInput = document.getElementById('sell-kg');
        if (catInput) catInput.innerHTML = '<option value="">Select Brand...</option>';
        if (sizeInput) sizeInput.innerHTML = '<option value="">Select Size...</option>';
        if (kgInput) kgInput.innerHTML = '<option value="">Select KG...</option>';
    }

    // Buy View Specific Init
    if (viewName === 'buy') {
        const buyNames = document.getElementById('buy-names-list');
        if (buyNames) populateNames(buyNames);
        document.getElementById('buy-cats-list').innerHTML = '';
        document.getElementById('buy-sizes-list').innerHTML = '';
        document.getElementById('buy-kgs-list').innerHTML = '';
    }
}

// Update window.switchView to use enhanced version
window.switchView = (viewName, element) => {
    enhancedSwitchView(viewName, element);
};

const populateNames = (listEl, onlyInStock = false) => {
    // Filter source products if needed
    const source = onlyInStock ? products.filter(p => p.stock > 0) : products;
    // Show all defined product names from filtered source
    const availableNames = [...new Set(source.map(p => p.name))].sort();
    if (listEl.tagName === 'SELECT') {
        const currentVal = listEl.value;
        listEl.innerHTML = '<option value="">Select Product...</option>' +
            availableNames.map(n => `<option value="${n}" ${n === currentVal ? 'selected' : ''}>${n}</option>`).join('');
    } else {
        listEl.innerHTML = availableNames.map(n => `<option value="${n}">`).join('');
    }
};

window.toggleSidebar = () => {
    document.body.classList.toggle('sidebar-active');
};

// Handle window resize - sidebar behavior is now consistent across all screen sizes
window.addEventListener('resize', () => {
    // Sidebar visibility is controlled by user via toggle button only
});

// --- DASHBOARD ---
const updateDashboard = () => {
    // 1. Total Asset Value (Stock * BuyPrice)
    const totalAsset = products.reduce((acc, p) => acc + (p.stock * p.buyPrice), 0);
    document.getElementById('dash-total-value').textContent = formatCurrency(totalAsset);

    // 2. Low Stock Count (Items > 0 but <= minStock)
    const lowStockItems = products.filter(p => p.stock > 0 && p.stock <= p.minStock);
    document.getElementById('dash-low-stock').textContent = lowStockItems.length;

    // 3. Total Products
    document.getElementById('dash-total-products').textContent = products.length;

    // 3b. Out of Stock Count
    const outOfStockItems = products.filter(p => p.stock === 0);
    document.getElementById('dash-out-of-stock').textContent = outOfStockItems.length;

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

window.showInventory = () => {
    currentInvFilter = 'all';
    if (window.menuManager) {
        window.menuManager.navigateTo('inventory');
    } else {
        switchView('inventory');
    }
};

window.showOutOfStock = () => {
    currentInvFilter = 'outOfStock';
    if (window.menuManager) {
        window.menuManager.navigateTo('inventory');
    } else {
        switchView('inventory');
    }
};

window.showLowStock = () => {
    currentInvFilter = 'lowStock';
    if (window.menuManager) {
        window.menuManager.navigateTo('inventory');
    } else {
        switchView('inventory');
    }
};


let dashboardChart = null;
let currentChartPeriod = 'month'; // day, week, month, year

window.updateChartPeriod = (period) => {
    currentChartPeriod = period;

    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        }
    });

    // Re-render chart with new period
    renderDashboardChart();
};

const renderDashboardChart = () => {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('dashboard-line-chart');
    if (!ctx) return;

    // Calculate actual inventory value over time based on transactions and selected period
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const labels = [];
    const chartData = [];

    // Determine period configuration
    let periods, dateFormatter;

    switch (currentChartPeriod) {
        case 'day':
            periods = 7; // Last 7 days
            dateFormatter = (date) => `${date.getDate()} ${monthNames[date.getMonth()].substring(0, 3)}`;
            break;
        case 'week':
            periods = 8; // Last 8 weeks
            dateFormatter = (date) => `W${Math.ceil(date.getDate() / 7)}`;
            break;
        case 'month':
            periods = 7; // Last 7 months
            dateFormatter = (date) => monthNames[date.getMonth()];
            break;
        case 'year':
            periods = 5; // Last 5 years
            dateFormatter = (date) => date.getFullYear().toString();
            break;
        default:
            periods = 7;
            dateFormatter = (date) => monthNames[date.getMonth()];
    }

    for (let i = periods - 1; i >= 0; i--) {
        let date, endDate;

        switch (currentChartPeriod) {
            case 'day':
                date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
                break;
            case 'week':
                date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7));
                endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6, 23, 59, 59);
                break;
            case 'month':
                date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'year':
                date = new Date(now.getFullYear() - i, 0, 1);
                endDate = new Date(date.getFullYear(), 11, 31, 23, 59, 59);
                break;
        }

        labels.push(dateFormatter(date));

        const endDateStr = endDate.toISOString().split('T')[0];
        const txUpToDate = transactions.filter(t => t.date <= endDateStr);

        const stockAtDate = {};
        products.forEach(p => { stockAtDate[p.id] = 0; });

        txUpToDate.forEach(t => {
            if (stockAtDate[t.productId] !== undefined) {
                stockAtDate[t.productId] += (t.type === 'IN' ? t.quantity : -t.quantity);
            }
        });

        let totalValue = 0;
        products.forEach(p => {
            totalValue += (stockAtDate[p.id] || 0) * p.buyPrice;
        });

        chartData.push(totalValue);
    }

    const data = chartData;

    if (dashboardChart) {
        dashboardChart.destroy();
    }

    // Create gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inventory Value',
                data: data,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 5,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 7,
                pointHoverBackgroundColor: '#6366f1',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 12
                        }
                    },
                    border: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 12
                        },
                        callback: function (value) {
                            return (value / 1000).toFixed(0) + 'K';
                        }
                    },
                    border: {
                        display: false
                    }
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

    let filtered = products.filter(p => p.name.toLowerCase().includes(search) || (p.category || '').toLowerCase().includes(search));

    if (currentInvFilter === 'outOfStock') {
        filtered = filtered.filter(p => p.stock === 0);
        document.getElementById('page-title').textContent = 'Inventory (Out of Stock)';
    } else if (currentInvFilter === 'lowStock') {
        filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.minStock);
        document.getElementById('page-title').textContent = 'Inventory (Low Stock)';
    }

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">No products found.</td></tr>';
        return;
    }

    filtered.forEach((p, index) => {
        const status = p.stock === 0 ? '<span class="badge out">Out of Stock</span>' :
            p.stock <= p.minStock ? '<span class="badge low">Low Stock</span>' :
                '<span class="badge ok">In Stock</span>';

        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
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
    document.getElementById('prod-name').value = ''; // Clear Name
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
    showToast(`${name} has been saved.`);
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
    // No longer needed
};

window.updateDatalists = () => {
    const nameList = document.getElementById('prod-names-list');
    /* We can remove separate lists for cat/size/kg if we want a single "Search Product" experience like a dropdown.
       But the form has separate fields.
       To make it "easy to select", sticking to Name selection is best.
    */
    const catList = document.getElementById('prod-cats-list');
    const sizeList = document.getElementById('prod-sizes-list');
    const kgList = document.getElementById('prod-kgs-list');

    if (!nameList) return;

    // For names, maybe include extra info to disambiguate?
    // Or just unique names. Unique names is standard for the Name field.
    const names = [...new Set(products.map(p => p.name))].sort();

    // Actually, for "Sell Stock", users typically want to see "Product Name - Brand - Size" in one go.
    // But the current UI separates them.
    // Let's keep the existing logic but ensure it refreshes correctly.

    nameList.innerHTML = names.map(n => `<option value="${n}">`).join('');

    // Secondary lists
    if (catList) {
        const cats = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
        catList.innerHTML = cats.map(c => `<option value="${c}">`).join('');
    }
    if (sizeList) {
        const sizes = [...new Set(products.map(p => p.size).filter(Boolean))].sort();
        sizeList.innerHTML = sizes.map(s => `<option value="${s}">`).join('');
    }
    if (kgList) {
        const kgs = [...new Set(products.map(p => p.kg).filter(Boolean))].sort();
        kgList.innerHTML = kgs.map(k => `<option value="${k}">`).join('');
    }
};

// Product Input Handler
window.handleProductInput = (type) => {
    const prefix = type === 'IN' ? 'buy' : 'sell';

    const nameInput = document.getElementById(`${prefix}-product-name`);
    const catInput = document.getElementById(`${prefix}-category`);
    const sizeInput = document.getElementById(`${prefix}-size`);
    const kgInput = document.getElementById(`${prefix}-kg`);

    const name = nameInput.value;
    const cat = catInput.value;
    const size = sizeInput.value;
    const kg = kgInput.value;

    const infoGroup = document.getElementById(`${prefix}-info-group`);
    const stockDisplay = document.getElementById(`${prefix}-stock-display`);
    const priceInput = document.getElementById(`${prefix}-price`);
    const form = document.getElementById(`${prefix}-form`);

    // --- CASCADING DROPDOWN LOGIC (Shared for Buy & Sell) ---
    const listPrefix = type === 'IN' ? 'buy' : 'sell';
    const namesList = document.getElementById(`${listPrefix}-names-list`);
    const isSelect = nameInput.tagName === 'SELECT';

    // Helper to update options
    const updateOptions = (el, options, placeholder) => {
        if (!el) return;
        if (el.tagName === 'SELECT') {
            const currentVal = el.value;
            el.innerHTML = `<option value="">${placeholder}</option>` +
                options.map(opt => `<option value="${opt}" ${opt === currentVal ? 'selected' : ''}>${opt}</option>`).join('');
        } else {
            const datalist = document.getElementById(`${listPrefix}-${el.id.split('-').pop()}s-list`);
            if (datalist) {
                datalist.innerHTML = options.map(opt => `<option value="${opt}">`).join('');
            }
        }
    };

    // Filter Logic
    let available = products;
    // For Sell, filter for stock. For Buy, use all.
    if (type === 'OUT') {
        available = products.filter(p => p.stock > 0);
    } else {
        // For Buy, start with all unique products to guide input, but don't restrict.
        // We use all products as base to find existing suggestions.
        available = products;
    }

    // Filter by Name
    if (name) {
        available = available.filter(p => p.name.toLowerCase() === name.toLowerCase());
    }

    // Update Brand List based on Name selection
    const cats = [...new Set(available.map(p => p.category).filter(Boolean))].sort();
    updateOptions(catInput, cats, 'Select Brand...');

    // Filter by Brand
    if (cat) {
        available = available.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
    }

    // Update Size List based on Name + Brand
    const sizes = [...new Set(available.map(p => p.size).filter(Boolean))].sort();
    updateOptions(sizeInput, sizes, 'Select Size...');

    // Filter by Size
    if (size) {
        available = available.filter(p => (p.size || '').toLowerCase() === size.toLowerCase());
    }

    // Update KG List based on Name + Brand + Size
    const kgs = [...new Set(available.map(p => p.kg).filter(Boolean))].sort();
    updateOptions(kgInput, kgs, 'Select KG...');

    // --- MATCHING LOGIC ---
    let match = null;

    if (name) {
        const potentialMatches = products.filter(p => p.name.toLowerCase() === name.toLowerCase());

        if (potentialMatches.length > 0) {
            // Check if we have narrowed down to exactly one product via cascading filters
            let narrowed = potentialMatches;
            if (cat) narrowed = narrowed.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
            if (size) narrowed = narrowed.filter(p => (p.size || '').toLowerCase() === size.toLowerCase());
            if (kg) narrowed = narrowed.filter(p => (p.kg || '').toLowerCase() === kg.toLowerCase());

            if (narrowed.length === 1) {
                // If exactly one match remains, we found it.
                // But only consider it "Matched" if the user has filled enough info, OR if it's the only option.
                // For "one by one" feel, we might want to wait until the user has selected everything?
                // But showing stock early is nice.
                // Let's assume if narrowed.length === 1, we show the stock for that one item.
                match = narrowed[0];
            }
        }
    }

    if (match) {
        infoGroup.style.display = 'block';
        stockDisplay.textContent = match.stock;
        stockDisplay.style.color = match.stock <= match.minStock ? 'var(--danger)' : 'var(--text-primary)';

        if (!priceInput.value || priceInput.value == 0) {
            priceInput.value = type === 'IN' ? (match.buyPrice || 0) : (match.sellPrice || 0);
        }

        form.dataset.matchedId = match.id;
    } else {
        delete form.dataset.matchedId;
        infoGroup.style.display = 'none';
    }
    // Don't clear inputs immediately to allow typing new products
};

window.toggleQuickAdd = () => { };

window.handleTransaction = (e, type) => {
    e.preventDefault();
    const prefix = type === 'IN' ? 'buy' : 'sell';

    const name = document.getElementById(`${prefix}-product-name`).value;
    const cat = document.getElementById(`${prefix}-category`).value;
    const size = document.getElementById(`${prefix}-size`).value;
    const kg = document.getElementById(`${prefix}-kg`).value;

    let prodId = document.getElementById(`${prefix}-form`).dataset.matchedId;
    let product;

    if (!prodId) {
        if (type === 'OUT') {
            showToast('Product not found! You can only sell existing products.', 'error');
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

        // Double check matching if dataset id is stale? 
        // Logic relies on handleProductInput updating dataset.matchedId
    }

    if (!product) return;

    const date = document.getElementById(`${prefix}-date`).value;
    const qty = parseInt(document.getElementById(`${prefix}-qty`).value);
    const price = parseFloat(document.getElementById(`${prefix}-price`).value);
    const notes = document.getElementById(`${prefix}-notes`).value;

    if (type === 'OUT' && product.stock < qty) {
        showToast(`Insufficient Stock! You only have ${product.stock}.`, 'error');
        return;
    }

    // Modern feedback: Button loading state
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<ion-icon name="sync" class="spinner"></ion-icon> Processing...';

    setTimeout(() => {
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
        showToast(type === 'IN' ? 'Stock Added Successfully!' : 'Sale Recorded Successfully!');

        // Refresh UI
        renderInventory();
        renderTransactionHistory();
        updateDashboard();
        updateDatalists();

        // Reset Form and state
        e.target.reset();
        document.getElementById(`${prefix}-date`).valueAsDate = new Date();
        handleProductInput(type);

        // Restore button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }, 600);
};

const renderTransactionHistory = () => {
    const renderList = (elementId, typeFilter) => {
        const list = document.getElementById(elementId);
        if (!list) return;

        list.innerHTML = '';
        let filtered = [...transactions];
        if (typeFilter) {
            filtered = filtered.filter(t => t.type === typeFilter);
        }

        filtered = filtered.reverse().slice(0, 20); // Last 20

        filtered.forEach(t => {
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

    renderList('buy-history-list', 'IN');
    renderList('sell-history-list', 'OUT');
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
    filtered.forEach((t, index) => {
        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${t.date}</td>
                <td><span class="badge ${t.type === 'IN' ? 'in' : 'out'}">${t.type}</span></td>
                <td>${t.productName} ${[t.productCategory, t.productSize, t.productKG].filter(Boolean).join(' • ')}</td>
                <td>${t.quantity}</td>
                <td>${formatCurrency(t.total)}</td>
                <td style="color:var(--text-secondary)">${t.notes}</td>
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
        head: [['S.No', 'Date', 'Type', 'Product', 'Qty', 'Total', 'Notes']],
        body: filtered.map((t, index) => [
            index + 1,
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
            if (data.section === 'body' && data.column.index === 2) {
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
// Init
const buyDate = document.getElementById('buy-date');
if (buyDate) buyDate.valueAsDate = new Date();
const sellDate = document.getElementById('sell-date');
if (sellDate) sellDate.valueAsDate = new Date();

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
        head: [['Name', 'Brand', 'Size', 'KG', 'Stock', 'Min Level', 'Buy Price', 'Total Value', 'Status']],
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
    try {
        // Ensure sidebar is hidden by default on ALL screen sizes
        document.body.classList.remove('sidebar-active');
        
        initTransactionForm();
        refreshAll();
        
        // Initialize menu system after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                try {
                    if (!window.menuManager) {
                        window.menuManager = new MenuManager();
                    }
                } catch (error) {
                    console.error('Failed to initialize menu system:', error);
                    // Continue without enhanced menu features
                }
            });
        } else {
            try {
                if (!window.menuManager) {
                    window.menuManager = new MenuManager();
                }
            } catch (error) {
                console.error('Failed to initialize menu system:', error);
                // Continue without enhanced menu features
            }
        }
    } catch (error) {
        console.error('Application initialization error:', error);
    }
};

init();
