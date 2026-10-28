// Shared storefront code: Supabase client, cart, Google sign-in, product cards, navbar account button.
// Load order on every page: supabase-js → js/config.js → js/store.js → page script.

const sb = (window.supabase && typeof SUPABASE_URL === 'string' && SUPABASE_URL.startsWith('https://'))
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const NOT_CONNECTED_MSG = 'The store is being set up. Please check back soon or order on WhatsApp.';

// ── Helpers ──
function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function rupees(n){ return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function errMsg(e){ return (e && (e.message || e.error_description)) || String(e); }

// ── Cart (kept in this browser; prices are re-checked by the server at checkout) ──
const CART_KEY = 'manyamCart2';
localStorage.removeItem('manyamCart'); // old format without variant ids

function getCart(){
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e){ return []; }
}
function saveCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); }
function clearCartStorage(){ localStorage.removeItem(CART_KEY); }

// Called after every cart change: updates the header count and every product card's button/stepper
function refreshBadge(){
    const cart = getCart();
    const total = cart.reduce((s,i)=>s+i.qty, 0);
    document.querySelectorAll('#cartNavBadge, #cartBadge').forEach(b=>{
        b.textContent = total;
        b.classList.toggle('show', total > 0);
    });
    document.querySelectorAll('.product-card').forEach(card => syncCard(card, cart));
}

// ── Settings (UPI ID, WhatsApp number, delivery fee) ──
let _settings = null;
async function getSettings(){
    if(_settings) return _settings;
    if(!sb) throw new Error(NOT_CONNECTED_MSG);
    const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
    if(error) throw error;
    return (_settings = data);
}

// ── Products ──
async function fetchProducts({ featuredOnly = false } = {}){
    if(!sb) throw new Error(NOT_CONNECTED_MSG);
    let q = sb.from('products')
        .select('id,name,description,category,badge,badge_hot,image_url,featured,sort_order,product_variants(id,label,price,stock,sort_order,active)')
        .eq('active', true)
        .order('sort_order').order('name');
    if(featuredOnly) q = q.eq('featured', true);
    const { data, error } = await q;
    if(error) throw error;
    return data
        .map(p => ({ ...p, variants: (p.product_variants || []).filter(v => v.active).sort((a,b) => a.sort_order - b.sort_order) }))
        .filter(p => p.variants.length);
}

const CART_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';

// The card's action area: "Add to cart" until that size is in the cart, then a − qty + stepper
function cartActionHTML(variantId, soldOut, cart){
    if(soldOut) return '<button class="btn-add" disabled>Sold out</button>';
    const item = cart.find(i => i.variant_id === variantId);
    if(!item) return `<button class="btn-add" onclick="addCart(this)">${CART_ICON} Add to cart</button>`;
    return `<div class="cart-stepper" role="group" aria-label="Quantity in cart">
        <button class="qty-btn" onclick="cardQty(this,-1)" aria-label="Remove one">−</button>
        <span class="qty-num" aria-live="polite">${item.qty}</span>
        <button class="qty-btn" onclick="cardQty(this,1)" aria-label="Add one">+</button>
    </div>`;
}

function syncCard(card, cart){
    const row = card.querySelector('.add-row');
    const opt = card.querySelector('.w-select')?.selectedOptions[0];
    if(!row || !opt) return;
    const item = cart.find(i => i.variant_id === opt.value);
    const key = opt.value + ':' + (opt.disabled ? 'x' : item ? item.qty : 0);
    if(row.dataset.key === key) return;
    row.dataset.key = key;
    row.innerHTML = cartActionHTML(opt.value, opt.disabled, cart);
}

// cls lets index.html and products.html keep their own CSS class names
function productCardHTML(p, cls){
    const first = p.variants.find(v => v.stock === null || v.stock > 0) || p.variants[0];
    const options = p.variants.map(v => {
        const soldOut = v.stock !== null && v.stock <= 0;
        return `<option value="${esc(v.id)}" data-price="${v.price}" data-label="${esc(v.label)}"${soldOut ? ' disabled' : ''}${v.id === first.id ? ' selected' : ''}>${esc(v.label)}${soldOut ? ' (sold out)' : ''}</option>`;
    }).join('');
    const allSoldOut = p.variants.every(v => v.stock !== null && v.stock <= 0);
    return `
    <div class="product-card ${cls.card || ''}" data-category="${esc(p.category)}" data-id="${esc(p.id)}" data-name="${esc(p.name)}">
        <div class="${cls.imgWrap}">
            <img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">
            ${p.badge ? `<span class="${cls.badge}${p.badge_hot ? ' hot' : ''}">${esc(p.badge)}</span>` : ''}
        </div>
        <div class="${cls.info}">
            <div class="${cls.name}">${esc(p.name)}</div>
            <div class="${cls.desc}">${esc(p.description)}</div>
            <div class="weight-row">
                <select class="w-select" onchange="updatePrice(this)">${options}</select>
                <span class="${cls.price}" data-role="price">${rupees(first.price)}</span>
            </div>
            <div class="add-row" data-key="${esc(first.id)}:${allSoldOut ? 'x' : (getCart().find(i => i.variant_id === first.id)?.qty || 0)}">${cartActionHTML(first.id, allSoldOut, getCart())}</div>
        </div>
    </div>`;
}

// Size changed: show that size's price and its cart state
function updatePrice(sel){
    const opt = sel.selectedOptions[0];
    const card = sel.closest('.product-card');
    card.querySelector('[data-role="price"]').textContent = rupees(opt.dataset.price);
    syncCard(card, getCart());
}

