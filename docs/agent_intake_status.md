# Intake Status

This file explains when the optional intake endpoint can be used.

## Treat Intake As Healthy When

- the request to `agent-intake.json:intake_endpoint` returns HTTP 200
- the response is valid JSON
- `schema_version` is `aip-1`
- `entrypoints` is not empty

## Treat Intake As Degraded When

- the request times out or fails
- the response is not successful
- the JSON is invalid or uses the wrong schema version
- `entrypoints` is missing or empty

## What To Do Next

- if healthy, use the returned entrypoints and suggested tags
- if degraded, use `llms.txt`, then `docs/agent_quickstart.md`
- keep `./scripts/check_agent_entrypoints.py` in the validation loop for doc or integration changes
