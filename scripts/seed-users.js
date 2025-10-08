// import 'dotenv/config';
// import bcrypt from 'bcryptjs';
// import crypto from 'crypto';
// import { connectDB } from '../src/config/db.js';
// import User from '../src/models/user.model.js';

// const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// async function run() {
//   await connectDB();

//   // Xoá dữ liệu cũ (nếu muốn seed lại)
//   await User.deleteMany({ email: { $in: [
//     'admin@eazystay.vn',
//     'host.nguyen@gmail.com',
//     'guest.linh@example.com',
//     'homestay.owner@outlook.com'
//   ]}});

//   const now = new Date();

//   const users = [
//     // 1) Admin - local, chưa ký
//     {
//       email: 'admin@eazystay.vn',
//       emailVerifiedAt: new Date('2025-09-01T10:00:00Z'),
//       first_name: 'System',
//       last_name: 'Admin',
//       picture: 'https://cdn.eazystay.vn/avatars/admin.png',
//       phone: '+84-900-000-001',
//       passwordHash: await bcrypt.hash('P@ssw0rd!', 10),
//       auth: { local: { enabled: true }, google: null },
//       roles: ['admin'],
//       status: 'active',
//       signature: { current: null, history: [] },
//       lastLoginAt: new Date('2025-09-27T02:00:00Z'),
//       lastLoginIp: '203.113.0.10'
//     },

//     // 2) Host - Google, đã ký + 1 bản lịch sử
//     {
//       email: 'host.nguyen@gmail.com',
//       emailVerifiedAt: new Date('2025-09-10T03:20:00Z'),
//       first_name: 'Nguyen',
//       last_name: 'Thanh',
//       picture: 'https://lh3.googleusercontent.com/a/host_photo',
//       phone: '+84-909-111-222',
//       passwordHash: null,
//       auth: {
//         local: { enabled: false },
//         google: {
//           id: 'google-sub-1234567890',
//           email: 'host.nguyen@gmail.com',
//           picture: 'https://lh3.googleusercontent.com/a/host_photo',
//           linkedAt: new Date('2025-09-10T03:19:59Z')
//         }
//       },
//       roles: ['host'],
//       status: 'active',
//       signature: {
//         current: {
//           image: {
//             bucket: 'eazystay-signatures',
//             region: 'ap-southeast-1',
//             key: 'users/host/signature/2025-09-20T08-00-00Z.png',
//             url: 'https://s3.ap-southeast-1.amazonaws.com/eazystay-signatures/users/host/signature/2025-09-20T08-00-00Z.png',
//             contentType: 'image/png',
//             size: 18452, width: 600, height: 200
//           },
//           strokesJson: JSON.stringify({ lines:[{points:[[10,20],[40,60],[90,80]]}], penColor:'#000', penWidth:2 }),
//           dataHash: sha256('host-current-strokes'),
//           consent: {
//             policyKey: 'USER_SIGN_POLICY',
//             policyVersion: 'v1.2.0',
//             policyHash: sha256('policy-v1.2.0'),
//             acceptedAt: new Date('2025-09-20T08:00:02Z'),
//             locale: 'vi-VN'
//           },
//           signedAt: new Date('2025-09-20T08:00:02Z'),
//           ip: '203.113.0.20',
//           userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...',
//           device: 'Web'
//         },
//         history: [
//           {
//             image: {
//               bucket: 'eazystay-signatures',
//               region: 'ap-southeast-1',
//               key: 'users/host/signature/2025-09-10T03-25-00Z.png',
//               url: 'https://s3.ap-southeast-1.amazonaws.com/eazystay-signatures/users/host/signature/2025-09-10T03-25-00Z.png',
//               contentType: 'image/png',
//               size: 17600, width: 580, height: 190
//             },
//             strokesJson: JSON.stringify({ lines:[{points:[[8,18],[36,55],[88,76]]}], penColor:'#000', penWidth:2 }),
//             dataHash: sha256('host-history-strokes'),
//             consent: {
//               policyKey: 'USER_SIGN_POLICY',
//               policyVersion: 'v1.1.0',
//               policyHash: sha256('policy-v1.1.0'),
//               acceptedAt: new Date('2025-09-10T03:25:01Z'),
//               locale: 'vi-VN'
//             },
//             signedAt: new Date('2025-09-10T03:25:01Z'),
//             ip: '203.113.0.21',
//             userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
//             device: 'Web'
//           }
//         ]
//       },
//       lastLoginAt: new Date('2025-09-28T01:00:00Z'),
//       lastLoginIp: '203.113.0.22'
//     },

