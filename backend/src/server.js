const fs = require('node:fs');
const path = require('node:path');
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}
const http = require('node:http');
const crypto = require('node:crypto');
const { chat } = require('./ai-agent');
const { createOrderPayment } = require('./zalopay');
const store = require('./store');

const port = Number(process.env.PORT || 8787);
const rootDir = path.resolve(__dirname, '../..');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const db = store.load();
const sessions = new Map();
const resetTokens = new Map();

function persist() { store.save(db); }
function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  response.end(JSON.stringify(payload));
}
async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}
function tokenFrom(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}
function currentUser(request) {
  const token = tokenFrom(request);
  const session = sessions.get(token);
  if (!session) return null;
  return db.users.find(u => u.id === session.userId) || null;
}
function requireUser(request, response) {
  const user = currentUser(request);
  if (!user) { sendJson(response, 401, { error: 'UNAUTHORIZED' }); return null; }
  return user;
}
function requireAdmin(request, response) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'staff') { sendJson(response, 403, { error: 'FORBIDDEN' }); return null; }
  return user;
}
function requireAdminOnly(request, response) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (user.role !== 'admin') { sendJson(response, 403, { error: 'FORBIDDEN' }); return null; }
  return user;
}
function issueToken(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { userId: user.id, createdAt: Date.now() });
  return token;
}
function productRating(productId) {
  const list = db.reviews.filter(r => r.productId === productId);
  if (!list.length) return { avg: 0, count: 0 };
  return { avg: Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10, count: list.length };
}
function enrichProduct(p) {
  const rating = productRating(p.id);
  return { ...p, rating: rating.avg, reviewCount: rating.count, displayPrice: store.unitPrice(p) };
}
function filterProducts(url) {
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const category = url.searchParams.get('category');
  const brand = url.searchParams.get('brand');
  const sport = url.searchParams.get('sport');
  const useCase = url.searchParams.get('useCase');
  const color = url.searchParams.get('color');
  const size = url.searchParams.get('size');
  const sort = url.searchParams.get('sort') || 'featured';
  const min = Number(url.searchParams.get('min') || 0);
  const max = Number(url.searchParams.get('max') || 0);
  let data = db.products.filter(p => {
    const text = `${p.name} ${p.brandLabel} ${p.categoryLabel} ${p.sportLabel} ${p.description}`.toLowerCase();
    const price = store.unitPrice(p);
    if (q && !text.includes(q)) return false;
    if (category && category !== 'all' && p.category !== category) return false;
    if (brand && brand !== 'all' && p.brand !== brand) return false;
    if (sport && sport !== 'all' && p.sport !== sport) return false;
    if (useCase && useCase !== 'all' && !(p.useCases || []).includes(useCase)) return false;
    if (color && color !== 'all' && !(p.colors || []).includes(color)) return false;
    if (size && size !== 'all' && !(p.sizes || []).includes(size)) return false;
    if (min && price < min) return false;
    if (max && price > max) return false;
    return true;
  });
  if (sort === 'price-asc') data.sort((a, b) => store.unitPrice(a) - store.unitPrice(b));
  else if (sort === 'price-desc') data.sort((a, b) => store.unitPrice(b) - store.unitPrice(a));
  else if (sort === 'bestseller') data.sort((a, b) => b.soldCount - a.soldCount);
  else if (sort === 'newest') data.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  else data.sort((a, b) => Number(b.featured) - Number(a.featured) || b.soldCount - a.soldCount);
  return data.map(enrichProduct);
}
function shippingFee(method, subtotal, coupon) {
  const map = db.settings.shipping;
  let fee = map[method] ?? map.standard;
  if (subtotal >= db.settings.freeShipMin) fee = 0;
  if (coupon && coupon.type === 'shipping') fee = Math.max(0, fee - coupon.value);
  return fee;
}
function applyCoupon(code, subtotal) {
  const voucher = db.vouchers.find(v => v.code === String(code || '').toUpperCase() && v.active);
  if (!voucher) return { error: 'INVALID_COUPON' };
  if (subtotal < voucher.minOrder) return { error: 'COUPON_MIN_ORDER', minOrder: voucher.minOrder };
  if (voucher.type === 'percent') return { voucher, discount: Math.round(subtotal * voucher.value / 100) };
  if (voucher.type === 'amount') return { voucher, discount: voucher.value };
  return { voucher, discount: 0 };
}
function tierFromPoints(points) {
  if (points >= 2000) return 'Pro';
  if (points >= 800) return 'Club';
  return 'Runner';
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let reqPath = decodeURIComponent(url.pathname);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(rootDir, reqPath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(rootDir)) return sendJson(response, 403, { error: 'FORBIDDEN' });
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (ext === '.html' || reqPath === '/index.html') {
        return fs.readFile(path.join(rootDir, 'index.html'), (err2, data2) => {
          if (err2) return sendJson(response, 404, { error: 'NOT_FOUND' });
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          response.end(data2);
        });
      }
      return sendJson(response, 404, { error: 'NOT_FOUND' });
    }
    response.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*', 'Cache-Control': ext.match(/\.(html|js|css)$/) ? 'no-cache' : 'public, max-age=3600' });
    response.end(data);
  });
}

