const API_BASE = '/api';
let products = [];
let meta = { categories: [], brands: [], banners: [], combos: [], vouchers: [], blog: [], settings: { freeShipMin: 499000, shipping: { standard: 30000, express: 45000, store: 0 } } };
let cart = JSON.parse(localStorage.getItem('veloce-cart') || '[]');
let compareIds = JSON.parse(localStorage.getItem('veloce-compare') || '[]');
let token = localStorage.getItem('veloce-token') || '';
let user = JSON.parse(localStorage.getItem('veloce-user') || 'null');
let activeCategory = 'all', activeProduct = null, modalQuantity = 1, selectedSize = '', selectedColor = '', couponCode = '', couponDiscount = 0, couponType = '', orderFilter = 'all';
let authMode = 'login';
const categoryGroups = [
  { id: 'shoes', name: 'Giày thể thao', icon: '👟', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85', description: 'Bóng đá, chạy bộ, bóng rổ, cầu lông và gym', match: p => p.type === 'shoes' || String(p.category || '').includes('shoes') },
  { id: 'apparel', name: 'Quần áo thể thao', icon: '👕', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=85', description: 'Áo, quần và áo khoác vận động', match: p => p.category === 'apparel' },
  { id: 'football', name: 'Bóng đá', icon: '⚽', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=700&q=85', description: 'Trang bị thi đấu và luyện tập bóng đá', match: p => p.sport === 'football' },
  { id: 'badminton', name: 'Cầu lông', icon: '🏸', image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=700&q=85', description: 'Vợt, giày và phụ kiện cầu lông', match: p => p.sport === 'badminton' },
  { id: 'gym', name: 'Gym', icon: '🏋️', image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=85', description: 'Dụng cụ và trang phục tập luyện', match: p => p.sport === 'training' || (p.useCases || []).includes('gym') },
  { id: 'accessories', name: 'Phụ kiện', icon: '🎒', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85', description: 'Balo, túi, tất, mũ và phụ kiện', match: p => ['accessories', 'bags'].includes(p.category) || p.type === 'accessory' }
];
const categoryGroup = id => categoryGroups.find(group => group.id === id);
const grid = document.getElementById('product-grid');
const toast = document.getElementById('toast');
const money = value => new Intl.NumberFormat('vi-VN').format(Math.round(value || 0)) + 'đ';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const headers = () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error || 'API_ERROR'), json);
  return json.data;
}
function priceOf(p) { return p.displayPrice || (p.salePriceVnd > 0 ? p.salePriceVnd : p.priceVnd || p.price); }
function initials(name) { return String(name || 'IN').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(); }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }
function openPanel(id) { const panel = document.getElementById(id); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
function closePanels() { document.querySelectorAll('.store-panel,.product-modal,.ai-panel').forEach(panel => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }); }
function persistSession() {
  localStorage.setItem('veloce-token', token);
  localStorage.setItem('veloce-user', JSON.stringify(user));
  document.getElementById('header-avatar').textContent = initials(user?.name);
}
function setSession(data) { token = data.token; user = data.user; persistSession(); showToast('Xin chào ' + user.name); closePanels(); renderMember(); }

function cardHtml(product) {
  const sale = product.salePriceVnd > 0;
  const wished = user?.wishlist?.includes(product.id);
  return `<article class="product-card" data-id="${product.id}">
    <div class="product-image" style="--image-bg:${product.bg};--product-color:${product.color}">
      <button class="heart ${wished ? 'active' : ''}" data-wish="${product.id}" aria-label="Yêu thích">${wished ? '♥' : '♡'}</button>
      ${product.bestseller ? '<span class="product-badge">Best seller</span>' : product.isNew ? '<span class="product-badge">Mới</span>' : ''}
      <img class="product-photo" src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
      <div class="product-shape"></div>
    </div>
    <div class="product-info"><h3>${escapeHtml(product.name)}</h3>
      <div class="product-meta"><span>${escapeHtml(product.categoryLabel)} · ${product.rating || 0}★</span>
      <strong class="price">${sale ? `<s>${money(product.priceVnd)}</s> ${money(product.salePriceVnd)}` : money(priceOf(product))}</strong></div>
      <span class="stock-status ${product.stock > 0 ? 'in-stock' : 'out-stock'}">${product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}</span>
    </div><button class="quick-add" data-quick-add="${product.id}" ${product.stock < 1 ? 'disabled' : ''}>Thêm vào giỏ <span>→</span></button></article>`;
}
function getFilteredProducts() {
  const query = document.getElementById('product-search').value.toLowerCase().trim();
  const brand = document.getElementById('brand-filter').value;
  const price = document.getElementById('price-filter').value;
  const sport = document.getElementById('sport-filter').value;
  const useCase = document.getElementById('usecase-filter').value;
  const size = document.getElementById('size-filter').value;
  const color = document.getElementById('color-filter').value;
  const sort = document.getElementById('sort-filter').value;
  let list = products.filter(p => {
    const text = `${p.name} ${p.type} ${p.brandLabel} ${p.categoryLabel} ${p.sportLabel}`.toLowerCase();
    const unit = priceOf(p);
    if (query && !text.includes(query)) return false;
    if (activeCategory !== 'all' && !categoryGroup(activeCategory)?.match(p)) return false;
    if (brand !== 'all' && p.brand !== brand) return false;
    if (sport !== 'all' && p.sport !== sport) return false;
    if (useCase !== 'all' && !(p.useCases || []).includes(useCase)) return false;
    if (size !== 'all' && !(p.sizes || []).includes(size)) return false;
    if (color !== 'all' && !(p.colors || []).includes(color)) return false;
    if (price === 'under200' && unit >= 200000) return false;
    if (price === '200to500' && (unit < 200000 || unit > 500000)) return false;
    if (price === '500to1000' && (unit < 500000 || unit > 1000000)) return false;
    if (price === 'over1000' && unit <= 1000000) return false;
    return true;
  });
  if (sort === 'price-asc') list.sort((a, b) => priceOf(a) - priceOf(b));
  if (sort === 'price-desc') list.sort((a, b) => priceOf(b) - priceOf(a));
  if (sort === 'bestseller') list.sort((a, b) => b.soldCount - a.soldCount);
  if (sort === 'newest') list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return list;
}
function renderRails() {
  document.getElementById('featured-grid').innerHTML = products.filter(p => p.featured).slice(0, 4).map(cardHtml).join('');
  document.getElementById('new-grid').innerHTML = products.filter(p => p.isNew).slice(0, 4).map(cardHtml).join('');
  document.getElementById('best-grid').innerHTML = products.filter(p => p.bestseller).slice(0, 4).map(cardHtml).join('');
  document.getElementById('sale-grid').innerHTML = products.filter(p => p.salePriceVnd > 0).slice(0, 4).map(cardHtml).join('');
  document.getElementById('banner-track').innerHTML = (meta.banners || []).slice(0, 3).map(b => `<article class="promo-tile" style="--banner-image:url('${b.image || ''}')"><strong>${escapeHtml(b.title)}</strong><span>${escapeHtml(b.subtitle)}</span></article>`).join('');
  document.getElementById('cat-showcase').innerHTML = categoryGroups.map(c => `<button class="cat-tile" data-jump="${c.id}"><img class="cat-photo" src="${c.image}" alt=""><span class="cat-icon" aria-hidden="true">${c.icon}</span><h3>${escapeHtml(c.name)}</h3><p>${escapeHtml(c.description)}</p></button>`).join('');
  document.getElementById('combo-row').innerHTML = (meta.combos || []).map(c => `<article class="combo-card"><strong>${escapeHtml(c.name)}</strong><span>${money(c.priceVnd)}</span><button data-combo="${c.id}">Thêm combo</button></article>`).join('');
  document.getElementById('blog-row').innerHTML = (meta.blog || []).map(b => `<article class="blog-card"><strong>${escapeHtml(b.title)}</strong><p>${escapeHtml(b.excerpt)}</p></article>`).join('');
  const flash = meta.flashSale;
  const flashEl = document.getElementById('flash-banner');
  const flashProduct = flash?.active ? products.find(p => p.id === flash.productId) : null;
  if (flashProduct) {
    flashEl.hidden = false;
    flashEl.innerHTML = `<span>FLASH SALE</span><strong>${escapeHtml(flashProduct.name)}</strong> còn ${money(priceOf(flashProduct))} · hết ${new Date(flash.endsAt).toLocaleDateString('vi-VN')} <button data-open-flash="${flashProduct.id}">Mua ngay</button>`;
  } else flashEl.hidden = true;
  const adminLink = document.querySelector('.admin-link');
  if (adminLink) adminLink.hidden = !(user?.role === 'admin' || user?.role === 'staff');
}
function renderFilters() {
  const tabs = document.getElementById('category-tabs');
  const cats = [{ id: 'all', name: 'Tất cả', count: products.length }, ...categoryGroups.map(group => ({ ...group, count: products.filter(group.match).length }))];
  tabs.innerHTML = cats.map(c => `<button class="tab ${c.id === activeCategory ? 'active' : ''}" data-category="${c.id}">${c.name} <small>${String(c.count).padStart(2, '0')}</small></button>`).join('');
  const brand = document.getElementById('brand-filter');
  const current = brand.value;
  brand.innerHTML = '<option value="all">Tất cả thương hiệu</option>' + (meta.brands || []).map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  brand.value = current || 'all';
  const sizes = [...new Set(products.flatMap(p => p.sizes || []))];
  const colors = [...new Set(products.flatMap(p => p.colors || []))];
  document.getElementById('size-filter').innerHTML = '<option value="all">Mọi size</option>' + sizes.map(s => `<option>${s}</option>`).join('');
  document.getElementById('color-filter').innerHTML = '<option value="all">Mọi màu</option>' + colors.map(s => `<option>${s}</option>`).join('');
}
function renderProducts() {
  const visible = getFilteredProducts();
  grid.innerHTML = visible.length ? visible.map(cardHtml).join('') : '<div class="empty-state">Không tìm thấy sản phẩm phù hợp.</div>';
}
function bindGrid(el) {
  el.addEventListener('click', async event => {
    const wish = event.target.closest('[data-wish]');
    if (wish) { event.stopPropagation(); await toggleWish(wish.dataset.wish); return; }
    const quickAdd = event.target.closest('[data-quick-add]');
    if (quickAdd) { event.stopPropagation(); const product = products.find(p => p.id === quickAdd.dataset.quickAdd); if (product?.stock > 0) addToCart(product); return; }
    const card = event.target.closest('.product-card');
    if (card) openProduct(products.find(p => p.id === card.dataset.id));
  });
}
async function toggleWish(productId) {
  if (!token) return openPanel('auth-panel');
  try {
    if (user.wishlist?.includes(productId)) {
      user.wishlist = await api(`/wishlist/${productId}`, { method: 'DELETE' });
      showToast('Đã bỏ yêu thích');
    } else {
      user.wishlist = await api('/wishlist', { method: 'POST', body: JSON.stringify({ productId }) });
      showToast('Đã lưu vào yêu thích');
    }
    persistSession(); renderProducts(); renderRails();
  } catch { showToast('Cần đăng nhập'); openPanel('auth-panel'); }
}

async function openProduct(product) {
  if (!product) return;
  try { const full = await api(`/products/${product.id}`); activeProduct = { ...product, ...full }; } catch { activeProduct = product; }
  modalQuantity = 1;
  selectedSize = (activeProduct.sizes || [''])[0];
  selectedColor = (activeProduct.colors || [''])[0];
  document.getElementById('modal-product-image').style.cssText = `--image-bg:${activeProduct.bg};--product-color:${activeProduct.color}`;
  const gallery = activeProduct.images?.length ? activeProduct.images : [activeProduct.image];
  document.getElementById('modal-product-image').innerHTML = `${activeProduct.video ? `<video class="product-photo" src="${activeProduct.video}" controls></video>` : `<img class="product-photo" src="${gallery[0]}" alt="${escapeHtml(activeProduct.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`}<div class="product-shape"></div>${gallery.length > 1 ? `<div class="modal-thumbs">${gallery.map((src, i) => `<img data-thumb="${src}" class="${i === 0 ? 'on' : ''}" src="${src}" alt="">`).join('')}</div>` : ''}`;
  document.getElementById('modal-category').textContent = `${activeProduct.categoryLabel} / ${activeProduct.sportLabel}`;
  document.getElementById('modal-name').textContent = activeProduct.name;
  const sale = activeProduct.salePriceVnd > 0;
  document.getElementById('modal-price').innerHTML = sale ? `<s>${money(activeProduct.priceVnd)}</s> ${money(activeProduct.salePriceVnd)}` : money(priceOf(activeProduct));
  document.getElementById('modal-stock').textContent = activeProduct.stock > 0 ? `Còn ${activeProduct.stock} sản phẩm · ${activeProduct.rating || 0}★ (${activeProduct.reviewCount || 0} đánh giá)` : 'Hết hàng — bấm theo dõi để nhận thông báo';
  document.getElementById('modal-description').textContent = activeProduct.description;
  document.getElementById('modal-specs').innerHTML = `<span>Trọng lượng <b>${activeProduct.weight || '—'}</b></span><span>Chất liệu <b>${activeProduct.material || '—'}</b></span><span>Công nghệ <b>${activeProduct.tech || '—'}</b></span>`;
  document.getElementById('modal-color').innerHTML = (activeProduct.colors || []).map(c => `<option ${c === selectedColor ? 'selected' : ''}>${c}</option>`).join('');
  document.getElementById('modal-sizes').innerHTML = (activeProduct.sizes || []).map(size => `<button class="size-btn ${size === selectedSize ? 'active' : ''}" data-size="${size}">${size}</button>`).join('');
  document.getElementById('modal-quantity').textContent = modalQuantity;
  const reviews = activeProduct.reviews || [];
  const reviewForm = activeProduct.hasReviewed ? '<p class="muted-copy review-note">Bạn đã đánh giá sản phẩm này.</p>' : activeProduct.canReview ? `<form id="review-form" class="review-form"><select id="review-stars">${[5,4,3,2,1].map(n => `<option value="${n}">${n} sao</option>`).join('')}</select><input id="review-comment" placeholder="Bình luận"><input id="review-media" placeholder="URL hình/video (tuỳ chọn)"><button type="submit">Gửi đánh giá</button></form>` : '<p class="muted-copy review-note">Chỉ khách đã nhận sản phẩm mới có thể đánh giá.</p>';
  document.getElementById('modal-reviews').innerHTML = `<h4>Đánh giá</h4>${reviews.map(r => `<div class="review-item"><strong>${escapeHtml(r.userName)}</strong> ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}<p>${escapeHtml(r.comment)}</p></div>`).join('') || '<p class="muted-copy">Chưa có đánh giá.</p>'}${reviewForm}`;
  document.getElementById('modal-related').innerHTML = `<h4>Sản phẩm liên quan</h4><div class="product-grid rail-grid">${(activeProduct.related || []).map(cardHtml).join('')}</div>`;
  document.getElementById('review-form')?.addEventListener('submit', submitReview);
  openPanel('product-modal');
}
async function submitReview(event) {
  event.preventDefault();
  if (!token) return openPanel('auth-panel');
  try {
    await api('/reviews', { method: 'POST', body: JSON.stringify({ productId: activeProduct.id, rating: Number(document.getElementById('review-stars').value), comment: document.getElementById('review-comment').value, images: document.getElementById('review-media').value ? [document.getElementById('review-media').value] : [] }) });
    showToast('Đã gửi đánh giá'); openProduct(activeProduct);
  } catch (error) { showToast(error.error === 'REVIEW_NOT_ELIGIBLE' ? 'Bạn cần nhận hàng trước khi đánh giá' : error.error === 'REVIEW_ALREADY_EXISTS' ? 'Bạn đã đánh giá sản phẩm này' : 'Không thể gửi đánh giá'); }
}

function cartTotals() {
  const subtotal = cart.filter(item => item.selected !== false).reduce((sum, item) => sum + priceOf(item) * item.quantity, 0);
  
  let discount = couponType === 'shipping' ? 0 : (couponDiscount ? (couponDiscount < 1 ? Math.round(subtotal * couponDiscount) : couponDiscount) : 0);
  const method = document.getElementById('ship-method')?.value || 'standard';
  let ship = meta.settings?.shipping?.[method] ?? 30000;
  if (!subtotal || subtotal >= (meta.settings?.freeShipMin || 499000)) ship = 0;
  if (couponType === 'shipping') ship = Math.max(0, ship - couponDiscount);
  return { subtotal, discount, ship, total: subtotal - discount + ship };
}
function renderCart() {
  const body = document.getElementById('cart-body');
  body.innerHTML = cart.length ? cart.map((item, index) => `<div class="cart-item ${item.selected === false ? 'cart-item-muted' : ''}">
    <input class="cart-select" type="checkbox" data-select="${index}" ${item.selected !== false ? 'checked' : ''} aria-label="Chọn ${escapeHtml(item.name)}">
    <div class="cart-thumb" style="--image-bg:${item.bg};--product-color:${item.color}"><img src="${item.image || ''}" alt=""></div>
    <div class="cart-thumb" style="--image-bg:${item.bg};--product-color:${item.color}"><img src="${item.image || ''}" alt=""></div>
    <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.selectedColor || '')} / ${escapeHtml(item.selectedSize)}</small>
      <div class="variant-mini">
        <select data-color="${index}">${(item.colors || [item.selectedColor]).map(c => `<option ${c === item.selectedColor ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}</select>
        <select data-size="${index}">${(item.sizes || [item.selectedSize]).map(s => `<option ${s === item.selectedSize ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}</select>
      </div>
      <div class="qty-mini"><button data-dec="${index}">−</button><b>${item.quantity}</b><button data-inc="${index}">+</button></div>
      <span>${money(priceOf(item) * item.quantity)}</span></div>
    <button class="remove-item" data-index="${index}">×</button></div>`).join('') : '<div class="empty-state">Giỏ hàng đang trống.</div>';
  const t = cartTotals();
  document.getElementById('total-breakdown').innerHTML = `<div><span>Tạm tính</span><b>${money(t.subtotal)}</b></div><div><span>Giảm giá</span><b>-${money(t.discount)}</b></div><div><span>Vận chuyển</span><b>${t.ship ? money(t.ship) : 'Miễn phí'}</b></div>`;
  document.getElementById('cart-total').textContent = money(t.total);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('floating-cart-count').textContent = count;
  localStorage.setItem('veloce-cart', JSON.stringify(cart));
}
function addToCart(product, quantity = 1, size = product.sizes?.[0], color = product.colors?.[0]) {
  const existing = cart.find(item => item.id === product.id && item.selectedSize === size && item.selectedColor === color);
  if (existing) existing.quantity += quantity;
  else cart.push({ ...product, quantity, selected: true, selectedSize: size, selectedColor: color });
  renderCart(); showToast('Đã thêm vào giỏ hàng');
}

const statusLabel = { pending: 'Chờ xác nhận', pending_payment: 'Chờ thanh toán', confirmed: 'Đang xử lý', preparing: 'Đang xử lý', shipping: 'Đang giao', delivered: 'Hoàn thành', cancelled: 'Đã hủy' };
async function renderOrder() {
  const body = document.getElementById('order-body');
  let orders = [];
  try {
    if (token) orders = await api('/orders');
    else {
      const last = localStorage.getItem('veloce-last-order');
      if (last) { const one = await api('/orders/' + last); if (one) orders = [one]; }
    }
  } catch { orders = []; }
  const customerStatus = order => order.status === 'confirmed' ? 'preparing' : order.status;
  const orderFilters = [{ id: 'all', label: 'Tất cả' }, { id: 'pending', label: 'Chờ xác nhận' }, { id: 'preparing', label: 'Đang xử lý' }, { id: 'shipping', label: 'Đang giao' }, { id: 'delivered', label: 'Hoàn thành' }, { id: 'cancelled', label: 'Đã hủy' }];
  const filterBar = `<div class="order-filters">${orderFilters.map(filter => `<button class="${orderFilter === filter.id ? 'active' : ''}" data-order-status="${filter.id}">${filter.label}<b>${filter.id === 'all' ? orders.length : orders.filter(order => customerStatus(order) === filter.id).length}</b></button>`).join('')}</div>`;
  const visibleOrders = orderFilter === 'all' ? orders : orders.filter(order => customerStatus(order) === orderFilter);
  if (!visibleOrders.length) { body.innerHTML = filterBar + '<div class="empty-state">Chưa có đơn hàng ở trạng thái này.</div>'; return; }
  body.innerHTML = filterBar + visibleOrders.map(order => `<div class="order-card">
    <div class="order-status"><span class="status-dot"></span><strong>${statusLabel[order.status] || order.status}</strong></div>
    <p>Mã đơn <strong>#${order.shortCode || order.id.slice(0, 8)}</strong> · ${money(order.totalVnd)}</p>
    <ul class="order-items">${(order.items || []).map(i => `<li>${escapeHtml(i.name)} × ${i.quantity} · ${escapeHtml(i.selectedColor || '')}/${escapeHtml(i.selectedSize || '')}</li>`).join('')}</ul>
    <div class="order-steps">${['pending','preparing','shipping','delivered'].map(s => `<span class="${s === customerStatus(order) ? 'active' : (['pending','preparing','shipping','delivered'].indexOf(s) < ['pending','preparing','shipping','delivered'].indexOf(customerStatus(order)) ? 'done' : '')}">${statusLabel[s]}</span>`).join('')}</div>
    <p class="muted-copy">${order.trackingCode ? 'Vận đơn ' + order.trackingCode : 'Chưa có mã vận đơn'} · ${order.paymentMethod?.toUpperCase()} · Thanh toán: ${order.paymentStatus} · ${escapeHtml(order.shipping?.address || '')}</p>
    ${['bank','momo','zalopay','online'].includes(order.paymentMethod) && order.paymentStatus !== 'paid' ? `<button class="text-btn" data-payment-order="${order.id}">Mở thông tin thanh toán</button>` : ''}
    ${['pending','confirmed','preparing'].includes(order.status) ? `<button class="text-btn" data-cancel="${order.id}">Hủy đơn</button>` : ''}
    ${order.status === 'delivered' ? `<button class="text-btn" data-return="${order.id}">Đổi trả / hoàn tiền</button>` : ''}
  </div>`).join('');
}
async function renderMember() {
  const body = document.getElementById('member-body');
  if (!user) { body.innerHTML = '<p>Bạn chưa đăng nhập.</p><button class="primary-btn" id="goto-auth">Đăng nhập / Đăng ký</button>'; document.getElementById('goto-auth')?.addEventListener('click', () => { closePanels(); openPanel('auth-panel'); }); return; }
  document.getElementById('member-name').textContent = user.name;
  let wishlist = [];
  try { wishlist = await api('/wishlist'); } catch { wishlist = []; }
  let myReviews = [];
  try { myReviews = await api('/me/reviews'); } catch { myReviews = []; }
  const memberSettings = JSON.parse(localStorage.getItem('veloce-settings') || '{"orderUpdates":true,"promotions":true}');
  const next = user.tier === 'Pro' ? 0 : user.tier === 'Club' ? 2000 - user.points : 800 - user.points;
  body.innerHTML = `<div class="member-level"><span class="avatar">${initials(user.name)}</span><div><strong>${escapeHtml(user.tier)} • ${user.points} điểm</strong><small>${next > 0 ? next + ' điểm nữa lên hạng tiếp' : 'Hạng cao nhất'}</small></div></div>
    <div class="member-perks"><div><strong>10%</strong><span>Sinh nhật</span></div><div><strong>${user.points}</strong><span>Điểm hiện có</span></div><div><strong>30 ngày</strong><span>Đổi trả</span></div></div>
    <nav class="member-menu" aria-label="Tài khoản">${(user.role === 'admin' || user.role === 'staff') ? '<a class="member-admin-link" href="/admin.html">⚙️ <span>Quản trị cửa hàng</span><b>→</b></a>' : ''}<button data-member-target="open-orders-from-member">📦 <span>Đơn hàng của tôi</span><b>→</b></button><button data-member-target="wishlist-section">❤️ <span>Sản phẩm yêu thích</span><b>→</b></button><button data-member-target="voucher-section">🎟️ <span>Voucher</span><b>→</b></button><button data-member-target="address-section">📍 <span>Địa chỉ giao hàng</span><b>→</b></button><button data-member-target="contact-section">☎️ <span>Liên hệ cửa hàng</span><b>→</b></button><button data-member-target="settings-section">⚙️ <span>Cài đặt</span><b>→</b></button></nav>
    <h4>Thông tin cá nhân</h4>
    <form id="profile-form" class="auth-form">
      <input name="name" value="${escapeHtml(user.name)}" placeholder="Họ tên">
      <input name="email" value="${escapeHtml(user.email || '')}" placeholder="Email">
      <input name="phone" value="${escapeHtml(user.phone || '')}" placeholder="Điện thoại">
      <input name="height" type="number" value="${user.height || ''}" placeholder="Chiều cao (cm)">
      <input name="weight" type="number" value="${user.weight || ''}" placeholder="Cân nặng (kg)">
      <input name="footLength" type="number" step="0.1" value="${user.footLength || ''}" placeholder="Dài bàn chân (cm)">
      <button class="secondary-btn" type="submit">Lưu hồ sơ</button>
    </form>
    <h4 id="address-section">Địa chỉ</h4>
    ${(user.addresses || []).map(a => `<div class="addr-row"><b>${escapeHtml(a.label)}</b> ${escapeHtml(a.address)} <button data-del-addr="${a.id}">xóa</button></div>`).join('') || '<p class="muted-copy">Chưa có địa chỉ.</p>'}
    <form id="addr-form" class="auth-form"><input name="label" placeholder="Nhãn (Nhà / Công ty)"><input name="address" placeholder="Địa chỉ mới" required><button type="submit">Thêm địa chỉ</button></form>
    <h4 id="voucher-section">Voucher</h4><p class="muted-copy">${(meta.vouchers || []).map(v => v.code).join(' · ')}</p>
    <h4>Mã giới thiệu</h4><p><code>${user.referralCode}</code> — bạn bè đăng ký bằng mã này, cả hai nhận điểm.</p>
    <h4 id="wishlist-section">Yêu thích</h4><div class="product-grid rail-grid">${wishlist.map(cardHtml).join('') || '<p class="muted-copy">Chưa lưu sản phẩm.</p>'}</div>
    <h4>Đánh giá đã viết</h4>${myReviews.map(r => `<div class="review-item"><strong>${r.rating}★</strong> ${escapeHtml(r.comment)}</div>`).join('') || '<p class="muted-copy">Chưa có đánh giá.</p>'}
    <h4 id="settings-section">Cài đặt</h4>
    <form id="settings-form" class="settings-form"><label><input type="checkbox" name="orderUpdates" ${memberSettings.orderUpdates ? 'checked' : ''}> Cập nhật trạng thái đơn hàng</label><label><input type="checkbox" name="promotions" ${memberSettings.promotions ? 'checked' : ''}> Nhận thông báo ưu đãi</label><button class="secondary-btn" type="submit">Lưu cài đặt</button></form>
    <h4 id="contact-section">Liên hệ cửa hàng</h4><div class="contact-links"><a href="tel:19006868">☎ 1900 6868</a><a href="mailto:care@veloce.vn">✉ care@veloce.vn</a><button class="text-btn" id="open-shop-from-member">Chat với shop</button></div>
    <div class="member-actions"><button class="text-btn" id="open-orders-from-member">Đơn hàng của tôi</button>${(user.role === 'admin' || user.role === 'staff') ? '<a class="text-btn" href="/admin.html">Trang quản trị</a>' : ''}<button class="text-btn" id="logout-btn">Đăng xuất</button></div>`;
  document.getElementById('profile-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target); const payload = Object.fromEntries(fd.entries());
    payload.height = Number(payload.height || 0); payload.weight = Number(payload.weight || 0); payload.footLength = Number(payload.footLength || 0);
    user = await api('/me', { method: 'PUT', body: JSON.stringify(payload) }); persistSession(); showToast('Đã lưu hồ sơ');
  });
  document.getElementById('addr-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    const addr = await api('/me/addresses', { method: 'POST', body: JSON.stringify({ label: fd.get('label'), address: fd.get('address') }) });
    user.addresses = user.addresses || []; user.addresses.push(addr); persistSession(); renderMember();
  });
  body.querySelectorAll('[data-del-addr]').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/me/addresses/${btn.dataset.delAddr}`, { method: 'DELETE' });
    user.addresses = user.addresses.filter(a => a.id !== btn.dataset.delAddr); persistSession(); renderMember();
  }));
  document.getElementById('logout-btn').addEventListener('click', () => { token = ''; user = null; persistSession(); closePanels(); showToast('Đã đăng xuất'); });
  document.getElementById('open-orders-from-member').addEventListener('click', () => { closePanels(); renderOrder(); openPanel('order-panel'); });
  body.querySelectorAll('[data-member-target]').forEach(button => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.memberTarget);
    if (target?.id === 'open-orders-from-member') target.click();
    else target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  document.getElementById('settings-form').addEventListener('submit', event => {
    event.preventDefault(); const form = new FormData(event.target);
    localStorage.setItem('veloce-settings', JSON.stringify({ orderUpdates: form.has('orderUpdates'), promotions: form.has('promotions') })); showToast('Đã lưu cài đặt');
  });
  document.getElementById('open-shop-from-member').addEventListener('click', () => { closePanels(); openPanel('shop-panel'); });
  bindGrid(body);
}

function syncAuthForm() {
  document.querySelectorAll('[data-auth]').forEach(b => b.classList.toggle('active', b.dataset.auth === authMode));
  document.getElementById('auth-title').textContent = authMode === 'login' ? 'Đăng nhập' : authMode === 'register' ? 'Đăng ký' : 'Quên mật khẩu';
  document.getElementById('auth-name').hidden = authMode !== 'register';
  document.getElementById('auth-phone').hidden = authMode !== 'register';
  document.getElementById('auth-referral').hidden = authMode !== 'register';
  document.getElementById('auth-reset-code').hidden = authMode !== 'forgot';
  document.getElementById('auth-password').required = authMode !== 'forgot';
  document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Đăng nhập' : authMode === 'register' ? 'Tạo tài khoản' : 'Gửi / đặt lại';
}

document.querySelectorAll('[data-auth]').forEach(btn => btn.addEventListener('click', () => { authMode = btn.dataset.auth; syncAuthForm(); }));
document.getElementById('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    if (authMode === 'login') setSession(await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('auth-email').value, password: document.getElementById('auth-password').value }) }));
    else if (authMode === 'register') setSession(await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: document.getElementById('auth-name').value, email: document.getElementById('auth-email').value, phone: document.getElementById('auth-phone').value, password: document.getElementById('auth-password').value, referral: document.getElementById('auth-referral').value }) }));
    else {
      const code = document.getElementById('auth-reset-code').value;
      if (!code) {
        const data = await api('/auth/forgot', { method: 'POST', body: JSON.stringify({ email: document.getElementById('auth-email').value }) });
        showToast('Mã đặt lại (demo): ' + data.demoResetCode);
      } else {
        await api('/auth/reset', { method: 'POST', body: JSON.stringify({ code, password: document.getElementById('auth-password').value }) });
        showToast('Đã đổi mật khẩu, hãy đăng nhập'); authMode = 'login'; syncAuthForm();
      }
    }
  } catch (err) { showToast(err.error === 'INVALID_CREDENTIALS' ? 'Sai tài khoản/mật khẩu' : err.error === 'ACCOUNT_EXISTS' ? 'Tài khoản đã tồn tại' : 'Không thành công'); }
});
document.getElementById('login-google').addEventListener('click', async () => setSession(await api('/auth/social', { method: 'POST', body: JSON.stringify({ provider: 'google', name: 'Google User' }) })));
document.getElementById('login-facebook').addEventListener('click', async () => setSession(await api('/auth/social', { method: 'POST', body: JSON.stringify({ provider: 'facebook', name: 'Facebook User' }) })));

bindGrid(grid); bindGrid(document.getElementById('featured-grid')); bindGrid(document.getElementById('new-grid')); bindGrid(document.getElementById('best-grid')); bindGrid(document.getElementById('sale-grid')); bindGrid(document.getElementById('modal-related'));
document.getElementById('category-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-category]'); if (!tab) return;
  activeCategory = tab.dataset.category; renderFilters(); renderProducts();
});
document.getElementById('cat-showcase').addEventListener('click', event => {
  const tile = event.target.closest('[data-jump]'); if (!tile) return;
  activeCategory = tile.dataset.jump; document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); renderFilters(); renderProducts();
});
document.getElementById('combo-row').addEventListener('click', event => {
  const btn = event.target.closest('[data-combo]'); if (!btn) return;
  const combo = meta.combos.find(c => c.id === btn.dataset.combo);
  combo?.productIds.forEach(id => { const p = products.find(x => x.id === id); if (p) addToCart(p, 1, p.sizes[0], p.colors[0]); });
});
document.querySelectorAll('#product-search,#brand-filter,#price-filter,#sport-filter,#usecase-filter,#size-filter,#color-filter,#sort-filter').forEach(c => c.addEventListener('input', renderProducts));
document.querySelectorAll('[data-scroll-products]').forEach(button => button.addEventListener('click', () => document.getElementById('products').scrollIntoView({ behavior: 'smooth' })));
document.getElementById('show-all').addEventListener('click', () => { activeCategory = 'all'; renderFilters(); renderProducts(); document.getElementById('products').scrollIntoView({ behavior: 'smooth' }); });
document.querySelector('[data-nav="home"]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.getElementById('focus-search').addEventListener('click', () => { window.location.href = '/products.html'; });
document.getElementById('open-cart').addEventListener('click', () => { window.location.href = '/cart.html'; });
document.getElementById('floating-cart').addEventListener('click', () => { renderCart(); openPanel('cart-panel'); });
document.getElementById('open-member').addEventListener('click', () => { if (!user) openPanel('auth-panel'); else { renderMember(); openPanel('member-panel'); } });
document.getElementById('profile-chip').addEventListener('click', () => { if (!user) openPanel('auth-panel'); else { renderMember(); openPanel('member-panel'); } });
document.getElementById('open-orders-nav').addEventListener('click', () => { window.location.href = '/orders.html'; });
document.querySelectorAll('[data-close-panel],[data-close-product]').forEach(button => button.addEventListener('click', closePanels));
document.getElementById('modal-product-image').addEventListener('click', event => {
  const thumb = event.target.closest('[data-thumb]'); if (!thumb) return;
  const img = document.querySelector('#modal-product-image .product-photo');
  if (img && img.tagName === 'IMG') img.src = thumb.dataset.thumb;
  document.querySelectorAll('#modal-product-image [data-thumb]').forEach(t => t.classList.toggle('on', t === thumb));
});
function openAiPanel() {
  document.getElementById('ai-panel').classList.add('open');
  document.getElementById('ai-panel').setAttribute('aria-hidden', 'false');
}
document.getElementById('open-ai-hero')?.addEventListener('click', openAiPanel);
document.getElementById('open-ai-header')?.addEventListener('click', openAiPanel);
document.getElementById('modal-color').addEventListener('change', e => { selectedColor = e.target.value; });
document.getElementById('modal-sizes').addEventListener('click', event => {
  const button = event.target.closest('[data-size]');
  if (!button) return;
  selectedSize = button.dataset.size;
  document.querySelectorAll('#modal-sizes [data-size]').forEach(item => item.classList.toggle('active', item === button));
});
document.getElementById('quantity-minus').addEventListener('click', () => { modalQuantity = Math.max(1, modalQuantity - 1); document.getElementById('modal-quantity').textContent = modalQuantity; });
document.getElementById('quantity-plus').addEventListener('click', () => { modalQuantity += 1; document.getElementById('modal-quantity').textContent = modalQuantity; });
document.getElementById('modal-add').insertAdjacentHTML('afterend', '<button class="primary-btn" id="modal-buy">Mua ngay <span>⚡</span></button>');
document.getElementById('modal-add').addEventListener('click', () => { if (activeProduct.stock < 1) return showToast('Hết hàng'); addToCart(activeProduct, modalQuantity, selectedSize, document.getElementById('modal-color').value); closePanels(); });
document.getElementById('modal-buy').addEventListener('click', () => { if (activeProduct.stock < 1) return showToast('Hết hàng'); addToCart(activeProduct, modalQuantity, selectedSize, document.getElementById('modal-color').value); closePanels(); renderCart(); openPanel('cart-panel'); });
document.getElementById('modal-wish').addEventListener('click', () => toggleWish(activeProduct.id));
document.getElementById('modal-compare').addEventListener('click', () => {
  if (!compareIds.includes(activeProduct.id)) compareIds.push(activeProduct.id);
  if (compareIds.length > 3) compareIds = compareIds.slice(-3);
  localStorage.setItem('veloce-compare', JSON.stringify(compareIds));
  const compareCount = document.getElementById('compare-count');
  if (compareCount) compareCount.textContent = compareIds.length;
  showToast('Đã thêm vào so sánh');
});
document.getElementById('modal-watch').addEventListener('click', async () => {
  if (!token) return openPanel('auth-panel');
  await api('/watch', { method: 'POST', body: JSON.stringify({ productId: activeProduct.id, type: activeProduct.stock < 1 ? 'restock' : 'sale' }) });
  showToast('Đã bật thông báo');
});
document.getElementById('open-compare')?.addEventListener('click', async () => {
  if (!compareIds.length) return showToast('Chọn sản phẩm để so sánh');
  const rows = await api('/compare?ids=' + compareIds.join(','));
  document.getElementById('compare-body').innerHTML = `<table class="compare-table"><thead><tr><th></th>${rows.map(p => `<th>${escapeHtml(p.name)}</th>`).join('')}</tr></thead><tbody>
    <tr><td>Giá</td>${rows.map(p => `<td>${money(priceOf(p))}</td>`).join('')}</tr>
    <tr><td>Trọng lượng</td>${rows.map(p => `<td>${p.weight}</td>`).join('')}</tr>
    <tr><td>Chất liệu</td>${rows.map(p => `<td>${p.material}</td>`).join('')}</tr>
    <tr><td>Công nghệ</td>${rows.map(p => `<td>${p.tech}</td>`).join('')}</tr>
    <tr><td>Đánh giá</td>${rows.map(p => `<td>${p.rating}★</td>`).join('')}</tr></tbody></table>`;
  openPanel('compare-panel');
});
document.querySelector('.cart-body').addEventListener('click', event => {
  if (event.target.dataset.index !== undefined) { cart.splice(Number(event.target.dataset.index), 1); renderCart(); }
  if (event.target.dataset.inc !== undefined) { cart[Number(event.target.dataset.inc)].quantity += 1; renderCart(); }
  if (event.target.dataset.dec !== undefined) { const i = Number(event.target.dataset.dec); cart[i].quantity = Math.max(1, cart[i].quantity - 1); renderCart(); }
});
document.querySelector('.cart-body').addEventListener('change', event => {
  if (event.target.dataset.select !== undefined) cart[Number(event.target.dataset.select)].selected = event.target.checked;
  if (event.target.dataset.color) cart[Number(event.target.dataset.color)].selectedColor = event.target.value;
  if (event.target.dataset.size) cart[Number(event.target.dataset.size)].selectedSize = event.target.value;
  renderCart();
});
document.getElementById('shipping-address').insertAdjacentHTML('afterend', '<textarea id="shipping-note" rows="2" placeholder="Ghi chú giao hàng (tuỳ chọn)"></textarea>');
document.querySelector('.checkout-fields').insertAdjacentHTML('afterbegin', '<div class="checkout-section-title">📍 Địa chỉ nhận hàng</div>');
document.getElementById('payment-method').insertAdjacentHTML('beforebegin', '<div class="checkout-section-title payment-title">💳 Phương thức thanh toán</div>');
document.getElementById('ship-method').addEventListener('change', renderCart);
const paymentSelect = document.getElementById('payment-method');
paymentSelect.insertAdjacentHTML('afterend', '<div class="payment-guide" id="payment-guide"></div>');
function renderPaymentGuide() {
  const guides = {
    cod: ['COD · thanh toán khi nhận', 'Bạn thanh toán tiền mặt cho nhân viên giao hàng khi nhận đủ sản phẩm.'],
    bank: ['Chuyển khoản ngân hàng', 'VCB · 0123456789 · Chủ tài khoản: VELOCE SPORT CO. Ghi rõ mã đơn sau khi đặt hàng.'],
    momo: ['Ví MoMo', 'Số MoMo: 0900000001 · VELOCE SPORT CO. · Nội dung: VELOCE + số điện thoại đặt hàng. Sau khi đặt đơn, dùng thêm mã đơn để shop đối soát.'],
    zalopay: ['Thanh toán điện tử ZaloPay', 'Đơn hàng sẽ tạo yêu cầu thanh toán qua cổng ZaloPay. Hiện đang ở chế độ demo chờ cấu hình merchant.']
  };
  const [title, description] = guides[paymentSelect.value] || guides.cod;
  document.getElementById('payment-guide').innerHTML = `<strong>${title}</strong><span>${description}</span>`;
}
paymentSelect.addEventListener('change', renderPaymentGuide);
renderPaymentGuide();
document.getElementById('apply-coupon').addEventListener('click', () => {
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  const found = (meta.vouchers || []).find(v => v.code === code);
  if (!found) { couponCode = ''; couponDiscount = 0; couponType = ''; renderCart(); return showToast('Mã không hợp lệ'); }
  couponCode = code; couponType = found.type; couponDiscount = found.type === 'percent' ? found.value / 100 : found.value;
  renderCart(); showToast('Đã áp dụng ' + code);
});
document.getElementById('checkout').addEventListener('click', async () => {
  const selectedCart = cart.filter(item => item.selected !== false);
  if (!selectedCart.length) return showToast('Chọn ít nhất một sản phẩm');
  const shipping = { name: document.getElementById('customer-name').value.trim(), phone: document.getElementById('customer-phone').value.trim(), address: document.getElementById('shipping-address').value.trim(), note: document.getElementById('shipping-note').value.trim(), method: document.getElementById('ship-method').value };
  if (!shipping.name || !shipping.phone || !shipping.address) return showToast('Nhập đủ thông tin nhận hàng');
  const payload = { shipping, coupon: couponCode, paymentMethod: document.getElementById('payment-method').value, items: selectedCart.map(item => ({ productId: item.id, quantity: item.quantity, selectedSize: item.selectedSize, selectedColor: item.selectedColor })) };
  try {
    const order = await api('/orders', { method: 'POST', body: JSON.stringify(payload) });
    cart = []; couponCode = ''; couponDiscount = 0; couponType = ''; localStorage.removeItem('veloce-cart');
    localStorage.setItem('veloce-last-order', order.id);
    renderCart(); closePanels();
    const pay = order.paymentMethod;
    if (['bank','momo','zalopay','online'].includes(pay)) openPaymentPanel(order);
    else { await renderOrder(); openPanel('order-panel'); }
    showToast(pay === 'zalopay' && order.payment?.status === 'pending_configuration' ? 'Đơn đã tạo · chờ thanh toán' : pay === 'bank' ? `Đơn đã tạo · CK nội dung ${order.shortCode}` : pay === 'momo' ? `Đơn đã tạo · MoMo nội dung ${order.shortCode}` : 'Đặt hàng thành công');
  } catch (err) {
    showToast(err.error === 'INSUFFICIENT_STOCK' ? 'Không đủ tồn kho' : err.error === 'INVALID_COUPON' ? 'Mã giảm giá không hợp lệ' : 'Không đặt được đơn');
  }
});
function openPaymentPanel(order) {
  const details = order.paymentMethod === 'momo'
    ? '<strong>Ví MoMo</strong><span>Số MoMo: <b>0900000001</b></span><span>Người nhận: <b>VELOCE SPORT CO.</b></span>'
    : '<strong>Tài khoản ngân hàng</strong><span>Ngân hàng: <b>Vietcombank</b></span><span>STK: <b>0123456789</b></span><span>Chủ tài khoản: <b>VELOCE SPORT CO.</b></span>';
  document.getElementById('payment-body').innerHTML = `<p>Đơn hàng <b>#${escapeHtml(order.shortCode)}</b></p><div class="payment-card">${details}<span>Số tiền: <b>${money(order.totalVnd)}</b></span><span>Nội dung chuyển khoản: <b>VELOCE ${escapeHtml(order.shortCode)}</b></span></div><p class="muted-copy">Sau khi chuyển khoản, bấm nút bên dưới. Nhân viên sẽ kiểm tra và xác nhận đơn hàng.</p><button class="primary-btn" id="payment-submitted">Tôi đã chuyển khoản</button>`;
  document.getElementById('payment-submitted').addEventListener('click', async () => { await api(`/orders/${order.id}/payment-submitted`, { method: 'POST' }); showToast('Đã báo thanh toán, chờ nhân viên xác nhận'); closePanels(); await renderOrder(); openPanel('order-panel'); });
  openPanel('payment-panel');
}
document.getElementById('order-body').addEventListener('click', async event => {
  if (event.target.dataset.orderStatus) { orderFilter = event.target.dataset.orderStatus; renderOrder(); return; }
  if (event.target.dataset.cancel) { await api(`/orders/${event.target.dataset.cancel}/cancel`, { method: 'POST' }); renderOrder(); showToast('Đã hủy đơn'); }
  if (event.target.dataset.return) { await api('/returns', { method: 'POST', body: JSON.stringify({ orderId: event.target.dataset.return, reason: 'Đổi size / hoàn tiền' }) }); showToast('Đã gửi yêu cầu đổi trả'); }
  if (event.target.dataset.paymentOrder) { const orders = await api('/orders'); const order = orders.find(item => item.id === event.target.dataset.paymentOrder); if (order) openPaymentPanel(order); }
});
document.getElementById('suggest-size').addEventListener('click', async () => {
  const footLength = Number(document.getElementById('foot-length').value);
  try {
    const data = await api('/size-suggest', { method: 'POST', body: JSON.stringify({ footLength, footWidth: Number(document.getElementById('foot-width').value) }) });
    document.getElementById('size-hint').textContent = data ? data.note : 'Nhập chiều dài bàn chân';
    if (data?.eu) {
      const sizeSel = document.getElementById('size-filter');
      if ([...sizeSel.options].some(o => o.value === data.eu)) { sizeSel.value = data.eu; renderProducts(); }
    }
  } catch { document.getElementById('size-hint').textContent = 'Không tính được size'; }
});

const aiPanel = document.getElementById('ai-panel');
document.getElementById('open-ai')?.addEventListener('click', () => { aiPanel.classList.add('open'); aiPanel.setAttribute('aria-hidden', 'false'); });
document.getElementById('floating-ai')?.addEventListener('click', openAiPanel);
document.querySelectorAll('[data-close-ai]').forEach(button => button.addEventListener('click', closePanels));
const chatBody = document.getElementById('chat-body');
async function sendMessage(text) {
  if (!text.trim()) return;
  chatBody.insertAdjacentHTML('beforeend', `<div class="chat-message user">${escapeHtml(text)}</div>`);
  const loading = document.createElement('div');
  loading.className = 'chat-message bot chat-loading';
  loading.textContent = 'AI đang trả lời...';
  chatBody.appendChild(loading);
  const submit = document.querySelector('#chat-form button');
  if (submit) submit.disabled = true;
  chatBody.scrollTop = chatBody.scrollHeight;
  let answer;
  try { answer = (await api('/ai/chat', { method: 'POST', body: JSON.stringify({ message: text, customer: { height: user?.height, weight: user?.weight } }) })).reply; }
  catch { answer = 'Mình chưa kết nối được với AI lúc này. Bạn có thể hỏi về giày, quần áo, phụ kiện, size hoặc ngân sách; mình sẽ hỗ trợ ngay khi kết nối ổn định.'; }
  loading.remove();
  if (submit) submit.disabled = false;
  chatBody.insertAdjacentHTML('beforeend', `<div class="chat-message bot">${escapeHtml(answer)}</div>`);
  chatBody.scrollTop = chatBody.scrollHeight;
}
document.getElementById('chat-form').addEventListener('submit', event => { event.preventDefault(); const input = document.getElementById('chat-input'); sendMessage(input.value); input.value = ''; });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
document.getElementById('open-shop')?.addEventListener('click', () => openPanel('shop-panel'));
document.getElementById('shop-chat-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!token) return openPanel('auth-panel');
  const input = document.getElementById('shop-chat-input');
  const text = input.value.trim(); if (!text) return; input.value = '';
  try {
    const msgs = await api('/chat', { method: 'POST', body: JSON.stringify({ text }) });
    msgs.forEach(m => document.getElementById('shop-chat-body').insertAdjacentHTML('beforeend', `<div class="chat-message ${m.from === 'user' ? 'user' : 'bot'}">${escapeHtml(m.text)}</div>`));
  } catch { showToast('Đăng nhập để chat shop'); }
});
document.querySelector('.newsletter-row button')?.addEventListener('click', async () => {
  const email = document.getElementById('newsletter-email')?.value.trim();
  if (!email) return showToast('Nhập email');
  try { await api('/newsletter', { method: 'POST', body: JSON.stringify({ email }) }); showToast('Đã đăng ký nhận thông báo khuyến mãi'); }
  catch { showToast('Email không hợp lệ'); }
});
document.getElementById('flash-banner').addEventListener('click', event => {
  const btn = event.target.closest('[data-open-flash]'); if (!btn) return;
  openProduct(products.find(p => p.id === btn.dataset.openFlash));
});
document.querySelector('.site-footer')?.addEventListener('click', event => {
  const a = event.target.closest('[data-category]'); if (!a) return;
  event.preventDefault();
  activeCategory = a.dataset.category;
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  renderFilters(); renderProducts();
});
async function renderNotifs() {
  if (!token) return openPanel('auth-panel');
  let notes = [];
  try { notes = await api('/notifications'); } catch { notes = []; }
  document.getElementById('notif-body').innerHTML = (notes.length
    ? notes.map(n => `<div class="review-item"><strong>${escapeHtml(n.title)}</strong><p>${escapeHtml(n.body)}</p></div>`).join('')
    : '<p class="muted-copy">Chưa có thông báo.</p>') + '<button class="text-btn" id="mark-read">Đánh dấu đã đọc</button><button class="text-btn" id="goto-orders">Theo dõi đơn hàng</button>';
  document.getElementById('mark-read')?.addEventListener('click', async () => { await api('/notifications/read', { method: 'POST' }); document.getElementById('notif-dot').hidden = true; renderNotifs(); });
  document.getElementById('goto-orders')?.addEventListener('click', () => { closePanels(); renderOrder(); openPanel('order-panel'); });
  openPanel('notif-panel');
}
document.getElementById('track-order').addEventListener('click', async () => {
  if (token && !document.getElementById('notif-dot').hidden) { await renderNotifs(); return; }
  renderOrder(); openPanel('order-panel');
});

async function boot() {
  persistSession();
  try { meta = await api('/meta'); } catch { /* local fallback */ }
  try { products = await api('/products'); } catch { products = []; }
  const initialQuery = new URLSearchParams(window.location.search).get('q');
  if (initialQuery) document.getElementById('product-search').value = initialQuery;
  renderFilters(); renderRails(); renderProducts(); renderCart();
  const compareCount = document.getElementById('compare-count');
  if (compareCount) compareCount.textContent = compareIds.length;
  if (user?.name) document.getElementById('customer-name').value = user.name;
  if (user?.phone) document.getElementById('customer-phone').value = user.phone;
  const def = user?.addresses?.find(a => a.default) || user?.addresses?.[0];
  if (def) document.getElementById('shipping-address').value = def.address;
  if (token) { try { const notes = await api('/notifications'); document.getElementById('notif-dot').hidden = !notes.some(n => !n.read); } catch {} }
}
boot();
