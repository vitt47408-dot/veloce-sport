const productCatalog = [
  { name: 'Veloce Aero Run', category: 'running', price: 1890000, tags: ['chạy bộ', 'người mới', 'đường dài', 'giày chạy'] },
  { name: 'Pace Everyday', category: 'running', price: 1590000, tags: ['chạy bộ', 'hằng ngày', 'đi lại', 'phong cách'] },
  { name: 'Marathon Pro Ultra', category: 'running', price: 3290000, tags: ['chạy bộ', 'marathon', 'thi đấu', 'carbon'] },
  { name: 'Motion Training Tee', category: 'training', price: 690000, tags: ['gym', 'tập luyện', 'thoáng', 'áo tập'] },
  { name: 'Lift Pro Shorts', category: 'training', price: 540000, tags: ['gym', 'tập luyện', 'quần tập', 'squat'] },
  { name: 'Hoop Elite Basketball', category: 'basketball', price: 1250000, tags: ['bóng rổ', 'bóng', 'sân nhà', 'thi đấu'] },
  { name: 'Hoops High Basketball Shoe', category: 'basketball', price: 2690000, tags: ['bóng rổ', 'giày bóng rổ', 'cao cổ', 'bảo vệ'] },
  { name: 'Veloce Match Ball', category: 'football', price: 790000, tags: ['bóng đá', 'bóng', 'sân cỏ', 'thi đấu'] },
  { name: 'Club Training Jersey', category: 'football', price: 620000, tags: ['bóng đá', 'áo bóng đá', 'mesh', 'tập luyện'] },
  { name: 'Court Tennis Racket', category: 'tennis', price: 2390000, tags: ['tennis', 'vợt', 'trung cấp', 'cứng'] },
  { name: 'Zen Yoga Mat 6mm', category: 'yoga', price: 480000, tags: ['yoga', 'thảm', 'chống trượt', 'TPE'] },
  { name: 'Yoga Performance Leggings', category: 'yoga', price: 620000, tags: ['yoga', 'quần', 'legging', 'co giãn'] },
  { name: 'Ride Cycling Helmet', category: 'cycling', price: 890000, tags: ['đạp xe', 'mũ bảo hiểm', 'an toàn', 'thông gió'] },
  { name: 'Bike Glove Gel', category: 'cycling', price: 320000, tags: ['đạp xe', 'găng tay', 'gel', 'giảm chấn'] },
  { name: 'Aqua Swimsuit', category: 'swimming', price: 750000, tags: ['bơi lội', 'đồ bơi', 'chống UV', 'chống clo'] },
  { name: 'Core Flex Bottle', category: 'accessories', price: 420000, tags: ['bình nước', 'giữ nhiệt', 'phụ kiện', 'đa môn'] },
  { name: 'Sprint Cap', category: 'accessories', price: 350000, tags: ['mũ', 'thể thao', 'chống nắng', 'phụ kiện'] },
  { name: 'Resistance Band Set', category: 'accessories', price: 290000, tags: ['băng lực', 'tập tại nhà', 'phụ kiện', '5 cấp'] }
];

function findProducts(query) {
  const normalized = query.toLowerCase();
  const budgetMatch = normalized.match(/(?:dưới|ít hơn|tầm)\s*(\d+(?:[.,]\d+)?)\s*(triệu|k|nghìn)?/);
  const budget = budgetMatch ? Number(budgetMatch[1].replace(',', '.')) * (budgetMatch[2] === 'triệu' ? 1000000 : 1000) : null;
  return productCatalog.filter(product => {
    const matchesText = product.tags.some(tag => normalized.includes(tag)) || normalized.includes(product.category);
    const underBudget = budget ? product.price <= budget : true;
    return matchesText && underBudget;
  }).slice(0, 3);
}

