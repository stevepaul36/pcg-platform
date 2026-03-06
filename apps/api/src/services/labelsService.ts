// Label management — GCP-style key:value labels for all resources
// Labels stored as JSON on each resource model that has a "labels" field

export class LabelsService {
  static validateLabels(labels: Record<string, string>): Record<string, string> {
    const MAX_LABELS = 64;
    const MAX_KEY_LEN = 63;
    const MAX_VAL_LEN = 63;
    const KEY_REGEX = /^[a-z][a-z0-9_-]*$/;

    const entries = Object.entries(labels);
    if (entries.length > MAX_LABELS) {
      throw new Error(`Max ${MAX_LABELS} labels allowed`);
    }
    const validated: Record<string, string> = {};
    for (const [key, value] of entries) {
      if (key.length > MAX_KEY_LEN) throw new Error(`Label key "${key}" exceeds ${MAX_KEY_LEN} chars`);
      if (value.length > MAX_VAL_LEN) throw new Error(`Label value for "${key}" exceeds ${MAX_VAL_LEN} chars`);
      if (!KEY_REGEX.test(key)) throw new Error(`Label key "${key}" must be lowercase alphanumeric with _ or -`);
      validated[key] = value;
    }
    return validated;
  }

  static filterByLabels<T extends { labels?: any }>(items: T[], labelFilter: Record<string, string>): T[] {
    return items.filter(item => {
      const labels = (item.labels as Record<string, string>) || {};
      return Object.entries(labelFilter).every(([k, v]) => labels[k] === v);
    });
  }

  static mergeLabels(existing: Record<string, string>, updates: Record<string, string>): Record<string, string> {
    return { ...existing, ...this.validateLabels(updates) };
  }
}
