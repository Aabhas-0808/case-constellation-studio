export type TransactionRecord = {
  id: string;
  caseId: string;
  time: string;
  from: string;
  to: string;
  amount: number;
  hour: number;
  newBeneficiary: boolean;
  velocity: number;
  sharedAccounts: number;
  type: "transfer" | "cash_out" | "payment";
  channel: string;
};

export type TransactionRecord = {
  id: string;
  caseId: string;
  time: string;
  from: string;
  to: string;
  amount: number;
  hour: number;
  newBeneficiary: boolean;
  velocity: number;
  sharedAccounts: number;
  type: "transfer" | "cash_in" | "cash_out" | "payment";
  channel: string;
};

export type RiskFactor = { label: string; points: number; reason: string };
export type KnowledgeSource = {
  id: string;
  title: string;
  kind: "Regulatory reference" | "Synthetic case pattern";
  keywords: string[];
  note: string;
  citation: string;
  url?: string;
};

export const DEFAULT_TRANSACTION: TransactionRecord = {
  id: "TXN-DEMO",
  caseId: "CASE-2041",
  time: "14:32:08",
  from: "AC-7319",
  to: "AC-8402",
  amount: 180000,
  hour: 23,
  newBeneficiary: true,
  velocity: 6,
  sharedAccounts: 5,
  type: "cash_out",
  channel: "Mobile",
};

export const MAX_DOCUMENT_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateDocumentImage(file: { type: string; size: number }) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "unsupported_type" as const;
  }
  if (file.size > MAX_DOCUMENT_IMAGE_BYTES) return "too_large" as const;
  return null;
}

