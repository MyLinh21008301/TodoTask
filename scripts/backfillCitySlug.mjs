import 'dotenv/config';
import mongoose from 'mongoose';
import Listing from '../src/models/listing.model.js';
import { toSlug } from '../src/utils/text.js';

async function run() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  if (!uri) throw new Error('Missing MONGODB_URI');
  await mongoose.connect(uri, { dbName });
  console.log('✅ Connected');

  const cursor = Listing.find({
    $or: [{ citySlug: { $exists: false } }, { citySlug: null }, { citySlug: '' }]
  }).cursor();

  let bulk = [];
  let count = 0;

  for await (const doc of cursor) {
    const city = doc.address?.city || '';
    const slug = city ? toSlug(city) : null;

    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { citySlug: slug } }
      }
    });

    if (bulk.length >= 500) {
      await Listing.bulkWrite(bulk);
      count += bulk.length;
      console.log(`Updated ${count}`);
      bulk = [];
    }
  }

  if (bulk.length) {
    await Listing.bulkWrite(bulk);
    count += bulk.length;
    console.log(`Updated ${count} (final)`);
  }

  await mongoose.disconnect();
  console.log('✅ Done & disconnected');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
