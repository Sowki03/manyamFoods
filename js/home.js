// Home page: hero reveal, in-page category filtering, one-time scroll reveals,
// "Why Manyam" illustrations and counters.
// Needs: js/store.js, js/layout.js; GSAP + ScrollTrigger + SplitText are optional.
(function(){
    const root = document.documentElement;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText);
    clearTimeout(window.__animFallback);
    if(!hasGsap) root.classList.add('anim-fallback');

    // In-page links: smooth scroll below the sticky header
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if(!target) return;
        e.preventDefault();
        const top = target.getBoundingClientRect().top + scrollY - document.getElementById('siteTop').offsetHeight - 10;
        scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    }));

    // ── Shop: category tiles filter the grid without leaving the page ──
    const grid = document.getElementById('featuredGrid');
    const viewAll = document.getElementById('viewAll');
    const CARD_CLASSES = { imgWrap: 'prod-img-wrap', badge: 'prod-badge', info: 'prod-info',
                           name: 'prod-name', desc: 'prod-desc', price: 'prod-price' };
    let allProducts = [];

    function productsFor(cat){
        if(cat === 'best'){
            const featured = allProducts.filter(p => p.featured);
            return (featured.length ? featured : allProducts).slice(0, 8);
        }
        return allProducts.filter(p => p.category === cat);
    }

    function showCategory(cat, animate){
        const list = productsFor(cat);
        grid.innerHTML = list.length
            ? list.map(p => productCardHTML(p, CARD_CLASSES)).join('')
            : '<div class="grid-msg">New products in this category are coming soon.</div>';
        viewAll.href = cat === 'best' ? 'products.html' : 'products.html?cat=' + cat;
        if(animate) animateCards([...grid.querySelectorAll('.product-card')]);
    }

    document.querySelectorAll('.cat').forEach(btn => btn.addEventListener('click', () => {
        if(btn.getAttribute('aria-pressed') === 'true') return;
        document.querySelectorAll('.cat').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        // keep the grid height steady while swapping so the page doesn't jump
        grid.style.minHeight = grid.offsetHeight + 'px';
        showCategory(btn.dataset.cat, true);
        requestAnimationFrame(() => { grid.style.minHeight = ''; });
        btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }));

    const productsReady = fetchProducts()
        .then(list => { allProducts = list; showCategory('best', false); return [...grid.querySelectorAll('.product-card')]; })
        .catch(e => { grid.innerHTML = `<div class="grid-msg">${esc(errMsg(e))}</div>`; return []; });

    if(!hasGsap) return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    gsap.defaults({ ease: 'power3.out' });

    // ── Hero entrance ──
    function playHero(){
        gsap.set('[data-hero], [data-hero-img], [data-float]', { visibility: 'visible' });
        if(reduce){
            gsap.from('[data-hero], [data-hero-img], [data-float]', { opacity: 0, duration: 0.4, ease: 'none' });
            return;
        }
        const title = SplitText.create('#heroTitle', { type: 'lines', mask: 'lines', linesClass: 'line' });
        gsap.timeline()
            .from('.hero .eyebrow', { y: 14, opacity: 0, duration: 0.5 })
            .from(title.lines, { yPercent: 105, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.05)
            .fromTo('[data-hero-img]', { clipPath: 'inset(12% 10% 12% 10% round 28px)' },
                { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.1, ease: 'expo.out' }, 0.1)
            .from('[data-hero-img] img', { scale: 1.2, duration: 1.4, ease: 'expo.out' }, 0.1)
            .from('.hero-sub, .hero-btns, .chips', { y: 16, opacity: 0, duration: 0.6, stagger: 0.07 }, 0.35)
            .from('[data-float]', { y: 20, opacity: 0, scale: 0.95, duration: 0.7, ease: 'back.out(1.6)' }, 0.7);
        gsap.to('.float-card', { y: 6, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 });
    }

    // ── Scroll reveals (play once) ──
    function setupReveals(){
        const y = reduce ? 0 : 20;
        gsap.utils.toArray('[data-reveal]').forEach(el => gsap.from(el, {
            y, opacity: 0, duration: 0.7, scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));

        gsap.utils.toArray('[data-split]').forEach(el => {
            if(reduce){
                gsap.from(el, { opacity: 0, duration: 0.5, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
                return;
            }
            const split = SplitText.create(el, { type: 'lines', mask: 'lines' });
            gsap.from(split.lines, { yPercent: 105, duration: 0.9, ease: 'expo.out', stagger: 0.07,
                scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
        });

        gsap.utils.toArray('[data-stagger]').forEach(group => gsap.from(group.children, {
            y: reduce ? 0 : 24, opacity: 0, duration: 0.6, stagger: 0.06,
            scrollTrigger: { trigger: group, start: 'top 88%', once: true } }));

        gsap.utils.toArray('[data-clip]').forEach(el => {
            if(reduce) return;
            gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round 28px)' },
                { clipPath: 'inset(0% 0% 0% 0% round 28px)', duration: 1.2, ease: 'expo.out',
                  scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
            gsap.from(el.querySelector('img'), { scale: 1.2, duration: 1.5, ease: 'expo.out',
                scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
        });

        document.querySelectorAll('[data-count]').forEach(el => {
            const target = parseInt(el.dataset.count), suffix = el.dataset.suffix || '';
            if(!target || reduce) return;
            const n = { v: 0 };
            el.textContent = '0' + suffix;
            gsap.to(n, { v: target, duration: 1.6, ease: 'power2.out',
                onUpdate: () => { el.textContent = Math.round(n.v) + suffix; },
                scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
        });
    }

    // ── "Why Manyam" illustrations + gift box: small one-time flourishes ──
    function setupFlourishes(){
        if(reduce) return;
        gsap.timeline({ scrollTrigger: { trigger: '.why-grid', start: 'top 80%', once: true }, delay: 0.3 })
            .from('.sun-rays', { rotation: -60, svgOrigin: '60 60', duration: 1.4, ease: 'expo.out' }, 0)
            .to('.stone-handle', { keyframes: { x: [0, -50, 0] }, duration: 1.4, ease: 'power1.inOut' }, 0)
            .from('.jar-fill', { scaleY: 0.1, transformOrigin: '50% 100%', duration: 1.4, ease: 'expo.out' }, 0.1);
        gsap.from('.gift-art .bow', { scale: 0.6, transformOrigin: '50% 100%', duration: 1, ease: 'back.out(2)',
            scrollTrigger: { trigger: '.gift-card', start: 'top 80%', once: true } });
        gsap.to('.gift-art .diya', { scaleY: 1.12, transformOrigin: '50% 100%', duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }

    // ── Cart badge pop ──
    const baseAddCart = window.addCart;
    window.addCart = function(btn){
        baseAddCart(btn);
        if(!reduce) gsap.fromTo('#cartNavBadge', { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    };

    const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1200))]);
    fontsReady.then(async () => {
        playHero();
        setupReveals();
        setupFlourishes();
        const cards = await productsReady;
        if(cards.length && !reduce) gsap.from(cards, { y: 30, opacity: 0, duration: 0.6, stagger: 0.06, clearProps: 'transform',
            scrollTrigger: { trigger: grid, start: 'top 90%', once: true } });
        ScrollTrigger.refresh();
    });
    addEventListener('load', () => ScrollTrigger.refresh());
})();