async function route(request, response) {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {});
  const url = new URL(request.url, `http://${request.headers.host}`);
  const p = url.pathname;
  const method = request.method;

  if (!p.startsWith('/api/')) {
    if (method === 'GET' || method === 'HEAD') return serveStatic(request, response);
    return sendJson(response, 404, { error: 'NOT_FOUND' });
  }

  if (method === 'GET' && p === '/api/health') return sendJson(response, 200, { ok: true, service: 'veloce-sport-api' });
  if (method === 'GET' && p === '/api/meta') {
    return sendJson(response, 200, { data: { categories: db.categories, brands: db.brands, banners: db.banners.filter(b => b.active), combos: db.combos, vouchers: db.vouchers.filter(v => v.active).map(v => ({ code: v.code, type: v.type, value: v.value, minOrder: v.minOrder })), blog: db.blog, flashSale: db.flashSale, settings: db.settings } });
  }
  if (method === 'GET' && p === '/api/products') return sendJson(response, 200, { data: filterProducts(url) });
  if (method === 'GET' && p.startsWith('/api/products/') && !p.includes('/reviews')) {
    const id = p.split('/').pop();
    const product = db.products.find(x => x.id === id);
    if (!product) return sendJson(response, 404, { error: 'PRODUCT_NOT_FOUND' });
    const related = db.products.filter(x => x.id !== id && (x.sport === product.sport || x.category === product.category)).slice(0, 4).map(enrichProduct);
    const user = currentUser(request);
    const canReview = Boolean(user && db.orders.some(o => o.customerId === user.id && o.status === 'delivered' && o.items.some(i => i.productId === id)));
    const hasReviewed = Boolean(user && db.reviews.some(r => r.userId === user.id && r.productId === id));
    return sendJson(response, 200, { data: { ...enrichProduct(product), related, reviews: db.reviews.filter(r => r.productId === id), canReview, hasReviewed } });
  }
  if (method === 'GET' && p === '/api/compare') {
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
    return sendJson(response, 200, { data: ids.map(id => db.products.find(x => x.id === id)).filter(Boolean).map(enrichProduct) });
  }
  if (method === 'POST' && p === '/api/size-suggest') {
    const body = await readJson(request);
    return sendJson(response, 200, { data: store.suggestShoeSize(Number(body.footLength || 0)) });
  }

  if (method === 'POST' && p === '/api/auth/register') {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    if (!name || !password || (!email && !phone)) return sendJson(response, 400, { error: 'MISSING_FIELDS' });
    if (db.users.find(u => (email && u.email === email) || (phone && u.phone === phone))) return sendJson(response, 409, { error: 'ACCOUNT_EXISTS' });
    const user = {
      id: crypto.randomUUID(), name, email, phone, password: store.hashPassword(password), role: 'customer', provider: 'email',
      points: 50, tier: 'Runner', wishlist: [], restockWatch: [], saleWatch: [], addresses: [],
      footLength: 0, footWidth: 0, height: 0, weight: 0, referralCode: name.replace(/\s+/g, '').slice(0, 8).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase(),
      referredBy: body.referral || null, createdAt: store.now()
    };
    if (body.referral) {
      const ref = db.users.find(u => u.referralCode === body.referral);
      if (ref) { ref.points += 100; ref.tier = tierFromPoints(ref.points); }
    }
    db.users.push(user); persist();
    const token = issueToken(user);
    return sendJson(response, 201, { data: { token, user: store.publicUser(user) } });
  }
  if (method === 'POST' && p === '/api/auth/login') {
    const body = await readJson(request);
    const login = String(body.email || body.phone || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === login || u.phone === login || u.email === body.email || u.phone === body.phone);
    if (!user || !store.verifyPassword(String(body.password || ''), user.password)) return sendJson(response, 401, { error: 'INVALID_CREDENTIALS' });
    return sendJson(response, 200, { data: { token: issueToken(user), user: store.publicUser(user) } });
  }
  if (method === 'POST' && p === '/api/auth/social') {
    const body = await readJson(request);
    const provider = body.provider === 'facebook' ? 'facebook' : 'google';
    const email = `${provider}.${crypto.randomBytes(3).toString('hex')}@veloce.social`;
    let user = db.users.find(u => u.provider === provider && u.name === body.name);
    if (!user) {
      user = { id: crypto.randomUUID(), name: body.name || (provider === 'google' ? 'Google User' : 'Facebook User'), email, phone: '', password: store.hashPassword(crypto.randomUUID()), role: 'customer', provider, points: 50, tier: 'Runner', wishlist: [], restockWatch: [], saleWatch: [], addresses: [], footLength: 0, footWidth: 0, height: 0, weight: 0, referralCode: provider.toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase(), referredBy: null, createdAt: store.now() };
      db.users.push(user); persist();
    }
    return sendJson(response, 200, { data: { token: issueToken(user), user: store.publicUser(user) } });
  }
  if (method === 'POST' && p === '/api/auth/forgot') {
    const body = await readJson(request);
    const login = String(body.email || body.phone || '').trim().toLowerCase();
    const user = db.users.find(u => u.email === login || u.phone === login);
    if (!user) return sendJson(response, 200, { data: { ok: true } });
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    resetTokens.set(token, { userId: user.id, exp: Date.now() + 15 * 60 * 1000 });
    return sendJson(response, 200, { data: { ok: true, demoResetCode: token } });
  }
  if (method === 'POST' && p === '/api/auth/reset') {
    const body = await readJson(request);
    const rec = resetTokens.get(String(body.code || '').toUpperCase());
    if (!rec || rec.exp < Date.now()) return sendJson(response, 400, { error: 'INVALID_RESET' });
    const user = db.users.find(u => u.id === rec.userId);
    user.password = store.hashPassword(String(body.password || '123456'));
    resetTokens.delete(String(body.code || '').toUpperCase()); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'GET' && p === '/api/me') {
    const user = requireUser(request, response); if (!user) return;
    return sendJson(response, 200, { data: store.publicUser(user) });
  }
  if (method === 'PUT' && p === '/api/me') {
    const user = requireUser(request, response); if (!user) return;
    const body = await readJson(request);
    ['name', 'phone', 'email', 'footLength', 'footWidth', 'height', 'weight'].forEach(k => { if (body[k] !== undefined) user[k] = body[k]; });
    persist(); return sendJson(response, 200, { data: store.publicUser(user) });
  }
  if (method === 'POST' && p === '/api/me/addresses') {
    const user = requireUser(request, response); if (!user) return;
    const body = await readJson(request);
    const addr = { id: crypto.randomUUID(), label: body.label || 'Nhà', name: body.name || user.name, phone: body.phone || user.phone, address: body.address, default: !user.addresses.length };
    user.addresses.push(addr); persist(); return sendJson(response, 201, { data: addr });
  }
  if (method === 'DELETE' && p.startsWith('/api/me/addresses/')) {
    const user = requireUser(request, response); if (!user) return;
    const id = p.split('/').pop();
    user.addresses = user.addresses.filter(a => a.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }

  if (method === 'GET' && p === '/api/wishlist') {
    const user = requireUser(request, response); if (!user) return;
    return sendJson(response, 200, { data: user.wishlist.map(id => db.products.find(x => x.id === id)).filter(Boolean).map(enrichProduct) });
  }
  if (method === 'POST' && p === '/api/wishlist') {
    const user = requireUser(request, response); if (!user) return;
    const { productId } = await readJson(request);
    if (!user.wishlist.includes(productId)) user.wishlist.push(productId);
    persist(); return sendJson(response, 200, { data: user.wishlist });
  }
  if (method === 'DELETE' && p.startsWith('/api/wishlist/')) {
    const user = requireUser(request, response); if (!user) return;
    const id = p.split('/').pop();
    user.wishlist = user.wishlist.filter(x => x !== id); persist();
    return sendJson(response, 200, { data: user.wishlist });
  }
  if (method === 'POST' && p === '/api/watch') {
    const user = requireUser(request, response); if (!user) return;
    const { productId, type } = await readJson(request);
    const key = type === 'sale' ? 'saleWatch' : 'restockWatch';
    if (!user[key].includes(productId)) user[key].push(productId);
    persist(); return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'GET' && p === '/api/notifications') {
    const user = requireUser(request, response); if (!user) return;
    return sendJson(response, 200, { data: db.notifications.filter(n => n.userId === user.id) });
  }

  if (method === 'GET' && p.startsWith('/api/reviews/')) {
    const productId = p.split('/').pop();
    return sendJson(response, 200, { data: db.reviews.filter(r => r.productId === productId) });
  }
  if (method === 'POST' && p === '/api/reviews') {
    const user = requireUser(request, response); if (!user) return;
    const body = await readJson(request);
    const bought = db.orders.some(o => o.customerId === user.id && o.items.some(i => i.productId === body.productId) && o.status === 'delivered');
    if (!bought) return sendJson(response, 403, { error: 'REVIEW_NOT_ELIGIBLE', message: 'Chỉ khách đã nhận sản phẩm mới được đánh giá.' });
    if (db.reviews.some(r => r.userId === user.id && r.productId === body.productId)) return sendJson(response, 409, { error: 'REVIEW_ALREADY_EXISTS' });
    const review = { id: crypto.randomUUID(), productId: body.productId, userId: user.id, userName: user.name, rating: Math.min(5, Math.max(1, Number(body.rating) || 5)), comment: String(body.comment || ''), images: body.images || [], video: body.video || '', verified: bought, createdAt: store.now() };
    db.reviews.push(review); persist();
    return sendJson(response, 201, { data: review });
  }

  if (method === 'POST' && p === '/api/ai/chat') {
    const user = currentUser(request);
    const body = await readJson(request);
    const hasDeliveredOrder = Boolean(user && db.orders.some(order => order.customerId === user.id && order.status === 'delivered'));
    const customer = { height: body.customer?.height || user?.height, weight: body.customer?.weight || user?.weight, footLength: user?.footLength, hasDeliveredOrder };
    return sendJson(response, 200, { data: await chat({ message: body.message, customer }) });
  }
  if (method === 'GET' && p === '/api/chat') {
    const user = requireUser(request, response); if (!user) return;
    return sendJson(response, 200, { data: db.chats.filter(c => c.userId === user.id) });
  }
  if (method === 'POST' && p === '/api/chat') {
    const user = requireUser(request, response); if (!user) return;
    const body = await readJson(request);
    const msg = { id: crypto.randomUUID(), userId: user.id, from: 'user', text: body.text, createdAt: store.now() };
    const reply = { id: crypto.randomUUID(), userId: user.id, from: 'shop', text: 'Shop đã nhận tin. Tư vấn viên sẽ trả lời trong giờ 8:00–22:00. Bạn cũng có thể hỏi AI Coach.', createdAt: store.now() };
    db.chats.push(msg, reply); persist();
    return sendJson(response, 201, { data: [msg, reply] });
  }

  if (method === 'POST' && p === '/api/orders') {
    const input = await readJson(request);
    const user = currentUser(request);
    const items = Array.isArray(input.items) ? input.items : [];
    if (!items.length) return sendJson(response, 400, { error: 'EMPTY_ORDER' });
    const shippingInfo = input.shipping || {};
    if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address) return sendJson(response, 400, { error: 'MISSING_SHIPPING' });
    const normalized = [];
    for (const item of items) {
      const product = db.products.find(c => c.id === item.productId);
      if (!product) return sendJson(response, 400, { error: 'PRODUCT_NOT_FOUND', productId: item.productId });
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) return sendJson(response, 400, { error: 'INSUFFICIENT_STOCK', productId: item.productId });
      normalized.push({ productId: product.id, name: product.name, quantity: item.quantity, unitPriceVnd: store.unitPrice(product), selectedSize: item.selectedSize || product.sizes[0], selectedColor: item.selectedColor || product.colors[0] });
    }
    const subtotal = normalized.reduce((t, i) => t + i.unitPriceVnd * i.quantity, 0);
    let discount = 0; let couponCode = '';
    if (input.coupon) {
      const applied = applyCoupon(input.coupon, subtotal);
      if (applied.error) return sendJson(response, 400, { error: applied.error, minOrder: applied.minOrder });
      discount = applied.discount; couponCode = applied.voucher.code;
    }
    const methodShip = shippingInfo.method || 'standard';
    const voucher = couponCode ? db.vouchers.find(v => v.code === couponCode) : null;
    const fee = shippingFee(methodShip, subtotal - discount, voucher);
    const paymentMethod = input.paymentMethod || 'cod';
    const order = {
      id: crypto.randomUUID(), shortCode: 'VL' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5),
      customerId: user?.id || input.customerId || null,
      shipping: { ...shippingInfo, method: methodShip, fee },
      items: normalized, subtotalVnd: subtotal, discountVnd: discount, shippingFee: fee, totalVnd: subtotal - discount + fee,
      coupon: couponCode, paymentMethod, paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'pending',
      status: paymentMethod === 'cod' ? 'pending' : 'pending_payment', trackingCode: '', createdAt: store.now(), timeline: [{ status: paymentMethod === 'cod' ? 'pending' : 'pending_payment', at: store.now(), note: paymentMethod === 'cod' ? 'Chờ xác nhận' : 'Chờ khách thanh toán online' }]
    };
    normalized.forEach(item => {
      const product = db.products.find(x => x.id === item.productId);
      product.stock -= item.quantity; product.soldCount += item.quantity;
      db.inventory.push({ id: crypto.randomUUID(), productId: product.id, type: 'out', quantity: item.quantity, note: `Đơn ${order.shortCode}`, createdAt: store.now() });
      db.users.forEach(u => {
        if (u.restockWatch.includes(product.id) && product.stock === 0) {
          db.notifications.push({ id: crypto.randomUUID(), userId: u.id, title: `${product.name} sắp hết hàng`, body: 'Bạn đang theo dõi sản phẩm này.', read: false, createdAt: store.now() });
        }
      });
    });
    if (user) { user.points += Math.floor(order.totalVnd / 10000); user.tier = tierFromPoints(user.points); }
    db.orders.push(order); persist();
    let payment = null;
    if (paymentMethod === 'zalopay' || paymentMethod === 'online') payment = createOrderPayment({ orderId: order.id, amount: order.totalVnd, description: `Veloce ${order.shortCode}` });
    return sendJson(response, 201, { data: { ...order, payment } });
  }
  if (method === 'GET' && p === '/api/orders') {
    const user = requireUser(request, response); if (!user) return;
    const list = user.role === 'admin' || user.role === 'staff' ? db.orders : db.orders.filter(o => o.customerId === user.id);
    return sendJson(response, 200, { data: list.slice().reverse() });
  }
  if (method === 'POST' && p.match(/^\/api\/orders\/[^/]+\/payment-submitted$/)) {
    const user = currentUser(request);
    const id = p.split('/').slice(-2, -1)[0];
    const order = db.orders.find(o => (o.id === id || o.shortCode === id) && (!o.customerId ? !user : o.customerId === user?.id));
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    if (!['bank', 'momo', 'zalopay', 'online'].includes(order.paymentMethod)) return sendJson(response, 400, { error: 'PAYMENT_NOT_REQUIRED' });
    order.paymentStatus = 'submitted';
    order.timeline.push({ status: 'payment_submitted', at: store.now(), note: 'Khách báo đã chuyển khoản, chờ nhân viên xác nhận' });
    persist(); return sendJson(response, 200, { data: order });
  }
  if (method === 'GET' && p.startsWith('/api/orders/')) {
    const id = p.split('/').pop();
    const order = db.orders.find(o => o.id === id || o.shortCode === id);
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    return sendJson(response, 200, { data: order });
  }
  if (method === 'POST' && p.match(/^\/api\/orders\/[^/]+\/cancel$/)) {
    const user = requireUser(request, response); if (!user) return;
    const id = p.split('/')[3];
    const order = db.orders.find(o => o.id === id);
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    if (order.customerId !== user.id && user.role === 'customer') return sendJson(response, 403, { error: 'FORBIDDEN' });
    if (!['pending', 'confirmed', 'preparing'].includes(order.status)) return sendJson(response, 400, { error: 'CANNOT_CANCEL' });
    order.status = 'cancelled'; order.timeline.push({ status: 'cancelled', at: store.now(), note: 'Đã hủy' });
    order.items.forEach(item => {
      const product = db.products.find(x => x.id === item.productId);
      if (product) { product.stock += item.quantity; product.soldCount = Math.max(0, product.soldCount - item.quantity); }
    });
    persist(); return sendJson(response, 200, { data: order });
  }
  if (method === 'POST' && p.startsWith('/api/payments/zalopay/')) {
    const orderId = p.split('/').pop();
    const order = db.orders.find(o => o.id === orderId);
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    return sendJson(response, 200, { data: createOrderPayment({ orderId, amount: order.totalVnd, description: `Veloce Sport order ${order.shortCode}` }) });
  }
  if (method === 'POST' && p === '/api/returns') {
    const user = requireUser(request, response); if (!user) return;
    const body = await readJson(request);
    const order = db.orders.find(o => o.id === body.orderId && o.customerId === user.id);
    if (!order || order.status !== 'delivered') return sendJson(response, 400, { error: 'RETURN_NOT_ALLOWED' });
    order.returnRequest = { reason: body.reason, status: 'pending', createdAt: store.now() };
    persist(); return sendJson(response, 201, { data: order.returnRequest });
  }

  if (method === 'GET' && p === '/api/admin/overview') {
    if (!requireAdmin(request, response)) return;
    const revenue = db.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalVnd, 0);
    const bestsellers = db.products.slice().sort((a, b) => b.soldCount - a.soldCount).slice(0, 5);
    const lowStock = db.products.filter(x => x.stock <= 8);
    return sendJson(response, 200, { data: { revenue, orders: db.orders.length, customers: db.users.filter(u => u.role === 'customer').length, products: db.products.length, categories: db.categories.length, vouchers: db.vouchers.length, inventory: db.inventory.length, bestsellers, lowStock, recentOrders: db.orders.slice(-8).reverse() } });
  }
  if (method === 'POST' && p === '/api/admin/products') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const product = { id: body.id || body.name.toLowerCase().replace(/\s+/g, '-').slice(0, 24), ...body, soldCount: 0, createdAt: store.now(), images: body.images || [body.image], useCases: body.useCases || [] };
    db.products.push(product); persist(); return sendJson(response, 201, { data: product });
  }
  if (method === 'PUT' && p.startsWith('/api/admin/products/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const product = db.products.find(x => x.id === id);
    if (!product) return sendJson(response, 404, { error: 'PRODUCT_NOT_FOUND' });
    Object.assign(product, await readJson(request)); persist();
    return sendJson(response, 200, { data: product });
  }
  if (method === 'DELETE' && p.startsWith('/api/admin/products/')) {
    if (!requireAdminOnly(request, response)) return;
    const id = p.split('/').pop();
    db.products = db.products.filter(x => x.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'POST' && p === '/api/admin/inventory') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const product = db.products.find(x => x.id === body.productId);
    if (!product) return sendJson(response, 404, { error: 'PRODUCT_NOT_FOUND' });
    const qty = Number(body.quantity) || 0;
    if (body.type === 'in') product.stock += qty;
    else product.stock = Math.max(0, product.stock - qty);
    db.inventory.push({ id: crypto.randomUUID(), productId: product.id, type: body.type, quantity: qty, note: body.note || '', createdAt: store.now() });
    if (body.type === 'in') {
      db.users.forEach(u => {
        if (u.restockWatch.includes(product.id)) db.notifications.push({ id: crypto.randomUUID(), userId: u.id, title: `${product.name} đã có lại hàng`, body: `Tồn kho hiện ${product.stock}`, read: false, createdAt: store.now() });
      });
    }
    persist(); return sendJson(response, 200, { data: product });
  }
  if (method === 'GET' && p === '/api/admin/inventory') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: db.inventory.slice().reverse() });
  }
  if (method === 'PATCH' && p.startsWith('/api/admin/orders/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const order = db.orders.find(o => o.id === id);
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    const body = await readJson(request);
    if (body.status) {
      order.status = body.status;
      if (body.status === 'shipping' && !order.trackingCode) order.trackingCode = 'GHN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      if (body.status === 'delivered') order.paymentStatus = order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus;
      order.timeline.push({ status: body.status, at: store.now(), note: body.note || '' });
    }
    persist(); return sendJson(response, 200, { data: order });
  }
  if (method === 'PATCH' && p.startsWith('/api/admin/payments/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const order = db.orders.find(o => o.id === id);
    if (!order) return sendJson(response, 404, { error: 'ORDER_NOT_FOUND' });
    const body = await readJson(request);
    if (body.paymentStatus !== 'paid' && body.paymentStatus !== 'rejected') return sendJson(response, 400, { error: 'INVALID_PAYMENT_STATUS' });
    if (body.paymentStatus === 'paid' && order.paymentStatus !== 'submitted') return sendJson(response, 400, { error: 'PAYMENT_NOT_SUBMITTED' });
    order.paymentStatus = body.paymentStatus;
    order.timeline.push({ status: body.paymentStatus === 'paid' ? 'confirmed' : 'payment_rejected', at: store.now(), note: body.note || (body.paymentStatus === 'paid' ? 'Nhân viên đã xác nhận thanh toán' : 'Nhân viên từ chối thanh toán') });
    if (body.paymentStatus === 'paid') order.status = 'confirmed';
    persist(); return sendJson(response, 200, { data: order });
  }
  if (method === 'GET' && p === '/api/admin/customers') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: db.users.filter(u => u.role === 'customer').map(store.publicUser) });
  }
  if (method === 'GET' && p === '/api/admin/vouchers') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: db.vouchers });
  }
  if (method === 'POST' && p === '/api/admin/vouchers') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const voucher = { id: String(body.code).toUpperCase(), code: String(body.code).toUpperCase(), type: body.type || 'percent', value: Number(body.value) || 10, minOrder: Number(body.minOrder) || 0, active: true, expiresAt: body.expiresAt || '2026-12-31' };
    db.vouchers.push(voucher); persist(); return sendJson(response, 201, { data: voucher });
  }
  if (method === 'PUT' && p.startsWith('/api/admin/vouchers/')) {
    if (!requireAdmin(request, response)) return;
    const code = p.split('/').pop();
    const voucher = db.vouchers.find(v => v.code === code);
    if (!voucher) return sendJson(response, 404, { error: 'NOT_FOUND' });
    Object.assign(voucher, await readJson(request)); persist();
    return sendJson(response, 200, { data: voucher });
  }
  if (method === 'POST' && p === '/api/admin/banners') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const banner = { id: crypto.randomUUID(), title: body.title, subtitle: body.subtitle || '', active: true, link: body.link || '#products', image: body.image || '' };
    db.banners.push(banner); persist(); return sendJson(response, 201, { data: banner });
  }
  if (method === 'POST' && p === '/api/admin/categories') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const cat = { id: body.id || body.name.toLowerCase().replace(/\s+/g, '-'), name: body.name, sport: body.sport || 'all' };
    db.categories.push(cat); persist(); return sendJson(response, 201, { data: cat });
  }
  if (method === 'POST' && p === '/api/admin/brands') {
    if (!requireAdmin(request, response)) return;
    const body = await readJson(request);
    const brand = { id: body.id || body.name.toLowerCase().replace(/\s+/g, '-'), name: body.name };
    db.brands.push(brand); persist(); return sendJson(response, 201, { data: brand });
  }
  if (method === 'GET' && p === '/api/admin/reviews') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: db.reviews.slice().reverse() });
  }
  if (method === 'DELETE' && p.startsWith('/api/admin/reviews/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    db.reviews = db.reviews.filter(r => r.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'POST' && p === '/api/admin/staff') {
    if (!requireAdminOnly(request, response)) return;
    const body = await readJson(request);
    const staff = { id: crypto.randomUUID(), name: body.name, email: body.email, phone: body.phone || '', password: store.hashPassword(body.password || 'staff123'), role: body.role === 'admin' ? 'admin' : 'staff', provider: 'email', points: 0, tier: 'Staff', wishlist: [], restockWatch: [], saleWatch: [], addresses: [], footLength: 0, footWidth: 0, height: 0, weight: 0, referralCode: 'NV' + crypto.randomBytes(2).toString('hex').toUpperCase(), referredBy: null, createdAt: store.now() };
    db.users.push(staff); persist();
    return sendJson(response, 201, { data: store.publicUser(staff) });
  }
  if (method === 'GET' && p === '/api/admin/staff') {
    if (!requireAdminOnly(request, response)) return;
    return sendJson(response, 200, { data: db.users.filter(u => u.role === 'admin' || u.role === 'staff').map(store.publicUser) });
  }
  if (method === 'GET' && p === '/api/admin/reports') {
    if (!requireAdmin(request, response)) return;
    const byStatus = {};
    db.orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    return sendJson(response, 200, { data: { byStatus, revenue: db.orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalVnd, 0), stockValue: db.products.reduce((s, p) => s + p.stock * store.unitPrice(p), 0), inventory: db.inventory.length } });
  }
  if (method === 'GET' && p === '/api/admin/catalog') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: { products: db.products.map(enrichProduct), categories: db.categories, brands: db.brands, banners: db.banners, vouchers: db.vouchers, combos: db.combos, flashSale: db.flashSale, settings: db.settings } });
  }
  if (method === 'PUT' && p.startsWith('/api/admin/categories/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const cat = db.categories.find(x => x.id === id);
    if (!cat) return sendJson(response, 404, { error: 'NOT_FOUND' });
    Object.assign(cat, await readJson(request)); persist();
    return sendJson(response, 200, { data: cat });
  }
  if (method === 'DELETE' && p.startsWith('/api/admin/categories/')) {
    if (!requireAdminOnly(request, response)) return;
    const id = p.split('/').pop();
    db.categories = db.categories.filter(x => x.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'PUT' && p.startsWith('/api/admin/brands/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const brand = db.brands.find(x => x.id === id);
    if (!brand) return sendJson(response, 404, { error: 'NOT_FOUND' });
    Object.assign(brand, await readJson(request)); persist();
    return sendJson(response, 200, { data: brand });
  }
  if (method === 'DELETE' && p.startsWith('/api/admin/brands/')) {
    if (!requireAdminOnly(request, response)) return;
    const id = p.split('/').pop();
    db.brands = db.brands.filter(x => x.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'PUT' && p.startsWith('/api/admin/banners/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    const banner = db.banners.find(x => x.id === id);
    if (!banner) return sendJson(response, 404, { error: 'NOT_FOUND' });
    Object.assign(banner, await readJson(request)); persist();
    return sendJson(response, 200, { data: banner });
  }
  if (method === 'DELETE' && p.startsWith('/api/admin/banners/')) {
    if (!requireAdmin(request, response)) return;
    const id = p.split('/').pop();
    db.banners = db.banners.filter(x => x.id !== id); persist();
    return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'PATCH' && p.startsWith('/api/admin/staff/')) {
    if (!requireAdminOnly(request, response)) return;
    const id = p.split('/').pop();
    const staff = db.users.find(u => u.id === id);
    if (!staff) return sendJson(response, 404, { error: 'NOT_FOUND' });
    const body = await readJson(request);
    if (body.role === 'admin' || body.role === 'staff' || body.role === 'customer') staff.role = body.role;
    if (body.password) staff.password = store.hashPassword(body.password);
    persist(); return sendJson(response, 200, { data: store.publicUser(staff) });
  }
  if (method === 'GET' && p === '/api/admin/chats') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, { data: db.chats.slice().reverse() });
  }
  if (method === 'PUT' && p === '/api/admin/flash') {
    if (!requireAdmin(request, response)) return;
    db.flashSale = { ...db.flashSale, ...(await readJson(request)) }; persist();
    return sendJson(response, 200, { data: db.flashSale });
  }
  if (method === 'PUT' && p === '/api/admin/settings') {
    if (!requireAdminOnly(request, response)) return;
    Object.assign(db.settings, await readJson(request)); persist();
    return sendJson(response, 200, { data: db.settings });
  }
  if (method === 'POST' && p === '/api/newsletter') {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) return sendJson(response, 400, { error: 'INVALID_EMAIL' });
    db.subscribers = db.subscribers || [];
    if (!db.subscribers.includes(email)) db.subscribers.push(email);
    persist(); return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'POST' && p === '/api/notifications/read') {
    const user = requireUser(request, response); if (!user) return;
    db.notifications.filter(n => n.userId === user.id).forEach(n => { n.read = true; });
    persist(); return sendJson(response, 200, { data: { ok: true } });
  }
  if (method === 'GET' && p === '/api/me/reviews') {
    const user = requireUser(request, response); if (!user) return;
    return sendJson(response, 200, { data: db.reviews.filter(r => r.userId === user.id) });
  }

  return sendJson(response, 404, { error: 'NOT_FOUND' });
}

http.createServer((request, response) => route(request, response).catch(error => sendJson(response, 500, { error: 'INTERNAL_ERROR', message: error.message }))).listen(port, () => console.log(`Veloce API listening on http://localhost:${port}`));
