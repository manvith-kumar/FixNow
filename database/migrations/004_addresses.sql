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
