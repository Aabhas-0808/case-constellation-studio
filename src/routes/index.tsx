import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  Eye,
  FileImage,
  FileSearch,
  Fingerprint,
  GitBranch,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CASES,
  buildInvestigationReport,
  DEFAULT_TRANSACTION,
  MAX_DOCUMENT_IMAGE_BYTES,
  parseSyntheticTransactionCsv,
  rankKnowledgeSources,
  scoreDemoTransaction,
  TRANSACTIONS,
  validateDocumentImage,
  validateManualTransactionFields,
  type TransactionRecord,
} from "@/lib/fraud-demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Investigation workspace · Integrated Fraud Investigation" },
      { name: "description", content: "Synthetic, evidence-first fraud investigation workspace." },
      { property: "og:title", content: "Investigation workspace · Integrated Fraud Investigation" },
      {
        property: "og:description",
        content:
          "Review illustrative risk signals, linked accounts and cited investigation context.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvestigationWorkspace,
});

type WorkspaceTab = "overview" | "document" | "network" | "copilot" | "report";
const INITIAL_CASE_ID = "CASE-2041";
const INITIAL_TRANSACTION_ID = "TXN-39811";

function InvestigationWorkspace() {
  const [caseId, setCaseId] = useState<string>(INITIAL_CASE_ID);
  const [transactionId, setTransactionId] = useState(INITIAL_TRANSACTION_ID);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [query, setQuery] = useState("Why was this transaction flagged?");
  const [reportGenerated, setReportGenerated] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<{
    name: string;
    url: string;
    size: string;
  } | null>(null);
  const [graphFilter, setGraphFilter] = useState("all");
  const [manualTransactions, setManualTransactions] = useState<TransactionRecord[]>([]);
  const [manualTransactionDialogOpen, setManualTransactionDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (uploadedImage) URL.revokeObjectURL(uploadedImage.url);
    },
    [uploadedImage],
  );

  const currentCase = CASES.find((item) => item.id === caseId) ?? {
    id: caseId,
    label: "Investigation",
    subject: "Synthetic account",
    state: "Under review",
  };
  const caseTransactions = [
    ...TRANSACTIONS.filter((transaction) => transaction.caseId === caseId),
    ...manualTransactions.filter((transaction) => transaction.caseId === caseId),
  ];
  const currentTransaction =
    caseTransactions.find((transaction) => transaction.id === transactionId) ??
    caseTransactions[0] ??
    DEFAULT_TRANSACTION;
  const risk = useMemo(() => scoreDemoTransaction(currentTransaction), [currentTransaction]);
  const rankedSources = useMemo(() => rankKnowledgeSources(query), [query]);
  const report = useMemo(
    () => buildInvestigationReport(caseId, currentTransaction, rankedSources),
    [caseId, currentTransaction, rankedSources],
  );

  function selectCase(nextCaseId: string) {
    const nextCase = CASES.find((item) => item.id === nextCaseId);
    const firstTransaction = TRANSACTIONS.find((transaction) => transaction.caseId === nextCaseId);
    setCaseId(nextCaseId);
    const firstManualTransaction = manualTransactions.find(
      (transaction) => transaction.caseId === nextCaseId,
    );
    if (firstTransaction) setTransactionId(firstTransaction.id);
    else if (firstManualTransaction) setTransactionId(firstManualTransaction.id);
    setReportGenerated(false);
    setActiveTab("overview");
    if (!nextCase) return;
  }

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateDocumentImage(file);
    if (validationError === "unsupported_type") {
      toast.error("For this demo, choose a JPG or PNG image.");
      event.target.value = "";
      return;
    }
    if (validationError === "too_large") {
      toast.error("Choose an image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    setUploadedImage({
      name: file.name,
      url: URL.createObjectURL(file),
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
    });
    setActiveTab("document");
    toast.success("Image added. No trained forgery model is available in this demo.");
    event.target.value = "";
  }

  function generateReport() {
    setReportGenerated(true);
    setActiveTab("report");
    toast.success("Illustrative report prepared with retrieved demo references.");
  }

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      toast.success("Report copied to clipboard.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  }

  function downloadReport() {
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${caseId.toLowerCase()}-synthetic-investigation.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadCsvTemplate() {
    const csv = [
      "transactionId,from,to,amount,hour,newBeneficiary,velocity,sharedAccounts,type,channel",
      "TXN-SAMPLE-01,AC-7319,AC-8402,25000,14,true,2,1,transfer,Mobile",
      "TXN-SAMPLE-02,AC-7319,AC-2290,9000,10,false,1,0,payment,Web",
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "synthetic-transaction-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function openFilePicker() {
    uploadInput.current?.click();
  }

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > MAX_DOCUMENT_IMAGE_BYTES) {
      toast.error("Choose a CSV smaller than 10 MB.");
      return;
    }
    try {
      const imported = parseSyntheticTransactionCsv(
        await file.text(),
        caseId,
        caseTransactions.map((transaction) => transaction.id),
      );
      setManualTransactions((existing) => [...existing, ...imported]);
      setTransactionId(imported[0]?.id ?? transactionId);
      setReportGenerated(false);
      setActiveTab("overview");
      toast.success(
        `${imported.length} synthetic transaction${imported.length === 1 ? "" : "s"} added to this case.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read this CSV file.");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Fingerprint className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">Integrated Fraud Investigation</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Analyst workspace <span aria-hidden="true">·</span> Research prototype
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-accent bg-accent/50 px-2 py-1 text-[10px] font-bold uppercase text-accent-foreground">
            <span className="size-1.5 rounded-full bg-chart-2" /> Synthetic data
          </span>
          <div className="hidden h-7 w-px bg-border sm:block" />
          <span className="text-xs text-muted-foreground">Demo environment</span>
          <div
            className="flex size-8 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold"
            title="Research analyst"
          >
            RA
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-1 xl:min-h-[calc(100vh-4rem)] xl:grid-cols-[258px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-sidebar px-4 py-4 text-sidebar-foreground xl:border-b-0 xl:border-r xl:px-4 xl:py-5">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-bold uppercase text-sidebar-foreground/70">
              Investigation queue
            </p>
            <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px]">
              03
            </Badge>
          </div>

          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 xl:mx-0 xl:block xl:space-y-1.5 xl:overflow-visible xl:px-0 xl:pb-0">
            {CASES.map((item, index) => {
              const selected = item.id === caseId;
              const sampleTransaction =
                TRANSACTIONS.find((transaction) => transaction.caseId === item.id) ??
                DEFAULT_TRANSACTION;
              const itemRisk = scoreDemoTransaction(sampleTransaction);
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant="ghost"
                  onClick={() => selectCase(item.id)}
                  aria-pressed={selected}
                  className={`group h-auto w-[260px] shrink-0 justify-start rounded-sm px-3 py-2.5 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground xl:w-full xl:py-3 ${selected ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border" : ""}`}
                >
                  <div className="flex w-full min-w-0 items-start gap-3">
                    <span
                      className={`mono-data flex size-7 shrink-0 items-center justify-center rounded-sm text-[10px] font-medium ${selected ? "bg-primary text-primary-foreground" : "bg-sidebar-border text-sidebar-foreground"}`}
                    >
                      0{index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="mono-data text-[11px] font-medium">{item.id}</span>
                        <ChevronRight className="size-3 opacity-60" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block truncate text-xs font-semibold">
                        {item.label}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-sidebar-foreground/65">
                        {item.subject}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[10px] text-sidebar-foreground/70">{item.state}</span>
                        <span className="mono-data text-[10px] font-semibold">
                          {itemRisk.score} pts
                        </span>
                      </span>
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="my-4 h-px bg-sidebar-border xl:my-5" />

          <div className="hidden px-1 xl:block">
            <p className="text-[10px] font-bold uppercase text-sidebar-foreground/70">
              Evidence sources
            </p>
            <div className="mt-3 space-y-3">
              <SourceStatus
                icon={FileImage}
                label="Document analysis"
                status={uploadedImage ? "Image uploaded · no model" : "Model not installed"}
              />
              <SourceStatus
                icon={Activity}
                label="Transaction scoring"
                status="Illustrative demo rules"
              />
              <SourceStatus
                icon={Network}
                label="Account relationships"
                status="Synthetic sample links"
              />
              <SourceStatus
                icon={BookOpen}
                label="Knowledge references"
                status="Offline demo snippets"
              />
            </div>
          </div>

          <div className="mt-4 hidden rounded-sm border border-sidebar-border bg-sidebar-accent/60 p-3 xl:mt-6 xl:block">
            <div className="flex items-start gap-2">
              <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" />
              <p className="text-[10px] leading-relaxed text-sidebar-foreground/75">
                No real customer records, trained scores, or automated account actions are used.
              </p>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1240px]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono-data text-xs font-medium text-muted-foreground">
                    {currentCase.id}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <Badge
                    variant="outline"
                    className="rounded-sm border-chart-4/30 bg-chart-4/10 text-[10px] text-foreground"
                  >
                    {currentCase.state}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-chart-2" /> synthetic case
                  </span>
                </div>
                <h1 className="mt-2 text-xl font-extrabold sm:text-2xl">{currentCase.label}</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentCase.subject} <span aria-hidden="true">·</span> Created 14 Mar 2026, 14:21
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={uploadInput}
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUpload}
                  aria-label="Upload a synthetic identity document image"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openFilePicker}
                  className="h-9 rounded-sm text-xs"
                >
                  <Upload className="size-3.5" /> Add document
                </Button>
                <Button size="sm" onClick={generateReport} className="h-9 rounded-sm text-xs">
                  <Sparkles className="size-3.5" /> Prepare report
                </Button>
              </div>
            </div>
            <input
              ref={csvInput}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvImport}
              aria-label="Import synthetic transaction CSV"
            />
            <p className="mt-1 text-[9px] text-muted-foreground">
              CSV transactions are demo-scored in this browser only; PaySim fraud labels are never
              used as input.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatCard
                icon={ShieldAlert}
                label="Illustrative risk"
                value={`${risk.score}`}
                suffix="/100"
                tone={risk.score >= 65 ? "risk" : "normal"}
                caption={`${risk.band} · rule-based demo only`}
              />
              <StatCard
                icon={Network}
                label="Linked sample accounts"
                value={`${currentTransaction.sharedAccounts}`}
                suffix="accounts"
                tone="normal"
                caption="Graph-lite sample links"
              />
              <StatCard
                icon={Clock3}
                label="Review window"
                value={`${currentTransaction.velocity}`}
                suffix="events"
                tone="normal"
                caption={`${currentTransaction.hour.toString().padStart(2, "0")}:00 activity window`}
              />
            </div>

            <section
              className="mt-5 border border-border bg-card"
              aria-label="Investigation pipeline"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">
                  Evidence review flow
                </span>
                <span className="mono-data text-[10px] text-muted-foreground">
                  LIVE PREVIEW · LOCAL DEMO
                </span>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                <PipelineStep
                  icon={FileSearch}
                  number="01"
                  label="Document"
                  status={uploadedImage ? "Image received" : "No image"}
                  state={uploadedImage ? "ready" : "idle"}
                />
                <PipelineStep
                  icon={Activity}
                  number="02"
                  label="Transaction"
                  status="Demo rules scored"
                  state="complete"
                />
                <PipelineStep
                  icon={GitBranch}
                  number="03"
                  label="Graph links"
                  status="Sample connections"
                  state="complete"
                />
                <PipelineStep
                  icon={BookOpen}
                  number="04"
                  label="References"
                  status="Offline snippets"
                  state="complete"
                />
              </div>
            </section>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
              className="mt-6"
            >
              <div className="overflow-x-auto border-b border-border">
                <TabsList className="h-auto min-w-max justify-start gap-5 rounded-none bg-transparent p-0 text-muted-foreground">
                  <WorkspaceTabTrigger value="overview" icon={Eye}>
                    Overview
                  </WorkspaceTabTrigger>
                  <WorkspaceTabTrigger
                    value="document"
                    icon={FileImage}
                    {...(uploadedImage ? { indicator: "1" } : {})}
                  >
                    Document
                  </WorkspaceTabTrigger>
                  <WorkspaceTabTrigger value="network" icon={Network}>
                    Network
                  </WorkspaceTabTrigger>
                  <WorkspaceTabTrigger value="copilot" icon={Sparkles}>
                    Investigation
                  </WorkspaceTabTrigger>
                  <WorkspaceTabTrigger value="report" icon={FileSearch}>
                    Report
                  </WorkspaceTabTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(290px,0.75fr)]">
                  <TransactionPanel
                    transactions={caseTransactions}
                    selectedId={currentTransaction.id}
                    onSelect={setTransactionId}
                    onAdd={() => setManualTransactionDialogOpen(true)}
                    onImport={() => csvInput.current?.click()}
                    onDownloadTemplate={downloadCsvTemplate}
                  />
                  <RiskPanel score={risk.score} band={risk.band} factors={risk.factors} />
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <NetworkPanel transaction={currentTransaction} compact />
                  <ReviewNote caseId={caseId} transaction={currentTransaction} score={risk.score} />
                </div>
              </TabsContent>

              <TabsContent value="document" className="mt-4">
                <DocumentPanel
                  image={uploadedImage}
                  onUpload={openFilePicker}
                  onClear={() => {
                    if (uploadedImage) URL.revokeObjectURL(uploadedImage.url);
                    setUploadedImage(null);
                  }}
                />
              </TabsContent>

              <TabsContent value="network" className="mt-4">
                <NetworkPanel
                  transaction={currentTransaction}
                  filter={graphFilter}
                  onFilterChange={setGraphFilter}
                />
              </TabsContent>

              <TabsContent value="copilot" className="mt-4">
                <CopilotPanel
                  query={query}
                  onQueryChange={setQuery}
                  sources={rankedSources}
                  onPrepare={generateReport}
                />
              </TabsContent>

              <TabsContent value="report" className="mt-4">
                <ReportPanel
                  report={report}
                  generated={reportGenerated}
                  onGenerate={generateReport}
                  onCopy={copyReport}
                  onDownload={downloadReport}
                  copied={copied}
                />
              </TabsContent>
            </Tabs>

            <footer className="mt-6 flex flex-wrap items-start justify-between gap-2 border-t border-border py-3 text-[10px] text-muted-foreground">
              <span>
                Research prototype · Synthetic data only · Advisory output, not an account decision
              </span>
              <span className="mono-data">BUILD 0.1.0 · {currentCase.id}</span>
            </footer>
          </div>
        </section>
      </main>
      <ManualTransactionDialog
        open={manualTransactionDialogOpen}
        onOpenChange={setManualTransactionDialogOpen}
        caseId={caseId}
        existingTransactionIds={caseTransactions.map((transaction) => transaction.id)}
        transactionNumber={manualTransactions.length + 1}
        onAdd={(transaction) => {
          setManualTransactions((existing) => [...existing, transaction]);
          setTransactionId(transaction.id);
          setReportGenerated(false);
          setActiveTab("overview");
          toast.success("Synthetic transaction added to this case.");
        }}
      />
    </div>
  );
}

