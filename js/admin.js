// Admin panel. Access is enforced by the database (is_admin() + row level security);
// this page only decides what to show.

const STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const GOOGLE_SVG = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

let orders = [];
let products = [];
let coupons = [];
let editingProduct = null;

// ── Order classification ──
const isOpen = o => o.status !== 'cancelled';
const toVerify = o => isOpen(o) && o.payment_method === 'UPI' && o.utr && o.payment_status === 'pending';
const awaitingPay = o => isOpen(o) && o.payment_method === 'UPI' && !o.utr && o.payment_status === 'pending';
const toConfirm = o => o.status === 'placed' && (o.payment_status === 'verified' || o.payment_method === 'PAY_LATER');
const toShip = o => o.status === 'confirmed' || o.status === 'packed';
const needsAction = o => toVerify(o) || toConfirm(o) || toShip(o);

function paymentPill(o){
    if(o.payment_status === 'verified') return '<span class="pill ok">Paid</span>';
    if(o.payment_status === 'failed') return '<span class="pill bad">Failed</span>';
    if(o.payment_method === 'PAY_LATER') return '<span class="pill gray">Pay later</span>';
    if(o.utr) return '<span class="pill wait">Verify UTR</span>';
    return '<span class="pill gray">Not paid</span>';
}
function statusPill(s){
    const cls = { placed: 'wait', confirmed: 'info', packed: 'info', shipped: 'info', delivered: 'ok', cancelled: 'bad' }[s] || 'gray';
    return `<span class="pill ${cls}">${esc(s)}</span>`;
}
function fmtDate(iso){
    return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
function openModal(id){ document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if(e.target === o) closeModal(o.id); }));

// ── Gate: sign in + admin check ──
async function boot(){
    const gate = document.getElementById('gate');
    if(!sb){ gate.innerHTML = '<h2>Not connected</h2><p>Add your Supabase URL and key to js/config.js.</p>'; return; }

    const session = await getSession();
    if(!session){
        gate.innerHTML = `<h2>Admin sign in</h2><p>Sign in with the Google account that manages Manyam Foods.</p>
            <button class="btn-google" onclick="signInWithGoogle('admin.html')">${GOOGLE_SVG} Sign in with Google</button>`;
        return;
    }
    document.getElementById('adminEmail').textContent = session.user.email;
    document.getElementById('signOutBtn').hidden = false;

    const { data: ok, error } = await sb.rpc('is_admin');
    if(error || !ok){
        gate.innerHTML = `<h2>No admin access</h2><p><strong>${esc(session.user.email)}</strong> is not an admin.<br>Ask the owner to add this email to the <code>admins</code> table.</p>
            <button class="btn" onclick="signOut()">Sign in with another account</button>`;
        return;
    }

    gate.hidden = true;
    document.getElementById('app').hidden = false;
    await reloadAll();
}

