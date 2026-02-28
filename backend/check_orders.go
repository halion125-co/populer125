//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/rocketgrowth/backend/internal/coupang"
)

func main() {
	vendorID := os.Getenv("COUPANG_VENDOR_ID")
	accessKey := os.Getenv("COUPANG_ACCESS_KEY")
	secretKey := os.Getenv("COUPANG_SECRET_KEY")

	if vendorID == "" || accessKey == "" || secretKey == "" {
		fmt.Println("ERROR: Missing environment variables")
		os.Exit(1)
	}

	client := coupang.NewClient(vendorID, accessKey, secretKey)

	// 최근 7일 주문 조회
	now := time.Now()
	fromStr := now.AddDate(0, 0, -7).Format("2006-01-02")
	toStr := now.Format("2006-01-02")

	fmt.Printf("=== RG Orders API 응답 구조 확인 (%s ~ %s) ===\n", fromStr, toStr)

	data, err := client.GetOrders(fromStr, toStr)
	if err != nil {
		fmt.Printf("ERROR GetOrders: %v\n", err)
		os.Exit(1)
	}

	// Raw 응답 출력
	var raw interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		fmt.Printf("ERROR parse: %v\n", err)
		os.Exit(1)
	}

	pretty, _ := json.MarshalIndent(raw, "", "  ")
	fmt.Println(string(pretty))
}