//     // 3) Guest - local, đã ký (current)
//     {
//       email: 'guest.linh@example.com',
//       emailVerifiedAt: null,
//       first_name: 'Linh',
//       last_name: 'Hoang',
//       picture: null,
//       phone: '+84-933-222-333',
//       passwordHash: await bcrypt.hash('Linh@1234', 10),
//       auth: { local: { enabled: true }, google: null },
//       roles: ['guest'],
//       status: 'active',
//       signature: {
//         current: {
//           image: {
//             bucket: 'eazystay-signatures',
//             region: 'ap-southeast-1',
//             key: 'users/guest.linh/signature/2025-09-25T07-30-00Z.png',
//             url: 'https://s3.ap-southeast-1.amazonaws.com/eazystay-signatures/users/guest.linh/signature/2025-09-25T07-30-00Z.png',
//             contentType: 'image/png',
//             size: 16240, width: 560, height: 180
//           },
//           strokesJson: JSON.stringify({ lines:[{points:[[12,22],[42,62],[92,84]]}], penColor:'#111', penWidth:2 }),
//           dataHash: sha256('guest-current-strokes'),
//           consent: {
//             policyKey: 'USER_SIGN_POLICY',
//             policyVersion: 'v1.2.0',
//             policyHash: sha256('policy-v1.2.0'),
//             acceptedAt: new Date('2025-09-25T07:30:01Z'),
//             locale: 'vi-VN'
//           },
//           signedAt: new Date('2025-09-25T07:30:01Z'),
//           ip: '113.161.1.23',
//           userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...',
//           device: 'iOS'
//         },
//         history: []
//       },
//       lastLoginAt: new Date('2025-09-27T14:10:00Z'),
//       lastLoginIp: '113.161.1.24'
//     },

//     // 4) Host - Google, chưa ký
//     {
//       email: 'homestay.owner@outlook.com',
//       emailVerifiedAt: new Date('2025-09-12T05:00:00Z'),
//       first_name: 'Tran',
//       last_name: 'Mai',
//       picture: 'https://cdn.eazystay.vn/avatars/owner.png',
//       phone: null,
//       passwordHash: null,
//       auth: {
//         local: { enabled: false },
//         google: {
//           id: 'google-sub-0987654321',
//           email: 'homestay.owner@outlook.com',
//           picture: 'https://lh3.googleusercontent.com/a/owner_photo',
//           linkedAt: new Date('2025-09-12T04:59:59Z')
//         }
//       },
//       roles: ['host'],
//       status: 'active',
//       signature: { current: null, history: [] },
//       lastLoginAt: new Date('2025-09-28T03:45:00Z'),
//       lastLoginIp: '27.72.100.35'
//     }
//   ];

//   await User.insertMany(users);
//   console.log('Seeded users:', users.map(u => u.email));
//   process.exit(0);
// }

// run().catch(err => {
//   console.error('Seed error:', err);
//   process.exit(1);
// });


import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

async function main() {
  await mongoose.connect(uri, { dbName });

  const email = 'mylinhhoangthi10@gmail.com';
  const existed = await User.findOne({ email });
  if (existed) {
    console.log('Admin existed:', existed._id.toString());
    return process.exit(0);
  }

  const user = await User.create({
    email,
    emailVerifiedAt: new Date('2025-10-01T03:00:00Z'),
    first_name: 'System',
    last_name: 'Admin',
    picture: 'https://i.pravatar.cc/150?u=mylinh.admin',
    phone: '+84-900-000-001',
    // Hash đã chuẩn cho "Tadminne11248@"
    passwordHash: '$2b$10$sH6b82Wk99kuEXBJNk9Bq.UEcp2Eu8qi6J3bxF7jJGhEWrhpr1ZPS',
    auth: { local: { enabled: true }, google: null },
    roles: ['admin'],
    status: 'active',
    emailVerification: {},
    passwordReset: {},
    signature: { current: null, history: [] },
    host: null
  });

  console.log('Admin created:', user._id.toString());
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
