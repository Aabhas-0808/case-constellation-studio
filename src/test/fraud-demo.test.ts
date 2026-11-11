import { describe, expect, it } from "vitest";

import {
  buildInvestigationReport,
  DEFAULT_TRANSACTION,
  MAX_DOCUMENT_IMAGE_BYTES,
  parseSyntheticTransactionCsv,
  rankKnowledgeSources,
  scoreDemoTransaction,
  TRANSACTIONS,
  validateDocumentImage,
  validateManualTransactionFields,
} from "@/lib/fraud-demo";

describe("synthetic fraud investigation helpers", () => {
  it("caps the illustrative transaction score at 100", () => {
    const highSignalTransaction = TRANSACTIONS.find(
      (transaction) => transaction.id === "TXN-39811",
    );
    expect(highSignalTransaction).toBeDefined();
    if (!highSignalTransaction) return;
    expect(scoreDemoTransaction(highSignalTransaction).score).toBe(100);
  });

  it("scores a low-signal sample transaction below the review band", () => {
    const lowSignalTransaction = TRANSACTIONS.find((transaction) => transaction.id === "TXN-18411");
    expect(lowSignalTransaction).toBeDefined();
    if (!lowSignalTransaction) return;
    expect(scoreDemoTransaction(lowSignalTransaction)).toMatchObject({ score: 0, band: "Routine" });
  });

  it("ranks beneficiary guidance and patterns for beneficiary queries", () => {
    expect(
      rankKnowledgeSources("new beneficiary rotation")
        .slice(0, 2)
        .map((source) => source.id),
    ).toEqual(["pattern-rotation", "rbi-kyc"]);
  });

  it("includes retrieved source citations and a synthetic-only disclaimer in the report", () => {
    const selectedTransaction = TRANSACTIONS.find((transaction) => transaction.id === "TXN-39811");
    expect(selectedTransaction).toBeDefined();
    if (!selectedTransaction) return;
    const sources = rankKnowledgeSources("new beneficiary rotation");
    const report = buildInvestigationReport("CASE-2041", selectedTransaction, sources);
    expect(report).toContain(sources[0]?.citation ?? "");
    expect(report).toContain("Not a trained-model result, legal conclusion");
  });

  it("accepts document images up to the configured 10 MB limit", () => {
    expect(MAX_DOCUMENT_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(
      validateDocumentImage({ type: "image/jpeg", size: MAX_DOCUMENT_IMAGE_BYTES }),
    ).toBeNull();
  });

  it("rejects a document image larger than the configured 10 MB limit", () => {
    expect(validateDocumentImage({ type: "image/jpeg", size: MAX_DOCUMENT_IMAGE_BYTES + 1 })).toBe(
      "too_large",
    );
  });

  it("accepts JPEG, PNG, and WEBP document images", () => {
    expect(validateDocumentImage({ type: "image/jpeg", size: 1 })).toBeNull();
    expect(validateDocumentImage({ type: "image/png", size: 1 })).toBeNull();
    expect(validateDocumentImage({ type: "image/webp", size: 1 })).toBeNull();
  });

  it("rejects PDFs from the image-only preview path", () => {
    expect(validateDocumentImage({ type: "application/pdf", size: 1 })).toBe("unsupported_type");
  });

  it("rejects SVGs from the image-only preview path", () => {
    expect(validateDocumentImage({ type: "image/svg+xml", size: 1 })).toBe("unsupported_type");
  });

  it("requires a positive manual transaction amount", () => {
    expect(
      validateManualTransactionFields({
        transactionId: "TXN-M001",
        from: "AC-7319",
        to: "AC-8402",
        amount: 0,
        hour: 14,
        velocity: 1,
        sharedAccounts: 0,
        channel: "Mobile",
      }),
    ).toBe("Amount must be greater than zero.");
  });

  it("keeps manually entered transaction hours within 0 to 23", () => {
    expect(
      validateManualTransactionFields({
        transactionId: "TXN-M001",
        from: "AC-7319",
        to: "AC-8402",
        amount: 100,
        hour: 24,
        velocity: 1,
        sharedAccounts: 0,
        channel: "Mobile",
      }),
    ).toBe("Hour must be between 0 and 23.");
  });

  it("rejects duplicate transaction IDs in the current case", () => {
    expect(
      validateManualTransactionFields(
        {
          transactionId: "txn-39811",
          from: "AC-7319",
          to: "AC-8402",
          amount: 100,
          hour: 14,
          velocity: 1,
          sharedAccounts: 0,
          channel: "Mobile",
        },
        ["TXN-39811"],
      ),
    ).toBe("That transaction ID already exists in this case.");
  });

  it("imports transaction rows with quoted CSV account values", () => {
    const imported = parseSyntheticTransactionCsv(
      'transactionId,from,to,amount,hour,newBeneficiary,velocity,sharedAccounts,type,channel\nTXN-CSV-1,"AC, 7",AC-8402,42500,22,true,3,2,cash_out,Mobile',
      "CASE-2041",
    );
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      id: "TXN-CSV-1",
      from: "AC, 7",
      hour: 22,
      amount: 42500,
      newBeneficiary: true,
      type: "cash_out",
    });
  });

  it("rejects a CSV that repeats an existing transaction ID", () => {
    expect(() =>
      parseSyntheticTransactionCsv(
        "transactionId,from,to,amount\nTXN-39811,AC-7319,AC-8402,100",
        "CASE-2041",
        ["TXN-39811"],
      ),
    ).toThrow("already exists or repeats in this CSV");
  });

  it("limits each CSV import to 100 transaction rows", () => {
    const header = "transactionId,from,to,amount";
    const rows = Array.from({ length: 101 }, (_, index) => `TXN-${index},AC-1,AC-2,10`);
    expect(() => parseSyntheticTransactionCsv([header, ...rows].join("\n"), "CASE-2041")).toThrow(
      "Import up to 100 transactions per CSV file.",
    );
  });

  it("imports a PaySim row without using its fraud label as a scoring feature", () => {
    const imported = parseSyntheticTransactionCsv(
      "step,type,amount,nameOrig,nameDest,isFraud\n19,CASH_OUT,42000,C1001,C2001,1",
      "CASE-2041",
    );
    expect(imported[0]).toMatchObject({
      id: "PS-ROW-0002",
      from: "C1001",
      to: "C2001",
      hour: 19,
      amount: 42000,
      type: "cash_out",
      newBeneficiary: false,
      velocity: 1,
      sharedAccounts: 0,
    });
    const sample = imported[0];
    expect(sample).toBeDefined();
    if (!sample) return;
    expect(scoreDemoTransaction(sample)).not.toHaveProperty("isFraud");
  });

  it("keeps the synthetic score unchanged when PaySim fraud labels differ", () => {
    const imported = parseSyntheticTransactionCsv(
      "step,type,amount,nameOrig,nameDest,isFraud\n25,CASH_IN,6100,C1001,C3001,0\n25,CASH_IN,6100,C1001,C3001,1",
      "CASE-2041",
    );
    expect(imported[0]?.type).toBe("cash_in");
    expect(imported[0]?.hour).toBe(1);
    expect(imported).toHaveLength(2);
    expect(scoreDemoTransaction(imported[0] ?? DEFAULT_TRANSACTION).score).toBe(
      scoreDemoTransaction(imported[1] ?? DEFAULT_TRANSACTION).score,
    );
  });
});
