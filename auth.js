import { supabase } from './supabaseClient.js';

const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

// --- LOGIN LOGIC ---
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('error-message');

        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width: 18px; height: 18px;"></i> Signing in...';
        btn.disabled = true;
        if (window.lucide) lucide.createIcons();

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.innerText = error.message;
            errorMsg.style.display = 'block';
            btn.innerHTML = '<i data-lucide="log-in" style="width: 18px; height: 18px;"></i> Sign In';
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        } else {
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
    const isPublicPage = window.location.pathname.includes('login.html') || 
                         window.location.pathname.includes('student_portal.html') || 
                         window.location.pathname.includes('kiosk.html');
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // If no session and not on a public page, redirect to login
        if (!session && !isPublicPage) {
            window.location.href = 'login.html';
            return null;
        }

        // If on login page and already logged in, redirect to index
        if (session && window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
            return session.user;
        }
        
        if (session) {
            let userName = session.user.email ? session.user.email.split('@')[0] : 'Admin';
            let roleName = 'SUPER ADMIN'; 
            
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, role')
                    .eq('id', session.user.id)
                    .maybeSingle();
                    
                if (profile && profile.name) {
                    userName = profile.name;
                }
                if (profile && profile.role) {
                    roleName = profile.role;
                }
            } catch (err) {
                console.warn("Using fallback user profile.");
            }
                
            window.currentUser = {
                id: session.user.id,
                email: session.user.email,
                name: userName,
                role: roleName
            };

            localStorage.setItem('user_id', session.user.id);
            localStorage.setItem('user_name', userName);
            localStorage.setItem('user_role', roleName);
            localStorage.setItem('user_email', session.user.email);
            
            return window.currentUser;
        }
    } catch (e) {
        console.error("Session check error:", e);
    }
}

// Initialize session check immediately
const isPublicPage = window.location.pathname.includes('login.html') || 
                     window.location.pathname.includes('student_portal.html') || 
                     window.location.pathname.includes('kiosk.html');
if (!isPublicPage) {
    checkSession();
} else if (window.location.pathname.includes('login.html')) {
    checkSession();
}