// src/controllers/user.controller.js (BACKEND)
import User from "../models/user.model.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  updateUserProfileSchema,
  changePasswordSchema,
} from "../validators/user.schema.js";

// // [HEAD] Hàm lấy thông tin công khai của user bằng ID
// export const getUserPublicProfileById = async (req, res, next) => {
//   try {
//     const userId = req.params.id;

//     // Kiểm tra ID hợp lệ
//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid User ID format" });
//     }

//     // Tìm user và chỉ chọn các trường công khai cần thiết
//     const user = await User.findById(userId).select(
//       "first_name last_name picture createdAt host.status"
//     );

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json(user);
//   } catch (err) {
//     console.error("Error fetching user profile:", err);
//     next(err);
//   }
// };

// /**
//  * Lấy thông tin user hiện tại (đã đăng nhập)
//  */
// export const getCurrentUser = async (req, res, next) => {
//   try {
//     const userId = req.user._id;

//     const user = await User.findById(userId).select(
//       "-passwordHash -emailVerification -passwordReset"
//     );

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     res.json(user);
//   } catch (err) {
//     console.error("Error fetching current user:", err);
//     next(err);
//   }
// };

// export const updateUserProfile = async (req, res, next) => {
//   try {
//     const userId = req.user._id;
//     const body = updateUserProfileSchema.parse(req.body);

//     const user = await User.findById(userId);
//     if (!user) return res.status(404).json({ message: "User not found" });
//     if (user.status === "deleted")
//       return res.status(403).json({ message: "Account deleted" });
//     if (body.picture !== undefined) user.picture = body.picture || null;
//     if (body.gender !== undefined) user.gender = body.gender;
//     if (body.phone !== undefined) user.phone = body.phone || null;

//     // Address
//     if (body.address !== undefined) {
//       user.address = { ...user.address, ...body.address };
//     }

//     // 2. Logic Căn cước công dân (CCCD)
//     // Chỉ cho phép cập nhật nếu user CHƯA có CCCD trong database
//     if (body.cccdNumber) {
//       if (!user.cccdNumber) {
//         // Kiểm tra trùng lặp CCCD với người khác
//         const duplicate = await User.findOne({
//           cccdNumber: body.cccdNumber,
//           _id: { $ne: userId },
//         });
//         if (duplicate) {
//           return res
//             .status(409)
//             .json({
//               message: "Số CCCD này đã được sử dụng bởi tài khoản khác",
//             });
//         }
//         user.cccdNumber = body.cccdNumber;
//       }
//       // Nếu user.cccdNumber đã có dữ liệu, ta lờ đi yêu cầu update trường này (hoặc báo lỗi tùy bạn)
//     }

//     /* LƯU Ý: Theo yêu cầu "trừ Họ tên, ngày sinh", tôi đã REMOVE đoạn cập nhật 
//        first_name, last_name, dob ở đây. User gửi lên cũng sẽ bị bỏ qua.
//     */

//     user.updatedBy = userId;
//     await user.save();

//     const updatedUser = await User.findById(userId).select(
//       "-passwordHash -emailVerification -passwordReset"
//     );

//     res.json({
//       message: "Cập nhật thông tin thành công",
//       user: updatedUser,
//     });
//   } catch (err) {
//     if (err.name === "ZodError") {
//       return res.status(400).json({
//         message: "Validation error",
//         errors: err.errors,
//       });
//     }
//     if (err.code === 11000 && err.keyPattern?.phone) {
//       return res.status(400).json({ message: "Số điện thoại này đã tồn tại" });
//     }
//     next(err);
//   }
// };

// === THÊM IMPORT ĐỂ XỬ LÝ S3 ===
import { s3 } from '../config/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
// ===============================

// [HEAD] Hàm lấy thông tin công khai của user bằng ID
export const getUserPublicProfileById = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User ID format" });
    }

    const user = await User.findById(userId).select(
      "first_name last_name picture createdAt host.status"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    next(err);
  }
};

