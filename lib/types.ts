export type Role = 'owner' | 'manager' | 'agent' | 'accountant' | 'viewer';
export type RentalStatus = 'draft' | 'confirmed' | 'active' | 'returned' | 'cancelled';
export type VehicleStatus = 'ready' | 'maintenance' | 'retired';
export interface AgencySettings {
  name: string; address: string; phone: string; taxId: string;
  currency: 'TND'; timezone: 'Africa/Tunis'; preparationMinutes: number;
  taxRateBps: number; stampMillimes: number; fiscalValidated: boolean;
  dailyLevyRate: number; dailyLevyEnabled: boolean; dailyLevyTaxable: boolean;
  fiscalReviewer: string; fiscalSource: string; fiscalValidatedAt: string;
  invoiceWorkflow: 'unreviewed' | 'paper' | 'electronic'; invoiceWorkflowEvidence: string;
  contractTerms: string; termsVersion: string; retentionDays: number; retentionPolicy: string;
  hostingValidated: boolean; legalValidated: boolean;
}
export interface Workspace { id: string; name: string; mode: 'demo' | 'live'; settings: AgencySettings; createdAt: string; }
export interface Member { id: string; email: string; name: string; role: Role; }
export interface Vehicle {
  id: string; registration: string; make: string; model: string; category: string;
  year: number; transmission: 'manual' | 'automatic'; fuel: 'petrol' | 'diesel' | 'hybrid' | 'electric';
  seats: number; odometer: number; status: VehicleStatus; dailyRate: number;
  deposit: number; insuranceUntil: string; inspectionUntil: string;
  color: string; version: number; createdAt: string;
}
export interface Customer {
  id: string; type: 'individual' | 'company'; name: string; email: string;
  phone: string; address: string; country: string; licenseNumber: string; licenseUntil: string;
  taxId: string; notes: string; createdAt: string;
}
export interface Rental {
  id: string; number: string; customerId: string; vehicleId: string;
  startAt: string; endAt: string; actualStartAt: string | null; actualEndAt: string | null;
  status: RentalStatus; dailyRate: number; days: number; discount: number; extras: number;
  subtotal: number; tax: number; stamp: number; dailyLevy: number; dailyLevyRate: number;
  dailyLevyTaxable: boolean; taxRateBps: number;
  total: number; depositRequired: number; includedKm: number; extraKmRate: number;
  source: 'agency' | 'phone' | 'website' | 'partner'; pickupLocation: string; returnLocation: string;
  notes: string; termsVersion: string; termsSnapshot: string; version: number; createdAt: string;
}
export interface Inspection {
  id: string; rentalId: string; vehicleId: string; type: 'departure' | 'return';
  odometer: number; fuelPercent: number; condition: string; damages: string; customerAccepted: boolean;
  createdAt: string;
}
export interface Invoice {
  id: string; number: string; rentalId: string; customerId: string;
  status: 'draft' | 'issued' | 'credited'; subtotal: number; tax: number; stamp: number; dailyLevy: number; total: number;
  taxRateBps: number; externalStatus: 'not_configured' | 'pending' | 'accepted' | 'rejected';
  issuedAt: string | null; createdAt: string;
}
export interface Payment {
  id: string; rentalId: string; invoiceId: string | null;
  kind: 'payment' | 'refund' | 'deposit_received' | 'deposit_returned' | 'deposit_applied';
  method: 'cash' | 'bank' | 'card' | 'cheque'; amount: number; reference: string; note: string; createdAt: string;
}
export interface CreditNote { id:string; invoiceId:string; number:string; amount:number; reason:string; createdAt:string; }
export interface Maintenance {
  id: string; vehicleId: string; title: string; startAt: string; endAt: string;
  status: 'planned' | 'in_progress' | 'completed'; cost: number; supplier: string;
  odometer: number; notes: string; createdAt: string;
}
export interface AvailabilityBlock { id:string; vehicleId:string; rentalId:string|null; maintenanceId:string|null; kind:string; startMs:number; endMs:number; }
export interface Expense { id: string; vehicleId: string | null; category: string; supplier: string; amount: number; date: string; note: string; createdAt: string; }
export interface AuditEntry { id: string; actor: string; action: string; entityType: string; entityId: string; detail: string; createdAt: string; }
export interface CashSession { id: string; openedAt: string; closedAt: string | null; openingAmount: number; expectedAmount: number | null; countedAmount: number | null; note: string; }
export interface WorkspaceData {
  workspace: Workspace; user: { id: string; name: string; email: string; role: Role };
  vehicles: Vehicle[]; customers: Customer[]; rentals: Rental[]; inspections: Inspection[];
  invoices: Invoice[]; creditNotes: CreditNote[]; payments: Payment[]; maintenance: Maintenance[]; blocks: AvailabilityBlock[];
  expenses: Expense[]; audit: AuditEntry[]; cashSessions: CashSession[]; members: Member[];
}
export interface ApiError { error: { code: string; message: string; fields?: Record<string,string>; correlationId: string }; }
