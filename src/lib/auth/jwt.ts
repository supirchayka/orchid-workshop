import { SignJWT, jwtVerify } from "jose";

const alg = "HS256";

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET не задан в .env");
  return new TextEncoder().encode(secret);
}

export type JwtPayload = {
  sub: string; // userId
  name: string;
  isAdmin: boolean;
};

export async function signToken(payload: JwtPayload, expiresIn = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as unknown as JwtPayload & { exp: number; iat: number };
}