export function validateManualTransactionFields(
  fields: {
    transactionId: string;
    from: string;
    to: string;
    amount: number;
    hour: number;
    velocity: number;
    sharedAccounts: number;
    channel: string;
  },
  existingTransactionIds: string[] = [],
) {
  if (!fields.transactionId.trim() || !fields.from.trim() || !fields.to.trim()) {
    return "Complete the transaction ID and both account references.";
  }
  if (!fields.channel.trim()) return "Enter a channel for the transaction.";
  if (
    existingTransactionIds.some(
      (id) => id.trim().toLowerCase() === fields.transactionId.trim().toLowerCase(),
    )
  ) {
    return "That transaction ID already exists in this case.";
  }
  if (!Number.isFinite(fields.amount) || fields.amount <= 0) {
    return "Amount must be greater than zero.";
  }
  if (!Number.isInteger(fields.hour) || fields.hour < 0 || fields.hour > 23) {
    return "Hour must be between 0 and 23.";
  }
  if (!Number.isInteger(fields.velocity) || fields.velocity < 1 || fields.velocity > 100) {
    return "Transaction count must be between 1 and 100.";
  }
  if (
    !Number.isInteger(fields.sharedAccounts) ||
    fields.sharedAccounts < 0 ||
    fields.sharedAccounts > 100
  ) {
    return "Linked-account count must be between 0 and 100.";
  }
  return null;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === undefined) continue;

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n" || character === "\r") {
      row.push(field.trim());
      field = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("A quoted CSV field was not closed.");
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseSyntheticTransactionCsv(
  csv: string,
  caseId: string,
  existingTransactionIds: string[] = [],
) {
  if (!csv.trim()) throw new Error("The CSV file is empty.");
  const [headerRow, ...dataRows] = parseCsvRows(csv);
  if (!headerRow || dataRows.length === 0) {
    throw new Error("Add a CSV header row and at least one transaction.");
  }
  const headers = headerRow.map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim().toLowerCase(),
  );
  const headerIndex = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const index = {
    id: headerIndex(["transactionid", "transaction_id", "id"]),
    source: headerIndex(["from", "source", "account_from", "nameorig", "name_orig"]),
    destination: headerIndex(["to", "destination", "account_to", "namedest", "name_dest"]),
    amount: headerIndex(["amount"]),
    hour: headerIndex(["hour", "transaction_hour"]),
    step: headerIndex(["step"]),
    newBeneficiary: headerIndex(["newbeneficiary", "new_beneficiary"]),
    velocity: headerIndex(["velocity", "events_in_window"]),
    shared: headerIndex(["sharedaccounts", "shared_accounts", "linked_accounts"]),
    type: headerIndex(["type", "transaction_type"]),
    channel: headerIndex(["channel", "payment_channel"]),
  };
  const sourceRows = headerIndex(["nameorig", "name_orig"]) !== -1;
  const paysimFormat = index.step !== -1 && sourceRows;
  if (
    (index.id === -1 && !paysimFormat) ||
    index.source === -1 ||
    index.destination === -1 ||
    index.amount === -1
  ) {
    throw new Error(
      "Add transactionId/from/to/amount columns, or a PaySim step/type/amount/nameOrig/nameDest export.",
    );
  }

  if (dataRows.length > 100) throw new Error("Import up to 100 transactions per CSV file.");

  const seen = new Set(existingTransactionIds.map((id) => id.trim().toLowerCase()));
  const parsed: TransactionRecord[] = [];
  for (const [rowNumber, cells] of dataRows.entries()) {
    const lineNumber = rowNumber + 2;
    const value = (columnIndex: number, fallback = "") =>
      columnIndex === -1 ? fallback : (cells[columnIndex] ?? fallback);
    const transactionId = value(index.id, `PS-ROW-${lineNumber.toString().padStart(4, "0")}`);
    const from = value(index.source);
    const to = value(index.destination);
    const amount = Number(value(index.amount));
    const hourFromCsv = value(index.hour);
    const stepFromCsv = value(index.step);
    const hour = hourFromCsv ? Number(hourFromCsv) : stepFromCsv ? Number(stepFromCsv) % 24 : 14;
    const velocity = Number(value(index.velocity, "1"));
    const sharedAccounts = Number(value(index.shared, "0"));
    const typeValue = value(index.type, "transfer")
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    const type: TransactionRecord["type"] =
      typeValue === "cash_out" || typeValue === "cashout"
        ? "cash_out"
        : typeValue === "cash_in" || typeValue === "cashin"
          ? "cash_in"
        : typeValue === "payment"
          ? "payment"
          : "transfer";
    const normalizedId = transactionId.toLowerCase();

    if (!transactionId || !from || !to || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `Row ${lineNumber} must include an ID, both accounts, and a positive amount.`,
      );
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error(`Row ${lineNumber} must have an hour between 0 and 23.`);
    }
    if (!Number.isInteger(velocity) || velocity < 1 || velocity > 100) {
      throw new Error(`Row ${lineNumber} must have 1–100 review-window events.`);
    }
    if (!Number.isInteger(sharedAccounts) || sharedAccounts < 0 || sharedAccounts > 100) {
      throw new Error(`Row ${lineNumber} must have 0–100 linked sample accounts.`);
    }
    if (seen.has(normalizedId)) {
      throw new Error(`Row ${lineNumber} repeats transaction ID “${transactionId}”.`);
    }
    seen.add(normalizedId);

    const beneficiaryValue = value(index.newBeneficiary, "false").toLowerCase();
    const isNewBeneficiary = ["true", "1", "yes"].includes(beneficiaryValue);
    parsed.push({
      id: transactionId,
      caseId,
      time: `${hour.toString().padStart(2, "0")}:00:00`,
      from,
      to,
      amount,
      hour,
      newBeneficiary: isNewBeneficiary,
      velocity,
      sharedAccounts,
      type,
      channel: value(index.channel, "Imported synthetic sample"),
    });
  }

  if (parsed.length === 0) throw new Error("The CSV file contains no transaction rows.");
  if (parsed.length > 100) throw new Error("Import up to 100 transactions per CSV file.");
  return parsed;
}

export const CASES = [
  {
    id: "CASE-2041",
    label: "Beneficiary rotation",
    subject: "Synthetic account · AC-7319",
    state: "Priority review",
  },
  {
    id: "CASE-2042",
    label: "Rapid cash-out",
    subject: "Synthetic account · AC-1842",
    state: "Under review",
  },
  {
    id: "CASE-2043",
    label: "Unusual transfer path",
    subject: "Synthetic account · AC-5091",
    state: "New alert",
  },
] as const;

