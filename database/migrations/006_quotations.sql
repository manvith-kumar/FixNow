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
