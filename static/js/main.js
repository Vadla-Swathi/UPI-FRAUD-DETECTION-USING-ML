/**
 * Enhanced Main.js - Core functionality for UPI Fraud Detection App
 */

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('[INIT] Application started');
    console.log('Bootstrap loaded:', typeof bootstrap !== 'undefined'); // Debug log
    
    // CHANGE 1: Add fallback for Chart.js loading
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded from CDN, attempting to load local fallback');
        const script = document.createElement('script');
        script.src = '/static/js/chart.min.js';
        script.onload = () => {
            console.log('Local Chart.js loaded successfully');
            initFeatureImportanceChart();
        };
        script.onerror = () => {
            console.error('Failed to load local Chart.js');
        };
        document.head.appendChild(script);
    } else {
        initFeatureImportanceChart();
    }
    
    // Initialize components
    initializeTooltips();
    setupPasswordStrengthMeter();
    setupTransactionTableFilters();
    
    // Admin-specific functionality
    if (document.querySelector('.admin-dashboard')) {
        setupAdminFeatures();
    }
});

// Feature importance chart with retry logic
function initFeatureImportanceChart() {
    const chartElement = document.getElementById('featureImportanceChart');
    if (!chartElement) {
        console.error('Feature importance chart element not found');
        return;
    }
    
    console.log('Raw feature data:', chartElement.dataset.features);
    const retryInterval = setInterval(() => {
        if (typeof Chart !== 'undefined') {
            console.log('Chart.js loaded, rendering feature importance chart');
            clearInterval(retryInterval);
            renderFeatureImportanceChart(
                'featureImportanceChart',
                parseFeatureData(chartElement.dataset.features)
            );
        } else {
            console.warn('Chart.js not loaded yet, retrying...');
        }
    }, 500);
}

function parseFeatureData(rawData) {
    try {
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Feature data parse error:', error);
        showDataTableFallback('featureImportanceChart', 'featureImportanceTable');
        return {};
    }
}

function showDataTableFallback(chartId, tableId) {
    document.getElementById(chartId).style.display = 'none';
    const table = document.getElementById(tableId);
    if (table) table.style.display = 'block';
}

// Enhanced feature importance chart rendering
function renderFeatureImportanceChart(chartElementId, featureData) {
    const canvas = document.getElementById(chartElementId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const labels = Object.keys(featureData).map(key => key.replace(/_/g, ' '));
    const values = Object.values(featureData);
    
    if (!values.length || values.every(v => v === 0)) {
        console.warn('No valid feature importance data available');
        showDataTableFallback(chartElementId, 'featureImportanceTable');
        return;
    }
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Feature Importance',
                data: values,
                backgroundColor: getDynamicColors(values),
                borderColor: getDynamicColors(values, 1),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: context => `Impact: ${(context.raw * 100).toFixed(1)}%`
                    }
                }
            },
            scales: {
                x: { 
                    beginAtZero: true,
                    max: Math.max(...values) * 1.1 || 1,
                    title: { display: true, text: 'Importance Score' }
                },
                y: {
                    title: { display: true, text: 'Feature' }
                }
            }
        }
    });
}

function getDynamicColors(values, alpha = 0.7) {
    return values.map(value => {
        const red = Math.min(255, Math.round(value * 400));
        const green = Math.min(255, Math.round((1 - value) * 300));
        return `rgba(${red}, ${green}, 100, ${alpha})`;
    });
}

function initializeTooltips() {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap not loaded, cannot initialize tooltips');
        return;
    }
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

// Admin-specific features
function setupAdminFeatures() {
    setupUserManagement();
    setupFlaggedTransactions();
    initChartAutoRefresh();
}

function setupUserManagement() {
    document.querySelectorAll('.user-row').forEach(row => {
        row.addEventListener('click', function(e) {
            if (!e.target.closest('.btn')) {
                window.location.href = `/admin/users/${this.dataset.userId}`;
            }
        });
    });
}

function setupFlaggedTransactions() {
    document.querySelectorAll('.unflag-btn').forEach(btn => {
        btn.addEventListener('click', handleTransactionAction);
    });
    
    document.querySelectorAll('form button.btn-outline-danger').forEach(btn => {
        btn.addEventListener('click', handleTransactionAction);
    });
}

