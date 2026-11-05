# Zenlo shared implementation contract

All monetary amounts are safe integer millimes (1 TND = 1000). All dates are ISO UTC; date-only expiry fields YYYY-MM-DD inclusive in Africa/Tunis. UI French. Rental duration is ceil elapsed hours / 24 (minimum 1). Multiple isolated enterprises with distinct memberships; UI calibrated for10–50cars per agency. API JSON, no real data seeded. Shared public types are in lib/types.ts; structured condition schemas are in lib/inspection.ts.

## Extended contract — 5 November 2026

- POST `/api/workspaces` `{name,mode}` creates a separate enterprise; POST `/api/workspaces/select` `{workspaceId}` selects a membership-validated tenant via HttpOnly SameSite cookie. WorkspaceData includes availableWorkspaces, assignments, suppliers, expensePayments, obligations and quotes.
- Vehicle requests accept `bodyType` (15 silhouettes), `vin`, optional `diagramProfile` and `rentalPolicy` from `lib/inspection.ts`. Profiles persist per vehicle; geometry is frozen into inspection data. Non-car live rentals require explicit reviewed vehicle rules; these override the corresponding agency fiscal values. An active rental prevents geometry/rules changes.
- GET `/api/vehicle-templates` lists the selected enterprise library. Owner/manager POST `{make,model,bodyType,diagramProfile,id?,expectedVersion?}` creates/updates a template; DELETE `{id,expectedVersion}` removes it without changing existing copies. Origin, idempotency, membership, tenant and optimistic-version checks apply. Limit: 200 templates per enterprise.
- GET `/api/catalog?make=...` supplies authenticated suggestions with bounded official NHTSA enrichment and local fallback.
- Rental inspections accept `inspectionData` validated against lib/inspection.ts: four-view marks, severities, inherited/resolved observations and eleven checks. Real checkout/return requires all checks reviewed. Checkout refuses failed checks and missing verified driver files; a failed return immobilizes the vehicle.
- POST/PATCH `/api/suppliers[/:id]`, POST `/api/expenses` including supplierId/reference/dueDate, POST `/api/expenses/:id/pay` `{amount,method:'bank'|'card',reference,date,note}`. External payments are recorded, never initiated by Zenlo.
- POST `/api/obligations`, POST `/api/obligations/:id/complete`; exact fields in server/validation.ts. Completion records real costs and creates one linked expense and optional next occurrence.
- POST `/api/quotes` `{rentalId,validUntil,notes}`; POST `/api/quotes/:id/action` `{action:'accept'|'decline'|'cancel',expectedVersion}`. Quote content/profile immutable; acceptance does not reserve a vehicle.
- POST `/api/files` multipart file/kind/customerId?/expenseId?; JPEG/PNG only. GET `/api/files?customerId=...` lists protected metadata and a verificationFingerprint of current driver identity. POST `/api/files/:id/action` `{action:'verify',verificationFingerprint}` or `{action:'revoke'}`. GET `/api/files/:id` streams a role-protected image; clients can only obtain their agency logo, never identity copies.
- POST `/api/client-access` `{rentalId,email,name?,expiresAt}`, GET with rentalId and POST `/:id/revoke`. GET `/api/client` returns explicitly shared dossiers for the authenticated email; POST `/api/client/:id/acknowledge` `{inspectionHash}` confirms reading of the current condition report. No invitation messages or changes to Sites sharing occur.
- POST `/api/members/:id/revoke` removes an internal membership; owner protected. Mechanic added to existing roles. Staff/client authorization and report fingerprints are rechecked at commit/read.
- Printable documents: `/documents/{contract|invoice|credit|quote|delivery|inspection|deposit}/{id}`, contract/delivery optionally `?version=N`; reports `/documents/report/{operations|fleet|finance|expenses}?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- AgencySettings adds email, fax, website, RNE, legal form/capital, bank/RIB, uploaded logo ID, accent/footer, quote validity days and optional required proof backs. Frozen documents retain previous branding.

Earlier core endpoints below remain supported. Runtime validation is authoritative; unsupported keys are rejected instead of silently ignored.

## HTTP contract

- GET /api/workspace -> WorkspaceData OR {needsSetup:true,user:{id,name,email}}. 401 unauthenticated.
- POST /api/setup {mode:'demo'|'live',name:string} -> WorkspaceData. Never silently populate real workspace. Fictional demo label always shown.
- POST /api/vehicles {registration,make,model,category,year,transmission,fuel,seats,odometer,dailyRate,deposit,insuranceUntil,inspectionUntil,color} -> {id}
- PATCH /api/vehicles/{id} {expectedVersion,...editableFields} -> {id}
- POST /api/customers {type,name,email,phone,address,country,licenseNumber,licenseUntil,taxId,notes} -> {id}
- POST /api/rentals {customerId,vehicleId,startAt,endAt,dailyRate,discount,extras,depositRequired,includedKm,extraKmRate,source,pickupLocation,returnLocation,notes,status:'draft'|'confirmed'} -> {id}
- POST /api/rentals/{id}/action {action:'confirm'|'cancel'|'checkout'|'checkin'|'extend'|'swap',expectedVersion,...actionFields} -> {id}
  - cancel: reason; checkout/checkin: inspection:{odometer,fuelPercent,condition,damages,customerAccepted}, checkin also extras if applicable; extend: endAt; swap: vehicleId,oldOdometer,newOdometer,oldInspection,newInspection,reason. Server records inspections and assignment history.
- POST /api/payments {rentalId,kind,method,amount,reference,note} -> {id}. Server validates balances, cash session, permissions; deposits separated. Deposit_applied transfers deposit liability into rental settlement without fictitious cash movement.
- POST /api/invoices {rentalId} -> {id} (draft); POST /api/invoices/{id}/issue {} -> {id}; POST /api/invoices/{id}/credit {reason} -> {id}
- POST /api/maintenance {vehicleId,title,startAt,endAt,cost,supplier,odometer,notes} -> {id}; POST /api/maintenance/{id}/complete {} -> {id}
- POST /api/expenses {vehicleId:null|string,category,supplier,amount,date,note} -> {id}
- POST /api/cash {action:'open'|'close',openingAmount?|countedAmount?|note?} -> {id}
- PATCH /api/settings {name,address,phone,taxId,preparationMinutes,taxRateBps,stampMillimes,fiscalValidated,fiscalReviewer,fiscalSource,contractTerms,termsVersion,retentionDays,hostingValidated,legalValidated} -> {ok:true}
- POST /api/members {email,name,role} -> {id}; PATCH /api/members/{id} {role} -> {id}; authorization from server membership, not client.
- GET /api/export?kind=vehicles|customers|rentals|payments|invoices|audit -> text/csv, scoped and formula injection protected.
- GET /documents/{kind}/{id}, kind=contract|invoice|deposit -> printable French document, real authorization enforced, status and demo watermark truthful. Root owns this route.

Mutations send Idempotency-Key UUID and Origin. Error shape lib/types.ts. After successful mutation UI reloads GET /api/workspace. No fake successful actions; errors rendered inline. Requests use relative URLs. Shared API endpoint routing can be app/api/[...path]/route.ts. Server implementation must use verified ChatGPT auth helpers (platform trust boundary), ownership/membership, Origin check, zod validation, D1 transactions via batch + constraints/triggers, audit in same transaction. Root owns deployment, packages, documents, testing and lib/format.ts. Backend owns db/, server/, app/api/. Frontend owns app/page.tsx, app/components/, app/globals.css, app/layout.tsx, public/.
