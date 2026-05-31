//go:build ignore

package main

import (
    "database/sql"
    "fmt"
    "golang.org/x/crypto/bcrypt"
    _ "modernc.org/sqlite"
)

func main() {
    db, err := sql.Open("sqlite", "d:/populer125/data/rocketgrowth.db")
    if err != nil {
        panic(err)
    }
    defer db.Close()

    hash, err := bcrypt.GenerateFromPassword([]byte("ue125ujin!!"), bcrypt.DefaultCost)
    if err != nil {
        panic(err)
    }

    res, err := db.Exec("UPDATE users SET password=? WHERE email=?", string(hash), "populer125.co@gmail.com")
    if err != nil {
        panic(err)
    }
    rows, _ := res.RowsAffected()
    fmt.Printf("업데이트 완료: %d행\n", rows)
}
