const money = v => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0)) + 'đ';
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const toastEl = document.getElementById('toast');
function showToast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 2200); }

let token = localStorage.getItem('veloce-token') || '';
let user = JSON.parse(localStorage.getItem('veloce-user') || 'null');
let catalog = { products: [], categories: [], brands: [], banners: [], vouchers: [], combos: [], flashSale: {}, settings: {} };
let view = 'overview';
const statusLabel = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị', shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy' };

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(json.error || 'API_ERROR'), json);
  return json.data;
}

function isStaff() { return user && (user.role === 'admin' || user.role === 'staff'); }

async function boot() {
  if (!isStaff()) {
    document.getElementById('admin-login').hidden = false;
    document.getElementById('admin-app').hidden = true;
    return;
  }
  document.getElementById('admin-login').hidden = true;
  document.getElementById('admin-app').hidden = false;
  document.getElementById('admin-who').textContent = `${user.name} · ${user.role}`;
  await loadCatalog();
  await render();
}

async function loadCatalog() {
  catalog = await api('/admin/catalog');
}

document.getElementById('admin-login-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('admin-email').value, password: document.getElementById('admin-password').value }) });
    if (data.user.role !== 'admin' && data.user.role !== 'staff') return showToast('Tài khoản không có quyền quản trị');
    token = data.token; user = data.user;
    localStorage.setItem('veloce-token', token);
    localStorage.setItem('veloce-user', JSON.stringify(user));
    view = 'overview';
    window.location.hash = 'management';
    await boot();
  } catch { showToast('Sai tài khoản / mật khẩu'); }
});
document.getElementById('admin-logout').addEventListener('click', () => {
  token = ''; user = null; localStorage.removeItem('veloce-token'); localStorage.removeItem('veloce-user');
  window.location.hash = '';
  boot();
});
document.getElementById('admin-menu-toggle').addEventListener('click', () => {
  const menu = document.getElementById('admin-menu');
  menu.hidden = !menu.hidden;
  document.getElementById('admin-menu-toggle').setAttribute('aria-expanded', String(!menu.hidden));
});
document.querySelector('.admin-nav nav').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]'); if (!btn) return;
  view = btn.dataset.view;
  document.querySelectorAll('.admin-nav nav button').forEach(b => b.classList.toggle('active', b === btn));
  document.getElementById('admin-menu').hidden = true;
  document.getElementById('admin-menu-toggle').setAttribute('aria-expanded', 'false');
  render();
});

function setTitle(t) { document.getElementById('admin-title').textContent = t; }
const $ = html => { const el = document.getElementById('view'); el.innerHTML = html; return el; };

async function render() {
  try {
    if (view === 'overview') return renderOverview();
    if (view === 'products') return renderProducts();
    if (view === 'categories') return renderCategories();
    if (view === 'brands') return renderBrands();
    if (view === 'inventory') return renderInventory();
    if (view === 'orders') return renderOrders();
    if (view === 'customers') return renderCustomers();
    if (view === 'vouchers') return renderVouchers();
    if (view === 'banners') return renderBanners();
    if (view === 'reviews') return renderReviews();
    if (view === 'staff') return renderStaff();
    if (view === 'reports') return renderReports();
  } catch (err) {
    if (err.error === 'UNAUTHORIZED' || err.error === 'FORBIDDEN') { user = null; boot(); return; }
    showToast(err.error || 'Lỗi tải dữ liệu');
  }
}

