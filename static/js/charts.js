/**
 * Chart.js - Handles dashboard chart rendering with real-time updates
 */

// Debugging function
function debugData(label, data, fallback) {
    console.groupCollapsed(`[DEBUG] ${label}`);
    console.log('Data:', data);
    
    if (typeof data === 'undefined' || data === null) {
        console.error(`${label} is undefined or null. Using fallback.`);
        data = fallback;
    }
    
    console.groupEnd();
    return data;
}

// Chart instances storage
const chartInstances = {};

// Initialize Monthly Transaction Chart (Line Chart)
function initializeMonthlyTransactionChart() {
    const ctx = document.getElementById('transactionChart');
    if (!ctx) {
        console.error('Monthly transaction chart canvas not found');
        return;
    }
    
    const rawData = debugData(
        'Monthly transaction data',
        ctx.dataset.transactions,
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
    
    let monthlyData = parseChartData(rawData, Array(12).fill(0));
    
    if (!Array.isArray(monthlyData) || monthlyData.length !== 12) {
        console.warn('Monthly transaction data is invalid. Using fallback.');
        monthlyData = Array(12).fill(0);
    }
    
    monthlyData = monthlyData.map(val => Number(val) || 0);
    
    chartInstances.transactionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Transactions',
                data: monthlyData,
                backgroundColor: 'rgba(106, 100, 241, 0.2)', // --primary-color
                borderColor: 'rgba(106, 100, 241, 1)',
                borderWidth: 2,
                tension: 0.3,
                pointBackgroundColor: 'rgba(106, 100, 241, 1)',
                pointBorderColor: '#fff',
                pointRadius: 4,
                fill: true
            }]
        },
        options: getChartOptions('Monthly Transaction Activity', 'Transactions')
    });
}

// Initialize Risk Distribution Pie Chart (Admin Dashboard)
function initializeRiskDistributionChart() {
    const ctx = document.getElementById('riskDistributionChart');
    if (!ctx) {
        console.error('Risk distribution chart canvas not found');
        return;
    }

    const low = parseInt(ctx.dataset.low) || 0;
    const medium = parseInt(ctx.dataset.medium) || 0;
    const high = parseInt(ctx.dataset.high) || 0;
    const total = parseInt(ctx.dataset.total) || 0;
    const flagged = parseInt(ctx.dataset.flagged) || 0;

    console.log('Risk Distribution Data:', { low, medium, high, total, flagged });

    const chartData = [low, medium, high];
    if (chartData.every(val => val === 0)) {
        console.warn('All risk distribution values are 0. Adding a minimal value to render the chart.');
        chartData[0] = 1;
    }

    if (chartInstances.riskDistributionChart) {
        chartInstances.riskDistributionChart.destroy();
    }

    chartInstances.riskDistributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: chartData,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',  // legend-color-low
                    'rgba(255, 206, 86, 0.7)',  // legend-color-medium
                    'rgba(255, 99, 132, 0.7)'   // legend-color-high
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Use custom legend
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    cornerRadius: 6,
                    padding: 8,
                    titleFont: { size: 14 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.raw || 0;
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Transaction Risk Distribution',
                    font: { size: 16 },
                    color: '#343a40' // --dark-color
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true,
                duration: 500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// Initialize Fraud Distribution Pie Chart (User Dashboard)
function initializeFraudDistributionChart() {
    const ctx = document.getElementById('fraudDistributionChart');
    if (!ctx) return;

    const low = parseInt(ctx.dataset.low) || 0;
    const medium = parseInt(ctx.dataset.medium) || 0;
    const high = parseInt(ctx.dataset.high) || 0;

    const total = low + medium + high;
    document.getElementById('totalTransactions').textContent = total;

    const chartData = [low, medium, high];
    if (chartData.every(val => val === 0)) {
        chartData[0] = 1;
    }

    chartInstances.fraudDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: chartData,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(255, 99, 132, 0.7)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const value = context.raw || 0;
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${context.label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

// Helper functions
function parseChartData(rawData, fallback) {
    try {
        return typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    } catch (e) {
        console.error('Data parsing error:', e);
        return fallback;
    }
}

function getChartOptions(title, unit, isPie = false) {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: title,
                font: { size: 16 },
                color: '#343a40' // --dark-color
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return isPie 
                            ? getPercentTooltipLabel(context)
                            : `${unit}: ${context.raw}`;
                    }
                }
            }
        }
    };
    
    if (!isPie) {
        baseOptions.scales = {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                    color: '#343a40' // --dark-color
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            },
            x: {
                ticks: {
                    color: '#343a40' // --dark-color
                },
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                }
            }
        };
    }
    
    return baseOptions;
}

function getPercentTooltipLabel(context) {
    const total = context.dataset.data.reduce((sum, value) => sum + value, 0);
    const percentage = total > 0 ? Math.round((context.raw / total) * 100) : 0;
    return `${context.label}: ${context.raw} (${percentage}%)`;
}

// Real-time updates
function updateCharts(data) {
    if (chartInstances.transactionChart) {
        let monthlyData = data.monthlyTransactions || Array(12).fill(0);
        monthlyData = monthlyData.map(val => Number(val) || 0);
        chartInstances.transactionChart.data.datasets[0].data = monthlyData;
        chartInstances.transactionChart.update();
    }
    
    if (chartInstances.riskDistributionChart) {
        let chartData = [
            data.riskDistribution.low || 0,
            data.riskDistribution.medium || 0,
            data.riskDistribution.high || 0
        ];
        if (chartData.every(val => val === 0)) {
            chartData[0] = 1;
        }
        chartInstances.riskDistributionChart.data.datasets[0].data = chartData;
        chartInstances.riskDistributionChart.update();
    }
}

// Fetch updated chart data
async function fetchChartData() {
    try {
        const adminResponse = await fetch('/admin/dashboard-data');
        if (adminResponse.ok) {
            const adminData = await adminResponse.json();
            updateCharts(adminData);
        } else {
            console.error(`Failed to fetch admin dashboard data: ${adminResponse.status}`);
        }

        const userResponse = await fetch('/user/dashboard-data');
        if (userResponse.ok) {
            const userData = await response.json();
            if (chartInstances.fraudDistributionChart) {
                let chartData = [
                    userData.riskDistribution.low || 0,
                    userData.riskDistribution.medium || 0,
                    userData.riskDistribution.high || 0
                ];
                if (chartData.every(val => val === 0)) {
                    chartData[0] = 1;
                }
                chartInstances.fraudDistributionChart.data.datasets[0].data = chartData;
                chartInstances.fraudDistributionChart.update();
                document.getElementById('totalTransactions').textContent = chartData.reduce((a, b) => a + b, 0);
            }
        } else {
            console.error(`Failed to fetch user dashboard data: ${userResponse.status}`);
        }
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

// Initialize charts
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeMonthlyTransactionChart();
        initializeRiskDistributionChart();
        initializeFraudDistributionChart();
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
    setInterval(fetchChartData, 30000);
});
