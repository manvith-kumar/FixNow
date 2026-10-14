# FixNow REST API

Base URL: `http://localhost:5000/api` - JSON in/out. Auth: `Authorization: Bearer <token>`.

**Success:** `{ "success": true, "data": ..., "meta": { page, pageSize, total, totalPages } }`
**Error:** `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field", "message" }] } }`

Common status codes: 400 validation, 401 unauthenticated/expired (`TOKEN_EXPIRED`, `INVALID_TOKEN`), 403 forbidden / disabled account, 404 not found **(also used when a record exists but belongs to someone else)**, 409 state conflict, 422 business-rule violation, 429 rate limited, 402 simulated payment declined.

Roles: **P** public, **A** any authenticated, **C** CUSTOMER, **T** TECHNICIAN (approved+active needed where noted *), **AD** ADMIN.
Lists accept `page`, `pageSize` (<=100), `sortBy` (whitelisted), `sortDir`.

## Auth `/auth`
| Method | Path | Who | Notes / DB effects |
|---|---|---|---|
| POST | /register | P | body `email, password(>=8, letter+digit), fullName, phone?, role: CUSTOMER\|TECHNICIAN`; creates user (+ technician profile) |
| POST | /login | P | returns `{ token, user }`; generic error for bad credentials; 403 if disabled |
| POST | /logout | A | bumps `token_version` (revokes all tokens) |
| GET | /me | A | current user |
| POST | /forgot-password | P | generic response; stores hashed token |
| POST | /reset-password | P | `{ token, password }`; single use; revokes sessions |
| POST | /change-password | A | `{ currentPassword, newPassword }`; returns a fresh token |

## Users `/users`
| PATCH | /me | A | update `fullName`, `phone` |
| GET | / | AD | filters `role,status,q` |
| GET | /:id | AD | |
| PATCH | /:id/status | AD | `{status: ACTIVE\|DISABLED}`; revokes tokens; cannot target self; audited |

## Catalogue `/categories`, `/services`
| GET | /categories | P | `q`; admin may add `all=true` to include inactive |
| POST | /categories | AD | `name, description?, icon?, imageUrl?, isActive` |
| PATCH | /categories/:id | AD | partial; deactivate instead of delete |
| GET | /services | P | `categoryId,q,featured,sortBy(name,price,created),page`; admin `all=true` includes inactive |
| GET | /services/:id | P | inactive -> 404 unless admin |
| POST | /services | AD | `categoryId,name,description?,imageUrl?,indicativeStartingPrice?` (indicative only) |
| PATCH | /services/:id | AD | partial |

## Addresses `/addresses` (C, own records only)
GET `/`, POST `/` (`label,line1,line2?,city,state?,postalCode?,country,latitude?,longitude?,isDefault?` - coordinates both-or-neither), PATCH `/:id`, POST `/:id/default`, DELETE `/:id` (409 `ADDRESS_IN_USE` if a booking used it).

## Technician applications `/technician-applications`
| POST | / | T | **multipart**: `fullName, phone, specialization, experienceYears, serviceArea, bio?, serviceIds (JSON array or comma list), docTypes (comma list, one per file, must include ID_DOCUMENT)` + files `documents` (PDF/JPG/PNG, <=5 files). Profile -> `PENDING`; admins notified |
| GET | /mine | T | latest application + history + admin feedback |
| POST | /:id/documents | T | add files; if status was `NEEDS_INFO` it returns to `SUBMITTED` |
| GET | / | AD | filters `status,q` |
| GET | /:id | AD | details + document metadata |
| POST | /:id/decision | AD | `{decision: APPROVE\|REJECT\|REQUEST_INFO, notes}` (notes required unless APPROVE). APPROVE sets profile `APPROVED` and copies services; reviewer/timestamp stored; audited |
| GET | /:id/documents/:docId/download | AD, owner T | streams file (`nosniff`, `no-store`) |

## Technicians `/technicians`, `/availability`
| GET/PATCH | /technicians/me | T | profile; `serviceIds` editable only when approved |
| GET | /technicians/me/earnings | T | simulated payments for own jobs |
| GET | /technicians, /technicians/:id | AD | filters `status,q` |
| PATCH | /technicians/:id/active | AD | `{isActive}` - deactivated technicians cannot work |
| GET/PUT | /availability | T | PUT replaces weekly slots `{slots:[{dayOfWeek 0-6,startTime,endTime,isAvailable}]}`; overlaps rejected |

