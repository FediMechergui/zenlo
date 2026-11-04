# Zenlo shared implementation contract

All monetary amounts are safe integer millimes (1 TND = 1000). All dates are ISO UTC; date-only expiry fields YYYY-MM-DD inclusive in Africa/Tunis. UI French. Rental duration is ceil elapsed hours / 24 (minimum 1). Pilot one agency, 10–50 cars. API JSON, no real data seeded. Types in lib/types.ts are shared and owned by root; request changes via message.

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