export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select(
      "-passwordHash -emailVerification -passwordReset"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching current user:", err);
    next(err);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    // Lưu ý: Bạn cần cập nhật updateUserProfileSchema trong validators để cho phép trường 'signature' (string, optional)
    // const body = updateUserProfileSchema.parse(req.body); 
    // Tạm thời dùng req.body trực tiếp nếu schema chưa update, hoặc update schema sau.
    const body = req.body; 

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status === "deleted")
      return res.status(403).json({ message: "Account deleted" });

    // 1. Cập nhật thông tin cơ bản
    if (body.picture !== undefined) user.picture = body.picture || null;
    if (body.gender !== undefined) user.gender = body.gender;
    if (body.phone !== undefined) user.phone = body.phone || null;
    if (body.address !== undefined) {
      user.address = { ...user.address, ...body.address };
    }

    // 2. Logic Căn cước công dân (CCCD)
    if (body.cccdNumber) {
      if (!user.cccdNumber) {
        const duplicate = await User.findOne({
          cccdNumber: body.cccdNumber,
          _id: { $ne: userId },
        });
        if (duplicate) {
          return res.status(409).json({ message: "Số CCCD này đã được sử dụng bởi tài khoản khác" });
        }
        user.cccdNumber = body.cccdNumber;
      }
    }

    // === 3. [MỚI] LOGIC CẬP NHẬT CHỮ KÝ ĐIỆN TỬ ===
    // Kiểm tra: Có gửi chữ ký dạng base64 VÀ user là host
    if (body.signature && body.signature.startsWith('data:image')) {
       // Chỉ host mới được cập nhật chữ ký này (hoặc tùy logic của bạn)
       const isHost = user.roles && user.roles.includes('host');
       
       if (isHost) {
          try {
            // Upload lên S3
            const base64Data = body.signature.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            const contentType = 'image/png';
            const key = `signatures/host-${user._id}-${uuidv4()}.png`;
            const s3Bucket = process.env.S3_BUCKET;
            const s3Region = process.env.S3_REGION;

            const command = new PutObjectCommand({
              Bucket: s3Bucket,
              Key: key,
              Body: buffer,
              ContentType: contentType,
              ContentEncoding: 'base64'
            });
            await s3.send(command);

            const s3Url = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;

            // Cấu trúc lại object để lưu vào DB (khớp với lúc đăng ký Host)
            if (!user.host) user.host = {};
            if (!user.host.agreement) user.host.agreement = {};

            user.host.agreement.signature = {
              image: {
                bucket: s3Bucket,
                region: s3Region,
                key: key,
                url: s3Url,
                contentType: contentType,
                size: buffer.length
              },
              signedAt: new Date(),
              ip: req.ip,
              userAgent: req.headers['user-agent']
            };

            // Nếu user đang trong quá trình onboarding nhưng bị thiếu chữ ký, đánh dấu là đã xong
            if (user.host.onboardingSteps) {
                user.host.onboardingSteps.agreementSigned = true;
            }

          } catch (uploadErr) {
            console.error("Lỗi upload chữ ký s3:", uploadErr);
            // Không throw lỗi chết app, chỉ log ra, user có thể thử lại sau
          }
       }
    }
    // ===============================================

    user.updatedBy = userId;
    await user.save();

    const updatedUser = await User.findById(userId).select(
      "-passwordHash -emailVerification -passwordReset"
    );

    res.json({
      message: "Cập nhật thông tin thành công",
      user: updatedUser,
    });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({
        message: "Validation error",
        errors: err.errors,
      });
    }
    if (err.code === 11000 && err.keyPattern?.phone) {
      return res.status(400).json({ message: "Số điện thoại này đã tồn tại" });
    }
    next(err);
  }
};
/**
 * Đổi mật khẩu
 */
export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const body = changePasswordSchema.parse(req.body);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.auth?.local?.enabled || !user.passwordHash) {
      return res
        .status(400)
        .json({
          message: "Local password not set. Please set password first.",
        });
    }

    const isPasswordValid = await bcrypt.compare(
      body.currentPassword,
      user.passwordHash
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
    user.passwordHash = newPasswordHash;
    user.updatedBy = userId;

    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    if (err.name === "ZodError") {
      return res.status(400).json({
        message: "Validation error",
        errors: err.errors,
      });
    }

    console.error("Error changing password:", err);
    next(err);
  }
};

/**
 * Xóa tài khoản (soft delete)
 */
export const deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "deleted") {
      return res.status(400).json({ message: "Account already deleted" });
    }

    user.status = "deleted";
    user.updatedBy = userId;

    await user.save();

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Error deleting user account:", err);
    next(err);
  }
};
//danh sách yêu thích
export const toggleWishlist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { listingId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const index = user.wishlist.indexOf(listingId);

    if (index === -1) {
      user.wishlist.push(listingId);
    } else {
      // Đã có -> Xóa đi
      user.wishlist.splice(index, 1);
    }

    await user.save();

    // Trả về danh sách wishlist mới để frontend cập nhật
    res.json({ wishlist: user.wishlist });
  } catch (err) {
    next(err);
  }
};

export const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate("wishlist");
    // populate('wishlist') sẽ thay thế mảng ID bằng mảng Listing object thực sự

    if (!user) return res.status(404).json({ message: "User not found" });

    // Lọc bỏ các listing null (trường hợp listing bị xóa nhưng id vẫn còn trong wishlist)
    const wishlistItems = user.wishlist.filter((item) => item !== null);

    res.json({ items: wishlistItems });
  } catch (err) {
    next(err);
  }
};