async function reloadAll(){
    await Promise.all([loadOrders(), loadProducts(), loadCoupons(), loadSettings(), loadMessages()]);
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
function showTab(name){
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
}

// =====================================================================
// ORDERS
// =====================================================================
async function loadOrders(){
    const { data, error } = await sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(1000);
    if(error){ document.getElementById('ordersTable').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    orders = data;
    renderDashboard();
    renderOrders();
}

function renderDashboard(){
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const revenue = orders.filter(o => o.payment_status === 'verified' && new Date(o.created_at) >= monthStart).reduce((s, o) => s + o.total, 0);
    const today = orders.filter(o => new Date(o.created_at) >= todayStart).length;

    const tiles = [
        { n: orders.filter(toVerify).length, l: 'Payments to verify', f: 'verify', alert: true },
        { n: orders.filter(toConfirm).length, l: 'Orders to confirm', f: 'placed', alert: true },
        { n: orders.filter(toShip).length, l: 'To pack / ship', f: 'action', alert: true },
        { n: orders.filter(awaitingPay).length, l: 'Waiting for customer payment', f: 'unpaid' },
        { n: today, l: 'Orders today', f: 'all' },
        { n: rupees(revenue), l: 'Paid revenue this month', f: 'all' }
    ];
    document.getElementById('stats').innerHTML = tiles.map(t => `
        <div class="card stat${t.alert && t.n ? ' alert' : ''}" onclick="goOrders('${t.f}')">
            <div class="num">${t.n}</div><div class="lbl">${t.l}</div>
        </div>`).join('');

    const action = orders.filter(needsAction).length;
    const badge = document.getElementById('actionCount');
    badge.textContent = action; badge.hidden = !action;

    document.getElementById('latestOrders').innerHTML = ordersTableHTML(orders.slice(0, 8));
}

function goOrders(filter){
    document.getElementById('orderFilter').value = filter;
    renderOrders();
    showTab('orders');
}

function ordersTableHTML(list){
    if(!list.length) return '<div class="empty">No orders here.</div>';
    return `<table>
        <thead><tr><th>Order</th><th class="hide-sm">Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>${list.map(o => `
            <tr class="clickable" onclick="openOrder('${o.id}')">
                <td><strong>${esc(o.order_no)}</strong><div class="muted">${fmtDate(o.created_at)}</div></td>
                <td class="hide-sm">${esc(o.customer_name)}<div class="muted">${esc(o.phone)}</div></td>
                <td><strong>${rupees(o.total)}</strong><div class="muted">${o.payment_method === 'UPI' ? 'UPI' : 'Pay later'}</div></td>
                <td>${paymentPill(o)}</td>
                <td>${statusPill(o.status)}</td>
            </tr>`).join('')}
        </tbody></table>`;
}

function renderOrders(){
    const f = document.getElementById('orderFilter').value;
    const q = document.getElementById('orderSearch').value.trim().toLowerCase();
    let list = orders;
    if(f === 'action') list = list.filter(needsAction);
    else if(f === 'verify') list = list.filter(toVerify);
    else if(f === 'unpaid') list = list.filter(awaitingPay);
    else if(f !== 'all') list = list.filter(o => o.status === f);
    if(q) list = list.filter(o => [o.order_no, o.customer_name, o.phone, o.customer_email, o.utr].some(v => (v || '').toLowerCase().includes(q)));
    document.getElementById('ordersTable').innerHTML = ordersTableHTML(list);
}
document.getElementById('orderFilter').addEventListener('change', renderOrders);
document.getElementById('orderSearch').addEventListener('input', renderOrders);

function openOrder(id){
    const o = orders.find(x => x.id === id);
    if(!o) return;
    const items = o.order_items.map(i => `<div class="line"><span>${esc(i.product_name)} <span class="muted">(${esc(i.variant_label)}) × ${i.qty}</span></span><span>${rupees(i.line_total)}</span></div>`).join('');

    let payBlock = '';
    if(o.payment_method === 'UPI'){
        payBlock = o.utr
            ? `<div class="utr-box">Customer says they paid. UPI Ref (UTR): <code>${esc(o.utr)}</code><br>
                <span class="muted">Check your bank / UPI app for a credit of <strong>${rupees(o.total)}</strong> with this reference before verifying.</span></div>`
            : `<div class="utr-box">Customer has not submitted a UPI payment reference yet.</div>`;
    } else {
        payBlock = `<div class="utr-box">Pay later: share payment details with the customer on WhatsApp.</div>`;
    }

    const body = document.getElementById('orderModalBody');
    body.innerHTML = `
        <button class="close" onclick="closeModal('orderModal')">✕</button>
        <h3>${esc(o.order_no)}</h3>
        <div class="sub">${fmtDate(o.created_at)} · ${statusPill(o.status)} ${paymentPill(o)}</div>

        <section style="border-top:none; margin-top:0; padding-top:0">
            <h4>Customer</h4>
            <div><strong>${esc(o.customer_name)}</strong> · ${esc(o.phone)} · <span class="muted">${esc(o.customer_email)}</span></div>
            <div class="muted" style="margin-top:4px; white-space:pre-wrap">${esc(o.address)}</div>
        </section>

        <section>
            <h4>Items</h4>
            ${items}
            <div class="line"><span class="muted">Subtotal</span><span>${rupees(o.subtotal)}</span></div>
            ${o.discount ? `<div class="line"><span class="muted">Discount${o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : ''}</span><span>−${rupees(o.discount)}</span></div>` : ''}
            <div class="line"><span class="muted">Delivery</span><span>${o.delivery_fee ? rupees(o.delivery_fee) : 'FREE'}</span></div>
            <div class="line total"><span>Total</span><span>${rupees(o.total)}</span></div>
        </section>

        <section>
            <h4>Payment</h4>
            ${payBlock}
            ${o.status === 'cancelled' ? '' : `<div class="modal-actions" style="justify-content:flex-start; margin-top:10px">
                ${o.payment_status !== 'verified' ?`<button class="btn primary" onclick="setPayment('${o.id}','verified', this)">✓ Mark as paid</button>` : ''}
                ${o.payment_status === 'pending' && o.payment_method === 'UPI' && o.utr ? `<button class="btn danger" onclick="setPayment('${o.id}','failed', this)">✗ Payment not received</button>` : ''}
                ${o.payment_status !== 'pending' ? `<button class="btn" onclick="setPayment('${o.id}','pending', this)">Reset to pending</button>` : ''}
            </div>`}
        </section>

        <section>
            <h4>Fulfilment</h4>
            <div class="grid2">
                <div class="field"><label>Status</label>
                    <select id="oStatus" ${o.status === 'cancelled' ? 'disabled' : ''}>${STATUSES.map(s => `<option value="${s}"${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
                </div>
                <div class="field"><label>Tracking (courier + number / link)</label><input id="oTracking" value="${esc(o.tracking_info)}" placeholder="DTDC 1234567890"></div>
                <div class="field" style="grid-column:1/-1"><label>Private note (only admins see this)</label><textarea id="oNote" rows="2">${esc(o.admin_note)}</textarea></div>
            </div>
            <div class="form-err" id="orderErr"></div>
        </section>

        <div class="modal-actions">
            <a class="btn wa" target="_blank" rel="noopener" href="${customerWaLink(o)}">WhatsApp customer</a>
            <span style="flex:1"></span>
            <button class="btn" onclick="closeModal('orderModal')">Close</button>
            <button class="btn primary" onclick="saveOrder('${o.id}', this)">Save changes</button>
        </div>`;
    openModal('orderModal');
}

function customerWaLink(o){
    const statusText = {
        placed: 'has been received', confirmed: 'is confirmed', packed: 'is packed and ready to ship',
        shipped: 'has been shipped', delivered: 'has been delivered', cancelled: 'has been cancelled'
    }[o.status];
    let msg = `Hi ${o.customer_name}, your Manyam Foods order ${o.order_no} (${rupees(o.total)}) ${statusText}.`;
    if(o.tracking_info) msg += `\nTracking: ${o.tracking_info}`;
    return 'https://wa.me/91' + o.phone + '?text=' + encodeURIComponent(msg);
}

async function setPayment(id, value, btn){
    btn.disabled = true;
    const patch = { payment_status: value };
    const o = orders.find(x => x.id === id);
    // Verifying a payment also confirms a freshly placed order
    if(value === 'verified' && o.status === 'placed') patch.status = 'confirmed';
    const { error } = await sb.from('orders').update(patch).eq('id', id);
    btn.disabled = false;
    if(error){ document.getElementById('orderErr').textContent = errMsg(error); return; }
    toast(value === 'verified' ? 'Payment marked as received' : 'Payment updated');
    await loadOrders();
    openOrder(id);
}

async function saveOrder(id, btn){
    const status = document.getElementById('oStatus').value;
    const o = orders.find(x => x.id === id);
    if(status === 'cancelled' && o.status !== 'cancelled' && !confirm('Cancel this order? Stock will be returned and this cannot be undone.')) return;
    btn.disabled = true;
    const { error } = await sb.from('orders').update({
        status,
        tracking_info: document.getElementById('oTracking').value.trim(),
        admin_note: document.getElementById('oNote').value.trim()
    }).eq('id', id);
    btn.disabled = false;
    if(error){ document.getElementById('orderErr').textContent = errMsg(error); return; }
    toast('Order saved');
    await loadOrders();
    openOrder(id);
}

// =====================================================================
// PRODUCTS
// =====================================================================
async function loadProducts(){
    const { data, error } = await sb.from('products').select('*, product_variants(*)').order('sort_order').order('name');
    if(error){ document.getElementById('productsTable').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    products = data.map(p => ({ ...p, product_variants: p.product_variants.sort((a, b) => a.sort_order - b.sort_order) }));
    renderProducts();
}

function renderProducts(){
    const el = document.getElementById('productsTable');
    if(!products.length){ el.innerHTML = '<div class="empty">No products yet. Click “Add product”.</div>'; return; }
    el.innerHTML = `<table>
        <thead><tr><th></th><th>Product</th><th class="hide-sm">Sizes &amp; prices</th><th>Visible</th><th class="hide-sm">Home page</th><th></th></tr></thead>
        <tbody>${products.map(p => `
            <tr>
                <td><img class="prod-thumb" src="${esc(p.image_url)}" alt="" onerror="this.style.visibility='hidden'"></td>
                <td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)}${p.badge ? ' · ' + esc(p.badge) : ''}</div></td>
                <td class="hide-sm muted">${p.product_variants.map(v => `${esc(v.label)} ${rupees(v.price)}${v.stock !== null ? ` <span title="in stock">(${v.stock})</span>` : ''}${v.active ? '' : ' <s>off</s>'}`).join(' · ')}</td>
                <td><label class="switch"><input type="checkbox" ${p.active ? 'checked' : ''} onchange="toggleProduct('${p.id}','active',this)"><span></span></label></td>
                <td class="hide-sm"><label class="switch"><input type="checkbox" ${p.featured ? 'checked' : ''} onchange="toggleProduct('${p.id}','featured',this)"><span></span></label></td>
                <td><button class="btn sm" onclick="openProduct('${p.id}')">Edit</button></td>
            </tr>`).join('')}
        </tbody></table>`;
    document.getElementById('catList').innerHTML = [...new Set(products.map(p => p.category))].map(c => `<option value="${esc(c)}">`).join('');
}

async function toggleProduct(id, field, input){
    const { error } = await sb.from('products').update({ [field]: input.checked }).eq('id', id);
    if(error){ input.checked = !input.checked; alert(errMsg(error)); return; }
    const p = products.find(x => x.id === id); p[field] = input.checked;
    toast('Saved');
}

function variantRowHTML(v){
    return `<div class="variant-row" data-id="${v.id ? esc(v.id) : ''}">
        <input class="inp v-label" value="${esc(v.label || '')}" placeholder="250g">
        <input class="inp v-price" type="number" min="1" value="${v.price ?? ''}" placeholder="199">
        <input class="inp v-stock" type="number" min="0" value="${v.stock ?? ''}" placeholder="∞">
        <label class="switch"><input type="checkbox" class="v-active" ${v.active !== false ? 'checked' : ''}><span></span></label>
        <button class="btn sm danger" onclick="this.parentElement.remove()" title="Remove size">✕</button>
    </div>`;
}
function addVariantRow(){ document.getElementById('variantRows').insertAdjacentHTML('beforeend', variantRowHTML({})); }

function setPreview(url){
    const img = document.getElementById('pImgPreview');
    img.src = url || '';
    img.style.visibility = url ? 'visible' : 'hidden';
}
document.getElementById('pImgUrl').addEventListener('input', e => setPreview(e.target.value.trim()));
document.getElementById('pImgFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if(f) setPreview(URL.createObjectURL(f));
});

function openProduct(id){
    editingProduct = id ? products.find(p => p.id === id) : null;
    const p = editingProduct || { name: '', description: '', category: '', badge: '', badge_hot: false, image_url: '', active: true, featured: false,
        sort_order: (products.reduce((m, x) => Math.max(m, x.sort_order), 0) + 1), product_variants: [{}] };
    document.getElementById('pmTitle').textContent = editingProduct ? 'Edit product' : 'Add product';
    document.getElementById('pName').value = p.name;
    document.getElementById('pDesc').value = p.description;
    document.getElementById('pCat').value = p.category;
    document.getElementById('pSort').value = p.sort_order;
    document.getElementById('pBadge').value = p.badge;
    document.getElementById('pHot').checked = p.badge_hot;
    document.getElementById('pActive').checked = p.active;
    document.getElementById('pFeatured').checked = p.featured;
    document.getElementById('pImgUrl').value = p.image_url;
    document.getElementById('pImgFile').value = '';
    setPreview(p.image_url);
    document.getElementById('variantRows').innerHTML = p.product_variants.map(variantRowHTML).join('');
    document.getElementById('pDeleteBtn').hidden = !editingProduct;
    document.getElementById('productErr').textContent = '';
    openModal('productModal');
}

async function uploadImage(file){
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if(error) throw error;
    return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

async function saveProduct(){
    const err = document.getElementById('productErr');
    err.textContent = '';
    const name = document.getElementById('pName').value.trim();
    const category = document.getElementById('pCat').value.trim().toLowerCase() || 'other';
    if(!name){ err.textContent = 'Please enter a product name.'; return; }

    const rows = [...document.querySelectorAll('#variantRows .variant-row')].map((r, i) => ({
        id: r.dataset.id || null,
        label: r.querySelector('.v-label').value.trim(),
        price: parseInt(r.querySelector('.v-price').value),
        stock: r.querySelector('.v-stock').value === '' ? null : parseInt(r.querySelector('.v-stock').value),
        active: r.querySelector('.v-active').checked,
        sort_order: i + 1
    }));
    if(!rows.length){ err.textContent = 'Add at least one size with a price.'; return; }
    for(const v of rows){
        if(!v.label){ err.textContent = 'Every size needs a label, e.g. 250g.'; return; }
        if(!(v.price > 0)){ err.textContent = `Enter a price for ${v.label}.`; return; }
        if(v.stock !== null && !(v.stock >= 0)){ err.textContent = `Stock for ${v.label} must be 0 or more (or blank).`; return; }
    }

    const btn = document.getElementById('pSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        let image_url = document.getElementById('pImgUrl').value.trim();
        const file = document.getElementById('pImgFile').files[0];
        if(file) image_url = await uploadImage(file);

        const row = {
            name, category, image_url,
            description: document.getElementById('pDesc').value.trim(),
            badge: document.getElementById('pBadge').value.trim(),
            badge_hot: document.getElementById('pHot').checked,
            active: document.getElementById('pActive').checked,
            featured: document.getElementById('pFeatured').checked,
            sort_order: parseInt(document.getElementById('pSort').value) || 0
        };

        let productId = editingProduct && editingProduct.id;
        if(productId){
            const { error } = await sb.from('products').update(row).eq('id', productId);
            if(error) throw error;
        } else {
            const { data, error } = await sb.from('products').insert(row).select('id').single();
            if(error) throw error;
            productId = data.id;
        }

        // Variants: remove deleted rows, update existing, insert new
        const keep = rows.filter(v => v.id).map(v => v.id);
        const removed = (editingProduct ? editingProduct.product_variants : []).map(v => v.id).filter(vid => !keep.includes(vid));
        if(removed.length){
            const { error } = await sb.from('product_variants').delete().in('id', removed);
            if(error) throw error;
        }
        for(const v of rows.filter(v => v.id)){
            const { id, ...fields } = v;
            const { error } = await sb.from('product_variants').update(fields).eq('id', id);
            if(error) throw error;
        }
        const fresh = rows.filter(v => !v.id).map(({ id, ...fields }) => ({ ...fields, product_id: productId }));
        if(fresh.length){
            const { error } = await sb.from('product_variants').insert(fresh);
            if(error) throw error;
        }

        closeModal('productModal');
        toast('Product saved');
        await loadProducts();
    } catch(e){
        err.textContent = errMsg(e);
    } finally {
        btn.disabled = false; btn.textContent = 'Save product';
    }
}

async function deleteProduct(){
    if(!editingProduct) return;
    if(!confirm(`Delete "${editingProduct.name}" permanently?\n\nTip: switch off "Visible in store" instead if you may sell it again. Past orders keep their details either way.`)) return;
    const { error } = await sb.from('products').delete().eq('id', editingProduct.id);
    if(error){ document.getElementById('productErr').textContent = errMsg(error); return; }
    closeModal('productModal');
    toast('Product deleted');
    loadProducts();
}

// =====================================================================
// COUPONS
// =====================================================================
async function loadCoupons(){
    const { data, error } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
    if(error){ document.getElementById('couponsTable').innerHTML = `<div class="empty">${esc(errMsg(error))}</div>`; return; }
    coupons = data;
    const el = document.getElementById('couponsTable');
    if(!coupons.length){ el.innerHTML = '<div class="empty">No coupons yet.</div>'; return; }
    el.innerHTML = `<table>
        <thead><tr><th>Code</th><th>Discount</th><th class="hide-sm">Min order</th><th class="hide-sm">Expires</th><th>Active</th><th></th></tr></thead>
        <tbody>${coupons.map(c => `
            <tr>
                <td><strong>${esc(c.code)}</strong></td>
                <td>${c.kind === 'percent' ? c.value + '% off' : rupees(c.value) + ' off'}</td>
                <td class="hide-sm">${c.min_order ? rupees(c.min_order) : '—'}</td>
                <td class="hide-sm">${c.expires_at ? new Date(c.expires_at).toLocaleDateString('en-IN') : 'Never'}</td>
                <td><label class="switch"><input type="checkbox" ${c.active ? 'checked' : ''} onchange="toggleCoupon('${esc(c.code)}', this)"><span></span></label></td>
                <td><button class="btn sm danger" onclick="deleteCoupon('${esc(c.code)}')">Delete</button></td>
            </tr>`).join('')}
        </tbody></table>`;
}

async function addCoupon(){
    const err = document.getElementById('couponErr');
    err.textContent = '';
    const code = document.getElementById('cCode').value.trim().toUpperCase().replace(/\s/g, '');
    const kind = document.getElementById('cKind').value;
    const value = parseInt(document.getElementById('cValue').value);
    const min_order = parseInt(document.getElementById('cMin').value) || 0;
    const exp = document.getElementById('cExpires').value;
    if(!code){ err.textContent = 'Enter a coupon code.'; return; }
    if(!(value > 0) || (kind === 'percent' && value > 100)){ err.textContent = kind === 'percent' ? 'Percent must be 1–100.' : 'Enter the ₹ amount.'; return; }
    const { error } = await sb.from('coupons').insert({ code, kind, value, min_order, expires_at: exp ? new Date(exp + 'T23:59:59+05:30').toISOString() : null });
    if(error){ err.textContent = error.code === '23505' ? 'That code already exists.' : errMsg(error); return; }
    ['cCode', 'cValue', 'cExpires'].forEach(id => document.getElementById(id).value = '');
    toast('Coupon added');
    loadCoupons();
}

async function toggleCoupon(code, input){
    const { error } = await sb.from('coupons').update({ active: input.checked }).eq('code', code);
    if(error){ input.checked = !input.checked; alert(errMsg(error)); return; }
    toast('Saved');
}

async function deleteCoupon(code){
    if(!confirm('Delete coupon ' + code + '?')) return;
    const { error } = await sb.from('coupons').delete().eq('code', code);
    if(error){ alert(errMsg(error)); return; }
    loadCoupons();
}

// =====================================================================
// MESSAGES (Support page contact form)
// =====================================================================
let messages = [];

async function loadMessages(){
    const { data, error } = await sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500);
    const el = document.getElementById('messagesTable');
    if(error){
        el.innerHTML = `<div class="empty">${esc(errMsg(error))}<br><span class="muted">If this says the table doesn't exist, run supabase/migrations/002 in the SQL Editor.</span></div>`;
        return;
    }
    messages = data;
    renderMessages();
}

function renderMessages(){
    const f = document.getElementById('msgFilter').value;
    const fresh = messages.filter(m => !m.handled).length;
    const badge = document.getElementById('msgCount');
    badge.textContent = fresh; badge.hidden = !fresh;
    const list = messages.filter(m => f === 'all' || (f === 'new' ? !m.handled : m.handled));
    const el = document.getElementById('messagesTable');
    if(!list.length){ el.innerHTML = `<div class="empty">${f === 'new' ? 'No new messages.' : 'No messages here.'}</div>`; return; }
    el.innerHTML = `<table>
        <thead><tr><th>From</th><th>Message</th><th class="hide-sm">Received</th><th></th></tr></thead>
        <tbody>${list.map(m => `
            <tr>
                <td><strong>${esc(m.name)}</strong><div class="muted"><a href="tel:+91${esc(m.phone)}">${esc(m.phone)}</a></div><span class="pill info">${esc(m.topic)}</span></td>
                <td style="white-space:pre-wrap; max-width:460px">${esc(m.message)}</td>
                <td class="hide-sm muted">${fmtDate(m.created_at)}</td>
                <td style="white-space:nowrap">
                    <button class="btn sm" onclick="setHandled(${m.id}, ${!m.handled})">${m.handled ? 'Mark new' : '✓ Handled'}</button>
                    <button class="btn sm danger" onclick="deleteMessage(${m.id})" title="Delete">✕</button>
                </td>
            </tr>`).join('')}
        </tbody></table>`;
}
document.getElementById('msgFilter').addEventListener('change', renderMessages);

async function setHandled(id, handled){
    const { error } = await sb.from('contact_messages').update({ handled }).eq('id', id);
    if(error){ alert(errMsg(error)); return; }
    messages.find(m => m.id === id).handled = handled;
    renderMessages();
    toast(handled ? 'Marked as handled' : 'Marked as new');
}

async function deleteMessage(id){
    if(!confirm('Delete this message?')) return;
    const { error } = await sb.from('contact_messages').delete().eq('id', id);
    if(error){ alert(errMsg(error)); return; }
    messages = messages.filter(m => m.id !== id);
    renderMessages();
}

// =====================================================================
// SETTINGS
// =====================================================================
async function loadSettings(){
    const { data, error } = await sb.from('settings').select('*').eq('id', 1).single();
    if(error){ document.getElementById('settingsErr').textContent = errMsg(error); return; }
    document.getElementById('sUpi').value = data.upi_id;
    document.getElementById('sPayee').value = data.upi_payee_name;
    document.getElementById('sWa').value = data.whatsapp_number;
    document.getElementById('sFee').value = data.delivery_fee;
    document.getElementById('sFree').value = data.free_delivery_above;
}

async function saveSettings(btn){
    const err = document.getElementById('settingsErr');
    err.textContent = '';
    const upi = document.getElementById('sUpi').value.trim();
    const wa = document.getElementById('sWa').value.replace(/\D/g, '');
    if(upi && !/^[\w.\-]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/.test(upi)){ err.textContent = 'That UPI ID does not look right (example: name@okicici).'; return; }
    if(wa && !/^91[6-9]\d{9}$/.test(wa)){ err.textContent = 'Support WhatsApp number should be 91 followed by the 10-digit mobile number.'; return; }
    btn.disabled = true;
    const { error } = await sb.from('settings').update({
        upi_id: upi,
        upi_payee_name: document.getElementById('sPayee').value.trim() || 'Manyam Foods',
        whatsapp_number: wa,
        delivery_fee: parseInt(document.getElementById('sFee').value) || 0,
        free_delivery_above: parseInt(document.getElementById('sFree').value) || 0
    }).eq('id', 1);
    btn.disabled = false;
    if(error){ err.textContent = errMsg(error); return; }
    toast('Settings saved');
}

boot();
