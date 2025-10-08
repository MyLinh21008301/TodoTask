import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import {
  hostApplySchema, hostKycSchema, hostPayoutDevSchema,
  hostAgreementSchema, adminApproveHostSchema
} from '../validators/host.schema.js';

export async function getHostStatus(req, res) {
  const u = req.user;
  res.json({ roles: u.roles, host: u.host || null });
}

export async function applyHost(req, res, next) {
  try {
    hostApplySchema.parse(req.body || {});
    const u = req.user;

    if (u.roles.includes('host')) {
      return res.json({ message: 'Already a host', status: 'approved' });
    }

    if (!u.host) u.host = {};
    u.host.status = 'pending';
    u.host.submittedAt = new Date();
    u.host.reason = undefined;
    u.host.onboardingSteps = u.host.onboardingSteps || {
      kycSubmitted: false, payoutLinked: false, agreementSigned: false
    };
    await u.save();

    res.json({ message: 'Host application created', status: u.host.status });
  } catch (e) { next(e); }
}

export async function submitKyc(req, res, next) {
  try {
    const body = hostKycSchema.parse(req.body);
    const u = req.user;
    if (!u.host) return res.status(400).json({ message: 'No host application' });

    u.host.kyc = {
      fullName: body.fullName,
      dob: body.dob,
      address: body.address,
      governmentId: { front: body.idFront, back: body.idBack }
    };
    u.host.onboardingSteps.kycSubmitted = true;
    await u.save();

    res.json({ message: 'KYC submitted' });
  } catch (e) { next(e); }
}

// Dev/manual payout info (production dùng Stripe Connect)
export async function linkPayoutDev(req, res, next) {
  try {
    const body = hostPayoutDevSchema.parse(req.body);
    const u = req.user;
    if (!u.host) return res.status(400).json({ message: 'No host application' });

    u.host.payout = {
      provider: 'manual',
      bank: {
        bankName: body.bankName,
        accountHolder: body.accountHolder,
        accountNumberMasked: body.accountNumberMasked
      },
      ready: true
    };
    u.host.onboardingSteps.payoutLinked = true;
    await u.save();

    res.json({ message: 'Payout linked (dev/manual)' });
  } catch (e) { next(e); }
}

export async function signHostAgreement(req, res, next) {
  try {
    const body = hostAgreementSchema.parse(req.body);
    const u = req.user;
    if (!u.host) return res.status(400).json({ message: 'No host application' });

    // dùng method attachSignature nếu muốn push vào signature chung
    u.host.agreement = {
      acceptedAt: new Date(),
      signature: {
        ...body.signature,
        signedAt: new Date()
      },
      version: '2025-10-01'
    };
    u.host.onboardingSteps.agreementSigned = true;
    await u.save();

    res.json({ message: 'Agreement signed' });
  } catch (e) { next(e); }
}

// Admin approve/reject
export async function adminApproveHost(req, res, next) {
  try {
    const { userId, approve, reason } = adminApproveHostSchema.parse(req.body);
    const u = await User.findById(userId);
    if (!u?.host) return res.status(404).json({ message: 'Application not found' });

    if (approve) {
      u.host.status = 'approved';
      u.host.approvedAt = new Date();
      u.host.reason = undefined;
      if (!u.roles.includes('host')) u.roles.push('host');

      // Bảo mật: revoke refresh tokens cũ để phiên mới có role mới
      await RefreshToken.updateMany(
        { user: u._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
      await u.save();

      res.json({ message: 'Approved', roles: u.roles });
    } else {
      u.host.status = 'rejected';
      u.host.rejectedAt = new Date();
      u.host.reason = reason || 'Not eligible';
      await u.save();
      res.json({ message: 'Rejected', reason: u.host.reason });
    }
  } catch (e) { next(e); }
}
