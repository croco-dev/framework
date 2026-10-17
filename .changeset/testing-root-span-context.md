---
"@croco/testing": patch
---

Honor the OpenTelemetry root span option in telemetry capture so root spans start a new trace without a parent, while ordinary spans inherit the selected parent context.
