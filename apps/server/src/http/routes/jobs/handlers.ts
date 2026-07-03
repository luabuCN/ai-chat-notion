import type { Context } from "hono";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import { getJobStatus } from "../../../jobs/status.js";

export async function getJobStatusHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const jobId = c.req.param("jobId");
  if (!jobId) {
    return new ApiError("bad_request:api", "Missing jobId").toResponse();
  }

  const record = await getJobStatus(jobId);
  if (!record) {
    return new ApiError("not_found:api", "Job not found").toResponse();
  }

  if (record.userId !== session.user.id) {
    return new ApiError("forbidden:api").toResponse();
  }

  return c.json(record);
}
