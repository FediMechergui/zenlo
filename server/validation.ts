import { z } from 'zod';
export const text = z.string().trim().max(2000);
export const short = z.string().trim().max(180);
export const required = short.min(1,'Ce champ est obligatoire.');
export const money = z.number().int().min(0).max(999_999_999_999);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Date attendue au format AAAA-MM-JJ.').refine(s=>Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Date invalide.');
export const optionalDate = z.union([date,z.literal('')]);
export const timestamp = z.string().datetime({offset:true}).transform(s=>new Date(s).toISOString());
export const email = z.union([z.string().email().max(254),z.literal('')]).transform(v=>v.toLowerCase());
export const vehicleSchema=z.object({registration:required.transform(v=>v.toUpperCase()),make:required,model:required,category:required,year:z.number().int().min(1980).max(2100),transmission:z.enum(['manual','automatic']),fuel:z.enum(['petrol','diesel','hybrid','electric']),seats:z.number().int().min(1).max(30),odometer:z.number().int().min(0).max(3_000_000),dailyRate:money,deposit:money,insuranceUntil:date,inspectionUntil:date,color:short.default('Blanc')}).strict();
export const vehiclePatch=vehicleSchema.partial().extend({status:z.enum(['ready','maintenance','retired']).optional(),expectedVersion:z.number().int().positive()}).strict();
export const customerSchema=z.object({type:z.enum(['individual','company']).default('individual'),name:required,email:email.default(''),phone:short.min(5,'Indiquez un numéro de téléphone.'),country:short.default('Tunisie'),licenseNumber:short.default(''),licenseUntil:optionalDate.default(''),taxId:short.default(''),notes:text.default(''),address:text.default('')}).strict();
export const rentalSchema=z.object({customerId:required,vehicleId:required,startAt:timestamp,endAt:timestamp,dailyRate:money,discount:money.default(0),extras:money.default(0),depositRequired:money,includedKm:z.number().int().min(0).max(1_000_000).default(1000),extraKmRate:money.default(500),source:z.enum(['agency','phone','website','partner']).default('agency'),pickupLocation:required,returnLocation:required,notes:text.default(''),status:z.enum(['draft','confirmed']).default('draft')}).strict();
export const inspectionSchema=z.object({odometer:z.number().int().min(0).max(3_000_000),fuelPercent:z.number().int().min(0).max(100),condition:required,damages:text.default(''),customerAccepted:z.boolean()}).strict();
export const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('confirm'),expectedVersion:z.number().int().positive()}).strict(),
 z.object({action:z.literal('cancel'),expectedVersion:z.number().int().positive(),reason:required}).strict(),
 z.object({action:z.literal('checkout'),expectedVersion:z.number().int().positive(),inspection:inspectionSchema}).strict(),
 z.object({action:z.literal('checkin'),expectedVersion:z.number().int().positive(),inspection:inspectionSchema,extras:money.optional()}).strict(),
 z.object({action:z.literal('extend'),expectedVersion:z.number().int().positive(),endAt:timestamp}).strict(),
 z.object({action:z.literal('swap'),expectedVersion:z.number().int().positive(),vehicleId:required,oldOdometer:z.number().int().min(0).max(3_000_000),newOdometer:z.number().int().min(0).max(3_000_000),oldInspection:inspectionSchema,newInspection:inspectionSchema,reason:required}).strict(),
]);
export const paymentSchema=z.object({rentalId:required,kind:z.enum(['payment','refund','deposit_received','deposit_returned','deposit_applied']),method:z.enum(['cash','bank','card','cheque']),amount:money.refine(v=>v>0,'Le montant doit être positif.'),reference:short.default(''),note:text.default('')}).strict();
export const maintenanceSchema=z.object({vehicleId:required,title:required,startAt:timestamp,endAt:timestamp,cost:money.default(0),supplier:short.default(''),odometer:z.number().int().min(0).max(3_000_000),notes:text.default('')}).strict();
export const expenseSchema=z.object({vehicleId:z.union([required,z.null()]).default(null),category:required,supplier:short.default(''),amount:money.refine(v=>v>0),date, note:text.default('')}).strict();
export const cashSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('open'),openingAmount:money,note:text.default('')}).strict(),
 z.object({action:z.literal('close'),countedAmount:money,note:text.default('')}).strict(),
]);
export const settingsSchema=z.object({name:required,address:text,phone:short,taxId:short,preparationMinutes:z.number().int().min(0).max(1440),taxRateBps:z.number().int().min(0).max(10000),stampMillimes:money,dailyLevyRate:money,dailyLevyEnabled:z.boolean(),dailyLevyTaxable:z.boolean(),fiscalValidated:z.boolean(),fiscalReviewer:short,fiscalSource:text,invoiceWorkflow:z.enum(['unreviewed','paper','electronic']),invoiceWorkflowEvidence:text,contractTerms:z.string().trim().max(30000),termsVersion:required,retentionDays:z.number().int().min(0).max(36500),retentionPolicy:text,hostingValidated:z.boolean(),legalValidated:z.boolean()}).partial().strict();
export const memberSchema=z.object({email:z.string().email().max(254).transform(v=>v.toLowerCase()),name:required,role:z.enum(['manager','agent','accountant','viewer'])}).strict();
