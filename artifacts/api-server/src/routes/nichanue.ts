import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import { randomUUID } from "node:crypto";
import {
  ConfirmPhoneVerificationBody,
  CreateNichanueApplicationBody,
  DownloadNichanueTicketParams,
  GetNichanueConfigResponse,
  InitializeNichanuePaymentBody,
  VerifyNichanuePaymentParams,
  StartPhoneVerificationBody,
} from "@workspace/api-zod";
import {
  createApplication,
  getApplication,
  getNichanueConfig,
  markApplicationPaid,
} from "../lib/nichanue-store";

const router: IRouter = Router();
const verificationSessions = new Map<
  string,
  { phone: string; code: string; expiresAt: number }
>();
const demoPaymentApplications = new Map<string, string>();

const frustrationLabels = new Set([
  "My loan application was declined",
  "My phone number is not accepted for credit",
  "I do not have enough documentation",
  "I do not know where to start",
  "I need emergency funds",
]);

function normalizePhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("254")) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function providerReady() {
  return Boolean(
    process.env["TALKSASA_API_KEY"] &&
      process.env["TALKSASA_VERIFY_START_URL"] &&
      process.env["TALKSASA_VERIFY_CONFIRM_URL"],
  );
}

function paystackReady() {
  return Boolean(process.env["PAYSTACK_SECRET_KEY"]);
}

async function talkSasaRequest(
  endpoint: string | undefined,
  payload: Record<string, string>,
) {
  if (!endpoint || !process.env["TALKSASA_API_KEY"]) return undefined;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env["TALKSASA_API_KEY"]}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Talk Sasa returned ${response.status}`);
  }
  return (await response.json()) as { verificationId?: string };
}

router.get("/nichanue/config", async (_req, res) => {
  const config = await getNichanueConfig();
  res.json(
    GetNichanueConfigResponse.parse({
      ...config,
      talkSasaReady: providerReady(),
      paystackReady: paystackReady(),
      demoMode: !providerReady() || !paystackReady(),
    }),
  );
});

router.post("/nichanue/verification/start", async (req, res) => {
  const parsed = StartPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid phone number." });

  const phone = normalizePhone(parsed.data.phone);
  const verificationId = randomUUID();
  try {
    const providerResponse = await talkSasaRequest(
      process.env["TALKSASA_VERIFY_START_URL"],
      { phone },
    );
    const providerVerificationId = providerResponse?.verificationId ?? verificationId;
    verificationSessions.set(providerVerificationId, {
      phone,
      code: "1234",
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return res.json({
      verificationId: providerVerificationId,
      message: providerReady()
        ? "A verification code has been sent to your phone."
        : "Demo mode: use verification code 1234. Connect Talk Sasa for live verification.",
      demoMode: !providerReady(),
    });
  } catch {
    return res.status(502).json({ error: "The verification service is not available right now." });
  }
});

router.post("/nichanue/verification/confirm", async (req, res) => {
  const parsed = ConfirmPhoneVerificationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the verification code." });

  const phone = normalizePhone(parsed.data.phone);
  const session = verificationSessions.get(parsed.data.verificationId);
  const isDemo = !providerReady();
  if (!session || session.phone !== phone || session.expiresAt < Date.now()) {
    return res.status(400).json({ error: "That code has expired or was not recognized. Request a new code." });
  }

  if (isDemo && parsed.data.code !== session.code) {
    return res.status(400).json({ error: "In demo mode, use verification code 1234." });
  }

  if (!isDemo && process.env["TALKSASA_VERIFY_CONFIRM_URL"]) {
    try {
      const response = await talkSasaRequest(
        process.env["TALKSASA_VERIFY_CONFIRM_URL"],
        { phone, code: parsed.data.code, verificationId: parsed.data.verificationId },
      );
      if (response === undefined) {
        return res.status(502).json({ error: "Phone verification could not be completed." });
      }
    } catch {
      return res.status(502).json({ error: "Phone verification could not be completed. Please try again." });
    }
  }

  verificationSessions.delete(parsed.data.verificationId);
  return res.json({
    verified: true,
    phone,
    message: "Your phone number has been verified.",
  });
});

router.post("/nichanue/applications", async (req, res) => {
  const parsed = CreateNichanueApplicationBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.consent) {
    return res.status(400).json({ error: "Agree to the terms before continuing." });
  }
  if (parsed.data.frustrations.some((item) => !frustrationLabels.has(item))) {
    return res.status(400).json({ error: "One of the selected options was not recognized." });
  }

  const config = await getNichanueConfig();
  const application = await createApplication({
    ...parsed.data,
    phone: normalizePhone(parsed.data.phone),
    nichanueId: `NC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    feeKes: config.feeKes,
  });
  return res.status(201).json({
    applicationId: application.applicationId,
    nichanueId: application.nichanueId,
    name: application.name,
    phone: application.phone,
    frustrations: application.frustrations,
    status: application.status,
    feeKes: application.feeKes,
    paid: application.paid,
    createdAt: application.createdAt,
  });
});

