
- Scheduled DB jobs call privileged edge functions with an `x-job-token` header matched against `internal_job_tokens` (backend-only table); why: the service-role key is not available to SQL.
