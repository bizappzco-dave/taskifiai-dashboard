# Marketing report autoload → TaskifiAI dashboard

Monthly SEO reports should publish into TaskifiAI through the internal report endpoint. Once a report is upserted, it appears automatically in the client reports dashboard.

## Endpoint

```http
POST https://taskifiai-dashboard.vercel.app/api/internal/reports/seo/upsert
Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET or INTERNAL_API_SECRET>
Content-Type: application/json
```

The same secret can also be sent as `x-totalsitedata-secret`.

## Required fields

```json
{
  "client_id": "dbf312c0-3121-42b1-9512-355ebd269fa7",
  "report_type": "seo",
  "period_start": "2026-06-01",
  "period_end": "2026-06-30",
  "title": "June SEO Visibility Report"
}
```

## Recommended payload

```json
{
  "client_id": "CLIENT_UUID",
  "report_type": "seo",
  "period_start": "2026-06-01",
  "period_end": "2026-06-30",
  "title": "June SEO Visibility Report",
  "summary": "Visibility improved across 4 of 6 tracked keywords.",
  "score": 78,
  "status": "ready",
  "source": "marketing-monthly-report",
  "external_id": "seo:CLIENT_UUID:2026-06",
  "metrics": {
    "local_visibility_score": 64,
    "organic_clicks": 124,
    "organic_impressions": 3820,
    "average_position": 9.4,
    "top_keywords": [
      { "keyword": "kitchen design dublin", "position": 6 },
      { "keyword": "kitchens tallaght", "position": 3 }
    ]
  },
  "recommendations": [
    "Add a dedicated service-area section for Dublin 24.",
    "Publish two Google Business Profile posts this month.",
    "Request three detailed customer reviews."
  ],
  "pdf_base64": "BASE64_ENCODED_PDF",
  "pdf_filename": "june-seo-visibility-report.pdf",
  "pdf_content_type": "application/pdf"
}
```

## File handling

If `pdf_base64` is included, TaskifiAI uploads it to the private Supabase Storage bucket:

```text
client-reports/{client_id}/{report_type}/{period_start}-{filename}
```

The dashboard generates signed links for clients, so the bucket remains private.

If the PDF is hosted elsewhere, send `pdf_url` instead of `pdf_base64`.

## Idempotency

Reports are upserted by:

```text
client_id + report_type + period_start + period_end
```

Re-running the monthly job updates the existing report instead of creating duplicates.

## Side effects

Each successful upsert also logs an activity:

```text
activity_type = client_report_ready
product = reports
```

This lets the Client Intelligence activity feed show that a new report is ready.
