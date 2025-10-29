import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

// Types for enhanced audit logs
export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null | Json;
  new_values: Record<string, unknown> | null | Json;
  user_id: string | null;
  ip_address: unknown;
  user_agent: string | null;
  created_at: string | null;
}

export interface AuditLogWithChanges extends AuditLogEntry, Record<string, unknown> {
  changed_fields?: Record<string, { old_value: unknown; new_value: unknown }>;
  // Additional fields expected by the component
  admin_name?: string;
  admin_email?: string;
  entity_type?: string;
  entity_id?: string;
  data_before?: Record<string, unknown>;
  data_after?: Record<string, unknown>;
  tags?: string[];
  status_code?: number;
  description?: string;
  action_type?: string; // Alias for action
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  actionTypes?: string[];
  resourceTypes?: string[];
  entityTypes?: string[]; // Alias for resourceTypes
  userIds?: string[];
  adminIds?: string[]; // Alias for userIds
  ipAddress?: string;
  hasErrors?: boolean;
  searchText?: string;
}

export interface AuditLogStatistics {
  total_logs: number;
  actions_by_type: Record<string, number>;
  resources_by_type: Record<string, number>;
  top_users: Array<{ name: string; email: string; count: number }>;
  top_admins?: Array<{ name: string; email: string; count: number }>; // Alias for top_users
  actions_per_day: Record<string, number>;
  error_rate: number;
  avg_duration_ms: number;
}

export interface EntityChangeHistory {
  log_id: string;
  action: string;
  action_type?: string; // Alias for action
  user_name: string;
  user_email: string;
  admin_name?: string; // Alias for user_name
  admin_email?: string; // Alias for user_email
  changed_fields: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
  ip_address: unknown;
}

export interface FieldComparison {
  field_name: string;
  value_in_log_1: unknown;
  value_in_log_2: unknown;
  values_differ: boolean;
}

/**
 * Create an enhanced audit log entry with before/after tracking
 */