async function handleTransactionAction(e) {
    e.preventDefault();
    const form = e.target.closest('form');
    if (!form) return;
    
    try {
        const response = await fetch(form.action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(new FormData(form)))
        });
        
        const result = await response.json();
        showToast(result.message, result.success ? 'success' : 'danger');
        
        if (result.success) {
            setTimeout(() => location.reload(), 1500);
        }
    } catch (error) {
        showToast('Action failed', 'danger');
        console.error('Transaction action error:', error);
    }
}

function calculatePasswordStrength(password) {
    if (!password) return { score: 0, message: 'No password', class: 'muted' };
    
    const strengthTests = [
        { regex: /.{8,}/, score: 1 },       // Minimum length
        { regex: /.{12,}/, score: 1 },      // Strong length
        { regex: /[a-z]/, score: 1 },       // Lowercase
        { regex: /[A-Z]/, score: 1 },       // Uppercase
        { regex: /[0-9]/, score: 1 },       // Numbers
        { regex: /[^a-zA-Z0-9]/, score: 1 } // Special chars
    ];
    
    const score = strengthTests.reduce((total, test) => 
        test.regex.test(password) ? total + test.score : total, 0);
    
    const strengthLevels = [
        { message: 'Very weak', class: 'danger' },
        { message: 'Weak', class: 'warning' },
        { message: 'Fair', class: 'info' },
        { message: 'Good', class: 'primary' },
        { message: 'Strong', class: 'success' }
    ];
    
    return {
        score: Math.min(score, strengthLevels.length - 1),
        ...strengthLevels[Math.min(score, strengthLevels.length - 1)]
    };
}

function updateStrengthMeter(strength) {
    const meter = document.getElementById('password-strength-meter');
    const text = document.getElementById('password-strength-text');
    
    if (meter) {
        meter.value = strength.score;
        meter.className = `strength-meter strength-${strength.score}`;
    }
    
    if (text) {
        text.textContent = strength.message;
        text.className = `text-${strength.class}`;
    }
}

// Enhanced transaction filtering
function setupTransactionTableFilters() {
    const table = document.getElementById('transactionHistoryTable');
    if (!table) return;
    
    const filters = [
        document.getElementById('transaction-search'),
        document.getElementById('risk-filter'),
        document.getElementById('date-filter')
    ].filter(Boolean);
    
    filters.forEach(filter => {
        filter.addEventListener('input', debounce(filterTransactionTable, 300));
    });
    
    // Initial filter
    filterTransactionTable();
}

function filterTransactionTable() {
    const table = document.getElementById('transactionHistoryTable');
    if (!table) return;
    
    const searchTerm = (document.getElementById('transaction-search')?.value || '').toLowerCase();
    const riskLevel = document.getElementById('risk-filter')?.value || 'all';
    const dateRange = document.getElementById('date-filter')?.value || 'all';
    
    table.querySelectorAll('tbody tr').forEach(row => {
        const matchesSearch = searchTerm === '' || 
            row.textContent.toLowerCase().includes(searchTerm);
        
        const matchesRisk = riskLevel === 'all' || 
            row.querySelector('.badge')?.textContent.toLowerCase() === riskLevel.toLowerCase();
        
        const matchesDate = checkDateMatch(row, dateRange);
        
        row.style.display = matchesSearch && matchesRisk && matchesDate ? '' : 'none';
    });
}

function checkDateMatch(row, dateRange) {
    if (dateRange === 'all') return true;
    
    const dateCell = row.querySelector('[data-timestamp]');
    if (!dateCell) return true;
    
    const transactionDate = new Date(dateCell.getAttribute('data-timestamp'));
    const today = new Date();
    
    switch (dateRange) {
        case 'today': 
            return transactionDate.toDateString() === today.toDateString();
        case 'week':
            return transactionDate >= new Date(today - 7 * 24 * 60 * 60 * 1000);
        case 'month':
            return transactionDate >= new Date(today - 30 * 24 * 60 * 60 * 1000);
        default:
            return true;
    }
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

// Initialize chart auto-refresh
function initChartAutoRefresh() {
    if (document.getElementById('transactionChart')) {
        setInterval(fetchChartData, 30000);
    }
}

async function fetchChartData() {
    try {
        const response = await fetch('/admin/dashboard-data');
        const data = await response.json();
        
        if (window.updateCharts && typeof window.updateCharts === 'function') {
            window.updateCharts(data);
        }
    } catch (error) {
        console.error('Chart data fetch error:', error);
    }
}
