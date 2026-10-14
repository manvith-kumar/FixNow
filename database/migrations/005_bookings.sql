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
