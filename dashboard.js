import { supabase } from './supabaseClient.js';
import { checkSession } from './auth.js';

let circulationChartInstance = null;

async function initDashboard() {
    const user = await checkSession();
    if (!user) return;

    // 1. Fetch Books (Independent of Loans)
    try {
        const { count: booksCount } = await supabase.from('book_copies').select('id', { count: 'exact', head: true });
        document.getElementById('stat-total-books').innerText = booksCount || 0;
    } catch (err) {
        console.error("Error fetching books count:", err);
    }

    // 2. Fetch Active Issues
    try {
        const { count: loansCount, error: loansErr } = await supabase.from('loans').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE');
        if (loansErr) throw loansErr;
        document.getElementById('stat-active-issues').innerText = loansCount || 0;
    } catch (err) {
        console.warn("Loans table not ready yet. Active issues skipped.");
        document.getElementById('stat-active-issues').innerText = "0";
    }

    // 3. Fetch Overdue
    try {
        const { count: overdueCount } = await supabase.from('loans').select('id', { count: 'exact', head: true })
            .eq('status', 'ACTIVE')
            .lt('due_date', new Date().toISOString());
        document.getElementById('stat-overdue').innerText = overdueCount || 0;
    } catch (err) {
        document.getElementById('stat-overdue').innerText = "0";
    }

    // 4. Load Chart
    await loadChartData();
}

async function loadChartData() {
    const ctx = document.getElementById('circulationChart');
    if (!ctx) return;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1); 
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Fetch safely
    const { data: recentLoans, error } = await supabase
        .from('loans')
        .select('created_at')
        .gte('created_at', sixMonthsAgo.toISOString());

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = [];
    const monthCounts = {};

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthString = monthNames[d.getMonth()];
        labels.push(monthString);
        monthCounts[monthString] = 0;
    }

    if (!error && recentLoans) {
        recentLoans.forEach(loan => {
            const loanDate = new Date(loan.created_at);
            const mString = monthNames[loanDate.getMonth()];
            if (monthCounts[mString] !== undefined) {
                monthCounts[mString]++;
            }
        });
    } else {
        console.warn("Could not fetch chart data. Rendering empty chart.");
    }

    const chartDataPoints = labels.map(label => monthCounts[label]);
    renderChart(ctx, labels, chartDataPoints);
}

function renderChart(ctx, labels, data) {
    if (circulationChartInstance) {
        circulationChartInstance.destroy();
    }

    const brandPrimary = getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#2563eb';

    circulationChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Books Issued',
                data: data,
                borderColor: brandPrimary, 
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: brandPrimary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 13, family: "'Inter', sans-serif" },
                    bodyFont: { size: 14, family: "'Inter', sans-serif", weight: 'bold' },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }, 
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    border: { display: false }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}

document.addEventListener('DOMContentLoaded', initDashboard);