## Bookings `/bookings`
| POST | / | C | `serviceId,addressId,problemDescription(10+),preferredDate,preferredTime,latitude?,longitude?`; ownership + active service enforced; reference `FN-YYYYMMDD-XXXXXX` |
| GET | / | A | role-scoped (customer: own, technician: assigned, admin: all); filters `status,q,serviceId,from,to,paymentStatus,technicianId,customerId` |
| GET | /available | T* | open jobs for my services, limited details |
| GET | /:id | A | detail + history + inspection + current quotation + payment (404 if not yours) |
| GET | /:id/quotations | A | all versions with items |
| POST | /:id/accept | T* | atomic claim; 409 `JOB_ALREADY_TAKEN` for losers |
| POST | /:id/assign | AD | `{technicianId}` |
| POST | /:id/status | T* | `{status: INSPECTING\|IN_PROGRESS}` (IN_PROGRESS needs approved quotation) |
| POST | /:id/inspection | T* | `diagnosis, observedCondition, labourNotes?, requiredParts?, additionalWork?, notes?` -> `INSPECTION_COMPLETED` |
| POST | /:id/complete | T* | `{completionNotes}`; needs `IN_PROGRESS` + approved quotation |
| POST | /:id/cancel | C own, AD | `{reason?}`; withdraws a pending quotation |

## Quotations `/quotations`
| POST | / | T* | `{bookingId, items:[{itemType LABOUR\|PART\|MATERIAL\|ADDITIONAL, description, quantity, unitPrice}], discountAmount?, taxRate?, notes?, revisionNotes?, validUntil?}`. First call = v1; later calls = revisions (new version, old preserved). Totals computed server-side; totals in body are rejected (400) |
| GET | /?bookingId= | A (own) | versions; admin without `bookingId` gets a paginated list (`status,q,currentOnly`) |
| GET | /:id | A (own) | |
| POST | /:id/approve | C | only current, pending, unexpired quotation of own booking in `QUOTATION_SENT`; stale -> 409 `QUOTATION_STALE` |
| POST | /:id/reject | C | `{reason(5+)}` |

## Payments `/payments` (SIMULATED)
| POST | / | C | `{bookingId, method: DEMO_CARD\|DEMO_UPI\|DEMO_WALLET\|DEMO_FAILING_CARD}` -> 201 on success, 402 on simulated decline (attempt stored). 409 `ALREADY_PAID`, `NOT_PAYABLE` |
| GET | / | A | customer: own; technician: successful payments for own jobs; admin: all (`status,q,from,to`) |
| GET | /:id | A (own) | receipt (includes "no real money" notice) |

## Reviews `/reviews`
| GET | / | P | visible reviews; `serviceId`, `technicianId`; first names only |
| POST | / | C | `{bookingId, rating 1-5, comment?}` - only own COMPLETED booking, once |
| GET | /mine | C, T | own reviews (technician: visible reviews about them) |
| GET | /admin | AD | `status,q` |
| PATCH | /:id/moderation | AD | `{status: VISIBLE\|HIDDEN, note?}`; audited |

## Notifications `/notifications` (own only)
GET `/` (`unreadOnly`, response meta includes `unread`), POST `/:id/read`, POST `/read-all`.

## Admin `/admin` and misc
| GET | /admin/dashboard | AD | real DB metrics; revenue = successful simulated payments only |
| GET | /admin/reports | AD | list of report types |
| GET | /admin/reports/:type | AD | `booking-volume, service-demand, technician-workload, completed-cancelled, quotation-rates, payments-summary`; `from,to` (UTC dates, default last 30 days); `format=csv` for a safe CSV |
| GET/PUT | /admin/settings | AD | validated keys: `platform_name, default_tax_rate, quotation_validity_days, support_email, currency` |
| GET | /admin/audit-logs | AD | `action, entityType` |
| GET | /settings/public | P | non-sensitive settings |
| GET | /health | P | liveness + DB check |

## Booking status transitions
See `docs/DECISIONS.md` for the diagram and rules.
