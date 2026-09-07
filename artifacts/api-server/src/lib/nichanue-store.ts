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

type NichanueConfig = {
  feeKes: number;
  currency: "KES";
};

const memoryApplications = new Map<string, NichanueApplication>();
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
