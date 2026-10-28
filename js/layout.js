// Shared site chrome for every customer page: header (offer bar + nav), mobile menu,
// footer, floating WhatsApp button and the slide-in cart drawer.
// Load after js/store.js. Pages opt out of the drawer with <body data-no-drawer> (checkout).
(function(){
    const WA_NUMBER = '917207021603';
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const noDrawer = document.body.hasAttribute('data-no-drawer');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const LEAF = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 58C32 58 10 46 10 26C10 14 20 6 32 6C44 6 54 14 54 26C54 46 32 58 32 58Z" fill="#3e7a37"/><path d="M32 16V50M32 27L24 21.5M32 35L41 28.5M32 43L25 38.5" stroke="#fbf6ec" stroke-width="2.6" stroke-linecap="round"/></svg>';
    const BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>';
    const WA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

    const links = [['index.html', 'Home'], ['products.html', 'Shop'], ['OurStory.html', 'Our Story'], ['Support.html', 'Support']];
    const isActive = href => href.toLowerCase() === page;

    // ── Header ──
    document.body.insertAdjacentHTML('afterbegin', `
    <div class="mf-top" id="siteTop">
        <div class="mf-offer">
            <span>Free delivery on orders above ₹499</span>
            <span class="mf-offer-extra">·</span>
            <a class="mf-offer-extra" href="index.html#gifting">Diwali gift hampers now open →</a>
        </div>
        <header class="mf-nav" id="navbar">
            <a href="index.html" class="mf-logo" aria-label="Manyam Foods home">${LEAF}Manyam Foods</a>
            <nav aria-label="Main"><ul class="mf-links">
                ${links.map(([h, t]) => `<li><a href="${h}"${isActive(h) ? ' class="active" aria-current="page"' : ''}>${t}</a></li>`).join('')}
            </ul></nav>
            <div class="nav-right">
                <button class="mf-cart-btn" id="cartNavBtn" aria-label="Open cart">${BAG}<span class="cart-nav-badge" id="cartNavBadge">0</span></button>
                <button class="mf-burger" onclick="toggleMenu()" aria-label="Open menu"><span></span><span></span><span></span></button>
            </div>
        </header>
    </div>
    <div class="mf-menu" id="mobileNav" aria-hidden="true">
        <button class="mf-menu-close" onclick="toggleMenu()" aria-label="Close menu">✕</button>
        ${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}
        <a href="cart.html" data-open-cart>Cart</a>
    </div>`);

    // ── Footer + floating WhatsApp ──
    document.body.insertAdjacentHTML('beforeend', `
    <a class="mf-wa" href="https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Hi Manyam Foods, I'd like to place an order.")}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">${WA}</a>
    <footer class="mf-footer">
        <div class="mf-footer-grid">
            <div>
                <div class="mf-footer-logo">${LEAF.replace('#3e7a37', '#e3a018').replace('#fbf6ec', '#151e13')}Manyam Foods</div>
                <p>Traditional foods handcrafted by rural women artisans in the Manyam hills.</p>
            </div>
            <div>
                <h4>Shop</h4>
                <ul>
                    <li><a href="products.html?cat=powders">Powders</a></li>
                    <li><a href="products.html?cat=millets">Millets</a></li>
                    <li><a href="products.html?cat=oils">Oils &amp; Ghee</a></li>
                    <li><a href="products.html?cat=pickles">Pickles</a></li>
                    <li><a href="products.html?cat=snacks">Snacks</a></li>
                </ul>
            </div>
            <div>
                <h4>Help</h4>
                <ul>
                    <li><a href="orders.html">My Orders</a></li>
                    <li><a href="Support.html#contact">Contact us</a></li>
                    <li><a href="Support.html#faq">FAQs</a></li>
                    <li><a href="Support.html#shipping">Shipping policy</a></li>
                    <li><a href="Support.html#returns">Returns &amp; refunds</a></li>
                    <li><a href="OurStory.html">Our Story</a></li>
                </ul>
            </div>
            <div>
                <h4>Follow us</h4>
                <ul>
                    <li><a href="https://www.instagram.com/manyamfoods" target="_blank" rel="noopener">Instagram</a></li>
                    <li><a href="https://www.youtube.com/@manyamfoods" target="_blank" rel="noopener">YouTube</a></li>
                    <li><a href="https://wa.me/c/${WA_NUMBER}" target="_blank" rel="noopener">WhatsApp catalog</a></li>
                </ul>
                <form class="mf-news" onsubmit="return false"><input type="email" placeholder="Email for harvest updates" aria-label="Email address"><button type="submit">Join</button></form>
            </div>
        </div>
        <div class="mf-footer-bottom">
            <!-- TODO: add "· FSSAI Lic. No. …" once the licence number is available -->
            <span>© 2026 Manyam Foods. Handcrafted with care.</span>
            <span><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></span>
        </div>
    </footer>
    <div class="mf-cart-overlay" id="cartOverlay"></div>
    <aside class="mf-cart" id="cartDrawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true">
        <div class="mf-cart-head">
            <h2 id="cartTitle">Your cart <span id="cartCount"></span></h2>
            <button class="mf-cart-close" id="cartClose" aria-label="Close cart">✕</button>
        </div>
        <div class="mf-cart-free" id="cartFree"></div>
        <div class="mf-cart-items" id="cartItems"></div>
        <div class="mf-cart-foot" id="cartFoot">
            <div class="mf-cart-sub"><span>Subtotal</span><span id="cartSubtotal">₹0</span></div>
            <div class="mf-cart-note">Delivery and coupons are applied at checkout.</div>
            <a class="mf-btn green" href="cart.html">Checkout</a>
            <button class="mf-cart-continue" id="cartContinue">Continue shopping</button>
        </div>
    </aside>`);

    // ── Mobile menu + header shadow ──
    window.toggleMenu = function(){
        const m = document.getElementById('mobileNav');
        const open = !m.classList.contains('open');
        m.classList.toggle('open', open);
        m.setAttribute('aria-hidden', String(!open));
        document.body.style.overflow = open ? 'hidden' : '';
    };
    const nav = document.getElementById('navbar');
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // ── Cart drawer ──
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartOverlay');
    let freeAbove = 499;
    try { getSettings().then(s => { freeAbove = s.free_delivery_above; renderCart(); }).catch(() => {}); } catch(e){}

    function renderCart(){
        const cart = getCart();
        const count = cart.reduce((s, i) => s + i.qty, 0);
        const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
        document.getElementById('cartCount').textContent = count ? `(${count})` : '';
        document.getElementById('cartSubtotal').textContent = rupees(subtotal);
        document.getElementById('cartFoot').hidden = !cart.length;

        const free = document.getElementById('cartFree');
        free.hidden = !cart.length;
        const left = freeAbove - subtotal;
        free.innerHTML = (left > 0 ? `Add <b>${rupees(left)}</b> more for <b>free delivery</b>` : `🎉 You've unlocked <b>free delivery</b>`)
            + `<div class="mf-cart-bar"><span style="transform:scaleX(${Math.min(1, subtotal / freeAbove)})"></span></div>`;

        const items = document.getElementById('cartItems');
        if(!cart.length){
            items.innerHTML = `<div class="mf-cart-empty"><h3>Your cart is empty</h3><p>Handmade millets, powders and pickles are waiting.</p>
                <a class="mf-btn green" href="products.html">Shop products</a></div>`;
            return;
        }
        items.innerHTML = cart.map((i, idx) => `
            <div class="mf-cart-item">
                <img src="${esc(i.img)}" alt="" onerror="this.style.visibility='hidden'">
                <div class="mf-ci-body">
                    <div class="mf-ci-top">
                        <div><div class="mf-ci-name">${esc(i.name)}</div><div class="mf-ci-var">${esc(i.variant)}</div></div>
                        <button class="mf-ci-remove" data-remove="${idx}">Remove</button>
                    </div>
                    <div class="mf-ci-bottom">
                        <div class="mf-ci-qty"><button data-qty="${idx}" data-d="-1" aria-label="Decrease">−</button><span>${i.qty}</span><button data-qty="${idx}" data-d="1" aria-label="Increase">+</button></div>
                        <div class="mf-ci-price">${rupees(i.price * i.qty)}</div>
                    </div>
                </div>
            </div>`).join('');
    }

    function cartChanged(){
        refreshBadge();
        renderCart();
        if(typeof window.onCartChange === 'function') window.onCartChange();
    }

    document.getElementById('cartItems').addEventListener('click', e => {
        const cart = getCart();
        const q = e.target.closest('[data-qty]');
        const r = e.target.closest('[data-remove]');
        if(q){
            const i = +q.dataset.qty;
            cart[i].qty = Math.max(1, Math.min(99, cart[i].qty + +q.dataset.d));
            saveCart(cart); cartChanged();
        } else if(r){
            const row = r.closest('.mf-cart-item');
            const remove = () => { cart.splice(+r.dataset.remove, 1); saveCart(cart); cartChanged(); };
            if(reduce || !row.animate) return remove();
            row.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(24px)' }],
                { duration: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).onfinish = remove;
        }
    });

    let lastFocus = null;
    function openCart(){
        if(noDrawer){ location.href = 'cart.html'; return; }
        renderCart();
        lastFocus = document.activeElement;
        drawer.classList.add('open'); overlay.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('cartClose').focus(), 50);
    }
    function closeCart(){
        drawer.classList.remove('open'); overlay.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if(lastFocus) lastFocus.focus();
    }
    window.openCart = openCart;
    window.closeCart = closeCart;

    document.getElementById('cartNavBtn').addEventListener('click', openCart);
    document.querySelector('#mobileNav [data-open-cart]').addEventListener('click', e => {
        if(noDrawer) return;
        e.preventDefault(); toggleMenu(); openCart();
    });
    overlay.addEventListener('click', closeCart);
    document.getElementById('cartClose').addEventListener('click', closeCart);
    document.getElementById('cartContinue').addEventListener('click', closeCart);
    addEventListener('keydown', e => {
        if(e.key !== 'Escape') return;
        if(drawer.classList.contains('open')) closeCart();
        else if(document.getElementById('mobileNav').classList.contains('open')) toggleMenu();
    });
    // keep tabs in sync
    addEventListener('storage', e => { if(e.key === CART_KEY) cartChanged(); });

    // Adding a product opens the drawer (like most D2C stores)
    if(typeof window.addCart === 'function'){
        const baseAddCart = window.addCart;
        window.addCart = function(btn){
            baseAddCart(btn);
            renderCart();
            if(!noDrawer) setTimeout(openCart, 250); // let the "Added!" state register first
        };
    }

    // ── Shared grid entrance: used when category filters swap products in place ──
    window.animateCards = function(cards){
        if(!cards.length || !cards[0].animate) return;
        cards.forEach((c, i) => c.animate(
            reduce ? [{ opacity: 0 }, { opacity: 1 }]
                   : [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
            { duration: 260, delay: Math.min(i, 8) * 35, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }));
    };
})();
