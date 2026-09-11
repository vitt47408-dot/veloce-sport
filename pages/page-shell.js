const page = document.body.dataset.page;

async function loadSharedApp() {
  const response = await fetch('/index.html');
  const source = await response.text();
  const documentSource = new DOMParser().parseFromString(source, 'text/html');
  document.body.innerHTML = documentSource.body.innerHTML;
  document.body.className = `subpage subpage-${page}`;
  document.querySelector('script[src="app.js"]')?.remove();
  document.querySelector('.topbar')?.insertAdjacentHTML('afterend', `<nav class="subpage-nav" aria-label="Điều hướng trang"><a href="/">Trang chủ</a><a class="${page === 'products' ? 'active' : ''}" href="/products.html">Sản phẩm</a><a class="${page === 'cart' || page === 'checkout' ? 'active' : ''}" href="/cart.html">Giỏ hàng</a><a class="${page === 'orders' ? 'active' : ''}" href="/orders.html">Đơn hàng</a><a class="${page === 'account' ? 'active' : ''}" href="/account.html">Tài khoản</a></nav>`);
  if (page === 'cart') {
    document.querySelector('#cart-panel .drawer-head')?.insertAdjacentHTML('afterbegin', '<a class="drawer-back" href="/" aria-label="Về trang chủ">←</a>');
    document.querySelector('#cart-panel .cart-footer')?.insertAdjacentHTML('afterbegin', '<a class="proceed-checkout" href="/checkout.html">Tiến hành đặt hàng <span>→</span></a>');
  }
  if (page === 'checkout') {
    const head = document.querySelector('#cart-panel .drawer-head');
    head?.insertAdjacentHTML('afterbegin', '<a class="drawer-back" href="/cart.html" aria-label="Về giỏ hàng">←</a>');
    const eyebrow = head?.querySelector('.eyebrow');
    const title = head?.querySelector('strong');
    if (eyebrow) eyebrow.textContent = 'Veloce payment';
    if (title) title.textContent = 'Thanh toán';
  }

  const appScript = document.createElement('script');
  appScript.src = '/app.js';
  appScript.onload = () => {
    const triggers = {
      cart: '#floating-cart',
      orders: '#track-order',
      account: '#profile-chip',
      checkout: '#floating-cart'
    };
    if (triggers[page]) document.querySelector(triggers[page])?.click();
  };
  document.body.appendChild(appScript);
}

loadSharedApp().catch(() => {
  document.body.innerHTML = '<main class="subpage-error"><h1>Không thể tải trang</h1><a href="/">Về trang chủ</a></main>';
});