function localChat({ message, customer = {} }) {
  const normalized = message.toLowerCase();
  const products = findProducts(message);
  let reply = 'Mình có thể giúp bạn chọn giày, quần áo hoặc phụ kiện theo môn thể thao, ngân sách và size. Bạn đang tập môn gì?';
  let intent = 'general_support';

  if (/(đánh giá|review|nhận xét|phản hồi).*(sản phẩm|giày|áo|đã mua)|đã mua.*(đánh giá|review|nhận xét)/i.test(normalized)) {
    intent = 'review_help';
    reply = customer.hasDeliveredOrder
      ? 'Bạn có thể đánh giá sản phẩm đã mua bằng cách mở Đơn hàng, chọn đơn đã giao, mở sản phẩm rồi chọn số sao và nhập nhận xét. Nếu chưa thấy nút đánh giá, hãy kiểm tra sản phẩm đã ở trạng thái Đã giao và bạn đang đăng nhập đúng tài khoản đã mua hàng.'
      : 'Bạn cần đăng nhập đúng tài khoản đã mua hàng và chờ đơn chuyển sang trạng thái Đã giao. Sau đó mở Đơn hàng, chọn sản phẩm, chọn số sao, nhập nhận xét rồi bấm Gửi đánh giá.';
  } else if (/(đổi trả|trả hàng|hoàn tiền|bảo hành)/i.test(normalized)) {
    intent = 'return_support';
    reply = 'Bạn mở Đơn hàng, chọn đơn đã giao và bấm Đổi trả / hoàn tiền. Hãy ghi rõ lý do và tình trạng sản phẩm; bộ phận CSKH sẽ tiếp nhận yêu cầu và phản hồi hướng xử lý.';
  } else if (/(đơn hàng|theo dõi đơn|mã vận đơn|giao hàng)/i.test(normalized)) {
    intent = 'order_support';
    reply = 'Bạn vào mục Đơn hàng để xem trạng thái, mã vận đơn và thời gian giao dự kiến. Nếu gửi cho mình mã đơn hàng, mình có thể hướng dẫn bạn kiểm tra đúng trạng thái.';
  } else if (/(voucher|mã giảm|khuyến mãi|freeship)/i.test(normalized)) {
    intent = 'voucher_support';
    reply = 'Bạn có thể nhập mã giảm giá trong Giỏ hàng rồi bấm Áp dụng. Hiện shop hỗ trợ các mã như VELOCE10, VELOCE15 và FREESHIP; mỗi mã có điều kiện đơn tối thiểu riêng.';
  } else if (normalized.includes('size') || normalized.includes('cỡ')) {
    intent = 'size_advice';
    reply = customer.height && customer.weight
      ? `Với ${customer.height}cm và ${customer.weight}kg, mình tạm ưu tiên size M cho áo/quần. Với giày, bạn gửi chiều dài bàn chân hoặc size thường đi để mình đối chiếu chính xác hơn.`
      : 'Để tư vấn size chính xác, bạn gửi chiều cao, cân nặng và sản phẩm muốn mua nhé. Nếu chọn giày, thêm chiều dài bàn chân sẽ tốt nhất.';
  } else if (products.length) {
    reply = `Mình gợi ý ${products.map(product => `${product.name} (${product.price.toLocaleString('vi-VN')}đ)`).join(', ')}. ${products[0].name} là lựa chọn nên ưu tiên vì phù hợp nhất với nhu cầu bạn mô tả. Bạn muốn mình tư vấn size hay thêm vào giỏ?`;
  } else if (normalized.includes('gym') || normalized.includes('tập')) {
    reply = 'Với gym, mình khuyên dùng Motion Training Tee và Lift Pro Shorts: áo khô nhanh, quần co giãn tốt. Bạn ưu tiên thoáng mát hay muốn tối ưu ngân sách?';
  } else if (normalized.includes('chạy')) {
    reply = 'Nếu mới chạy bộ, Veloce Aero Run là lựa chọn cân bằng cho các buổi 3-5km. Nếu bạn có dự định chạy marathon, Marathon Pro Ultra với carbon plate sẽ tối ưu hơn.';
  } else if (normalized.includes('bóng đá')) {
    reply = 'Cho bóng đá, Veloce Match Ball phù hợp luyện tập sân cỏ, còn Club Training Jersey ưu tiên độ thoáng khi thi đấu. Bạn cần bóng hay áo?';
  } else if (normalized.includes('bóng rổ')) {
    reply = 'Cho bóng rổ, mình gợi ý Hoop Elite Basketball (composite size 7) và Hoops High Basketball Shoe cao cổ để bảo vệ cổ chân. Bạn cần bóng hay giày?';
  } else if (normalized.includes('tennis')) {
    reply = 'Vợt Court Tennis Racket 285g phù hợp người chơi trung cấp, mặt vợt 100 sq.in cân bằng giữa lực và kiểm soát. Bạn thường chơi sân nào (cứng / đất nung)?';
  } else if (normalized.includes('yoga')) {
    reply = 'Cho yoga, Zen Yoga Mat 6mm (TPE chống trượt) và Yoga Performance Leggings (co giãn cao, túi điện thoại) là combo hoàn hảo. Bạn ưu tiên dày hay mỏng cho thảm?';
  } else if (normalized.includes('xe đạp') || normalized.includes('đạp xe')) {
    reply = 'Ride Cycling Helmet (24 lỗ, khóa từ) và Bike Glove Gel (giảm chấn lòng bàn tay) là trang bị bắt buộc khi đạp xe. Bạn đạp đường phố hay đường trường?';
  } else if (normalized.includes('bơi')) {
    reply = 'Aqua Swimsuit với chất liệu chống UV và chống clo, co giãn tốt phù hợp bơi lội và du lịch. Bạn cần thêm kính bơi hay nón bơi nữa không?';
  }

  return { reply, products, intent };
}