export async function createAuditLog(params: {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId || null,
        old_values: params.oldValues || null,
        new_values: params.newValues || null,
        user_id: params.userId || null,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, logId: data.id };
  } catch (error) {
    console.error("Error creating audit log:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get audit logs with advanced filtering
 */
export async function getAuditLogs(
  filters: AuditLogFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<{ logs: AuditLogWithChanges[]; total: number; error?: string }> {
  try {
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" });

    // Apply filters (support both resourceTypes and entityTypes)
    if (filters.actionTypes && filters.actionTypes.length > 0) {
      query = query.in("action", filters.actionTypes);
    }
    if ((filters.resourceTypes && filters.resourceTypes.length > 0) || (filters.entityTypes && filters.entityTypes.length > 0)) {
      const types = filters.resourceTypes || filters.entityTypes || [];
      query = query.in("resource_type", types);
    }
    if ((filters.userIds && filters.userIds.length > 0) || (filters.adminIds && filters.adminIds.length > 0)) {
      const ids = filters.userIds || filters.adminIds || [];
      query = query.in("user_id", ids);
    }
    if (filters.ipAddress) {
      query = query.eq("ip_address", filters.ipAddress);
    }
    if (filters.searchText) {
      query = query.or(
        `action.ilike.%${filters.searchText}%,resource_type.ilike.%${filters.searchText}%`
      );
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // Map data to include additional fields expected by the component
    const mappedLogs: AuditLogWithChanges[] = (data || []).map((log) => {
      const diff = calculateDiff(log.old_values, log.new_values);
      const changedFields: Record<string, { old_value: unknown; new_value: unknown }> = {};
      
      Object.entries(diff).forEach(([key, value]) => {
        changedFields[key] = { old_value: value.old, new_value: value.new };
      });

      return {
        ...log,
        entity_type: log.resource_type,
        entity_id: log.resource_id,
        data_before: log.old_values as Record<string, unknown> | null,
        data_after: log.new_values as Record<string, unknown> | null,
        changed_fields: changedFields,
        description: `${log.action} on ${log.resource_type}${log.resource_id ? ` (${log.resource_id})` : ''}`,
        admin_name: "Unknown", // Would need user join to get actual name
        admin_email: "unknown@example.com", // Would need user join to get actual email
        tags: [], // Not available in current schema
        status_code: undefined, // Not available in current schema
        action_type: log.action, // Alias for action
      };
    });

    return {
      logs: mappedLogs,
      total: count || 0,
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return {
      logs: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get audit log statistics for a date range
 */
export async function getAuditLogStatistics(
  startDate?: string,
  endDate?: string
): Promise<AuditLogStatistics | null> {
  try {
    // Simple implementation using basic aggregation
    let query = supabase
      .from("audit_logs")
      .select("action, resource_type, created_at");

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate basic statistics
    const actionsByType: Record<string, number> = {};
    const resourcesByType: Record<string, number> = {};
    const actionsPerDay: Record<string, number> = {};

    data?.forEach((log) => {
      // Count actions by type
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;

      // Count resources by type
      resourcesByType[log.resource_type] = (resourcesByType[log.resource_type] || 0) + 1;

      // Count actions per day
      const date = log.created_at ? new Date(log.created_at).toISOString().split('T')[0] : 'unknown';
      actionsPerDay[date] = (actionsPerDay[date] || 0) + 1;
    });

    return {
      total_logs: data?.length || 0,
      actions_by_type: actionsByType,
      resources_by_type: resourcesByType,
      top_users: [], // Would need user join to implement
      top_admins: [], // Alias for top_users
      actions_per_day: actionsPerDay,
      error_rate: 0, // Would need error detection logic
      avg_duration_ms: 0, // Not available in current schema
    };
  } catch (error) {
    console.error("Error fetching audit log statistics:", error);
    return null;
  }
}

/**
 * Get change history for a specific entity
 */
export async function getEntityChangeHistory(
  entityType: string,
  entityId: string,
  limit: number = 50
): Promise<EntityChangeHistory[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        user_id,
        created_at,
        ip_address,
        old_values,
        new_values
      `)
      .eq("resource_type", entityType)
      .eq("resource_id", entityId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Transform data to match EntityChangeHistory interface
    const history: EntityChangeHistory[] = (data || []).map((log) => ({
      log_id: log.id,
      action: log.action,
      action_type: log.action, // Alias for action
      user_name: "Unknown", // Would need user join
      user_email: "unknown@example.com", // Would need user join
      admin_name: "Unknown", // Alias for user_name
      admin_email: "unknown@example.com", // Alias for user_email
      changed_fields: calculateDiff(log.old_values, log.new_values),
      created_at: log.created_at || "",
      ip_address: log.ip_address,
    }));

    return history;
  } catch (error) {
    console.error("Error fetching entity change history:", error);
    return [];
  }
}

/**
 * Compare two log entries field by field
 */
export async function compareLogEntries(
  logId1: string,
  logId2: string
): Promise<FieldComparison[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("old_values, new_values")
      .in("id", [logId1, logId2]);

    if (error) throw error;

    if (!data || data.length !== 2) {
      return [];
    }

    const log1 = data[0];
    const log2 = data[1];

    const diff1 = calculateDiff(log1.old_values, log1.new_values);
    const diff2 = calculateDiff(log2.old_values, log2.new_values);

    const allFields = new Set([...Object.keys(diff1), ...Object.keys(diff2)]);

    const comparisons: FieldComparison[] = Array.from(allFields).map((field) => ({
      field_name: field,
      value_in_log_1: diff1[field]?.new || diff1[field]?.old,
      value_in_log_2: diff2[field]?.new || diff2[field]?.old,
      values_differ: JSON.stringify(diff1[field]?.new || diff1[field]?.old) !==
                    JSON.stringify(diff2[field]?.new || diff2[field]?.old),
    }));

    return comparisons;
  } catch (error) {
    console.error("Error comparing log entries:", error);
    return [];
  }
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogsCSV(
  filters: {
    startDate?: string;
    endDate?: string;
    actionTypes?: string[];
    resourceTypes?: string[];
  } = {}
): Promise<{ success: boolean; csv?: string; error?: string }> {
  try {
    const { logs, error } = await getAuditLogs(filters, 1, 10000); // Large limit for export

    if (error) {
      return { success: false, error };
    }

    if (logs.length === 0) {
      return { success: true, csv: "No data found" };
    }

    // Create CSV headers
    const headers = [
      "ID",
      "Action",
      "Resource Type",
      "Resource ID",
      "User ID",
      "IP Address",
      "User Agent",
      "Created At"
    ];

    // Create CSV rows
    const rows = logs.map((log) => [
      log.id,
      log.action,
      log.resource_type,
      log.resource_id || "",
      log.user_id || "",
      String(log.ip_address || ""),
      log.user_agent || "",
      log.created_at || ""
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    return { success: true, csv: csvContent };
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Export audit logs to JSON format
 */
export async function exportAuditLogsJSON(
  filters: AuditLogFilters = {}
): Promise<{ success: boolean; json?: string; error?: string }> {
  try {
    const { logs, error } = await getAuditLogs(filters, 1, 10000); // Large limit for export

    if (error) {
      return { success: false, error };
    }

    const json = JSON.stringify(logs, null, 2);

    return { success: true, json };
  } catch (error) {
    console.error("Error exporting audit logs to JSON:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Get unique action types from logs (for filter dropdowns)
 */
export async function getAvailableActionTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("action")
      .not("action", "is", null);

    if (error) throw error;

    const uniqueTypes = [...new Set(data.map((log) => log.action))];
    return uniqueTypes.sort();
  } catch (error) {
    console.error("Error fetching action types:", error);
    return [];
  }
}

/**
 * Get unique entity types from logs (for filter dropdowns)
 */
export async function getAvailableEntityTypes(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("resource_type")
      .not("resource_type", "is", null);

    if (error) throw error;

    const uniqueTypes = [...new Set(data.map((log) => log.resource_type))];
    return uniqueTypes.sort();
  } catch (error) {
    console.error("Error fetching entity types:", error);
    return [];
  }
}

/**
 * Get all admins who have created logs (for filter dropdowns)
 */
export async function getAvailableAdmins(): Promise<
  Array<{ id: string; name: string; email: string }>
> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        `
        user_id,
        profiles!inner(id, name, email)
      `
      )
      .not("user_id", "is", null);

    if (error) throw error;

    const uniqueAdmins = Array.from(
      new Map(
        data.map((log: { user_id: string; profiles: { id: string; name: string | null; email: string } }) => [
          log.user_id,
          {
            id: log.user_id,
            name: log.profiles.name || "Unknown",
            email: log.profiles.email,
          },
        ])
      ).values()
    );

    return uniqueAdmins.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching admins:", error);
    return [];
  }
}

/**
 * Calculate diff between two objects for visual display
 */
export function calculateDiff(
  before: Record<string, unknown> | null | undefined | Json,
  after: Record<string, unknown> | null | undefined | Json
): Record<string, { old: unknown; new: unknown; changed: boolean }> {
  const diff: Record<string, { old: unknown; new: unknown; changed: boolean }> = {};

  // Handle null/undefined values
  if (!before && !after) return diff;

  const beforeObj = before && typeof before === 'object' && !Array.isArray(before) ? before : {};
  const afterObj = after && typeof after === 'object' && !Array.isArray(after) ? after : {};

  const allKeys = new Set([
    ...Object.keys(beforeObj),
    ...Object.keys(afterObj),
  ]);

  allKeys.forEach((key) => {
    const oldValue = beforeObj[key];
    const newValue = afterObj[key];
    const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);

    diff[key] = { old: oldValue, new: newValue, changed };
  });

  return diff;
}

/**
 * Format log value for display (handle different types)
 */
export function formatLogValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "string" && value.length > 100) {
    return value.substring(0, 100) + "...";
  }
  return String(value);
}
