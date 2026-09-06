import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  PIX_PLANS,
  centsToAmount,
  createPaymentToken,
  isPixPlanId,
} from "@/lib/pix-payments";

const SYNCPAY_BASE = "https://api.syncpayments.com.br/api/partner/v1";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = process.env.SYNCPAY_CLIENT_ID;
  const clientSecret = process.env.SYNCPAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SyncPay credentials not configured (SYNCPAY_CLIENT_ID / SYNCPAY_CLIENT_SECRET)");
  }
  const res = await fetch(`${SYNCPAY_BASE}/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(`Auth failed [${res.status}]: ${JSON.stringify(data)}`);
  }
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

// Default client data used when the front-end page doesn't collect it.
// SyncPay requires a valid-format CPF (11 digits, valid check digits).
const DEFAULT_CLIENT = {
  name: "Cliente Privacy",
  cpf: "12345678909", // valid checksum placeholder
  email: "cliente@privacy.com",
  phone: "11999999999",
};

const requestSchema = z.object({
  plano_id: z.string().min(1).max(50),
}).strict();

export const Route = createFileRoute("/api/public/criar-pix")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const parsed = requestSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success || !isPixPlanId(parsed.data.plano_id)) {
            return Response.json(
              { success: false, error: "Plano inválido" },
              { status: 400, headers: CORS },
            );
          }

          const planId = parsed.data.plano_id;
          const plan = PIX_PLANS[planId];
          const amount = centsToAmount(plan.amountCents);

          const token = await getAccessToken();

          const url = new URL(request.url);
          const webhookUrl = `${url.origin}/api/public/syncpay-webhook`;

          const payload = {
            amount,
            description: `Assinatura ${plan.label} [plano:${planId}]`,
            webhook_url: webhookUrl,
            client: DEFAULT_CLIENT,
          };

          const res = await fetch(`${SYNCPAY_BASE}/cash-in`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const data: any = await res.json().catch(() => ({}));
          if (!res.ok || !data?.pix_code || !data?.identifier) {
            console.error("SyncPay cash-in error:", res.status, data);
            return Response.json(
              {
                success: false,
                error: data?.message ?? "Erro ao gerar PIX na SyncPay",
              },
              { status: res.status || 502, headers: CORS },
            );
          }


          const signingSecret = process.env.SYNCPAY_CLIENT_SECRET;
          if (!signingSecret) throw new Error("SyncPay credentials not configured");
          const transactionId = String(data.identifier);
          const paymentToken = createPaymentToken(
            { transactionId, planId, amountCents: plan.amountCents, issuedAt: Date.now() },
            signingSecret,
          );

          return Response.json(
            {
              success: true,
              transactionId,
              paymentToken,
              plano_id: planId,
              planLabel: plan.label,
              amount,
              copyPaste: data.pix_code,
            },
            { headers: CORS },
          );
        } catch (err: any) {
          console.error("/api/criar-pix error:", err);
          return Response.json(
            { success: false, error: err?.message ?? "Erro interno" },
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
