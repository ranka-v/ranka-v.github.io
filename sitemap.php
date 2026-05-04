// Supabase Edge Function: generate-sitemap
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ncpkahiqnjukkvkyfghl.supabase.co';
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

Deno.serve(async (req) => {
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const [listingsRes, categoriesRes, profilesRes] = await Promise.all([
        sb.from('listings').select('id, created_at'),
        sb.from('categories').select('slug'),
        sb.from('profiles').select('username')
    ]);

    const baseUrl = 'https://ranka.ug';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    const staticPages = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/feed.html', priority: '0.9', changefreq: 'hourly' },
        { loc: '/rankings.html', priority: '0.9', changefreq: 'hourly' },
        { loc: '/explore.html', priority: '0.8', changefreq: 'hourly' },
        { loc: '/search.html', priority: '0.8', changefreq: 'daily' },
        { loc: '/categories.html', priority: '0.8', changefreq: 'daily' },
        { loc: '/login.html', priority: '0.5', changefreq: 'monthly' },
        { loc: '/register.html', priority: '0.6', changefreq: 'monthly' },
    ];

    staticPages.forEach(p => {
        xml += `  <url>\n    <loc>${baseUrl}${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
    });

    // Listing pages
    (listingsRes.data || []).forEach(l => {
        xml += `  <url>\n    <loc>${baseUrl}/listing.html?id=${l.id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    // Category pages
    (categoriesRes.data || []).forEach(c => {
        xml += `  <url>\n    <loc>${baseUrl}/category.html?slug=${c.slug}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    // Profile pages
    (profilesRes.data || []).forEach(p => {
        xml += `  <url>\n    <loc>${baseUrl}/profile.html?username=${p.username}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    });

    xml += '</urlset>';

    return new Response(xml, {
        headers: { 'Content-Type': 'application/xml' }
    });
});