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
