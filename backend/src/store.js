const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataFile = path.resolve(__dirname, '..', 'data.json');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function now() {
  return new Date().toISOString();
}

function seed() {
  const products = [
    { id: 'aero-run', name: 'Veloce Aero Run', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'running-shoes', categoryLabel: 'Giày chạy bộ', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['road', 'daily'], type: 'shoes', priceVnd: 1890000, salePriceVnd: 1690000, stock: 24, soldCount: 186, colors: ['Graphite', 'Solar Lime', 'Coral'], sizes: ['39', '40', '41', '42', '43'], color: '#0a0a0a', bg: '#f2efe5', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '220g', material: 'Mesh + EVA', tech: 'CloudFoam midsole', featured: true, isNew: true, bestseller: true, description: 'Giày chạy nhẹ, đệm êm cho các buổi chạy 3-10km. Phù hợp người mới bắt đầu.' },
    { id: 'pace-everyday', name: 'Pace Everyday', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'running-shoes', categoryLabel: 'Giày chạy bộ', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['daily', 'road'], type: 'shoes', priceVnd: 1590000, salePriceVnd: 0, stock: 18, soldCount: 142, colors: ['Ivory', 'Graphite'], sizes: ['38', '39', '40', '41', '42', '43'], color: '#3a3a3a', bg: '#e8e5d8', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '245g', material: 'Knit upper', tech: 'Everyday foam', featured: true, isNew: false, bestseller: false, description: 'Đôi giày hằng ngày cân bằng giữa độ êm, độ ổn định và phong cách sống.' },
    { id: 'marathon-pro', name: 'Marathon Pro Ultra', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'running-shoes', categoryLabel: 'Giày chạy bộ', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['long-distance', 'race'], type: 'shoes', priceVnd: 3290000, salePriceVnd: 0, stock: 15, soldCount: 98, colors: ['Ember', 'Night'], sizes: ['40', '41', '42', '43', '44'], color: '#7a2d2d', bg: '#f2e4e1', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '198g', material: 'Pebax + carbon', tech: 'Carbon plate', featured: true, isNew: true, bestseller: true, description: 'Giày carbon plate, đệm Pebax siêu êm, dành cho cự ly nửa marathon trở lên.' },
    { id: 'trail-ridge', name: 'Trail Ridge Grip', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'running-shoes', categoryLabel: 'Giày chạy bộ', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['trail'], type: 'shoes', priceVnd: 2490000, salePriceVnd: 2190000, stock: 12, soldCount: 54, colors: ['Forest', 'Mud'], sizes: ['40', '41', '42', '43'], color: '#2f5e4a', bg: '#e7efe8', image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '268g', material: 'Ripstop + rubber', tech: '4mm lugs', featured: false, isNew: true, bestseller: false, description: 'Giày trail bám địa hình, đế lugs 4mm cho đường đất và núi.' },
    { id: 'fg-strike', name: 'FG Strike Boot', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'football-shoes', categoryLabel: 'Giày bóng đá', sport: 'football', sportLabel: 'Bóng đá', useCases: ['natural-grass'], type: 'shoes', priceVnd: 1890000, salePriceVnd: 0, stock: 20, soldCount: 77, colors: ['Volt', 'Black'], sizes: ['39', '40', '41', '42', '43', '44'], color: '#1a1a1a', bg: '#e8efe4', image: 'https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '210g', material: 'Synthetic leather', tech: 'FG studs', featured: true, isNew: false, bestseller: true, description: 'Giày sân cỏ tự nhiên, đinh FG, ôm chân cho đá tốc độ.' },
    { id: 'ag-turf', name: 'AG Turf Control', brand: 'motion', brandLabel: 'Motion Series', category: 'football-shoes', categoryLabel: 'Giày bóng đá', sport: 'football', sportLabel: 'Bóng đá', useCases: ['artificial-grass'], type: 'shoes', priceVnd: 1750000, salePriceVnd: 0, stock: 16, soldCount: 63, colors: ['White', 'Navy'], sizes: ['39', '40', '41', '42', '43'], color: '#1e3a5f', bg: '#e0e6ef', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '225g', material: 'Knit + TPU', tech: 'AG studs', featured: false, isNew: true, bestseller: false, description: 'Giày cỏ nhân tạo, đinh AG ngắn, kiểm soát bóng tốt.' },
    { id: 'hoops-high', name: 'Hoops High Basketball Shoe', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'basketball-shoes', categoryLabel: 'Giày bóng rổ', sport: 'basketball', sportLabel: 'Bóng rổ', useCases: ['indoor', 'outdoor'], type: 'shoes', priceVnd: 2690000, salePriceVnd: 2390000, stock: 14, soldCount: 81, colors: ['Navy', 'White'], sizes: ['40', '41', '42', '43', '44'], color: '#1e3a5f', bg: '#dfe7f0', image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '380g', material: 'Synthetic + foam', tech: 'Ankle lock', featured: true, isNew: false, bestseller: true, description: 'Giày bóng rổ cao cổ, đế giữa đàn hồi, chống trượt và bảo vệ cổ chân.' },
    { id: 'court-low', name: 'Court Low Hoops', brand: 'core', brandLabel: 'Core Essentials', category: 'basketball-shoes', categoryLabel: 'Giày bóng rổ', sport: 'basketball', sportLabel: 'Bóng rổ', useCases: ['indoor'], type: 'shoes', priceVnd: 1990000, salePriceVnd: 0, stock: 11, soldCount: 40, colors: ['Black', 'Red'], sizes: ['40', '41', '42', '43'], color: '#8b2e1f', bg: '#f2e4e1', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '340g', material: 'Leather upper', tech: 'Herringbone outsole', featured: false, isNew: true, bestseller: false, description: 'Giày bóng rổ cổ thấp, đế herringbone bám sàn nhà.' },
    { id: 'motion-tee', name: 'Motion Training Tee', brand: 'motion', brandLabel: 'Motion Series', category: 'apparel', categoryLabel: 'Quần áo', sport: 'training', sportLabel: 'Gym', useCases: ['gym'], type: 'apparel', priceVnd: 690000, salePriceVnd: 0, stock: 32, soldCount: 210, colors: ['Graphite', 'White', 'Lime'], sizes: ['S', 'M', 'L', 'XL', 'XXL'], color: '#2d2d2d', bg: '#ebe8dc', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '140g', material: 'Polyester dry-fit', tech: 'UPF50+', featured: true, isNew: false, bestseller: true, description: 'Áo tập thoáng khí, co giãn 4 chiều, khô nhanh và chống nắng UPF50+.' },
    { id: 'lift-shorts', name: 'Lift Pro Shorts', brand: 'motion', brandLabel: 'Motion Series', category: 'apparel', categoryLabel: 'Quần áo', sport: 'training', sportLabel: 'Gym', useCases: ['gym'], type: 'apparel', priceVnd: 540000, salePriceVnd: 490000, stock: 21, soldCount: 155, colors: ['Khaki', 'Black'], sizes: ['S', 'M', 'L', 'XL'], color: '#4a3f35', bg: '#e6e0d1', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '180g', material: 'Stretch nylon', tech: 'Phone pocket', featured: false, isNew: false, bestseller: true, description: 'Quần tập nhẹ, linh hoạt, túi khóa điện thoại cho squat và deadlift.' },
    { id: '8', name: 'Club Training Jersey', brand: 'motion', brandLabel: 'Motion Series', category: 'apparel', categoryLabel: 'Quần áo', sport: 'football', sportLabel: 'Bóng đá', useCases: ['match', 'training'], type: 'apparel', priceVnd: 620000, salePriceVnd: 0, stock: 20, soldCount: 88, colors: ['Navy', 'White'], sizes: ['S', 'M', 'L', 'XL'], color: '#1e3a5f', bg: '#e0e6ef', image: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '130g', material: 'Mesh polyester', tech: 'Moisture wicking', featured: false, isNew: false, bestseller: false, description: 'Áo bóng đá vải mesh thoáng khí, nhẹ 130g cho buổi tập và thi đấu.' },
    { id: 'yoga-leggings', name: 'Yoga Performance Leggings', brand: 'motion', brandLabel: 'Motion Series', category: 'apparel', categoryLabel: 'Quần áo', sport: 'yoga', sportLabel: 'Yoga', useCases: ['yoga', 'studio'], type: 'apparel', priceVnd: 620000, salePriceVnd: 0, stock: 26, soldCount: 120, colors: ['Plum', 'Black'], sizes: ['S', 'M', 'L', 'XL'], color: '#2a2433', bg: '#e6e1ed', image: 'https://images.unsplash.com/photo-1591228127791-8e2eaef098d3?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '210g', material: 'Nylon-spandex', tech: 'Opaque stretch', featured: true, isNew: true, bestseller: false, description: 'Quần legging yoga co giãn cao, không trong, túi ẩn điện thoại.' },
    { id: 'aqua-swimsuit', name: 'Aqua Swimsuit', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'apparel', categoryLabel: 'Quần áo', sport: 'swimming', sportLabel: 'Bơi lội', useCases: ['pool'], type: 'apparel', priceVnd: 750000, salePriceVnd: 0, stock: 19, soldCount: 45, colors: ['Navy', 'Teal'], sizes: ['S', 'M', 'L', 'XL'], color: '#0c2540', bg: '#dde7f3', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '160g', material: 'Chlorine-resistant', tech: 'UV block', featured: false, isNew: false, bestseller: false, description: 'Bộ đồ bơi 1 mảnh, vải chống UV, chống clo, co giãn tốt.' },
    { id: 'city-pack', name: 'City Sport Backpack 24L', brand: 'core', brandLabel: 'Core Essentials', category: 'bags', categoryLabel: 'Balo/túi', sport: 'training', sportLabel: 'Gym', useCases: ['gym', 'commute'], type: 'bag', priceVnd: 890000, salePriceVnd: 790000, stock: 22, soldCount: 67, colors: ['Black', 'Olive'], sizes: ['24L'], color: '#141414', bg: '#e7e2d3', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '620g', material: 'Recycled nylon', tech: 'Laptop 15"', featured: true, isNew: true, bestseller: false, description: 'Balo 24L ngăn giày ướt, laptop 15 inch, chống nước nhẹ.' },
    { id: 'duffel-gym', name: 'Gym Duffel 40L', brand: 'core', brandLabel: 'Core Essentials', category: 'bags', categoryLabel: 'Balo/túi', sport: 'training', sportLabel: 'Gym', useCases: ['gym'], type: 'bag', priceVnd: 690000, salePriceVnd: 0, stock: 18, soldCount: 51, colors: ['Charcoal'], sizes: ['40L'], color: '#2a2a2a', bg: '#ece8da', image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '780g', material: 'Oxford 600D', tech: 'Shoe compartment', featured: false, isNew: false, bestseller: false, description: 'Túi trống gym 40L, ngăn giày riêng, dây đeo vai.' },
    { id: '2', name: 'Core Flex Bottle', brand: 'core', brandLabel: 'Core Essentials', category: 'accessories', categoryLabel: 'Phụ kiện', sport: 'training', sportLabel: 'Đa môn', useCases: ['gym', 'running'], type: 'accessory', priceVnd: 420000, salePriceVnd: 0, stock: 30, soldCount: 240, colors: ['Steel', 'Black'], sizes: ['750ml', '1000ml'], color: '#1a1a1a', bg: '#f0ecdf', image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '310g', material: 'SS304', tech: '12h insulation', featured: false, isNew: false, bestseller: true, description: 'Bình nước giữ nhiệt 12 giờ, thép không gỉ 304.' },
    { id: 'sprint-cap', name: 'Sprint Cap', brand: 'core', brandLabel: 'Core Essentials', category: 'accessories', categoryLabel: 'Phụ kiện', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['road'], type: 'accessory', priceVnd: 350000, salePriceVnd: 0, stock: 25, soldCount: 190, colors: ['Gold', 'Black'], sizes: ['Free'], color: '#b8902e', bg: '#f8f1dc', image: 'https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '80g', material: 'Quick-dry fabric', tech: 'Sweatband', featured: false, isNew: false, bestseller: false, description: 'Mũ thể thao thoáng nhẹ, vải thấm hút mồ hôi.' },
    { id: 'bike-glove', name: 'Bike Glove Gel', brand: 'core', brandLabel: 'Core Essentials', category: 'accessories', categoryLabel: 'Phụ kiện', sport: 'cycling', sportLabel: 'Đạp xe', useCases: ['road'], type: 'accessory', priceVnd: 320000, salePriceVnd: 0, stock: 30, soldCount: 72, colors: ['Tan', 'Black'], sizes: ['S', 'M', 'L', 'XL'], color: '#4a3520', bg: '#f0e2cc', image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '60g', material: 'Lycra + gel', tech: 'Palm gel', featured: false, isNew: false, bestseller: false, description: 'Găng tay xe đạp nửa ngón, gel đệm lòng bàn tay.' },
    { id: 'ride-helmet', name: 'Ride Cycling Helmet', brand: 'motion', brandLabel: 'Motion Series', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'cycling', sportLabel: 'Đạp xe', useCases: ['road'], type: 'gear', priceVnd: 890000, salePriceVnd: 0, stock: 17, soldCount: 39, colors: ['Matte Black', 'White'], sizes: ['M', 'L', 'XL'], color: '#141414', bg: '#e7e2d3', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '260g', material: 'EPS + PC', tech: 'Magnetic buckle', featured: false, isNew: false, bestseller: false, description: 'Mũ bảo hiểm 24 lỗ thông gió, khóa từ, tiêu chuẩn CE.' },
    { id: 'resistance-band', name: 'Resistance Band Set', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'training', sportLabel: 'Gym', useCases: ['gym', 'home'], type: 'gear', priceVnd: 290000, salePriceVnd: 250000, stock: 40, soldCount: 301, colors: ['Multi'], sizes: ['Bộ 5'], color: '#5a4a2b', bg: '#f0ead7', image: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '450g', material: 'Latex', tech: '5 levels 5-50lbs', featured: true, isNew: false, bestseller: true, description: 'Bộ 5 băng tập lực từ nhẹ đến nặng, kèm túi đựng.' },
    { id: '7', name: 'Veloce Match Ball', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'football', sportLabel: 'Bóng đá', useCases: ['natural-grass', 'match'], type: 'gear', priceVnd: 790000, salePriceVnd: 0, stock: 16, soldCount: 64, colors: ['White/Gold'], sizes: ['Size 4', 'Size 5'], color: '#f5f2ea', bg: '#ece8da', image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '430g', material: 'PU match', tech: 'Hand-stitched', featured: false, isNew: false, bestseller: false, description: 'Bóng thi đấu size 5, bề mặt bám chân tốt.' },
    { id: 'hoop-elite', name: 'Hoop Elite Basketball', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'basketball', sportLabel: 'Bóng rổ', useCases: ['indoor', 'outdoor'], type: 'gear', priceVnd: 1250000, salePriceVnd: 0, stock: 22, soldCount: 58, colors: ['Orange'], sizes: ['Size 7'], color: '#8a5a2b', bg: '#efe3cf', image: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '600g', material: 'Composite leather', tech: 'Deep channel', featured: false, isNew: false, bestseller: false, description: 'Bóng rổ composite size 7, đường nổ rõ, bám tay tốt.' },
    { id: 'court-racket', name: 'Court Tennis Racket', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'tennis', sportLabel: 'Tennis', useCases: ['hard-court'], type: 'gear', priceVnd: 2390000, salePriceVnd: 0, stock: 10, soldCount: 28, colors: ['Graphite'], sizes: ['L0', 'L1', 'L2', 'L3'], color: '#2a2a2a', bg: '#e8e4d5', image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '285g', material: 'Graphite composite', tech: '100 sq.in head', featured: true, isNew: false, bestseller: false, description: 'Vợt tennis 285g, mặt vợt 100 sq.in phù hợp trung cấp.' },
    { id: 'zen-mat', name: 'Zen Yoga Mat 6mm', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'yoga', sportLabel: 'Yoga', useCases: ['yoga', 'home'], type: 'gear', priceVnd: 480000, salePriceVnd: 0, stock: 28, soldCount: 134, colors: ['Sand', 'Sage'], sizes: ['6mm', '8mm'], color: '#4a4235', bg: '#f0ebe0', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '1100g', material: 'TPE 2-layer', tech: 'Non-slip', featured: false, isNew: false, bestseller: true, description: 'Thảm yoga TPE 2 lớp, chống trượt, dày 6mm.' },
    { id: 'run-socks', name: 'Aero Run Socks 3-pack', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'accessories', categoryLabel: 'Phụ kiện', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['road', 'long-distance'], type: 'accessory', priceVnd: 190000, salePriceVnd: 0, stock: 50, soldCount: 410, colors: ['White', 'Black'], sizes: ['S', 'M', 'L'], color: '#f5f2ea', bg: '#f4f4ef', image: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '90g', material: 'Merino blend', tech: 'Arch support', featured: false, isNew: true, bestseller: true, description: 'Tất chạy bộ 3 đôi, đệm vòm, thoát ẩm.' },
    { id: 'tennis-balls', name: 'Court Tennis Balls 3-pack', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'tennis', sportLabel: 'Tennis', useCases: ['hard-court'], type: 'gear', priceVnd: 189000, salePriceVnd: 0, stock: 60, soldCount: 96, colors: ['Yellow'], sizes: ['3 quả'], color: '#d4c000', bg: '#f4f4e4', image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '174g', material: 'Felt + rubber', tech: 'ITF approved', featured: false, isNew: true, bestseller: false, description: 'Bóng tennis 3 quả, đạt chuẩn ITF, phù hợp sân cứng.' }
  ];

  products.forEach(p => { if (!p.images.length) p.images = [p.image]; p.createdAt = '2026-08-01T00:00:00.000Z'; });

  const categories = [
    { id: 'running-shoes', name: 'Giày chạy bộ', sport: 'running' },
    { id: 'football-shoes', name: 'Giày bóng đá', sport: 'football' },
    { id: 'basketball-shoes', name: 'Giày bóng rổ', sport: 'basketball' },
    { id: 'apparel', name: 'Quần áo', sport: 'all' },
    { id: 'bags', name: 'Balo/túi', sport: 'all' },
    { id: 'accessories', name: 'Phụ kiện', sport: 'all' },
    { id: 'gear', name: 'Dụng cụ tập luyện', sport: 'all' }
  ];

  const brands = [
    { id: 'veloce', name: 'Veloce Performance' },
    { id: 'core', name: 'Core Essentials' },
    { id: 'motion', name: 'Motion Series' }
  ];

  const combos = [
    { id: 'run-kit', name: 'Giày + tất chạy bộ', productIds: ['aero-run', 'run-socks'], priceVnd: 1790000 },
    { id: 'gym-kit', name: 'Áo + quần gym', productIds: ['motion-tee', 'lift-shorts'], priceVnd: 1090000 },
    { id: 'tennis-kit', name: 'Vợt + bóng tennis starter', productIds: ['court-racket', 'tennis-balls'], priceVnd: 2490000 }
  ];

  const banners = [
    { id: 'b1', title: 'Giảm 15% đơn đầu tiên', subtitle: 'Mã VELOCE15', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85', active: true, link: '#products' },
    { id: 'b2', title: 'Flash Sale cuối tuần', subtitle: 'Trail Ridge Grip -300K', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=85', active: true, link: '#products' },
    { id: 'b3', title: 'Free ship từ 499K', subtitle: 'Nội thành Hà Nội & HCM', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85', active: true, link: '#products' }
  ];

  const vouchers = [
    { id: 'VELOCE10', code: 'VELOCE10', type: 'percent', value: 10, minOrder: 0, active: true, expiresAt: '2026-12-31' },
    { id: 'VELOCE15', code: 'VELOCE15', type: 'percent', value: 15, minOrder: 0, active: true, expiresAt: '2026-12-31' },
    { id: 'FREESHIP', code: 'FREESHIP', type: 'shipping', value: 30000, minOrder: 499000, active: true, expiresAt: '2026-12-31' },
    { id: 'FLASH50', code: 'FLASH50', type: 'amount', value: 50000, minOrder: 1000000, active: true, expiresAt: '2026-12-31' }
  ];

  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const staffId = crypto.randomUUID();

  const users = [
    {
      id: adminId, name: 'Admin Veloce', email: 'admin@veloce.vn', phone: '0900000001', password: hashPassword('admin123'),
      role: 'admin', provider: 'email', points: 0, tier: 'Pro', wishlist: [], restockWatch: [], saleWatch: [],
      addresses: [{ id: 'a0', label: 'VP', name: 'Admin', phone: '0900000001', address: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội', default: true }],
      footLength: 26, footWidth: 9.5, height: 175, weight: 70, referralCode: 'ADMIN', referredBy: null, createdAt: now()
    },
    {
      id: userId, name: 'Minh Anh', email: 'minh@veloce.vn', phone: '0912345678', password: hashPassword('123456'),
      role: 'customer', provider: 'email', points: 620, tier: 'Runner', wishlist: ['marathon-pro'], restockWatch: [], saleWatch: ['trail-ridge'],
      addresses: [
        { id: 'a1', label: 'Nhà', name: 'Minh Anh', phone: '0912345678', address: '12 Nguyễn Huệ, Q.1, TP.HCM', default: true },
        { id: 'a2', label: 'Công ty', name: 'Minh Anh', phone: '0912345678', address: '45 Tràng Tiền, Hoàn Kiếm, Hà Nội', default: false }
      ],
      footLength: 25.5, footWidth: 9.2, height: 170, weight: 65, referralCode: 'MINHANH', referredBy: null, createdAt: now()
    },
    {
      id: staffId, name: 'Nhân viên Kho', email: 'kho@veloce.vn', phone: '0900000002', password: hashPassword('staff123'),
      role: 'staff', provider: 'email', points: 0, tier: 'Staff', wishlist: [], restockWatch: [], saleWatch: [],
      addresses: [], footLength: 0, footWidth: 0, height: 0, weight: 0, referralCode: 'STAFF', referredBy: null, createdAt: now()
    }
  ];

  const reviews = [
    { id: crypto.randomUUID(), productId: 'aero-run', userId, userName: 'Minh Anh', rating: 5, comment: 'Êm, nhẹ, chạy 5km rất đã.', images: [], video: '', createdAt: now() },
    { id: crypto.randomUUID(), productId: 'marathon-pro', userId, userName: 'Minh Anh', rating: 5, comment: 'Carbon plate bật cực tốt cho tempo.', images: [], video: '', createdAt: now() }
  ];

  const orderId = crypto.randomUUID();
  const orders = [{
    id: orderId,
    shortCode: 'VL8A2K',
    customerId: userId,
    shipping: { name: 'Minh Anh', phone: '0912345678', address: '12 Nguyễn Huệ, Q.1, TP.HCM', method: 'express', fee: 30000 },
    items: [{ productId: 'aero-run', name: 'Veloce Aero Run', quantity: 1, unitPriceVnd: 1690000, selectedSize: '41', selectedColor: 'Graphite' }],
    subtotalVnd: 1690000, discountVnd: 253500, shippingFee: 0, totalVnd: 1436500,
    coupon: 'VELOCE15', paymentMethod: 'zalopay', paymentStatus: 'paid',
    status: 'preparing', trackingCode: 'GHN-88421', createdAt: now(), timeline: [
      { status: 'pending', at: now(), note: 'Đơn đã đặt' },
      { status: 'preparing', at: now(), note: 'Kho đang đóng hàng' }
    ]
  }];

  const inventory = [{ id: crypto.randomUUID(), productId: 'aero-run', type: 'out', quantity: 1, note: 'Đơn VL8A2K', createdAt: now() }];
  const notifications = [{ id: crypto.randomUUID(), userId, title: 'Trail Ridge đang giảm giá', body: 'Giảm còn 2.190.000đ', read: false, createdAt: now() }];
  const chats = [];
  const blog = [
    { id: 'j1', title: 'Cách chọn giày theo môn thể thao', excerpt: 'Chạy bộ, bóng đá hay bóng rổ cần đế và độ ổn định khác nhau.', createdAt: now() },
    { id: 'j2', title: 'Lịch tập 5K cho người mới', excerpt: '8 tuần tăng dần volume, kèm gợi ý giày Aero Run.', createdAt: now() }
  ];
  const flashSale = { active: true, productId: 'trail-ridge', endsAt: new Date(Date.now() + 86400000 * 2).toISOString() };

  return {
    products, categories, brands, combos, banners, vouchers, users, reviews, orders, inventory, notifications, chats, blog, flashSale,
    settings: { freeShipMin: 499000, shipping: { standard: 30000, express: 45000, store: 0 }, returnDays: 30 }
  };
}

function extraCatalog() {
  return {
    products: [
      { id: 'tennis-balls', name: 'Court Tennis Balls 3-pack', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'tennis', sportLabel: 'Tennis', useCases: ['hard-court'], type: 'gear', priceVnd: 189000, salePriceVnd: 0, stock: 60, soldCount: 96, colors: ['Yellow'], sizes: ['3 quả'], color: '#d4c000', bg: '#f4f4e4', image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85', images: ['https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=900&q=85'], video: '', weight: '174g', material: 'Felt + rubber', tech: 'ITF approved', featured: false, isNew: true, bestseller: false, description: 'Bóng tennis 3 quả, đạt chuẩn ITF, phù hợp sân cứng.', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'pro-badminton-racket', name: 'Pro Feather Badminton Racket', brand: 'core', brandLabel: 'Core Essentials', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'badminton', sportLabel: 'Cầu lông', useCases: ['indoor', 'training'], type: 'racket', priceVnd: 990000, salePriceVnd: 0, stock: 18, soldCount: 42, colors: ['Black', 'Orange'], sizes: ['4U'], color: '#151515', bg: '#f2e5dc', image: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '82g', material: 'Graphite', tech: 'Carbon frame', featured: true, isNew: true, bestseller: false, description: 'Vợt cầu lông graphite nhẹ, cân bằng cho người chơi phong trào.', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'badminton-shuttlecock', name: 'Aero Shuttlecock 12-pack', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'badminton', sportLabel: 'Cầu lông', useCases: ['indoor', 'training'], type: 'gear', priceVnd: 240000, salePriceVnd: 0, stock: 35, soldCount: 76, colors: ['White'], sizes: ['12 quả'], color: '#e7e7e7', bg: '#f7f7f7', image: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '95g', material: 'Nylon', tech: 'Stable flight', featured: false, isNew: true, bestseller: false, description: 'Cầu nylon bền, đường bay ổn định cho luyện tập hàng ngày.', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'badminton-shoes', name: 'Court Flash Badminton Shoes', brand: 'motion', brandLabel: 'Motion Series', category: 'badminton-shoes', categoryLabel: 'Giày cầu lông', sport: 'badminton', sportLabel: 'Cầu lông', useCases: ['indoor'], type: 'shoes', priceVnd: 1290000, salePriceVnd: 0, stock: 14, soldCount: 31, colors: ['White', 'Orange'], sizes: ['39', '40', '41', '42', '43'], color: '#e55d2f', bg: '#f4e7df', image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '285g', material: 'Mesh + rubber', tech: 'Court grip', featured: false, isNew: true, bestseller: false, description: 'Giày cầu lông đế bám sân, thân nhẹ và hỗ trợ chuyển hướng nhanh.', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'fg-training-ball', name: 'Match Training Football', brand: 'veloce', brandLabel: 'Veloce Performance', category: 'gear', categoryLabel: 'Dụng cụ tập luyện', sport: 'football', sportLabel: 'Bóng đá', useCases: ['training', 'natural-grass'], type: 'gear', priceVnd: 590000, salePriceVnd: 0, stock: 24, soldCount: 55, colors: ['White', 'Orange'], sizes: ['Size 5'], color: '#e55d2f', bg: '#f4e7df', image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '430g', material: 'PU', tech: 'Machine stitched', featured: false, isNew: false, bestseller: true, description: 'Bóng tập luyện size 5, bề mặt bám chân tốt cho sân cỏ.', createdAt: '2026-08-01T00:00:00.000Z' },
      { id: 'sport-waist-pack', name: 'Run Utility Waist Pack', brand: 'core', brandLabel: 'Core Essentials', category: 'bags', categoryLabel: 'Balo/túi', sport: 'running', sportLabel: 'Chạy bộ', useCases: ['road', 'daily'], type: 'accessory', priceVnd: 390000, salePriceVnd: 0, stock: 27, soldCount: 83, colors: ['Black', 'Orange'], sizes: ['2L'], color: '#151515', bg: '#f4e7df', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85', images: [], video: '', weight: '180g', material: 'Ripstop nylon', tech: 'Reflective trim', featured: false, isNew: true, bestseller: false, description: 'Túi đeo hông gọn nhẹ, có ngăn chai nước và khóa phản quang.', createdAt: '2026-08-01T00:00:00.000Z' }
    ],
    combos: [
      { id: 'run-kit', name: 'Giày + tất chạy bộ', productIds: ['aero-run', 'run-socks'], priceVnd: 1790000 },
      { id: 'gym-kit', name: 'Áo + quần gym', productIds: ['motion-tee', 'lift-shorts'], priceVnd: 1090000 },
      { id: 'tennis-kit', name: 'Vợt + bóng tennis starter', productIds: ['court-racket', 'tennis-balls'], priceVnd: 2490000 }
    ]
  };
}

function mergeSeed(db) {
  const extra = extraCatalog();
  let changed = false;
  extra.products.forEach(p => { if (!db.products.find(x => x.id === p.id)) { db.products.push(p); changed = true; } });
  extra.combos.forEach(c => {
    const i = (db.combos || []).findIndex(x => x.id === c.id);
    if (i === -1) { db.combos = db.combos || []; db.combos.push(c); changed = true; }
    else if (JSON.stringify(db.combos[i].productIds) !== JSON.stringify(c.productIds)) { db.combos[i] = c; changed = true; }
  });
  if (!Array.isArray(db.subscribers)) { db.subscribers = []; changed = true; }
  if (!db.flashSale) { db.flashSale = { active: true, productId: 'trail-ridge', endsAt: new Date(Date.now() + 86400000 * 2).toISOString() }; changed = true; }
  if (changed) save(db);
  return db;
}

function load() {
  if (fs.existsSync(dataFile)) {
    try { return mergeSeed(JSON.parse(fs.readFileSync(dataFile, 'utf8'))); } catch { /* fall through */ }
  }
  const data = seed();
  save(data);
  return data;
}

function save(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return rest;
}

function unitPrice(product) {
  return product.salePriceVnd > 0 ? product.salePriceVnd : product.priceVnd;
}

function suggestShoeSize(footLengthCm) {
  if (!footLengthCm) return null;
  const mm = footLengthCm * 10;
  const eu = Math.round((mm / 6.67) + 1.5);
  return { eu: String(Math.min(46, Math.max(36, eu))), note: `Chiều dài ${footLengthCm}cm ≈ EU ${eu}. Nên thử +0.5 nếu bàn chân rộng.` };
}

module.exports = { load, save, hashPassword, verifyPassword, publicUser, unitPrice, suggestShoeSize, now, dataFile };
