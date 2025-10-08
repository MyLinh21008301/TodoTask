import mongoose from 'mongoose';
export const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB;
        if (!uri) {
            throw new Error('Lỗi kết nối với env');
        }
        if (!dbName) throw new Error('Missing MONGODB_DB');
        await mongoose.connect(uri, { dbName });
        console.log('Kết nối thành công với MongoDB');
    } catch (error) {
        console.error(`Lỗi kết nốiDB`, error.message);
        process.exit(1);
    }
    };