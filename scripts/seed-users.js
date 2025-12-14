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