// Change the cart quantity of the card's selected size by d (removes it at 0)
function cardQty(btn, d){
    const card = btn.closest('.product-card');
    const opt = card.querySelector('.w-select').selectedOptions[0];
    if(!opt || opt.disabled) return;
    const cart = getCart();
    const i = cart.findIndex(x => x.variant_id === opt.value);
    if(i === -1){
        if(d <= 0) return;
        cart.push({
            variant_id: opt.value,
            product_id: card.dataset.id,
            name: card.dataset.name,
            variant: opt.dataset.label,
            price: parseInt(opt.dataset.price),
            qty: Math.min(99, d),
            img: card.querySelector('img').getAttribute('src')
        });
    } else {
        cart[i].qty = Math.min(99, cart[i].qty + d);
        if(cart[i].qty <= 0) cart.splice(i, 1);
    }
    saveCart(cart);
    refreshBadge();
}

function addCart(btn){ cardQty(btn, 1); }

// ── Google sign-in ──
async function getSession(){
    if(!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
}

// returnTo: page to come back to after Google, e.g. 'cart.html' (defaults to the current page)
async function signInWithGoogle(returnTo){
    if(!sb){ alert(NOT_CONNECTED_MSG); return; }
    const redirectTo = new URL(returnTo || (location.pathname.split('/').pop() || 'index.html'), location.href).href;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if(error) alert('Could not start Google sign-in: ' + errMsg(error));
}

async function signOut(){
    if(sb) await sb.auth.signOut();
    location.reload();
}

function displayName(user){
    const m = user.user_metadata || {};
    return (m.full_name || m.name || user.email || 'Account').split(' ')[0];
}

// ── Navbar account button (added to every page's nav) ──
(function injectAccountStyles(){
    const css = `
    .account-btn { display:flex; align-items:center; gap:7px; height:42px; padding:0 14px 0 6px; border-radius:50px;
        border:2px solid #e8f0e5; text-decoration:none; color:#1a1a1a; font-weight:600; font-size:0.82rem;
        font-family:'Inter',sans-serif; background:white; cursor:pointer; white-space:nowrap; flex-shrink:0; }
    .account-btn:hover { border-color:#76e037; background:#f0fdf4; }
    .account-btn.signed-out { padding:0 14px; }
    .account-btn img, .account-btn .acc-initial { width:28px; height:28px; border-radius:50%; object-fit:cover; flex-shrink:0; }
    .account-btn .acc-initial { background:#76e037; color:#1a1a1a; display:flex; align-items:center; justify-content:center; font-weight:800; }
    @media (max-width: 1100px) { .account-btn .acc-label { display:none; } .account-btn { padding:0 6px; } .account-btn.signed-out { padding:0 12px; } .logo, .nav-links a { white-space:nowrap; } .nav-links { gap:18px !important; } .btn-back span { display:none; } .btn-shop { padding:9px 14px !important; font-size:0.78rem !important; white-space:nowrap; } .navbar { padding-left:4% !important; padding-right:4% !important; } .nav-right { gap:8px !important; } }
    @media (min-width: 769px) and (max-width: 900px) { .nav-links { gap:12px !important; } .nav-links a { font-size:0.8rem !important; } .logo { font-size:1.1rem !important; } }
    @media (max-width: 480px) { .account-btn.signed-out { display:none; } .account-btn { height:38px; padding:0 4px !important; } .nav-right { gap:8px !important; } }
    @media (max-width: 768px) { .account-btn .acc-label { display:none; } .account-btn { padding:0 6px; } .account-btn.signed-out { padding:0 12px; } }`;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();

function renderAccountNav(session){
    const right = document.querySelector('.nav-right');
    if(!right) return;
    let btn = document.getElementById('accountBtn');
    if(!btn){
        btn = document.createElement('a');
        btn.id = 'accountBtn';
        btn.className = 'account-btn';
        right.insertBefore(btn, right.firstChild);
    }
    if(session){
        const u = session.user;
        const pic = (u.user_metadata || {}).avatar_url;
        btn.href = 'orders.html';
        btn.onclick = null;
        btn.classList.remove('signed-out');
        btn.title = 'My Orders';
        btn.innerHTML = (pic ? `<img src="${esc(pic)}" alt="" referrerpolicy="no-referrer">` : `<span class="acc-initial">${esc(displayName(u)[0].toUpperCase())}</span>`)
            + `<span class="acc-label">My Orders</span>`;
    } else {
        btn.href = '#';
        btn.classList.add('signed-out');
        btn.title = 'Sign in with Google';
        btn.innerHTML = 'Sign in';
        btn.onclick = (e) => { e.preventDefault(); signInWithGoogle(); };
    }

    // Mobile drawer link
    const drawer = document.getElementById('mobileNav');
    if(drawer && !document.getElementById('mobileOrdersLink')){
        const a = document.createElement('a');
        a.id = 'mobileOrdersLink';
        a.href = 'orders.html';
        a.textContent = 'My Orders';
        const cartLink = [...drawer.querySelectorAll('a')].find(x => x.getAttribute('href') === 'cart.html');
        drawer.insertBefore(a, cartLink ? cartLink.nextSibling : null);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    refreshBadge();
    if(!sb) return;
    renderAccountNav(await getSession());
    sb.auth.onAuthStateChange((_event, session) => renderAccountNav(session));
});