export const TRANSACTIONS: TransactionRecord[] = [
  {
    id: "TXN-39811",
    caseId: "CASE-2041",
    time: "14:32:08",
    from: "AC-7319",
    to: "AC-8402",
    amount: 180000,
    hour: 23,
    newBeneficiary: true,
    velocity: 6,
    sharedAccounts: 5,
    type: "cash_out",
    channel: "Mobile",
  },
  {
    id: "TXN-39804",
    caseId: "CASE-2041",
    time: "14:28:41",
    from: "AC-7319",
    to: "AC-2290",
    amount: 64800,
    hour: 23,
    newBeneficiary: true,
    velocity: 4,
    sharedAccounts: 3,
    type: "transfer",
    channel: "Mobile",
  },
  {
    id: "TXN-39792",
    caseId: "CASE-2041",
    time: "14:22:16",
    from: "AC-8402",
    to: "AC-9914",
    amount: 42500,
    hour: 22,
    newBeneficiary: false,
    velocity: 3,
    sharedAccounts: 4,
    type: "cash_out",
    channel: "Agent",
  },
  {
    id: "TXN-27618",
    caseId: "CASE-2042",
    time: "11:06:55",
    from: "AC-1842",
    to: "AC-4027",
    amount: 92000,
    hour: 11,
    newBeneficiary: true,
    velocity: 5,
    sharedAccounts: 2,
    type: "cash_out",
    channel: "Agent",
  },
  {
    id: "TXN-27603",
    caseId: "CASE-2042",
    time: "10:59:13",
    from: "AC-1842",
    to: "AC-4027",
    amount: 12000,
    hour: 10,
    newBeneficiary: false,
    velocity: 2,
    sharedAccounts: 2,
    type: "transfer",
    channel: "Mobile",
  },
  {
    id: "TXN-18420",
    caseId: "CASE-2043",
    time: "09:47:02",
    from: "AC-5091",
    to: "AC-6004",
    amount: 27500,
    hour: 9,
    newBeneficiary: true,
    velocity: 2,
    sharedAccounts: 3,
    type: "transfer",
    channel: "Web",
  },
  {
    id: "TXN-18411",
    caseId: "CASE-2043",
    time: "09:32:28",
    from: "AC-5091",
    to: "AC-7113",
    amount: 8400,
    hour: 9,
    newBeneficiary: false,
    velocity: 1,
    sharedAccounts: 1,
    type: "payment",
    channel: "Mobile",
  },
];

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  {
    id: "rbi-kyc",
    title: "RBI Master Direction — Know Your Customer (KYC), 2016",
    kind: "Regulatory reference",
    keywords: [
      "kyc",
      "customer",
      "due diligence",
      "beneficiary",
      "account",
      "identity",
      "monitoring",
    ],
    note: "Reference the current consolidated direction for customer due diligence and ongoing review. Source text is not loaded in this preview; verify the current clause before relying on it.",
    citation: "Reserve Bank of India · Master Direction on KYC (2016, as amended)",
    url: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=11566",
  },
  {
    id: "rbi-pmla",
    title: "Prevention of Money-laundering Rules, 2005",
    kind: "Regulatory reference",
    keywords: ["money laundering", "suspicious", "report", "transaction", "record", "monitoring"],
    note: "Use the current official rules and institutional procedures when reviewing suspicious-transaction indicators. This is a navigation note, not legal advice or a reproduced rule.",
    citation: "Government of India · Prevention of Money-laundering Rules, 2005 (as amended)",
    url: "https://www.indiacode.nic.in/",
  },
  {
    id: "pattern-rotation",
    title: "Rapid beneficiary rotation after account funding",
    kind: "Synthetic case pattern",
    keywords: ["beneficiary", "rotation", "new", "funding", "velocity", "transfer", "network"],
    note: "Synthetic training pattern: a short sequence of credits followed by transfers to several newly added beneficiaries may warrant a timeline review. This constructed scenario is not a real case or a proven fraud indicator.",
    citation: "Team-authored synthetic pattern note · FP-01",
  },
  {
    id: "pattern-cashout",
    title: "Short-hop transfer followed by cash-out",
    kind: "Synthetic case pattern",
    keywords: [
      "cash out",
      "cashout",
      "withdrawal",
      "shared",
      "accounts",
      "hop",
      "agent",
      "network",
    ],
    note: "Synthetic training pattern: closely timed transfers across linked accounts and a subsequent cash-out can be reviewed as a connected sequence. Linkage alone does not establish common control or wrongdoing.",
    citation: "Team-authored synthetic pattern note · FP-02",
  },
  {
    id: "pattern-hours",
    title: "Out-of-pattern transaction timing",
    kind: "Synthetic case pattern",
    keywords: ["late", "night", "hour", "timing", "velocity", "account", "channel"],
    note: "Synthetic training pattern: compare timing and channel with the account's own baseline before escalating. A late-hour transaction by itself is not evidence of fraud.",
    citation: "Team-authored synthetic pattern note · FP-03",
  },
];