function SourceStatus({
  icon: Icon,
  label,
  status,
}: {
  icon: typeof FileImage;
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold">{label}</p>
        <p className="mt-0.5 text-[10px] text-sidebar-foreground/60">{status}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  caption,
  tone,
}: {
  icon: typeof ShieldAlert;
  label: string;
  value: string;
  suffix: string;
  caption: string;
  tone: "risk" | "normal";
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border border-border bg-card px-3.5 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
        <p className="mono-data mt-1 flex items-baseline gap-1.5 text-xl font-medium">
          <span className={tone === "risk" ? "text-chart-4" : "text-foreground"}>{value}</span>
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        </p>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">{caption}</p>
      </div>
      <Icon className={`size-5 shrink-0 ${tone === "risk" ? "text-chart-4" : "text-primary"}`} />
    </div>
  );
}

function PipelineStep({
  icon: Icon,
  number,
  label,
  status,
  state,
}: {
  icon: typeof FileSearch;
  number: string;
  label: string;
  status: string;
  state: "complete" | "ready" | "idle";
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-3">
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-sm ${state === "complete" ? "bg-primary/10 text-primary" : state === "ready" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="mono-data text-[9px] text-muted-foreground">{number}</span>
          <p className="text-[11px] font-bold">{label}</p>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{status}</p>
      </div>
      {state === "complete" ? (
        <Check className="size-3.5 shrink-0 text-primary" />
      ) : state === "ready" ? (
        <span className="size-1.5 shrink-0 rounded-full bg-chart-2" />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-border" />
      )}
    </div>
  );
}

function WorkspaceTabTrigger({
  value,
  icon: Icon,
  children,
  indicator,
}: {
  value: WorkspaceTab;
  icon: typeof Eye;
  children: React.ReactNode;
  indicator?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="h-10 gap-1.5 rounded-none border-b-2 border-transparent px-1 text-[11px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
    >
      <Icon className="size-3.5" />
      {children}
      {indicator ? (
        <span className="mono-data ml-0.5 rounded-sm bg-secondary px-1 text-[9px]">
          {indicator}
        </span>
      ) : null}
    </TabsTrigger>
  );
}

function SectionHeading({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div>
        <p className="text-[9px] font-bold uppercase text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-0.5 text-xs font-extrabold">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

function TransactionPanel({
  transactions,
  selectedId,
  onSelect,
  onAdd,
  onImport,
  onDownloadTemplate,
}: {
  transactions: TransactionRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onDownloadTemplate: () => void;
}) {
  return (
    <section className="min-w-0 border border-border bg-card">
      <SectionHeading
        eyebrow="Synthetic sample data"
        title="Flagged transaction activity"
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-data text-[10px] text-muted-foreground">
              {transactions.length.toString().padStart(2, "0")} EVENTS
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onImport}
              className="h-7 rounded-sm px-2 text-[9px]"
            >
              Import CSV
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownloadTemplate}
              title="Download synthetic CSV template"
              aria-label="Download synthetic CSV template"
              className="size-7 rounded-sm"
            >
              <Download className="size-3.5" />
            </Button>
            <Button size="sm" onClick={onAdd} className="h-7 rounded-sm px-2 text-[9px]">
              Add transaction
            </Button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[670px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-[9px] font-semibold uppercase text-muted-foreground">
              <th className="px-3 py-2.5">Transaction</th>
              <th className="px-3 py-2.5">Time</th>
              <th className="px-3 py-2.5">Account path</th>
              <th className="px-3 py-2.5 text-right">Amount</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Demo signal</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const selected = selectedId === transaction.id;
              const itemRisk = scoreDemoTransaction(transaction);
              return (
                <tr
                  key={transaction.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(transaction.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(transaction.id);
                    }
                  }}
                  className={`cursor-pointer border-b border-border/70 text-[10px] last:border-0 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={`size-1.5 rounded-full ${itemRisk.score >= 65 ? "bg-chart-4" : itemRisk.score >= 35 ? "bg-chart-2" : "bg-chart-1"}`}
                      />
                      <span className="mono-data font-medium">{transaction.id}</span>
                    </span>
                  </td>
                  <td className="mono-data px-3 py-2.5 text-muted-foreground">
                    {transaction.time}
                  </td>
                  <td className="mono-data px-3 py-2.5">
                    {transaction.from}{" "}
                    <ArrowRight className="mx-1 inline size-3 text-muted-foreground" />{" "}
                    {transaction.to}
                  </td>
                  <td className="mono-data px-3 py-2.5 text-right font-medium">
                    ₹{transaction.amount.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="capitalize text-muted-foreground">
                      {transaction.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`mono-data font-medium ${itemRisk.score >= 65 ? "text-chart-4" : "text-chart-2"}`}
                    >
                      {itemRisk.score} pts
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-start gap-2 border-t border-border bg-secondary/30 px-3 py-2.5 text-[10px] text-muted-foreground">
        <CircleHelp className="mt-0.5 size-3 shrink-0" />
        <p>
          Rows, amounts and signals are illustrative synthetic data; points are not calibrated
          probabilities. Manually entered records stay in this browser session.
        </p>
      </div>
    </section>
  );
}

function RiskPanel({
  score,
  band,
  factors,
}: {
  score: number;
  band: string;
  factors: { label: string; points: number; reason: string }[];
}) {
  const items = factors.length
    ? factors
    : [
        {
          label: "No active signals",
          points: 0,
          reason: "This sample does not meet configured demo rule bands.",
        },
      ];
  return (
    <section className="border border-border bg-card">
      <SectionHeading
        eyebrow="Illustrative, rule-based"
        title="Signal breakdown"
        trailing={
          <Badge variant="outline" className="rounded-sm text-[9px]">
            Not model output
          </Badge>
        }
      />
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        <div className="relative flex size-[66px] shrink-0 items-center justify-center rounded-full border-[5px] border-secondary">
          <span
            className={`mono-data text-base font-semibold ${score >= 65 ? "text-chart-4" : "text-primary"}`}
          >
            {score}
          </span>
          <span className="absolute -bottom-1 bg-card px-1 text-[8px] text-muted-foreground">
            / 100
          </span>
        </div>
        <div>
          <p className="text-xs font-bold">{band} review</p>
          <p className="mt-1 max-w-[190px] text-[10px] leading-relaxed text-muted-foreground">
            Fixed demo points from sample transaction attributes.
          </p>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        {items.map((factor) => (
          <div
            key={factor.label}
            className="grid grid-cols-[minmax(0,1fr)_32px] items-center gap-x-2 gap-y-1"
          >
            <span className="truncate text-[10px] font-medium">{factor.label}</span>
            <span className="mono-data text-right text-[10px] font-semibold text-chart-4">
              +{factor.points}
            </span>
            <span className="truncate text-[9px] text-muted-foreground">{factor.reason}</span>
            <span className="text-right text-[9px] text-muted-foreground">pts</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function NetworkPanel({
  transaction,
  compact = false,
  filter = "all",
  onFilterChange,
}: {
  transaction: TransactionRecord;
  compact?: boolean;
  filter?: string;
  onFilterChange?: (filter: string) => void;
}) {
  const nodes = [
    {
      id: transaction.from,
      x: 108,
      y: 132,
      type: "Account",
      role: "Selected account",
      focus: true,
    },
    { id: transaction.to, x: 298, y: 68, type: "Account", role: "Beneficiary", focus: true },
    {
      id: "AC-" + (8402 + transaction.sharedAccounts),
      x: 292,
      y: 190,
      type: "Account",
      role: "Linked account",
    },
    {
      id: "DEV-" + (2400 + transaction.sharedAccounts),
      x: 452,
      y: 126,
      type: "Device",
      role: "Shared device",
    },
    {
      id: "AC-" + (6110 + transaction.sharedAccounts),
      x: 540,
      y: 54,
      type: "Account",
      role: "Related account",
    },
    {
      id: "AC-" + (7201 + transaction.sharedAccounts),
      x: 540,
      y: 198,
      type: "Account",
      role: "Related account",
    },
  ];
  const edges = [
    { from: 0, to: 1, type: "transfer" },
    { from: 0, to: 2, type: "transfer" },
    { from: 1, to: 3, type: "device" },
    { from: 2, to: 3, type: "device" },
    { from: 3, to: 4, type: "device" },
    { from: 3, to: 5, type: "device" },
  ];
  const visibleEdges = edges.filter((edge) => filter === "all" || edge.type === filter);
  return (
    <section className="min-w-0 border border-border bg-card">
      <SectionHeading
        eyebrow="Graph-lite relationships"
        title="Account connection map"
        trailing={
          !compact && onFilterChange ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={filter === "all" ? "secondary" : "ghost"}
                className="h-7 rounded-sm px-2 text-[9px]"
                onClick={() => onFilterChange("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "transfer" ? "secondary" : "ghost"}
                className="h-7 rounded-sm px-2 text-[9px]"
                onClick={() => onFilterChange("transfer")}
              >
                Transfers
              </Button>
              <Button
                size="sm"
                variant={filter === "device" ? "secondary" : "ghost"}
                className="h-7 rounded-sm px-2 text-[9px]"
                onClick={() => onFilterChange("device")}
              >
                Shared device
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="rounded-sm text-[9px]">
              Synthetic links
            </Badge>
          )
        }
      />
      <div className="overflow-x-auto px-2 py-2">
        <svg
          role="img"
          aria-label="Illustrative relationship graph of synthetic account connections"
          viewBox="0 0 630 256"
          className="h-auto min-w-[460px] w-full"
        >
          <defs>
            <pattern id="network-grid" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" className="fill-border" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="630" height="256" fill="url(#network-grid)" />
          {visibleEdges.map((edge) => {
            const a = nodes[edge.from];
            const b = nodes[edge.to];
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className={edge.type === "transfer" ? "network-edge--active" : "network-edge"}
                strokeDasharray={edge.type === "device" ? "4 4" : undefined}
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <circle
                r={node.type === "Device" ? 17 : 23}
                className={node.focus ? "network-node--focus" : "network-node"}
              />
              <text
                textAnchor="middle"
                y="3"
                className={
                  node.focus ? "fill-primary-foreground font-mono text-[8px]" : "network-label"
                }
              >
                {node.type === "Device" ? (
                  <Fingerprint size={13} x={-6.5} y={-6.5} />
                ) : (
                  node.id.slice(-4)
                )}
              </text>
              <text y={36} textAnchor="middle" className="network-label">
                {node.role}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-3 py-2 text-[9px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border-2 border-primary bg-primary" /> Selected
          account
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-3 bg-chart-2" /> Transfer
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 border-t border-dashed border-border" /> Shared device
        </span>
        <span className="ml-auto">Links are illustrative; not common-control evidence.</span>
      </div>
    </section>
  );
}

function ReviewNote({
  caseId,
  transaction,
  score,
}: {
  caseId: string;
  transaction: TransactionRecord;
  score: number;
}) {
  return (
    <section className="border border-border bg-card">
      <SectionHeading
        eyebrow="Case context"
        title="Analyst review note"
        trailing={
          <Badge variant="secondary" className="rounded-sm text-[9px]">
            Synthetic
          </Badge>
        }
      />
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-chart-2" />
          <p className="text-[10px] leading-relaxed">
            The selected sample transaction carries <strong>{score} illustrative points</strong>{" "}
            across amount, beneficiary, timing, velocity and relationship rules.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DetailLine label="Case" value={caseId} />
          <DetailLine label="Source" value="Synthetic sample" />
          <DetailLine label="Transaction" value={transaction.id} />
          <DetailLine label="Channel" value={transaction.channel} />
        </div>
        <p className="border-l-2 border-chart-2 pl-2 text-[9px] leading-relaxed text-muted-foreground">
          These demo rules are not a trained fraud model or a validated measure of risk. Verify
          primary records and current policy before drawing conclusions.
        </p>
      </div>
    </section>
  );
}

function DocumentPanel({
  image,
  onUpload,
  onClear,
}: {
  image: { name: string; url: string; size: string } | null;
  onUpload: () => void;
  onClear: () => void;
}) {
  const [differencePreview, setDifferencePreview] = useState<string | null>(null);
  const [differenceState, setDifferenceState] = useState<
    "idle" | "processing" | "ready" | "unavailable"
  >("idle");

  useEffect(() => {
    let cancelled = false;
    if (!image) {
      setDifferencePreview(null);
      setDifferenceState("idle");
      return;
    }

    setDifferencePreview(null);
    setDifferenceState("processing");
    const source = new Image();
    source.onload = () => {
      if (cancelled) return;
      try {
        const scale = Math.min(1, 1600 / source.naturalWidth, 1600 / source.naturalHeight);
        const width = Math.max(1, Math.round(source.naturalWidth * scale));
        const height = Math.max(1, Math.round(source.naturalHeight * scale));
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = width;
        sourceCanvas.height = height;
        const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
        if (!sourceContext) throw new Error("Canvas rendering is unavailable.");
        sourceContext.drawImage(source, 0, 0);
        const originalPixels = sourceContext.getImageData(0, 0, width, height);

        const recompressed = new Image();
        recompressed.onload = () => {
          if (cancelled) return;
          try {
            const recompressedCanvas = document.createElement("canvas");
            recompressedCanvas.width = width;
            recompressedCanvas.height = height;
            const recompressedContext = recompressedCanvas.getContext("2d", {
              willReadFrequently: true,
            });
            if (!recompressedContext) throw new Error("Canvas rendering is unavailable.");
            recompressedContext.drawImage(recompressed, 0, 0, width, height);
            const changedPixels = recompressedContext.getImageData(0, 0, width, height);
            const comparisonCanvas = document.createElement("canvas");
            comparisonCanvas.width = width;
            comparisonCanvas.height = height;
            const comparisonContext = comparisonCanvas.getContext("2d");
            if (!comparisonContext) throw new Error("Canvas rendering is unavailable.");
            const output = comparisonContext.createImageData(width, height);
            const gain = 8;
            for (let index = 0; index < output.data.length; index += 4) {
              const difference = Math.min(
                255,
                Math.max(
                  Math.abs((originalPixels.data[index] ?? 0) - (changedPixels.data[index] ?? 0)),
                  Math.abs(
                    (originalPixels.data[index + 1] ?? 0) - (changedPixels.data[index + 1] ?? 0),
                  ),
                  Math.abs(
                    (originalPixels.data[index + 2] ?? 0) - (changedPixels.data[index + 2] ?? 0),
                  ),
                ) * gain,
              );
              output.data[index] = difference;
              output.data[index + 1] = Math.round(difference * 0.78);
              output.data[index + 2] = Math.round(difference * 0.48);
              output.data[index + 3] = 255;
            }
            comparisonContext.putImageData(output, 0, 0);
            if (!cancelled) {
              setDifferencePreview(comparisonCanvas.toDataURL("image/png"));
              setDifferenceState("ready");
            }
          } catch {
            if (!cancelled) setDifferenceState("unavailable");
          }
        };
        recompressed.onerror = () => {
          if (!cancelled) setDifferenceState("unavailable");
        };
        recompressed.src = sourceCanvas.toDataURL("image/jpeg", 0.85);
      } catch {
        if (!cancelled) setDifferenceState("unavailable");
      }
    };
    source.onerror = () => {
      if (!cancelled) setDifferenceState("unavailable");
    };
    source.src = image.url;

    return () => {
      cancelled = true;
      source.onload = null;
      source.onerror = null;
    };
  }, [image]);

  return (
    <section className="border border-border bg-card">
      <SectionHeading
        eyebrow="Document review"
        title="Identity image evidence"
        trailing={
          <Badge variant="outline" className="rounded-sm text-[9px]">
            No trained CV model
          </Badge>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.55fr)]">
        <div className="flex min-h-[260px] items-center justify-center border-b border-border bg-secondary/20 p-4 lg:border-b-0 lg:border-r">
          {image ? (
            <div className="grid w-full grid-cols-1 gap-3 xl:grid-cols-2">
              <figure className="min-w-0">
                <figcaption className="mb-1.5 flex justify-between gap-2 text-[9px] font-semibold">
                  <span>Original image</span>
                  <span className="mono-data font-normal text-muted-foreground">{image.size}</span>
                </figcaption>
                <img
                  src={image.url}
                  alt={`Uploaded identity document preview: ${image.name}`}
                  className="max-h-[520px] w-full bg-card object-contain"
                />
                <p className="mt-1.5 truncate text-[9px] text-muted-foreground">{image.name}</p>
              </figure>
              <figure className="min-w-0">
                <figcaption className="mb-1.5 flex justify-between gap-2 text-[9px] font-semibold">
                  <span>JPEG difference preview</span>
                  <span className="mono-data font-normal text-muted-foreground">×8 contrast</span>
                </figcaption>
                {differencePreview ? (
                  <img
                    src={differencePreview}
                    alt="JPEG recompression difference image, contrast amplified eight times; not a trained forgery result"
                    className="max-h-[520px] w-full bg-card object-contain"
                  />
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center bg-secondary/60 px-3 text-center text-[10px] text-muted-foreground">
                    {differenceState === "processing"
                      ? "Preparing browser-only recompression comparison…"
                      : differenceState === "unavailable"
                        ? "This browser could not prepare the comparison image."
                        : "Select a dummy image to view a recompression difference."}
                  </div>
                )}
                <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                  {differenceState === "ready"
                    ? "Illustrative recompression differences; source format and export quality affect the pattern."
                    : "A recompression comparison is not proof of editing or authenticity."}
                </p>
              </figure>
            </div>
          ) : (
            <div className="max-w-sm text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <FileImage className="size-5" />
              </span>
              <p className="mt-3 text-xs font-bold">No document image uploaded</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Use dummy or synthetic images only. Do not upload real identity documents or
                personal information.
              </p>
              <Button className="mt-3 h-8 rounded-sm text-[10px]" onClick={onUpload}>
                <Upload className="size-3.5" /> Choose JPG / PNG
              </Button>
            </div>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div>
            <p className="text-[9px] font-bold uppercase text-muted-foreground">Analysis status</p>
            <div className="mt-2 flex items-start gap-2 rounded-sm border border-accent bg-accent/25 p-2.5">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-chart-2" />
              <p className="text-[10px] leading-relaxed">
                {image
                  ? "Image received. Forgery classification is unavailable because the ResNet18 model and ELA analysis module were not supplied."
                  : "Model weights, image-analysis modules and labeled validation images were not included in the project files."}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <StatusRow
              label="Image selected"
              value={image ? "Available in this session" : "Not provided"}
              ok={Boolean(image)}
            />
            <StatusRow
              label="JPEG comparison"
              value={
                differenceState === "ready"
                  ? "Browser demo only"
                  : differenceState === "processing"
                    ? "Preparing demo"
                    : "Not calculated"
              }
              ok={differenceState === "ready"}
            />
            <StatusRow label="ResNet18 score" value="Unavailable" ok={false} />
            <StatusRow label="Forgery conclusion" value="Not produced" ok={false} />
          </div>
          <p className="text-[9px] leading-relaxed text-muted-foreground">
            Image preview remains in this browser session; it is not uploaded to a server. An image
            appearance alone cannot establish document authenticity.
          </p>
          {image ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="h-8 rounded-sm text-[10px]"
            >
              <X className="size-3.5" /> Remove image
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-1.5 text-[10px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium">
        {ok ? (
          <Check className="size-3 text-primary" />
        ) : (
          <X className="size-3 text-muted-foreground" />
        )}
        {value}
      </span>
    </div>
  );
}

function ManualTransactionDialog({
  open,
  onOpenChange,
  caseId,
  existingTransactionIds,
  transactionNumber,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  existingTransactionIds: string[];
  transactionNumber: number;
  onAdd: (transaction: TransactionRecord) => void;
}) {
  const [transactionId, setTransactionId] = useState(
    `TXN-M${transactionNumber.toString().padStart(3, "0")}`,
  );
  const [from, setFrom] = useState("AC-7319");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("25000");
  const [hour, setHour] = useState("14");
  const [newBeneficiary, setNewBeneficiary] = useState("yes");
  const [velocity, setVelocity] = useState("2");
  const [sharedAccounts, setSharedAccounts] = useState("1");
  const [type, setType] = useState<TransactionRecord["type"]>("transfer");
  const [channel, setChannel] = useState("Mobile");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTransactionId(`TXN-M${transactionNumber.toString().padStart(3, "0")}`);
    setFrom("AC-7319");
    setTo("");
    setAmount("25000");
    setHour("14");
    setNewBeneficiary("yes");
    setVelocity("2");
    setSharedAccounts("1");
    setType("transfer");
    setChannel("Mobile");
    setError(null);
  }, [open, transactionNumber]);

  function addTransaction() {
    const numericAmount = Number(amount);
    const numericHour = Number(hour);
    const numericVelocity = Number(velocity);
    const numericSharedAccounts = Number(sharedAccounts);
    const validationError = validateManualTransactionFields(
      {
        transactionId,
        from,
        to,
        amount: numericAmount,
        hour: numericHour,
        velocity: numericVelocity,
        sharedAccounts: numericSharedAccounts,
        channel,
      },
      existingTransactionIds,
    );
    if (
      existingTransactionIds.some(
        (existingId) => existingId.toLowerCase() === transactionId.trim().toLowerCase(),
      )
    ) {
      setError("That transaction ID already exists in this case.");
      return;
    }
    if (validationError) {
      setError(validationError);
      return;
    }
    onAdd({
      id: transactionId.trim(),
      caseId,
      time: `${numericHour.toString().padStart(2, "0")}:00:00`,
      from: from.trim(),
      to: to.trim(),
      amount: numericAmount,
      hour: numericHour,
      newBeneficiary: newBeneficiary === "yes",
      velocity: numericVelocity,
      sharedAccounts: numericSharedAccounts,
      type,
      channel: channel.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[560px] overflow-y-auto rounded-sm p-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-left sm:px-5">
          <DialogTitle className="text-sm">Add a synthetic transaction</DialogTitle>
          <DialogDescription className="text-[10px] leading-relaxed">
            Create a local demonstration record for {caseId}. Do not enter live financial or
            personal information.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-id" className="text-[10px]">
              Transaction ID
            </Label>
            <Input
              id="manual-transaction-id"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-amount" className="text-[10px]">
              Amount (₹)
            </Label>
            <Input
              id="manual-transaction-amount"
              inputMode="decimal"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-from" className="text-[10px]">
              From account
            </Label>
            <Input
              id="manual-transaction-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-to" className="text-[10px]">
              To account
            </Label>
            <Input
              id="manual-transaction-to"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="AC-XXXX"
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-hour" className="text-[10px]">
              Hour (0–23)
            </Label>
            <Input
              id="manual-transaction-hour"
              inputMode="numeric"
              type="number"
              min="0"
              max="23"
              step="1"
              value={hour}
              onChange={(event) => setHour(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-velocity" className="text-[10px]">
              Events in review window
            </Label>
            <Input
              id="manual-transaction-velocity"
              inputMode="numeric"
              type="number"
              min="1"
              max="100"
              step="1"
              value={velocity}
              onChange={(event) => setVelocity(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-linked" className="text-[10px]">
              Linked sample accounts
            </Label>
            <Input
              id="manual-transaction-linked"
              inputMode="numeric"
              type="number"
              min="0"
              max="100"
              step="1"
              value={sharedAccounts}
              onChange={(event) => setSharedAccounts(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-channel" className="text-[10px]">
              Channel
            </Label>
            <Input
              id="manual-transaction-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="h-8 rounded-sm text-[11px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-type" className="text-[10px]">
              Transaction type
            </Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as TransactionRecord["type"])}
            >
              <SelectTrigger id="manual-transaction-type" className="h-8 rounded-sm text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="cash_out">Cash out</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-transaction-beneficiary" className="text-[10px]">
              Beneficiary status
            </Label>
            <Select value={newBeneficiary} onValueChange={setNewBeneficiary}>
              <SelectTrigger
                id="manual-transaction-beneficiary"
                className="h-8 rounded-sm text-[11px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">New beneficiary</SelectItem>
                <SelectItem value="no">Known beneficiary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? (
            <p role="alert" className="sm:col-span-2 text-[10px] font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-sm text-[10px]"
          >
            Cancel
          </Button>
          <Button onClick={addTransaction} className="h-8 rounded-sm text-[10px]">
            Add and score demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-border/70 pb-1.5">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mono-data mt-0.5 truncate text-[10px] font-medium">{value}</p>
    </div>
  );
}

function CopilotPanel({
  query,
  onQueryChange,
  sources,
  onPrepare,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sources: ReturnType<typeof rankKnowledgeSources>;
  onPrepare: () => void;
}) {
  return (
    <section className="border border-border bg-card">
      <SectionHeading
        eyebrow="Offline retrieval demo"
        title="Investigation copilot"
        trailing={
          <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-chart-2" /> Local snippets only
          </span>
        }
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.78fr)]">
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <label htmlFor="investigation-question" className="text-[10px] font-bold">
            Investigation question
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                id="investigation-question"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Ask about the case signals…"
                className="h-9 rounded-sm pl-8 text-[11px]"
              />
            </div>
            <Button onClick={onPrepare} className="h-9 shrink-0 rounded-sm px-3 text-[10px]">
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">Prepare report</span>
            </Button>
          </div>
          <div className="mt-4 border border-border bg-secondary/30 p-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="size-3.5 text-primary" />
              <p className="text-[10px] font-bold">Retrieved context</p>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              The local demo matches query terms to a small set of sample notes. It does not connect
              to an LLM or a complete regulatory document index.
            </p>
            <div className="mt-3 space-y-2">
              {sources.map((source, index) => (
                <div
                  key={source.id}
                  className="flex items-start gap-2 border-t border-border/70 pt-2"
                >
                  <span className="mono-data flex size-4 shrink-0 items-center justify-center rounded-sm bg-card text-[9px]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold">{source.title}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{source.citation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-[9px] font-bold uppercase text-muted-foreground">Reference excerpts</p>
          <div className="mt-2 space-y-2">
            {sources.map((source) => (
              <article key={source.id} className="border border-border p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <Badge
                    variant={source.kind === "Regulatory reference" ? "secondary" : "outline"}
                    className="rounded-sm text-[8px]"
                  >
                    {source.kind}
                  </Badge>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[9px] font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Official source <ArrowUpRight className="size-3" />
                    </a>
                  ) : null}
                </div>
                <h3 className="mt-1.5 text-[10px] font-bold">{source.title}</h3>
                <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                  {source.note}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
            Official source links open separately. Verify current consolidated regulations; snippets
            in this prototype are not legal guidance.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReportPanel({
  report,
  generated,
  onGenerate,
  onCopy,
  onDownload,
  copied,
}: {
  report: string;
  generated: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
}) {
  return (
    <section className="border border-border bg-card">
      <SectionHeading
        eyebrow="Advisory output"
        title="Investigation report"
        trailing={
          generated ? (
            <Badge
              variant="outline"
              className="rounded-sm border-chart-2/30 bg-chart-2/10 text-[9px]"
            >
              Synthetic draft
            </Badge>
          ) : (
            <Badge variant="secondary" className="rounded-sm text-[9px]">
              Not prepared
            </Badge>
          )
        }
      />
      {generated ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/30 px-4 py-2.5">
            <span className="mono-data text-[9px] text-muted-foreground">
              {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onCopy}
                title="Copy report"
                aria-label="Copy report"
                className="size-8 rounded-sm"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onDownload}
                title="Download report"
                aria-label="Download report"
                className="size-8 rounded-sm"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap break-words px-4 py-4 font-sans text-[11px] leading-relaxed">
            {report}
          </pre>
          <div className="flex items-start gap-2 border-t border-border bg-accent/20 px-4 py-3 text-[10px] leading-relaxed">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p>
              Prototype output only. The sample rules and reference notes are not verified findings;
              do not use them to freeze accounts or take enforcement action.
            </p>
          </div>
        </>
      ) : (
        <div className="flex min-h-[220px] flex-col items-center justify-center px-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <FileSearch className="size-5" />
          </span>
          <p className="mt-3 text-xs font-bold">No report prepared for this case</p>
          <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
            The offline demo will combine the selected synthetic transaction with ranked sample
            references.
          </p>
          <Button onClick={onGenerate} className="mt-3 h-8 rounded-sm text-[10px]">
            <Sparkles className="size-3.5" /> Prepare illustrative report
          </Button>
        </div>
      )}
    </section>
  );
}
