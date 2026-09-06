import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PIX_PLANS, amountToCents, verifyPaymentToken } from "@/lib/pix-payments";

const SYNCPAY_BASE = "https://api.syncpayments.com.br/api/partner/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("SyncPay credentials not configured");
  const res = await fetch(`${SYNCPAY_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) throw new Error(`Auth failed [${res.status}]`);
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Map SyncPay status -> the front-end's expected `transactionState`.
function mapStatus(s: string | undefined): string {
  switch (s) {
    case "completed":
      return "COMPLETO";
    case "pending":
      return "PENDENTE";
    case "failed":
      return "FALHO";
    case "refunded":
      return "ESTORNADO";
    case "med":
      return "MED";
    default:
      return "PENDENTE";
  }
}

const requestSchema = z.object({
  paymentToken: z.string().min(20).max(2_000),
}).strict();

export const Route = createFileRoute("/api/public/verificar-pix")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const parsed = requestSchema.safeParse(await request.json().catch(() => null));
          const signingSecret = process.env.SYNCPAY_CLIENT_SECRET;
          const reference = parsed.success && signingSecret
            ? verifyPaymentToken(parsed.data.paymentToken, signingSecret)
            : null;
          if (!reference) {
            return Response.json(
              { error: "Referência de pagamento inválida" },
              { status: 400, headers: CORS },
            );
          }
          const { transactionId, planId } = reference;
          const expectedPlan = PIX_PLANS[planId];
          if (reference.amountCents !== expectedPlan.amountCents) {
            console.error("[pix-payment-reference-mismatch]", {
              transactionId,
              planId,
              signedAmountCents: reference.amountCents,
              expectedAmountCents: expectedPlan.amountCents,
            });
            return Response.json(
              { error: "Referência de pagamento inconsistente" },
              { status: 409, headers: CORS },
            );
          }
          const token = await getAccessToken();
          const res = await fetch(
            `${SYNCPAY_BASE}/transaction/${encodeURIComponent(transactionId)}`,
            { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
          );
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok) {
            console.error("SyncPay status error:", res.status, data);
            return Response.json(
              { error: data?.message ?? "Erro ao verificar" },
              { status: res.status, headers: CORS },
            );
          }
          const providerStatus = String(data?.data?.status ?? "");
          const transactionState = mapStatus(providerStatus);
          const providerAmountCents = amountToCents(data?.data?.amount);
          if (transactionState === "COMPLETO" && providerAmountCents !== expectedPlan.amountCents) {
            console.error("[pix-confirmation-rejected-amount-mismatch]", {
              transactionId,
              planId,
              providerAmount: data?.data?.amount,
              providerAmountCents,
              expectedAmountCents: expectedPlan.amountCents,
            });
            return Response.json(
              {
                error: "Valor confirmado diverge do plano contratado",
                transaction: {
                  transactionState: "VALOR_DIVERGENTE",
                  identifier: transactionId,
                  plano_id: planId,
                },
              },
              { status: 409, headers: CORS },
            );
          }

          return Response.json(
            {
              transaction: {
                transactionState,
                amount: providerAmountCents === null ? null : providerAmountCents / 100,
                identifier: transactionId,
                plano_id: planId,
              },
            },
            { headers: CORS },
          );
        } catch (err: any) {
          console.error("/api/verificar-pix error:", err);
          return Response.json(
            { error: err?.message ?? "Erro interno" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
