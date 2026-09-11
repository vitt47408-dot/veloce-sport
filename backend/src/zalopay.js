function createOrderPayment({ orderId, amount, description }) {
  if (!process.env.ZALOPAY_APP_ID || !process.env.ZALOPAY_KEY1 || !process.env.ZALOPAY_KEY2) {
    return {
      status: 'pending_configuration',
      message: 'ZaloPay credentials chưa được cấu hình. Đây là điểm nối để gọi CreateOrder của ZaloPay.',
      orderId,
      amount,
      description
    };
  }

  // Production: tạo MAC HMAC-SHA256, gọi gateway ZaloPay và trả order_url/qr_code.
  return { status: 'not_implemented', orderId, amount, description };
}

module.exports = { createOrderPayment };
