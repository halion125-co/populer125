package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

// Init initializes the SQLite database and creates tables
func Init(dbPath string) error {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	DB = db

	return createTables()
}

func createTables() error {
	_, err := DB.Exec(`
		CREATE TABLE IF NOT EXISTS users (
			id                  INTEGER PRIMARY KEY AUTOINCREMENT,
			email               TEXT UNIQUE NOT NULL,
			password            TEXT NOT NULL,
			phone               TEXT DEFAULT '',
			vendor_id           TEXT DEFAULT '',
			access_key          TEXT DEFAULT '',
			secret_key          TEXT DEFAULT '',
			name_ko             TEXT DEFAULT '',
			name_en             TEXT DEFAULT '',
			zipcode             TEXT DEFAULT '',
			address_ko          TEXT DEFAULT '',
			address_detail_ko   TEXT DEFAULT '',
			address_en          TEXT DEFAULT '',
			address_detail_en   TEXT DEFAULT '',
			customs_type        TEXT DEFAULT 'personal',
			customs_number      TEXT DEFAULT '',
			created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return err
	}
	if err := migrateUsers(); err != nil {
		return err
	}

	// 상품 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS products (
			id                   INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id              INTEGER NOT NULL,
			seller_product_id    INTEGER NOT NULL,
			seller_product_name  TEXT DEFAULT '',
			brand                TEXT DEFAULT '',
			status_name          TEXT DEFAULT '',
			sale_started_at      TEXT DEFAULT '',
			sale_ended_at        TEXT DEFAULT '',
			display_category_code INTEGER DEFAULT 0,
			category_id          INTEGER DEFAULT 0,
			registration_type    TEXT DEFAULT '',
			item_count           INTEGER DEFAULT 0,
			synced_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, seller_product_id)
		);
	`)
	if err != nil {
		return err
	}
	if err := migrateProducts(); err != nil {
		return err
	}

	// 상품 옵션 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS product_items (
			id                      INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id                 INTEGER NOT NULL,
			seller_product_id       INTEGER NOT NULL,
			item_id                 INTEGER NOT NULL,
			item_name               TEXT DEFAULT '',
			seller_product_item_name TEXT DEFAULT '',
			external_vendor_sku     TEXT DEFAULT '',
			original_price          REAL DEFAULT 0,
			sale_price              REAL DEFAULT 0,
			status_name             TEXT DEFAULT '',
			vendor_item_id          INTEGER DEFAULT 0,
			synced_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, item_id)
		);
	`)
	if err != nil {
		return err
	}

	// 재고 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS inventory (
			id                 INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id            INTEGER NOT NULL,
			vendor_item_id     INTEGER NOT NULL,
			seller_product_id  INTEGER DEFAULT 0,
			product_name       TEXT DEFAULT '',
			item_name          TEXT DEFAULT '',
			status_name        TEXT DEFAULT '',
			stock_quantity     INTEGER DEFAULT 0,
			sales_last_30_days INTEGER DEFAULT 0,
			is_mapped          INTEGER DEFAULT 0,
			synced_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, vendor_item_id)
		);
	`)
	if err != nil {
		return err
	}
	if err := migrateInventory(); err != nil {
		return err
	}

	// 주문 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id    INTEGER NOT NULL,
			order_id   INTEGER NOT NULL,
			paid_at    TEXT DEFAULT '',
			synced_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, order_id)
		);
	`)
	if err != nil {
		return err
	}

	// 주문 상품 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS order_items (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id         INTEGER NOT NULL,
			order_id        INTEGER NOT NULL,
			vendor_item_id  INTEGER DEFAULT 0,
			product_name    TEXT DEFAULT '',
			sales_quantity  INTEGER DEFAULT 0,
			unit_price      REAL DEFAULT 0,
			sales_price     REAL DEFAULT 0
		);
	`)
	if err != nil {
		return err
	}

	// 반품 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS returns (
			id                INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id           INTEGER NOT NULL,
			receipt_id        INTEGER NOT NULL,
			order_id          INTEGER DEFAULT 0,
			status            TEXT DEFAULT '',
			status_name       TEXT DEFAULT '',
			product_name      TEXT DEFAULT '',
			vendor_item_id    INTEGER DEFAULT 0,
			return_count      INTEGER DEFAULT 0,
			sales_quantity    INTEGER DEFAULT 0,
			return_reason     TEXT DEFAULT '',
			return_reason_code TEXT DEFAULT '',
			created_at_api    TEXT DEFAULT '',
			cancelled_at      TEXT DEFAULT '',
			returned_at       TEXT DEFAULT '',
			raw_json          TEXT DEFAULT '',
			synced_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, receipt_id)
		);
	`)
	if err != nil {
		return err
	}

	// 동기화 상태 테이블 (마지막 동기화 시각)
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS sync_status (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id       INTEGER NOT NULL,
			data_type     TEXT NOT NULL,
			last_synced_at DATETIME,
			record_count  INTEGER DEFAULT 0,
			UNIQUE(user_id, data_type)
		);
	`)
	if err != nil {
		return err
	}

	if err := migrateReturns(); err != nil {
		return err
	}

	// 주문 동기화 날짜 범위 이력 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS order_sync_ranges (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id    INTEGER NOT NULL,
			from_date  TEXT NOT NULL,
			to_date    TEXT NOT NULL,
			synced_at  DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		return err
	}

	// 배치 작업 정의 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS batch_jobs (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id     INTEGER NOT NULL,
			job_type    TEXT NOT NULL,
			job_name    TEXT NOT NULL,
			is_active   INTEGER DEFAULT 1,
			cron_expr   TEXT DEFAULT '0 0 * * *',
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(user_id, job_type)
		);
	`)
	if err != nil {
		return err
	}

	// 배치 실행 로그 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS batch_logs (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id      INTEGER NOT NULL,
			job_type     TEXT NOT NULL,
			triggered_by TEXT DEFAULT 'scheduler',
			status       TEXT DEFAULT 'running',
			message      TEXT DEFAULT '',
			record_count INTEGER DEFAULT 0,
			started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
			finished_at  DATETIME
		);
	`)
	if err != nil {
		return err
	}
	if err := migrateBatchLogs(); err != nil {
		return err
	}

	// 슬랙 웹훅 테이블
	_, err = DB.Exec(`
		CREATE TABLE IF NOT EXISTS slack_webhooks (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id     INTEGER NOT NULL,
			name        TEXT NOT NULL DEFAULT '',
			webhook_url TEXT NOT NULL,
			enabled     INTEGER NOT NULL DEFAULT 1,
			created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id)
		);
	`)
	return err
}

