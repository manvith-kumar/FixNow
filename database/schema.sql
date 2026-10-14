-- FixNow full schema (GENERATED from database/migrations by `npm run db:schema`).
-- Do not edit by hand. Import into an EMPTY database, or use `npm run db:migrate` instead.

-- >>> 001_users_and_auth.sql
-- 001: users and password reset tokens
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  phone         VARCHAR(30) NULL,
  role          ENUM('CUSTOMER','TECHNICIAN','ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  status        ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE password_reset_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prt_hash (token_hash),
  KEY idx_prt_user (user_id),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 002_service_catalogue.sql
-- 002: service categories and services (catalogue prices are INDICATIVE only)
CREATE TABLE service_categories (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  description TEXT NULL,
  icon        VARCHAR(60) NULL,
  image_url   VARCHAR(255) NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cat_name (name),
  UNIQUE KEY uq_cat_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE services (
  id                      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id             BIGINT UNSIGNED NOT NULL,
  name                    VARCHAR(120) NOT NULL,
  slug                    VARCHAR(140) NOT NULL,
  description             TEXT NULL,
  image_url               VARCHAR(255) NULL,
  indicative_starting_price DECIMAL(10,2) NULL,
  is_featured             TINYINT(1) NOT NULL DEFAULT 0,
  is_active               TINYINT(1) NOT NULL DEFAULT 1,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_service_slug (slug),
  UNIQUE KEY uq_service_cat_name (category_id, name),
  KEY idx_services_active (is_active, category_id),
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_services_price CHECK (indicative_starting_price IS NULL OR indicative_starting_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 003_technicians.sql
-- 003: technician profiles, applications, documents, service links, availability
CREATE TABLE technician_profiles (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  specialization   VARCHAR(150) NULL,
  experience_years TINYINT UNSIGNED NOT NULL DEFAULT 0,
  service_area     VARCHAR(190) NULL,
  bio              TEXT NULL,
  approval_status  ENUM('NOT_APPLIED','PENDING','NEEDS_INFO','APPROVED','REJECTED') NOT NULL DEFAULT 'NOT_APPLIED',
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  approved_at      DATETIME NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tp_user (user_id),
  KEY idx_tp_status (approval_status, is_active),
  CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE technician_applications (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  full_name        VARCHAR(120) NOT NULL,
  phone            VARCHAR(30) NOT NULL,
  specialization   VARCHAR(150) NOT NULL,
  experience_years TINYINT UNSIGNED NOT NULL,
  service_area     VARCHAR(190) NOT NULL,
  bio              TEXT NULL,
  service_ids      JSON NULL,
  status           ENUM('SUBMITTED','NEEDS_INFO','APPROVED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  reviewer_id      BIGINT UNSIGNED NULL,
  review_notes     TEXT NULL,
  reviewed_at      DATETIME NULL,
  submitted_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ta_user (user_id),
  KEY idx_ta_status (status, submitted_at),
  CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_ta_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE technician_documents (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  application_id BIGINT UNSIGNED NOT NULL,
  user_id        BIGINT UNSIGNED NOT NULL,
  doc_type       ENUM('ID_DOCUMENT','CERTIFICATE','PROOF_OF_EXPERIENCE','OTHER') NOT NULL,
  original_name  VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(100) NOT NULL,
  mime_type      VARCHAR(100) NOT NULL,
  size_bytes     INT UNSIGNED NOT NULL,
  uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_td_stored (stored_name),
  KEY idx_td_app (application_id),
  CONSTRAINT fk_td_app FOREIGN KEY (application_id) REFERENCES technician_applications(id) ON DELETE RESTRICT,
  CONSTRAINT fk_td_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE technician_services (
  technician_id BIGINT UNSIGNED NOT NULL,
  service_id    BIGINT UNSIGNED NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (technician_id, service_id),
  CONSTRAINT fk_ts_tech FOREIGN KEY (technician_id) REFERENCES technician_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ts_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE technician_availability (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  technician_id BIGINT UNSIGNED NOT NULL,
  day_of_week   TINYINT UNSIGNED NOT NULL, -- 0=Sunday .. 6=Saturday
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_available  TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_avail_slot (technician_id, day_of_week, start_time),
  CONSTRAINT fk_avail_tech FOREIGN KEY (technician_id) REFERENCES technician_profiles(id) ON DELETE CASCADE,
  CONSTRAINT chk_avail_dow CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_avail_time CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 004_addresses.sql
-- 004: customer addresses (coordinates optional)
CREATE TABLE addresses (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  label       VARCHAR(50) NOT NULL DEFAULT 'Home',
  line1       VARCHAR(190) NOT NULL,
  line2       VARCHAR(190) NULL,
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NULL,
  postal_code VARCHAR(20) NULL,
  country     VARCHAR(80) NOT NULL DEFAULT 'India',
  latitude    DECIMAL(9,6) NULL,
  longitude   DECIMAL(9,6) NULL,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_addr_user (user_id),
  CONSTRAINT fk_addr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_addr_lat CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_addr_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 005_bookings.sql
-- 005: bookings, status history, inspections
-- Addresses used by bookings are snapshotted so later edits never alter history.
CREATE TABLE bookings (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference          VARCHAR(30) NOT NULL,
  customer_id        BIGINT UNSIGNED NOT NULL,
  service_id         BIGINT UNSIGNED NOT NULL,
  address_id         BIGINT UNSIGNED NULL,
  address_snapshot   JSON NOT NULL,
  technician_id      BIGINT UNSIGNED NULL,   -- technician_profiles.id
  problem_description TEXT NOT NULL,
  preferred_date     DATE NOT NULL,
  preferred_time     TIME NOT NULL,
  latitude           DECIMAL(9,6) NULL,
  longitude          DECIMAL(9,6) NULL,
  status             ENUM('PENDING','ASSIGNED','INSPECTING','INSPECTION_COMPLETED','QUOTATION_SENT',
                          'QUOTATION_APPROVED','QUOTATION_REJECTED','IN_PROGRESS','COMPLETED','CANCELLED')
                     NOT NULL DEFAULT 'PENDING',
  payment_status     ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
  assigned_at        DATETIME NULL,
  completed_at       DATETIME NULL,
  completion_notes   TEXT NULL,
  cancelled_at       DATETIME NULL,
  cancel_reason      VARCHAR(500) NULL,
  cancelled_by       BIGINT UNSIGNED NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookings_ref (reference),
  KEY idx_bookings_customer (customer_id, created_at),
  KEY idx_bookings_tech (technician_id, status),
  KEY idx_bookings_status (status, created_at),
  KEY idx_bookings_service (service_id),
  CONSTRAINT fk_bk_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bk_address FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  CONSTRAINT fk_bk_tech FOREIGN KEY (technician_id) REFERENCES technician_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE booking_status_history (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id  BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status   VARCHAR(30) NOT NULL,
  actor_id    BIGINT UNSIGNED NULL,
  actor_role  VARCHAR(20) NULL,
  note        VARCHAR(500) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bsh_booking (booking_id, created_at),
  CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE inspections (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id         BIGINT UNSIGNED NOT NULL,
  technician_id      BIGINT UNSIGNED NOT NULL,
  diagnosis          TEXT NOT NULL,
  observed_condition TEXT NOT NULL,
  labour_notes       TEXT NULL,
  required_parts     TEXT NULL,
  additional_work    TEXT NULL,
  notes              TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insp_booking (booking_id),
  CONSTRAINT fk_insp_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_insp_tech FOREIGN KEY (technician_id) REFERENCES technician_profiles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 006_quotations.sql
-- 006: itemized quotations with full version history.
-- Each revision is a NEW row (version_number+1); previous rows and their items are preserved.
CREATE TABLE quotations (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id      BIGINT UNSIGNED NOT NULL,
  version_number  INT UNSIGNED NOT NULL,
  status          ENUM('PENDING','APPROVED','REJECTED','SUPERSEDED','WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  is_current      TINYINT(1) NOT NULL DEFAULT 1,
  current_key     TINYINT GENERATED ALWAYS AS (CASE WHEN is_current = 1 THEN 1 ELSE NULL END) VIRTUAL,
  subtotal        DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_rate        DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount    DECIMAL(12,2) NOT NULL,
  notes           TEXT NULL,
  revision_notes  TEXT NULL,
  valid_until     DATE NULL,
  created_by      BIGINT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by      BIGINT UNSIGNED NULL,
  decided_at      DATETIME NULL,
  decision_reason VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quote_version (booking_id, version_number),
  UNIQUE KEY uq_quote_one_current (booking_id, current_key),
  KEY idx_quote_status (status),
  CONSTRAINT fk_quote_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_quote_author FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_quote_amounts CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quotation_items (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id BIGINT UNSIGNED NOT NULL,
  item_type    ENUM('LABOUR','PART','MATERIAL','ADDITIONAL') NOT NULL,
  description  VARCHAR(255) NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL,
  unit_price   DECIMAL(12,2) NOT NULL,
  line_total   DECIMAL(12,2) NOT NULL,
  sort_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_qi_quote (quotation_id),
  CONSTRAINT fk_qi_quote FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE RESTRICT,
  CONSTRAINT chk_qi_amounts CHECK (quantity > 0 AND unit_price >= 0 AND line_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 007_payments_reviews.sql
-- 007: simulated payments and reviews
-- No card numbers / CVV / credentials are ever stored. Payments are SIMULATED (is_simulated=1).
CREATE TABLE payments (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id            BIGINT UNSIGNED NOT NULL,
  quotation_id          BIGINT UNSIGNED NOT NULL,
  customer_id           BIGINT UNSIGNED NOT NULL,
  amount                DECIMAL(12,2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'INR',
  method                ENUM('DEMO_CARD','DEMO_UPI','DEMO_WALLET','DEMO_FAILING_CARD') NOT NULL,
  status                ENUM('SUCCESS','FAILED') NOT NULL,
  success_key           TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'SUCCESS' THEN 1 ELSE NULL END) VIRTUAL,
  transaction_reference VARCHAR(40) NOT NULL,
  provider              VARCHAR(30) NOT NULL DEFAULT 'SIMULATED',
  is_simulated          TINYINT(1) NOT NULL DEFAULT 1,
  failure_reason        VARCHAR(255) NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pay_txn (transaction_reference),
  UNIQUE KEY uq_pay_one_success (booking_id, success_key),
  KEY idx_pay_customer (customer_id, created_at),
  CONSTRAINT fk_pay_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_quote FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reviews (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id    BIGINT UNSIGNED NOT NULL,
  customer_id   BIGINT UNSIGNED NOT NULL,
  technician_id BIGINT UNSIGNED NOT NULL,
  service_id    BIGINT UNSIGNED NOT NULL,
  rating        TINYINT UNSIGNED NOT NULL,
  comment       TEXT NULL,
  status        ENUM('VISIBLE','HIDDEN') NOT NULL DEFAULT 'VISIBLE',
  moderation_note VARCHAR(255) NULL,
  moderated_by  BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_booking (booking_id),
  KEY idx_review_tech (technician_id, status),
  KEY idx_review_service (service_id, status),
  CONSTRAINT fk_rev_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rev_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rev_tech FOREIGN KEY (technician_id) REFERENCES technician_profiles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_rev_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT chk_rev_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- >>> 008_notifications_audit_settings.sql
-- 008: notifications, audit log, system settings
CREATE TABLE notifications (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  type          VARCHAR(50) NOT NULL,
  title         VARCHAR(150) NOT NULL,
  message       VARCHAR(500) NOT NULL,
  resource_type VARCHAR(40) NULL,
  resource_id   BIGINT UNSIGNED NULL,
  is_read       TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at       DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_notif_user (user_id, is_read, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    BIGINT UNSIGNED NULL,
  actor_role  VARCHAR(20) NULL,
  action      VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id   BIGINT UNSIGNED NULL,
  details     JSON NULL,
  ip_address  VARCHAR(64) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE system_settings (
  setting_key   VARCHAR(80) NOT NULL,
  setting_value VARCHAR(500) NOT NULL,
  description   VARCHAR(255) NULL,
  updated_by    BIGINT UNSIGNED NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
 ('platform_name', 'FixNow', 'Display name of the platform'),
 ('default_tax_rate', '0', 'Suggested tax percentage when creating quotations'),
 ('quotation_validity_days', '7', 'Default number of days a quotation stays valid'),
 ('support_email', 'support@fixnow.example', 'Support contact shown on the site'),
 ('currency', 'INR', 'Currency code used for amounts');

