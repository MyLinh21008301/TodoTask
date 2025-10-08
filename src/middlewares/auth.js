import { verifyAccess } from '../utils/jwt.js';
import User from '../models/user.model.js';

export async function authGuard(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const payload = verifyAccess(token);
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!req.user.roles?.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

