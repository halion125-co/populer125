import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './AppShell'
import {
  DashboardPage,
  SettingsPage,
  OrdersListPage,
  OrderDetailPage,
  InventoryPage,
  ProductsListPage,
  ProductDetailPage,
  ProductEditPage,
  ProductCreateWizardPage,
  CategoriesTreePage,
  CategoryMetaPage,
} from '../pages'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />

        <Route path="/inventory" element={<InventoryPage />} />

        <Route path="/products" element={<ProductsListPage />} />
        <Route path="/products/create" element={<ProductCreateWizardPage />} />
        <Route path="/products/:sellerProductId" element={<ProductDetailPage />} />
        <Route path="/products/:sellerProductId/edit" element={<ProductEditPage />} />

        <Route path="/categories" element={<CategoriesTreePage />} />
        <Route path="/categories/:displayCategoryCode/metas" element={<CategoryMetaPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
