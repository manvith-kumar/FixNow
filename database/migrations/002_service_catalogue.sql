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
