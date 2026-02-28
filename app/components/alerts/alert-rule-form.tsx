import { Form } from "@remix-run/react";
import type { AlertRuleType, IncidentSeverity } from "@prisma/client";
import { useState } from "react";

type Monitor = { id: string; name: string };
type Channel = { id: string; name: string; type: string };

type AlertRuleFormProps = {
  monitors: Monitor[];
  channels: Channel[];
  defaultValues?: {
    monitorId?: string;
    ruleType?: AlertRuleType;
    severity?: IncidentSeverity;
    thresholdInt?: number | null;
    thresholdText?: string | null;
    channelIds?: string[];
  };
  submitLabel?: string;
  error?: string;
  isEdit?: boolean;
};

export function AlertRuleForm({
  monitors,
  channels,
  defaultValues,
  submitLabel = "Create alert rule",
  error,
  isEdit = false,
}: AlertRuleFormProps) {
  const [ruleType, setRuleType] = useState<AlertRuleType>(defaultValues?.ruleType ?? "DOWN");
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    new Set(defaultValues?.channelIds ?? [])
  );

  const handleChannelToggle = (channelId: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channelId)) {
      newSelected.delete(channelId);
    } else {
      newSelected.add(channelId);
    }
    setSelectedChannels(newSelected);
  };

  return (
    <Form method="post" className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="intent" value={isEdit ? "update" : "create"} />

      <label className="block md:col-span-2">
        <span className="mb-1 block text-sm font-medium">Monitor</span>
        <select
          name="monitorId"
          required
          defaultValue={defaultValues?.monitorId}
          disabled={isEdit}
          className="w-full rounded border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="">Select a monitor...</option>
          {monitors.map((monitor) => (
            <option key={monitor.id} value={monitor.id}>
              {monitor.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Rule type</span>
        <select
          name="ruleType"
          required
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
          className="w-full rounded border px-3 py-2"
        >
          <option value="DOWN">Down (Monitor fails)</option>
          <option value="LATENCY">Latency (Response time too high)</option>
          <option value="TLS_EXPIRY">TLS Expiry (Certificate expiring soon)</option>
          <option value="BODY_MISMATCH">Body Mismatch (Response content unexpected)</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Severity</span>
        <select
          name="severity"
          required
          defaultValue={defaultValues?.severity ?? "CRITICAL"}
          className="w-full rounded border px-3 py-2"
        >
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
        </select>
      </label>

      {/* Dynamic threshold fields based on rule type */}
      {ruleType === "DOWN" && (
        <div className="md:col-span-2 rounded bg-slate-50 p-3 text-sm text-slate-600">
          DOWN rules trigger when consecutive probe failures reach the monitor's threshold. No additional
          configuration needed.
        </div>
      )}

      {ruleType === "LATENCY" && (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Latency threshold (milliseconds)</span>
          <input
            name="thresholdInt"
            type="number"
            required
            min={1}
            defaultValue={defaultValues?.thresholdInt ?? 1000}
            className="w-full rounded border px-3 py-2"
            placeholder="1000"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Alert when response time exceeds this value (e.g., 1000 = 1 second)
          </span>
        </label>
      )}

      {ruleType === "TLS_EXPIRY" && (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Days until expiry threshold</span>
          <input
            name="thresholdInt"
            type="number"
            required
            min={1}
            defaultValue={defaultValues?.thresholdInt ?? 30}
            className="w-full rounded border px-3 py-2"
            placeholder="30"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Alert when TLS certificate expires in fewer than this many days (e.g., 30 days)
          </span>
        </label>
      )}

      {ruleType === "BODY_MISMATCH" && (
        <label className="block md:col-span-2">
          <span className="mb-1 block text-sm font-medium">Expected body pattern</span>
          <input
            name="thresholdText"
            type="text"
            required
            defaultValue={defaultValues?.thresholdText ?? ""}
            className="w-full rounded border px-3 py-2"
            placeholder="ok|success|healthy"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Alert when response body does NOT match this pattern (supports regex, e.g., "ok|success")
          </span>
        </label>
      )}

      {/* Channel subscriptions */}
      <div className="md:col-span-2">
        <span className="mb-2 block text-sm font-medium">Notification channels</span>
        {channels.length === 0 ? (
          <p className="rounded border bg-slate-50 p-3 text-sm text-slate-600">
            No channels available. Create notification channels first to receive alerts.
          </p>
        ) : (
          <div className="grid gap-2 rounded border p-3 md:grid-cols-2">
            {channels.map((channel) => (
              <label key={channel.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="channelIds"
                  value={channel.id}
                  checked={selectedChannels.has(channel.id)}
                  onChange={() => handleChannelToggle(channel.id)}
                  className="rounded"
                />
                <span>
                  {channel.name} <span className="text-slate-500">({channel.type})</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Select which channels should receive notifications when this alert fires
        </p>
      </div>

      {error && (
        <div className="md:col-span-2 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex gap-3 md:col-span-2">
        <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-white">
          {submitLabel}
        </button>
        <a href="/app/alerts" className="rounded border px-4 py-2 text-sm">
          Cancel
        </a>
      </div>
    </Form>
  );
}
