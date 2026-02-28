import { Form, useSearchParams } from "@remix-run/react";
import type { AlertRuleType, IncidentSeverity } from "@prisma/client";

type AlertFiltersProps = {
  monitors?: Array<{ id: string; name: string }>;
  showSearch?: boolean;
};

export function AlertFilters({ monitors = [], showSearch = true }: AlertFiltersProps) {
  const [searchParams] = useSearchParams();

  const currentRuleType = searchParams.get("ruleType") || "";
  const currentSeverity = searchParams.get("severity") || "";
  const currentEnabled = searchParams.get("enabled") || "";
  const currentMonitorId = searchParams.get("monitorId") || "";
  const currentSearch = searchParams.get("search") || "";

  const hasActiveFilters =
    currentRuleType || currentSeverity || currentEnabled || currentMonitorId || currentSearch;

  return (
    <div className="rounded border bg-white p-4">
      <Form method="get" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Search */}
        {showSearch && (
          <div>
            <label htmlFor="search" className="mb-1 block text-sm font-medium">
              Search monitors
            </label>
            <input
              id="search"
              name="search"
              type="text"
              defaultValue={currentSearch}
              placeholder="Search by monitor name..."
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        )}

        {/* Rule type filter */}
        <div>
          <label htmlFor="ruleType" className="mb-1 block text-sm font-medium">
            Rule type
          </label>
          <select
            id="ruleType"
            name="ruleType"
            defaultValue={currentRuleType}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="DOWN">Down</option>
            <option value="LATENCY">Latency</option>
            <option value="TLS_EXPIRY">TLS Expiry</option>
            <option value="BODY_MISMATCH">Body Mismatch</option>
          </select>
        </div>

        {/* Severity filter */}
        <div>
          <label htmlFor="severity" className="mb-1 block text-sm font-medium">
            Severity
          </label>
          <select
            id="severity"
            name="severity"
            defaultValue={currentSeverity}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="WARNING">Warning</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label htmlFor="enabled" className="mb-1 block text-sm font-medium">
            Status
          </label>
          <select
            id="enabled"
            name="enabled"
            defaultValue={currentEnabled}
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>

        {/* Monitor filter (if monitors provided) */}
        {monitors.length > 0 && (
          <div>
            <label htmlFor="monitorId" className="mb-1 block text-sm font-medium">
              Monitor
            </label>
            <select
              id="monitorId"
              name="monitorId"
              defaultValue={currentMonitorId}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">All monitors</option>
              {monitors.map((monitor) => (
                <option key={monitor.id} value={monitor.id}>
                  {monitor.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            Apply filters
          </button>
          {hasActiveFilters && (
            <a
              href="?"
              className="rounded border px-4 py-2 text-sm hover:bg-slate-50"
            >
              Clear
            </a>
          )}
        </div>
      </Form>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <span className="text-sm text-slate-600">Active filters:</span>
          {currentSearch && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
              Search: {currentSearch}
            </span>
          )}
          {currentRuleType && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
              Type: {currentRuleType}
            </span>
          )}
          {currentSeverity && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
              Severity: {currentSeverity}
            </span>
          )}
          {currentEnabled && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
              Status: {currentEnabled === "true" ? "Enabled" : "Disabled"}
            </span>
          )}
          {currentMonitorId && (
            <span className="rounded bg-slate-100 px-2 py-1 text-xs">
              Monitor: {monitors.find((m) => m.id === currentMonitorId)?.name || "Selected"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
