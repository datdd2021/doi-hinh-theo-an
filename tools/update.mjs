// Cập nhật toàn bộ dữ liệu: game (CommunityDragon) + meta (TFT Academy, seemeta).
// Chạy:  node tools/update.mjs
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (f) => execFileSync(process.execPath, [join(here, f)], { stdio: 'inherit' });
run('build-data.mjs');  // tên tướng / tộc hệ / ấn
run('build-meta.mjs');  // đội hình + thống kê (cần tên tiếng Anh từ bước trên)
run('build-data.mjs');  // lần 2: vai trò tướng theo TFT Academy + icon trang bị trong đội meta
execFileSync(process.execPath, [join(here, 'emblem-tiers.cjs')], { stdio: 'inherit', env: { ...process.env, WRITE: '1' } }); // đánh giá lại từng ấn
run('check-counts.cjs'); // đối chiếu cách đếm tộc/hệ đặc biệt với đội thật
run('best.cjs');         // đội mạnh nhất không ấn (tab "Đội mạnh nhất")
run('scale.cjs');        // thang điểm chung cho mọi bộ ấn (tier tuyệt đối), ~15 phút
try { run('regress.cjs'); } catch (e) { console.log('Có trường hợp kiểm tra chưa đạt (xem ở trên)'); } // các đội chuẩn người chơi đã xác nhận