export function scoreDemoTransaction(transaction: TransactionRecord) {
  const factors: RiskFactor[] = [
    {
      label: "Transaction amount",
      points:
        transaction.amount >= 100000
          ? 22
          : transaction.amount >= 50000
            ? 15
            : transaction.amount >= 25000
              ? 8
              : 0,
      reason:
        transaction.amount >= 25000
          ? "Amount band in this synthetic demo"
          : "Below demo amount bands",
    },
    {
      label: "New beneficiary",
      points: transaction.newBeneficiary ? 18 : 0,
      reason: transaction.newBeneficiary
        ? "Beneficiary marked new in sample data"
        : "Known beneficiary in sample data",
    },
    {
      label: "Transaction timing",
      points: transaction.hour >= 22 || transaction.hour <= 5 ? 12 : 0,
      reason:
        transaction.hour >= 22 || transaction.hour <= 5
          ? "Late-hour sample transaction"
          : "Daytime sample transaction",
    },
    {
      label: "Transaction velocity",
      points: transaction.velocity >= 6 ? 22 : transaction.velocity >= 3 ? 13 : 0,
      reason: `${transaction.velocity} sample transactions in the review window`,
    },
    {
      label: "Shared account links",
      points: transaction.sharedAccounts >= 4 ? 18 : transaction.sharedAccounts >= 2 ? 10 : 0,
      reason: `${transaction.sharedAccounts} linked sample accounts`,
    },
    {
      label: "Cash-out type",
      points: transaction.type === "cash_out" ? 8 : 0,
      reason:
        transaction.type === "cash_out" ? "Cash-out label in sample data" : "No cash-out label",
    },
  ];
  const rawScore = factors.reduce((sum, factor) => sum + factor.points, 0);
  const score = Math.min(100, rawScore);
  const band = score >= 65 ? "Priority" : score >= 35 ? "Review" : "Routine";
  return { score, rawScore, band, factors: factors.filter((factor) => factor.points > 0) };
}

export function rankKnowledgeSources(query: string) {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const ranked = KNOWLEDGE_SOURCES.map((source, order) => {
    const matchingTerms = source.keywords.filter((keyword) =>
      terms.some((term) => term === keyword || (term.length > 3 && keyword.includes(term))),
    );
    return { ...source, matchingTerms, relevance: matchingTerms.length, order };
  }).sort((a, b) => b.relevance - a.relevance || a.order - b.order);
  const matches = ranked.filter((source) => source.relevance > 0);
  return (matches.length ? matches : ranked).slice(0, 3);
}

export function buildInvestigationReport(
  caseId: string,
  transaction: TransactionRecord,
  sources: KnowledgeSource[] = rankKnowledgeSources("suspicious account transaction"),
) {
  const result = scoreDemoTransaction(transaction);
  const factors = result.factors
    .map((factor) => `- ${factor.label} (+${factor.points} demo points): ${factor.reason}`)
    .join("\n");
  return [
    `SYNTHETIC DEMONSTRATION REPORT · ${caseId}`,
    "Advisory prototype only. Not a trained-model result, legal conclusion, or basis for account action.",
    "",
    `Selected transaction: ${transaction.id} · ${transaction.from} → ${transaction.to}`,
    `Amount: ₹${transaction.amount.toLocaleString("en-IN")} · Channel: ${transaction.channel} · Type: ${transaction.type.replace("_", " ")}`,
    `Illustrative rule score: ${result.score}/100 · ${result.band}`,
    "",
    "Transparent demo factors:",
    factors || "- No configured demo factors were triggered.",
    "",
    "Suggested analyst checks: validate source records and account context; review the complete transaction timeline and linked-account evidence; consult current institutional policy and official regulatory text before any decision.",
    "",
    "Retrieved references:",
    ...sources.map(
      (source, index) => `[${index + 1}] ${source.citation}${source.url ? ` · ${source.url}` : ""}`,
    ),
  ].join("\n");
}
