export function flattenMetadata(obj, prefix = "") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (value === null || value === undefined) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            result[newKey] = value;
        } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
            result[newKey] = value;
        } else if (typeof value === "object") {
            Object.assign(result, flattenMetadata(value, newKey));
        }
    }
    return result;
}