router.post("/nichanue/payments/initialize", async (req, res) => {
  const parsed = InitializeNichanuePaymentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email address." });
  const application = await getApplication(parsed.data.applicationId);
  if (!application) return res.status(404).json({ error: "Application not found." });

  const reference = `NICHANUE-${application.nichanueId}-${randomUUID().slice(0, 8)}`;
  if (!paystackReady()) {
    demoPaymentApplications.set(`DEMO-${reference}`, application.applicationId);
    return res.json({
      reference: `DEMO-${reference}`,
      authorizationUrl: "",
      accessCode: "",
      demoMode: true,
    });
  }

  try {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["PAYSTACK_SECRET_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: parsed.data.email,
        amount: Math.round(application.feeKes * 100),
        currency: "KES",
        reference,
        callback_url: process.env["PAYSTACK_CALLBACK_URL"],
        metadata: { applicationId: application.applicationId, nichanueId: application.nichanueId },
      }),
    });
    const payload = (await response.json()) as {
      status?: boolean;
      data?: { authorization_url?: string; access_code?: string; reference?: string };
    };
    if (!response.ok || !payload.status || !payload.data?.authorization_url) {
      return res.status(502).json({ error: "Paystack could not start the payment." });
    }
    return res.json({
      reference: payload.data.reference ?? reference,
      authorizationUrl: payload.data.authorization_url,
      accessCode: payload.data.access_code ?? "",
      demoMode: false,
    });
  } catch {
    return res.status(502).json({ error: "Paystack is not available right now." });
  }
});

router.get("/nichanue/payments/verify/:reference", async (req, res) => {
  const parsed = VerifyNichanuePaymentParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "The payment reference is invalid." });

  if (parsed.data.reference.startsWith("DEMO-")) {
    const applicationId = demoPaymentApplications.get(parsed.data.reference);
    const fallbackApplication = applicationId ? await getApplication(applicationId) : undefined;
    if (!fallbackApplication) return res.status(404).json({ error: "Application not found." });
    const paid = await markApplicationPaid(fallbackApplication.applicationId, parsed.data.reference);
    return res.json({
      paid: Boolean(paid),
      reference: parsed.data.reference,
      applicationId: fallbackApplication.applicationId,
      message: "Demo payment received.",
    });
  }

  if (!paystackReady()) return res.status(503).json({ error: "Paystack is not configured yet." });
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(parsed.data.reference)}`, {
      headers: { Authorization: `Bearer ${process.env["PAYSTACK_SECRET_KEY"]}` },
    });
    const payload = (await response.json()) as {
      status?: boolean;
      data?: { status?: string; reference?: string; metadata?: { applicationId?: string } };
    };
    const applicationId = payload.data?.metadata?.applicationId;
    const paid = Boolean(response.ok && payload.status && payload.data?.status === "success" && applicationId);
    if (paid && applicationId) await markApplicationPaid(applicationId, parsed.data.reference);
    return res.json({
      paid,
      reference: parsed.data.reference,
      applicationId: applicationId ?? "",
      message: paid ? "Payment confirmed." : "Payment has not been confirmed yet.",
    });
  } catch {
    return res.status(502).json({ error: "Paystack is not available right now." });
  }
});

router.get("/nichanue/tickets/:applicationId/download", async (req, res) => {
  const parsed = DownloadNichanueTicketParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "The application ID is invalid." });
  const application = await getApplication(parsed.data.applicationId);
  if (!application) return res.status(404).json({ error: "Ticket not found." });
  if (!application.paid) return res.status(403).json({ error: "Complete payment first." });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nichanue-${application.nichanueId}.pdf"`,
  );
  const document = new PDFDocument({ size: "A4", margin: 52 });
  document.pipe(res);
  document.fontSize(28).fillColor("#0c3b35").text("NICHANUE");
  document.moveDown(0.4);
  document.fontSize(13).fillColor("#5c6b68").text("Application ticket");
  document.moveDown(1.5);
  document.fontSize(12).fillColor("#1e2927");
  document.text(`Nichanue ID: ${application.nichanueId}`);
  document.text(`Name: ${application.name}`);
  document.text(`Phone: ${application.phone}`);
  document.text(`Date: ${new Date(application.createdAt).toLocaleDateString("en-KE")}`);
  document.moveDown(1);
  document.fontSize(14).fillColor("#0c3b35").text("Selected support areas");
  document.moveDown(0.4);
  document.fontSize(11).fillColor("#1e2927");
  application.frustrations.forEach((item) => document.text(`• ${item}`));
  document.moveDown(1.5);
  document.fontSize(10).fillColor("#5c6b68").text(
    "This Nichanue ticket confirms that your application was received. It is not a CRB report or a promise of loan approval. Loan decisions are made by the relevant financial service provider.",
    { width: 480 },
  );
  document.end();
  return res;
});

export default router;
