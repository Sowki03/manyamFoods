// UPI QR payment popup, shared by cart.html (new orders) and orders.html ("Pay now").
// Needs: qrcodejs, js/store.js
(function injectUpiModal(){
    const css = `
    .upi-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:2000; display:none; align-items:center; justify-content:center; padding:16px; }
    .upi-overlay.open { display:flex; }
    .upi-modal { background:white; border-radius:22px; width:100%; max-width:380px; max-height:calc(100vh - 32px); overflow-y:auto; padding:26px 24px 22px; position:relative; text-align:center; font-family:'Inter',sans-serif; color:#1a1a1a; }
    .upi-close { position:absolute; top:12px; right:14px; background:none; border:none; font-size:1.4rem; cursor:pointer; color:#666; }
    .upi-title { font-size:1.15rem; font-weight:800; margin-bottom:4px; }
    .upi-sub { font-size:0.8rem; color:#666; margin-bottom:16px; }
    .upi-amount { font-size:2rem; font-weight:800; color:#c85a3a; margin-bottom:4px; }
    .upi-order { font-size:0.75rem; color:#666; margin-bottom:16px; }
    .upi-qr { display:inline-block; padding:12px; border:1.5px solid #e8f0e5; border-radius:16px; background:white; }
    .upi-qr img, .upi-qr canvas { display:block; width:200px; height:200px; }
    .upi-id { font-size:0.82rem; margin-top:12px; }
    .upi-copy { background:none; border:none; color:#5cb82a; font-weight:700; font-size:0.78rem; cursor:pointer; font-family:inherit; margin-left:4px; }
    .upi-apps { display:none; margin-top:18px; text-align:left; }
    .upi-apps-label { font-size:0.78rem; font-weight:700; margin-bottom:8px; }
    .upi-apps-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .upi-app { display:flex; align-items:center; gap:8px; padding:12px; border-radius:12px; border:1.5px solid #e7dcc6; background:white; color:#1f1a14; font-weight:700; font-size:0.85rem; text-decoration:none; box-sizing:border-box; -webkit-tap-highlight-color:transparent; transition:transform 160ms cubic-bezier(0.23,1,0.32,1); }
    .upi-app:active { transform:scale(0.97); }
    .upi-app i { width:22px; height:22px; border-radius:6px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:white; font-style:normal; font-size:0.7rem; font-weight:800; }
    .upi-apps-hint { font-size:0.72rem; color:#6b6156; margin-top:8px; }
    .upi-steps { text-align:left; font-size:0.78rem; color:#666; margin:18px 0 12px; padding-left:18px; line-height:1.7; }
    .upi-ref-label { display:block; text-align:left; font-size:0.78rem; font-weight:700; margin-bottom:6px; }
    .upi-ref { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid #e8f0e5; font-size:0.9rem; font-family:inherit; outline:none; box-sizing:border-box; }
    .upi-ref:focus { border-color:#76e037; }
    .upi-submit { width:100%; background:#25D366; color:white; border:none; padding:14px; border-radius:14px; font-size:0.9rem; font-weight:700; cursor:pointer; font-family:inherit; margin-top:10px; }
    .upi-submit:disabled { opacity:0.6; cursor:wait; }
    .upi-err { color:#c85a3a; font-size:0.8rem; font-weight:600; min-height:18px; margin-top:8px; }
    .upi-later { font-size:0.75rem; color:#999; margin-top:12px; }
    @media (max-width: 768px), (pointer: coarse) { .upi-apps { display:block; } }`;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

    const wrap = document.createElement('div');
    wrap.className = 'upi-overlay';
    wrap.id = 'upiOverlay';
    wrap.innerHTML = `
    <div class="upi-modal" role="dialog" aria-modal="true" aria-labelledby="upiTitle">
        <button class="upi-close" id="upiCloseBtn" aria-label="Close">✕</button>
        <div class="upi-title" id="upiTitle">Scan &amp; Pay with UPI</div>
        <div class="upi-sub">GPay, PhonePe, Paytm or any UPI app</div>
        <div class="upi-amount" id="upiAmount"></div>
        <div class="upi-order" id="upiOrderNo"></div>
        <div class="upi-qr" id="upiQr"></div>
        <div class="upi-id">UPI ID: <strong id="upiIdText"></strong><button class="upi-copy" id="upiCopyBtn">Copy</button></div>
        <div class="upi-apps">
            <div class="upi-apps-label">Or pay on this phone with</div>
            <div class="upi-apps-grid">
                <a class="upi-app" data-app="gpay" href="#"><i style="background:#4285f4">G</i>Google Pay</a>
                <a class="upi-app" data-app="phonepe" href="#"><i style="background:#5f259f">Pe</i>PhonePe</a>
                <a class="upi-app" data-app="paytm" href="#"><i style="background:#00baf2">P</i>Paytm</a>
                <a class="upi-app" data-app="other" href="#"><i style="background:#3e7a37">₹</i>Other UPI app</a>
            </div>
            <div class="upi-apps-hint">App didn't open? Copy the UPI ID above and pay the exact amount in any UPI app.</div>
        </div>
        <ol class="upi-steps">
            <li>Scan the QR, or tap your UPI app above. The amount is filled in for you.</li>
            <li>Complete the payment in your UPI app.</li>
            <li>Enter the 12-digit UPI transaction ID (UTR) below.</li>
        </ol>
        <label class="upi-ref-label" for="upiRef">UPI Transaction ID (UTR)</label>
        <input type="text" id="upiRef" class="upi-ref" placeholder="e.g. 412345678901" inputmode="numeric" maxlength="14" autocomplete="off">
        <button class="upi-submit" id="upiSubmitBtn">I've Paid: Confirm Payment</button>
        <div class="upi-err" id="upiErr"></div>
        <div class="upi-later">Closed this by mistake? You can finish payment anytime from <a href="orders.html">My Orders</a>.</div>
    </div>`;
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(wrap));

    let current = null; // { orderNo, amount, onPaid, onClose }

    function close(){
        wrap.classList.remove('open');
        document.body.style.overflow = '';
        const c = current; current = null;
        if(c && c.onClose) c.onClose();
    }

    wrap.addEventListener('click', e => { if(e.target === wrap) close(); });
    wrap.querySelector('#upiCloseBtn').addEventListener('click', close);

    wrap.querySelector('#upiCopyBtn').addEventListener('click', function(){
        navigator.clipboard.writeText(wrap.querySelector('#upiIdText').textContent).then(()=>{
            this.textContent = 'Copied!';
            setTimeout(()=> this.textContent = 'Copy', 1500);
        });
    });

    wrap.querySelector('#upiSubmitBtn').addEventListener('click', async function(){
        if(!current) return;
        const err = wrap.querySelector('#upiErr');
        const ref = wrap.querySelector('#upiRef').value.replace(/\s/g, '');
        err.textContent = '';
        if(!/^\d{12}$/.test(ref)){
            err.textContent = 'Please enter the 12-digit UPI transaction ID from your payment app.';
            return;
        }
        this.disabled = true;
        const { error } = await sb.rpc('submit_payment_ref', { p_order_no: current.orderNo, p_utr: ref });
        this.disabled = false;
        if(error){ err.textContent = errMsg(error); return; }
        const c = current;
        current = null; // paid: skip onClose
        wrap.classList.remove('open');
        document.body.style.overflow = '';
        if(c.onPaid) c.onPaid(ref);
    });

    // UPI payment details; VPAs are URL-safe and some apps reject an encoded "@"
    function upiQuery(s, amount, orderNo){
        return 'pa=' + s.upi_id
            + '&pn=' + encodeURIComponent(s.upi_payee_name || 'Manyam Foods')
            + '&am=' + Number(amount).toFixed(2)
            + '&cu=INR'
            + '&tn=' + encodeURIComponent('Order ' + orderNo);
    }

    // A plain upi:// link opens whichever app the phone set as its default UPI app,
    // so each button targets one app: Android intent with the app's package, iOS app scheme.
    const UPI_APPS = {
        gpay:    { pkg: 'com.google.android.apps.nbu.paisa.user', ios: 'gpay://upi/pay' },
        phonepe: { pkg: 'com.phonepe.app',                        ios: 'phonepe://pay' },
        paytm:   { pkg: 'net.one97.paytm',                        ios: 'paytmmp://pay' }
    };
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    function appLink(app, query){
        const a = UPI_APPS[app];
        if(!a) return 'upi://pay?' + query;
        if(isAndroid) return 'intent://pay?' + query + '#Intent;scheme=upi;package=' + a.pkg + ';end';
        if(isIOS) return a.ios + '?' + query;
        return 'upi://pay?' + query;
    }

    window.openUpiPay = async function({ orderNo, amount, onPaid, onClose }){
        const s = await getSettings();
        if(!s.upi_id){ alert('UPI payments are not set up yet. Please contact us from the Support page.'); return; }
        current = { orderNo, amount, onPaid, onClose };
        const query = upiQuery(s, amount, orderNo);
        const link = 'upi://pay?' + query;
        wrap.querySelector('#upiAmount').textContent = rupees(amount);
        wrap.querySelector('#upiOrderNo').textContent = 'Order ' + orderNo;
        wrap.querySelector('#upiIdText').textContent = s.upi_id;
        wrap.querySelectorAll('.upi-app').forEach(a => { a.href = appLink(a.dataset.app, query); });
        wrap.querySelector('#upiRef').value = '';
        wrap.querySelector('#upiErr').textContent = '';
        const qr = wrap.querySelector('#upiQr');
        qr.innerHTML = '';
        new QRCode(qr, { text: link, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
        wrap.classList.add('open');
        document.body.style.overflow = 'hidden';
    };
})();
