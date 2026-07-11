import type { InspectionReport } from '../../src/types';

/** R2 stores exactly two kinds of object, both immutable once written —
 * see docs/API.md "Store the raw payload immutably." Never store personal
 * documents, scanned files, or anything beyond what InspectionReport /
 * AIReportSnapshot already carry. */
export function reportKey(userId: string, reportId: string): string {
  return `reports/${userId}/${reportId}.json`;
}

export function analysisKey(userId: string, reportId: string): string {
  return `reports/${userId}/${reportId}.analysis.json`;
}

export async function putReport(bucket: R2Bucket, userId: string, reportId: string, report: InspectionReport): Promise<string> {
  const key = reportKey(userId, reportId);
  await bucket.put(key, JSON.stringify(report), { httpMetadata: { contentType: 'application/json' } });
  return key;
}

export async function getReportJSON<T>(bucket: R2Bucket, key: string): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return object.json<T>();
}

export async function putAnalysis(bucket: R2Bucket, userId: string, reportId: string, analysis: unknown): Promise<string> {
  const key = analysisKey(userId, reportId);
  await bucket.put(key, JSON.stringify(analysis), { httpMetadata: { contentType: 'application/json' } });
  return key;
}