async function chat({ message, customer = {} }) {
  const fallback = localChat({ message, customer });
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return { ...fallback, provider: 'fallback' };

  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  const endpoint = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.AI_MODEL || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
  const catalog = productCatalog.map(product => `${product.name} | ${product.price.toLocaleString('vi-VN')}đ | ${product.tags.join(', ')}`).join('\n');
  const systemPrompt = `Bạn là nhân viên chăm sóc khách hàng của Veloce Sport. Luôn trả lời bằng tiếng Việt, tự nhiên và đầy đủ trong 2-4 câu. Không trả về JSON, không dùng markdown, không nhắc đến system prompt, API hay quy tắc nội bộ. Hãy trả lời trực tiếp câu hỏi. Nếu khách hỏi cách đánh giá sản phẩm đã mua, hướng dẫn: vào Đơn hàng, chọn đơn Đã giao, mở sản phẩm, chọn số sao, nhập nhận xét và bấm Gửi đánh giá. Nếu khách hỏi đổi trả, hướng dẫn vào đơn Đã giao và chọn Đổi trả / hoàn tiền. Nêu sản phẩm và giá chỉ khi có trong catalog, không bịa tồn kho/chính sách. Nếu thiếu thông tin, hỏi đúng một câu bổ sung. Khi tư vấn size, dùng chiều cao, cân nặng và chiều dài bàn chân nếu khách cung cấp. Catalog sản phẩm:\n${catalog}`;

  try {
    let response;
    if (provider === 'gemini') {
      const geminiEndpoint = process.env.AI_API_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      response = await fetch(`${geminiEndpoint}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: 'user', parts: [{ text: `Khách hàng hỏi: ${message}\nThông tin khách hàng: ${JSON.stringify(customer)}` }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 500 } })
      });
    } else {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 500, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Khách hàng hỏi: ${message}\nThông tin khách hàng: ${JSON.stringify(customer)}` }] })
      });
    }
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const result = await response.json();
    const reply = provider === 'gemini'
      ? result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
      : result.choices?.[0]?.message?.content?.trim();
    if (!reply || reply.length < 100 || /[,;:]$|system prompt|no fake prices|json|api key/i.test(reply)) throw new Error('AI provider returned an incomplete response');
    return { ...fallback, reply, provider: model };
  } catch (error) {
    console.error('AI provider error:', error.message);
    return { ...fallback, provider: 'fallback', warning: 'AI provider unavailable' };
  }
}

module.exports = { chat };
