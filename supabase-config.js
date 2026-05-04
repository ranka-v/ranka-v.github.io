// ============================================
// RANKA — Shared Supabase Configuration
// ============================================
// This file is loaded by all pages.
// Include it BEFORE any page-specific scripts.
// ============================================

const SUPABASE_URL = 'https://ncpkahiqnjukkvkyfghl.supabase.co';
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGthaGlxbmp1a2t2a3lmZ2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzE0MTUsImV4cCI6MjA5MjU0NzQxNX0.B8LXuuxB8ZnO8u-0jzxsCpGmTXVfkRNyYt_MU-TGW-8";

// We use the Supabase CDN script tag loaded in each HTML file.
// This creates a shared `sb` client instance.
let sb; 

// Initialize Supabase client (call this once per page)
function initSupabase() {
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase CDN not loaded. Check the <script> tag in your HTML.');
        return null;
    }
    if (!sb) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return sb;
}

// ============================================
// SOCIAL SIGN-IN
// ============================================

// Google Sign-In
async function signInWithGoogle() {
    initSupabase();
    const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/feed.html'
        }
    });
    
    if (error) {
        console.error('Google sign-in error:', error);
        return { error };
    }
    return { data };
}

// ============================================
// SHARED UTILITY FUNCTIONS
// ============================================

// Escape HTML to prevent XSS
function esc(t) { 
    if (!t) return '';
    const d = document.createElement('div'); 
    d.textContent = t; 
    return d.innerHTML; 
}

// Time ago formatting (reusable)
function timeAgo(d) {
    const s = Math.floor((new Date() - new Date(d)) / 1000);
    if (s < 60) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 604800) return Math.floor(s / 86400) + 'd';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Toast notification (requires a <div class="toast" id="toast"> in the HTML)
function showToast(m) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// Check if user is logged in, redirect if not
async function requireAuth(redirectPath) {
    initSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
        const currentPage = window.location.pathname.split('/').pop();
        window.location.href = `login.html?redirect=${redirectPath || currentPage}`;
        return null;
    }
    return user;
}

// Get current user (without redirect)
async function getCurrentUser() {
    initSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user || null;
}

// Handle logout
async function handleLogout() {
    initSupabase();
    await sb.auth.signOut();
    window.location.href = 'index.html';
}

// Format numbers (e.g., 1500 -> 1.5k)
function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
}

// Share a URL (tries Web Share API, falls back to copy)
async function shareUrl(url, title) {
    if (navigator.share) {
        try {
            await navigator.share({ title, url });
            return true;
        } catch (e) {
            // User cancelled
            return false;
        }
    } else {
        try {
            await navigator.clipboard.writeText(url);
            showToast('Link copied!');
            return true;
        } catch (e) {
            showToast('Could not share');
            return false;
        }
    }
}

// Get vote counts for a listing
async function getListingScore(listingId) {
    initSupabase();
    const [upRes, downRes] = await Promise.all([
        sb.from('votes').select('*', { count: 'exact', head: true }).eq('listing_id', listingId).eq('vote_type', 'up'),
        sb.from('votes').select('*', { count: 'exact', head: true }).eq('listing_id', listingId).eq('vote_type', 'down')
    ]);
    const up = upRes.count || 0;
    const down = downRes.count || 0;
    return { upvotes: up, downvotes: down, score: up - down };
}

// Get user's existing vote on a listing
async function getUserVote(listingId, userId) {
    initSupabase();
    const { data } = await sb
        .from('votes')
        .select('vote_type')
        .eq('listing_id', listingId)
        .eq('user_id', userId)
        .maybeSingle();
    return data?.vote_type || null;
}

// Check if listing is bookmarked
async function isListingBookmarked(listingId, userId) {
    initSupabase();
    const { data } = await sb
        .from('bookmarks')
        .select('id')
        .eq('listing_id', listingId)
        .eq('user_id', userId)
        .maybeSingle();
    return !!data;
}

// Toggle bookmark
async function toggleBookmark(listingId, userId) {
    initSupabase();
    const bookmarked = await isListingBookmarked(listingId, userId);
    if (bookmarked) {
        await sb.from('bookmarks').delete().eq('listing_id', listingId).eq('user_id', userId);
        return false; // now unbookmarked
    } else {
        await sb.from('bookmarks').insert({ listing_id: listingId, user_id: userId });
        return true; // now bookmarked
    }
}

// Cast/remove a vote
async function castVote(listingId, userId, voteType) {
    initSupabase();
    const currentVote = await getUserVote(listingId, userId);
    
    if (currentVote === voteType) {
        // Remove vote
        await sb.from('votes').delete().eq('listing_id', listingId).eq('user_id', userId);
        return { voted: null, ...(await getListingScore(listingId)) };
    } else {
        // Upsert vote
        await sb.from('votes').upsert(
            { listing_id: listingId, user_id: userId, vote_type: voteType },
            { onConflict: 'listing_id, user_id' }
        );
        return { voted: voteType, ...(await getListingScore(listingId)) };
    }
}

// Get ranking position in category
async function getCategoryRank(listingId, categoryId) {
    initSupabase();
    const { data: listings } = await sb.from('listings').select('id').eq('category_id', categoryId);
    if (!listings?.length) return null;
    
    const scores = await Promise.all(listings.map(async (l) => {
        const s = await getListingScore(l.id);
        return { id: l.id, score: s.score };
    }));
    
    scores.sort((a, b) => b.score - a.score);
    const rank = scores.findIndex(s => s.id == listingId) + 1;
    return rank > 0 ? { rank, total: scores.length } : null;
}

// Debounce function (for search inputs, etc.)
function debounce(func, wait) {
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

// Get URL parameter
function getUrlParam(param) {
    const params = new URLSearchParams(window.location.search);
    return params.get(param);
}

// ============================================
// INIT: Auto-initialize Supabase on load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});