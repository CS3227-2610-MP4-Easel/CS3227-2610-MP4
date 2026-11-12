# API

One block per operation.

## <operation name / signature or METHOD /path>
| Field | Definition |
|---|---|
| Caller and principal | <who is authenticated; role required> |
| Authorization rule | <rule, and where it is enforced> |
| Tenancy scope | <whose data; how cross-tenant access is prevented> |
| Inputs | <name: type, validation, limits> |
| Outputs | <shape; fields never returned> |
| Errors | <condition -> error type / status / message> |
| Idempotency | <behaviour on repeat> |
| Transaction boundary | <what commits together> |
| Events / audit | <emitted after commit; audit rows written> |
| Logging | <logged; never logged> |
| Compatibility | <existing callers affected> |
