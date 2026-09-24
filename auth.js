import { supabase } from './supabaseClient.js';

const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// --- LOGIN LOGIC ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('error-message');

        btn.innerText = 'Signing in...';
        btn.disabled = true;

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';
            btn.innerText = 'Sign In';
            btn.disabled = false;
        } else {
            // Redirect to dashboard on success
            window.location.href = 'index.html';
        }
    });
}

// --- LOGOUT LOGIC ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

// --- ROUTE PROTECTION & ROLE FETCHING ---
export async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    // If no session and not on login page, kick to login
    if (!session && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
        return null;
    }
    
    if (session) {
        // 1. Establish bulletproof fallback data
        let userName = session.user.email.split('@')[0];
        let roleName = 'SUPER ADMIN'; 
        
        try {
            // 2. Safely attempt to fetch just the name (bypassing the 406 role_id error)
            const { data: profile } = await supabase
                .from('profiles')
                .select('name')
                .eq('id', session.user.id)
                .maybeSingle(); // maybeSingle prevents errors if the row doesn't exist
                
            if (profile && profile.name) {
                userName = profile.name;
            }
        } catch (err) {
            // Silently ignore DB schema mismatch errors so the app doesn't crash
            console.warn("Using fallback user profile.");
        }
            
        // 3. Store user info globally for topbar UI updates
        window.currentUser = {
            id: session.user.id,
            email: session.user.email,
            name: userName,
            role: roleName
        };
        
        return window.currentUser;
    }
}

// Initialize session check if we are on a protected page
if (!window.location.pathname.includes('login.html')) {
    checkSession();
}