async function renderOverview() {
  setTitle('Dashboard');
  const d = await api('/admin/overview');
  const el = $('');
  el.innerHTML = `
    <div class="admin-kpis">
      <article><small>Doanh thu</small><strong>${money(d.revenue)}</strong></article>
      <article><small>Đơn hàng</small><strong>${d.orders}</strong></article>
      <article><small>Khách hàng</small><strong>${d.customers}</strong></article>
      <article><small>Sản phẩm</small><strong>${d.products}</strong></article>
    </div>
    <section class="admin-module-list"><h3>Danh sách chức năng quản trị</h3>
      <table class="admin-table"><thead><tr><th>Chức năng</th><th>Dữ liệu</th><th>Mô tả</th><th></th></tr></thead><tbody>
        <tr><td><strong>Sản phẩm</strong></td><td>${d.products}</td><td>Thêm, sửa giá, cập nhật tồn và xóa sản phẩm</td><td><button data-admin-view="products">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Danh mục</strong></td><td>${d.categories}</td><td>Thêm, đổi tên và xóa danh mục</td><td><button data-admin-view="categories">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Đơn hàng</strong></td><td>${d.orders}</td><td>Kiểm tra và cập nhật trạng thái đơn hàng</td><td><button data-admin-view="orders">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Khách hàng</strong></td><td>${d.customers}</td><td>Xem thông tin khách hàng và lịch sử mua</td><td><button data-admin-view="customers">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Voucher</strong></td><td>${d.vouchers}</td><td>Tạo, bật hoặc tắt mã giảm giá</td><td><button data-admin-view="vouchers">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Doanh thu</strong></td><td>${money(d.revenue)}</td><td>Xem báo cáo doanh thu và tình trạng đơn</td><td><button data-admin-view="reports">Chỉnh sửa</button></td></tr>
        <tr><td><strong>Tồn kho</strong></td><td>${d.inventory}</td><td>Ghi nhận nhập, xuất và điều chỉnh tồn</td><td><button data-admin-view="inventory">Chỉnh sửa</button></td></tr>
      </tbody></table>
    </section>
    <div class="admin-split">
      <section><h3>Bán chạy</h3><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Đã bán</th><th>Tồn</th></tr></thead><tbody>
        ${d.bestsellers.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.soldCount}</td><td>${p.stock}</td></tr>`).join('')}
      </tbody></table></section>
      <section><h3>Sắp hết hàng</h3><table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Tồn</th></tr></thead><tbody>
        ${d.lowStock.map(p => `<tr><td>${escapeHtml(p.name)}</td><td class="warn">${p.stock}</td></tr>`).join('') || '<tr><td colspan="2">Ổn định</td></tr>'}
      </tbody></table></section>
    </div>
    <section><h3>Đơn gần đây</h3><table class="admin-table"><thead><tr><th>Mã</th><th>Trạng thái</th><th>Tổng</th><th>Thanh toán</th></tr></thead><tbody>
      ${d.recentOrders.map(o => `<tr><td>#${o.shortCode}</td><td>${statusLabel[o.status] || o.status}</td><td>${money(o.totalVnd)}</td><td>${o.paymentMethod}</td></tr>`).join('')}
    </tbody></table></section>`;
  el.querySelectorAll('[data-admin-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.adminView;
    document.querySelectorAll('.admin-nav nav button').forEach(item => item.classList.toggle('active', item.dataset.view === view));
    render();
  }));
}

async function renderProducts() {
  setTitle('Sản phẩm');
  await loadCatalog();
  const el = $('');
  el.innerHTML = `
    <form id="product-form" class="admin-form grid-2">
      <input name="name" placeholder="Tên sản phẩm" required>
      <input name="priceVnd" type="number" placeholder="Giá" required>
      <input name="salePriceVnd" type="number" placeholder="Giá KM (0 nếu không)">
      <input name="stock" type="number" placeholder="Tồn kho" value="10">
      <select name="category">${catalog.categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      <select name="brand">${catalog.brands.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}</select>
      <select name="sport"><option value="running">Chạy bộ</option><option value="football">Bóng đá</option><option value="basketball">Bóng rổ</option><option value="tennis">Tennis</option><option value="training">Gym</option><option value="yoga">Yoga</option><option value="cycling">Đạp xe</option><option value="swimming">Bơi</option></select>
      <input name="sizes" placeholder="Size, cách nhau dấu phẩy" value="39,40,41,42,43">
      <input name="colors" placeholder="Màu, cách nhau dấu phẩy" value="Black,White">
      <input name="image" placeholder="URL hình ảnh">
      <input name="weight" placeholder="Trọng lượng">
      <input name="material" placeholder="Chất liệu">
      <input name="tech" placeholder="Công nghệ">
      <input name="useCases" placeholder="Nhu cầu: long-distance, trail, gym...">
      <textarea name="description" placeholder="Mô tả"></textarea>
      <label class="chk"><input type="checkbox" name="featured"> Nổi bật</label>
      <label class="chk"><input type="checkbox" name="isNew"> Mới</label>
      <label class="chk"><input type="checkbox" name="bestseller"> Best seller</label>
      <button class="primary-btn" type="submit">Thêm sản phẩm</button>
    </form>
    <table class="admin-table"><thead><tr><th>Tên</th><th>Giá</th><th>Tồn</th><th>Danh mục</th><th></th></tr></thead><tbody>
      ${catalog.products.map(p => `<tr>
        <td>${escapeHtml(p.name)}</td><td>${money(p.displayPrice)}</td><td>${p.stock}</td><td>${escapeHtml(p.categoryLabel)}</td>
        <td><button data-edit="${p.id}">Sửa giá/tồn</button> ${user.role === 'admin' ? `<button data-del="${p.id}">Xóa</button>` : ''}</td>
      </tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#product-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const cat = catalog.categories.find(c => c.id === fd.get('category'));
    const brand = catalog.brands.find(b => b.id === fd.get('brand'));
    const payload = {
      name: fd.get('name'), priceVnd: Number(fd.get('priceVnd')), salePriceVnd: Number(fd.get('salePriceVnd') || 0),
      stock: Number(fd.get('stock')), category: fd.get('category'), categoryLabel: cat?.name, brand: fd.get('brand'), brandLabel: brand?.name,
      sport: fd.get('sport'), sportLabel: el.querySelector('[name=sport] option:checked').textContent,
      sizes: String(fd.get('sizes')).split(',').map(s => s.trim()).filter(Boolean),
      colors: String(fd.get('colors')).split(',').map(s => s.trim()).filter(Boolean),
      image: fd.get('image'), description: fd.get('description'), weight: fd.get('weight'), material: fd.get('material'), tech: fd.get('tech'),
      useCases: String(fd.get('useCases') || '').split(',').map(s => s.trim()).filter(Boolean),
      featured: fd.get('featured') === 'on', isNew: fd.get('isNew') === 'on', bestseller: fd.get('bestseller') === 'on',
      color: '#111', bg: '#f2efe5', type: 'product'
    };
    await api('/admin/products', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Đã thêm sản phẩm'); renderProducts();
  });
  el.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', async () => {
    const p = catalog.products.find(x => x.id === btn.dataset.edit);
    const price = Number(prompt('Giá niêm yết', p.priceVnd)); if (!price) return;
    const sale = Number(prompt('Giá KM (0 nếu không)', p.salePriceVnd || 0));
    const stock = Number(prompt('Tồn kho', p.stock));
    await api('/admin/products/' + p.id, { method: 'PUT', body: JSON.stringify({ priceVnd: price, salePriceVnd: sale, stock }) });
    showToast('Đã cập nhật'); renderProducts();
  }));
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Xóa sản phẩm?')) return;
    await api('/admin/products/' + btn.dataset.del, { method: 'DELETE' });
    showToast('Đã xóa'); renderProducts();
  }));
}

async function renderCategories() {
  setTitle('Danh mục'); await loadCatalog();
  const el = $('');
  el.innerHTML = `<form id="cat-form" class="admin-form row"><input name="name" placeholder="Tên danh mục" required><input name="id" placeholder="slug (giày-chạy-bộ)"><button class="primary-btn">Thêm</button></form>
    <table class="admin-table"><thead><tr><th>ID</th><th>Tên</th><th></th></tr></thead><tbody>
    ${catalog.categories.map(c => `<tr><td>${c.id}</td><td>${escapeHtml(c.name)}</td><td>${user.role === 'admin' ? `<button data-del="${c.id}">Xóa</button>` : ''}</td></tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#cat-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/categories', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), id: fd.get('id') }) });
    showToast('Đã thêm danh mục'); renderCategories();
  });
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/categories/' + btn.dataset.del, { method: 'DELETE' }); renderCategories();
  }));
}

async function renderBrands() {
  setTitle('Thương hiệu'); await loadCatalog();
  const el = $('');
  el.innerHTML = `<form id="brand-form" class="admin-form row"><input name="name" placeholder="Tên thương hiệu" required><button class="primary-btn">Thêm</button></form>
    <table class="admin-table"><thead><tr><th>ID</th><th>Tên</th><th></th></tr></thead><tbody>
    ${catalog.brands.map(b => `<tr><td>${b.id}</td><td>${escapeHtml(b.name)}</td><td>${user.role === 'admin' ? `<button data-del="${b.id}">Xóa</button>` : ''}</td></tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#brand-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/brands', { method: 'POST', body: JSON.stringify({ name: fd.get('name') }) });
    showToast('Đã thêm thương hiệu'); renderBrands();
  });
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/brands/' + btn.dataset.del, { method: 'DELETE' }); renderBrands();
  }));
}

async function renderInventory() {
  setTitle('Tồn kho / Nhập xuất');
  await loadCatalog();
  const logs = await api('/admin/inventory');
  const el = $('');
  el.innerHTML = `
    <form id="inv-form" class="admin-form row">
      <select name="productId">${catalog.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (tồn ${p.stock})</option>`).join('')}</select>
      <select name="type"><option value="in">Nhập kho</option><option value="out">Xuất kho</option></select>
      <input name="quantity" type="number" min="1" value="1" required>
      <input name="note" placeholder="Ghi chú">
      <button class="primary-btn">Ghi sổ</button>
    </form>
    <table class="admin-table"><thead><tr><th>Thời gian</th><th>SP</th><th>Loại</th><th>SL</th><th>Ghi chú</th></tr></thead><tbody>
      ${logs.slice(0, 40).map(l => `<tr><td>${new Date(l.createdAt).toLocaleString('vi-VN')}</td><td>${l.productId}</td><td>${l.type}</td><td>${l.quantity}</td><td>${escapeHtml(l.note)}</td></tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#inv-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/inventory', { method: 'POST', body: JSON.stringify({ productId: fd.get('productId'), type: fd.get('type'), quantity: Number(fd.get('quantity')), note: fd.get('note') }) });
    showToast('Đã cập nhật tồn kho'); renderInventory();
  });
}

async function renderOrders() {
  setTitle('Đơn hàng');
  const orders = await api('/orders');
  const el = $('');
  el.innerHTML = `<table class="admin-table"><thead><tr><th>Mã</th><th>Khách</th><th>Trạng thái</th><th>Tổng</th><th>Vận đơn</th><th>Cập nhật</th></tr></thead><tbody>
    ${orders.map(o => `<tr>
      <td>#${o.shortCode}<br><small>${escapeHtml(o.shipping?.address || '')}</small></td>
      <td>${escapeHtml(o.shipping?.name)}<br>${escapeHtml(o.shipping?.phone)}</td>
      <td>${statusLabel[o.status] || o.status}${o.returnRequest ? '<br><small>Đổi trả: ' + o.returnRequest.status + '</small>' : ''}</td>
      <td>${money(o.totalVnd)}<br><small>${o.paymentMethod} · ${o.paymentStatus}</small>${['bank','momo','zalopay','online'].includes(o.paymentMethod) && o.paymentStatus === 'submitted' ? `<br><button data-payment-confirm="${o.id}">Xác nhận đã CK</button> <button data-payment-reject="${o.id}">Từ chối</button>` : ''}</td>
      <td>${escapeHtml(o.trackingCode || '—')}</td>
      <td><select data-status="${o.id}">
        ${['pending_payment','pending','confirmed','preparing','shipping','delivered','cancelled'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabel[s] || s}</option>`).join('')}
      </select></td>
    </tr>`).join('')}
  </tbody></table>`;
  el.querySelectorAll('[data-status]').forEach(sel => sel.addEventListener('change', async () => {
    await api('/admin/orders/' + sel.dataset.status, { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
    showToast('Đã cập nhật đơn'); renderOrders();
  }));
  el.querySelectorAll('[data-payment-confirm]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/payments/' + btn.dataset.paymentConfirm, { method: 'PATCH', body: JSON.stringify({ paymentStatus: 'paid' }) });
    showToast('Đã xác nhận thanh toán'); renderOrders();
  }));
  el.querySelectorAll('[data-payment-reject]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/payments/' + btn.dataset.paymentReject, { method: 'PATCH', body: JSON.stringify({ paymentStatus: 'rejected', note: 'Không tìm thấy giao dịch hoặc sai nội dung chuyển khoản' }) });
    showToast('Đã từ chối thanh toán'); renderOrders();
  }));
}

async function renderCustomers() {
  setTitle('Khách hàng');
  const list = await api('/admin/customers');
  $('').innerHTML = `<table class="admin-table"><thead><tr><th>Tên</th><th>Liên hệ</th><th>Hạng</th><th>Điểm</th><th>Địa chỉ</th></tr></thead><tbody>
    ${list.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}<br>${escapeHtml(c.phone)}</td><td>${c.tier}</td><td>${c.points}</td><td>${(c.addresses || []).map(a => escapeHtml(a.address)).join('<br>')}</td></tr>`).join('')}
  </tbody></table>`;
}

async function renderVouchers() {
  setTitle('Voucher / khuyến mãi'); await loadCatalog();
  const el = $('');
  el.innerHTML = `<form id="voucher-form" class="admin-form row">
      <input name="code" placeholder="Mã" required>
      <select name="type"><option value="percent">%</option><option value="amount">Số tiền</option><option value="shipping">Freeship</option></select>
      <input name="value" type="number" placeholder="Giá trị" required>
      <input name="minOrder" type="number" placeholder="Đơn tối thiểu" value="0">
      <button class="primary-btn">Tạo voucher</button>
    </form>
    <table class="admin-table"><thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>Min</th><th>Active</th></tr></thead><tbody>
    ${catalog.vouchers.map(v => `<tr><td>${v.code}</td><td>${v.type}</td><td>${v.value}</td><td>${money(v.minOrder)}</td>
      <td><button data-toggle="${v.code}" data-active="${v.active}">${v.active ? 'Tắt' : 'Bật'}</button></td></tr>`).join('')}
    </tbody></table>
    <h3>Flash sale</h3>
    <form id="flash-form" class="admin-form row">
      <select name="productId">${catalog.products.map(p => `<option value="${p.id}" ${catalog.flashSale?.productId === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" name="active" ${catalog.flashSale?.active ? 'checked' : ''}> Bật</label>
      <button class="secondary-btn">Lưu flash sale</button>
    </form>`;
  el.querySelector('#voucher-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/vouchers', { method: 'POST', body: JSON.stringify({ code: fd.get('code'), type: fd.get('type'), value: Number(fd.get('value')), minOrder: Number(fd.get('minOrder')) }) });
    showToast('Đã tạo voucher'); renderVouchers();
  });
  el.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/vouchers/' + btn.dataset.toggle, { method: 'PUT', body: JSON.stringify({ active: btn.dataset.active !== 'true' }) });
    renderVouchers();
  }));
  el.querySelector('#flash-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/flash', { method: 'PUT', body: JSON.stringify({ productId: fd.get('productId'), active: fd.get('active') === 'on', endsAt: new Date(Date.now() + 86400000 * 2).toISOString() }) });
    showToast('Đã lưu flash sale'); renderVouchers();
  });
}

async function renderBanners() {
  setTitle('Banner'); await loadCatalog();
  const el = $('');
  el.innerHTML = `<form id="banner-form" class="admin-form row"><input name="title" placeholder="Tiêu đề" required><input name="subtitle" placeholder="Phụ đề"><button class="primary-btn">Thêm banner</button></form>
    <table class="admin-table"><thead><tr><th>Tiêu đề</th><th>Phụ đề</th><th>Active</th><th></th></tr></thead><tbody>
    ${catalog.banners.map(b => `<tr><td>${escapeHtml(b.title)}</td><td>${escapeHtml(b.subtitle)}</td>
      <td><button data-toggle="${b.id}" data-active="${b.active}">${b.active ? 'Tắt' : 'Bật'}</button></td>
      <td><button data-del="${b.id}">Xóa</button></td></tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#banner-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/banners', { method: 'POST', body: JSON.stringify({ title: fd.get('title'), subtitle: fd.get('subtitle') }) });
    renderBanners();
  });
  el.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/banners/' + btn.dataset.toggle, { method: 'PUT', body: JSON.stringify({ active: btn.dataset.active !== 'true' }) });
    renderBanners();
  }));
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/banners/' + btn.dataset.del, { method: 'DELETE' }); renderBanners();
  }));
}

async function renderReviews() {
  setTitle('Đánh giá');
  const list = await api('/admin/reviews');
  const el = $('');
  el.innerHTML = `<table class="admin-table"><thead><tr><th>SP</th><th>Khách</th><th>Sao</th><th>Nội dung</th><th></th></tr></thead><tbody>
    ${list.map(r => `<tr><td>${r.productId}</td><td>${escapeHtml(r.userName)}</td><td>${r.rating}</td><td>${escapeHtml(r.comment)}</td><td><button data-del="${r.id}">Xóa</button></td></tr>`).join('')}
  </tbody></table>`;
  el.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
    await api('/admin/reviews/' + btn.dataset.del, { method: 'DELETE' }); renderReviews();
  }));
}

async function renderStaff() {
  setTitle('Nhân viên / phân quyền');
  if (user.role !== 'admin') { $('').innerHTML = '<p>Chỉ admin mới quản lý nhân viên.</p>'; return; }
  const list = await api('/admin/staff');
  const el = $('');
  el.innerHTML = `<form id="staff-form" class="admin-form row">
      <input name="name" placeholder="Họ tên" required>
      <input name="email" placeholder="Email" required>
      <input name="password" placeholder="Mật khẩu" value="staff123">
      <select name="role"><option value="staff">Staff</option><option value="admin">Admin</option></select>
      <button class="primary-btn">Thêm nhân viên</button>
    </form>
    <table class="admin-table"><thead><tr><th>Tên</th><th>Email</th><th>Quyền</th></tr></thead><tbody>
    ${list.map(s => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.email)}</td>
      <td><select data-role="${s.id}">${['admin','staff'].map(r => `<option value="${r}" ${s.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></td></tr>`).join('')}
    </tbody></table>`;
  el.querySelector('#staff-form').addEventListener('submit', async e => {
    e.preventDefault(); const fd = new FormData(e.target);
    await api('/admin/staff', { method: 'POST', body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password'), role: fd.get('role') }) });
    showToast('Đã thêm nhân viên'); renderStaff();
  });
  el.querySelectorAll('[data-role]').forEach(sel => sel.addEventListener('change', async () => {
    await api('/admin/staff/' + sel.dataset.role, { method: 'PATCH', body: JSON.stringify({ role: sel.value }) });
    showToast('Đã đổi quyền');
  }));
}

async function renderReports() {
  setTitle('Báo cáo doanh thu');
  const r = await api('/admin/reports');
  const o = await api('/admin/overview');
  $('').innerHTML = `
    <div class="admin-kpis">
      <article><small>Doanh thu (trừ hủy)</small><strong>${money(r.revenue)}</strong></article>
      <article><small>Giá trị tồn kho</small><strong>${money(r.stockValue)}</strong></article>
      <article><small>Phiếu kho</small><strong>${r.inventory}</strong></article>
    </div>
    <h3>Đơn theo trạng thái</h3>
    <table class="admin-table"><tbody>${Object.entries(r.byStatus).map(([k, v]) => `<tr><td>${statusLabel[k] || k}</td><td>${v}</td></tr>`).join('')}</tbody></table>
    <h3>Sản phẩm bán chạy</h3>
    <table class="admin-table"><thead><tr><th>Sản phẩm</th><th>Đã bán</th><th>Tồn</th></tr></thead><tbody>
      ${o.bestsellers.map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${p.soldCount}</td><td>${p.stock}</td></tr>`).join('')}
    </tbody></table>`;
}

boot();
