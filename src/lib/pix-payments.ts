import { createHmac, timingSafeEqual } from "node:crypto";

export const PIX_PLANS = {
  "1-mes": { label: "1 MÊS", amountCents: 1_990 },
  "6-meses": { label: "6 MESES", amountCents: 2_990 },
  "vitalicio-bonus": { label: "VITALÍCIO + BÔNUS 🎁", amountCents: 3_990 },
  "anual-whatsapp": { label: "ANUAL + WHATSAPP 💚", amountCents: 4_990 },
} as const;

export type PixPlanId = keyof typeof PIX_PLANS;

export function isPixPlanId(value: string): value is PixPlanId {
  return Object.prototype.hasOwnProperty.call(PIX_PLANS, value);
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function amountToCents(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null;
}

type PaymentReference = {
  transactionId: string;
  planId: PixPlanId;
  amountCents: number;
  issuedAt: number;
};

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createPaymentToken(reference: PaymentReference, secret: string): string {
  const payload = Buffer.from(JSON.stringify(reference)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyPaymentToken(token: string, secret: string): PaymentReference | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = sign(payload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PaymentReference>;
    if (
      typeof parsed.transactionId !== "string" ||
      typeof parsed.planId !== "string" ||
      !isPixPlanId(parsed.planId) ||
      typeof parsed.amountCents !== "number" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    return parsed as PaymentReference;
  } catch {
    return null;
  }
}