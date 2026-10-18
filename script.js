
/*
 * CloudRestore - AWS Backup Monitoring Dashboard
 *
 * Configure API_URL after the API Gateway endpoint is created.
 * This dashboard does not create, delete, or restore AWS resources.
 */

const API_URL = "";
const FRESHNESS_DAYS = 7;

const $ = (id) => document.getElementById(id);

let latestReport = null;
let lastSuccessfulRefresh = null;

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString();
}

function getAge(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const milliseconds = Date.now() - date.getTime();

  if (milliseconds < 0) return "Clock/date check needed";

  const hours = Math.floor(milliseconds / (1000 * 60 * 60));

  if (hours < 24) return `${hours} hour(s)`;

  const days = Math.floor(hours / 24);
  return `${days} day(s)`;
}

function isFresh(value) {
  if (!value) return false;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;

  const age = Date.now() - timestamp;

  return age >= 0 &&
    age <= FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function setConnection(connected, detail) {
  const dot = $("connectionDot");

  if (dot) {
    dot.classList.toggle("disconnected", !connected);
  }

  setText("connectionLabel", connected ? "AWS connected" : "Not connected");
  setText("connectionDetail", detail);
}

function showNotConnected(message) {
  setConnection(false, "AWS API not configured");

  setText("connectionNotice", message);
  setText("ebsOverviewStatus", "Not connected");
  setText("ebsOverviewTime", "No live data received");
  setText("rdsOverviewStatus", "Not connected");
  setText("rdsOverviewTime", "No live data received");
  setText("healthStatus", "Unknown");
  setText("healthDetail", "Waiting for AWS data");

  setText("ebsSnapshotId", "Not available");
  setText("ebsState", "Not connected");
  setText("ebsCreated", "—");
  setText("ebsAge", "—");

  setText("rdsSnapshotId", "Not available");
  setText("rdsState", "Not connected");
  setText("rdsCreated", "—");
  setText("rdsAge", "—");

  setText("lastCheck", "Unknown");
  setText("nextCheck", "Not supplied by API");
  setText("reportResult", "No live report");
  setText("reportMessage", message);

  $("downloadBtn").disabled = true;
}

function displaySnapshot(prefix, snapshot, type) {
  const overviewStatusId =
    type === "ebs" ? "ebsOverviewStatus" : "rdsOverviewStatus";

  const overviewTimeId =
    type === "ebs" ? "ebsOverviewTime" : "rdsOverviewTime";

  const snapshotId = snapshot?.snapshot_id ?? null;
  const status = snapshot?.status ?? snapshot?.state ?? null;
  const createdAt =
    snapshot?.created_at ??
    snapshot?.start_time ??
    snapshot?.create_time ??
    null;

  if (!snapshot || !snapshotId || !status || !createdAt) {
    setText(overviewStatusId, "No usable data");
    setText(overviewTimeId, "Snapshot details missing from API");

    setText(`${prefix}SnapshotId`, snapshotId ?? "No snapshot reported");
    setText(`${prefix}State`, status ?? "Unknown");
    setText(`${prefix}Created`, formatDate(createdAt));
    setText(`${prefix}Age`, getAge(createdAt) ?? "—");

    return {
      exists: false,
      available: false,
      fresh: false
    };
  }

  const age = getAge(createdAt);
  const fresh = isFresh(createdAt);
  const completed =
    type === "ebs"
      ? status.toLowerCase() === "completed"
      : status.toLowerCase() === "available";

  setText(overviewStatusId, status);
  setText(overviewTimeId, `Created ${age ?? "an unknown time ago"}`);

  setText(`${prefix}SnapshotId`, snapshotId);
  setText(`${prefix}State`, status);
  setText(`${prefix}Created`, formatDate(createdAt));
  setText(`${prefix}Age`, age ?? "Unknown");

  return {
    exists: true,
    available: completed,
    fresh
  };
}

function renderReport(data) {
  const ebs = displaySnapshot("ebs", data.ebs_snapshot, "ebs");
  const rds = displaySnapshot("rds", data.rds_snapshot, "rds");

  const allHealthy =
    ebs.exists && ebs.available && ebs.fresh &&
    rds.exists && rds.available && rds.fresh;

  const hasIssues =
    !ebs.exists || !ebs.available || !ebs.fresh ||
    !rds.exists || !rds.available || !rds.fresh;

  setText(
    "healthStatus",
    allHealthy ? "Healthy" : hasIssues ? "Attention needed" : "Unknown"
  );

  setText(
    "healthDetail",
    allHealthy
      ? "Both snapshots are recent and in the expected state"
      : "One or more snapshots are missing, stale, or not ready"
  );

  setText(
    "lastCheck",
    formatDate(data.checked_at)
  );

  setText(
    "nextCheck",
    formatDate(data.next_check_at)
  );

  setText(
    "lastRefresh",
    formatDate(lastSuccessfulRefresh)
  );

  setText(
    "reportResult",
    allHealthy ? "Checks passed" : "Review required"
  );

  setText(
    "reportMessage",
    data.message ??
      "Snapshot information retrieved successfully. Review each resource's status and age."
  );

  setConnection(true, "API response received");

  latestReport = {
    project: "CloudRestore",
    report_type: "AWS snapshot monitoring",
    retrieved_at: lastSuccessfulRefresh,
    monitoring_checked_at: data.checked_at ?? null,
    next_scheduled_check: data.next_check_at ?? null,
    freshness_rule_days: FRESHNESS_DAYS,
    ebs_snapshot: data.ebs_snapshot ?? null,
    rds_snapshot: data.rds_snapshot ?? null,
    note: "This report contains the API response received by the dashboard."
  };

  $("downloadBtn").disabled = false;
}

async function refreshStatus() {
  const button = $("refreshBtn");

  if (!API_URL) {
    showNotConnected(
      "Setup required: the API Gateway URL has not been configured. No live AWS data is being displayed."
    );
    return;
  }

  button.disabled = true;
  button.textContent = "Refreshing…";

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data !== "object") {
      throw new Error("The API response was not valid JSON data.");
    }

    lastSuccessfulRefresh = new Date().toISOString();
    renderReport(data);
  } catch (error) {
    setConnection(false, "Unable to retrieve AWS data");
    setText("reportResult", "Refresh failed");
    setText("reportMessage", error.message);
    setText("connectionNotice",
      `Could not retrieve live AWS data: ${error.message}. Check the API URL, API permissions, and CORS configuration.`
    );
    $("downloadBtn").disabled = !latestReport;
  } finally {
    button.disabled = false;
    button.textContent = "↻ Refresh status";
  }
}

function downloadReport() {
  if (!latestReport) return;

  const blob = new Blob(
    [JSON.stringify(latestReport, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cloudrestore-aws-monitoring-report.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("refreshBtn").addEventListener("click", refreshStatus);
$("downloadBtn").addEventListener("click", downloadReport);

// Start in a truthful, disconnected state.
showNotConnected(
  "Setup required: configure API Gateway and Lambda before retrieving live AWS snapshot information."
);
