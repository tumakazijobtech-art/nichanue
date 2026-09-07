import { MongoClient, type Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import { logger } from "./logger";

export type NichanueApplication = {
  applicationId: string;
  nichanueId: string;
  name: string;
  phone: string;
  frustrations: string[];
  verificationId: string;
  feeKes: number;
  paid: boolean;
  status: "awaiting_payment" | "paid";
  paymentReference?: string;
  createdAt: string;
};

export type VerificationSession = {
  verificationId: string;
  phone: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  verifiedAt?: number;
};

type NichanueConfig = {
  feeKes: number;
  currency: "KES";
};

const memoryApplications = new Map<string, NichanueApplication>();
const memoryVerificationSessions = new Map<string, VerificationSession>();
let memoryConfig: NichanueConfig | undefined;
let mongoClient: MongoClient | undefined;
let mongoCollection: Collection<NichanueApplication> | undefined;

function defaultFeeKes() {
  const configured = Number(process.env["NICHANUE_FEE_KES"]);
  return Number.isFinite(configured) && configured > 0 ? configured : 50;
}

async function getMongoCollection() {
  const uri = process.env["MONGODB_URI"];
  if (!uri) return undefined;

  if (mongoCollection) return mongoCollection;

  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const database = mongoClient.db(process.env["MONGODB_DB"] ?? "nichanue");
    mongoCollection = database.collection<NichanueApplication>("applications");
    return mongoCollection;
  } catch (error) {
    logger.warn({ err: error }, "MongoDB unavailable; using temporary memory store");
    await mongoClient?.close().catch(() => undefined);
    mongoClient = undefined;
    return undefined;
  }
}

export async function getNichanueConfig(): Promise<NichanueConfig> {
  const configuredFee = defaultFeeKes();
  const collection = await getMongoCollection();

  if (!collection) {
    memoryConfig ??= { feeKes: configuredFee, currency: "KES" };
    return memoryConfig;
  }

  const database = collection.dbName;
  const settings = collection.db.collection<NichanueConfig & { _id: string }>(
    "settings",
  );
  const existing = await settings.findOne({ _id: "nichanue" });
  if (existing) return { feeKes: existing.feeKes, currency: "KES" };

  const created = { _id: "nichanue", feeKes: configuredFee, currency: "KES" as const };
  await settings.insertOne(created);
  logger.info({ database }, "Created default Nichanue settings");
  return { feeKes: created.feeKes, currency: created.currency };
}

export async function createApplication(
  input: Omit<NichanueApplication, "applicationId" | "createdAt" | "paid" | "status">,
) {
  const application: NichanueApplication = {
    ...input,
    applicationId: randomUUID(),
    createdAt: new Date().toISOString(),
    paid: false,
    status: "awaiting_payment",
  };
  const collection = await getMongoCollection();
  if (collection) {
    await collection.insertOne(application);
  } else {
    memoryApplications.set(application.applicationId, application);
  }
  return application;
}

export async function getApplication(applicationId: string) {
  const collection = await getMongoCollection();
  if (collection) return collection.findOne({ applicationId });
  return memoryApplications.get(applicationId);
}

export async function markApplicationPaid(
  applicationId: string,
  paymentReference: string,
) {
  const collection = await getMongoCollection();
  if (collection) {
    await collection.updateOne(
      { applicationId },
      { $set: { paid: true, status: "paid", paymentReference } },
    );
    return collection.findOne({ applicationId });
  }

  const application = memoryApplications.get(applicationId);
  if (!application) return undefined;
  const paidApplication = {
    ...application,
    paid: true,
    status: "paid" as const,
    paymentReference,
  };
  memoryApplications.set(applicationId, paidApplication);
  return paidApplication;
}

async function getVerificationCollection() {
  const collection = await getMongoCollection();
  return collection?.db.collection<VerificationSession>("verification_sessions");
}

export async function createVerificationSession(session: VerificationSession) {
  const collection = await getVerificationCollection();
  if (collection) {
    await collection.insertOne(session);
    return session;
  }
  if (process.env["MONGODB_URI"]) {
    throw new Error("MongoDB is unavailable for live verification storage");
  }
  memoryVerificationSessions.set(session.verificationId, session);
  return session;
}

export async function getVerificationSession(verificationId: string) {
  const collection = await getVerificationCollection();
  if (collection) return collection.findOne({ verificationId });
  if (process.env["MONGODB_URI"]) return undefined;
  return memoryVerificationSessions.get(verificationId);
}

export async function incrementVerificationAttempts(verificationId: string) {
  const collection = await getVerificationCollection();
  if (collection) {
    await collection.updateOne(
      { verificationId },
      { $inc: { attempts: 1 } },
    );
    return;
  }
  if (process.env["MONGODB_URI"]) return;

  const session = memoryVerificationSessions.get(verificationId);
  if (session) {
    memoryVerificationSessions.set(verificationId, {
      ...session,
      attempts: session.attempts + 1,
    });
  }
}

export async function markVerificationVerified(
  verificationId: string,
  expiresAt: number,
) {
  const collection = await getVerificationCollection();
  if (collection) {
    await collection.updateOne(
      { verificationId },
      { $set: { verifiedAt: Date.now(), expiresAt } },
    );
    return;
  }
  if (process.env["MONGODB_URI"]) {
    throw new Error("MongoDB is unavailable for live verification storage");
  }

  const session = memoryVerificationSessions.get(verificationId);
  if (session) {
    memoryVerificationSessions.set(verificationId, {
      ...session,
      verifiedAt: Date.now(),
      expiresAt,
    });
  }
}

export async function hasVerifiedPhone(
  verificationId: string,
  phone: string,
) {
  const collection = await getVerificationCollection();
  const session = collection
    ? await collection.findOne({ verificationId, phone })
    : process.env["MONGODB_URI"]
      ? undefined
    : memoryVerificationSessions.get(verificationId);
  return Boolean(
    session?.verifiedAt &&
      session.phone === phone &&
      session.expiresAt > Date.now(),
  );
}