func migrateBatchLogs() error {
	DB.Exec("ALTER TABLE batch_logs ADD COLUMN from_date TEXT DEFAULT ''")
	DB.Exec("ALTER TABLE batch_logs ADD COLUMN to_date TEXT DEFAULT ''")
	return nil
}

func migrateInventory() error {
	DB.Exec("ALTER TABLE inventory ADD COLUMN seller_product_id INTEGER DEFAULT 0")
	// SQLite는 비상수 DEFAULT(CURRENT_TIMESTAMP) 컬럼 추가 불가 → NULL로 추가 후 backfill
	DB.Exec("ALTER TABLE inventory ADD COLUMN created_at DATETIME DEFAULT NULL")
	DB.Exec("ALTER TABLE inventory ADD COLUMN out_of_stock_at DATETIME DEFAULT NULL")
	// 기존 데이터의 created_at을 synced_at으로 채우기
	DB.Exec("UPDATE inventory SET created_at = synced_at WHERE created_at IS NULL")
	return nil
}

func migrateReturns() error {
	DB.Exec("ALTER TABLE returns ADD COLUMN item_name TEXT DEFAULT ''")
	return nil
}

func migrateProducts() error {
	DB.Exec("ALTER TABLE products ADD COLUMN item_count INTEGER DEFAULT 0")
	return nil
}

func migrateUsers() error {
	cols := []struct {
		name string
		def  string
	}{
		{"name_ko", "TEXT DEFAULT ''"},
		{"name_en", "TEXT DEFAULT ''"},
		{"zipcode", "TEXT DEFAULT ''"},
		{"address_ko", "TEXT DEFAULT ''"},
		{"address_detail_ko", "TEXT DEFAULT ''"},
		{"address_en", "TEXT DEFAULT ''"},
		{"address_detail_en", "TEXT DEFAULT ''"},
		{"customs_type", "TEXT DEFAULT 'personal'"},
		{"customs_number", "TEXT DEFAULT ''"},
		{"polling_interval_min", "INTEGER DEFAULT 10"},
	}
	for _, col := range cols {
		DB.Exec("ALTER TABLE users ADD COLUMN " + col.name + " " + col.def)
	}
	return nil
}
