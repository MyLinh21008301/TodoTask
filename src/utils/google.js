import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verify idToken (JWT) từ Google Identity Services.
 * Trả về payload: { sub, email, email_verified, name, picture, ... }
 */
export async function verifyGoogleIdToken(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload(); // iss, aud, sub, email, email_verified, name, picture...
  return payload;
}
