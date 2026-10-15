import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = 'https://upfunnel.cloudflareaccess.com';
// JWKS is a request-independent cache of public signing keys, not user data.
const keys = createRemoteJWKSet(new URL(`${ISSUER}/cdn-cgi/access/certs`));

export async function verifyToken(token, audience, allowedEmails, keySet = keys) {
  if (!token || token.length > 16384 || !audience || !allowedEmails) return null;
  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: ISSUER,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'email'],
      clockTolerance: 5
    });
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const allowed = allowedEmails.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    return email && allowed.includes(email) ? { email } : null;
  } catch {
    return null;
  }
}

export async function authenticate(request, env) {
  if (new URL(request.url).origin !== 'https://altagama.upfunnel.click') return null;
  return verifyToken(
    request.headers.get('Cf-Access-Jwt-Assertion'),
    env.METRICS_ACCESS_AUD,
    env.METRICS_ALLOWED_EMAILS
  );
}
