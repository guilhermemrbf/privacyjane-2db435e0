import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/public/verificar-pix")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const transactionId = String(body?.transactionId ?? "").trim();
          if (!transactionId) {
            return Response.json(
              { error: "transactionId obrigatório" },
              { status: 400, headers: CORS },
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
          return Response.json(
            {
              transaction: {
                transactionState: mapStatus(data?.data?.status),
                amount: data?.data?.amount,
                identifier: transactionId,
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
