
const originalRecords = [
  { id: "CR-101", name: "John Davis" },
  { id: "CR-102", name: "Anna Miller" },
  { id: "CR-103", name: "Ryan Kumar" }
];

let records = structuredClone(originalRecords);
let savedBackup = null;
let lastOperation = "None";
let lastResult = "Pending";
let recoveryDuration = null;
let failureActive = false;

const $ = id => document.getElementById(id);

function updateReport(operation, result, message) {
  lastOperation = operation;
  lastResult = result;

  $("reportOperation").textContent = operation;
  $("reportResult").textContent = result;
  $("reportMessage").textContent = message;
  $("reportDuration").textContent =
    recoveryDuration === null ? "—" : `${recoveryDuration} ms`;

  $("downloadBtn").disabled = false;
}

function createBackup() {
  savedBackup = {
    records: structuredClone(records),
    createdAt: new Date().toISOString()
  };

  $("backupStatus").textContent = "Created";
  $("backupTime").textContent =
    new Date(savedBackup.createdAt).toLocaleString();

  $("restoreBtn").disabled = false;
  $("recoveryHint").textContent = "Demo backup is ready.";

  updateReport(
    "Demo backup",
    "Success",
    "A local copy of the sample data was created."
  );
}

function simulateFailure() {
  if (failureActive) {
    alert("A demo failure is already active.");
    return;
  }

  records = [];
  failureActive = true;

  $("appStatus").textContent = "Data unavailable";
  $("recoveryStatus").textContent = "Failure simulated";
  $("recoveryTime").textContent = "Recovery required";
  $("recoveryHint").textContent =
    "Sample data is unavailable. Restore the saved demo backup.";

  updateReport(
    "Simulated failure",
    "Failure simulated",
    "The sample records were removed from the local demo."
  );
}

function restoreBackup() {
  if (!savedBackup) {
    alert("Create a demo backup first.");
    return;
  }

  const startedAt = performance.now();

  records = structuredClone(savedBackup.records);
  failureActive = false;

  recoveryDuration = Math.round(performance.now() - startedAt);

  $("appStatus").textContent = "Operational";
  $("recoveryStatus").textContent = "Successful";
  $("recoveryTime").textContent = "Demo recovery completed";
  $("recoveryHint").textContent =
    `${records.length} sample records restored successfully.`;

  updateReport(
    "Demo recovery",
    "Success",
    `Recovered ${records.length} sample records from the local demo backup.`
  );
}

function downloadReport() {
  const report = {
    project: "CloudRestore",
    mode: "Local simulation only",
    operation: lastOperation,
    result: lastResult,
    recoveryTimeMs: recoveryDuration,
    backupCreatedAt: savedBackup?.createdAt ?? null,
    recordCount: records.length,
    generatedAt: new Date().toISOString(),
    note: "This report does not represent an actual AWS operation."
  };

  const blob = new Blob(
    [JSON.stringify(report, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cloudrestore-demo-report.json";
  link.click();

  URL.revokeObjectURL(url);
}

$("backupBtn").addEventListener("click", createBackup);
$("failureBtn").addEventListener("click", simulateFailure);
$("restoreBtn").addEventListener("click", restoreBackup);
$("downloadBtn").addEventListener("click", downloadReport);
